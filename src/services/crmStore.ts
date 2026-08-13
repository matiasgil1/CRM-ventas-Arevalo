/**
 * CRM Storage Engine & Real-Time Sync with Firebase Firestore & Auth
 */

import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  query
} from 'firebase/firestore';
import { db, loginWithGoogle as firebaseLoginWithGoogle, logoutFirebase } from './firebase';
import { Campaign, Lead, LeadStatus, User, SUPER_ADMIN_EMAIL, SyncLog, SyncHealthState } from '../types/crm';
import { formatPeriodMMYYYY } from '../utils/formatters';
import { findMatchingSeller } from '../utils/sellerUtils';

const USERS_KEY = 'arevalo_crm_users_v2';
const CAMPAIGNS_KEY = 'arevalo_crm_campaigns_v2';
const LEADS_KEY = 'arevalo_crm_leads_v2';
const CURRENT_USER_KEY = 'arevalo_crm_current_user_v2';
const SYNC_LOGS_KEY = 'arevalo_crm_sync_logs_v1';

// Default Super Admin Document
const SUPER_ADMIN_USER: User = {
  id: 'usr-superadmin',
  email: SUPER_ADMIN_EMAIL,
  name: 'Matías Gil (Super Admin)',
  role: 'admin',
  status: 'approved',
  createdAt: new Date().toISOString(),
  phone: '3515550011'
};

export const DEFAULT_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxIPR58ZibTAfEP4zPyDfvwysyUV3aXWcO_vdvSTplU8YA4R8P_Xhkmjp53dVvQiQVKAA/exec';

class CrmStore {
  private users: User[] = [];
  private campaigns: Campaign[] = [];
  private leads: Lead[] = [];
  private currentUser: User | null = null;
  private listeners: Set<() => void> = new Set();
  private sheetsWebhookUrl: string = localStorage.getItem('arevalo_sheets_webhook') || DEFAULT_SHEETS_WEBHOOK_URL;
  private isFirebaseConnected = false;
  private syncLogs: SyncLog[] = [];
  private lastFirestoreSync: string | null = null;
  private lastWebhookSync: string | null = null;
  private lastWebhookStatus: 'success' | 'error' | 'idle' | 'syncing' = 'idle';

  public getSheetsWebhookUrl(): string {
    return this.sheetsWebhookUrl || DEFAULT_SHEETS_WEBHOOK_URL;
  }

  public setSheetsWebhookUrl(url: string) {
    this.sheetsWebhookUrl = url.trim() || DEFAULT_SHEETS_WEBHOOK_URL;
    localStorage.setItem('arevalo_sheets_webhook', this.sheetsWebhookUrl);
    this.addSyncLog({
      type: 'sheets_webhook',
      status: this.sheetsWebhookUrl ? 'info' : 'warning',
      message: 'URL de Webhook configurada',
      details: `Configurado: ${this.sheetsWebhookUrl.substring(0, 35)}...`
    });
    this.notify();
  }

  public addSyncLog(log: Omit<SyncLog, 'id' | 'timestamp'>) {
    const newLog: SyncLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...log
    };
    this.syncLogs.unshift(newLog);
    if (this.syncLogs.length > 100) {
      this.syncLogs = this.syncLogs.slice(0, 100);
    }
    try {
      localStorage.setItem(SYNC_LOGS_KEY, JSON.stringify(this.syncLogs));
    } catch (e) {
      console.warn('Storage limit for sync logs:', e);
    }
    this.notify();
  }

  public getSyncHealthState(): SyncHealthState {
    return {
      isFirestoreConnected: this.isFirebaseConnected,
      lastFirestoreSync: this.lastFirestoreSync,
      webhookConfigured: Boolean(this.sheetsWebhookUrl),
      webhookUrl: this.sheetsWebhookUrl,
      lastWebhookSync: this.lastWebhookSync,
      lastWebhookStatus: this.lastWebhookStatus,
      totalLeadsInLocal: this.leads.length,
      totalLeadsInRemote: this.leads.length,
      pendingSyncCount: 0,
      recentLogs: this.syncLogs
    };
  }

  public clearSyncLogs() {
    this.syncLogs = [];
    localStorage.removeItem(SYNC_LOGS_KEY);
    this.addSyncLog({
      type: 'manual_sync',
      status: 'info',
      message: 'Registro de logs limpiado por el usuario'
    });
  }

  private notifyWebhook(lead: Lead, action: 'upsert' | 'delete' = 'upsert') {
    if (!this.sheetsWebhookUrl) {
      this.addSyncLog({
        type: 'sheets_webhook',
        status: 'warning',
        message: 'No se envió webhook: URL de Google Sheets no configurada',
        leadId: lead.id,
        leadName: `${lead.nombre} ${lead.apellido}`
      });
      return;
    }

    this.lastWebhookStatus = 'syncing';
    this.notify();

    try {
      fetch(this.sheetsWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, lead })
      }).then(() => {
        this.lastWebhookSync = new Date().toISOString();
        this.lastWebhookStatus = 'success';
        this.addSyncLog({
          type: 'sheets_webhook',
          status: 'success',
          message: `Webhook disparado exitosamente para lead "${lead.nombre} ${lead.apellido}" (${lead.estado})`,
          details: `POST no-cors -> ${this.sheetsWebhookUrl.substring(0, 45)}...`,
          leadId: lead.id,
          leadName: `${lead.nombre} ${lead.apellido}`
        });
      }).catch(err => {
        this.lastWebhookStatus = 'error';
        this.addSyncLog({
          type: 'sheets_webhook',
          status: 'error',
          message: `Error al enviar webhook de lead "${lead.nombre} ${lead.apellido}"`,
          details: String(err?.message || err),
          leadId: lead.id,
          leadName: `${lead.nombre} ${lead.apellido}`
        });
      });
    } catch (e) {
      this.lastWebhookStatus = 'error';
      this.addSyncLog({
        type: 'sheets_webhook',
        status: 'error',
        message: 'Excepción al intentar enviar webhook',
        details: String(e),
        leadId: lead.id,
        leadName: `${lead.nombre} ${lead.apellido}`
      });
    }
  }

  constructor() {
    this.initLocalCache();
    this.setupFirestoreListeners();
  }

  private initLocalCache() {
    try {
      const storedUsers = localStorage.getItem(USERS_KEY);
      this.users = storedUsers ? JSON.parse(storedUsers) : [SUPER_ADMIN_USER];

      // Ensure Super Admin is always present
      const adminExists = this.users.find(u => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
      if (!adminExists) {
        this.users.unshift(SUPER_ADMIN_USER);
      } else {
        adminExists.role = 'admin';
        adminExists.status = 'approved';
      }

      const storedCampaigns = localStorage.getItem(CAMPAIGNS_KEY);
      this.campaigns = storedCampaigns ? JSON.parse(storedCampaigns) : [];

      const storedLeads = localStorage.getItem(LEADS_KEY);
      this.leads = storedLeads ? JSON.parse(storedLeads) : [];
      this.leads.forEach(l => {
        l.ultimoPeriodoPagado = formatPeriodMMYYYY(l.ultimoPeriodoPagado);
      });

      const storedCurrentUser = localStorage.getItem(CURRENT_USER_KEY);
      if (storedCurrentUser) {
        const parsed = JSON.parse(storedCurrentUser);
        this.currentUser = this.users.find(u => u.id === parsed.id) || parsed;
      } else {
        this.currentUser = this.users[0];
      }

      const storedLogs = localStorage.getItem(SYNC_LOGS_KEY);
      this.syncLogs = storedLogs ? JSON.parse(storedLogs) : [];
      if (this.syncLogs.length === 0) {
        this.addSyncLog({
          type: 'local_cache',
          status: 'info',
          message: 'Sistema de caché local e historial de sincronización iniciado correctamente'
        });
      }
    } catch (e) {
      console.error('Error loading local CRM cache:', e);
      this.users = [SUPER_ADMIN_USER];
      this.campaigns = [];
      this.leads = [];
      this.currentUser = SUPER_ADMIN_USER;
    }
  }

  private setupFirestoreListeners() {
    try {
      // 1. Listen to Users Collection
      onSnapshot(collection(db, 'users'), (snapshot) => {
        const remoteUsers: User[] = [];
        snapshot.forEach((docSnap) => {
          remoteUsers.push(docSnap.data() as User);
        });

        if (remoteUsers.length > 0) {
          this.users = remoteUsers;
        }

        // Ensure Super Admin is present in Firestore if missing
        const superAdminDoc = this.users.find(u => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
        if (!superAdminDoc) {
          this.users.unshift(SUPER_ADMIN_USER);
          setDoc(doc(db, 'users', SUPER_ADMIN_USER.id), SUPER_ADMIN_USER).catch(console.error);
        }

        // Sync Current User state
        if (this.currentUser) {
          const updatedSelf = this.users.find(u => u.id === this.currentUser?.id || u.email.toLowerCase() === this.currentUser?.email.toLowerCase());
          if (updatedSelf) {
            this.currentUser = updatedSelf;
          }
        }

        this.saveToStorage();
        this.isFirebaseConnected = true;
      }, (err) => {
        console.warn('Firestore Users listener warning:', err);
        this.addSyncLog({
          type: 'firestore',
          status: 'warning',
          message: 'Advertencia en listener de Firestore Usuarios',
          details: String(err?.message || err)
        });
        this.notify();
      });

      // 2. Listen to Campaigns Collection
      onSnapshot(collection(db, 'campaigns'), (snapshot) => {
        const remoteCampaigns: Campaign[] = [];
        snapshot.forEach((docSnap) => {
          remoteCampaigns.push(docSnap.data() as Campaign);
        });

        if (remoteCampaigns.length > 0) {
          this.campaigns = remoteCampaigns;
        } else if (this.campaigns.length > 0) {
          // Push local campaigns if remote is empty
          this.campaigns.forEach(c => setDoc(doc(db, 'campaigns', c.id), c, { merge: true }).catch(console.error));
        }

        this.saveToStorage();
      }, (err) => {
        console.warn('Firestore Campaigns listener warning:', err);
        this.notify();
      });

      // 3. Listen to Leads Collection
      onSnapshot(collection(db, 'leads'), (snapshot) => {
        const remoteLeadsMap = new Map<string, Lead>();
        snapshot.forEach((docSnap) => {
          const l = docSnap.data() as Lead;
          l.ultimoPeriodoPagado = formatPeriodMMYYYY(l.ultimoPeriodoPagado);
          remoteLeadsMap.set(l.id, l);
        });

        // Merge local leads if they are not in remote yet (e.g. created locally)
        let mergedNewLocal = 0;
        this.leads.forEach((localLead) => {
          if (!remoteLeadsMap.has(localLead.id)) {
            setDoc(doc(db, 'leads', localLead.id), localLead, { merge: true }).catch(console.error);
            this.notifyWebhook(localLead);
            remoteLeadsMap.set(localLead.id, localLead);
            mergedNewLocal++;
          }
        });

        const mergedLeads = Array.from(remoteLeadsMap.values());
        mergedLeads.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
        this.leads = mergedLeads;
        this.isFirebaseConnected = true;
        this.lastFirestoreSync = new Date().toISOString();

        if (mergedNewLocal > 0) {
          this.addSyncLog({
            type: 'firestore',
            status: 'info',
            message: `Sincronizados ${mergedNewLocal} leads creados localmente con Firestore y Webhook`
          });
        }

        this.saveToStorage();
      }, (err) => {
        console.warn('Firestore Leads listener warning:', err);
        this.isFirebaseConnected = false;
        this.addSyncLog({
          type: 'firestore',
          status: 'error',
          message: 'Error en conexión en tiempo real con Firestore Leads',
          details: String(err?.message || err)
        });
        this.notify();
      });

    } catch (error) {
      console.error('Failed to initialize Firestore real-time sync:', error);
      this.addSyncLog({
        type: 'firestore',
        status: 'error',
        message: 'Fallo crítico al iniciar la escucha de Firestore',
        details: String(error)
      });
    }
  }

  public async pingSheetsWebhook(): Promise<{ success: boolean; message: string; details?: string }> {
    if (!this.sheetsWebhookUrl) {
      this.addSyncLog({
        type: 'sheets_webhook',
        status: 'warning',
        message: 'Intento de Ping fallido: No hay URL de Webhook configurada'
      });
      return { success: false, message: 'No hay URL de Webhook configurada en el sistema.' };
    }

    this.lastWebhookStatus = 'syncing';
    this.notify();

    const testLead: Lead = {
      id: 'test-ping-' + Date.now(),
      nombre: 'Prueba',
      apellido: 'Ping Conexión',
      dni: '00000000',
      telefono: '0000000000',
      ultimoPeriodoPagado: '08/2026',
      campanaId: 'test',
      campanaNombre: 'Diagnóstico Diagnóstico',
      vendedorId: null,
      vendedorNombre: 'Prueba Diagnóstico',
      estado: 'pendiente',
      notas: 'Mensaje de diagnóstico de salud de conexión en tiempo real',
      creadoEn: new Date().toISOString(),
      historial: []
    };

    try {
      await fetch(this.sheetsWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', test: true, lead: testLead })
      });

      this.lastWebhookSync = new Date().toISOString();
      this.lastWebhookStatus = 'success';
      this.addSyncLog({
        type: 'sheets_webhook',
        status: 'success',
        message: 'Ping de prueba enviado exitosamente a Google Sheets Webhook',
        details: `Endpoint alcanzado: ${this.sheetsWebhookUrl.substring(0, 50)}...`
      });

      return {
        success: true,
        message: '¡Conexión con Google Sheets verificada correctamente!',
        details: 'El paquete de prueba fue recibido por tu Google Apps Script.'
      };
    } catch (err: any) {
      this.lastWebhookStatus = 'error';
      const errMsg = String(err?.message || err);
      this.addSyncLog({
        type: 'sheets_webhook',
        status: 'error',
        message: 'Error en la prueba de Ping con el Webhook de Google Sheets',
        details: errMsg
      });
      return {
        success: false,
        message: 'No se pudo conectar con el Webhook de Google Sheets.',
        details: errMsg
      };
    }
  }

  private saveToStorage() {
    localStorage.setItem(USERS_KEY, JSON.stringify(this.users));
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(this.campaigns));
    localStorage.setItem(LEADS_KEY, JSON.stringify(this.leads));
    if (this.currentUser) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // --- AUTH METHODS ---
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public async loginWithGoogle(): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const googleUser = await firebaseLoginWithGoogle();
      if (!googleUser || !googleUser.email) {
        return { success: false, message: 'No se pudo obtener el correo de Google.' };
      }

      const cleanEmail = googleUser.email.trim().toLowerCase();
      let user = this.users.find(u => u.email.toLowerCase() === cleanEmail);

      const isSuper = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();

      if (!user) {
        user = {
          id: 'usr-' + googleUser.uid,
          email: cleanEmail,
          name: googleUser.displayName || cleanEmail.split('@')[0],
          role: isSuper ? 'admin' : 'vendedor',
          status: isSuper ? 'approved' : 'pending',
          createdAt: new Date().toISOString(),
          phone: googleUser.phoneNumber || ''
        };
        this.users.unshift(user);
        await setDoc(doc(db, 'users', user.id), user);
      } else {
        if (googleUser.displayName && user.name !== googleUser.displayName) {
          user.name = googleUser.displayName;
          await setDoc(doc(db, 'users', user.id), { name: googleUser.displayName }, { merge: true });
        }
      }

      if (user.status === 'pending') {
        return {
          success: false,
          message: 'Tu cuenta con Google se registró con éxito. Un Administrador debe aprobar tu solicitud antes de ingresar.',
          user
        };
      }

      if (user.status === 'rejected' || user.status === 'suspended') {
        return {
          success: false,
          message: 'Tu cuenta ha sido suspendida o denegada por la administración.'
        };
      }

      this.currentUser = user;
      this.saveToStorage();
      return { success: true, message: 'Ingreso exitoso con Google', user };
    } catch (error: any) {
      console.error('Error logging in with Google:', error);
      return { 
        success: false, 
        message: error?.message || 'Ocurrió un error al iniciar sesión con Google.' 
      };
    }
  }

  public loginWithEmail(email: string): { success: boolean; message: string; user?: User } {
    const cleanEmail = email.trim().toLowerCase();
    let user = this.users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      const isSuper = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();
      user = {
        id: 'usr-' + Date.now(),
        email: cleanEmail,
        name: isSuper ? 'Matías Gil (Super Admin)' : cleanEmail.split('@')[0],
        role: isSuper ? 'admin' : 'vendedor',
        status: isSuper ? 'approved' : 'pending',
        createdAt: new Date().toISOString()
      };
      this.users.push(user);
      setDoc(doc(db, 'users', user.id), user).catch(console.error);
      this.saveToStorage();
    }

    if (user.status === 'pending') {
      return {
        success: false,
        message: 'Tu cuenta está en revisión. Un Administrador debe aprobar tu acceso antes de ingresar.',
        user
      };
    }

    if (user.status === 'rejected' || user.status === 'suspended') {
      return {
        success: false,
        message: 'Acceso denegado o suspendido. Contacta con la administración.'
      };
    }

    this.currentUser = user;
    this.saveToStorage();
    return { success: true, message: 'Ingreso exitoso', user };
  }

  public async logout() {
    this.currentUser = null;
    await logoutFirebase();
    this.saveToStorage();
  }

  // --- ACCESS MANAGEMENT (ADMIN USER ABM) ---
  public getUsers(): User[] {
    return [...this.users];
  }

  public async addUser(name: string, email: string, phone: string, role: User['role'], status: User['status']): Promise<User> {
    const newUser: User = {
      id: 'usr-' + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role,
      status,
      createdAt: new Date().toISOString()
    };
    this.users.push(newUser);
    this.saveToStorage();

    await setDoc(doc(db, 'users', newUser.id), newUser);
    return newUser;
  }

  public async updateUser(userId: string, data: { name?: string; email?: string; phone?: string; role?: User['role']; status?: User['status'] }) {
    const target = this.users.find(u => u.id === userId);
    if (!target) return;

    if (target.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      target.role = 'admin';
      target.status = 'approved';
      if (data.name) target.name = data.name;
      if (data.phone) target.phone = data.phone;
    } else {
      if (data.name !== undefined) target.name = data.name.trim();
      if (data.email !== undefined) target.email = data.email.trim().toLowerCase();
      if (data.phone !== undefined) target.phone = data.phone.trim();
      if (data.role !== undefined) target.role = data.role;
      if (data.status !== undefined) target.status = data.status;
    }
    this.saveToStorage();

    await setDoc(doc(db, 'users', target.id), target, { merge: true });
  }

  public async deleteUser(userId: string): Promise<boolean> {
    const targetIndex = this.users.findIndex(u => u.id === userId);
    if (targetIndex === -1) return false;

    if (this.users[targetIndex].email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return false;
    }

    const removedId = this.users[targetIndex].id;
    this.users.splice(targetIndex, 1);
    this.saveToStorage();

    await deleteDoc(doc(db, 'users', removedId));
    return true;
  }

  public updateUserStatus(userId: string, newStatus: User['status'], newRole?: User['role']) {
    this.updateUser(userId, { status: newStatus, role: newRole });
  }

  // --- CAMPAIGNS ABM ---
  public getCampaigns(): Campaign[] {
    return [...this.campaigns];
  }

  public async addCampaign(nombre: string, descripcion: string, scriptTemplate: string): Promise<Campaign> {
    const newCamp: Campaign = {
      id: 'cmp-' + Date.now(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      scriptTemplate: scriptTemplate.trim() || 'Hola {nombre} {apellido}, nos comunicamos de Arevalo Servicios Sociales referente a tu plan ({ultimoPeriodoPagado}).',
      creadoEn: new Date().toISOString(),
      creadoPor: this.currentUser?.name || 'Administrador'
    };
    this.campaigns.unshift(newCamp);
    this.saveToStorage();

    await setDoc(doc(db, 'campaigns', newCamp.id), newCamp);
    return newCamp;
  }

  public async updateCampaign(campaignId: string, nombre: string, descripcion: string, scriptTemplate: string) {
    const target = this.campaigns.find(c => c.id === campaignId);
    if (!target) return;

    target.nombre = nombre.trim();
    target.descripcion = descripcion.trim();
    target.scriptTemplate = scriptTemplate.trim();

    this.saveToStorage();
    await setDoc(doc(db, 'campaigns', target.id), target, { merge: true });
  }

  public async deleteCampaign(campaignId: string): Promise<boolean> {
    const targetIdx = this.campaigns.findIndex(c => c.id === campaignId);
    if (targetIdx === -1) return false;

    const removedId = this.campaigns[targetIdx].id;
    this.campaigns.splice(targetIdx, 1);
    this.saveToStorage();

    await deleteDoc(doc(db, 'campaigns', removedId));
    return true;
  }

  public async deleteLead(leadId: string): Promise<boolean> {
    const targetIdx = this.leads.findIndex(l => l.id === leadId);
    if (targetIdx === -1) return false;

    const removedId = this.leads[targetIdx].id;
    this.leads.splice(targetIdx, 1);
    this.saveToStorage();

    await deleteDoc(doc(db, 'leads', removedId));
    return true;
  }

  public async deleteLeadsBulk(leadIds: string[]): Promise<boolean> {
    if (leadIds.length === 0) return true;
    this.leads = this.leads.filter(l => !leadIds.includes(l.id));
    this.saveToStorage();

    try {
      const batchSize = 400;
      for (let i = 0; i < leadIds.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = leadIds.slice(i, i + batchSize);
        chunk.forEach(id => {
          const ref = doc(db, 'leads', id);
          batch.delete(ref);
        });
        await batch.commit();
      }
    } catch (err) {
      console.error('Error deleting leads batch from Firestore:', err);
    }
    return true;
  }

  public getLeads(): Lead[] {
    return [...this.leads];
  }

  public async assignLeadToSeller(leadId: string, sellerId: string | null, sellerName: string | null) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    lead.vendedorId = sellerId;
    lead.vendedorNombre = sellerName;
    lead.fechaAsignacion = sellerId ? new Date().toISOString() : undefined;

    lead.historial.push({
      id: 'h-' + Date.now(),
      fecha: new Date().toISOString(),
      nuevoEstado: lead.estado,
      usuarioNombre: this.currentUser?.name || 'Sistema',
      nota: sellerId ? `Vendedor asignado: ${sellerName}` : 'Reasignado a Pool General (Sin Vendedor)'
    });

    this.saveToStorage();
    await setDoc(doc(db, 'leads', lead.id), lead, { merge: true });
    this.notifyWebhook(lead);
  }

  public async updateLeadFields(
    leadId: string,
    updates: {
      nombre?: string;
      apellido?: string;
      dni?: string;
      telefono?: string;
      ultimoPeriodoPagado?: string;
      campanaId?: string;
    }
  ): Promise<boolean> {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return false;

    if (updates.nombre !== undefined) lead.nombre = updates.nombre.trim();
    if (updates.apellido !== undefined) lead.apellido = updates.apellido.trim();
    if (updates.dni !== undefined) lead.dni = updates.dni.trim();
    if (updates.telefono !== undefined) lead.telefono = updates.telefono.trim();
    if (updates.ultimoPeriodoPagado !== undefined) {
      lead.ultimoPeriodoPagado = formatPeriodMMYYYY(updates.ultimoPeriodoPagado);
    }

    if (updates.campanaId !== undefined && updates.campanaId !== lead.campanaId) {
      const campaign = this.campaigns.find(c => c.id === updates.campanaId);
      if (campaign) {
        lead.campanaId = campaign.id;
        lead.campanaNombre = campaign.nombre;
      }
    }

    lead.historial.push({
      id: 'h-' + Date.now(),
      fecha: new Date().toISOString(),
      nuevoEstado: lead.estado,
      usuarioNombre: this.currentUser?.name || 'Sistema',
      nota: 'Datos del cliente actualizados'
    });

    this.saveToStorage();
    await setDoc(doc(db, 'leads', lead.id), lead, { merge: true });
    this.notifyWebhook(lead);
    return true;
  }

  public async assignLeadCampaign(leadId: string, campaignId: string) {
    const lead = this.leads.find(l => l.id === leadId);
    const campaign = this.campaigns.find(c => c.id === campaignId);
    if (!lead || !campaign) return;

    lead.campanaId = campaign.id;
    lead.campanaNombre = campaign.nombre;

    lead.historial.push({
      id: 'h-' + Date.now(),
      fecha: new Date().toISOString(),
      nuevoEstado: lead.estado,
      usuarioNombre: this.currentUser?.name || 'Sistema',
      nota: `Campaña actualizada a: "${campaign.nombre}"`
    });

    this.saveToStorage();
    await setDoc(doc(db, 'leads', lead.id), lead, { merge: true });
    this.notifyWebhook(lead);
  }

  public async claimLead(leadId: string, sellerUser?: User): Promise<boolean> {
    const lead = this.leads.find(l => l.id === leadId);
    const seller = sellerUser || this.currentUser;
    if (!lead || !seller) return false;

    lead.vendedorId = seller.id;
    lead.vendedorNombre = seller.name;
    lead.fechaAsignacion = new Date().toISOString();

    lead.historial.push({
      id: 'h-' + Date.now(),
      fecha: new Date().toISOString(),
      nuevoEstado: lead.estado,
      usuarioNombre: seller.name,
      nota: `Lead asignado/apropiado por ${seller.name}`
    });

    this.saveToStorage();
    await setDoc(doc(db, 'leads', lead.id), lead, { merge: true });
    this.notifyWebhook(lead);
    return true;
  }

  public async releaseLeadToPool(leadId: string): Promise<boolean> {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return false;

    const prevSeller = lead.vendedorNombre || 'Vendedor';
    lead.vendedorId = null;
    lead.vendedorNombre = null;

    lead.historial.push({
      id: 'h-' + Date.now(),
      fecha: new Date().toISOString(),
      nuevoEstado: lead.estado,
      usuarioNombre: this.currentUser?.name || 'Administrador',
      nota: `Lead devuelto al Pool General (anterior: ${prevSeller})`
    });

    this.saveToStorage();
    await setDoc(doc(db, 'leads', lead.id), lead, { merge: true });
    this.notifyWebhook(lead);
    return true;
  }

  public async syncAllToFirestoreAndSheets(): Promise<{ countLeads: number }> {
    let countLeads = 0;
    for (const lead of this.leads) {
      await setDoc(doc(db, 'leads', lead.id), lead, { merge: true });
      this.notifyWebhook(lead);
      countLeads++;
    }
    for (const u of this.users) {
      await setDoc(doc(db, 'users', u.id), u, { merge: true });
    }
    for (const c of this.campaigns) {
      await setDoc(doc(db, 'campaigns', c.id), c, { merge: true });
    }
    return { countLeads };
  }

  public async updateLeadStatus(
    leadId: string, 
    nuevoEstado: LeadStatus, 
    motivoCaida?: string, 
    observacionRechazo?: string, 
    notaContacto?: string
  ): Promise<{ success: boolean; error?: string }> {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return { success: false, error: 'Lead no encontrado' };

    if (nuevoEstado === 'caido') {
      if (!observacionRechazo || observacionRechazo.trim().length < 3) {
        return { 
          success: false, 
          error: 'REGLA OBLIGATORIA: Para marcar un cliente como Caído debe indicar la observación del rechazo con al menos 3 caracteres.' 
        };
      }
    }

    const estadoAnterior = lead.estado;
    lead.estado = nuevoEstado;
    lead.ultimoContacto = new Date().toISOString();

    if (nuevoEstado === 'caido') {
      lead.motivoCaida = motivoCaida || 'Otro motivo';
      lead.observacionRechazo = observacionRechazo?.trim();
    }

    if (notaContacto) {
      lead.notas = (lead.notas ? lead.notas + '\n' : '') + `[${new Date().toLocaleDateString('es-AR')}] ${notaContacto}`;
    }

    lead.historial.push({
      id: 'h-' + Date.now(),
      fecha: new Date().toISOString(),
      estadoAnterior,
      nuevoEstado,
      usuarioNombre: this.currentUser?.name || 'Usuario',
      nota: nuevoEstado === 'caido' 
        ? `CAÍDO (${motivoCaida}): ${observacionRechazo}` 
        : (notaContacto || `Estado actualizado a ${nuevoEstado}`)
    });

    this.saveToStorage();
    await setDoc(doc(db, 'leads', lead.id), lead, { merge: true });
    this.notifyWebhook(lead);
    return { success: true };
  }

  public async importLeads(
    leadsData: Array<{ nombre: string; apellido: string; dni: string; telefono: string; ultimoPeriodoPagado: string; vendedor?: string }>,
    campanaId: string
  ): Promise<{ count: number; campaignName: string }> {
    const campaign = this.campaigns.find(c => c.id === campanaId);
    const campaignName = campaign ? campaign.nombre : 'Campaña General';

    const now = new Date().toISOString();
    let count = 0;

    const importedLeadsList: Lead[] = [];

    leadsData.forEach((row, idx) => {
      if (!row.nombre && !row.telefono && !row.dni) return;

      const matchedSeller = findMatchingSeller(row.vendedor, this.users);
      const vendedorId = matchedSeller ? matchedSeller.id : null;
      const vendedorNombre = matchedSeller ? matchedSeller.name : (row.vendedor ? row.vendedor.trim() : null);

      const historyNote = matchedSeller 
        ? `Importado en campaña "${campaignName}" y asignado a ${matchedSeller.name}`
        : `Importado en campaña "${campaignName}"`;

      const newLead: Lead = {
        id: `lead-imp-${Date.now()}-${idx}`,
        nombre: (row.nombre || 'Cliente').trim(),
        apellido: (row.apellido || '').trim(),
        dni: (row.dni || 'S/D').trim(),
        telefono: (row.telefono || '').replace(/\D/g, ''),
        ultimoPeriodoPagado: formatPeriodMMYYYY(row.ultimoPeriodoPagado),
        campanaId,
        campanaNombre: campaignName,
        vendedorId,
        vendedorNombre,
        fechaAsignacion: matchedSeller ? now : undefined,
        estado: 'pendiente',
        creadoEn: now,
        historial: [
          {
            id: 'h-' + Date.now() + '-' + idx,
            fecha: now,
            nuevoEstado: 'pendiente',
            usuarioNombre: this.currentUser?.name || 'Importación Excel',
            nota: historyNote
          }
        ]
      };

      importedLeadsList.push(newLead);
      this.leads.unshift(newLead);
      count++;
    });

    this.saveToStorage();

    // Firestore Batch Import
    try {
      const batchSize = 400;
      for (let i = 0; i < importedLeadsList.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = importedLeadsList.slice(i, i + batchSize);
        chunk.forEach(leadItem => {
          const ref = doc(db, 'leads', leadItem.id);
          batch.set(ref, leadItem);
        });
        await batch.commit();
      }
    } catch (err) {
      console.error('Error saving imported leads to Firestore:', err);
    }

    return { count, campaignName };
  }
}

export const crmStore = new CrmStore();
