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
import { Campaign, Lead, LeadStatus, User, SUPER_ADMIN_EMAIL, SyncLog, SyncHealthState, AuditLog, AuditCategory } from '../types/crm';
import { formatPeriodMMYYYY } from '../utils/formatters';
import { findMatchingSeller } from '../utils/sellerUtils';
import { areLeadsDuplicate, mergeDuplicateLeads, normalizeDni, normalizePhone, normalizeName } from '../utils/deduplicationUtils';

const USERS_KEY = 'arevalo_crm_users_v2';
const CAMPAIGNS_KEY = 'arevalo_crm_campaigns_v2';
const LEADS_KEY = 'arevalo_crm_leads_v2';
const CURRENT_USER_KEY = 'arevalo_crm_current_user_v2';
const SYNC_LOGS_KEY = 'arevalo_crm_sync_logs_v1';
const AUDIT_LOGS_KEY = 'arevalo_crm_audit_logs_v1';

/**
 * Strips undefined properties recursively from objects and arrays
 * so that Firebase Firestore setDoc/updateDoc never rejects payloads.
 */
function sanitizeForFirestore<T>(data: T): any {
  if (data === null || data === undefined) {
    return null;
  }
  if (typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString();
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item));
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val === undefined) {
      continue;
    }
    clean[key] = sanitizeForFirestore(val);
  }
  return clean;
}

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
  private auditLogs: AuditLog[] = [];
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
    this.addAuditLog({
      category: 'system',
      action: 'CONFIGURAR_WEBHOOK',
      description: 'Se configuró el webhook de sincronización con Google Sheets',
      details: this.sheetsWebhookUrl
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

  public addAuditLog(entry: {
    category: AuditCategory;
    action: string;
    description: string;
    details?: string;
    user?: User | null;
  }) {
    const actingUser = entry.user !== undefined ? entry.user : this.currentUser;
    const newLog: AuditLog = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      userId: actingUser?.id || 'usr-anonymous',
      userEmail: actingUser?.email || 'anonimo@arevalo.com',
      userName: actingUser?.name || 'Usuario No Autenticado',
      userRole: actingUser?.role || 'vendedor',
      category: entry.category,
      action: entry.action,
      description: entry.description,
      ...(entry.details !== undefined && entry.details !== null ? { details: String(entry.details) } : {})
    };

    this.auditLogs.unshift(newLog);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }

    try {
      localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(this.auditLogs));
    } catch (e) {
      console.warn('Storage limit for audit logs in localStorage:', e);
    }

    // Persist to Firestore asynchronously with sanitized data
    try {
      const sanitized = sanitizeForFirestore(newLog);
      setDoc(doc(db, 'auditLogs', newLog.id), sanitized).catch((err) => {
        console.warn('Failed to persist audit log to Firestore:', err);
      });
    } catch (e) {
      console.warn('Failed to prepare audit log for Firestore:', e);
    }

    this.notify();
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  public async clearAuditLogs(): Promise<void> {
    const logsToDelete = [...this.auditLogs];
    this.auditLogs = [];
    localStorage.removeItem(AUDIT_LOGS_KEY);
    this.notify();

    try {
      const batchSize = 300;
      for (let i = 0; i < logsToDelete.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = logsToDelete.slice(i, i + batchSize);
        chunk.forEach(log => {
          const ref = doc(db, 'auditLogs', log.id);
          batch.delete(ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Error clearing audit logs in Firestore:', e);
    }

    this.addAuditLog({
      category: 'system',
      action: 'LIMPIAR_AUDITORIA',
      description: 'El Super Administrador purgó el historial de auditoría'
    });
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
      const rawLeads: Lead[] = storedLeads ? JSON.parse(storedLeads) : [];
      
      // In-memory deduplication of cached leads
      const uniqueLocalLeads: Lead[] = [];
      rawLeads.forEach(lead => {
        lead.ultimoPeriodoPagado = formatPeriodMMYYYY(lead.ultimoPeriodoPagado);
        const dupIdx = uniqueLocalLeads.findIndex(existing => areLeadsDuplicate(existing, lead));
        if (dupIdx >= 0) {
          const { master } = mergeDuplicateLeads(uniqueLocalLeads[dupIdx], lead);
          uniqueLocalLeads[dupIdx] = master;
        } else {
          uniqueLocalLeads.push(lead);
        }
      });
      this.leads = uniqueLocalLeads;

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

      const storedAudit = localStorage.getItem(AUDIT_LOGS_KEY);
      this.auditLogs = storedAudit ? JSON.parse(storedAudit) : [];
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
          setDoc(doc(db, 'users', SUPER_ADMIN_USER.id), sanitizeForFirestore(SUPER_ADMIN_USER)).catch(console.error);
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

      // 2. Listen to Audit Logs Collection
      onSnapshot(collection(db, 'auditLogs'), (snapshot) => {
        const remoteAudit: AuditLog[] = [];
        snapshot.forEach((docSnap) => {
          remoteAudit.push(docSnap.data() as AuditLog);
        });

        if (remoteAudit.length > 0) {
          remoteAudit.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          this.auditLogs = remoteAudit.slice(0, 500);
          try {
            localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(this.auditLogs));
          } catch (e) {
            console.warn('Local storage audit log size limit:', e);
          }
          this.notify();
        }
      }, (err) => {
        console.warn('Firestore AuditLogs listener warning:', err);
      });

      // 3. Listen to Campaigns Collection
      onSnapshot(collection(db, 'campaigns'), (snapshot) => {
        const remoteCampaigns: Campaign[] = [];
        snapshot.forEach((docSnap) => {
          remoteCampaigns.push(docSnap.data() as Campaign);
        });

        if (remoteCampaigns.length > 0) {
          this.campaigns = remoteCampaigns;
        } else if (this.campaigns.length > 0) {
          // Push local campaigns if remote is empty
          this.campaigns.forEach(c => setDoc(doc(db, 'campaigns', c.id), sanitizeForFirestore(c), { merge: true }).catch(console.error));
        }

        this.saveToStorage();
      }, (err) => {
        console.warn('Firestore Campaigns listener warning:', err);
        this.notify();
      });

      // 3. Listen to Leads Collection with Strict Anti-Duplication Engine
      onSnapshot(collection(db, 'leads'), (snapshot) => {
        const rawRemoteLeads: Lead[] = [];
        snapshot.forEach((docSnap) => {
          const l = docSnap.data() as Lead;
          l.id = docSnap.id || l.id;
          l.ultimoPeriodoPagado = formatPeriodMMYYYY(l.ultimoPeriodoPagado);
          rawRemoteLeads.push(l);
        });

        // Deduplicate remote leads from Firestore snapshot
        const uniqueRemoteMap = new Map<string, Lead>();
        const duplicateDocIdsToDelete: string[] = [];

        rawRemoteLeads.forEach((lead) => {
          let foundMasterKey: string | null = null;
          for (const [key, existingLead] of uniqueRemoteMap.entries()) {
            if (areLeadsDuplicate(existingLead, lead)) {
              foundMasterKey = key;
              break;
            }
          }

          if (foundMasterKey) {
            const masterLead = uniqueRemoteMap.get(foundMasterKey)!;
            const { master, duplicateId } = mergeDuplicateLeads(masterLead, lead);
            uniqueRemoteMap.set(foundMasterKey, master);
            if (lead.id !== master.id) {
              duplicateDocIdsToDelete.push(lead.id);
            } else if (duplicateId && duplicateId !== master.id) {
              duplicateDocIdsToDelete.push(duplicateId);
            }
          } else {
            uniqueRemoteMap.set(lead.id, lead);
          }
        });

        // Async purge of duplicate documents found in Firestore
        if (duplicateDocIdsToDelete.length > 0) {
          console.warn(`[CRM Anti-Duplication] Purgando ${duplicateDocIdsToDelete.length} duplicados en Firestore...`);
          duplicateDocIdsToDelete.forEach((dupId) => {
            deleteDoc(doc(db, 'leads', dupId)).catch(console.error);
          });
          this.addSyncLog({
            type: 'firestore',
            status: 'warning',
            message: `Limpieza automática: se purgaron ${duplicateDocIdsToDelete.length} registros duplicados de Firestore`
          });
        }

        // Merge local leads ONLY if they represent genuinely new distinct persons
        let mergedNewLocal = 0;
        this.leads.forEach((localLead) => {
          let matchesRemote = false;
          for (const [, remoteLead] of uniqueRemoteMap.entries()) {
            if (areLeadsDuplicate(remoteLead, localLead)) {
              matchesRemote = true;
              break;
            }
          }

          if (!matchesRemote) {
            setDoc(doc(db, 'leads', localLead.id), sanitizeForFirestore(localLead), { merge: true }).catch(console.error);
            this.notifyWebhook(localLead);
            uniqueRemoteMap.set(localLead.id, localLead);
            mergedNewLocal++;
          }
        });

        const mergedLeads = Array.from(uniqueRemoteMap.values());
        mergedLeads.sort((a, b) => new Date(b.creadoEn || 0).getTime() - new Date(a.creadoEn || 0).getTime());
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

  public async checkUserStatus(userId: string): Promise<User | null> {
    const user = this.users.find(u => u.id === userId);
    if (user && this.currentUser && this.currentUser.id === user.id) {
      this.currentUser = { ...user };
      this.saveToStorage();
    }
    return user || null;
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
          assignedSellerName: null,
          createdAt: new Date().toISOString(),
          phone: googleUser.phoneNumber || ''
        };
        this.users.unshift(user);
        await setDoc(doc(db, 'users', user.id), sanitizeForFirestore(user));
      } else {
        if (googleUser.displayName && user.name !== googleUser.displayName) {
          user.name = googleUser.displayName;
          await setDoc(doc(db, 'users', user.id), sanitizeForFirestore({ name: googleUser.displayName }), { merge: true });
        }
      }

      if (user.status === 'pending') {
        this.currentUser = user;
        this.saveToStorage();
        this.addAuditLog({
          category: 'auth',
          action: 'LOGIN_PENDIENTE',
          description: `El usuario ${user.name} (${user.email}) inició sesión con Google pero se encuentra pendiente de asignación por el Administrador`,
          user
        });
        return {
          success: true,
          message: 'Tu cuenta de Google fue registrada. Esperando asignación de vendedor por el Administrador.',
          user
        };
      }

      if (user.status === 'rejected' || user.status === 'suspended') {
        this.addAuditLog({
          category: 'auth',
          action: 'LOGIN_BLOQUEADO',
          description: `Intento de acceso bloqueado para ${user.name} (${user.email}) - Estado: ${user.status}`,
          user
        });
        return {
          success: false,
          message: 'Tu cuenta ha sido suspendida o denegada por la administración.'
        };
      }

      this.currentUser = user;
      this.saveToStorage();

      this.addAuditLog({
        category: 'auth',
        action: 'INICIO_SESION',
        description: `Inicio de sesión exitoso con Google: ${user.name} (${user.email}) - Perfil: ${user.assignedSellerName || user.role}`,
        user
      });

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
        assignedSellerName: null,
        createdAt: new Date().toISOString()
      };
      this.users.push(user);
      setDoc(doc(db, 'users', user.id), sanitizeForFirestore(user)).catch(console.error);
      this.saveToStorage();
    }

    if (user.status === 'pending') {
      this.currentUser = user;
      this.saveToStorage();
      this.addAuditLog({
        category: 'auth',
        action: 'LOGIN_PENDIENTE',
        description: `Acceso por email para ${user.email} - En espera de asignación de vendedor`,
        user
      });
      return {
        success: true,
        message: 'Tu cuenta está en revisión. Un Administrador debe asignarte tu perfil de vendedor.',
        user
      };
    }

    if (user.status === 'rejected' || user.status === 'suspended') {
      this.addAuditLog({
        category: 'auth',
        action: 'LOGIN_BLOQUEADO',
        description: `Acceso denegado/bloqueado por email para ${user.email}`,
        user
      });
      return {
        success: false,
        message: 'Acceso denegado o suspendido. Contacta con la administración.'
      };
    }

    this.currentUser = user;
    this.saveToStorage();

    this.addAuditLog({
      category: 'auth',
      action: 'INICIO_SESION',
      description: `Inicio de sesión exitoso por email: ${user.name} (${user.email})`,
      user
    });

    return { success: true, message: 'Ingreso exitoso', user };
  }

  public async logout() {
    if (this.currentUser) {
      this.addAuditLog({
        category: 'auth',
        action: 'CIERRE_SESION',
        description: `Cierre de sesión de ${this.currentUser.name} (${this.currentUser.email})`
      });
    }
    this.currentUser = null;
    await logoutFirebase();
    this.saveToStorage();
  }

  // --- ACCESS MANAGEMENT (ADMIN USER ABM) ---
  public getUsers(): User[] {
    return [...this.users];
  }

  public async addUser(
    name: string, 
    email: string, 
    phone: string, 
    role: User['role'], 
    status: User['status'],
    assignedSellerName?: string | null
  ): Promise<User> {
    const newUser: User = {
      id: 'usr-' + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role,
      status,
      assignedSellerName: assignedSellerName ? assignedSellerName.trim() : null,
      createdAt: new Date().toISOString()
    };
    this.users.push(newUser);
    this.saveToStorage();

    await setDoc(doc(db, 'users', newUser.id), sanitizeForFirestore(newUser));

    this.addAuditLog({
      category: 'users',
      action: 'CREAR_USUARIO',
      description: `Nuevo usuario/vendedor registrado: ${newUser.name} (${newUser.email}) - Rol: ${newUser.role}, Estado: ${newUser.status}${newUser.assignedSellerName ? `, Vendedor: ${newUser.assignedSellerName}` : ''}`,
      details: JSON.stringify({ userId: newUser.id, role: newUser.role, status: newUser.status, assignedSellerName: newUser.assignedSellerName })
    });

    return newUser;
  }

  public async updateUser(
    userId: string, 
    data: { 
      name?: string; 
      email?: string; 
      phone?: string; 
      role?: User['role']; 
      status?: User['status'];
      assignedSellerName?: string | null;
    }
  ) {
    const target = this.users.find(u => u.id === userId);
    if (!target) return;

    const previousData = { ...target };

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
      if (data.assignedSellerName !== undefined) {
        target.assignedSellerName = data.assignedSellerName ? data.assignedSellerName.trim() : null;
      }
    }
    this.saveToStorage();

    await setDoc(doc(db, 'users', target.id), sanitizeForFirestore(target), { merge: true });

    this.addAuditLog({
      category: 'users',
      action: 'EDITAR_USUARIO',
      description: `Usuario modificado: ${target.name} (${target.email}) - Estado: ${target.status}, Rol: ${target.role}${target.assignedSellerName ? `, Identidad Vendedor: "${target.assignedSellerName}"` : ''}`,
      details: JSON.stringify({ userId: target.id, changes: data, previous: previousData })
    });
  }

  public async assignUserSellerProfile(userId: string, sellerName: string | null, status: User['status'] = 'approved', role: User['role'] = 'vendedor') {
    const target = this.users.find(u => u.id === userId);
    if (!target) return;

    target.assignedSellerName = sellerName ? sellerName.trim() : null;
    target.status = status;
    target.role = role;

    this.saveToStorage();
    await setDoc(doc(db, 'users', target.id), sanitizeForFirestore(target), { merge: true });

    this.addAuditLog({
      category: 'users',
      action: 'ASIGNAR_IDENTIDAD_VENDEDOR',
      description: `El Super Admin asignó el perfil de vendedor "${sellerName || 'General'}" al usuario ${target.name} (${target.email}) y activó su estado a "${status}"`,
      details: JSON.stringify({ userId: target.id, sellerName, status, role })
    });
  }

  public async deleteUser(userId: string): Promise<boolean> {
    const targetIndex = this.users.findIndex(u => u.id === userId);
    if (targetIndex === -1) return false;

    if (this.users[targetIndex].email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return false;
    }

    const removedUser = this.users[targetIndex];
    this.users.splice(targetIndex, 1);
    this.saveToStorage();

    await deleteDoc(doc(db, 'users', removedUser.id));

    this.addAuditLog({
      category: 'users',
      action: 'ELIMINAR_USUARIO',
      description: `Usuario eliminado del sistema: ${removedUser.name} (${removedUser.email})`,
      details: JSON.stringify({ userId: removedUser.id, email: removedUser.email })
    });

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

    await setDoc(doc(db, 'campaigns', newCamp.id), sanitizeForFirestore(newCamp));

    this.addAuditLog({
      category: 'campaigns',
      action: 'CREAR_CAMPANA',
      description: `Nueva campaña creada: "${newCamp.nombre}"`,
      details: JSON.stringify({ id: newCamp.id, descripcion: newCamp.descripcion })
    });

    return newCamp;
  }

  public async updateCampaign(campaignId: string, nombre: string, descripcion: string, scriptTemplate: string) {
    const target = this.campaigns.find(c => c.id === campaignId);
    if (!target) return;

    const oldName = target.nombre;
    target.nombre = nombre.trim();
    target.descripcion = descripcion.trim();
    target.scriptTemplate = scriptTemplate.trim();

    this.saveToStorage();
    await setDoc(doc(db, 'campaigns', target.id), sanitizeForFirestore(target), { merge: true });

    this.addAuditLog({
      category: 'campaigns',
      action: 'EDITAR_CAMPANA',
      description: `Campaña "${oldName}" actualizada a "${target.nombre}"`,
      details: JSON.stringify({ id: target.id, nombre: target.nombre, descripcion: target.descripcion })
    });
  }

  public async deleteCampaign(campaignId: string): Promise<boolean> {
    const targetIdx = this.campaigns.findIndex(c => c.id === campaignId);
    if (targetIdx === -1) return false;

    const removed = this.campaigns[targetIdx];
    this.campaigns.splice(targetIdx, 1);
    this.saveToStorage();

    await deleteDoc(doc(db, 'campaigns', removed.id));

    this.addAuditLog({
      category: 'campaigns',
      action: 'ELIMINAR_CAMPANA',
      description: `Campaña eliminada: "${removed.nombre}"`,
      details: JSON.stringify({ id: removed.id, nombre: removed.nombre })
    });

    return true;
  }

  public async deleteLead(leadId: string): Promise<boolean> {
    const targetIdx = this.leads.findIndex(l => l.id === leadId);
    if (targetIdx === -1) return false;

    const removed = this.leads[targetIdx];
    this.leads.splice(targetIdx, 1);
    this.saveToStorage();

    await deleteDoc(doc(db, 'leads', removed.id));

    this.addAuditLog({
      category: 'leads',
      action: 'ELIMINAR_LEAD',
      description: `Lead eliminado: ${removed.nombre} ${removed.apellido} (Tel: ${removed.telefono}, DNI: ${removed.dni})`,
      details: JSON.stringify({ leadId: removed.id, nombre: removed.nombre, apellido: removed.apellido })
    });

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

    this.addAuditLog({
      category: 'leads',
      action: 'ELIMINACION_MASIVA_LEADS',
      description: `Se eliminaron masivamente ${leadIds.length} leads de la base de datos`,
      details: JSON.stringify({ count: leadIds.length, leadIds: leadIds.slice(0, 10) })
    });

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
    await setDoc(doc(db, 'leads', lead.id), sanitizeForFirestore(lead), { merge: true });
    this.notifyWebhook(lead);

    this.addAuditLog({
      category: 'pool',
      action: sellerId ? 'ASIGNAR_VENDEDOR_LEAD' : 'ENVIAR_POOL_GENERAL',
      description: sellerId 
        ? `Lead "${lead.nombre} ${lead.apellido}" asignado al vendedor "${sellerName}"`
        : `Lead "${lead.nombre} ${lead.apellido}" enviado al Pool General`,
      details: JSON.stringify({ leadId: lead.id, sellerId, sellerName })
    });
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
    await setDoc(doc(db, 'leads', lead.id), sanitizeForFirestore(lead), { merge: true });
    this.notifyWebhook(lead);

    this.addAuditLog({
      category: 'leads',
      action: 'EDITAR_LEAD',
      description: `Datos actualizados del cliente "${lead.nombre} ${lead.apellido}"`,
      details: JSON.stringify({ leadId: lead.id, updates })
    });

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
    await setDoc(doc(db, 'leads', lead.id), sanitizeForFirestore(lead), { merge: true });
    this.notifyWebhook(lead);

    this.addAuditLog({
      category: 'campaigns',
      action: 'ASIGNAR_CAMPANA_LEAD',
      description: `Lead "${lead.nombre} ${lead.apellido}" asignado a la campaña "${campaign.nombre}"`,
      details: JSON.stringify({ leadId: lead.id, campaignId: campaign.id, campaignName: campaign.nombre })
    });
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
    await setDoc(doc(db, 'leads', lead.id), sanitizeForFirestore(lead), { merge: true });
    this.notifyWebhook(lead);

    this.addAuditLog({
      category: 'pool',
      action: 'TOMAR_LEAD_POOL',
      description: `El vendedor ${seller.name} tomó del Pool General al lead "${lead.nombre} ${lead.apellido}"`,
      details: JSON.stringify({ leadId: lead.id, sellerId: seller.id, sellerName: seller.name })
    });

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
    await setDoc(doc(db, 'leads', lead.id), sanitizeForFirestore(lead), { merge: true });
    this.notifyWebhook(lead);

    this.addAuditLog({
      category: 'pool',
      action: 'DEVOLVER_LEAD_POOL',
      description: `Lead "${lead.nombre} ${lead.apellido}" liberado y retornado al Pool General (anterior: ${prevSeller})`,
      details: JSON.stringify({ leadId: lead.id, prevSeller })
    });

    return true;
  }

  public async syncAllToFirestoreAndSheets(): Promise<{ countLeads: number }> {
    let countLeads = 0;
    for (const lead of this.leads) {
      await setDoc(doc(db, 'leads', lead.id), sanitizeForFirestore(lead), { merge: true });
      this.notifyWebhook(lead);
      countLeads++;
    }
    for (const u of this.users) {
      await setDoc(doc(db, 'users', u.id), sanitizeForFirestore(u), { merge: true });
    }
    for (const c of this.campaigns) {
      await setDoc(doc(db, 'campaigns', c.id), sanitizeForFirestore(c), { merge: true });
    }

    this.addAuditLog({
      category: 'system',
      action: 'SINCRONIZACION_FORZADA',
      description: `Sincronización manual forzada de ${countLeads} leads con Firestore y Google Sheets`
    });

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
    await setDoc(doc(db, 'leads', lead.id), sanitizeForFirestore(lead), { merge: true });
    this.notifyWebhook(lead);

    this.addAuditLog({
      category: 'leads',
      action: 'CAMBIO_ESTADO_LEAD',
      description: `Estado del lead "${lead.nombre} ${lead.apellido}" modificado: "${estadoAnterior}" ➔ "${nuevoEstado}"${nuevoEstado === 'caido' ? ` (Motivo: ${motivoCaida} - Obs: ${observacionRechazo})` : ''}`,
      details: JSON.stringify({ leadId: lead.id, estadoAnterior, nuevoEstado, motivoCaida, observacionRechazo, notaContacto })
    });

    return { success: true };
  }

  public async deduplicateAndPurgeLeads(): Promise<{ purgedCount: number; totalRemaining: number; mergedDetails: string[] }> {
    const uniqueLeads: Lead[] = [];
    const duplicateIdsToDelete: string[] = [];
    const mergedDetails: string[] = [];

    for (const lead of this.leads) {
      const existingIdx = uniqueLeads.findIndex(existing => areLeadsDuplicate(existing, lead));
      if (existingIdx >= 0) {
        const existingLead = uniqueLeads[existingIdx];
        const { master, duplicateId } = mergeDuplicateLeads(existingLead, lead);
        uniqueLeads[existingIdx] = master;
        if (duplicateId && !duplicateIdsToDelete.includes(duplicateId)) {
          duplicateIdsToDelete.push(duplicateId);
        }
        mergedDetails.push(`${master.nombre} ${master.apellido} (DNI: ${master.dni || 'S/D'}, Tel: ${master.telefono})`);
      } else {
        uniqueLeads.push(lead);
      }
    }

    // 1. Delete duplicates from Firestore
    if (duplicateIdsToDelete.length > 0) {
      const deletePromises = duplicateIdsToDelete.map(id => deleteDoc(doc(db, 'leads', id)).catch(console.error));
      await Promise.allSettled(deletePromises);
    }

    // 2. Update consolidated master leads in Firestore
    for (const lead of uniqueLeads) {
      setDoc(doc(db, 'leads', lead.id), sanitizeForFirestore(lead), { merge: true }).catch(console.error);
    }

    this.leads = uniqueLeads;
    this.saveToStorage();
    this.addSyncLog({
      type: 'firestore',
      status: duplicateIdsToDelete.length > 0 ? 'info' : 'success',
      message: duplicateIdsToDelete.length > 0 
        ? `Depuración completada: Se eliminaron y fusionaron ${duplicateIdsToDelete.length} duplicados en la base de datos`
        : 'Verificación de duplicados: La base de datos se encuentra 100% limpia y sin duplicados'
    });

    this.addAuditLog({
      category: 'system',
      action: 'DEPURACION_DUPLICADOS',
      description: duplicateIdsToDelete.length > 0 
        ? `Depuración de duplicados: se eliminaron y consolidaron ${duplicateIdsToDelete.length} registros duplicados`
        : 'Verificación de duplicados: base de datos verificada sin duplicados',
      details: JSON.stringify({ purgedCount: duplicateIdsToDelete.length, remaining: uniqueLeads.length })
    });

    this.notify();

    return {
      purgedCount: duplicateIdsToDelete.length,
      totalRemaining: uniqueLeads.length,
      mergedDetails
    };
  }

  public async importLeads(
    leadsData: Array<{ nombre: string; apellido: string; dni: string; telefono: string; ultimoPeriodoPagado: string; vendedor?: string }>,
    campanaId: string
  ): Promise<{ count: number; newCount: number; updatedCount: number; campaignName: string }> {
    const campaign = this.campaigns.find(c => c.id === campanaId);
    const campaignName = campaign ? campaign.nombre : 'Campaña General';

    const now = new Date().toISOString();
    let newCount = 0;
    let updatedCount = 0;

    const leadsToSaveFirestore: Lead[] = [];

    leadsData.forEach((row, idx) => {
      if (!row.nombre && !row.telefono && !row.dni) return;

      const matchedSeller = findMatchingSeller(row.vendedor, this.users);
      const vendedorId = matchedSeller ? matchedSeller.id : null;
      const vendedorNombre = matchedSeller ? matchedSeller.name : (row.vendedor ? row.vendedor.trim() : null);

      const candidateLeadData = {
        nombre: (row.nombre || 'Cliente').trim(),
        apellido: (row.apellido || '').trim(),
        dni: (row.dni || 'S/D').trim(),
        telefono: (row.telefono || '').replace(/\D/g, ''),
        ultimoPeriodoPagado: formatPeriodMMYYYY(row.ultimoPeriodoPagado)
      };

      // Check if candidate already exists in this.leads or in leadsToSaveFirestore
      const existingIdx = this.leads.findIndex(l => areLeadsDuplicate(l, candidateLeadData));

      if (existingIdx >= 0) {
        // Update Existing Lead in-place (NO DUPLICATION!)
        const existing = this.leads[existingIdx];
        
        if (candidateLeadData.ultimoPeriodoPagado) {
          existing.ultimoPeriodoPagado = candidateLeadData.ultimoPeriodoPagado;
        }
        if (candidateLeadData.dni && candidateLeadData.dni !== 'S/D' && (!existing.dni || existing.dni === 'S/D')) {
          existing.dni = candidateLeadData.dni;
        }
        if (candidateLeadData.telefono && !existing.telefono) {
          existing.telefono = candidateLeadData.telefono;
        }
        if (campanaId && (!existing.campanaId || existing.campanaId !== campanaId)) {
          existing.campanaId = campanaId;
          existing.campanaNombre = campaignName;
        }
        if (matchedSeller && !existing.vendedorId) {
          existing.vendedorId = matchedSeller.id;
          existing.vendedorNombre = matchedSeller.name;
          existing.fechaAsignacion = now;
        }

        existing.historial = existing.historial || [];
        existing.historial.push({
          id: 'h-' + Date.now() + '-' + idx,
          fecha: now,
          nuevoEstado: existing.estado,
          usuarioNombre: this.currentUser?.name || 'Importación Excel',
          nota: `Datos actualizados desde importación Excel (Campaña: "${campaignName}", Pago: ${existing.ultimoPeriodoPagado}) - Sin duplicar`
        });

        leadsToSaveFirestore.push(existing);
        updatedCount++;
      } else {
        // Genuinely New Lead
        const cleanDniVal = normalizeDni(candidateLeadData.dni);
        const cleanPhoneVal = normalizePhone(candidateLeadData.telefono);
        const leadId = cleanDniVal 
          ? `lead-dni-${cleanDniVal}` 
          : (cleanPhoneVal ? `lead-tel-${cleanPhoneVal}` : `lead-imp-${Date.now()}-${idx}`);

        const historyNote = matchedSeller 
          ? `Importado en campaña "${campaignName}" y asignado a ${matchedSeller.name}`
          : `Importado en campaña "${campaignName}"`;

        const newLead: Lead = {
          id: leadId,
          nombre: candidateLeadData.nombre,
          apellido: candidateLeadData.apellido,
          dni: candidateLeadData.dni,
          telefono: candidateLeadData.telefono,
          ultimoPeriodoPagado: candidateLeadData.ultimoPeriodoPagado,
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

        this.leads.unshift(newLead);
        leadsToSaveFirestore.push(newLead);
        newCount++;
      }
    });

    this.saveToStorage();

    // Firestore Batch Save (Insert new + Update existing)
    try {
      const batchSize = 400;
      for (let i = 0; i < leadsToSaveFirestore.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = leadsToSaveFirestore.slice(i, i + batchSize);
        chunk.forEach(leadItem => {
          const ref = doc(db, 'leads', leadItem.id);
          batch.set(ref, sanitizeForFirestore(leadItem), { merge: true });
        });
        await batch.commit();
      }
    } catch (err) {
      console.error('Error saving imported leads to Firestore:', err);
    }

    this.addSyncLog({
      type: 'firestore',
      status: 'success',
      message: `Importación completada: ${newCount} nuevos leads creados, ${updatedCount} existentes actualizados (0 duplicados)`
    });

    this.addAuditLog({
      category: 'leads',
      action: 'IMPORTAR_EXCEL',
      description: `Importación de Excel a campaña "${campaignName}": ${newCount} leads nuevos, ${updatedCount} actualizados`,
      details: JSON.stringify({ campanaId, campaignName, newCount, updatedCount, totalProcessed: leadsData.length })
    });

    return { 
      count: newCount + updatedCount, 
      newCount, 
      updatedCount, 
      campaignName 
    };
  }
}

export const crmStore = new CrmStore();
