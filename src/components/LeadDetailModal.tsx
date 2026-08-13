import React, { useState, useEffect } from 'react';
import { Lead, LeadStatus, Campaign, LEAD_STATUS_CONFIG, User, SUPER_ADMIN_EMAIL } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { formatPeriodMMYYYY, formatMessageTemplate } from '../utils/formatters';
import { CustomSelect } from './CustomSelect';
import confetti from 'canvas-confetti';
import { 
  X, MessageCircle, Phone, FileText, Clock, UserCheck, 
  Send, History, ChevronRight, AlertCircle, Edit3, Save, Share2,
  ShieldCheck, ArrowUpDown, ArrowRight, User as UserIcon, Search
} from 'lucide-react';

interface LeadDetailModalProps {
  lead: Lead | null;
  currentUser: User;
  campaigns: Campaign[];
  onClose: () => void;
  onRequestRejection: (lead: Lead) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  currentUser,
  campaigns,
  onClose,
  onRequestRejection
}) => {
  const [customMsg, setCustomMsg] = useState('');
  const [newNote, setNewNote] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Super Admin check
  const isSuperAdmin = currentUser?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  // Audit search & sort state for Super Admin panel
  const [auditSearch, setAuditSearch] = useState('');
  const [auditSortNewest, setAuditSortNewest] = useState(true);

  // Edit Lead Info state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editApellido, setEditApellido] = useState('');
  const [editDni, setEditDni] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editPeriodo, setEditPeriodo] = useState('');
  const [editCampanaId, setEditCampanaId] = useState('');
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Find lead's campaign script
  const campaign = campaigns.find(c => c.id === lead?.campanaId);
  const defaultScript = campaign?.scriptTemplate || 
    'Hola {nombre} {apellido}, te contactamos de Arevalo Servicios Sociales referente a tu plan ({ultimoPeriodoPagado}). ¡Queremos brindarte la mejor atención!';

  useEffect(() => {
    if (lead) {
      const formattedScript = formatMessageTemplate(defaultScript, lead);
      setCustomMsg(formattedScript);
      setNewNote('');
      setStatusNote('');

      // Init edit fields
      setEditNombre(lead.nombre);
      setEditApellido(lead.apellido);
      setEditDni(lead.dni);
      setEditTelefono(lead.telefono);
      setEditPeriodo(formatPeriodMMYYYY(lead.ultimoPeriodoPagado));
      setEditCampanaId(lead.campanaId);
      setIsEditingInfo(false);
    }
  }, [lead, defaultScript]);

  if (!lead) return null;

  const handleSaveLeadInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !editNombre.trim()) return;
    setIsSavingInfo(true);
    try {
      await crmStore.updateLeadFields(lead.id, {
        nombre: editNombre,
        apellido: editApellido,
        dni: editDni,
        telefono: editTelefono,
        ultimoPeriodoPagado: editPeriodo,
        campanaId: editCampanaId
      });
      setIsEditingInfo(false);
      setSaveSuccessMsg('¡Datos del cliente actualizados en Firestore!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } finally {
      setIsSavingInfo(false);
    }
  };

  // Format telephone number for wa.me link (add Argentina country code 549 if missing)
  const formatPhoneForWhatsApp = (phoneStr: string) => {
    let clean = phoneStr.replace(/\D/g, '');
    if (clean.length === 10) { // e.g., 3516123456
      clean = '549' + clean;
    } else if (clean.length === 11 && clean.startsWith('0')) {
      clean = '549' + clean.slice(1);
    }
    return clean;
  };

  const handleOpenWhatsApp = () => {
    const formattedPhone = formatPhoneForWhatsApp(lead.telefono);
    const encodedMsg = encodeURIComponent(customMsg);
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodedMsg}`;

    // Auto update status to "contactado" if it was "pendiente"
    if (lead.estado === 'pendiente') {
      crmStore.updateLeadStatus(
        lead.id, 
        'contactado', 
        undefined, 
        undefined, 
        'Inició contacto por WhatsApp con mensaje de campaña'
      );
    }

    window.open(waUrl, '_blank');
  };

  const handleStatusChange = (newStatus: LeadStatus) => {
    if (newStatus === 'caido') {
      onRequestRejection(lead);
      return;
    }

    if (newStatus === 'cerrado') {
      // Trigger celebration confetti for sale!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    crmStore.updateLeadStatus(
      lead.id, 
      newStatus, 
      undefined, 
      undefined, 
      statusNote || `Cambio de estado a ${LEAD_STATUS_CONFIG[newStatus].label}`
    );

    setStatusNote('');
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    crmStore.updateLeadStatus(
      lead.id,
      lead.estado,
      undefined,
      undefined,
      newNote.trim()
    );

    setNewNote('');
  };

  const filteredHistory = (lead?.historial || []).filter(item => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      (item.usuarioNombre || '').toLowerCase().includes(q) ||
      (item.nota && item.nota.toLowerCase().includes(q)) ||
      (item.nuevoEstado && LEAD_STATUS_CONFIG[item.nuevoEstado]?.label.toLowerCase().includes(q)) ||
      (item.estadoAnterior && LEAD_STATUS_CONFIG[item.estadoAnterior]?.label.toLowerCase().includes(q))
    );
  });

  const sortedHistory = auditSortNewest
    ? [...filteredHistory].reverse()
    : [...filteredHistory];

  const currentStatusConfig = LEAD_STATUS_CONFIG[lead.estado];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-[#2D3748] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#40C4C0] flex items-center justify-center text-white font-bold text-base shadow-xs">
              {lead.nombre.charAt(0)}{lead.apellido ? lead.apellido.charAt(0) : ''}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {lead.nombre} {lead.apellido}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentStatusConfig.badgeBg}`}>
                  {currentStatusConfig.label}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-medium mt-0.5">
                DNI: {lead.dni} • Tel: {lead.telefono}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingInfo(!isEditingInfo)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20"
              title="Editar datos del cliente"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#40C4C0]" />
              <span>{isEditingInfo ? 'Cancelar Edición' : 'Editar Datos'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-slate-700/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 animate-fadeIn">
              {saveSuccessMsg}
            </div>
          )}

          {isEditingInfo ? (
            <form onSubmit={handleSaveLeadInfo} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs font-medium text-[#2D3748] animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-[#2D3748] flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-[#40C4C0]" />
                  <span>Editar Datos de Cliente</span>
                </span>
                <span className="text-[10px] text-gray-500 font-normal">Modifica los datos personales y presiona guardar.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[11px] mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    required
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#40C4C0] focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[11px] mb-1">Apellido</label>
                  <input
                    type="text"
                    value={editApellido}
                    onChange={(e) => setEditApellido(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#40C4C0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[11px] mb-1">DNI</label>
                  <input
                    type="text"
                    value={editDni}
                    onChange={(e) => setEditDni(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#40C4C0] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[11px] mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={editTelefono}
                    onChange={(e) => setEditTelefono(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#40C4C0] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[11px] mb-1">Último Período Pagado (MM-YYYY)</label>
                  <input
                    type="text"
                    value={editPeriodo}
                    onChange={(e) => setEditPeriodo(e.target.value)}
                    placeholder="MM-YYYY (ej: 05-2026)"
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#40C4C0] focus:outline-none font-bold text-cyan-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[11px] mb-1">Campaña Asignada</label>
                  <CustomSelect
                    value={editCampanaId}
                    onChange={(e) => setEditCampanaId(e.target.value)}
                  >
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </CustomSelect>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingInfo(false)}
                  disabled={isSavingInfo}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingInfo}
                  className="px-4 py-1.5 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingInfo ? 'Guardando en Firestore...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          ) : null}

          {/* Quick Lead Info Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Campaña</p>
              <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                {lead.campanaNombre}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Último Pago</p>
              <p className="text-xs font-bold text-cyan-700 mt-0.5">
                {formatPeriodMMYYYY(lead.ultimoPeriodoPagado)}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl col-span-2 sm:col-span-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Vendedor Asignado</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {lead.vendedorNombre || 'Pool General (Sin asignar)'}
              </p>
            </div>
          </div>

          {/* Rejection observation warning if caido */}
          {lead.estado === 'caido' && lead.observacionRechazo && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1">
              <div className="flex items-center gap-1.5 font-extrabold text-rose-700">
                <AlertCircle className="w-4 h-4" />
                <span>Motivo de Caída: {lead.motivoCaida || 'Rechazado'}</span>
              </div>
              <p className="italic bg-white/80 p-2.5 rounded-xl border border-rose-100 mt-1">
                "{lead.observacionRechazo}"
              </p>
            </div>
          )}

          {/* WhatsApp Action Box (MODULE C) */}
          <div className="p-4 sm:p-5 bg-[#F0FDFD] border border-[#40C4C0]/30 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#2D3748] font-bold text-sm">
                <MessageCircle className="w-5 h-5 text-[#25D366] fill-[#25D366]/20" />
                <span>Módulo WhatsApp - Arevalo CRM</span>
              </div>
              <span className="text-[10px] font-bold text-[#40C4C0] bg-white border border-[#40C4C0]/30 px-2.5 py-0.5 rounded-full">
                1-Tap Directo
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#718096] mb-1">
                Mensaje Dinámico Personalizable:
              </label>
              <textarea
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                rows={3}
                className="w-full p-3 text-xs bg-white rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#40C4C0] text-[#2D3748] shadow-2xs"
              />
            </div>

            <button
              onClick={handleOpenWhatsApp}
              className="w-full py-3.5 px-4 bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2.5 text-sm active:scale-98"
            >
              <Send className="w-4 h-4 fill-white" />
              <span>Contactar por WhatsApp</span>
            </button>
          </div>

          {/* Quick Status Shift Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Cambiar Estado de Gestión:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['pendiente', 'contactado', 'sin_respuesta', 'gestion_ventas', 'cerrado', 'caido'] as LeadStatus[]).map((st) => {
                const conf = LEAD_STATUS_CONFIG[st];
                const isCurrent = lead.estado === st;
                return (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all text-left flex items-center justify-between ${
                      isCurrent
                        ? `${conf.badgeBg} ring-2 ring-[#2BB6B1] shadow-xs`
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{conf.label}</span>
                    {isCurrent && <span className="text-[10px] font-extrabold">✓ Actual</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Input */}
          <form onSubmit={handleAddNote} className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700">
              Agregar Nota / Seguimiento
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Escribe una observación de llamada o acuerdo..."
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2BB6B1]"
              />
              <button
                type="submit"
                disabled={!newNote.trim()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Agregar
              </button>
            </div>
          </form>

          {/* Lead Activity History & Audit Panel (EXCLUSIVELY FOR SUPER ADMIN) */}
          {isSuperAdmin ? (
            <div className="pt-4 border-t-2 border-dashed border-[#E2E8F0] space-y-3">
              {/* Panel Header */}
              <div className="p-4 bg-[#2D3748] text-white rounded-2xl shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#40C4C0] text-white rounded-xl">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-2">
                        <span>Historial de Actividad y Auditoría</span>
                      </h3>
                      <p className="text-[11px] text-gray-300 font-medium">
                        Registro inmutable de trazabilidad de estados, notas y cambios.
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-full text-[10px] font-extrabold self-start sm:self-auto">
                    <span>👑 Exclusivo Super Admin</span>
                  </span>
                </div>

                {/* Audit Stats Header */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700 text-[11px]">
                  <div className="bg-slate-800/80 p-2 rounded-xl text-center">
                    <span className="block text-gray-400 text-[9px] uppercase font-bold">Total Cambios</span>
                    <span className="font-extrabold text-[#40C4C0] text-xs">{lead.historial?.length || 0}</span>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl text-center">
                    <span className="block text-gray-400 text-[9px] uppercase font-bold">Fecha Alta</span>
                    <span className="font-bold text-white text-[10px] truncate block mt-0.5">
                      {new Date(lead.creadoEn).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl text-center">
                    <span className="block text-gray-400 text-[9px] uppercase font-bold">Último Operador</span>
                    <span className="font-bold text-emerald-400 text-[10px] truncate block mt-0.5">
                      {lead.historial && lead.historial.length > 0 
                        ? lead.historial[lead.historial.length - 1].usuarioNombre 
                        : 'Sistema'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit Search and Sorting Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="relative w-full sm:w-auto sm:flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Buscar en auditoría (operador, estado, nota)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#40C4C0]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setAuditSortNewest(!auditSortNewest)}
                  className="w-full sm:w-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#40C4C0]" />
                  <span>{auditSortNewest ? 'Más Recientes Primero' : 'Más Antiguos Primero'}</span>
                </button>
              </div>

              {/* Timeline Items */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {sortedHistory.length === 0 ? (
                  <div className="p-5 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-gray-500 font-medium">
                    No se encontraron registros en la auditoría.
                  </div>
                ) : (
                  sortedHistory.map((item, idx) => {
                    const prevConf = item.estadoAnterior ? LEAD_STATUS_CONFIG[item.estadoAnterior] : null;
                    const newConf = LEAD_STATUS_CONFIG[item.nuevoEstado];

                    return (
                      <div 
                        key={item.id || idx} 
                        className="p-3 bg-white border border-slate-200 rounded-2xl hover:border-[#40C4C0]/50 transition-all space-y-1.5 text-xs shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium border-b border-slate-100 pb-1">
                          <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                            <UserIcon className="w-3.5 h-3.5 text-[#40C4C0]" />
                            <span>{item.usuarioNombre}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>
                              {new Date(item.fecha).toLocaleDateString('es-AR')} {new Date(item.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* State Transition Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap font-bold text-[11px]">
                          {prevConf && (
                            <>
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] ${prevConf.badgeBg}`}>
                                {prevConf.label}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            </>
                          )}
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] ${newConf ? newConf.badgeBg : 'bg-slate-100'}`}>
                            {newConf ? newConf.label : item.nuevoEstado}
                          </span>
                        </div>

                        {/* Audit Note / Observation Detail */}
                        {item.nota && (
                          <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 italic">
                            "{item.nota}"
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

        </div>

      </div>
    </div>
  );
};
