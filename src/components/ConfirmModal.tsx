import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  itemName,
  confirmText = 'Sí, Eliminar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onClose
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      bgIcon: 'bg-rose-100 text-rose-600 border-rose-200',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
      borderHeader: 'border-rose-100'
    },
    warning: {
      bgIcon: 'bg-amber-100 text-amber-600 border-amber-200',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs',
      borderHeader: 'border-amber-100'
    },
    info: {
      bgIcon: 'bg-cyan-100 text-[#40C4C0] border-cyan-200',
      btn: 'bg-[#40C4C0] hover:bg-[#32b2ae] text-white shadow-xs',
      borderHeader: 'border-cyan-100'
    }
  }[variant];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform transition-all animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 flex items-start justify-between border-b ${variantStyles.borderHeader}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${variantStyles.bgIcon}`}>
              {variant === 'danger' ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#2D3748] tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-[#718096] font-medium mt-0.5">
                Confirmación requerida
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-3">
          <p className="text-xs text-[#2D3748] font-medium leading-relaxed">
            {message}
          </p>

          {itemName && (
            <div className="p-3 bg-[#F3F7F7] border border-[#E2E8F0] rounded-xl text-xs font-bold font-mono text-[#2D3748] break-all">
              {itemName}
            </div>
          )}

          {variant === 'danger' && (
            <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1.5">
              <span>⚠️ Esta acción es irreversible y eliminará el registro de Firestore.</span>
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-98 disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2.5 font-bold rounded-xl text-xs flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50 ${variantStyles.btn}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                {variant === 'danger' && <Trash2 className="w-4 h-4" />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
