import React, { useState } from 'react';
import { crmStore } from '../services/crmStore';
import { ArevaloLogo } from './ArevaloLogo';
import { LogIn, ShieldAlert, Clock, Mail } from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoadingGoogle(true);

    try {
      const res = await crmStore.loginWithGoogle();
      if (res.success) {
        onLoginSuccess();
      } else {
        if (res.message.includes('revisión') || res.message.includes('aprobar')) {
          setInfoMsg(res.message);
        } else {
          setErrorMsg(res.message);
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error al conectar con Google.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email || !email.includes('@')) {
      setErrorMsg('Por favor ingresa un correo electrónico válido.');
      return;
    }

    const res = crmStore.loginWithEmail(email);

    if (res.success) {
      onLoginSuccess();
    } else {
      if (res.message.includes('revisión') || res.message.includes('aprobar')) {
        setInfoMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F7F7] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 sm:p-8 space-y-6">
        {/* Brand Logo & Title */}
        <div className="text-center flex flex-col items-center space-y-3">
          <ArevaloLogo size="lg" />
          <h1 className="text-xl font-bold text-[#2D3748] mt-2">
            Arevalo Servicios Sociales
          </h1>
          <p className="text-xs text-[#718096]">
            Sistema CRM de Gestión Comercial y Seguimiento de Socios
          </p>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-fadeIn">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <div>
              <p className="font-semibold">Error de Autenticación</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {infoMsg && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5 animate-fadeIn">
            <Clock className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Solicitud en Revisión</p>
              <p className="mt-0.5">{infoMsg}</p>
            </div>
          </div>
        )}

        {/* Primary Google Login Button */}
        <div className="space-y-4 pt-2">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loadingGoogle}
            className="w-full py-3.5 px-4 bg-white hover:bg-gray-50 text-[#2D3748] font-bold rounded-xl border-2 border-[#E2E8F0] hover:border-[#40C4C0] shadow-xs transition-all text-sm flex items-center justify-center gap-3 active:scale-98 disabled:opacity-50"
          >
            {loadingGoogle ? (
              <div className="w-5 h-5 border-2 border-[#40C4C0] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continuous con Google</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]"></div>
            </div>
            <div className="relative flex justify-center text-[11px] font-bold uppercase tracking-wider">
              <span className="bg-white px-3 text-[#718096]">o bien</span>
            </div>
          </div>

          {!showEmailForm ? (
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              className="w-full py-2.5 text-xs font-semibold text-[#718096] hover:text-[#2D3748] flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span>Ingresar con Correo Electrónico</span>
            </button>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-[#2D3748] mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@arevaloservicios.com"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#40C4C0] bg-[#F3F7F7] focus:bg-white text-[#2D3748]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-[#2D3748] hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Ingresar</span>
              </button>
            </form>
          )}
        </div>

        <div className="text-center pt-3 border-t border-[#E2E8F0]">
          <p className="text-[11px] text-[#718096]">
            ¿Primera vez ingresando? Tu cuenta se registrará automáticamente y requerirá aprobación de un Administrador.
          </p>
        </div>
      </div>
    </div>
  );
};
