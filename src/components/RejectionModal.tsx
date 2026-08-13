import React, { useState } from 'react';
import { MOTIVOS_CAIDA_PRESET } from '../types/crm';
import { CustomSelect } from './CustomSelect';
import { AlertTriangle, X, Save, Loader2, Tag } from 'lucide-react';

interface RejectionModalProps {
  isOpen: boolean;
  leadName: string;
  onClose: () => void;
  onConfirm: (motivoCaida: string, observacionRechazo: string) => void | Promise<void>;
}

export const RejectionModal: React.FC<RejectionModalProps> = ({
  isOpen,
  leadName,
  onClose,
  onConfirm
}) => {
  const [motivo, setMotivo] = useState(MOTIVOS_CAIDA_PRESET[0]);
  const [observacion, setObservacion] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observacion || observacion.trim().length < 3) {
      setErrorMsg('REGLA OBLIGATORIA: Debe ingresar una observación detallada del rechazo (mínimo 3 caracteres).');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(motivo, observacion.trim());
      setObservacion('');
      setErrorMsg('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500 text-white rounded-2xl shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-rose-950">
                Observación Obligatoria de Caída
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                Cliente: <span className="font-bold">{leadName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-rose-400 hover:text-rose-700 rounded-xl hover:bg-rose-100/50 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900 font-medium">
            ⚠️ <span className="font-bold">Regla de Negocio:</span> Para trazabilidad y auditoría, la empresa exige registrar el motivo real del rechazo antes de dar por caído este lead.
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Categoría del Motivo de Caída
            </label>
            <CustomSelect
              icon={Tag}
              variant="subtle"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              {MOTIVOS_CAIDA_PRESET.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </CustomSelect>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observación del Rechazo (Obligatorio) <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={observacion}
              onChange={(e) => {
                setObservacion(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              rows={3}
              placeholder="Ej: El socio indica que ya contrató cobertura con otra entidad o que la cuota actual supera su presupuesto..."
              className="w-full p-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Ingresa al menos 3 caracteres describiendo la respuesta del cliente.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!observacion.trim() || isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando en Firestore...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Estado Caído</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
