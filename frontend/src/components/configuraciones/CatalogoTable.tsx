'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface CatalogoItem {
  id: number;
  [key: string]: any;
}

export interface CatalogoCampo {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'checkbox' | 'date';
  options?: { value: string; label: string }[];
  required?: boolean;
  hideOnCreate?: boolean;
  placeholder?: string;
}

export interface CatalogoColumna {
  key: string;
  label: string;
  render?: (item: CatalogoItem) => React.ReactNode;
}

interface CatalogoTableProps {
  endpoint: string;
  titulo: string;
  descripcion: string;
  columnas: CatalogoColumna[];
  campos: CatalogoCampo[];
}

export default function CatalogoTable({ endpoint, titulo, descripcion, columnas, campos }: CatalogoTableProps) {
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/${endpoint}`);
      const list: CatalogoItem[] = Array.isArray(data) ? data : [];
      if (searchInput.trim()) {
        const q = searchInput.trim().toLowerCase();
        setItems(list.filter((i) =>
          campos.some((c) => String(i[c.key] ?? '').toLowerCase().includes(q)),
        ));
      } else {
        setItems(list);
      }
    } catch (err: any) {
      setItems([]);
      if (err.response?.status === 403) {
        setLoadError('No tiene permisos para ver esta sección. Se requiere el rol Administrador.');
      }
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, searchInput]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openForm = (item?: CatalogoItem) => {
    if (item) {
      setEditingId(item.id);
      const f: Record<string, any> = {};
      campos.forEach((c) => {
        f[c.key] = c.type === 'checkbox' ? !!item[c.key] : (item[c.key] ?? '');
      });
      setForm(f);
    } else {
      setEditingId(null);
      const f: Record<string, any> = {};
      campos.forEach((c) => { f[c.key] = c.type === 'checkbox' ? false : ''; });
      setForm(f);
    }
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async () => {
    for (const c of campos) {
      if (editingId && c.hideOnCreate) continue;
      if (c.required && c.type !== 'checkbox' && !String(form[c.key] ?? '').trim()) {
        setFormError(`${c.label} es requerido`);
        return;
      }
    }
    setFormSaving(true);
    setFormError('');
    try {
      const body: Record<string, any> = {};
      campos.forEach((c) => {
        if (!editingId && c.hideOnCreate) return;
        const v = form[c.key];
        if (c.type === 'number') body[c.key] = v === '' ? undefined : Number(v);
        else if (c.type === 'checkbox') body[c.key] = !!v;
        else body[c.key] = v === '' ? undefined : v;
      });
      if (editingId) {
        await api.put(`/${endpoint}/${editingId}`, body);
      } else {
        await api.post(`/${endpoint}`, body);
      }
      setFormOpen(false);
      fetchItems();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar');
    } finally { setFormSaving(false); }
  };

  const handleDelete = async (item: CatalogoItem) => {
    const etiqueta = item.nombre || `ID ${item.id}`;
    if (!confirm(`¿Está seguro de eliminar '${etiqueta}'?`)) return;
    try {
      await api.delete(`/${endpoint}/${item.id}`);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-main">{titulo}</h2>
        <p className="text-text-sec text-sm mt-1">{descripcion}</p>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <input type="text" placeholder="Buscar..." value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-72 px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
                {columnas.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">{col.label}</th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={columnas.length + 1} className="px-4 py-12 text-center">
                  <svg className="animate-spin w-5 h-5 mx-auto text-text-sec" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                </td></tr>
              ) : loadError ? (
                <tr><td colSpan={columnas.length + 1} className="px-4 py-12 text-center text-sm" style={{ color: '#DC2626' }}>{loadError}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={columnas.length + 1} className="px-4 py-12 text-center text-text-sec">No hay registros</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    {columnas.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        {col.render ? col.render(item) : <span className="text-sm text-text-main">{item[col.key] ?? '-'}</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openForm(item)} className="p-1.5 rounded hover:bg-amber-50 text-amber-500" title="Editar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Eliminar">
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
              <h3 className="text-lg font-semibold text-text-main">{editingId ? 'Editar' : 'Nuevo'}: {titulo}</h3>
              <button onClick={() => setFormOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{formError}</div>}
              {campos.filter((c) => !(editingId === null && c.hideOnCreate)).map((c) => (
                <div key={c.key}>
                  {c.type === 'checkbox' ? (
                    <div className="flex items-center gap-2">
                      <input id={`chk-${c.key}`} type="checkbox" checked={!!form[c.key]}
                        onChange={(e) => setForm({ ...form, [c.key]: e.target.checked })}
                        className="w-4 h-4 accent-[#3258CA]" />
                      <label htmlFor={`chk-${c.key}`} className="text-sm text-text-main">{c.label}</label>
                    </div>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-text-sec uppercase mb-1">{c.label} {c.required && '*'}</label>
                      {c.type === 'select' ? (
                        <select value={form[c.key] ?? ''} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                          <option value="">-- Seleccione --</option>
                          {(c.options || []).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input type={c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text'} value={form[c.key] ?? ''}
                          onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                          placeholder={c.placeholder} />
                      )}
                    </>
                  )}
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
