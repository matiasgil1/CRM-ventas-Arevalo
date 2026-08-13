import React, { useState } from 'react';
import { User } from '../types/crm';
import { ArevaloLogo } from './ArevaloLogo';
import { 
  LayoutGrid, Table, Layers, FileUp, BarChart3, Megaphone,
  Users, LogOut, Menu, X
} from 'lucide-react';
import { crmStore } from '../services/crmStore';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unassignedCount: number;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  setActiveTab,
  unassignedCount,
  onLogout
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user.role === 'admin';
  const isSuperAdmin = user.email.toLowerCase() === 'matiasgil20142015@gmail.com';

  const navItems = [
    {
      id: 'table',
      label: 'Grilla de Leads (Tabla)',
      icon: Table,
      badge: null
    },
    {
      id: 'pipeline',
      label: 'Pipeline (Kanban)',
      icon: LayoutGrid,
      badge: null
    },
    {
      id: 'pool',
      label: 'Pool General',
      icon: Layers,
      badge: unassignedCount > 0 ? unassignedCount : null
    },
    {
      id: 'campaigns',
      label: 'Gestión de Campañas',
      icon: Megaphone,
      badge: null
    },
    {
      id: 'import',
      label: 'Importar Base',
      icon: FileUp,
      badge: null
    },
    ...(isAdmin ? [
      {
        id: 'dashboard',
        label: 'KPIs & Reportes',
        icon: BarChart3,
        badge: null
      },
      {
        id: 'users',
        label: 'Acceso Usuarios',
        icon: Users,
        badge: null
      }
    ] : [])
  ];

  return (
    <>
      {/* Top Mobile Bar */}
      <div className="lg:hidden bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <ArevaloLogo size="sm" />
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-[#718096] hover:bg-[#F3F7F7] active:bg-slate-200 rounded-xl"
          aria-label="Abrir Menú"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay backdrop for mobile */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-xs"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static top-0 left-0 bottom-0 z-50
        w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between">
            <ArevaloLogo size="md" />
            <button 
              onClick={() => setMobileOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#718096] px-3 mb-2">
              Navegación Principal
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition-all ${
                    isActive
                      ? 'bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30 shadow-2xs'
                      : 'text-[#718096] hover:bg-[#F3F7F7] hover:text-[#2D3748]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#40C4C0]' : 'text-[#718096]'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== null && (
                    <span className="px-2 py-0.5 bg-[#40C4C0] text-white rounded-full text-[10px] font-extrabold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Actions & User Profile */}
          <div className="p-4 border-t border-[#E2E8F0] space-y-3 bg-[#F3F7F7]/50">
            <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E2E8F0]">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                  isAdmin ? 'bg-[#40C4C0]' : 'bg-emerald-600'
                }`}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-[#2D3748] truncate">{user.name}</p>
                  <p className="text-[10px] text-[#718096] truncate">
                    {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrador' : 'Vendedor'}
                  </p>
                </div>
              </div>

              <button
                onClick={onLogout}
                title="Cerrar Sesión"
                className="p-1.5 text-[#718096] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
