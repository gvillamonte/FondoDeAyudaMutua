'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface ConfigItem {
  id: string;
  clave: string;
  valor: string;
  grupo: string;
  descripcion: string | null;
  activo: boolean;
}

interface FieldConfig {
  key: 'clave' | 'valor' | 'descripcion';
  label: string;
  placeholder: string;
  type?: 'text' | 'number';
  required?: boolean;
  disabledOnEdit?: boolean;
}

interface ConfigTableProps {
  grupo: string;
  titulo: string;
  descripcion: string;
  fields: FieldConfig[];
  headers: string[];
  renderRow: (item: ConfigItem) => React.ReactNode;
}

export default function ConfigTable({ grupo, titulo, descripcion, fields, headers, renderRow }: ConfigTableProps) {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params: Record<string, string> = { grupo };
      if (searchInput) params.search = searchInput;
      const { data } = await api.get('/configuraciones', { params });
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setItems([]);
      if (err.response?.status === 403) {
        setLoadError('No tiene permisos para ver esta sección. Se requiere el rol Administrador.');
      } else {
        setLoadError('Error al cargar los registros.');
      }
    } finally { setLoading(false); }
  }, [grupo, searchInput]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openForm = (item?: ConfigItem) => {
    if (item) {
      setEditingId(item.id);
      setForm({ clave: item.clave, valor: item.valor, descripcion: item.descripcion || '' });
    } else {
      setEditingId(null);
      setForm({ valor: '', descripcion: '' });
    }
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async () => {
    const requiredFields = fields.filter(f => f.required && (editingId || f.key !== 'clave'));
    for (const f of requiredFields) {
      if (!form[f.key]) {
        setFormError(`${f.label} es requerido`);
        return;
      }
    }
    setFormSaving(true);
    setFormError('');
    try {
      const url = editingId ? `/configuraciones/${editingId}` : '/configuraciones';
      const method = editingId ? 'PUT' : 'POST';
      let body: any;
      if (editingId) {
        body = { valor: form.valor, descripcion: form.descripcion };
      } else {
        const clave = form.valor.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        body = { clave, valor: form.valor, descripcion: form.descripcion, grupo };
      }
      await api({ url, method, data: body });
      setFormOpen(false);
      fetchItems();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar');
    } finally { setFormSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este registro?')) return;
    try {
      await api.delete(`/configuraciones/${id}`);
      fetchItems();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-main">{titulo}</h2>
        <p className="text-text-sec text-sm mt-1">{descripcion}</p>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input type="text" placeholder="Buscar..." value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchItems(); }}
              className="w-72 px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <button onClick={fetchItems}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Buscar
            </button>
          </div>
          <button onClick={() => openForm()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {headers.map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">{h}</th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={headers.length + 1} className="px-4 py-12 text-center">
                  <svg className="animate-spin w-5 h-5 mx-auto text-text-sec" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                </td></tr>
              ) : loadError ? (
                <tr><td colSpan={headers.length + 1} className="px-4 py-12 text-center text-sm" style={{ color: '#DC2626' }}>{loadError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={headers.length + 1} className="px-4 py-12 text-center text-text-sec">No hay registros</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    {renderRow(item)}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openForm(item)} className="p-1.5 rounded hover:bg-amber-50 text-amber-500" title="Editar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Eliminar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFormOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[500px] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-main">{editingId ? 'Editar' : 'Nuevo'} {titulo.replace('Configuración - ', '')}</h3>
              <button onClick={() => setFormOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{formError}</div>}
              {fields.filter(f => editingId || f.key !== 'clave').map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">{f.label} {f.required && '*'}</label>
                  <input type={f.type || 'text'} value={form[f.key] || ''}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                    placeholder={f.placeholder}
                    disabled={f.disabledOnEdit && !!editingId} />
                </div>
              ))}
            </div>
            <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={handleSave} disabled={formSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {formSaving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
