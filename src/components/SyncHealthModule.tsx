import React, { useState } from 'react';
import { crmStore } from '../services/crmStore';
import { SyncHealthState, SyncLog } from '../types/crm';
import { 
  Activity, CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw, 
  Send, Trash2, Download, ExternalLink, Database, FileSpreadsheet, 
  HardDrive, Wifi, ShieldCheck, Clock, Search, Filter, ChevronDown, ChevronUp
} from 'lucide-react';

interface SyncHealthModuleProps {
  onOpenSheetsSettings?: () => void;
}

export const SyncHealthModule: React.FC<SyncHealthModuleProps> = ({ onOpenSheetsSettings }) => {
  const syncHealth: SyncHealthState = crmStore.getSyncHealthState();
  const [activeFilter, setActiveFilter] = useState<'all' | 'error' | 'sheets_webhook' | 'firestore'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPinging, setIsPinging] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string; details?: string } | null>(null);

  const handlePing = async () => {
    setIsPinging(true);
    setFeedback(null);
    try {
      const res = await crmStore.pingSheetsWebhook();
      setFeedback({
        type: res.success ? 'success' : 'error',
        msg: res.message,
        details: res.details
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        msg: 'Error al enviar prueba de ping',
        details: String(err?.message || err)
      });
    } finally {
      setIsPinging(false);
    }
  };

  const handleForceSync = async () => {
    setIsSyncingAll(true);
    setFeedback(null);
    try {
      const res = await crmStore.syncAllToFirestoreAndSheets();
      setFeedback({
        type: 'success',
        msg: `¡Sincronización Total Completada!`,
        details: `Se re-sincronizaron ${res.countLeads} leads con Firestore y Google Sheets.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        msg: 'Fallo al ejecutar sincronización completa',
        details: String(err?.message || err)
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleClearLogs = () => {
    if (confirm('¿Deseas limpiar el registro histórico de logs de sincronización?')) {
      crmStore.clearSyncLogs();
      setFeedback({
        type: 'info',
        msg: 'Historial de registros limpiado.'
      });
    }
  };

  const handleExportDiagnosis = () => {
    const report = {
      app: 'Arévalo Servicios Sociales CRM',
      generatedAt: new Date().toISOString(),
      syncHealth: crmStore.getSyncHealthState(),
      webhookUrl: crmStore.getSheetsWebhookUrl(),
      browserInfo: navigator.userAgent
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arevalo_sync_health_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = syncHealth.recentLogs.filter(log => {
    if (activeFilter === 'error' && log.status !== 'error') return false;
    if (activeFilter === 'sheets_webhook' && log.type !== 'sheets_webhook') return false;
    if (activeFilter === 'firestore' && log.type !== 'firestore') return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(term);
      const matchDetails = log.details?.toLowerCase().includes(term);
      const matchLead = log.leadName?.toLowerCase().includes(term);
      return matchMsg || matchDetails || matchLead;
    }

    return true;
  });

  const errorLogsCount = syncHealth.recentLogs.filter(l => l.status === 'error').length;

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return 'Sin registros';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6 animate-fadeIn">
      {/* Header Panel */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-[#F0FDFD] text-[#40C4C0] rounded-xl border border-[#40C4C0]/20">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Panel de Salud de Sincronización (Sync Health)
              </h2>
              <p className="text-xs text-slate-500">
                Monitoreo en tiempo real, diagnósticos y logs de errores entre la App, Firestore y Google Sheets
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handlePing}
            disabled={isPinging || !syncHealth.webhookConfigured}
            className="flex-1 md:flex-initial px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <Send className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Probando...' : 'Probar Webhook (Ping)'}</span>
          </button>

          <button
            onClick={handleForceSync}
            disabled={isSyncingAll}
            className="flex-1 md:flex-initial px-3.5 py-2.5 bg-[#2D3748] hover:bg-[#1A202C] disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>{isSyncingAll ? 'Sincronizando...' : 'Sincronizar Todo'}</span>
          </button>

          <button
            onClick={handleExportDiagnosis}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            title="Exportar informe de diagnóstico en JSON"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Informe</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1 transition-all ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : feedback.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-cyan-50 border-cyan-200 text-cyan-800'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {feedback.type === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            {feedback.type === 'info' && <Info className="w-4 h-4 text-cyan-600 shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
          {feedback.details && (
            <p className="pl-6 font-mono text-[11px] opacity-90 break-all">{feedback.details}</p>
          )}
        </div>
      )}

      {/* 3 Component Status KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Firestore Live Stream */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Firestore Database
                </h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 ${
                syncHealth.isFirestoreConnected
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-100 text-rose-700 border border-rose-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${syncHealth.isFirestoreConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                {syncHealth.isFirestoreConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Última Escucha Remote:</span>
                <span className="font-bold text-slate-800">{formatDate(syncHealth.lastFirestoreSync)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Colección Leads:</span>
                <span className="font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  {syncHealth.totalLeadsInRemote} items
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Reglas de seguridad y snapshot activas</span>
          </div>
        </div>

        {/* Card 2: Google Sheets Webhook */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Google Sheets Webhook
                </h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
                !syncHealth.webhookConfigured
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : syncHealth.lastWebhookStatus === 'error'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {!syncHealth.webhookConfigured 
                  ? 'Sin URL' 
                  : syncHealth.lastWebhookStatus === 'syncing' 
                  ? 'Enviando...' 
                  : syncHealth.lastWebhookStatus === 'error'
                  ? 'Error'
                  : 'Activo'}
              </span>
            </div>

            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Último Disparo:</span>
                <span className="font-bold text-slate-800">{formatDate(syncHealth.lastWebhookSync)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Endpoint Configurado:</span>
                <span className="font-mono text-[10px] text-slate-700 truncate max-w-[140px]" title={syncHealth.webhookUrl}>
                  {syncHealth.webhookConfigured ? `${syncHealth.webhookUrl.substring(0, 20)}...` : 'Ninguno'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Google Apps Script API</span>
            {onOpenSheetsSettings && (
              <button 
                onClick={onOpenSheetsSettings}
                className="text-[#40C4C0] hover:underline font-bold flex items-center gap-1"
              >
                <span>Configurar</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Local Cache & State */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-purple-600" />
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Caché Local Navegador
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-purple-100 text-purple-800 border border-purple-200">
                Sincronizado
              </span>
            </div>

            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Leads Almacenados:</span>
                <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                  {syncHealth.totalLeadsInLocal} registros
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Logs Registrados:</span>
                <span className="font-bold text-slate-800">{syncHealth.recentLogs.length} eventos</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-purple-600" />
            <span>Persistencia ante desconexiones activada</span>
          </div>
        </div>
      </div>

      {/* Logs Section & Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-700 shrink-0" />
            <h3 className="text-sm font-extrabold text-slate-800">
              Registro de Auditoría de Sincronización en Tiempo Real
            </h3>
            {errorLogsCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold rounded-full text-[10px]">
                {errorLogsCount} errores
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar en logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#40C4C0]"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  activeFilter === 'all' ? 'bg-[#2D3748] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveFilter('error')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  activeFilter === 'error' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Errores
              </button>
              <button
                onClick={() => setActiveFilter('sheets_webhook')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  activeFilter === 'sheets_webhook' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Sheets
              </button>
              <button
                onClick={() => setActiveFilter('firestore')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  activeFilter === 'firestore' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Firestore
              </button>
            </div>

            <button
              onClick={handleClearLogs}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              title="Limpiar logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Log Stream List */}
        <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-40" />
              <p className="text-xs font-bold">No hay logs en esta categoría.</p>
              <p className="text-[11px] text-slate-400">Todos los eventos y sincronizaciones quedarán grabados aquí automáticamente.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;

              return (
                <div 
                  key={log.id} 
                  className={`p-3.5 sm:p-4 text-xs transition-colors hover:bg-slate-50/80 ${
                    log.status === 'error' ? 'bg-rose-50/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Icon Status */}
                      <div className="mt-0.5 shrink-0">
                        {log.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {log.status === 'error' && <XCircle className="w-4 h-4 text-rose-600" />}
                        {log.status === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        {log.status === 'info' && <Info className="w-4 h-4 text-cyan-600" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {/* Type Badge */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                            log.type === 'sheets_webhook'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.type === 'firestore'
                              ? 'bg-blue-100 text-blue-800'
                              : log.type === 'manual_sync'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {log.type === 'sheets_webhook' ? 'Google Sheets' : log.type === 'firestore' ? 'Firestore' : log.type === 'manual_sync' ? 'Manual' : 'Caché'}
                          </span>

                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatDate(log.timestamp)}
                          </span>

                          {log.leadName && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold truncate max-w-[150px]">
                              Lead: {log.leadName}
                            </span>
                          )}
                        </div>

                        <p className="font-bold text-slate-800 leading-snug">
                          {log.message}
                        </p>

                        {/* Expandable Trace Details */}
                        {log.details && isExpanded && (
                          <div className="mt-2.5 p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-xl overflow-x-auto leading-relaxed border border-slate-700">
                            {log.details}
                          </div>
                        )}
                      </div>
                    </div>

                    {log.details && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg shrink-0 mt-0.5"
                        title={isExpanded ? 'Ocultar detalles' : 'Ver detalles técnicos'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Debugging & Troubleshooting Guide */}
      <div className="bg-slate-900 text-slate-200 p-5 sm:p-6 rounded-3xl space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#40C4C0]" />
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Guía de Solución de Inconsistencias & Depuración
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-300 pt-1">
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-emerald-400 block">1. ¿Por qué aparece 'POST no-cors' en los logs?</span>
            <p>Google Apps Script no devuelve encabezados CORS estándar por seguridad. La app utiliza el modo <code>no-cors</code>, garantizando que el paquete de actualización llegue a tu hoja de cálculo sin interrupciones del navegador.</p>
          </div>
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-blue-400 block">2. Inconsistencia al editar en Google Sheets</span>
            <p>Asegúrate de haber activado el evento <code>onEdit</code> en la pestaña Activadores de Google Apps Script. Cada edición de una celda enviará un PATCH directo a Firestore para actualizar el CRM en vivo.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
