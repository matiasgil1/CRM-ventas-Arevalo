import React, { useState } from 'react';
import { Campaign, Lead, User } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { ConfirmModal } from './ConfirmModal';
import { 
  Megaphone, Plus, Edit2, Trash2, MessageSquare, 
  Search, Users, Calendar, X, Loader2, Check 
} from 'lucide-react';

interface CampaignManagementModuleProps {
  campaigns: Campaign[];
  leads: Lead[];
  currentUser: User;
}

export const CampaignManagementModule: React.FC<CampaignManagementModuleProps> = ({
  campaigns,
  leads,
  currentUser
}) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Delete Campaign Modal State
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);

  // Form fields
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [scriptTemplate, setScriptTemplate] = useState('');

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const filteredCampaigns = campaigns.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.descripcion.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingCampaign(null);
    setNombre('');
    setDescripcion('');
    setScriptTemplate(
      'Hola {nombre} {apellido}, te contactamos de Arevalo Servicios Sociales referente a tu plan ({ultimoPeriodoPagado}). ¡Queremos ofrecerte una atención personalizada!'
    );
    setIsModalOpen(true);
  };

  const handleOpenEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setNombre(campaign.nombre);
    setDescripcion(campaign.descripcion);
    setScriptTemplate(campaign.scriptTemplate);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingCampaign) {
        await crmStore.updateCampaign(editingCampaign.id, nombre, descripcion, scriptTemplate);
        showFeedback('success', `Campaña "${nombre}" actualizada correctamente.`);
      } else {
        await crmStore.addCampaign(nombre, descripcion, scriptTemplate);
        showFeedback('success', `Campaña "${nombre}" creada exitosamente.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error al guardar la campaña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRequestDelete = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
  };

  const handleConfirmDelete = async () => {
    if (!campaignToDelete) return;
    setIsDeletingCampaign(true);
    try {
      const ok = await crmStore.deleteCampaign(campaignToDelete.id);
      if (ok) {
        showFeedback('success', `Campaña "${campaignToDelete.nombre}" eliminada correctamente de Firestore.`);
      } else {
        showFeedback('error', 'No se pudo eliminar la campaña seleccionada.');
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Error al eliminar campaña.');
    } finally {
      setIsDeletingCampaign(false);
      setCampaignToDelete(null);
    }
  };

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      {/* Title Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#40C4C0] text-white rounded-xl shadow-xs">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2D3748] tracking-tight">
              Gestión de Campañas (ABM)
            </h1>
            <p className="text-xs text-[#718096] font-medium">
              Crea, modifica y administra las campañas comerciales y sus plantillas de mensajes WhatsApp.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-xs active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Nueva Campaña</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center gap-2.5 animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <X className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Toolbar / Search */}
      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#718096]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar campaña por nombre o descripción..."
            className="w-full pl-9 pr-3.5 py-2 text-xs font-medium rounded-xl border border-[#E2E8F0] bg-[#F3F7F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#40C4C0] text-[#2D3748]"
          />
        </div>
        <div className="text-xs text-[#718096] font-bold">
          Total: <span className="text-[#2D3748]">{filteredCampaigns.length} campañas</span>
        </div>
      </div>

      {/* Campaign Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCampaigns.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-[#E2E8F0]">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-[#2D3748]">No hay campañas registradas</p>
            <p className="text-xs text-[#718096] mt-1">Crea una nueva campaña para clasificar tus leads e importaciones.</p>
          </div>
        ) : (
          filteredCampaigns.map((camp) => {
            const countLeads = leads.filter(l => l.campanaId === camp.id).length;

            return (
              <div 
                key={camp.id} 
                className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-all space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-[#2D3748] leading-snug">
                      {camp.nombre}
                    </h3>
                    <span className="bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                      {countLeads} leads
                    </span>
                  </div>

                  <p className="text-xs text-[#718096] leading-relaxed line-clamp-2">
                    {camp.descripcion || 'Sin descripción ingresada.'}
                  </p>

                  <div className="p-3 bg-[#F3F7F7] rounded-xl border border-[#E2E8F0] space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#2D3748]">
                      <MessageSquare className="w-3.5 h-3.5 text-[#40C4C0]" />
                      <span>Plantilla WhatsApp:</span>
                    </div>
                    <p className="text-[11px] text-[#718096] italic line-clamp-2">
                      "{camp.scriptTemplate}"
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#718096]">
                  <div className="flex items-center gap-1 text-[10px]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(camp.creadoEn).toLocaleDateString('es-AR')}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(camp)}
                      className="p-2 hover:bg-gray-100 rounded-xl text-[#2D3748] transition-colors"
                      title="Editar Campaña"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRequestDelete(camp)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-600 border border-rose-200 transition-colors active:scale-95"
                      title="Eliminar Campaña"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal ABM Campaña */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden animate-fadeIn">
            <div className="p-4 bg-[#2D3748] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-5 h-5 text-[#40C4C0]" />
                <h2 className="font-bold text-sm">
                  {editingCampaign ? 'Editar Campaña Comercial' : 'Crear Nueva Campaña'}
                </h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-medium text-[#2D3748]">
              <div>
                <label className="block font-bold mb-1">Nombre de la Campaña *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Recuperación de Morosos Julio 2026"
                  required
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#40C4C0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Descripción / Objetivo Comercial</label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Breve detalle del público objetivo o finalidad..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#40C4C0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Plantilla de Mensaje WhatsApp (Script)</label>
                <p className="text-[10px] text-[#718096] mb-1.5">
                  Puedes usar variables: <code className="bg-gray-100 px-1 py-0.5 rounded text-teal-700">{'{nombre}'}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-teal-700">{'{apellido}'}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-teal-700">{'{ultimoPeriodoPagado}'}</code> o <code className="bg-gray-100 px-1 py-0.5 rounded text-teal-700">{'{periodo}'}</code>.
                </p>
                <textarea
                  value={scriptTemplate}
                  onChange={(e) => setScriptTemplate(e.target.value)}
                  rows={4}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#40C4C0] focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#2D3748] font-bold rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando en Firestore...</span>
                    </>
                  ) : (
                    <span>{editingCampaign ? 'Guardar Cambios' : 'Crear Campaña'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirm Modal */}
      <ConfirmModal
        isOpen={!!campaignToDelete}
        title="Eliminar Campaña Comercial"
        message={`¿Estás seguro de eliminar la campaña "${campaignToDelete?.nombre}"? Las asignaciones de leads asociadas conservarán la referencia pero la campaña será removida.`}
        itemName={campaignToDelete ? `Campaña: ${campaignToDelete.nombre}` : undefined}
        confirmText="Sí, Eliminar Campaña"
        isLoading={isDeletingCampaign}
        onConfirm={handleConfirmDelete}
        onClose={() => setCampaignToDelete(null)}
      />
    </div>
  );
};
