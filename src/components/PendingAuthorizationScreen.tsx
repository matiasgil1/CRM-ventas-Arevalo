import React, { useState } from 'react';
import { User, SUPER_ADMIN_EMAIL } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { ArevaloLogo } from './ArevaloLogo';
import { ShieldAlert, RefreshCw, LogOut, CheckCircle2, Clock, UserCheck, AlertCircle } from 'lucide-react';

interface PendingAuthorizationScreenProps {
  user: User;
  onRefresh: () => void;
  onLogout: () => void;
}

export const PendingAuthorizationScreen: React.FC<PendingAuthorizationScreenProps> = ({
  user,
  onRefresh,
  onLogout
}) => {
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const updated = await crmStore.checkUserStatus(user.id);
      if (updated && updated.status === 'approved' && (updated.assignedSellerName || updated.role === 'admin')) {
        setCheckResult('¡Tu cuenta ha sido activada y vinculada! Redirigiendo a tu panel...');
        setTimeout(() => {
          onRefresh();
        }, 1200);
      } else {
        setCheckResult('Tu cuenta aún está pendiente de que el Administrador te asigne tu perfil de vendedor.');
      }
    } catch (e) {
      setCheckResult('No se pudo verificar el estado en este momento.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1E293B] to-[#0F172A] flex flex-col items-center justify-center p-4 selection:bg-[#40C4C0] selection:text-white">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-6 text-white text-center relative">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-inner">
            <Clock className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">
            Cuenta en Espera de Asignación
          </h1>
          <p className="text-xs text-amber-100 mt-1 font-medium">
            Arévalo Servicios Sociales - CRM de Ventas
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* User Profile Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#40C4C0] text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-extrabold text-slate-900 truncate">{user.name}</p>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200 shrink-0">
                  Pendiente
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono truncate">{user.email}</p>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 mb-1">
                  Acceso a datos restringido hasta asignación
                </p>
                <p>
                  Tu cuenta de Google fue registrada correctamente en el sistema. Para poder ver y gestionar tus leads, el Super Administrador debe asignarte cuál vendedor eres en el módulo de <strong>Acceso Usuarios</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Checklist Guide */}
          <div className="space-y-2 text-xs text-slate-700 font-medium">
            <div className="flex items-center gap-2 text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Autenticación con Google completada con éxito</span>
            </div>
            <div className="flex items-center gap-2 text-amber-700 font-bold">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Esperando que el Administrador vincule tu perfil de vendedor</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <UserCheck className="w-4 h-4 text-slate-300" />
              <span>Habilitación instantánea de leads asignados</span>
            </div>
          </div>

          {checkResult && (
            <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-[#40C4C0] shrink-0" />
              <span>{checkResult}</span>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="w-full py-3 px-4 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Comprobando estado en Firestore...' : 'Comprobar Estado de Asignación'}</span>
            </button>

            <button
              onClick={onLogout}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>Arévalo CRM v2.0</span>
          <span>Super Admin: matiasgil20142015@gmail.com</span>
        </div>
      </div>
    </div>
  );
};
