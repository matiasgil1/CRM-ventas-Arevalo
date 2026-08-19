import React, { useState, useMemo } from 'react';
import { User, AuditLog, AuditCategory, SUPER_ADMIN_EMAIL } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { ConfirmModal } from './ConfirmModal';
import { 
  Shield, History, Search, Download, Trash2, Filter,
  Calendar, UserCheck, LogIn, FileText, Layers, Megaphone,
  Database, AlertCircle, ChevronDown, ChevronRight, RefreshCw,
  Clock, CheckCircle2, XCircle, ArrowUpDown, Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AuditModuleProps {
  currentUser: User;
  auditLogs: AuditLog[];
  users: User[];
}

export const AuditModule: React.FC<AuditModuleProps> = ({
  currentUser,
  auditLogs,
  users
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory | 'all'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Clear Confirmation Modal State
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const isSuperAdmin = currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Filtered logs calculation
  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    return auditLogs.filter(log => {
      // Category filter
      if (selectedCategory !== 'all' && log.category !== selectedCategory) {
        return false;
      }

      // User filter
      if (selectedUserId !== 'all' && log.userId !== selectedUserId && log.userEmail !== selectedUserId) {
        return false;
      }

      // Date filter
      if (dateFilter !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        const diffDays = (now - logTime) / oneDay;
        if (dateFilter === 'today' && diffDays > 1) return false;
        if (dateFilter === '7days' && diffDays > 7) return false;
        if (dateFilter === '30days' && diffDays > 30) return false;
      }

      // Text search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchUser = log.userName.toLowerCase().includes(query) || log.userEmail.toLowerCase().includes(query);
        const matchAction = log.action.toLowerCase().includes(query);
        const matchDesc = log.description.toLowerCase().includes(query);
        const matchDetails = log.details ? log.details.toLowerCase().includes(query) : false;
        if (!matchUser && !matchAction && !matchDesc && !matchDetails) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, selectedCategory, selectedUserId, dateFilter, search]);

  // Metric stats
  const stats = useMemo(() => {
    const total = auditLogs.length;
    const authCount = auditLogs.filter(l => l.category === 'auth').length;
    const leadsCount = auditLogs.filter(l => l.category === 'leads' || l.category === 'pool').length;
    const usersCount = auditLogs.filter(l => l.category === 'users').length;
    return { total, authCount, leadsCount, usersCount };
  }, [auditLogs]);

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredLogs.map((log, idx) => ({
        '#': idx + 1,
        'Fecha y Hora': new Date(log.timestamp).toLocaleString('es-AR'),
        'Usuario': log.userName,
        'Email': log.userEmail,
        'Rol': log.userRole,
        'Categoría': getCategoryLabel(log.category),
        'Acción': log.action,
        'Descripción del Evento': log.description,
        'Detalles Adicionales': log.details || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria');
      XLSX.writeFile(workbook, `Auditoria_Arevalo_CRM_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showFeedback('success', 'Reporte de auditoría exportado a Excel exitosamente.');
    } catch (e: any) {
      showFeedback('error', 'Error al exportar a Excel: ' + e?.message);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16);
      doc.text('Arévalo Servicios Sociales - Registro Oficial de Auditoría', 14, 15);
      doc.setFontSize(9);
      doc.text(`Generado: ${new Date().toLocaleString('es-AR')} | Registros exportados: ${filteredLogs.length}`, 14, 22);

      const tableRows = filteredLogs.map((log) => [
        new Date(log.timestamp).toLocaleString('es-AR'),
        `${log.userName}\n(${log.userEmail})`,
        getCategoryLabel(log.category),
        log.action,
        log.description
      ]);

      autoTable(doc, {
        head: [['Fecha / Hora', 'Usuario Responsable', 'Categoría', 'Acción', 'Descripción del Evento']],
        body: tableRows,
        startY: 28,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [45, 55, 72], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      doc.save(`Auditoria_Arevalo_CRM_${new Date().toISOString().slice(0, 10)}.pdf`);
      showFeedback('success', 'Reporte de auditoría exportado a PDF exitosamente.');
    } catch (e: any) {
      showFeedback('error', 'Error al exportar a PDF: ' + e?.message);
    }
  };

  // Clear Logs
  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      await crmStore.clearAuditLogs();
      showFeedback('success', 'El registro de auditoría fue purgado exitosamente.');
      setIsClearModalOpen(false);
    } catch (e: any) {
      showFeedback('error', 'Error al purgar la auditoría: ' + e?.message);
    } finally {
      setIsClearing(false);
    }
  };

  function getCategoryLabel(cat: AuditCategory): string {
    switch (cat) {
      case 'auth': return 'Accesos / Login';
      case 'leads': return 'Leads & Clientes';
      case 'pool': return 'Pool General';
      case 'campaigns': return 'Campañas';
      case 'users': return 'Usuarios & Permisos';
      case 'export': return 'Exportaciones';
      case 'system': return 'Sistema';
      default: return 'General';
    }
  }

  function getCategoryBadge(cat: AuditCategory) {
    switch (cat) {
      case 'auth':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: LogIn,
          label: 'Acceso'
        };
      case 'leads':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: FileText,
          label: 'Leads'
        };
      case 'pool':
        return {
          bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          icon: Layers,
          label: 'Pool'
        };
      case 'campaigns':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: Megaphone,
          label: 'Campaña'
        };
      case 'users':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: UserCheck,
          label: 'Usuarios'
        };
      case 'system':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: Database,
          label: 'Sistema'
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          icon: History,
          label: 'General'
        };
    }
  }

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      {/* Top Title & Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-tr from-[#2D3748] to-slate-900 text-white rounded-xl shadow-xs">
            <Shield className="w-6 h-6 text-[#40C4C0]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#2D3748] tracking-tight">
                Módulo de Auditoría y Registro de Actividad
              </h1>
              <span className="px-2 py-0.5 bg-[#40C4C0] text-white text-[10px] font-black rounded-md shadow-2xs">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-[#718096] font-medium">
              Trazabilidad en tiempo real de todos los inicios de sesión, asignaciones de vendedores, cambios en leads y acciones de usuarios.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
            title="Exportar a Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
            title="Exportar a PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              title="Limpiar Registro de Auditoría"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center gap-2.5 animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 text-slate-800 rounded-xl">
            <History className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total de Eventos</p>
            <p className="text-xl font-extrabold text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <LogIn className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Inicios de Sesión</p>
            <p className="text-xl font-extrabold text-indigo-900">{stats.authCount}</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Acciones en Leads</p>
            <p className="text-xl font-extrabold text-emerald-900">{stats.leadsCount}</p>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
            <UserCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Permisos & Vendedores</p>
            <p className="text-xl font-extrabold text-amber-900">{stats.usersCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        {/* Category Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-[#2D3748] text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Todas las Categorías ({auditLogs.length})
          </button>
          <button
            onClick={() => setSelectedCategory('auth')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'auth'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-indigo-800 bg-indigo-50 hover:bg-indigo-100'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Accesos ({auditLogs.filter(l => l.category === 'auth').length})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('leads')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'leads'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Leads ({auditLogs.filter(l => l.category === 'leads').length})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('pool')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'pool'
                ? 'bg-cyan-600 text-white shadow-2xs'
                : 'text-cyan-800 bg-cyan-50 hover:bg-cyan-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pool ({auditLogs.filter(l => l.category === 'pool').length})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('users')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'users'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Usuarios & Vendedores ({auditLogs.filter(l => l.category === 'users').length})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('campaigns')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'campaigns'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-purple-800 bg-purple-50 hover:bg-purple-100'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Campañas ({auditLogs.filter(l => l.category === 'campaigns').length})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('system')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'system'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'text-slate-800 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Sistema ({auditLogs.filter(l => l.category === 'system').length})</span>
          </button>
        </div>

        {/* Search, User Filter and Date Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por usuario, acción o detalle..."
              className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#40C4C0] text-slate-800"
            />
          </div>

          {/* User Selector Filter */}
          <div>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full p-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#40C4C0]"
            >
              <option value="all">👥 Todos los Usuarios ({users.length})</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full p-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#40C4C0]"
            >
              <option value="all">📅 Todo el Período</option>
              <option value="today">📅 Solo Hoy (Últimas 24h)</option>
              <option value="7days">📅 Últimos 7 Días</option>
              <option value="30days">📅 Últimos 30 Días</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#40C4C0]" />
            <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Registros Encontrados ({filteredLogs.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Orden cronológico descendente (más recientes primero)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F3F7F7] text-[#2D3748] font-bold">
              <tr>
                <th className="p-3.5 border-b border-[#E2E8F0]">Fecha / Hora</th>
                <th className="p-3.5 border-b border-[#E2E8F0]">Usuario Responsable</th>
                <th className="p-3.5 border-b border-[#E2E8F0]">Categoría & Acción</th>
                <th className="p-3.5 border-b border-[#E2E8F0]">Descripción del Evento</th>
                <th className="p-3.5 border-b border-[#E2E8F0] text-right">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400 font-medium text-xs">
                    No se encontraron eventos de auditoría para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const badge = getCategoryBadge(log.category);
                  const Icon = badge.icon;
                  const isExpanded = expandedLogId === log.id;
                  const dateObj = new Date(log.timestamp);
                  const isSuper = log.userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

                  return (
                    <React.Fragment key={log.id}>
                      <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50/80' : ''}`}>
                        {/* Timestamp */}
                        <td className="p-3.5 whitespace-nowrap text-slate-700">
                          <div className="font-mono font-bold text-slate-900">
                            {dateObj.toLocaleDateString('es-AR')}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{dateObj.toLocaleTimeString('es-AR')}</span>
                          </div>
                        </td>

                        {/* User Identity */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSuper ? 'bg-[#40C4C0] text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {log.userName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 flex items-center gap-1 truncate">
                                <span>{log.userName}</span>
                                {isSuper && (
                                  <span className="px-1 py-0.1 bg-[#40C4C0] text-white text-[8px] font-black rounded">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">{log.userEmail}</div>
                            </div>
                          </div>
                        </td>

                        {/* Category & Action Code */}
                        <td className="p-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                              <Icon className="w-3 h-3" />
                              <span>{badge.label}</span>
                            </span>
                            <span className="text-[10px] font-mono font-extrabold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {log.action}
                            </span>
                          </div>
                        </td>

                        {/* Narrative Description */}
                        <td className="p-3.5 text-slate-800 font-medium max-w-md">
                          <p className="line-clamp-2 leading-relaxed">{log.description}</p>
                        </td>

                        {/* Expandable Details Button */}
                        <td className="p-3.5 text-right whitespace-nowrap">
                          {log.details ? (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                              title="Ver información detallada"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{isExpanded ? 'Ocultar' : 'Ver'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">-</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable JSON / Details View */}
                      {isExpanded && log.details && (
                        <tr className="bg-slate-900 text-slate-200 text-xs animate-fadeIn">
                          <td colSpan={5} className="p-4 border-t border-slate-800">
                            <div className="space-y-1.5">
                              <p className="font-bold text-[11px] text-[#40C4C0] uppercase tracking-wider">
                                Metadatos del Evento ({log.action})
                              </p>
                              <pre className="p-3 bg-slate-950 rounded-xl font-mono text-[11px] text-emerald-400 overflow-x-auto border border-slate-800 whitespace-pre-wrap">
                                {(() => {
                                  try {
                                    return JSON.stringify(JSON.parse(log.details), null, 2);
                                  } catch (e) {
                                    return log.details;
                                  }
                                })()}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        title="Purgar Historial de Auditoría"
        message="¿Estás seguro de que deseas vaciar el historial de auditoría? Todos los registros históricos de inicios de sesión y acciones se eliminarán definitivamente de Firestore."
        confirmText="Sí, Purgar Auditoría"
        isLoading={isClearing}
        onConfirm={handleConfirmClear}
        onClose={() => setIsClearModalOpen(false)}
      />
    </div>
  );
};
