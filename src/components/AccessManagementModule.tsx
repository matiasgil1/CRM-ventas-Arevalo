import React, { useState } from 'react';
import { User, SUPER_ADMIN_EMAIL } from '../types/crm';
import { crmStore } from '../services/crmStore';
import { ConfirmModal } from './ConfirmModal';
import { CustomSelect } from './CustomSelect';
import { 
  Users, Shield, Check, X, Ban, UserCheck, Clock, 
  UserPlus, Edit2, Trash2, Search, Loader2
} from 'lucide-react';

interface AccessManagementModuleProps {
  currentUser: User;
  users: User[];
}

export const AccessManagementModule: React.FC<AccessManagementModuleProps> = ({
  currentUser,
  users
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [search, setSearch] = useState('');

  // Modal State for ABM
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleOpenCreate = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole('vendedor');
    setStatus('approved');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || '');
    setRole(user.role);
    setStatus(user.status);
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
          status
        });
        showFeedback('success', `Usuario "${name}" actualizado exitosamente.`);
      } else {
        await crmStore.addUser(name, email, phone, role, status);
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

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const pendingUsers = filteredUsers.filter(u => u.status === 'pending');
  const activeUsers = filteredUsers.filter(u => u.status === 'approved');
  const inactiveUsers = filteredUsers.filter(u => u.status === 'rejected' || u.status === 'suspended');

  return (
    <div className="space-y-6 pb-16 md:pb-6">
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#40C4C0] text-white rounded-xl shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2D3748] tracking-tight">
              Gestión de Accesos y ABM de Vendedores
            </h1>
            <p className="text-xs text-[#718096] font-medium">
              Administración completa (Alta, Baja, Modificación) de vendedores y permisos del sistema.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-[#40C4C0] hover:bg-[#32b2ae] text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-xs active:scale-98"
        >
          <UserPlus className="w-4 h-4" />
          <span>Crear Nuevo Vendedor</span>
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

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#718096]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email de vendedor..."
            className="w-full pl-9 pr-3.5 py-2 text-xs font-medium rounded-xl border border-[#E2E8F0] bg-[#F3F7F7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#40C4C0] text-[#2D3748]"
          />
        </div>
        <div className="text-xs text-[#718096] font-bold">
          Total registrado: <span className="text-[#2D3748]">{users.length} usuarios</span>
        </div>
      </div>

      {/* Pending User Approvals */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50/70 border-2 border-amber-300 p-5 rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
            <Clock className="w-5 h-5 text-amber-600" />
            <span>Solicitudes Pendientes de Aprobación ({pendingUsers.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingUsers.map(user => {
              const isLoading = actionLoadingId === user.id;
              return (
                <div key={user.id} className="p-4 bg-white rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">{user.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
                    <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full mt-1 inline-block">
                      Solicitud Vendedor
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleUpdateStatus(user.id, 'approved', 'vendedor')}
                      disabled={isLoading}
                      className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                      title="Aprobar Vendedor"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(user.id, 'rejected')}
                      disabled={isLoading}
                      className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                      title="Rechazar Acceso"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Users List */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>Vendedores y Usuarios Activos ({activeUsers.length})</span>
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F3F7F7] text-[#2D3748] font-bold">
              <tr>
                <th className="p-3 border-b border-[#E2E8F0]">Nombre / Teléfono</th>
                <th className="p-3 border-b border-[#E2E8F0]">Email</th>
                <th className="p-3 border-b border-[#E2E8F0]">Rol</th>
                <th className="p-3 border-b border-[#E2E8F0]">Estado</th>
                <th className="p-3 border-b border-[#E2E8F0] text-right">Acciones ABM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {activeUsers.map(user => {
                const isSuper = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-extrabold text-[#2D3748]">
                      <div>{user.name}</div>
                      {user.phone && <div className="text-[10px] text-[#718096] font-normal">📞 {user.phone}</div>}
                    </td>
                    <td className="p-3 font-mono text-[#718096]">{user.email}</td>
                    <td className="p-3 font-bold">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] ${
                        user.role === 'admin' 
                          ? 'bg-cyan-100 text-cyan-900 border border-cyan-200' 
                          : 'bg-[#F0FDFD] text-[#40C4C0] border border-[#40C4C0]/30'
                      }`}>
                        {user.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-emerald-600">✓ Activo</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-2 hover:bg-[#F0FDFD] rounded-xl text-[#2D3748] border border-[#E2E8F0] hover:border-[#40C4C0] hover:text-[#40C4C0] transition-colors"
                          title={isSuper ? "Editar Datos de Super Admin" : "Editar Datos de Vendedor"}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isSuper ? (
                          <span className="text-[10px] font-extrabold bg-[#40C4C0] text-white px-2.5 py-1.5 rounded-xl shadow-2xs">
                            Super Admin
                          </span>
                        ) : (
                          <button
                            onClick={() => onRequestDelete(user)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-600 border border-rose-200 transition-colors active:scale-95"
                            title="Eliminar Vendedor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspended / Rejected List */}
      {inactiveUsers.length > 0 && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-500" />
            <span>Usuarios Inactivos / Suspendidos ({inactiveUsers.length})</span>
          </h3>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F3F7F7] text-[#2D3748] font-bold">
                <tr>
                  <th className="p-3 border-b border-[#E2E8F0]">Usuario</th>
                  <th className="p-3 border-b border-[#E2E8F0]">Email</th>
                  <th className="p-3 border-b border-[#E2E8F0]">Estado</th>
                  <th className="p-3 border-b border-[#E2E8F0] text-right">Acciones ABM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {inactiveUsers.map(user => {
                  const isLoading = actionLoadingId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="p-3 font-extrabold text-[#2D3748]">{user.name}</td>
                      <td className="p-3 font-mono text-[#718096]">{user.email}</td>
                      <td className="p-3 font-bold text-rose-600">
                        {user.status === 'suspended' ? 'Suspendido' : 'Rechazado'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleUpdateStatus(user.id, 'approved', 'vendedor')}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                          >
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            <span>Reactivar Acceso</span>
                          </button>
                          <button
                            onClick={() => onRequestDelete(user)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-600 border border-rose-200 transition-colors active:scale-95"
                            title="Eliminar Definitivamente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ABM Vendedor / Usuario */}
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
                <label className="block font-bold mb-1">Correo Electrónico (Email) *</label>
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
                    <option value="pending">Pendiente de Aprobación</option>
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
