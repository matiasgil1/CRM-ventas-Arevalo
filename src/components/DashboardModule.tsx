import React, { useState } from 'react';
import { Lead, Campaign, User, LEAD_STATUS_CONFIG, MOTIVOS_CAIDA_PRESET } from '../types/crm';
import { CustomSelect } from './CustomSelect';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import { 
  BarChart3, TrendingUp, Users, CheckCircle2, XCircle, 
  Download, Filter, Award, Target, FileSpreadsheet, Percent 
} from 'lucide-react';

interface DashboardModuleProps {
  leads: Lead[];
  users: User[];
  campaigns: Campaign[];
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  leads,
  users,
  campaigns
}) => {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');

  // Filter leads by campaign
  const filteredLeads = leads.filter(l => 
    selectedCampaign === 'all' ? true : l.campanaId === selectedCampaign
  );

  const totalLeads = filteredLeads.length;
  const cerradosCount = filteredLeads.filter(l => l.estado === 'cerrado').length;
  const caidosCount = filteredLeads.filter(l => l.estado === 'caido').length;
  const enGestionCount = filteredLeads.filter(l => ['contactado', 'gestion_ventas', 'sin_respuesta'].includes(l.estado)).length;
  const pendientesCount = filteredLeads.filter(l => l.estado === 'pendiente').length;

  const conversionRate = totalLeads > 0 ? ((cerradosCount / totalLeads) * 100).toFixed(1) : '0.0';

  // Leads per status chart data
  const statusChartData = (Object.keys(LEAD_STATUS_CONFIG) as (keyof typeof LEAD_STATUS_CONFIG)[]).map(st => {
    const config = LEAD_STATUS_CONFIG[st];
    const count = filteredLeads.filter(l => l.estado === st).length;
    return {
      name: config.label,
      cant: count,
      color: config.color
    };
  });

  // Seller Efficiency Metrics
  const sellers = users.filter(u => u.role === 'vendedor' || u.role === 'admin');
  const sellerStats = sellers.map(seller => {
    const sellerLeads = filteredLeads.filter(l => l.vendedorId === seller.id);
    const total = sellerLeads.length;
    const cerrados = sellerLeads.filter(l => l.estado === 'cerrado').length;
    const caidos = sellerLeads.filter(l => l.estado === 'caido').length;
    const enGestion = sellerLeads.filter(l => ['contactado', 'gestion_ventas', 'sin_respuesta'].includes(l.estado)).length;
    const rate = total > 0 ? ((cerrados / total) * 100).toFixed(1) : '0.0';

    return {
      id: seller.id,
      nombre: seller.name,
      total,
      cerrados,
      caidos,
      enGestion,
      rate: parseFloat(rate)
    };
  }).sort((a, b) => b.cerrados - a.cerrados);

  // Rejection reasons breakdown
  const rejectionReasonsMap: Record<string, number> = {};
  filteredLeads.filter(l => l.estado === 'caido').forEach(l => {
    const reason = l.motivoCaida || 'Otro motivo';
    rejectionReasonsMap[reason] = (rejectionReasonsMap[reason] || 0) + 1;
  });

  const COLORS_PALETTE = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#64748B'];

  const rejectionChartData = Object.keys(rejectionReasonsMap).map((reason, idx) => ({
    name: reason,
    value: rejectionReasonsMap[reason],
    color: COLORS_PALETTE[idx % COLORS_PALETTE.length]
  }));

  // Export full Leads Report
  const handleExportLeads = () => {
    const exportRows = filteredLeads.map(l => ({
      ID: l.id,
      Nombre: l.nombre,
      Apellido: l.apellido,
      DNI: l.dni,
      Telefono: l.telefono,
      UltimoPeriodoPagado: l.ultimoPeriodoPagado,
      Campana: l.campanaNombre,
      Estado: LEAD_STATUS_CONFIG[l.estado]?.label || l.estado,
      VendedorAsignado: l.vendedorNombre || 'Sin Asignar (Pool)',
      MotivoCaida: l.motivoCaida || '',
      ObservacionRechazo: l.observacionRechazo || '',
      FechaCreacion: new Date(l.creadoEn).toLocaleDateString('es-AR'),
      UltimoContacto: l.ultimoContacto ? new Date(l.ultimoContacto).toLocaleDateString('es-AR') : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_CRM_Arevalo');
    XLSX.writeFile(workbook, `Reporte_CRM_Arevalo_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export Seller Audit Log
  const handleExportSellerAudit = () => {
    const auditRows = sellerStats.map(s => ({
      Vendedor: s.nombre,
      TotalLeadsAsignados: s.total,
      VentasCerradas: s.cerrados,
      LeadsCaidos: s.caidos,
      EnGestionActiva: s.enGestion,
      TasaConversionPorcentaje: `${s.rate}%`
    }));

    const worksheet = XLSX.utils.json_to_sheet(auditRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria_Vendedores');
    XLSX.writeFile(workbook, `Auditoria_Vendedores_Arevalo_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      {/* Title & Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#40C4C0] text-white rounded-xl shadow-xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2D3748] tracking-tight">
              Dashboard de Métricas y KPIs
            </h1>
            <p className="text-xs text-[#718096] font-medium">
              Análisis de conversión, efectividad por vendedor y causas de rechazo.
            </p>
          </div>
        </div>

        {/* Campaign Filter & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <CustomSelect
            icon={Filter}
            variant="subtle"
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            containerClassName="min-w-[200px]"
          >
            <option value="all">Todas las Campañas</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </CustomSelect>

          <button
            onClick={handleExportLeads}
            className="px-3.5 py-2 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#718096]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tasa de Conversión</span>
            <Percent className="w-4 h-4 text-[#40C4C0]" />
          </div>
          <p className="text-2xl font-bold text-[#40C4C0]">{conversionRate}%</p>
          <p className="text-[10px] text-[#718096] font-medium">{cerradosCount} ventas de {totalLeads} leads</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#718096]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Ventas Cerradas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-[#2D3748]">{cerradosCount}</p>
          <p className="text-[10px] text-emerald-700 font-bold">Objetivo en progreso</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#718096]">
            <span className="text-[10px] font-bold uppercase tracking-wider">En Gestión Activa</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{enGestionCount}</p>
          <p className="text-[10px] text-[#718096] font-medium">Contactados / Propuestas</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#718096]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Clientes Caídos</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600">{caidosCount}</p>
          <p className="text-[10px] text-[#718096] font-medium">Con motivo registrado</p>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Pipeline Bar Chart */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#2BB6B1]" />
            <span>Distribución de Leads por Estado</span>
          </h3>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', color: '#fff', fontSize: '12px' }} 
                />
                <Bar dataKey="cant" radius={[8, 8, 0, 0]}>
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Drop-off Reasons Pie Chart */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-500" />
            <span>Motivos Principales de Clientes Caídos</span>
          </h3>

          {rejectionChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No hay rechazos registrados en la campaña seleccionada
            </div>
          ) : (
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rejectionChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rejectionChartData.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

      {/* Seller Efficiency Table Module */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900">
              Eficiencia Detallada por Vendedor
            </h3>
          </div>

          <button
            onClick={handleExportSellerAudit}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            <span>Exportar Auditoría de Vendedores</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="p-3 border-b border-slate-200">Vendedor</th>
                <th className="p-3 border-b border-slate-200 text-center">Leads Asignados</th>
                <th className="p-3 border-b border-slate-200 text-center">En Gestión</th>
                <th className="p-3 border-b border-slate-200 text-center">Ventas (Cerrados)</th>
                <th className="p-3 border-b border-slate-200 text-center">Caídos</th>
                <th className="p-3 border-b border-slate-200 text-right">Tasa de Conversión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sellerStats.map((seller, idx) => (
                <tr key={seller.id} className="hover:bg-slate-50">
                  <td className="p-3 font-extrabold text-slate-900 flex items-center gap-2">
                    {idx === 0 && <span className="text-amber-500">🏆</span>}
                    <span>{seller.nombre}</span>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-700">{seller.total}</td>
                  <td className="p-3 text-center font-bold text-blue-600">{seller.enGestion}</td>
                  <td className="p-3 text-center font-extrabold text-emerald-600">{seller.cerrados}</td>
                  <td className="p-3 text-center font-bold text-rose-600">{seller.caidos}</td>
                  <td className="p-3 text-right font-black text-slate-900">
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                      {seller.rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
