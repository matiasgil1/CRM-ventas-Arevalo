import React from 'react';
import { User, SUPER_ADMIN_EMAIL } from '../types/crm';
import { ArevaloLogo } from './ArevaloLogo';
import { LogOut, Shield, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, activeTab, setActiveTab }) => {
  const isAdmin = user.role === 'admin';
  const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <ArevaloLogo size="sm" />

          {/* Desktop Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'pipeline'
                  ? 'bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30 shadow-2xs'
                  : 'text-[#718096] hover:bg-gray-50'
              }`}
            >
              📋 Mi Pipeline (Kanban)
            </button>

            <button
              onClick={() => setActiveTab('pool')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'pool'
                  ? 'bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30 shadow-2xs'
                  : 'text-[#718096] hover:bg-gray-50'
              }`}
            >
              🌊 Pool General
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'import'
                  ? 'bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30 shadow-2xs'
                  : 'text-[#718096] hover:bg-gray-50'
              }`}
            >
              📥 Importar Base
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30 shadow-2xs'
                      : 'text-[#718096] hover:bg-gray-50'
                  }`}
                >
                  📊 KPIs & Reportes
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'users'
                      ? 'bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30 shadow-2xs'
                      : 'text-[#718096] hover:bg-gray-50'
                  }`}
                >
                  👥 Accesos
                </button>
              </>
            )}
          </nav>
        </div>

        {/* User Badge & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#F3F7F7] border border-[#E2E8F0] px-3 py-1.5 rounded-xl">
            <div className={`p-1 rounded-lg ${isAdmin ? 'bg-[#F0FDFD] text-[#40C4C0]' : 'bg-emerald-100 text-emerald-800'}`}>
              {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-[#2D3748] leading-tight">
                {user.name}
              </p>
              <p className="text-[10px] text-[#718096] font-medium">
                {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador' : 'Vendedor'}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Cerrar Sesión"
            className="p-2 rounded-xl text-[#718096] hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
