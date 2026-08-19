import React, { useState, useMemo } from 'react';
import { User, Lead, SUPER_ADMIN_EMAIL } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { ConfirmModal } from './ConfirmModal';
import { CustomSelect } from './CustomSelect';
import { 
  Users, Shield, Check, X, Ban, UserCheck, Clock, 
  UserPlus, Edit2, Trash2, Search, Loader2, Sparkles,
  Link, UserMinus, AlertCircle, ArrowRight
} from 'lucide-react';

interface AccessManagementModuleProps {
  currentUser: User;
  users: User[];
  leads?: Lead[];
}

export const AccessManagementModule: React.FC<AccessManagementModuleProps> = ({
  currentUser,
  users,
  leads = []
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState<'all' | 'pending' | 'active' | 'inactive'>('all');

  // Modal State for ABM
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assign Seller Profile Modal State
  const [assignTargetUser, setAssignTargetUser] = useState<User | null>(null);
  const [selectedSellerName, setSelectedSellerName] = useState<string>('');
  const [customSellerName, setCustomSellerName] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Individual Action Loader Tracking
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<User['role']>('vendedor');
  const [status, setStatus] = useState<User['status']>('approved');
  const [formAssignedSeller, setFormAssignedSeller] = useState<string>('');

  // Collect distinct seller names from existing leads & user list
  const knownSellerNames = useMemo(() => {
    const setNames = new Set<string>();
    leads.forEach(l => {
      if (l.vendedorNombre && l.vendedorNombre.trim()) {
        setNames.add(l.vendedorNombre.trim());
      }
    });
    users.forEach(u => {
      if (u.assignedSellerName && u.assignedSellerName.trim()) {
        setNames.add(u.assignedSellerName.trim());
      }
      if (u.name && u.role === 'vendedor') {
        setNames.add(u.name.trim());
      }
    });
    return Array.from(setNames).sort((a, b) => a.localeCompare(b));
  }, [leads, users]);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleUpdateStatus = async (userId: string, newStatus: User['status'], newRole?: User['role']) => {
    setActionLoadingId(userId);
    try {
      await crmStore.updateUserStatus(userId, newStatus, newRole);
      showFeedback('success', 'Estado del usuario actualizado correctamente en Firestore.');
    } catch (e: any) {
      showFeedback('error', e?.message || 'Error al actualizar usuario.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenAssignModal = (user: User) => {
    setAssignTargetUser(user);
    setSelectedSellerName(user.assignedSellerName || user.name || '');
    setCustomSellerName('');
  };

  const handleConfirmAssignSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetUser) return;

    const finalSellerName = (customSellerName.trim() || selectedSellerName.trim());
    if (!finalSellerName) {
      showFeedback('error', 'Debes indicar o seleccionar el nombre de vendedor a otorgar.');
      return;
    }

    setIsAssigning(true);
    try {
      await crmStore.assignUserSellerProfile(
        assignTargetUser.id,
        finalSellerName,
        'approved',
        assignTargetUser.role === 'admin' ? 'admin' : 'vendedor'
      );
      showFeedback('success', `¡Vendedor "${finalSellerName}" asignado con éxito a ${assignTargetUser.name}! Acceso concedido.`);
      setAssignTargetUser(null);
    } catch (e: any) {
      showFeedback('error', e?.message || 'Error al asignar vendedor.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole('vendedor');
    setStatus('approved');
    setFormAssignedSeller('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || '');
    setRole(user.role);
    setStatus(user.status);
    setFormAssignedSeller(user.assignedSellerName || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingUser) {
        await crmStore.updateUser(editingUser.id, {
          name,
          email,
          phone,
          role,
          status,
          assignedSellerName: formAssignedSeller ? formAssignedSeller.trim() : null
        });
        showFeedback('success', `Usuario "${name}" actualizado exitosamente.`);
      } else {
        await crmStore.addUser(name, email, phone, role, status, formAssignedSeller ? formAssignedSeller.trim() : null);
        showFeedback('success', `Vendedor "${name}" registrado exitosamente.`);
      }
      setIsModalOpen(false);
    } catch (e: any) {
      showFeedback('error', e?.message || 'Error al procesar usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRequestDelete = (user: User) => {
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      showFeedback('error', 'El Super Administrador principal está protegido y no puede ser eliminado.');
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const deleted = await crmStore.deleteUser(userToDelete.id);
      if (deleted) {
        showFeedback('success', `Usuario "${userToDelete.name}" eliminado definitivamente.`);
      } else {
        showFeedback('error', 'No se pudo eliminar el usuario seleccionado.');
      }
    } catch (e: any) {
      showFeedback('error', e?.message || 'Error al eliminar usuario en Firestore.');
    } finally {
      setIsDeletingUser(false);
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.assignedSellerName && u.assignedSellerName.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (tabFilter === 'pending') return u.status === 'pending' || (!u.assignedSellerName && u.role !== 'admin');
    if (tabFilter === 'active') return u.status === 'approved';
    if (tabFilter === 'inactive') return u.status === 'rejected' || u.status === 'suspended';
    return true;
  });

  const pendingCount = users.filter(u => u.status === 'pending' || (!u.assignedSellerName && u.role !== 'admin')).length;
  const activeCount = users.filter(u => u.status === 'approved').length;
  const inactiveCount = users.filter(u => u.status === 'rejected' || u.status === 'suspended').length;

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      {/* Title & Top Bar */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#40C4C0] text-white rounded-xl shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2D3748] tracking-tight">
              Gestión de Accesos y Asignación de Vendedores
            </h1>
            <p className="text-xs text-[#718096] font-medium">
              Vincule cuentas de Gmail con identidades de vendedor. Solo los vendedores asignados y aprobados pueden ver datos.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-xs active:scale-98 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Crear Nuevo Usuario / Vendedor</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center gap-2.5 animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <X className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Quick Summary Banner for Pending Accounts */}
      {pendingCount > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-400/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-extrabold">
                {pendingCount} {pendingCount === 1 ? 'cuenta de Gmail requiere asignación' : 'cuentas de Gmail requieren asignación'}
              </p>
              <p className="text-[11px] text-amber-800 font-medium">
                Los vendedores que ingresan con su cuenta de Google no verán ningún dato hasta que les otorgues su perfil de vendedor correspondiente.
              </p>
            </div>
          </div>
          <button
            onClick={() => setTabFilter('pending')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shrink-0 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>Ver Pendientes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setTabFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              tabFilter === 'all'
                ? 'bg-[#2D3748] text-white shadow-2xs'
                : 'text-[#718096] hover:bg-[#F3F7F7] hover:text-[#2D3748]'
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            onClick={() => setTabFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              tabFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <span>Pendientes / Sin Vendedor</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-white text-amber-800 rounded-full text-[10px] font-black">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTabFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              tabFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            Aprobados & Activos ({activeCount})
          </button>
          <button
            onClick={() => setTabFilter('inactive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              tabFilter === 'inactive'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-rose-800 bg-rose-50 hover:bg-rose-100'
            }`}
          >
            Inactivos ({inactiveCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#718096]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o vendedor asignado..."
            className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-[#E2E8F0] bg-[#F3F7F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#40C4C0] text-[#2D3748]"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-[#40C4C0]" />
            <span>Listado de Cuentas y Vendedores ({filteredUsers.length})</span>
          </h2>
          <span className="text-[11px] text-slate-500 font-medium">
            Sincronización en tiempo real con Firebase
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F3F7F7] text-[#2D3748] font-bold">
              <tr>
                <th className="p-3.5 border-b border-[#E2E8F0]">Usuario / Gmail</th>
                <th className="p-3.5 border-b border-[#E2E8F0]">Identidad de Vendedor Otorgada</th>
                <th className="p-3.5 border-b border-[#E2E8F0]">Rol</th>
                <th className="p-3.5 border-b border-[#E2E8F0]">Estado de Acceso</th>
                <th className="p-3.5 border-b border-[#E2E8F0] text-right">Acciones de Asignación & ABM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-medium text-xs">
                    No se encontraron usuarios o vendedores con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isSuper = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                  const isPending = user.status === 'pending' || (!user.assignedSellerName && user.role !== 'admin');
                  const isLoading = actionLoadingId === user.id;

                  return (
                    <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${isPending ? 'bg-amber-50/40' : ''}`}>
                      {/* Name & Email */}
                      <td className="p-3.5 font-bold text-[#2D3748]">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isSuper ? 'bg-[#40C4C0] text-white' : user.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-extrabold text-[#2D3748] flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {isSuper && (
                                <span className="px-1.5 py-0.2 bg-[#40C4C0] text-white text-[9px] font-black rounded-md">
                                  Super Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-[#718096]">{user.email}</div>
                            {user.phone && <div className="text-[10px] text-[#718096] font-normal">📞 {user.phone}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Assigned Seller Profile */}
                      <td className="p-3.5">
                        {isSuper ? (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-[10px] font-bold border border-slate-200">
                            👑 Acceso Total Administrador
                          </span>
                        ) : user.assignedSellerName ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full font-bold text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Vendedor: <strong>{user.assignedSellerName}</strong></span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full font-bold text-[10px]">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Sin Vendedor Asignado (Bloqueado)</span>
                          </div>
                        )}
                      </td>

                      {/* Role */}
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          user.role === 'admin' 
                            ? 'bg-cyan-100 text-cyan-900 border border-cyan-200' 
                            : 'bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30'
                        }`}>
                          {user.role === 'admin' ? 'Administrador' : 'Vendedor'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        {user.status === 'approved' && (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold rounded-full text-[10px] border border-emerald-200">
                            ✓ Aprobado / Activo
                          </span>
                        )}
                        {user.status === 'pending' && (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-extrabold rounded-full text-[10px] border border-amber-200">
                            ⏳ Pendiente de Asignación
                          </span>
                        )}
                        {(user.status === 'rejected' || user.status === 'suspended') && (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-extrabold rounded-full text-[10px] border border-rose-200">
                            ✕ Suspendido
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Assign Seller Profile Button */}
                          {!isSuper && (
                            <button
                              onClick={() => handleOpenAssignModal(user)}
                              className="px-2.5 py-1.5 bg-[#F0FDFD] hover:bg-[#40C4C0] text-[#40C4C0] hover:text-white border border-[#40C4C0]/40 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                              title="Otorgar o Cambiar Identidad de Vendedor"
                            >
                              <Link className="w-3.5 h-3.5" />
                              <span>{user.assignedSellerName ? 'Reasignar' : 'Otorgar Vendedor'}</span>
                            </button>
                          )}

                          {/* Quick Approve button if pending */}
                          {!isSuper && user.status === 'pending' && (
                            <button
                              onClick={() => handleOpenAssignModal(user)}
                              disabled={isLoading}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 disabled:opacity-50"
                              title="Aprobar y Asignar Vendedor"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Aprobar</span>
                            </button>
                          )}

                          {/* Edit Full User Info */}
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 hover:bg-[#F0FDFD] rounded-xl text-[#2D3748] border border-[#E2E8F0] hover:border-[#40C4C0] hover:text-[#40C4C0] transition-colors"
                            title="Editar Datos de Cuenta"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          {!isSuper && (
                            <button
                              onClick={() => onRequestDelete(user)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-600 border border-rose-200 transition-colors active:scale-95"
                              title="Eliminar Cuenta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Otorgar Identidad de Vendedor a Usuario de Google */}
      {assignTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-[#2D3748] to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#40C4C0] text-white rounded-xl shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm">
                    Otorgar Identidad de Vendedor
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Vincular cuenta de Google con un vendedor de la base de datos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignTargetUser(null)}
                disabled={isAssigning}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target User Info */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#40C4C0] text-white font-black text-sm flex items-center justify-center shrink-0">
                {assignTargetUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-900 truncate">{assignTargetUser.name}</p>
                <p className="text-[11px] text-slate-500 font-mono truncate">{assignTargetUser.email}</p>
                {assignTargetUser.assignedSellerName ? (
                  <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                    Actualmente vinculado como: {assignTargetUser.assignedSellerName}
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                    ⚠️ Actualmente sin vendedor vinculado (no puede ver datos)
                  </p>
                )}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmAssignSeller} className="p-5 space-y-4 text-xs font-medium text-slate-700">
              <p className="text-xs text-slate-600 leading-relaxed">
                Selecciona qué vendedor es este usuario según los nombres cargados en las campañas o planillas Excel de Arévalo, o escribe un nombre personalizado:
              </p>

              <div>
                <label className="block font-bold mb-1 text-slate-800">
                  Seleccionar de Vendedores Existentes / Detectados:
                </label>
                <select
                  value={selectedSellerName}
                  onChange={(e) => {
                    setSelectedSellerName(e.target.value);
                    if (e.target.value) setCustomSellerName('');
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-[#40C4C0] focus:outline-none"
                >
                  <option value="">-- Seleccionar Vendedor --</option>
                  {knownSellerNames.map(seller => (
                    <option key={seller} value={seller}>
                      👤 {seller}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] text-slate-400 font-bold uppercase shrink-0">
                  o escribir nuevo nombre
                </span>
                <div className="border-t border-slate-200 w-full" />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-800">
                  Nombre de Vendedor Personalizado:
                </label>
                <input
                  type="text"
                  value={customSellerName}
                  onChange={(e) => {
                    setCustomSellerName(e.target.value);
                    if (e.target.value) setSelectedSellerName('');
                  }}
                  placeholder="Ej: Carlos Arévalo"
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-[#40C4C0] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-medium flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Al confirmar, la cuenta de este usuario quedará <strong>Aprobada y Activada</strong>. En su próxima visita verá únicamente los leads asignados a este vendedor.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssignTargetUser(null)}
                  disabled={isAssigning}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAssigning || (!selectedSellerName && !customSellerName.trim())}
                  className="px-4 py-2 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando Asignación...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Aprobar y Otorgar Vendedor</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ABM Crear / Editar Usuario Completo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden animate-fadeIn">
            <div className="p-4 bg-[#2D3748] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-[#40C4C0]" />
                <h2 className="font-bold text-sm">
                  {editingUser ? 'Editar Vendedor / Usuario' : 'Crear Nuevo Vendedor'}
                </h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-medium text-[#2D3748]">
              {editingUser?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
                <div className="p-3 bg-[#F0FDFD] border border-[#40C4C0]/40 rounded-xl text-[11px] font-bold text-[#2D3748] flex items-center gap-2">
                  <span>👑</span>
                  <span>Editando perfil de Super Administrador Principal. Puedes actualizar Nombre, Email y Teléfono.</span>
                </div>
              )}

              <div>
                <label className="block font-bold mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Sofia Martínez"
                  required
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#40C4C0] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Correo Electrónico (Gmail) *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@arevaloservicios.com"
                  required
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#40C4C0] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Teléfono / Celular WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 3516123456"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#40C4C0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Identidad de Vendedor Asignada</label>
                <input
                  type="text"
                  value={formAssignedSeller}
                  onChange={(e) => setFormAssignedSeller(e.target.value)}
                  placeholder="Ej: Carlos Arévalo (nombre que figura en planillas)"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#40C4C0] focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Este nombre se utiliza para filtrar los leads que este usuario podrá visualizar.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Rol en Sistema</label>
                  <CustomSelect
                    icon={Shield}
                    value={role}
                    disabled={editingUser?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                    onChange={(e) => setRole(e.target.value as User['role'])}
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="admin">Administrador</option>
                  </CustomSelect>
                </div>

                <div>
                  <label className="block font-bold mb-1">Estado de Acceso</label>
                  <CustomSelect
                    icon={UserCheck}
                    value={status}
                    disabled={editingUser?.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()}
                    onChange={(e) => setStatus(e.target.value as User['status'])}
                  >
                    <option value="approved">Aprobado / Activo</option>
                    <option value="pending">Pendiente de Asignación</option>
                    <option value="suspended">Suspendido</option>
                  </CustomSelect>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#2D3748] font-bold rounded-xl disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando en Firestore...</span>
                    </>
                  ) : (
                    <span>{editingUser ? 'Guardar Cambios' : 'Crear Vendedor'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirm Modal */}
      <ConfirmModal
        isOpen={!!userToDelete}
        title="Eliminar Usuario / Vendedor"
        message="¿Estás seguro de eliminar el siguiente usuario? El usuario perderá inmediatamente el acceso a la plataforma y sus datos se eliminarán de Firestore."
        itemName={userToDelete ? `${userToDelete.name} (${userToDelete.email})` : undefined}
        confirmText="Sí, Eliminar de Firestore"
        isLoading={isDeletingUser}
        onConfirm={handleConfirmDelete}
        onClose={() => setUserToDelete(null)}
      />
    </div>
  );
};
