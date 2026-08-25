import React, { useState, useMemo } from 'react';
import { Lead, LeadStatus, Campaign, LEAD_STATUS_CONFIG, User } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { formatPeriodMMYYYY } from '../utils/formatters';
import { isLeadAssignedToUser } from '../utils/sellerUtils';
import { CustomSelect } from './CustomSelect';
import { 
  Search, Filter, Phone, MessageCircle, Clock, UserCheck, 
  ChevronRight, ChevronLeft, ArrowRight, AlertTriangle, Layers, User as UserIcon
} from 'lucide-react';

interface KanbanModuleProps {
  leads: Lead[];
  currentUser: User;
  users?: User[];
  campaigns: Campaign[];
  onSelectLead: (lead: Lead) => void;
  onRequestRejection: (lead: Lead) => void;
  onOpenPool: () => void;
}

const KANBAN_STAGES: LeadStatus[] = [
  'pendiente',
  'contactado',
  'sin_respuesta',
  'gestion_ventas',
  'cerrado',
  'caido'
];

export const KanbanModule: React.FC<KanbanModuleProps> = ({
  leads,
  currentUser,
  users = [],
  campaigns,
  onSelectLead,
  onRequestRejection,
  onOpenPool
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [search, setSearch] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<'mine' | 'all'>(
    isAdmin ? 'all' : 'mine'
  );
  const [activeMobileStage, setActiveMobileStage] = useState<LeadStatus>('pendiente');

  const activeSellers = useMemo(() => {
    const list = users.filter(u => u.status === 'approved' || (u.status as string) === 'active');
    if (list.length > 0) return list;
    const nonRejected = users.filter(u => u.status !== 'rejected' && u.status !== 'suspended');
    return nonRejected.length > 0 ? nonRejected : users;
  }, [users]);

  // Filter leads for this view with strict role isolation
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Role/Ownership filter
      if (!isAdmin) {
        if (!isLeadAssignedToUser(lead, currentUser)) return false;
      } else {
        if (viewFilter === 'mine') {
          if (!isLeadAssignedToUser(lead, currentUser)) return false;
        } else {
          // 'all' shows assigned leads unless seller filter overrides
          if (!lead.vendedorId && selectedSeller !== 'unassigned') return false;
        }
      }

      // Campaign filter
      if (selectedCampaign !== 'all' && lead.campanaId !== selectedCampaign) {
        return false;
      }

      // Seller filter (admin only)
      if (isAdmin && selectedSeller !== 'all') {
        if (selectedSeller === 'unassigned') {
          if (lead.vendedorId) return false;
        } else if (lead.vendedorId !== selectedSeller) {
          return false;
        }
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = `${lead.nombre} ${lead.apellido}`.toLowerCase().includes(q);
        const matchDNI = lead.dni.includes(q);
        const matchPhone = lead.telefono.includes(q);
        if (!matchName && !matchDNI && !matchPhone) return false;
      }

      return true;
    });
  }, [leads, isAdmin, currentUser, viewFilter, selectedCampaign, selectedSeller, search]);

  const getLeadsForStage = (stage: LeadStatus) => {
    return filteredLeads.filter((l) => l.estado === stage);
  };

  const handleQuickMove = async (e: React.MouseEvent, lead: Lead, targetStage: LeadStatus) => {
    e.stopPropagation();
    if (targetStage === 'caido') {
      onRequestRejection(lead);
    } else {
      await crmStore.updateLeadStatus(lead.id, targetStage);
    }
  };

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      {/* Top Filter & Toolbar Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-[#E2E8F0] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-bold text-[#2D3748] tracking-tight">
              {isAdmin ? 'Pipeline de Gestión' : 'Pipeline de Mis Leads'}
            </h1>
            <span className="bg-[#F0FDFD] text-[#40C4C0] font-bold text-xs px-3 py-1 rounded-full border border-[#40C4C0]/20">
              {filteredLeads.length} leads
            </span>
          </div>

          {/* Mine vs All toggle for Admins */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="bg-[#F3F7F7] p-1 rounded-xl flex items-center text-xs font-bold border border-[#E2E8F0]">
                <button
                  onClick={() => setViewFilter('mine')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    viewFilter === 'mine' ? 'bg-white text-[#2D3748] shadow-xs' : 'text-[#718096]'
                  }`}
                >
                  Mis Leads
                </button>
                <button
                  onClick={() => setViewFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    viewFilter === 'all' ? 'bg-white text-[#2D3748] shadow-xs' : 'text-[#718096]'
                  }`}
                >
                  Todos los Asignados
                </button>
              </div>
            )}

            {isAdmin && (
              <button
                onClick={onOpenPool}
                className="px-4 py-2 bg-[#F0FDFD] hover:bg-[#e2f9f8] text-[#40C4C0] border border-[#40C4C0]/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Layers className="w-4 h-4 text-[#40C4C0]" />
                <span>Tomar del Pool</span>
              </button>
            )}
          </div>
        </div>

        {/* Search, Campaign & Seller Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#718096]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por Nombre, DNI o Teléfono..."
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
              <option value="all">Todas las Campañas</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </CustomSelect>
          </div>

          <div className="flex-1">
            {isAdmin ? (
              <CustomSelect
                icon={UserCheck}
                variant="subtle"
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
              >
                <option value="all">Todos los Vendedores</option>
                <option value="unassigned">⚠️ Pool General (Sin Asignar)</option>
                {activeSellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </CustomSelect>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F0FDFD] border border-[#40C4C0]/30 text-xs font-bold text-[#00807D] shadow-2xs">
                <UserIcon className="w-4 h-4 text-[#40C4C0] shrink-0" />
                <span className="truncate">Mi Cartera: {currentUser.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Stage Horizontal Selector Pills */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {KANBAN_STAGES.map((st) => {
          const conf = LEAD_STATUS_CONFIG[st];
          const count = getLeadsForStage(st).length;
          const isActive = activeMobileStage === st;
          return (
            <button
              key={st}
              onClick={() => setActiveMobileStage(st)}
              className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <span>{conf.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board Container */}
      {/* Desktop: 6 Grid Columns. Mobile: Active stage list */}
      <div className="hidden md:grid md:grid-cols-6 gap-3 items-start">
        {KANBAN_STAGES.map((stage) => {
          const stageConfig = LEAD_STATUS_CONFIG[stage];
          const stageLeads = getLeadsForStage(stage);

          return (
            <div
              key={stage}
              className="bg-white/80 rounded-2xl p-3 border border-[#E2E8F0] shadow-xs min-h-[500px] flex flex-col"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E2E8F0] px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: stageConfig.color }}
                  />
                  <h3 className="text-xs font-bold text-[#2D3748]">
                    {stageConfig.label}
                  </h3>
                </div>
                <span className="text-[10px] font-bold bg-[#F3F7F7] px-2 py-0.5 rounded-full border border-[#E2E8F0] text-[#718096]">
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[70vh] pr-0.5">
                {stageLeads.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-[#718096] font-medium">
                    Sin leads
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => onSelectLead(lead)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Single Active Column View */}
      <div className="md:hidden space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: LEAD_STATUS_CONFIG[activeMobileStage].color }}
            />
            {LEAD_STATUS_CONFIG[activeMobileStage].label}
          </h2>
          <span className="text-xs font-bold text-slate-500">
            {getLeadsForStage(activeMobileStage).length} clientes
          </span>
        </div>

        <div className="space-y-2.5">
          {getLeadsForStage(activeMobileStage).length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No hay leads en el estado {LEAD_STATUS_CONFIG[activeMobileStage].label}
            </div>
          ) : (
            getLeadsForStage(activeMobileStage).map((lead) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                onClick={() => onSelectLead(lead)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-component for individual Kanban Cards (Responsive & Minimalist)
interface KanbanCardProps {
  lead: Lead;
  onClick: () => void;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ lead, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white px-3.5 py-3 rounded-xl border border-[#E2E8F0] shadow-2xs hover:shadow-md hover:border-[#40C4C0] hover:bg-[#F0FDFD]/30 transition-all cursor-pointer group active:scale-98 flex items-center justify-between gap-2"
      title={`Abrir ficha de ${lead.nombre} ${lead.apellido}`}
    >
      <h4 className="text-xs font-bold text-[#2D3748] group-hover:text-[#00807D] transition-colors leading-snug truncate">
        {lead.nombre} {lead.apellido}
      </h4>
      <ChevronRight className="w-3.5 h-3.5 text-[#A0AEC0] group-hover:text-[#40C4C0] group-hover:translate-x-0.5 transition-all shrink-0" />
    </div>
  );
};
