'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface SubmoduloSistema {
  id: string;
  nombre: string;
  descripcion?: string;
  ruta: string;
}

interface ModuloSistema {
  id: string;
  nombre: string;
  descripcion: string;
  ruta: string;
  categoria: 'PRINCIPAL' | 'OPERATIVO' | 'SISTEMA';
  submodulos?: SubmoduloSistema[];
}

interface RolAdmin {
  id: string;
  nombre: string;
  descripcion?: string;
  modulos: string[];
  activo: boolean;
  usuariosCount: number;
  createdAt: string;
  updatedAt: string;
}

const AREAS_SISTEMA = [
  { id: 'TODAS', label: 'Todas las áreas' },
  { id: 'FAM', label: 'FAM y Asistencia' },
  { id: 'CAJA', label: 'Caja y Cobranzas' },
  { id: 'TESORERIA', label: 'Tesorería' },
  { id: 'SISTEMA', label: 'Administración y TI' },
  { id: 'GENERAL', label: 'Operativo General' },
];

function getAreaFromRol(rolId: string, desc?: string): { area: string; label: string; badgeClass: string } {
  const upper = `${rolId} ${desc || ''}`.toUpperCase();
  if (upper.includes('FAM') || upper.includes('ASISTENCIA') || upper.includes('MUTUA')) {
    return { area: 'FAM', label: 'FAM', badgeClass: 'bg-rose-50 text-rose-800 border-rose-200' };
  }
  if (upper.includes('CAJA') || upper.includes('CAJERO')) {
    return { area: 'CAJA', label: 'Caja y Cobranzas', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  if (upper.includes('TESOR') || upper.includes('FINANZ')) {
    return { area: 'TESORERIA', label: 'Tesorería', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  if (upper.includes('ADMIN') || upper.includes('SISTEMA') || upper.includes('SUPER') || upper.includes('TI')) {
    return { area: 'SISTEMA', label: 'Administración', badgeClass: 'bg-purple-50 text-purple-800 border-purple-200' };
  }
  return { area: 'GENERAL', label: 'Operativo', badgeClass: 'bg-slate-100 text-slate-800 border-slate-200' };
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RolAdmin[]>([]);
  const [modulosCatalogo, setModulosCatalogo] = useState<ModuloSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAreaRol, setFiltroAreaRol] = useState<string>('TODAS');
  const [searchRol, setSearchRol] = useState('');

  // Notificaciones
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal Crear / Editar Rol
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RolAdmin | null>(null);
  const [formRoleId, setFormRoleId] = useState('');
  const [formRoleNombre, setFormRoleNombre] = useState('');
  const [formRoleDesc, setFormRoleDesc] = useState('');
  const [formRoleModulos, setFormRoleModulos] = useState<string[]>([]);
  const [formRoleActivo, setFormRoleActivo] = useState(true);
  const [savingRole, setSavingRole] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Modal Eliminar Rol
  const [showDeleteRoleModal, setShowDeleteRoleModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RolAdmin | null>(null);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const fetchRolesAndCatalog = async () => {
    setLoading(true);
    try {
      const [resRoles, resModulos] = await Promise.all([
        api.get('/roles'),
        api.get('/roles/modulos'),
      ]);
      setRoles(resRoles.data || []);
      setModulosCatalogo(resModulos.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error al obtener roles y catálogo', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesAndCatalog();
  }, []);

  // Abrir modal de rol
  const handleOpenRoleModal = (role?: RolAdmin) => {
    if (role) {
      setEditingRole(role);
      setFormRoleId(role.id);
      setFormRoleNombre(role.nombre);
      setFormRoleDesc(role.descripcion || '');
      setFormRoleModulos(role.modulos || []);
      setFormRoleActivo(role.activo);
    } else {
      setEditingRole(null);
      setFormRoleId('');
      setFormRoleNombre('');
      setFormRoleDesc('');
      setFormRoleModulos(['dashboard']);
      setFormRoleActivo(true);
    }
    // Expandir por defecto módulos con submódulos
    const initialExpanded: Record<string, boolean> = {};
    modulosCatalogo.forEach((m) => {
      if (m.submodulos && m.submodulos.length > 0) {
        initialExpanded[m.id] = true;
      }
    });
    setExpandedModules(initialExpanded);
    setShowRoleModal(true);
  };

  // Toggle módulo padre
  const toggleModuloPadre = (modulo: ModuloSistema) => {
    const subIds = modulo.submodulos ? modulo.submodulos.map((s) => s.id) : [];
    const allIds = [modulo.id, ...subIds];
    const isParentSelected = formRoleModulos.includes(modulo.id);

    if (isParentSelected) {
      // Deseleccionar el padre y todos sus submódulos
      setFormRoleModulos((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      // Seleccionar el padre y todos sus submódulos
      setFormRoleModulos((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

  // Toggle submódulo individual
  const toggleSubmodulo = (moduloId: string, submoduloId: string) => {
    setFormRoleModulos((prev) => {
      const exists = prev.includes(submoduloId);
      let updated = exists ? prev.filter((id) => id !== submoduloId) : [...prev, submoduloId];

      const modulo = modulosCatalogo.find((m) => m.id === moduloId);
      if (modulo && modulo.submodulos) {
        const someSubSelected = modulo.submodulos.some((s) => updated.includes(s.id));
        // Si hay al menos un submódulo seleccionado, asegurar que el padre también esté
        if (someSubSelected && !updated.includes(moduloId)) {
          updated.push(moduloId);
        } else if (!someSubSelected) {
          // Si ningún submódulo está seleccionado, remover el padre
          updated = updated.filter((id) => id !== moduloId);
        }
      }
      return updated;
    });
  };

  const toggleExpand = (modId: string) => {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const selectAllModulos = () => {
    const allIds: string[] = [];
    modulosCatalogo.forEach((m) => {
      allIds.push(m.id);
      if (m.submodulos) {
        m.submodulos.forEach((s) => allIds.push(s.id));
      }
    });
    setFormRoleModulos(Array.from(new Set(allIds)));
  };

  const deselectAllModulos = () => {
    setFormRoleModulos([]);
  };

  // Guardar rol
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formRoleModulos.length === 0) {
      showToast('Debe seleccionar al menos un módulo o submódulo para este rol', true);
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
        showToast(`Rol '${formRoleNombre}' actualizado correctamente`);
      } else {
        await api.post('/roles', {
          id: formRoleId.toUpperCase().trim(),
          nombre: formRoleNombre,
          descripcion: formRoleDesc,
          modulos: formRoleModulos,
          activo: formRoleActivo,
        });
        showToast(`Rol '${formRoleNombre}' creado exitosamente`);
      }
      setShowRoleModal(false);
      fetchRolesAndCatalog();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-updated'));
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error al guardar rol', true);
    } finally {
      setSavingRole(false);
    }
  };

  // Toggle estado rápido
  const handleToggleRoleStatus = async (role: RolAdmin) => {
    if (role.id === 'ADMINISTRADOR' || role.id === 'SUPER_ADMINISTRADOR') {
      showToast('No es posible deshabilitar el rol principal de administrador', true);
      return;
    }
    try {
      await api.patch(`/roles/${role.id}/estado`, { activo: !role.activo });
      showToast(`Estado del rol '${role.nombre}' actualizado`);
      fetchRolesAndCatalog();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-updated'));
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error al cambiar estado del rol', true);
    }
  };

  // Confirmar eliminación
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

  // Filtrado de roles
  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const matchSearch =
        r.nombre.toLowerCase().includes(searchRol.toLowerCase()) ||
        r.id.toLowerCase().includes(searchRol.toLowerCase()) ||
        (r.descripcion || '').toLowerCase().includes(searchRol.toLowerCase());

      if (!matchSearch) return false;
      if (filtroAreaRol === 'TODAS') return true;

      const area = getAreaFromRol(r.id, r.descripcion);
      return area.area === filtroAreaRol;
    });
  }, [roles, searchRol, filtroAreaRol]);

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

      {/* Header y Navegación de Pestañas Independientes */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B]">Gestión de Roles y Permisos</h1>
            <p className="text-sm text-[#64748B] mt-1">
              Defina roles institucionales y asigne permisos detallados por módulos y submódulos del sistema
            </p>
          </div>
          <button
            onClick={() => handleOpenRoleModal()}
            className="inline-flex items-center gap-2 bg-[#8f0404] text-white px-4 py-2.5 rounded-md hover:bg-[#730202] transition-colors text-sm font-medium shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Rol
          </button>
        </div>

        {/* Pestañas de Navegación entre Páginas */}
        <div className="flex items-center gap-4 mt-6 border-b border-[#E2E8F0]">
          <Link
            href="/dashboard/usuarios"
            className="pb-3 text-sm font-semibold transition-colors border-b-2 border-transparent text-[#64748B] hover:text-[#1E293B]"
          >
            Usuarios ({roles.reduce((sum, r) => sum + r.usuariosCount, 0)})
          </Link>
          <button
            className="pb-3 text-sm font-semibold transition-colors border-b-2 border-[#8f0404] text-[#8f0404]"
          >
            Roles y Permisos ({roles.length})
          </button>
        </div>
      </div>

      {/* Filtro por Áreas y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {AREAS_SISTEMA.map((area) => {
            const isSelected = filtroAreaRol === area.id;
            const count =
              area.id === 'TODAS'
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
                <span>{area.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar rol por nombre o código..."
            value={searchRol}
            onChange={(e) => setSearchRol(e.target.value)}
            className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
          />
        </div>
      </div>

      {/* Grid de Roles */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#64748B]">
            <div className="w-8 h-8 border-2 border-[#8f0404] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Cargando catálogo de roles y permisos...
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">
            <p className="text-base font-semibold text-[#1E293B]">No se encontraron roles</p>
            <p className="text-sm mt-1">No hay roles que coincidan con los filtros aplicados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#1E293B]">
              <thead className="bg-[#F8FAFC] text-xs font-semibold uppercase text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-6 py-3.5">Código / Rol</th>
                  <th className="px-6 py-3.5">Área</th>
                  <th className="px-6 py-3.5">Módulos y Submódulos Asignados</th>
                  <th className="px-6 py-3.5 text-center">Usuarios</th>
                  <th className="px-6 py-3.5 text-center">Estado</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredRoles.map((role) => {
                  const areaInfo = getAreaFromRol(role.id, role.descripcion);
                  return (
                    <tr key={role.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#1E293B] text-sm">{role.nombre}</span>
                          <span className="font-mono text-xs text-[#64748B] mt-0.5">{role.id}</span>
                          {role.descripcion && (
                            <span className="text-xs text-[#64748B] mt-1 line-clamp-1">{role.descripcion}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${areaInfo.badgeClass}`}>
                          {areaInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <div className="flex flex-wrap gap-1.5">
                          {role.modulos.length === 0 ? (
                            <span className="text-xs text-red-600 font-medium">Sin módulos asignados</span>
                          ) : (
                            role.modulos.map((modId) => (
                              <span
                                key={modId}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                                  modId.includes('/')
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 font-semibold'
                                }`}
                              >
                                {modId}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-800 font-bold text-xs">
                          {role.usuariosCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRoleStatus(role)}
                          disabled={role.id === 'ADMINISTRADOR'}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                            role.activo
                              ? 'bg-green-100 text-[#16A34A] hover:bg-green-200'
                              : 'bg-red-100 text-[#DC2626] hover:bg-red-200'
                          } ${role.id === 'ADMINISTRADOR' ? 'cursor-not-allowed opacity-80' : ''}`}
                        >
                          {role.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenRoleModal(role)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="Editar rol y permisos de submódulos"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {role.id !== 'ADMINISTRADOR' && (
                            <button
                              onClick={() => {
                                setRoleToDelete(role);
                                setShowDeleteRoleModal(true);
                              }}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                              title="Eliminar rol"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
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
        )}
      </div>

      {/* MODAL: CREAR / EDITAR ROL CON SELECCIÓN DE SUBMÓDULOS */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div>
                <h2 className="text-lg font-bold text-[#1E293B]">
                  {editingRole ? `Editar Rol: ${editingRole.nombre}` : 'Crear Nuevo Rol'}
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Seleccione los módulos y submódulos a los que tendrá acceso este rol
                </p>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                    Código del Rol (Identificador) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingRole}
                    placeholder="CODIGO_ROL"
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
                    placeholder="Nombre del rol"
                    value={formRoleNombre}
                    onChange={(e) => setFormRoleNombre(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1">
                  Descripción de Funciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalle de las funciones y responsabilidades del rol..."
                  value={formRoleDesc}
                  onChange={(e) => setFormRoleDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#1E293B] focus:outline-none focus:border-[#8f0404]"
                />
              </div>

              {/* SELECCIÓN DE MÓDULOS Y SUBMÓDULOS */}
              <div className="pt-3 border-t border-[#E2E8F0]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#1E293B]">Módulos y Submódulos Habilitados</h3>
                    <p className="text-xs text-[#64748B]">
                      Habilite el módulo completo o seleccione submódulos específicos
                    </p>
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

                <div className="space-y-3 max-h-80 overflow-y-auto p-1">
                  {modulosCatalogo.map((mod) => {
                    const isParentChecked = formRoleModulos.includes(mod.id);
                    const submodulos = mod.submodulos || [];
                    const hasSubmodulos = submodulos.length > 0;
                    const isExpanded = expandedModules[mod.id] ?? false;

                    const selectedSubsCount = submodulos.filter((s) => formRoleModulos.includes(s.id)).length;

                    return (
                      <div
                        key={mod.id}
                        className={`rounded-lg border transition-all overflow-hidden ${
                          isParentChecked || selectedSubsCount > 0
                            ? 'border-[#8f0404]/60 bg-red-50/20'
                            : 'border-[#E2E8F0] bg-white'
                        }`}
                      >
                        {/* Fila del Módulo Principal */}
                        <div className="p-3 flex items-center justify-between gap-3">
                          <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                            <input
                              type="checkbox"
                              checked={isParentChecked}
                              onChange={() => toggleModuloPadre(mod)}
                              className="w-4 h-4 text-[#8f0404] border-[#E2E8F0] rounded focus:ring-[#8f0404]"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-[#1E293B]">{mod.nombre}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-100 text-slate-600">
                                  {mod.categoria}
                                </span>
                              </div>
                              <p className="text-xs text-[#64748B] mt-0.5">{mod.descripcion}</p>
                            </div>
                          </label>

                          <div className="flex items-center gap-2">
                            {hasSubmodulos && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {selectedSubsCount}/{submodulos.length} submódulos
                              </span>
                            )}
                            {hasSubmodulos && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(mod.id)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500"
                                title={isExpanded ? 'Ocultar submódulos' : 'Mostrar submódulos'}
                              >
                                <svg
                                  className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Lista de Submódulos Desplegables */}
                        {hasSubmodulos && isExpanded && (
                          <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] p-3 space-y-2 pl-8">
                            {submodulos.map((sub) => {
                              const isSubChecked = formRoleModulos.includes(sub.id);
                              return (
                                <label
                                  key={sub.id}
                                  className={`flex items-start gap-2.5 p-2 rounded border cursor-pointer select-none transition-colors ${
                                    isSubChecked
                                      ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                                      : 'bg-white border-[#E2E8F0] text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSubChecked}
                                    onChange={() => toggleSubmodulo(mod.id, sub.id)}
                                    className="mt-0.5 w-3.5 h-3.5 text-[#8f0404] border-[#E2E8F0] rounded focus:ring-[#8f0404]"
                                  />
                                  <div className="flex-1 text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold">{sub.nombre}</span>
                                      <span className="text-[10px] font-mono text-slate-400">{sub.ruta}</span>
                                    </div>
                                    {sub.descripcion && (
                                      <p className="text-[11px] text-slate-500 mt-0.5">{sub.descripcion}</p>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
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

      {/* MODAL: CONFIRMAR ELIMINACIÓN DE ROL */}
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
            {roleToDelete.usuariosCount > 0 && (
              <p className="text-xs text-[#DC2626] bg-red-50 p-2.5 rounded border border-red-200">
                ⚠️ Atención: Este rol cuenta con {roleToDelete.usuariosCount} usuario(s) asignado(s). Para eliminarlo primero debe reasignar dichos usuarios a otro rol.
              </p>
            )}
            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteRoleModal(false)}
                className="px-4 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#64748B] hover:bg-[#F8FAFC]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteRole}
                disabled={roleToDelete.usuariosCount > 0}
                className="px-4 py-2 bg-[#DC2626] text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
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
