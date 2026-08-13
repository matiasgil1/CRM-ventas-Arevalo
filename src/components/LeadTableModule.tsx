import React, { useState, useMemo } from 'react';
import { Lead, Campaign, User, LEAD_STATUS_CONFIG } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { formatPeriodMMYYYY, formatMessageTemplate } from '../utils/formatters';
import { analyzePhoneWhatsApp } from '../utils/phoneUtils';
import { ConfirmModal } from './ConfirmModal';
import { CustomSelect } from './CustomSelect';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Table, Search, ChevronLeft, ChevronRight, 
  MessageCircle, Eye, FileSpreadsheet, Trash2, Loader2, Check, X, Phone,
  Filter, Tag, UserCheck, FileText, Download
} from 'lucide-react';

interface LeadTableModuleProps {
  leads: Lead[];
  users: User[];
  campaigns: Campaign[];
  currentUser: User;
  onSelectLead: (lead: Lead) => void;
  onRequestRejection: (lead: Lead) => void;
  onOpenImport: () => void;
}

export const LeadTableModule: React.FC<LeadTableModuleProps> = ({
  leads,
  users,
  campaigns,
  currentUser,
  onSelectLead,
  onRequestRejection,
  onOpenImport
}) => {
  // Filters State
  const [search, setSearch] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSeller, setSelectedSeller] = useState<string>('all');

  // Bulk Selection & Deletion State
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dynamic feedback notification
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Pagination State (Max 10 per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Active approved sellers
  const activeSellers = useMemo(() => {
    const list = users.filter(u => u.status === 'approved');
    if (list.length > 0) return list;
    const nonRejected = users.filter(u => u.status !== 'rejected' && u.status !== 'suspended');
    return nonRejected.length > 0 ? nonRejected : users;
  }, [users]);

  // Intelligent Search & Filter logic
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = search.trim().toLowerCase();
      const matchesSearch = q === '' || [
        lead.nombre,
        lead.apellido,
        lead.dni,
        lead.telefono,
        lead.campanaNombre,
        lead.vendedorNombre || 'sin asignar pool',
        lead.ultimoPeriodoPagado,
        lead.observacionRechazo || ''
      ].some(val => val.toLowerCase().includes(q));

      const matchesCampaign = selectedCampaign === 'all' || lead.campanaId === selectedCampaign;
      const matchesStatus = selectedStatus === 'all' || lead.estado === selectedStatus;
      
      let matchesSeller = true;
      if (selectedSeller === 'unassigned') {
        matchesSeller = lead.vendedorId === null;
      } else if (selectedSeller !== 'all') {
        matchesSeller = lead.vendedorId === selectedSeller;
      }

      return matchesSearch && matchesCampaign && matchesStatus && matchesSeller;
    });
  }, [leads, search, selectedCampaign, selectedStatus, selectedSeller]);

  // Reset pagination when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCampaign, selectedStatus, selectedSeller]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Checkbox Selection Logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeadIds(paginatedLeads.map(l => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Direct Column Handlers
  const handleStatusChange = async (lead: Lead, newStatus: Lead['estado']) => {
    if (newStatus === lead.estado) return;

    if (newStatus === 'caido') {
      onRequestRejection(lead);
    } else {
      await crmStore.updateLeadStatus(lead.id, newStatus);
      showFeedback('success', `Estado de ${lead.nombre} actualizado a "${LEAD_STATUS_CONFIG[newStatus].label}".`);
    }
  };

  const handleSellerChange = async (leadId: string, sellerId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    if (sellerId === 'unassigned') {
      await crmStore.assignLeadToSeller(leadId, null, null);
      showFeedback('success', `Lead "${lead.nombre}" reasignado al Pool General.`);
    } else {
      const seller = users.find(u => u.id === sellerId);
      if (seller) {
        await crmStore.assignLeadToSeller(leadId, seller.id, seller.name);
        showFeedback('success', `Lead "${lead.nombre}" asignado a ${seller.name}.`);
      }
    }
  };

  // Delete Single Lead Handler
  const handleConfirmDeleteSingle = async () => {
    if (!leadToDelete) return;
    setIsDeleting(true);
    try {
      await crmStore.deleteLead(leadToDelete.id);
      showFeedback('success', `Lead "${leadToDelete.nombre} ${leadToDelete.apellido}" eliminado de Firestore.`);
    } catch (e: any) {
      showFeedback('error', 'Error al eliminar el lead.');
    } finally {
      setIsDeleting(false);
      setLeadToDelete(null);
    }
  };

  // Delete Bulk Leads Handler
  const handleConfirmDeleteBulk = async () => {
    if (selectedLeadIds.length === 0) return;
    setIsDeleting(true);
    try {
      await crmStore.deleteLeadsBulk(selectedLeadIds);
      showFeedback('success', `Se eliminaron ${selectedLeadIds.length} leads seleccionados de Firestore.`);
      setSelectedLeadIds([]);
    } catch (e: any) {
      showFeedback('error', 'Error al eliminar los leads seleccionados.');
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  // WhatsApp 1-tap launcher
  const handleWhatsAppClick = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    const campaign = campaigns.find(c => c.id === lead.campanaId);
    const scriptTemplate = campaign?.scriptTemplate || `Hola {nombre} {apellido}, te contactamos de Arevalo Servicios Sociales referente a tu plan. Vimos que el último período pagado es {ultimoPeriodoPagado}. ¡Queremos ofrecerte una atención personalizada!`;
    const msg = formatMessageTemplate(scriptTemplate, lead);

    const cleanPhone = lead.telefono.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('549') 
      ? cleanPhone 
      : cleanPhone.startsWith('54') 
      ? `549${cleanPhone.slice(2)}` 
      : `549${cleanPhone}`;

    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Export Filtered Leads to Excel (.xlsx)
  const handleExportExcel = () => {
    const exportList = selectedLeadIds.length > 0
      ? filteredLeads.filter(l => selectedLeadIds.includes(l.id))
      : filteredLeads;

    if (exportList.length === 0) {
      showFeedback('error', 'No hay registros para exportar con los filtros seleccionados.');
      return;
    }

    const exportRows = exportList.map((lead, index) => {
      const statusLabel = LEAD_STATUS_CONFIG[lead.estado]?.label || lead.estado;
      return {
        '#': index + 1,
        'Nombre': lead.nombre || '',
        'Apellido': lead.apellido || '',
        'DNI': lead.dni || '',
        'Teléfono': lead.telefono || '',
        'Último Período Pagado': formatPeriodMMYYYY(lead.ultimoPeriodoPagado),
        'Campaña': lead.campanaNombre || '',
        'Estado': statusLabel,
        'Vendedor Asignado': lead.vendedorNombre || 'Pool General (Sin Asignar)',
        'Fecha Registro / Asignación': lead.creadoEn ? new Date(lead.creadoEn).toLocaleString('es-AR') : '',
        'Último Contacto': lead.ultimoContacto ? new Date(lead.ultimoContacto).toLocaleString('es-AR') : '',
        'Observación / Motivo Rechazo': lead.observacionRechazo || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Leads');
    
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Reporte_Leads_Arevalo_${dateStr}.xlsx`);
    
    showFeedback('success', `¡Reporte Excel descargado exitosamente con ${exportList.length} registros!`);
  };

  // Export Filtered Leads to PDF (.pdf)
  const handleExportPDF = () => {
    const exportList = selectedLeadIds.length > 0
      ? filteredLeads.filter(l => selectedLeadIds.includes(l.id))
      : filteredLeads;

    if (exportList.length === 0) {
      showFeedback('error', 'No hay registros para exportar con los filtros seleccionados.');
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Header Banner
      doc.setFillColor(45, 55, 72); // #2D3748
      doc.rect(0, 0, 297, 22, 'F');

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(64, 196, 192); // #40C4C0
      doc.text('ARÉVALO SERVICIOS INTEGRALES', 14, 11);

      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('REPORTE GENERAL DE LEADS Y GESTIÓN CRM', 14, 17);

      // Active Filter Subtitles
      const campaignName = selectedCampaign === 'all' 
        ? 'Todas' 
        : campaigns.find(c => c.id === selectedCampaign)?.nombre || selectedCampaign;
      
      const statusName = selectedStatus === 'all' 
        ? 'Todos' 
        : LEAD_STATUS_CONFIG[selectedStatus as keyof typeof LEAD_STATUS_CONFIG]?.label || selectedStatus;

      let sellerName = 'Todos';
      if (selectedSeller === 'unassigned') sellerName = 'Pool General (Sin Asignar)';
      else if (selectedSeller !== 'all') sellerName = users.find(u => u.id === selectedSeller)?.name || selectedSeller;

      const filterText = `Filtros: Campaña [${campaignName}] | Estado [${statusName}] | Vendedor [${sellerName}]${search.trim() ? ` | Búsqueda: "${search.trim()}"` : ''}`;
      const dateText = `Generado el: ${new Date().toLocaleString('es-AR')} | Total registros exportados: ${exportList.length}`;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(filterText, 14, 28);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(dateText, 14, 32);

      // Table Data
      const tableData = exportList.map((lead, idx) => {
        const statusLabel = LEAD_STATUS_CONFIG[lead.estado]?.label || lead.estado;
        return [
          (idx + 1).toString(),
          `${lead.nombre} ${lead.apellido}`.trim() || 'S/N',
          lead.dni || 'S/D',
          lead.telefono || 'Sin número',
          formatPeriodMMYYYY(lead.ultimoPeriodoPagado),
          lead.campanaNombre || '-',
          statusLabel,
          lead.vendedorNombre || 'Sin Asignar'
        ];
      });

      autoTable(doc, {
        startY: 36,
        head: [['#', 'Nombre y Apellido', 'DNI', 'Teléfono', 'Últ. Período', 'Campaña', 'Estado', 'Vendedor Asignado']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          font: 'helvetica'
        },
        headStyles: {
          fillColor: [64, 196, 192],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 50 },
          2: { cellWidth: 25 },
          3: { cellWidth: 32 },
          4: { cellWidth: 24 },
          5: { cellWidth: 38 },
          6: { cellWidth: 36 },
          7: { cellWidth: 45 }
        },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Página ${data.pageNumber}`, 280, 203, { align: 'right' });
        }
      });

      doc.save(`Reporte_Leads_Arevalo_${new Date().toISOString().slice(0, 10)}.pdf`);
      showFeedback('success', `¡Reporte PDF generado exitosamente con ${exportList.length} registros!`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      showFeedback('error', 'Error al generar el documento PDF.');
    }
  };

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#40C4C0] text-white rounded-xl shadow-xs">
              <Table className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#2D3748] tracking-tight">
                Grilla Dinámica de Leads
              </h1>
              <p className="text-xs text-[#718096] font-medium">
                Paginación numerada (máximo 10 registros). Selección múltiple y exportación con filtros.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedLeadIds.length > 0 && (
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-xs animate-scaleUp"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar ({selectedLeadIds.length})</span>
              </button>
            )}

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              title="Exportar registros filtrados a formato Excel (.xlsx)"
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs active:scale-98 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel ({selectedLeadIds.length > 0 ? selectedLeadIds.length : filteredLeads.length})</span>
            </button>

            {/* Export PDF Button */}
            <button
              onClick={handleExportPDF}
              title="Exportar reporte de registros filtrados a PDF (.pdf)"
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs active:scale-98 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>PDF ({selectedLeadIds.length > 0 ? selectedLeadIds.length : filteredLeads.length})</span>
            </button>

            <button
              onClick={onOpenImport}
              className="px-3.5 py-2.5 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-xs active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Importar Excel</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className={`p-3.5 rounded-xl text-xs font-bold border flex items-center gap-2.5 animate-fadeIn ${
            feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <X className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* Intelligent Search & Multi-Filters Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#E2E8F0]">
          {/* Intelligent Search Input */}
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#718096]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Búsqueda Inteligente (DNI, Nombre, Tel...)"
              className="w-full pl-9 pr-3.5 py-2 text-xs font-medium rounded-xl border border-[#E2E8F0] bg-[#F3F7F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#40C4C0] text-[#2D3748]"
            />
          </div>

          {/* Campaign Filter */}
          <div>
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

          {/* Status Filter */}
          <div>
            <CustomSelect
              icon={Tag}
              variant="subtle"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los Estados</option>
              {(Object.keys(LEAD_STATUS_CONFIG) as (keyof typeof LEAD_STATUS_CONFIG)[]).map((st) => (
                <option key={st} value={st}>{LEAD_STATUS_CONFIG[st].label}</option>
              ))}
            </CustomSelect>
          </div>

          {/* Seller Filter */}
          <div>
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
          </div>
        </div>
      </div>

      {/* Dynamic Table Card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between text-xs text-[#718096] font-medium">
          <span>
            Mostrando <strong className="text-[#2D3748] font-bold">{filteredLeads.length > 0 ? startIndex + 1 : 0}</strong> a{' '}
            <strong className="text-[#2D3748] font-bold">{Math.min(startIndex + ITEMS_PER_PAGE, filteredLeads.length)}</strong> de{' '}
            <strong className="text-[#2D3748] font-bold">{filteredLeads.length}</strong> registros
          </span>

          <span className="bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30 px-3 py-1 rounded-full text-[11px] font-bold">
            Página {currentPage} de {totalPages}
          </span>
        </div>

        {/* Table element */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F3F7F7] text-[#718096] font-bold border-b border-[#E2E8F0]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedLeads.length > 0 && selectedLeadIds.length === paginatedLeads.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-[#40C4C0] focus:ring-[#40C4C0]"
                  />
                </th>
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3 min-w-[160px]">Nombre y Apellido</th>
                <th className="p-3 whitespace-nowrap">DNI</th>
                <th className="p-3 whitespace-nowrap min-w-[150px]">Teléfono</th>
                <th className="p-3 whitespace-nowrap min-w-[110px]">Últ. Período</th>
                <th className="p-3 min-w-[130px]">Campaña</th>
                <th className="p-3 min-w-[170px]">Estado (Editar)</th>
                <th className="p-3 min-w-[180px]">Vendedor Asignado</th>
                <th className="p-3 text-right whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-medium text-[#2D3748]">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-[#718096]">
                    No se encontraron registros que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead, index) => {
                  const globalNumber = startIndex + index + 1;
                  const statusConfig = LEAD_STATUS_CONFIG[lead.estado] || LEAD_STATUS_CONFIG.pendiente;
                  const isSelected = selectedLeadIds.includes(lead.id);

                  return (
                    <tr 
                      key={lead.id} 
                      className={`hover:bg-[#F0FDFD]/50 transition-colors ${isSelected ? 'bg-cyan-50/60' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectLead(lead.id)}
                          className="rounded border-slate-300 text-[#40C4C0] focus:ring-[#40C4C0]"
                        />
                      </td>

                      {/* # Number */}
                      <td className="p-3 text-center font-bold text-[#718096]">
                        {globalNumber}
                      </td>

                      {/* Name */}
                      <td className="p-3 font-bold text-[#2D3748]">
                        <button 
                          onClick={() => onSelectLead(lead)}
                          className="hover:text-[#40C4C0] hover:underline text-left"
                        >
                          {lead.nombre} {lead.apellido}
                        </button>
                      </td>

                      {/* DNI */}
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {lead.dni}
                      </td>

                      {/* Phone */}
                      <td className="p-3 font-mono whitespace-nowrap">
                        {(() => {
                          const phoneInfo = analyzePhoneWhatsApp(lead.telefono);
                          if (phoneInfo.isValidWhatsApp) {
                            return (
                              <div className="flex items-center gap-1.5 font-bold text-emerald-700 whitespace-nowrap">
                                <span>{phoneInfo.displayFormatted}</span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-md border border-emerald-300 whitespace-nowrap">
                                  <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>WA</span>
                                </span>
                              </div>
                            );
                          } else if (phoneInfo.statusLabel === 'Fijo (Sin WA)') {
                            return (
                              <div className="flex items-center gap-1.5 text-slate-600 whitespace-nowrap">
                                <span>{phoneInfo.displayFormatted}</span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md border border-amber-300 whitespace-nowrap">
                                  <Phone className="w-3 h-3 text-amber-700 shrink-0" />
                                  <span>Fijo</span>
                                </span>
                              </div>
                            );
                          } else {
                            return <span className="text-slate-400 italic text-[11px] whitespace-nowrap">{lead.telefono || 'Sin número'}</span>;
                          }
                        })()}
                      </td>

                      {/* Period */}
                      <td className="p-3 font-bold whitespace-nowrap">
                        <span className="inline-block whitespace-nowrap bg-[#F0FDFD] text-[#00807D] border border-[#40C4C0]/40 px-2.5 py-1 rounded-md text-[11px] font-mono font-extrabold shadow-2xs">
                          {formatPeriodMMYYYY(lead.ultimoPeriodoPagado)}
                        </span>
                      </td>

                      {/* Campaign */}
                      <td className="p-3 text-[#718096] truncate max-w-[130px]">
                        {lead.campanaNombre}
                      </td>

                      {/* EDITABLE ESTADO DROPDOWN */}
                      <td className="p-3">
                        <CustomSelect
                          variant="table"
                          value={lead.estado}
                          onChange={(e) => handleStatusChange(lead, e.target.value as Lead['estado'])}
                          className={statusConfig.badgeBg}
                        >
                          {(Object.keys(LEAD_STATUS_CONFIG) as (keyof typeof LEAD_STATUS_CONFIG)[]).map((st) => (
                            <option key={st} value={st} className="bg-white text-slate-800 font-medium">
                              {LEAD_STATUS_CONFIG[st].label}
                            </option>
                          ))}
                        </CustomSelect>
                      </td>

                      {/* EDITABLE VENDEDOR DROPDOWN */}
                      <td className="p-3">
                        <CustomSelect
                          variant={lead.vendedorId ? "table" : "amber"}
                          value={lead.vendedorId || 'unassigned'}
                          onChange={(e) => handleSellerChange(lead.id, e.target.value)}
                        >
                          <option value="unassigned">⚠️ Pool (Sin Asignar)</option>
                          {activeSellers.map((s) => (
                            <option key={s.id} value={s.id}>
                              👤 {s.name}
                            </option>
                          ))}
                        </CustomSelect>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* WhatsApp Direct */}
                          <button
                            onClick={(e) => handleWhatsAppClick(e, lead)}
                            className="p-1.5 rounded-lg bg-[#25D366] text-white hover:bg-[#20ba5a] transition-colors shadow-2xs"
                            title="Contactar por WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>

                          {/* View Detail */}
                          <button
                            onClick={() => onSelectLead(lead)}
                            className="p-1.5 rounded-lg bg-[#F3F7F7] text-[#718096] hover:bg-gray-200 border border-[#E2E8F0] transition-colors"
                            title="Ver Detalle / Historial"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Trash Delete Lead */}
                          <button
                            onClick={() => setLeadToDelete(lead)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors active:scale-95"
                            title="Eliminar Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#E2E8F0] bg-[#F3F7F7]/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#718096] font-medium">
              Página <strong className="text-[#2D3748] font-bold">{currentPage}</strong> de {totalPages}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white text-xs font-bold text-[#718096] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      currentPage === page
                        ? 'bg-[#40C4C0] text-white shadow-xs'
                        : 'bg-white text-[#718096] border border-[#E2E8F0] hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white text-xs font-bold text-[#718096] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Single Lead Confirm Modal */}
      <ConfirmModal
        isOpen={!!leadToDelete}
        title="Eliminar Lead"
        message="¿Estás seguro de eliminar el siguiente cliente potencial? Se borrará de la base de datos de Firestore."
        itemName={leadToDelete ? `${leadToDelete.nombre} ${leadToDelete.apellido} (DNI: ${leadToDelete.dni})` : undefined}
        confirmText="Sí, Eliminar Lead"
        isLoading={isDeleting}
        onConfirm={handleConfirmDeleteSingle}
        onClose={() => setLeadToDelete(null)}
      />

      {/* Delete Bulk Leads Confirm Modal */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        title="Eliminar Lote de Leads"
        message={`¿Estás seguro de eliminar definitivamente los ${selectedLeadIds.length} leads seleccionados?`}
        confirmText={`Sí, Eliminar ${selectedLeadIds.length} Registros`}
        isLoading={isDeleting}
        onConfirm={handleConfirmDeleteBulk}
        onClose={() => setIsBulkDeleteModalOpen(false)}
      />
    </div>
  );
};
