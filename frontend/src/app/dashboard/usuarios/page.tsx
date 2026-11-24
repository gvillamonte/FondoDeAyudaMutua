'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { UsuarioAdmin, Rol, ModuloSistema } from '@/types';

interface PasswordValidation {
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  matchesConfirm: boolean;
  isValid: boolean;
}

const AREAS_SISTEMA = [
  { id: 'TODAS', label: 'Todas las Áreas', icon: '🏛️' },
  { id: 'FAM', label: 'Fondo Asistencia Mutua (FAM)', icon: '👥' },
  { id: 'CAJA', label: 'Caja y Cobranzas', icon: '💰' },
  { id: 'TESORERIA', label: 'Tesorería y Finanzas', icon: '📈' },
  { id: 'ATENCION', label: 'Atención / Mesa de Partes', icon: '📋' },
  { id: 'PAGOS', label: 'Pagos y Beneficios', icon: '💳' },
  { id: 'AUDITORIA', label: 'Auditoría y Control', icon: '🔍' },
  { id: 'DIRECCION', label: 'Decanato y Dirección', icon: '⚖️' },
  { id: 'TI', label: 'Sistemas / TI', icon: '💻' },
];

const getAreaFromRol = (rolId: string, desc?: string | null): { area: string; label: string; icon: string; badgeClass: string } => {
  const upper = rolId.toUpperCase();
  const d = (desc || '').toUpperCase();
  if (upper.includes('FAM')) return { area: 'FAM', label: 'Fondo Asistencia Mutua', icon: '👥', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (upper.includes('CAJA') || upper.includes('CAJERO')) return { area: 'CAJA', label: 'Caja y Cobranzas', icon: '💰', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
  if (upper.includes('TESORER')) return { area: 'TESORERIA', label: 'Tesorería y Finanzas', icon: '📈', badgeClass: 'bg-blue-50 text-blue-800 border-blue-200' };
  if (upper.includes('MESA') || upper.includes('ATENCION') || upper.includes('PARTES')) return { area: 'ATENCION', label: 'Mesa de Partes / Atención', icon: '📋', badgeClass: 'bg-purple-50 text-purple-800 border-purple-200' };
  if (upper.includes('AUDIT')) return { area: 'AUDITORIA', label: 'Auditoría y Control', icon: '🔍', badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
  if (upper.includes('DIRECT') || upper.includes('DECAN')) return { area: 'DIRECCION', label: 'Decanato y Dirección', icon: '⚖️', badgeClass: 'bg-rose-50 text-rose-800 border-rose-200' };
  if (upper.includes('PAGO')) return { area: 'PAGOS', label: 'Pagos y Beneficios', icon: '💳', badgeClass: 'bg-teal-50 text-teal-800 border-teal-200' };
  if (upper.includes('TI') || upper.includes('SOPORTE')) return { area: 'TI', label: 'Sistemas / TI', icon: '💻', badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
  return { area: 'TI', label: 'Administración General', icon: '⚙️', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' };
};

const PLANTILLAS_ROLES = [
  {
    area: 'FAM',
    id: 'OPERADOR_FAM',
    nombre: 'Operador FAM',
    descripcion: 'Área FAM: Registro y seguimiento de beneficiarios, subsidios y expedientes',
    modulos: ['dashboard', 'colegiados', 'fam', 'beneficios', 'reportes'],
  },
  {
    area: 'FAM',
    id: 'SUPERVISOR_FAM',
    nombre: 'Supervisor / Jefatura FAM',
    descripcion: 'Jefatura FAM: Aprobación, fiscalización, configuración SLA y reportes de expedientes',
    modulos: ['dashboard', 'colegiados', 'fam', 'beneficios', 'pagos', 'reportes', 'configuraciones'],
  },
  {
    area: 'CAJA',
    id: 'CAJERO',
    nombre: 'Cajero / Cobranzas',
    descripcion: 'Área de Caja: Cobro de aportaciones ordinarias, IEPI, derechos y consulta de pagos',
    modulos: ['dashboard', 'colegiados', 'caja', 'pagos'],
  },
  {
    area: 'TESORERIA',
    id: 'TESORERIA',
    nombre: 'Tesorería y Finanzas',
    descripcion: 'Área de Tesorería: Fraccionamiento de deudas, convenios de pago y control financiero',
    modulos: ['dashboard', 'colegiados', 'tesoreria', 'caja', 'pagos', 'reportes'],
  },
  {
    area: 'ATENCION',
    id: 'MESA_PARTES',
    nombre: 'Atención al Colegiado / Mesa de Partes',
    descripcion: 'Atención: Recepción de solicitudes, actualización de datos y verificación de habilidad',
    modulos: ['dashboard', 'colegiados', 'actualizacion-datos', 'reportes'],
  },
  {
    area: 'AUDITORIA',
    id: 'AUDITOR',
    nombre: 'Auditoría y Control Interno',
    descripcion: 'Control Interno: Supervisión de trazabilidad, logs inmutables y reportes globales',
    modulos: ['dashboard', 'colegiados', 'beneficios', 'pagos', 'reportes', 'auditoria'],
  },
  {
    area: 'DIRECCION',
    id: 'DIRECTORIO',
    nombre: 'Decanato y Junta Directiva',
    descripcion: 'Alta Dirección: Consulta ejecutiva de indicadores, recaudación, estados y padrón',
    modulos: ['dashboard', 'colegiados', 'fam', 'caja', 'tesoreria', 'reportes', 'auditoria'],
  },
  {
    area: 'TI',
    id: 'SOPORTE_TI',
    nombre: 'Soporte y Sistemas TI',
    descripcion: 'Área de TI: Administración técnica de usuarios, roles, configuraciones y auditoría',
    modulos: ['dashboard', 'configuraciones', 'auditoria', 'usuarios'],
  },
  {
    area: 'PAGOS',
    id: 'OPERADOR_PAGOS',
    nombre: 'Operador de Pagos y Beneficios',
    descripcion: 'Área de Pagos: Gestión operativa de pagos, órdenes de desembolso y beneficios',
    modulos: ['dashboard', 'colegiados', 'beneficios', 'pagos', 'caja', 'fam'],
  },
];

export default function UsuariosPage() {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'roles'>('usuarios');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Datos
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [modulosCatalogo, setModulosCatalogo] = useState<ModuloSistema[]>([]);
  const [filtroAreaRol, setFiltroAreaRol] = useState('TODAS');

  // Filtros de usuarios
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [page, setPage] = useState(1);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  // Modales Usuarios
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioAdmin | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUserForPass, setSelectedUserForPass] = useState<UsuarioAdmin | null>(null);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UsuarioAdmin | null>(null);

  // Form Usuario
  const [formNombreCompleto, setFormNombreCompleto] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRol, setFormRol] = useState('');
  const [formActivo, setFormActivo] = useState(true);
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Form Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Modales Roles
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Rol | null>(null);
  const [showDeleteRoleModal, setShowDeleteRoleModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Rol | null>(null);

  // Form Rol
  const [formRoleId, setFormRoleId] = useState('');
  const [formRoleNombre, setFormRoleNombre] = useState('');
  const [formRoleDesc, setFormRoleDesc] = useState('');
  const [formRoleModulos, setFormRoleModulos] = useState<string[]>([]);
  const [formRoleActivo, setFormRoleActivo] = useState(true);
  const [savingRole, setSavingRole] = useState(false);

  // Validación de contraseña en tiempo real
  const validatePassword = (pass: string, confirm: string): PasswordValidation => {
    const hasMinLength = pass.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(pass);
    const hasNumber = /\d/.test(pass);
    const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pass);
    const matchesConfirm = pass.length > 0 && pass === confirm;
    const isValid = hasMinLength && hasLetter && hasNumber && hasSymbol && matchesConfirm;

    return {
      hasMinLength,
      hasLetter,
      hasNumber,
      hasSymbol,
      matchesConfirm,
      isValid,
    };
  };

  const userPassValidation = useMemo(
    () => validatePassword(formPassword, formConfirmPassword),
    [formPassword, formConfirmPassword]
  );

  const resetPassValidation = useMemo(
    () => validatePassword(newPassword, confirmNewPassword),
    [newPassword, confirmNewPassword]
  );

  // Carga inicial
  useEffect(() => {
    fetchRolesAndCatalog();
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [page, searchTerm, filtroRol, filtroEstado]);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
    }
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 5000);
  };

  const fetchRolesAndCatalog = async () => {
    try {
      const [resRoles, resModulos] = await Promise.all([
        api.get('/roles'),
        api.get('/roles/modulos'),
      ]);
      setRoles(resRoles.data);
      setModulosCatalogo(resModulos.data);
    } catch (err: any) {
      console.error('Error cargando roles y catálogo:', err);
    }
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (filtroRol) params.rol = filtroRol;
      if (filtroEstado) params.activo = filtroEstado;

      const res = await api.get('/usuarios', { params });
      setUsuarios(res.data.data || []);
      setTotalUsuarios(res.data.meta?.total || 0);
      setTotalPages(res.data.meta?.totalPages || 1);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error al obtener lista de usuarios', true);
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de usuario
  const handleOpenUserModal = (user?: UsuarioAdmin) => {
    if (user) {
      setEditingUser(user);
      setFormNombreCompleto(user.nombreCompleto);
      setFormUsername(user.username);
      setFormEmail(user.email);
      setFormRol(user.rol);
      setFormActivo(user.activo);
      setFormPassword('');
      setFormConfirmPassword('');
    } else {
      setEditingUser(null);
      setFormNombreCompleto('');
      setFormUsername('');
      setFormEmail('');
      setFormRol(roles[0]?.id || 'OPERADOR_PAGOS');
      setFormActivo(true);
      setFormPassword('');
      setFormConfirmPassword('');
    }
    setShowUserModal(true);
  };

  // Guardar usuario
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser && !userPassValidation.isValid) {
      showToast('La contraseña debe cumplir con todos los requisitos de seguridad', true);
      return;
    }

    setSavingUser(true);
    try {
      if (editingUser) {
        await api.put(`/usuarios/${editingUser.id}`, {
          nombreCompleto: formNombreCompleto,
          email: formEmail,
          rol: formRol,
          activo: formActivo,
        });
        showToast('Usuario actualizado correctamente');
      } else {
        await api.post('/usuarios', {
          username: formUsername,
          email: formEmail,
          password: formPassword,
          nombreCompleto: formNombreCompleto,
          rol: formRol,
          activo: formActivo,
        });
        showToast('Usuario creado exitosamente');
      }
      setShowUserModal(false);
      fetchUsuarios();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-updated'));
      }
      fetchRolesAndCatalog();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-updated'));
      }
    } catch (err: any) {
      const msg = err.response?.data?.message;
      showToast(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al guardar usuario', true);
    } finally {
      setSavingUser(false);
    }
  };

  // Alternar estado de usuario
  const handleToggleUserStatus = async (user: UsuarioAdmin) => {
    try {
      await api.patch(`/usuarios/${user.id}/estado`);
      showToast(`Usuario ${user.activo ? 'desactivado' : 'activado'} correctamente`);
      fetchUsuarios();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error al cambiar estado', true);
    }
  };

  // Cambiar contraseña
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPass || !resetPassValidation.isValid) {
      showToast('La nueva contraseña debe cumplir con los requisitos obligatorios', true);
      return;
    }

    setSavingPassword(true);
    try {
      await api.patch(`/usuarios/${selectedUserForPass.id}/password`, {
        password: newPassword,
      });
      showToast(`Contraseña actualizada para '${selectedUserForPass.username}'`);
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      showToast(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al actualizar contraseña', true);
    } finally {
      setSavingPassword(false);
    }
  };

  // Eliminar / Desactivar usuario
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await api.delete(`/usuarios/${userToDelete.id}`);
      showToast(res.data.message || 'Operación completada');
      setShowDeleteUserModal(false);
      setUserToDelete(null);
      fetchUsuarios();
      fetchRolesAndCatalog();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-updated'));
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error al eliminar usuario', true);
    }
  };

  // Abrir modal de rol
  const handleOpenRoleModal = (rol?: Rol) => {
    if (rol) {
      setEditingRole(rol);
      setFormRoleId(rol.id);
      setFormRoleNombre(rol.nombre);
      setFormRoleDesc(rol.descripcion || '');
      setFormRoleModulos(rol.modulos || []);
      setFormRoleActivo(rol.activo);
    } else {
      setEditingRole(null);
      setFormRoleId('');
      setFormRoleNombre('');
      setFormRoleDesc('');
      setFormRoleModulos(['dashboard']);
      setFormRoleActivo(true);
    }
    setShowRoleModal(true);
  };

  // Toggle módulo en rol
  const toggleModulo = (moduloId: string) => {
    setFormRoleModulos((prev) =>
      prev.includes(moduloId) ? prev.filter((m) => m !== moduloId) : [...prev, moduloId]
    );
  };

  const selectAllModulos = () => {
    setFormRoleModulos(modulosCatalogo.map((m) => m.id));
  };

  const deselectAllModulos = () => {
    // Si es admin, mantener al menos 'usuarios'
    if (editingRole?.id === 'ADMINISTRADOR') {
      setFormRoleModulos(['usuarios']);
    } else {
      setFormRoleModulos([]);
    }
  };

  // Guardar rol
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formRoleModulos.length === 0) {
      showToast('Debe activar al menos un módulo para el rol', true);
      return;
    }

    setSavingRole(true);
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, {
          nombre: formRoleNombre,
          descripcion: formRoleDesc,
          modulos: formRoleModulos,
          activo: formRoleActivo,
        });
        showToast('Rol y permisos actualizados correctamente');
      } else {
        await api.post('/roles', {
          id: formRoleId.trim().toUpperCase(),
          nombre: formRoleNombre,
          descripcion: formRoleDesc,
          modulos: formRoleModulos,
          activo: formRoleActivo,
        });
        showToast('Nuevo rol registrado exitosamente');
      }
      setShowRoleModal(false);
      fetchRolesAndCatalog();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-updated'));
      }
      fetchUsuarios();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-updated'));
      }
    } catch (err: any) {
      const msg = err.response?.data?.message;
      showToast(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al guardar rol', true);
    } finally {
      setSavingRole(false);
    }
  };

  // Alternar estado de rol
  const handleToggleRoleStatus = async (rol: Rol) => {
    try {
      await api.patch(`/roles/${rol.id}/estado`);
      showToast(`Rol '${rol.nombre}' ${rol.activo ? 'desactivado' : 'activado'}`);
      fetchRolesAndCatalog();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-updated'));
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error al modificar estado del rol', true);
    }
  };

  // Eliminar rol
  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      await api.delete(`/roles/${roleToDelete.id}`);
      showToast(`Rol '${roleToDelete.nombre}' eliminado correctamente`);
      setShowDeleteRoleModal(false);
      setRoleToDelete(null);
      fetchRolesAndCatalog();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-updated'));
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error al eliminar rol', true);
    }
  };

  // Conteo de métricas
  const totalActivos = useMemo(() => usuarios.filter((u) => u.activo).length, [usuarios]);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-[#DC2626] rounded-md text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800 text-lg leading-none font-bold">
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 text-[#16A34A] rounded-md text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-800 text-lg leading-none font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Header y Pestañas */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B]">Administración de Usuarios y Roles</h1>
            <p className="text-sm text-[#64748B] mt-1">
              Control centralizado de credenciales, roles institucionales y activación selectiva de módulos del sistema
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'usuarios' ? (
              <button
                onClick={() => handleOpenUserModal()}
                className="inline-flex items-center gap-2 bg-[#8f0404] text-white px-4 py-2.5 rounded-md hover:bg-[#730202] transition-colors text-sm font-medium shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Usuario
              </button>
            ) : (
              <button
                onClick={() => handleOpenRoleModal()}
                className="inline-flex items-center gap-2 bg-[#8f0404] text-white px-4 py-2.5 rounded-md hover:bg-[#730202] transition-colors text-sm font-medium shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Rol
              </button>
            )}
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex border-b border-[#E2E8F0] mt-6 gap-8">
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'usuarios'
                ? 'border-[#8f0404] text-[#8f0404]'
                : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Usuarios Registrados
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-[#F8FAFC] text-[#1E293B] border border-[#E2E8F0]">
              {totalUsuarios}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'roles'
                ? 'border-[#8f0404] text-[#8f0404]'
                : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Roles y Accesos a Módulos
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-[#F8FAFC] text-[#1E293B] border border-[#E2E8F0]">
              {roles.length}
            </span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PESTAÑA: USUARIOS */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          {/* Tarjetas de Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Usuarios</p>
              <p className="text-2xl font-bold text-[#1E293B] mt-1">{totalUsuarios}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Cuentas Activas</p>
              <p className="text-2xl font-bold text-[#16A34A] mt-1">{totalActivos}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Cuentas Inactivas</p>
              <p className="text-2xl font-bold text-[#DC2626] mt-1">{Math.max(0, totalUsuarios - totalActivos)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Roles Disponibles</p>
              <p className="text-2xl font-bold text-[#8f0404] mt-1">{roles.length}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre, usuario o correo..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] placeholder-[#64748B] focus:outline-none focus:border-[#8f0404]"
              />
            </div>
            <div className="w-full md:w-56">
              <select
                value={filtroRol}
                onChange={(e) => {
                  setFiltroRol(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
              >
                <option value="">Todos los Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-44">
              <select
                value={filtroEstado}
                onChange={(e) => {
                  setFiltroEstado(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
              >
                <option value="">Todos los Estados</option>
                <option value="true">Solo Activos</option>
                <option value="false">Solo Inactivos</option>
              </select>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#1E293B]">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Usuario / Nombre</th>
                    <th className="px-6 py-3.5">Correo Electrónico</th>
                    <th className="px-6 py-3.5">Rol Asignado</th>
                    <th className="px-6 py-3.5">Estado</th>
                    <th className="px-6 py-3.5">Último Acceso</th>
                    <th className="px-6 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-[#64748B]">
                        <div className="flex items-center justify-center gap-2">
                          <svg className="animate-spin w-5 h-5 text-[#8f0404]" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Cargando usuarios...</span>
                        </div>
                      </td>
                    </tr>
                  ) : usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-[#64748B]">
                        No se encontraron usuarios registrados con los criterios seleccionados.
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-semibold text-[#1E293B]">{u.nombreCompleto}</span>
                            <span className="block text-xs text-[#64748B]">@{u.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#64748B]">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-[#8f0404] border border-red-200">
                            {u.rolNombre || u.rol}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {u.activo ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-[#16A34A] border border-green-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-[#DC2626] border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]"></span>
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-[#64748B]">
                          {u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString('es-PE') : 'Nunca'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenUserModal(u)}
                              title="Editar Usuario"
                              className="p-1.5 text-[#64748B] hover:text-[#8f0404] hover:bg-red-50 rounded transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUserForPass(u);
                                setNewPassword('');
                                setConfirmNewPassword('');
                                setShowPasswordModal(true);
                              }}
                              title="Cambiar Contraseña"
                              className="p-1.5 text-[#64748B] hover:text-[#D97706] hover:bg-amber-50 rounded transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              title={u.activo ? 'Desactivar Cuenta' : 'Activar Cuenta'}
                              className={`p-1.5 rounded transition-colors ${
                                u.activo
                                  ? 'text-[#16A34A] hover:bg-green-50'
                                  : 'text-[#DC2626] hover:bg-red-50'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                            {u.username !== 'admin' && (
                              <button
                                onClick={() => {
                                  setUserToDelete(u);
                                  setShowDeleteUserModal(true);
                                }}
                                title="Eliminar / Dar de Baja"
                                className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 rounded transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between text-sm">
                <span className="text-[#64748B]">
                  Página {page} de {totalPages} ({totalUsuarios} registros)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 border border-[#E2E8F0] rounded text-sm disabled:opacity-40 hover:bg-[#F8FAFC]"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 border border-[#E2E8F0] rounded text-sm disabled:opacity-40 hover:bg-[#F8FAFC]"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA: ROLES Y PERMISOS */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-[#1E293B] flex items-start gap-3">
            <svg className="w-5 h-5 text-[#8f0404] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-[#8f0404]">Configuración de Privilegios por Módulo</p>
              <p className="text-xs text-[#64748B] mt-0.5">
                Cree nuevos roles o edite los existentes activando o desactivando los módulos autorizados. Cada usuario heredará automáticamente el acceso en la barra lateral y en sus pantallas de trabajo.
              </p>
            </div>
          </div>

          {/* Filtro por Áreas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {AREAS_SISTEMA.map((area) => {
              const isSelected = filtroAreaRol === area.id;
              const count = area.id === 'TODAS'
                ? roles.length
                : roles.filter((r) => getAreaFromRol(r.id, r.descripcion).area === area.id).length;

              return (
                <button
                  key={area.id}
                  onClick={() => setFiltroAreaRol(area.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-[#8f0404] text-white border-[#8f0404] shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{area.icon}</span>
                  <span>{area.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grilla de Roles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles
              .filter((r) => {
                if (filtroAreaRol === 'TODAS') return true;
                return getAreaFromRol(r.id, r.descripcion).area === filtroAreaRol;
              })
              .map((rol) => {
                const areaInfo = getAreaFromRol(rol.id, rol.descripcion);
                return (
                  <div
                    key={rol.id}
                    className={`bg-white border rounded-lg p-5 shadow-sm flex flex-col justify-between transition-shadow hover:shadow-md ${
                      rol.activo ? 'border-[#E2E8F0]' : 'border-red-200 bg-red-50/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-[#1E293B] text-base">{rol.nombre}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${areaInfo.badgeClass}`}>
                              <span>{areaInfo.icon}</span>
                              <span>{areaInfo.label}</span>
                            </span>
                          </div>
                          <span className="text-xs font-mono text-[#64748B] block mt-1">ID: {rol.id}</span>
                        </div>
                        {rol.activo ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-[#16A34A] border border-green-200">
                            Activo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-[#DC2626] border border-red-200">
                            Inactivo
                          </span>
                        )}
                      </div>

                  <p className="text-xs text-[#64748B] mt-3 line-clamp-2">
                    {rol.descripcion || 'Sin descripción asignada.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
                    <div className="flex items-center justify-between text-xs text-[#64748B] mb-2">
                      <span className="font-medium text-[#1E293B]">Módulos Habilitados:</span>
                      <span className="font-semibold text-[#8f0404]">
                        {rol.modulos?.length || 0} de {modulosCatalogo.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {(rol.modulos || []).map((mId) => {
                        const mObj = modulosCatalogo.find((cat) => cat.id === mId);
                        return (
                          <span
                            key={mId}
                            className="inline-block px-2 py-0.5 text-[11px] rounded bg-[#F8FAFC] text-[#1E293B] border border-[#E2E8F0]"
                          >
                            {mObj?.nombre || mId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-xs text-[#64748B]">
                    👤 {rol.usuariosCount || 0} usuario(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenRoleModal(rol)}
                      className="px-2.5 py-1 text-xs font-medium text-[#8f0404] bg-red-50 hover:bg-red-100 rounded transition-colors"
                    >
                      Editar Accesos
                    </button>
                    {rol.id !== 'ADMINISTRADOR' && (
                      <button
                        onClick={() => handleToggleRoleStatus(rol)}
                        title={rol.activo ? 'Desactivar Rol' : 'Activar Rol'}
                        className={`p-1 rounded text-xs ${
                          rol.activo ? 'text-[#DC2626] hover:bg-red-50' : 'text-[#16A34A] hover:bg-green-50'
                        }`}
                      >
                        {rol.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                    {!['ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR'].includes(rol.id) && (
                      <button
                        onClick={() => {
                          setRoleToDelete(rol);
                          setShowDeleteRoleModal(true);
                        }}
                        title="Eliminar Rol"
                        className="p-1 text-[#64748B] hover:text-[#DC2626] rounded"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR USUARIO */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <h2 className="text-lg font-bold text-[#1E293B]">
                {editingUser ? `Editar Usuario: @${editingUser.username}` : 'Registrar Nuevo Usuario'}
              </h2>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-[#64748B] hover:text-[#1E293B] text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ing. Carlos Mendoza Torres"
                  value={formNombreCompleto}
                  onChange={(e) => setFormNombreCompleto(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                    Nombre de Usuario (Login) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    placeholder="Ej. cmendoza"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value.toLowerCase().trim())}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:border-[#8f0404]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="usuario@cipcusco.org.pe"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value.trim())}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                    Rol Institucional *
                  </label>
                  <select
                    required
                    value={formRol}
                    onChange={(e) => setFormRol(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                  >
                    {roles.map((r) => {
                      const info = getAreaFromRol(r.id, r.descripcion);
                      return (
                        <option key={r.id} value={r.id} disabled={!r.activo}>
                          [{info.label}] {r.nombre} {!r.activo ? '(Desactivado)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formActivo}
                      onChange={(e) => setFormActivo(e.target.checked)}
                      className="w-4 h-4 text-[#8f0404] border-[#E2E8F0] rounded focus:ring-[#8f0404]"
                    />
                    <span className="text-sm font-medium text-[#1E293B]">Cuenta Activa</span>
                  </label>
                </div>
              </div>

              {/* Contraseña (solo al crear) */}
              {!editingUser && (
                <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Ingrese contraseña segura"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                      Confirmar Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Repita la contraseña"
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                    />
                  </div>

                  {/* Checklist interactivo de requisitos de contraseña */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-md text-xs space-y-1.5">
                    <p className="font-semibold text-[#1E293B] mb-1">Requisitos obligatorios de la contraseña:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div className={`flex items-center gap-1.5 ${userPassValidation.hasMinLength ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'}`}>
                        <span>{userPassValidation.hasMinLength ? '✓' : '○'}</span>
                        <span>Mínimo 8 caracteres</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${userPassValidation.hasLetter ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'}`}>
                        <span>{userPassValidation.hasLetter ? '✓' : '○'}</span>
                        <span>Al menos una letra (a-z, A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${userPassValidation.hasNumber ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'}`}>
                        <span>{userPassValidation.hasNumber ? '✓' : '○'}</span>
                        <span>Al menos un número (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${userPassValidation.hasSymbol ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'}`}>
                        <span>{userPassValidation.hasSymbol ? '✓' : '○'}</span>
                        <span>Al menos un símbolo (!@#$%^&*...)</span>
                      </div>
                    </div>
                    {formConfirmPassword && (
                      <div className={`pt-1 border-t border-[#E2E8F0] flex items-center gap-1.5 ${userPassValidation.matchesConfirm ? 'text-[#16A34A] font-medium' : 'text-[#DC2626] font-medium'}`}>
                        <span>{userPassValidation.matchesConfirm ? '✓' : '✕'}</span>
                        <span>{userPassValidation.matchesConfirm ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser || (!editingUser && !userPassValidation.isValid)}
                  className="px-5 py-2 bg-[#8f0404] text-white rounded-md text-sm font-medium hover:bg-[#730202] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {savingUser ? 'Guardando...' : editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CAMBIAR CONTRASEÑA */}
      {showPasswordModal && selectedUserForPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <h2 className="text-base font-bold text-[#1E293B]">
                Restablecer Contraseña: @{selectedUserForPass.username}
              </h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-[#64748B] hover:text-[#1E293B] text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                  Nueva Contraseña *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ingrese nueva contraseña segura"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                  Confirmar Nueva Contraseña *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Repita la nueva contraseña"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                />
              </div>

              {/* Indicadores de Seguridad */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-md text-xs space-y-1.5">
                <p className="font-semibold text-[#1E293B] mb-1">Requisitos obligatorios de aceptación:</p>
                <div className="grid grid-cols-1 gap-1">
                  <div className={`flex items-center gap-1.5 ${resetPassValidation.hasMinLength ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'}`}>
                    <span>{resetPassValidation.hasMinLength ? '✓' : '○'}</span>
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${resetPassValidation.hasLetter ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'}`}>
                    <span>{resetPassValidation.hasLetter ? '✓' : '○'}</span>
                    <span>Al menos una letra (a-z, A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${resetPassValidation.hasNumber ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'}`}>
                    <span>{resetPassValidation.hasNumber ? '✓' : '○'}</span>
                    <span>Al menos un número (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${resetPassValidation.hasSymbol ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'}`}>
                    <span>{resetPassValidation.hasSymbol ? '✓' : '○'}</span>
                    <span>Al menos un símbolo especial (!@#$%^&*...)</span>
                  </div>
                </div>
                {confirmNewPassword && (
                  <div className={`pt-1 border-t border-[#E2E8F0] flex items-center gap-1.5 ${resetPassValidation.matchesConfirm ? 'text-[#16A34A] font-medium' : 'text-[#DC2626] font-medium'}`}>
                    <span>{resetPassValidation.matchesConfirm ? '✓' : '✕'}</span>
                    <span>{resetPassValidation.matchesConfirm ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPassword || !resetPassValidation.isValid}
                  className="px-5 py-2 bg-[#8f0404] text-white rounded-md text-sm font-medium hover:bg-[#730202] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {savingPassword ? 'Actualizando...' : 'Guardar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR ROL */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <h2 className="text-lg font-bold text-[#1E293B]">
                {editingRole ? `Editar Rol: ${editingRole.nombre}` : 'Registrar Nuevo Rol y Accesos'}
              </h2>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-[#64748B] hover:text-[#1E293B] text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-5">
              {!editingRole && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚡</span> Plantillas Rápidas por Área (1-Clic)
                    </span>
                    <span className="text-[11px] text-slate-500">Autocompleta código, nombre y módulos</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PLANTILLAS_ROLES.map((plantilla) => {
                      const info = getAreaFromRol(plantilla.id, plantilla.descripcion);
                      return (
                        <button
                          key={plantilla.id}
                          type="button"
                          onClick={() => {
                            setFormRoleId(plantilla.id);
                            setFormRoleNombre(plantilla.nombre);
                            setFormRoleDesc(plantilla.descripcion);
                            setFormRoleModulos(plantilla.modulos);
                          }}
                          className="p-2 bg-white border border-slate-200 rounded-md text-left hover:border-[#8f0404] hover:bg-red-50/40 transition-all text-xs group"
                        >
                          <div className="flex items-center gap-1">
                            <span>{info.icon}</span>
                            <span className="font-semibold text-slate-800 truncate group-hover:text-[#8f0404]">{plantilla.nombre}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block truncate mt-0.5">{plantilla.modulos.length} módulos habilitados</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                    Código Identificador *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingRole}
                    placeholder="Ej. ASISTENTE_CAJA"
                    value={formRoleId}
                    onChange={(e) => setFormRoleId(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] disabled:bg-gray-100 disabled:text-gray-500 font-mono focus:outline-none focus:border-[#8f0404]"
                  />
                  <span className="text-[11px] text-[#64748B] block mt-0.5">En mayúsculas sin espacios</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                    Nombre Descriptivo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Asistente de Caja y Cobranzas"
                    value={formRoleNombre}
                    onChange={(e) => setFormRoleNombre(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                  Descripción del Rol
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalle de las funciones y responsabilidades asociadas a este rol..."
                  value={formRoleDesc}
                  onChange={(e) => setFormRoleDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                />
              </div>

              {/* Selector de Módulos */}
              <div className="pt-3 border-t border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#1E293B]">Módulos del Sistema Habilitados</h3>
                    <p className="text-xs text-[#64748B]">Active o desactive el acceso a cada módulo para este rol</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllModulos}
                      className="px-2.5 py-1 text-xs border border-[#E2E8F0] rounded hover:bg-[#F8FAFC] text-[#8f0404] font-medium"
                    >
                      Seleccionar Todos
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllModulos}
                      className="px-2.5 py-1 text-xs border border-[#E2E8F0] rounded hover:bg-[#F8FAFC] text-[#DC2626] font-medium"
                    >
                      Deseleccionar Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1">
                  {modulosCatalogo.map((mod) => {
                    const isChecked = formRoleModulos.includes(mod.id);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleModulo(mod.id)}
                        className={`p-3 rounded-md border cursor-pointer transition-colors flex items-start gap-3 select-none ${
                          isChecked
                            ? 'bg-red-50/50 border-[#8f0404]'
                            : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // controlado por onClick del div
                          className="mt-1 w-4 h-4 text-[#8f0404] border-[#E2E8F0] rounded focus:ring-[#8f0404]"
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${isChecked ? 'text-[#8f0404]' : 'text-[#1E293B]'}`}>
                            {mod.nombre}
                          </p>
                          <p className="text-xs text-[#64748B] mt-0.5 line-clamp-1">{mod.descripcion}</p>
                          <span className="text-[10px] font-mono text-[#64748B] bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                            {mod.ruta}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="roleActivoCheck"
                  checked={formRoleActivo}
                  disabled={editingRole?.id === 'ADMINISTRADOR'}
                  onChange={(e) => setFormRoleActivo(e.target.checked)}
                  className="w-4 h-4 text-[#8f0404] border-[#E2E8F0] rounded focus:ring-[#8f0404]"
                />
                <label htmlFor="roleActivoCheck" className="text-sm font-medium text-[#1E293B] cursor-pointer">
                  Rol Activo y Disponible para Asignación
                </label>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRole || formRoleModulos.length === 0}
                  className="px-5 py-2 bg-[#8f0404] text-white rounded-md text-sm font-medium hover:bg-[#730202] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {savingRole ? 'Guardando...' : editingRole ? 'Actualizar Rol' : 'Crear Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN USUARIO */}
      {showDeleteUserModal && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#DC2626]">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-base font-bold text-[#1E293B]">Confirmar Eliminación de Usuario</h3>
            </div>
            <p className="text-sm text-[#64748B]">
              ¿Está seguro de eliminar o dar de baja al usuario <strong className="text-[#1E293B]">@{userToDelete.username}</strong> ({userToDelete.nombreCompleto})?
            </p>
            <p className="text-xs text-[#64748B] bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0]">
              ℹ Nota: Si el usuario cuenta con registros de auditoría, pagos o solicitudes asociadas, la cuenta se desactivará permanentemente para preservar la integridad de datos contables e históricos.
            </p>
            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteUserModal(false)}
                className="px-4 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#64748B] hover:bg-[#F8FAFC]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 bg-[#DC2626] text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN ROL */}
      {showDeleteRoleModal && roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#DC2626]">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-base font-bold text-[#1E293B]">Confirmar Eliminación de Rol</h3>
            </div>
            <p className="text-sm text-[#64748B]">
              ¿Está seguro de eliminar el rol <strong className="text-[#1E293B]">{roleToDelete.nombre}</strong> ({roleToDelete.id})?
            </p>
            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteRoleModal(false)}
                className="px-4 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#64748B] hover:bg-[#F8FAFC]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteRole}
                className="px-4 py-2 bg-[#DC2626] text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                Eliminar Rol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
