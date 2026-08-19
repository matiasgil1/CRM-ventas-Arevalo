import React, { useState, useEffect } from 'react';
import { User, Lead, Campaign, AuditLog, SUPER_ADMIN_EMAIL } from './types/crm';
import { crmStore } from './services/crmStore';

// Components
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AuthScreen } from './components/AuthScreen';
import { PendingAuthorizationScreen } from './components/PendingAuthorizationScreen';
import { LeadTableModule } from './components/LeadTableModule';
import { KanbanModule } from './components/KanbanModule';
import { PoolModule } from './components/PoolModule';
import { ImportModule } from './components/ImportModule';
import { CampaignManagementModule } from './components/CampaignManagementModule';
import { DashboardModule } from './components/DashboardModule';
import { AccessManagementModule } from './components/AccessManagementModule';
import { AuditModule } from './components/AuditModule';
import { LeadDetailModal } from './components/LeadDetailModal';
import { RejectionModal } from './components/RejectionModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(crmStore.getCurrentUser());
  const [activeTab, setActiveTab] = useState<string>('table');
  
  const [leads, setLeads] = useState<Lead[]>(crmStore.getLeads());
  const [campaigns, setCampaigns] = useState<Campaign[]>(crmStore.getCampaigns());
  const [users, setUsers] = useState<User[]>(crmStore.getUsers());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(crmStore.getAuditLogs());

  // Modals
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [rejectionTargetLead, setRejectionTargetLead] = useState<Lead | null>(null);

  // Subscribe to store reactive changes
  useEffect(() => {
    const unsubscribe = crmStore.subscribe(() => {
      setCurrentUser(crmStore.getCurrentUser());
      setLeads(crmStore.getLeads());
      setCampaigns(crmStore.getCampaigns());
      setUsers(crmStore.getUsers());
      setAuditLogs(crmStore.getAuditLogs());
    });
    return unsubscribe;
  }, []);

  // Sync selectedLead when store updates
  useEffect(() => {
    if (selectedLead) {
      const updated = leads.find(l => l.id === selectedLead.id);
      setSelectedLead(updated || null);
    }
  }, [leads]);

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={() => setCurrentUser(crmStore.getCurrentUser())} />;
  }

  // Check if seller user is pending assignment or approval
  const isSuperAdmin = currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isPendingSeller = !isSuperAdmin && currentUser.role !== 'admin' && (
    currentUser.status === 'pending' || 
    currentUser.status === 'rejected' || 
    currentUser.status === 'suspended' ||
    !currentUser.assignedSellerName
  );

  if (isPendingSeller) {
    return (
      <PendingAuthorizationScreen
        user={currentUser}
        onRefresh={() => {
          crmStore.checkUserStatus(currentUser.id).then(updated => {
            if (updated) setCurrentUser(updated);
          });
        }}
        onLogout={() => crmStore.logout()}
      />
    );
  }

  const unassignedCount = leads.filter(l => l.vendedorId === null).length;

  const handleRejectionConfirm = (motivoCaida: string, observacionRechazo: string) => {
    if (!rejectionTargetLead) return;

    crmStore.updateLeadStatus(
      rejectionTargetLead.id,
      'caido',
      motivoCaida,
      observacionRechazo
    );

    setRejectionTargetLead(null);
  };

  return (
    <div className="min-h-screen bg-[#F3F7F7] font-sans text-[#2D3748] flex flex-col lg:flex-row selection:bg-[#40C4C0] selection:text-white">
      {/* Sidebar Navigation with all options */}
      <Sidebar
        user={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unassignedCount={unassignedCount}
        onLogout={() => crmStore.logout()}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-6 pb-24 lg:pb-6">
          {activeTab === 'table' && (
            <LeadTableModule
              leads={leads}
              users={users}
              campaigns={campaigns}
              currentUser={currentUser}
              onSelectLead={(lead) => setSelectedLead(lead)}
              onRequestRejection={(lead) => setRejectionTargetLead(lead)}
              onOpenImport={() => setActiveTab('import')}
            />
          )}

          {activeTab === 'pipeline' && (
            <KanbanModule
              leads={leads}
              currentUser={currentUser}
              users={users}
              campaigns={campaigns}
              onSelectLead={(lead) => setSelectedLead(lead)}
              onRequestRejection={(lead) => setRejectionTargetLead(lead)}
              onOpenPool={() => setActiveTab('pool')}
            />
          )}

          {activeTab === 'pool' && (
            <PoolModule
              leads={leads}
              currentUser={currentUser}
              users={users}
              campaigns={campaigns}
              onSelectLead={(lead) => setSelectedLead(lead)}
            />
          )}

          {activeTab === 'import' && currentUser.role === 'admin' && (
            <ImportModule
              campaigns={campaigns}
              currentUser={currentUser}
              users={users}
              onImportComplete={() => setActiveTab('table')}
            />
          )}

          {activeTab === 'campaigns' && currentUser.role === 'admin' && (
            <CampaignManagementModule
              campaigns={campaigns}
              leads={leads}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'dashboard' && currentUser.role === 'admin' && (
            <DashboardModule
              leads={leads}
              users={users}
              campaigns={campaigns}
            />
          )}

          {activeTab === 'users' && currentUser.role === 'admin' && (
            <AccessManagementModule
              currentUser={currentUser}
              users={users}
              leads={leads}
            />
          )}

          {activeTab === 'auditoria' && currentUser.role === 'admin' && (
            <AuditModule
              currentUser={currentUser}
              auditLogs={auditLogs}
              users={users}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        user={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unassignedCount={unassignedCount}
      />

      {/* Lead Detail & WhatsApp Modal */}
      <LeadDetailModal
        lead={selectedLead}
        currentUser={currentUser}
        campaigns={campaigns}
        onClose={() => setSelectedLead(null)}
        onRequestRejection={(lead) => {
          setSelectedLead(null);
          setRejectionTargetLead(lead);
        }}
      />

      {/* Mandatory Rejection Reason Modal */}
      <RejectionModal
        isOpen={Boolean(rejectionTargetLead)}
        leadName={rejectionTargetLead ? `${rejectionTargetLead.nombre} ${rejectionTargetLead.apellido}` : ''}
        onClose={() => setRejectionTargetLead(null)}
        onConfirm={handleRejectionConfirm}
      />
    </div>
  );
}

