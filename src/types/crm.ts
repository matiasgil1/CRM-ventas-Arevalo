/**
 * Types & Data Schemas for Arevalo Servicios Sociales CRM
 */

export type UserRole = 'admin' | 'vendedor';
export type UserStatus = 'approved' | 'pending' | 'rejected' | 'suspended';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  phone?: string;
  assignedSellerName?: string | null; // The seller entity/profile name designated by the Admin (e.g. "Juan Carlos Arévalo")
}

export type AuditCategory = 
  | 'auth' 
  | 'leads' 
  | 'pool' 
  | 'campaigns' 
  | 'users' 
  | 'export' 
  | 'system';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  category: AuditCategory;
  action: string;
  description: string;
  details?: string;
}

export type LeadStatus = 
  | 'pendiente' 
  | 'contactado' 
  | 'sin_respuesta' 
  | 'gestion_ventas' 
  | 'cerrado' 
  | 'caido';

export interface LeadHistoryItem {
  id: string;
  fecha: string;
  estadoAnterior?: LeadStatus;
  nuevoEstado: LeadStatus;
  usuarioNombre: string;
  nota?: string;
}

export interface Lead {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  ultimoPeriodoPagado: string;
  campanaId: string;
  campanaNombre: string;
  vendedorId: string | null; // null = Pool General (Sin Asignar)
  vendedorNombre: string | null;
  estado: LeadStatus;
  
  // Extra fields from imports
  direccion?: string;
  fechaInicio?: string;
  estadoDeuda?: string;
  cobrador?: string;
  sucursal?: string;
  
  observacionRechazo?: string; // Obligatorio si estado === 'caido'
  motivoCaida?: string; // Categoría de caída
  notas?: string;
  fechaAsignacion?: string;
  ultimoContacto?: string;
  creadoEn: string;
  historial: LeadHistoryItem[];
}

export interface Campaign {
  id: string;
  nombre: string;
  descripcion: string;
  scriptTemplate: string;
  creadoEn: string;
  creadoPor: string;
}

export interface ImportLeadRaw {
  nombre?: string;
  apellido?: string;
  dni?: string;
  telefono?: string;
  ultimoPeriodoPagado?: string;
  [key: string]: any;
}

export const SUPER_ADMIN_EMAIL = 'matiasgil20142015@gmail.com';

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; badgeBg: string; text: string; iconName: string }> = {
  pendiente: {
    label: 'Pendiente',
    color: '#64748B',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    text: 'text-slate-700',
    iconName: 'Clock'
  },
  contactado: {
    label: 'Contactado',
    color: '#06B6D4',
    badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    text: 'text-cyan-700',
    iconName: 'MessageCircle'
  },
  sin_respuesta: {
    label: 'Sin Respuesta',
    color: '#F59E0B',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    text: 'text-amber-700',
    iconName: 'PhoneOff'
  },
  gestion_ventas: {
    label: 'Gestión de Ventas',
    color: '#3B82F6',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    text: 'text-blue-700',
    iconName: 'TrendingUp'
  },
  cerrado: {
    label: 'Cerrado / Venta',
    color: '#10B981',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    text: 'text-emerald-700',
    iconName: 'CheckCircle2'
  },
  caido: {
    label: 'Caído',
    color: '#EF4444',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
    text: 'text-rose-700',
    iconName: 'XCircle'
  }
};

export const MOTIVOS_CAIDA_PRESET = [
  'Precio / Cuota elevada',
  'Ya cuenta con otro servicio social / Sepelio',
  'No interesado actualmente',
  'Socio o titular fallecido',
  'Fuera de zona de cobertura',
  'Descontento con atención previa',
  'Teléfono equivocado / Inexistente',
  'Otro motivo'
];

export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'sheets_webhook' | 'firestore' | 'local_cache' | 'manual_sync';
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  leadId?: string;
  leadName?: string;
}

export interface SyncHealthState {
  isFirestoreConnected: boolean;
  lastFirestoreSync: string | null;
  webhookConfigured: boolean;
  webhookUrl: string;
  lastWebhookSync: string | null;
  lastWebhookStatus: 'success' | 'error' | 'idle' | 'syncing';
  totalLeadsInLocal: number;
  totalLeadsInRemote: number;
  pendingSyncCount: number;
  recentLogs: SyncLog[];
}

