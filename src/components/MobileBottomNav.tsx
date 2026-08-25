import React from 'react';
import { User } from '../types/crm';
import { Table, LayoutGrid, Layers, FileUp, BarChart3, Users, Megaphone, Shield } from 'lucide-react';

interface MobileBottomNavProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  unassignedCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  user,
  activeTab,
  setActiveTab,
  unassignedCount
}) => {
  const isAdmin = user.role === 'admin';

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] shadow-lg px-2 py-1.5 flex items-center justify-around gap-1 overflow-x-auto no-scrollbar scroll-smooth">
      {/* Tab 0: Table / Grilla de Leads */}
      <button
        onClick={() => setActiveTab('table')}
        className={`flex flex-col items-center justify-center shrink-0 min-w-[60px] h-12 px-2 rounded-xl transition-all ${
          activeTab === 'table'
            ? 'text-[#40C4C0] bg-[#F0FDFD] font-extrabold shadow-2xs'
            : 'text-[#718096] font-medium hover:text-[#2D3748]'
        }`}
      >
        <Table className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">Grilla</span>
      </button>

      {/* Tab 1: Pipeline Kanban */}
      <button
        onClick={() => setActiveTab('pipeline')}
        className={`flex flex-col items-center justify-center shrink-0 min-w-[60px] h-12 px-2 rounded-xl transition-all ${
          activeTab === 'pipeline'
            ? 'text-[#40C4C0] bg-[#F0FDFD] font-extrabold shadow-2xs'
            : 'text-[#718096] font-medium hover:text-[#2D3748]'
        }`}
      >
        <LayoutGrid className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">Pipeline</span>
      </button>

      {/* Admin Only Tab: Pool */}
      {isAdmin && (
        <button
          onClick={() => setActiveTab('pool')}
          className={`relative flex flex-col items-center justify-center shrink-0 min-w-[56px] h-12 px-2 rounded-xl transition-all ${
            activeTab === 'pool'
              ? 'text-[#40C4C0] bg-[#F0FDFD] font-extrabold shadow-2xs'
              : 'text-[#718096] font-medium hover:text-[#2D3748]'
          }`}
        >
          <div className="relative">
            <Layers className="w-5 h-5 mb-0.5" />
            {unassignedCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-[#40C4C0] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-xs">
                {unassignedCount > 99 ? '99+' : unassignedCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Pool</span>
        </button>
      )}

      {/* Admin Only Tab: Campañas */}
      {isAdmin && (
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex flex-col items-center justify-center shrink-0 min-w-[56px] h-12 px-2 rounded-xl transition-all ${
            activeTab === 'campaigns'
              ? 'text-[#40C4C0] bg-[#F0FDFD] font-extrabold shadow-2xs'
              : 'text-[#718096] font-medium hover:text-[#2D3748]'
          }`}
        >
          <Megaphone className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Campañas</span>
        </button>
      )}

      {/* Admin Only Tab: Import */}
      {isAdmin && (
        <button
          onClick={() => setActiveTab('import')}
          className={`flex flex-col items-center justify-center shrink-0 min-w-[56px] h-12 px-2 rounded-xl transition-all ${
            activeTab === 'import'
              ? 'text-[#40C4C0] bg-[#F0FDFD] font-extrabold shadow-2xs'
              : 'text-[#718096] font-medium hover:text-[#2D3748]'
          }`}
        >
          <FileUp className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Importar</span>
        </button>
      )}

      {/* Dashboard / Estadísticas (Both Admin & Seller) */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex flex-col items-center justify-center shrink-0 min-w-[60px] h-12 px-2 rounded-xl transition-all ${
          activeTab === 'dashboard'
            ? 'text-[#40C4C0] bg-[#F0FDFD] font-extrabold shadow-2xs'
            : 'text-[#718096] font-medium hover:text-[#2D3748]'
        }`}
      >
        <BarChart3 className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">Estadísticas</span>
      </button>

      {/* User Access (Both Admin & Seller) */}
      <button
        onClick={() => setActiveTab('users')}
        className={`flex flex-col items-center justify-center shrink-0 min-w-[60px] h-12 px-2 rounded-xl transition-all ${
          activeTab === 'users'
            ? 'text-[#40C4C0] bg-[#F0FDFD] font-extrabold shadow-2xs'
            : 'text-[#718096] font-medium hover:text-[#2D3748]'
        }`}
      >
        <Users className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">Usuarios</span>
      </button>

      {/* Admin Only Tab: Auditoría */}
      {isAdmin && (
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`flex flex-col items-center justify-center shrink-0 min-w-[56px] h-12 px-2 rounded-xl transition-all ${
            activeTab === 'auditoria'
              ? 'text-[#40C4C0] bg-[#F0FDFD] font-extrabold shadow-2xs'
              : 'text-[#718096] font-medium hover:text-[#2D3748]'
          }`}
        >
          <Shield className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Auditoría</span>
        </button>
      )}
    </div>
  );
};


