'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Drawer from '@/components/ui/Drawer';
import * as XLSX from 'xlsx';
import api from '@/lib/api';

interface ColegiadoFAM {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  ESTADO: string;
  TIPO_ASOCIADO: string;
  OBSERVACION: string;
  FECHA_FAM: string | null;
  FECHA_ULTIMO_PAGO: string | null;
  FECHA_INGRESO: string | null;
  NUM_BENEFICIARIOS: number;
  SUMA_PORCENTAJE: number;
}

interface Beneficiario {
  FAM_ID: string;
  NOMBRE_BENEFICIARIO: string;
  DNI: string;
  PARENTESCO: string;
  PORCENTAJE: number;
}

interface MontoFamConfig {
  id: number;
  nombre: string;
  aplicaA: string | null;
  monto: number;
  activo: boolean;
}

interface CovidInfo {
  tieneAsignacion: boolean;
  asignacionId?: string;
  monto?: number;
}

interface AutocompleteItem {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  ESTADO: string;
}

const PARENTESCO_COLORS: Record<string, string> = {
  'Conyugue': 'bg-purple-100 text-purple-700',
  'Madre': 'bg-pink-100 text-pink-700',
  'Padre': 'bg-blue-100 text-blue-700',
  'Hijo(a)': 'bg-green-100 text-green-700',
  'Hermano(a)': 'bg-amber-100 text-amber-700',
  'Tio(a)': 'bg-indigo-100 text-indigo-700',
  'Primo(a)': 'bg-cyan-100 text-cyan-700',
  'Abuelo(a)': 'bg-orange-100 text-orange-700',
  'Otros': 'bg-gray-100 text-gray-700',
};

const PARENTESCO_OPTIONS = ['Conyugue', 'Madre', 'Padre', 'Hijo(a)', 'Hermano(a)', 'Tio(a)', 'Primo(a)', 'Abuelo(a)', 'Otros'];

const IMG_TABS = [
  { key: 'dniCara', label: 'DNI Anverso' },
  { key: 'dniReverso', label: 'DNI Reverso' },
  { key: 'cartaDeclaratoria', label: 'Carta Declaratoria' },
  { key: 'sucesionIntestada', label: 'Sucesion Intestada' },
];

interface FormBeneficiario {
  nombre: string;
  dni: string;
  parentesco: string;
  porcentaje: string;
  observaciones: string;
  colegiadoId: string | undefined;
}

interface PersonaSearch {
  PERSONA_ID: string;
  NOMBRE_COMPLETO: string;
  DNI: string;
  NOMBRES: string;
  APELLIDO_PATERNO: string;
  APELLIDO_MATERNO: string;
  COLEGIADO_ID: string | undefined;
}

interface FormImagenes {
  dniCara: string;
  dniReverso: string;
  cartaDeclaratoria: string;
  sucesionIntestada: string;
}

const emptyForm: FormBeneficiario = { nombre: '', dni: '', parentesco: 'Hijo(a)', porcentaje: '', observaciones: '', colegiadoId: '' };
const emptyImgs: FormImagenes = { dniCara: '', dniReverso: '', cartaDeclaratoria: '', sucesionIntestada: '' };

export default function FamPage() {
  const router = useRouter();
  const [colegiados, setColegiados] = useState<ColegiadoFAM[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterBeneficiarios, setFilterBeneficiarios] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [exportando, setExportando] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedColegiado, setSelectedColegiado] = useState<ColegiadoFAM | null>(null);
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [montosFam, setMontosFam] = useState<MontoFamConfig[]>([]);
  const [covidInfo, setCovidInfo] = useState<CovidInfo | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [form, setForm] = useState<FormBeneficiario>(emptyForm);
  const [formImgs, setFormImgs] = useState<FormImagenes>(emptyImgs);
  const [formError, setFormError] = useState('');

  const [personaSearchInput, setPersonaSearchInput] = useState('');
  const [personaSuggestions, setPersonaSuggestions] = useState<PersonaSearch[]>([]);
  const [showPersonaSuggestions, setShowPersonaSuggestions] = useState(false);
  const personaSearchRef = useRef<HTMLDivElement>(null);
  const personaDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBeneficiario, setDetailBeneficiario] = useState<Beneficiario | null>(null);
  const [detailColegiado, setDetailColegiado] = useState<ColegiadoFAM | null>(null);
  const [detailImg, setDetailImg] = useState<{ dniCara: string | null; dniReverso: string | null; cartaDeclaratoria: string | null; sucesionIntestada: string | null } | null>(null);
  const [detailImgActive, setDetailImgActive] = useState('dniCara');

  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState('');
  const [zoomAlt, setZoomAlt] = useState('');
  const openZoom = (src: string, alt: string) => { setZoomSrc(src); setZoomAlt(alt); setZoomOpen(true); };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (personaSearchRef.current && !personaSearchRef.current.contains(e.target as Node)) {
        setShowPersonaSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchColegiados = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (search) params.search = search;
      if (filterEstado) params.estado = filterEstado;
      if (filterBeneficiarios) params.conBeneficiarios = filterBeneficiarios;
      const { data } = await api.get('/fam/beneficiarios', { params });
      setColegiados(data.data || []);
      setTotal(data.total || 0);
    } catch { setColegiados([]); } finally { setLoading(false); }
  }, [page, limit, search, filterEstado, filterBeneficiarios]);

  useEffect(() => { fetchColegiados(); }, [fetchColegiados]);

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const { data } = await api.get('/fam/autocomplete', { params: { q: value.trim() } });
          setSuggestions(data);
          setShowSuggestions(true);
        } catch {}
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (item: AutocompleteItem) => {
    setSearchInput(`${item.NUM_COLEGIATURA} - ${item.NOMBRE_COLEGIADO}`);
    setSearch(item.NUM_COLEGIATURA);
    setShowSuggestions(false);
    setPage(1);
  };

  const handleBuscar = () => {
    setPage(1);
    setSearch(searchInput);
    setShowSuggestions(false);
  };

  const handleLimpiar = () => {
    setSearchInput('');
    setSearch('');
    setFilterEstado('');
    setFilterBeneficiarios('');
    setPage(1);
  };

  const handlePersonaSearch = (value: string) => {
    setPersonaSearchInput(value);
    if (personaDebounceRef.current) clearTimeout(personaDebounceRef.current);

    if (value.trim().length >= 2) {
      personaDebounceRef.current = setTimeout(async () => {
        try {
          const { data } = await api.get('/fam/buscar-personas', { params: { q: value.trim() } });
          setPersonaSuggestions(data);
          setShowPersonaSuggestions(true);
        } catch {}
      }, 300);
    } else {
      setPersonaSuggestions([]);
      setShowPersonaSuggestions(false);
    }
  };

  const selectPersona = (persona: PersonaSearch) => {
    setForm({ ...form, nombre: persona.NOMBRE_COMPLETO, dni: persona.DNI, colegiadoId: persona.COLEGIADO_ID });
    setPersonaSearchInput(persona.NOMBRE_COMPLETO);
    setShowPersonaSuggestions(false);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleExportar = async () => {
    setExportando(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterEstado) params.estado = filterEstado;
      if (filterBeneficiarios) params.conBeneficiarios = filterBeneficiarios;
      const { data } = await api.get('/fam/exportar', { params });
      if (!data || data.length === 0) {
        alert('No hay datos para exportar con los filtros seleccionados.');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data.map((r: any) => ({
        'CIP': r.CIP,
        'DNI': r.DNI,
        'Colegiado': r.COLEGIADO,
        'Estado': r.ESTADO,
        'Tipo Asociado': r.TIPO_ASOCIADO,
        'Observaciones': r.OBSERVACION,
        'F. Incorporacion': r.INCORPORACION || '',
        'Ultimo Pago': r.ULTIMO_PAGO || '',
        'N° Beneficiarios': r.NUM_BENEFICIARIOS,
        'Suma %': r.SUMA_PORCENTAJE,
      })));

      ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 35 }, { wch: 15 },
        { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 10 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FAM');
      XLSX.writeFile(wb, `FAM_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      console.error('Error en handleExportar:', err);
      alert(err.response?.data?.message || err.message || 'Error al generar el archivo Excel.');
    } finally {
      setExportando(false);
    }
  };

  const openBeneficiarios = async (colegiado: ColegiadoFAM) => {
    setSelectedColegiado(colegiado);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const [benData, montosData, covidData] = await Promise.all([
        api.get(`/fam/colegiado/${colegiado.COLEGIADO_ID}/beneficiarios`).catch(() => ({ data: [] })),
        api.get('/configuraciones/montos-fam').catch(() => ({ data: [] })),
        api.get(`/fam-covid/colegiado/${colegiado.COLEGIADO_ID}`).catch(() => ({ data: null })),
      ]);
      setBeneficiarios(Array.isArray(benData.data) ? benData.data : []);
      setMontosFam((Array.isArray(montosData.data) ? montosData.data : []).filter((m: MontoFamConfig) => m.activo));
      setCovidInfo(covidData.data);
    } catch { setBeneficiarios([]); setMontosFam([]); setCovidInfo(null); } finally { setDrawerLoading(false); }
  };

  const reloadBeneficiarios = async () => {
    if (!selectedColegiado) return;
    try {
      const [benData, montosData, covidData] = await Promise.all([
        api.get(`/fam/colegiado/${selectedColegiado.COLEGIADO_ID}/beneficiarios`).catch(() => ({ data: [] })),
        api.get('/configuraciones/montos-fam').catch(() => ({ data: [] })),
        api.get(`/fam-covid/colegiado/${selectedColegiado.COLEGIADO_ID}`).catch(() => ({ data: null })),
      ]);
      setBeneficiarios(Array.isArray(benData.data) ? benData.data : []);
      setMontosFam((Array.isArray(montosData.data) ? montosData.data : []).filter((m: MontoFamConfig) => m.activo));
      setCovidInfo(covidData.data);
    } catch {}
  };

  const openDetail = async (b: Beneficiario, col: ColegiadoFAM) => {
    setDetailBeneficiario(b);
    setDetailColegiado(col);
    setDetailImg(null);
    setDetailImgActive('dniCara');
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/fam/beneficiario/${b.FAM_ID}/imagenes`);
      setDetailImg(data);
    } catch { setDetailImg(null); } finally { setDetailLoading(false); }
  };

  const handleFileUpload = (key: keyof FormImagenes, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(',')[1] || '';
      setFormImgs((prev) => ({ ...prev, [key]: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateBeneficiario = async () => {
    if (!selectedColegiado) return;
    if (!form.nombre.trim()) { setFormError('El nombre es requerido'); return; }
    if (!form.porcentaje || Number(form.porcentaje) <= 0) { setFormError('El porcentaje debe ser mayor a 0'); return; }
    setFormError('');
    setFormSaving(true);
    try {
      const body: any = {
        nombre: form.nombre.trim(),
        dni: form.dni.trim() || undefined,
        parentesco: form.parentesco,
        porcentaje: Number(form.porcentaje),
        observaciones: form.observaciones.trim() || undefined,
      };
      const hasImages = formImgs.dniCara || formImgs.dniReverso || formImgs.cartaDeclaratoria || formImgs.sucesionIntestada;
      if (hasImages) {
        body.imagenes = {};
        if (formImgs.dniCara) body.imagenes.dniCara = formImgs.dniCara;
        if (formImgs.dniReverso) body.imagenes.dniReverso = formImgs.dniReverso;
        if (formImgs.cartaDeclaratoria) body.imagenes.cartaDeclaratoria = formImgs.cartaDeclaratoria;
        if (formImgs.sucesionIntestada) body.imagenes.sucesionIntestada = formImgs.sucesionIntestada;
      }
      await api.post(`/fam/colegiado/${selectedColegiado.COLEGIADO_ID}/beneficiarios`, body);
      setFormOpen(false);
      setForm(emptyForm);
      setFormImgs(emptyImgs);
      setPersonaSearchInput('');
      setPersonaSuggestions([]);
      await reloadBeneficiarios();
    } catch (err: any) { setFormError(err.response?.data?.message || 'Error al crear'); } finally { setFormSaving(false); }
  };

  const sortedData = [...colegiados].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey as keyof ColegiadoFAM] ?? '';
    const bVal = b[sortKey as keyof ColegiadoFAM] ?? '';
    if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
  });

  const totalPages = Math.ceil(total / limit);

  const porcentajeTotal = (item: ColegiadoFAM) => {
    if (item.SUMA_PORCENTAJE > 100) return 'text-red-600 bg-red-50';
    if (item.SUMA_PORCENTAJE === 100) return 'text-green-600 bg-green-50';
    return 'text-amber-600 bg-amber-50';
  };

  const formatFecha = (fecha: string | null) =>
    fecha ? new Date(fecha).toLocaleDateString('es-PE') : '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-text-main">Fondo de Ayuda Mutua (FAM)</h2>
          <p className="text-text-sec text-sm mt-1">Beneficiarios registrados y porcentajes asignados</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button onClick={() => router.push('/dashboard/fam/registro')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo registro
          </button>
          <button onClick={handleExportar} disabled={exportando}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {exportando ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          )}
          {exportando ? 'Exportando...' : 'Descargar Excel'}
        </button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
            <div className="flex-1 w-full sm:max-w-md relative" ref={suggestionsRef}>
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sec" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por CIP, DNI, nombre o apellido..."
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBuscar(); }}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button key={s.COLEGIADO_ID}
                      onClick={() => selectSuggestion(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-border last:border-0 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-primary">{s.NUM_COLEGIATURA}</span>
                          <span className="text-sm text-text-main ml-2">{s.NOMBRE_COLEGIADO}</span>
                        </div>
                        <span className="text-xs text-text-sec">DNI: {s.DNI || '-'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Todos los estados</option>
              <option value="HABILITADO">Habilitado</option>
              <option value="NO HABILITADO">No Habilitado</option>
            </select>

            <select value={filterBeneficiarios} onChange={(e) => setFilterBeneficiarios(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Todos</option>
              <option value="SI">Con beneficiarios</option>
              <option value="NO">Sin beneficiarios</option>
            </select>

            <button onClick={handleBuscar}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Buscar
            </button>

            <button onClick={handleLimpiar}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Limpiar
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-text-sec">Mostrar</span>
              <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
              </select>
              <span className="text-sm text-text-sec">por pagina</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec uppercase tracking-wider w-16"></th>
                {[
                  { key: 'NUM_COLEGIATURA', label: 'CIP' },
                  { key: 'NOMBRE_COLEGIADO', label: 'Colegiado' },
                  { key: 'ESTADO', label: 'Estado' },
                  { key: 'TIPO_ASOCIADO', label: 'Tipo Asociado' },
                  { key: 'FECHA_INGRESO', label: 'F. Incorporacion' },
                  { key: 'FECHA_ULTIMO_PAGO', label: 'Ultimo Pago' },
                  { key: 'NUM_BENEFICIARIOS', label: 'Beneficiarios' },
                  { key: 'SUMA_PORCENTAJE', label: 'Porcentaje' },
                ].map((col) => (
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    className="text-left px-4 py-3 text-xs font-semibold text-text-sec uppercase tracking-wider cursor-pointer hover:text-text-main select-none">
                    {col.label}{sortKey === col.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <div className="inline-flex items-center gap-2 text-text-sec">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Cargando registros...
                  </div>
                </td></tr>
              ) : sortedData.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-text-sec">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm">No se encontraron colegiados con FAM</p>
                </td></tr>
              ) : (
                sortedData.map((item) => (
                  <tr key={item.COLEGIADO_ID} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => openBeneficiarios(item)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors group" title="Ver beneficiarios">
                        <svg className="w-4 h-4 text-blue-500 group-hover:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-primary">{item.NUM_COLEGIATURA}</span>
                      <span className="block text-xs text-text-sec">DNI: {item.DNI || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-main font-medium">{item.NOMBRE_COLEGIADO}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${item.ESTADO === 'HABILITADO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.ESTADO}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${item.TIPO_ASOCIADO === 'Vitalicio' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>{item.TIPO_ASOCIADO}</span></td>
                    <td className="px-4 py-3 text-sm text-text-main whitespace-nowrap">{formatFecha(item.FECHA_INGRESO)}</td>
                    <td className="px-4 py-3 text-sm text-text-main whitespace-nowrap">{formatFecha(item.FECHA_ULTIMO_PAGO)}</td>
                    <td className="px-4 py-3 text-center"><span className="inline-flex items-center justify-center w-7 h-7 text-sm font-bold text-white bg-primary rounded-full">{item.NUM_BENEFICIARIOS}</span></td>
                    <td className="px-4 py-3 text-right"><span className={`inline-flex px-2.5 py-1 text-sm font-bold rounded-lg ${porcentajeTotal(item)}`}>{item.SUMA_PORCENTAJE}%</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-gray-50">
          <p className="text-sm text-text-sec">{total > 0 ? `Mostrando ${(page - 1) * limit + 1} a ${Math.min(page * limit, total)} de ${total.toLocaleString('es-PE')} colegiados` : 'Sin registros'}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1.5 text-sm border border-border rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'<<'}</button>
            <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-2 py-1.5 text-sm border border-border rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'<'}</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => { const start = Math.max(1, Math.min(page - 2, totalPages - 4)); const p = start + i; if (p > totalPages) return null; return (<button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 text-sm rounded border ${page === p ? 'bg-primary text-white border-primary' : 'border-border hover:bg-white'}`}>{p}</button>); })}
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="px-2 py-1.5 text-sm border border-border rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'>'}</button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="px-2 py-1.5 text-sm border border-border rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">{'>>'}</button>
          </div>
        </div>
      </div>

      <Drawer isOpen={drawerOpen} onClose={() => { setDrawerOpen(false); setBeneficiarios([]); setSelectedColegiado(null); setMontosFam([]); setCovidInfo(null); }}
        title={`Beneficiarios - ${selectedColegiado?.NUM_COLEGIATURA || ''}`} width="w-full sm:w-[520px]">
        {selectedColegiado && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between"><span className="text-xs text-text-sec uppercase">Colegiado</span><span className="text-sm font-semibold text-text-main">{selectedColegiado.NOMBRE_COLEGIADO}</span></div>
              <div className="flex justify-between"><span className="text-xs text-text-sec uppercase">Tipo Asociado</span><span className={`text-sm font-semibold ${selectedColegiado.TIPO_ASOCIADO === 'Vitalicio' ? 'text-indigo-600' : 'text-text-main'}`}>{selectedColegiado.TIPO_ASOCIADO}</span></div>
              <div className="flex justify-between"><span className="text-xs text-text-sec uppercase">Estado</span><span className={`text-sm font-semibold ${selectedColegiado.ESTADO === 'HABILITADO' ? 'text-green-600' : 'text-red-600'}`}>{selectedColegiado.ESTADO}</span></div>
              {selectedColegiado.OBSERVACION && (<div className="flex justify-between items-start"><span className="text-xs text-text-sec uppercase">Observaciones</span><span className="text-sm text-text-main max-w-[250px] text-right">{selectedColegiado.OBSERVACION}</span></div>)}
              <div className="flex justify-between pt-2 border-t border-border"><span className="text-xs text-text-sec uppercase">Total % Asignado</span><span className={`text-sm font-bold ${selectedColegiado.SUMA_PORCENTAJE > 100 ? 'text-red-600' : selectedColegiado.SUMA_PORCENTAJE === 100 ? 'text-green-600' : 'text-amber-600'}`}>{selectedColegiado.SUMA_PORCENTAJE}%</span></div>
            </div>

            {covidInfo?.tieneAsignacion && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                <span className="text-amber-600 text-sm">&#9888;</span>
                <span className="text-xs text-amber-800">Ayuda COVID <strong>S/ {covidInfo.monto?.toFixed(2)}</strong> — se descontar&aacute; del beneficio de Fallecimiento</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider">Beneficiarios ({beneficiarios.length})</h4>
              <button onClick={() => { setForm(emptyForm); setFormImgs(emptyImgs); setFormError(''); setPersonaSearchInput(''); setPersonaSuggestions([]); setFormOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Agregar
              </button>
            </div>

            {drawerLoading ? (
              <div className="text-center py-8"><svg className="animate-spin w-6 h-6 mx-auto text-primary" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
            ) : beneficiarios.length === 0 ? (
              <p className="text-sm text-text-sec text-center py-6">No hay beneficiarios registrados</p>
            ) : (
              <div className="space-y-2">
                {beneficiarios.map((b) => (
                  <div key={b.FAM_ID} className="border border-border rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-main truncate">{b.NOMBRE_BENEFICIARIO}</p>
                        <p className="text-xs text-text-sec mt-0.5">DNI: {b.DNI || '-'}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openDetail(b, selectedColegiado)}
                          className="p-1 rounded hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700 transition-colors" title="Ver detalle">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${PARENTESCO_COLORS[b.PARENTESCO] || 'bg-gray-100 text-gray-700'}`}>{b.PARENTESCO}</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1"><span className="text-xs text-text-sec">Porcentaje</span><span className={`text-sm font-bold ${b.PORCENTAJE >= 100 ? 'text-blue-600' : b.PORCENTAJE >= 50 ? 'text-green-600' : 'text-amber-600'}`}>{b.PORCENTAJE}%</span></div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5"><div className={`h-1.5 rounded-full transition-all ${b.PORCENTAJE >= 100 ? 'bg-blue-500' : b.PORCENTAJE >= 50 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(b.PORCENTAJE, 100)}%` }} /></div>
                      {montosFam.length > 0 && (
                        <div className="mt-2.5 border-t border-border pt-2 space-y-1.5">
                          {montosFam.map((m) => {
                            const esFallecimiento = (m.aplicaA || '').toUpperCase() === 'FALLECIMIENTO';
                            const descuento = esFallecimiento && covidInfo?.tieneAsignacion ? (covidInfo.monto || 0) : 0;
                            const neto = Math.max(0, m.monto - descuento);
                            const corresponde = (b.PORCENTAJE / 100) * neto;
                            return (
                              <div key={m.id} className="flex items-center justify-between text-xs">
                                <span className="text-text-sec truncate max-w-[120px]">{m.nombre}</span>
                                <div className="flex items-center gap-1.5">
                                  {descuento > 0 && <span className="text-text-sec line-through">S/ {m.monto.toFixed(2)}</span>}
                                  {descuento > 0 && <span className="text-amber-600">−S/ {descuento.toFixed(2)}</span>}
                                  <span className="font-semibold text-green-700">S/ {neto.toFixed(2)}</span>
                                  <span className="text-text-sec">→</span>
                                  <span className="font-bold text-green-700">S/ {corresponde.toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {formOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFormOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full sm:w-[700px] sm:max-w-[96vw] max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
              <div><h3 className="text-lg font-semibold text-text-main">Agregar Beneficiario</h3><p className="text-sm text-text-sec">{selectedColegiado?.NUM_COLEGIATURA} - {selectedColegiado?.NOMBRE_COLEGIADO}</p></div>
              <button onClick={() => setFormOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{formError}</div>}
              <div className="space-y-4">
                <div className="relative" ref={personaSearchRef}>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Buscar persona en padrón *</label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Buscar por nombre, DNI o CIP..."
                      value={personaSearchInput}
                      onChange={(e) => handlePersonaSearch(e.target.value)}
                      onFocus={() => personaSuggestions.length > 0 && setShowPersonaSuggestions(true)}
                      className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  {showPersonaSuggestions && personaSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {personaSuggestions.map((p) => (
                        <button key={p.PERSONA_ID}
                          onClick={() => selectPersona(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-border last:border-0 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-text-main">{p.NOMBRE_COMPLETO}</span>
                            <span className="text-xs text-text-sec">DNI: {p.DNI || '-'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showPersonaSuggestions && personaSuggestions.length === 0 && personaSearchInput.length >= 2 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg px-4 py-3">
                      <p className="text-sm text-text-sec">No se encontraron resultados. Puede escribir el nombre manualmente.</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-text-sec uppercase mb-1">Nombre completo *</label><input type="text" value={form.nombre} onChange={(e) => { setForm({ ...form, nombre: e.target.value }); setPersonaSearchInput(e.target.value); }} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Nombres y apellidos" /></div>
                  <div><label className="block text-xs font-medium text-text-sec uppercase mb-1">DNI</label><input type="text" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="8 digitos" maxLength={8} /></div>
                  <div><label className="block text-xs font-medium text-text-sec uppercase mb-1">Parentesco *</label><select value={form.parentesco} onChange={(e) => setForm({ ...form, parentesco: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">{PARENTESCO_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                  <div><label className="block text-xs font-medium text-text-sec uppercase mb-1">Porcentaje (%) *</label><input type="number" min="0" max="100" step="0.01" value={form.porcentaje} onChange={(e) => setForm({ ...form, porcentaje: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="0 - 100" /></div>
                </div>
              </div>
              <div><label className="block text-xs font-medium text-text-sec uppercase mb-1">Observaciones</label><textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" rows={2} placeholder="Notas..." /></div>
              <div>
                <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Documentos (imagenes)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {IMG_TABS.map((tab) => {
                    const key = tab.key as keyof FormImagenes;
                    const hasImg = !!formImgs[key];
                    return (
                      <div key={tab.key} className="border border-border rounded-lg p-3">
                        <label className="block text-xs font-medium text-text-sec mb-2">{tab.label}</label>
                        {hasImg ? (
                          <div className="relative group">
                            <img src={`data:image/jpeg;base64,${formImgs[key]}`} alt={tab.label} className="w-full h-24 object-contain rounded bg-gray-50" />
                            <button onClick={() => setFormImgs((prev) => ({ ...prev, [key]: '' }))}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <svg className="w-6 h-6 text-text-sec mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-xs text-text-sec">Subir imagen</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(key, e.target.files[0]); }} />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-4 sm:px-6 py-3 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={handleCreateBeneficiario} disabled={formSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                {formSaving && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                Guardar Beneficiario
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && detailBeneficiario && detailColegiado && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full sm:w-[800px] sm:max-w-[96vw] max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
              <div><h3 className="text-lg font-semibold text-text-main">Detalle del Beneficiario</h3><p className="text-sm text-text-sec">{detailBeneficiario.NOMBRE_BENEFICIARIO}</p></div>
              <button onClick={() => setDetailOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 sm:py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Datos del Colegiado</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between"><span className="text-sm text-text-sec">CIP</span><span className="text-sm font-semibold text-primary">{detailColegiado.NUM_COLEGIATURA}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Nombre</span><span className="text-sm font-medium text-text-main">{detailColegiado.NOMBRE_COLEGIADO}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">DNI</span><span className="text-sm text-text-main">{detailColegiado.DNI || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Estado</span><span className={`text-sm font-semibold ${detailColegiado.ESTADO === 'HABILITADO' ? 'text-green-600' : 'text-red-600'}`}>{detailColegiado.ESTADO}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Tipo Asociado</span><span className={`text-sm font-semibold ${detailColegiado.TIPO_ASOCIADO === 'Vitalicio' ? 'text-indigo-600' : 'text-text-main'}`}>{detailColegiado.TIPO_ASOCIADO}</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Datos del Beneficiario</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Nombre</span><span className="text-sm font-medium text-text-main">{detailBeneficiario.NOMBRE_BENEFICIARIO}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">DNI</span><span className="text-sm text-text-main">{detailBeneficiario.DNI || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-text-sec">Parentesco</span><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${PARENTESCO_COLORS[detailBeneficiario.PARENTESCO] || 'bg-gray-100 text-gray-700'}`}>{detailBeneficiario.PARENTESCO}</span></div>
                      <div className="flex justify-between items-center"><span className="text-sm text-text-sec">Porcentaje</span><span className={`text-lg font-bold ${detailBeneficiario.PORCENTAJE >= 100 ? 'text-blue-600' : detailBeneficiario.PORCENTAJE >= 50 ? 'text-green-600' : 'text-amber-600'}`}>{detailBeneficiario.PORCENTAJE}%</span></div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1"><div className={`h-2 rounded-full transition-all ${detailBeneficiario.PORCENTAJE >= 100 ? 'bg-blue-500' : detailBeneficiario.PORCENTAJE >= 50 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(detailBeneficiario.PORCENTAJE, 100)}%` }} /></div>
                      {montosFam.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          <h5 className="text-[10px] font-semibold text-text-sec uppercase tracking-wider">Estimaci&oacute;n de pagos</h5>
                          {montosFam.map((m) => {
                            const esFallecimiento = (m.aplicaA || '').toUpperCase() === 'FALLECIMIENTO';
                            const descuento = esFallecimiento && covidInfo?.tieneAsignacion ? (covidInfo.monto || 0) : 0;
                            const neto = Math.max(0, m.monto - descuento);
                            const corresponde = (detailBeneficiario.PORCENTAJE / 100) * neto;
                            return (
                              <div key={m.id} className="flex items-center justify-between text-xs">
                                <span className="text-text-sec truncate max-w-[140px]">{m.nombre}</span>
                                <div className="flex items-center gap-1.5">
                                  {descuento > 0 && <span className="text-text-sec line-through">S/ {m.monto.toFixed(2)}</span>}
                                  {descuento > 0 && <span className="text-amber-600">−S/ {descuento.toFixed(2)}</span>}
                                  <span className="font-semibold text-green-700">S/ {neto.toFixed(2)}</span>
                                  <span className="text-text-sec">→</span>
                                  <span className="font-bold text-green-700">S/ {corresponde.toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider mb-3">Documentos</h4>
                    <div className="flex gap-2 mb-3">
                      {IMG_TABS.map((tab) => { const hasData = detailImg && (detailImg as any)[tab.key]; return (<button key={tab.key} onClick={() => setDetailImgActive(tab.key)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${detailImgActive === tab.key ? 'bg-primary text-white' : hasData ? 'bg-white text-text-main hover:bg-gray-100 border border-border' : 'bg-gray-100 text-text-sec cursor-not-allowed opacity-50'}`} disabled={!hasData}>{tab.label}</button>); })}
                    </div>
                    <div className="bg-white border border-border rounded-lg overflow-hidden">
                      {detailLoading ? (
                        <div className="text-center py-12"><svg className="animate-spin w-6 h-6 mx-auto text-primary" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
                      ) : detailImg && (detailImg as any)[detailImgActive] ? (
                        <div className="p-2">
                          <img src={`data:image/jpeg;base64,${(detailImg as any)[detailImgActive]}`}
                            alt={IMG_TABS.find(t => t.key === detailImgActive)?.label || ''}
                            className="w-full max-h-[350px] object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => openZoom(`data:image/jpeg;base64,${(detailImg as any)[detailImgActive]}`, IMG_TABS.find(t => t.key === detailImgActive)?.label || '')}
                            title="Click para ampliar" />
                        </div>
                      ) : (
                        <div className="text-center py-12"><p className="text-sm text-text-sec">Sin documento</p></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 sm:px-6 py-3 border-t border-border flex justify-end"><button onClick={() => setDetailOpen(false)} className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cerrar</button></div>
          </div>
        </div>
      )}

      {zoomOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center cursor-zoom-out" onClick={() => setZoomOpen(false)}>
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center">
            <p className="text-white text-sm mb-3 font-medium">{zoomAlt}</p>
            <img src={zoomSrc} alt={zoomAlt} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <p className="text-white/60 text-xs mt-3">Click en cualquier lugar para cerrar</p>
          </div>
        </div>
      )}
    </div>
  );
}
