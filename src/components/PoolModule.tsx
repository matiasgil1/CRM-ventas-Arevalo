import React, { useState, useMemo } from 'react';
import { Lead, Campaign, User } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { formatPeriodMMYYYY } from '../utils/formatters';
import { analyzePhoneWhatsApp } from '../utils/phoneUtils';
import { CustomSelect } from './CustomSelect';
import { Layers, Search, Filter, CheckCircle, UserPlus, Sparkles, MessageCircle, Phone } from 'lucide-react';

interface PoolModuleProps {
  leads: Lead[];
  currentUser: User;
  users: User[];
  campaigns: Campaign[];
  onSelectLead: (lead: Lead) => void;
}

export const PoolModule: React.FC<PoolModuleProps> = ({
  leads,
  currentUser,
  users,
  campaigns,
  onSelectLead
}) => {
  const [search, setSearch] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [claimedSuccessMsg, setClaimedSuccessMsg] = useState('');

  // Bulk Selection State
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkCampaignId, setBulkCampaignId] = useState<string>('');
  const [bulkSellerId, setBulkSellerId] = useState<string>('');

  // Active approved sellers
  const activeSellers = useMemo(() => {
    const list = users.filter(u => u.status === 'approved');
    if (list.length > 0) return list;
    const nonRejected = users.filter(u => u.status !== 'rejected' && u.status !== 'suspended');
    return nonRejected.length > 0 ? nonRejected : users;
  }, [users]);

  // Unassigned leads in pool
  const poolLeads = leads.filter(l => l.vendedorId === null);

  const filteredPool = poolLeads.filter((lead) => {
    if (selectedCampaign !== 'all' && lead.campanaId !== selectedCampaign) {
      return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = `${lead.nombre} ${lead.apellido}`.toLowerCase().includes(q);
      const matchDNI = lead.dni.includes(q);
      const matchPhone = lead.telefono.includes(q);
      if (!matchName && !matchDNI && !matchPhone) return false;
    }

    return true;
  });

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleClaim = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setActionLoadingId(lead.id);
    try {
      const success = await crmStore.claimLead(lead.id, currentUser);
      if (success) {
        setClaimedSuccessMsg(`¡Apropiación exitosa! Te has asignado a ${lead.nombre} ${lead.apellido}.`);
        setTimeout(() => setClaimedSuccessMsg(''), 4000);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeadCampaignChange = async (leadId: string, campaignId: string) => {
    setActionLoadingId(leadId);
    try {
      await crmStore.assignLeadCampaign(leadId, campaignId);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeadSellerChange = async (leadId: string, sellerId: string) => {
    setActionLoadingId(leadId);
    try {
      if (sellerId === 'unassigned') {
        await crmStore.assignLeadToSeller(leadId, null, null);
      } else {
        const seller = users.find(u => u.id === sellerId);
        if (seller) {
          await crmStore.assignLeadToSeller(leadId, seller.id, seller.name);
        }
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === filteredPool.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredPool.map(l => l.id));
    }
  };

  const handleApplyBulk = async () => {
    if (selectedLeadIds.length === 0) return;

    setActionLoadingId('bulk');
    try {
      let appliedCount = 0;
      for (const id of selectedLeadIds) {
        if (bulkCampaignId) {
          await crmStore.assignLeadCampaign(id, bulkCampaignId);
        }
        if (bulkSellerId) {
          if (bulkSellerId === 'unassigned') {
            await crmStore.assignLeadToSeller(id, null, null);
          } else {
            const seller = users.find(u => u.id === bulkSellerId);
            if (seller) {
              await crmStore.assignLeadToSeller(id, seller.id, seller.name);
            }
          }
        }
        appliedCount++;
      }

      setClaimedSuccessMsg(`¡Actualización masiva completada! Se modificaron ${appliedCount} leads.`);
      setTimeout(() => setClaimedSuccessMsg(''), 4000);
      setSelectedLeadIds([]);
      setBulkCampaignId('');
      setBulkSellerId('');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#40C4C0] text-white rounded-xl shadow-xs">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[#2D3748] tracking-tight">
                Pool General de Leads (Sin Asignar)
              </h1>
              <p className="text-xs text-[#718096] font-medium">
                Asigna campaña y vendedor a cada lead individualmente o de forma masiva.
              </p>
            </div>
          </div>

          <div className="bg-[#F0FDFD] px-3.5 py-1.5 rounded-xl border border-[#40C4C0]/30 text-xs font-bold text-[#40C4C0] self-start sm:self-auto">
            ⚡ {poolLeads.length} leads disponibles en Pool
          </div>
        </div>

        {/* Search & Campaign Dropdown Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#718096]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, DNI o teléfono..."
              className="w-full pl-9 pr-3.5 py-2 text-xs font-medium rounded-xl border border-[#E2E8F0] bg-[#F3F7F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#40C4C0] text-[#2D3748]"
            />
          </div>

          <div className="flex-1">
            <CustomSelect
              icon={Filter}
              variant="subtle"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
            >
              <option value="all">Filtrar por Campaña (Todas)</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </CustomSelect>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {filteredPool.length > 0 && (
          <div className="p-3 bg-[#F0FDFD] border border-[#40C4C0]/30 rounded-xl space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-[#2D3748]">
                <input
                  type="checkbox"
                  checked={selectedLeadIds.length === filteredPool.length && filteredPool.length > 0}
                  onChange={handleSelectAll}
                  className="rounded text-[#40C4C0] focus:ring-[#40C4C0] w-4 h-4"
                />
                <span>Asignación Masiva ({selectedLeadIds.length} seleccionados)</span>
              </div>

              {selectedLeadIds.length > 0 && (
                <button
                  onClick={handleApplyBulk}
                  className="px-3 py-1.5 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-lg text-xs shadow-xs transition-all"
                >
                  Aplicar a Seleccionados
                </button>
              )}
            </div>

            {selectedLeadIds.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#40C4C0]/20">
                <div>
                  <label className="block text-[10px] font-bold text-[#718096] mb-0.5">Asignar Campaña Masiva:</label>
                  <CustomSelect
                    variant="table"
                    value={bulkCampaignId}
                    onChange={(e) => setBulkCampaignId(e.target.value)}
                  >
                    <option value="">-- Sin Cambios --</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </CustomSelect>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#718096] mb-0.5">Asignar Vendedor Masivo:</label>
                  <CustomSelect
                    variant="table"
                    value={bulkSellerId}
                    onChange={(e) => setBulkSellerId(e.target.value)}
                  >
                    <option value="">-- Sin Cambios --</option>
                    {activeSellers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </CustomSelect>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Claim Toast Success Message */}
      {claimedSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{claimedSuccessMsg}</span>
        </div>
      )}

      {/* Leads List */}
      {filteredPool.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            No hay leads pendientes en el Pool General
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Actualmente todos los clientes importados han sido asignados o no hay registros en el pool.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPool.map((lead) => (
            <div
              key={lead.id}
              className={`bg-white p-4 rounded-xl border transition-all space-y-3 ${
                selectedLeadIds.includes(lead.id)
                  ? 'border-[#40C4C0] ring-2 ring-[#40C4C0]/20 bg-[#F0FDFD]/30'
                  : 'border-[#E2E8F0] hover:border-[#40C4C0]/50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={() => handleToggleSelectLead(lead.id)}
                      className="rounded text-[#40C4C0] focus:ring-[#40C4C0] w-4 h-4"
                    />
                    <button 
                      onClick={() => onSelectLead(lead)}
                      className="text-sm font-bold text-[#2D3748] hover:text-[#40C4C0] text-left transition-colors"
                    >
                      {lead.nombre} {lead.apellido}
                    </button>
                  </div>
                  <span className="text-[10px] font-bold bg-[#F0FDFD] text-[#00807D] px-2.5 py-0.5 rounded-full border border-[#40C4C0]/40 shrink-0 whitespace-nowrap">
                    {formatPeriodMMYYYY(lead.ultimoPeriodoPagado)}
                  </span>
                </div>

                <div className="text-xs text-[#718096] font-medium pl-6 flex items-center gap-2 flex-wrap">
                  <span>DNI: <strong className="text-slate-700">{lead.dni}</strong></span>
                  <span>•</span>
                  {(() => {
                    const phoneInfo = analyzePhoneWhatsApp(lead.telefono);
                    if (phoneInfo.isValidWhatsApp) {
                      return (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                          <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{phoneInfo.displayFormatted} (WA)</span>
                        </span>
                      );
                    } else if (phoneInfo.statusLabel === 'Fijo (Sin WA)') {
                      return (
                        <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                          <Phone className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>{phoneInfo.displayFormatted} (Fijo)</span>
                        </span>
                      );
                    } else {
                      return <span className="text-slate-400 italic">Tel: {lead.telefono || 'Sin número'}</span>;
                    }
                  })()}
                </div>

                {/* SELECT CAMPAÑA DROPDOWN */}
                <div className="pt-1">
                  <label className="block text-[10px] font-bold text-[#718096] mb-1">
                    🎯 Seleccionar Campaña:
                  </label>
                  <CustomSelect
                    variant="subtle"
                    value={lead.campanaId}
                    onChange={(e) => handleLeadCampaignChange(lead.id, e.target.value)}
                  >
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </CustomSelect>
                </div>

                {/* SELECT VENDEDOR DROPDOWN */}
                <div>
                  <label className="block text-[10px] font-bold text-[#718096] mb-1">
                    👤 Seleccionar Vendedor:
                  </label>
                  <CustomSelect
                    variant={lead.vendedorId ? "subtle" : "amber"}
                    value={lead.vendedorId || 'unassigned'}
                    onChange={(e) => handleLeadSellerChange(lead.id, e.target.value)}
                  >
                    <option value="unassigned">⚠️ Pool General (Sin Asignar)</option>
                    {activeSellers.map(s => (
                      <option key={s.id} value={s.id}>👤 {s.name}</option>
                    ))}
                  </CustomSelect>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSelectLead(lead)}
                  className="text-xs text-[#718096] hover:text-[#2D3748] font-medium underline"
                >
                  Ver Detalle
                </button>

                <button
                  type="button"
                  onClick={(e) => handleClaim(e, lead)}
                  className="px-3 py-1.5 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-98"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Asignarme a mí</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
