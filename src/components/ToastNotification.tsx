import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  title?: string;
  message: string;
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (toast.type !== 'loading') {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  const styles = {
    success: {
      bg: 'bg-emerald-900/95 text-white border-emerald-700/60 shadow-lg shadow-emerald-900/20',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
    },
    error: {
      bg: 'bg-rose-900/95 text-white border-rose-700/60 shadow-lg shadow-rose-900/20',
      icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
    },
    info: {
      bg: 'bg-[#2D3748]/95 text-white border-slate-700/60 shadow-lg shadow-slate-900/20',
      icon: <Info className="w-5 h-5 text-[#40C4C0] shrink-0" />
    },
    loading: {
      bg: 'bg-slate-900/95 text-white border-slate-700/60 shadow-lg shadow-slate-900/20',
      icon: <Loader2 className="w-5 h-5 text-[#40C4C0] animate-spin shrink-0" />
    }
  }[toast.type];

  return (
    <div className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-md flex items-start gap-3 transition-all transform animate-slideInRight ${styles.bg}`}>
      {styles.icon}
      <div className="flex-1 pr-1 text-xs font-medium">
        {toast.title && <p className="font-extrabold text-sm mb-0.5 tracking-tight">{toast.title}</p>}
        <p className="leading-snug opacity-95">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/60 hover:text-white p-0.5 rounded-lg transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
