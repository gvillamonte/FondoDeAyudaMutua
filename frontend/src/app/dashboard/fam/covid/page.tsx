'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import ConfirmCenterMessage, { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

interface Asignacion {
  id: string;
  colegiadoId: string;
  cip: string;
  dni: string;
  nombreColegiado: string;
  modalidadBeneficio: string;
  monto: number;
  fechaPago: string;
  activo: boolean;
  createdAt: string;
  memorando?: { numero: string; asunto?: string } | null;
  carta?: { numero: string; referencia?: string } | null;
  vinculos: any[];
  comprobantes: { id: string; importeTotal: number }[];
}

interface ColegiadoSel {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  ESTADO: string;
}

interface BeneficiarioRegistrado {
  key: string;
  id?: string;
  nombre: string;
  dni: string;
  parentesco: string;
  porcentaje: string;
}

interface ComprobanteRow {
  tipoComprobante: string;
  serie: string;
  numero: string;
  concepto: string;
  importeTotal: string;
  pdfFile: File | null;
  pdfBase64: string;
}

const MODALIDAD_OPTIONS = [
  { value: 'monto_unico', label: 'Monto Único', desc: 'Un solo beneficiario, 100% del monto' },
  { value: 'monto_compartido', label: 'Monto Compartido', desc: 'Múltiples beneficiarios con porcentajes' },
  { value: 'opcion_sucesiva', label: 'Opción Sucesiva', desc: 'Cobra el 1.° disponible; si falta, pasa al siguiente' },
];

const PARENTESCO_OPTIONS = ['Conyugue', 'Hijo(a)', 'Madre', 'Padre', 'Hermano(a)', 'Tio(a)', 'Primo(a)', 'Abuelo(a)', 'Otros'];
const TIPOS_COMPROBANTE = [
  { value: 'FACTURA', label: 'Factura' },
  { value: 'BOLETA', label: 'Boleta de Venta' },
  { value: 'RECIBO_HONORARIOS', label: 'Recibo por Honorarios' },
  { value: 'OTRO', label: 'Otro' },
];

export default function AyudaCovidPage() {
  const [tab, setTab] = useState<'lista' | 'registro'>('lista');
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<any>(null);

  // --- ESTADOS DEL FORMULARIO ---
  const [colegiado, setColegiado] = useState<ColegiadoSel | null>(null);
  const [sugerencias, setSugerencias] = useState<ColegiadoSel[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [cargandoBenes, setCargandoBenes] = useState(false);
  const [beneficiariosReg, setBeneficiariosReg] = useState<BeneficiarioRegistrado[]>([]);
  const [modalidad, setModalidad] = useState('monto_compartido');
  const [solicitanteKey, setSolicitanteKey] = useState<string | null>(null);
  const [monto, setMonto] = useState('200');
  const [fechaPago, setFechaPago] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [memorandoId, setMemorandoId] = useState('');
  const [cartaId, setCartaId] = useState('');
  const [memorandos, setMemorandos] = useState<any[]>([]);
  const [cartas, setCartas] = useState<any[]>([]);
  const [comprobantes, setComprobantes] = useState<ComprobanteRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- FETCH LISTA ---
  const fetchAsignaciones = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fam-covid', { params: { page, limit: 15, search } });
      setAsignaciones(data.data || []);
      setMeta(data.meta || { total: 0, totalPages: 1 });
    } catch { setAsignaciones([]); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchAsignaciones(); }, [fetchAsignaciones]);

  const onSearchChange = (val: string) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  };

  // --- FETCH CATÁLOGOS ---
  useEffect(() => {
    api.get('/memorandos', { params: { activos: 'true' } }).then(({ data }) => setMemorandos(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/cartas', { params: { activos: 'true' } }).then(({ data }) => setCartas(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  // --- AUTOCOMPLETE COLEGIADO ---
  const buscarColegiado = async (q: string) => {
    if (q.trim().length < 1) { setSugerencias([]); setShowSugerencias(false); return; }
    try {
      const { data } = await api.get('/fam/autocomplete', { params: { q } });
      setSugerencias(data || []);
      setShowSugerencias(true);
    } catch { setSugerencias([]); }
  };

  const seleccionarColegiado = async (col: ColegiadoSel) => {
    setColegiado(col);
    setShowSugerencias(false);
    setSearchInput(col.NUM_COLEGIATURA + ' - ' + col.NOMBRE_COLEGIADO);
    setBeneficiariosReg([]);
    setSolicitanteKey(null);
    setComprobantes([]);
    setError('');
    setCargandoBenes(true);
    try {
      const { data } = await api.get(`/fam/colegiado/${col.COLEGIADO_ID}/beneficiarios`);
      const registrados: BeneficiarioRegistrado[] = (Array.isArray(data) ? data : []).map((b: any) => ({
        key: String(b.FAM_ID || Math.random().toString(36).slice(2)),
        id: b.ORIGEN === 'SISTEMA' && b.FAM_ID ? String(b.FAM_ID) : undefined,
        nombre: b.NOMBRE_BENEFICIARIO || '',
        dni: b.DNI || '',
        parentesco: b.PARENTESCO || 'Hijo(a)',
        porcentaje: b.PORCENTAJE !== undefined && b.PORCENTAJE !== null ? String(b.PORCENTAJE) : '0',
      }));
      setBeneficiariosReg(registrados);
      if (registrados.length === 1) setSolicitanteKey(registrados[0].key);
    } catch { setBeneficiariosReg([]); }
    finally { setCargandoBenes(false); }
  };

  // --- COMPROBANTES ---
  const addComprobante = () => {
    setComprobantes([...comprobantes, { tipoComprobante: 'FACTURA', serie: '', numero: '', concepto: '', importeTotal: '', pdfFile: null, pdfBase64: '' }]);
  };

  const updateComprobante = (idx: number, field: string, val: any) => {
    const copia = [...comprobantes];
    (copia[idx] as any)[field] = val;
    setComprobantes(copia);
  };

  const removeComprobante = (idx: number) => {
    setComprobantes(comprobantes.filter((_, i) => i !== idx));
  };

  const onPdfUpload = (idx: number, file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showConfirmMessage('error', 'El PDF excede 10 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] || '';
      const copia = [...comprobantes];
      copia[idx].pdfFile = file;
      copia[idx].pdfBase64 = base64;
      setComprobantes(copia);
      showConfirmMessage('success', `Comprobante ${copia[idx].tipoComprobante} ${copia[idx].serie}-${copia[idx].numero} adjuntado`);
    };
    reader.readAsDataURL(file);
  };

  // --- SUMA ---
  const sumaPorcentajes = beneficiariosReg.reduce((s, b) => s + (Number(b.porcentaje) || 0), 0);
  const sumaImportes = comprobantes.reduce((s, c) => s + (Number(c.importeTotal) || 0), 0);

  // --- VALIDACIÓN ---
  const puedeGuardar = (): string => {
    if (!colegiado) return 'Seleccione un colegiado';
    if (beneficiariosReg.length === 0) return 'El colegiado no tiene beneficiarios registrados';
    if (modalidad === 'monto_unico' && beneficiariosReg.length !== 1) return 'Monto Único requiere exactamente 1 beneficiario';
    if (modalidad === 'monto_compartido' && sumaPorcentajes !== 100) return `Suma de porcentajes debe ser 100% (actual: ${sumaPorcentajes}%)`;
    if (!solicitanteKey) return 'Seleccione quién es el solicitante';
    if (!monto || Number(monto) <= 0) return 'Ingrese un monto válido';
    return '';
  };

  // --- GUARDAR ---
  const handleGuardar = async () => {
    const err = puedeGuardar();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      const idxSel = beneficiariosReg.findIndex((f) => f.key === solicitanteKey);
      const sel = beneficiariosReg[idxSel];

      const body: any = {
        colegiadoId: colegiado!.COLEGIADO_ID,
        modalidadBeneficio: modalidad,
        monto: Number(monto),
        fechaPago: fechaPago || undefined,
        memorandoId: memorandoId || undefined,
        cartaId: cartaId || undefined,
        observaciones: observaciones || undefined,
        beneficiarios: beneficiariosReg.map((b) => ({
          id: b.id,
          nombre: b.nombre,
          dni: b.dni || undefined,
          parentesco: b.parentesco,
          porcentaje: Number(b.porcentaje),
        })),
        solicitanteBeneficiarioId: sel?.id || undefined,
        solicitanteIndice: !sel?.id ? idxSel : undefined,
        solicitanteNombre: !sel?.id ? sel?.nombre : undefined,
        solicitanteDni: !sel?.id ? sel?.dni : undefined,
        comprobantes: comprobantes
          .filter((c) => c.tipoComprobante && c.importeTotal)
          .map((c) => ({
            tipoComprobante: c.tipoComprobante,
            serie: c.serie || undefined,
            numero: c.numero || undefined,
            concepto: c.concepto || undefined,
            importeTotal: Number(c.importeTotal),
            pdfBase64: c.pdfBase64 || undefined,
          })),
      };

      await api.post('/fam-covid', body);
      showConfirmMessage('success', `Asignación COVID registrada — S/ ${Number(monto).toFixed(2)}`, `${colegiado!.NOMBRE_COLEGIADO}`);
      resetForm();
      setTab('lista');
      fetchAsignaciones();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setColegiado(null);
    setBeneficiariosReg([]);
    setSolicitanteKey(null);
    setMonto('200');
    setFechaPago('');
    setObservaciones('');
    setMemorandoId('');
    setCartaId('');
    setComprobantes([]);
    setError('');
    setSearchInput('');
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <ConfirmCenterMessage />

      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-text-main">Ayuda COVID</h2>
        <p className="text-text-sec text-sm mt-1">Gestión de asignaciones económicas por COVID-19 y documentación contable para reembolso.</p>
      </div>

      {/* TABS */}
      <div className="flex border-b border-border">
        <button onClick={() => setTab('lista')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'lista' ? 'border-primary text-primary' : 'border-transparent text-text-sec hover:text-text-main'}`}>
          Colegiados
        </button>
        <button onClick={() => { setTab('registro'); resetForm(); }}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'registro' ? 'border-primary text-primary' : 'border-transparent text-text-sec hover:text-text-main'}`}>
          Registro de Ayuda
        </button>
      </div>

      {/* TAB: LISTA */}
      {tab === 'lista' && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <input ref={searchInputRef} type="text" placeholder="Buscar por CIP, DNI o nombre..."
                value={searchInput} onChange={(e) => onSearchChange(e.target.value)}
                className="w-80 px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec">CIP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec">DNI</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec">Colegiado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec">Monto S/</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec">Modalidad</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec">F. Pago</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec">Memorándum</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-sec">Comprobantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center">
                      <div className="animate-spin w-5 h-5 mx-auto border-2 border-primary border-t-transparent rounded-full" />
                    </td></tr>
                  ) : asignaciones.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-text-sec">No hay asignaciones registradas</td></tr>
                  ) : asignaciones.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-text-main font-mono">{a.cip || '-'}</td>
                      <td className="px-4 py-3 text-sm text-text-main">{a.dni || '-'}</td>
                      <td className="px-4 py-3 text-sm text-text-main font-medium">{a.nombreColegiado || '-'}</td>
                      <td className="px-4 py-3 text-sm text-text-main font-semibold">S/ {Number(a.monto).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-text-sec">{a.modalidadBeneficio.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-sm text-text-sec">{a.fechaPago ? new Date(a.fechaPago).toLocaleDateString('es-PE') : '-'}</td>
                      <td className="px-4 py-3 text-sm text-text-sec">{a.memorando?.numero || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${a.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {a.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-main">{a.comprobantes?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* PAGINACIÓN */}
            {meta.totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between text-sm text-text-sec">
                <span>Total: {meta.total} registros</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-border rounded hover:bg-gray-50 disabled:opacity-40">Anterior</button>
                  <span className="px-3 py-1">{page} / {meta.totalPages}</span>
                  <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-border rounded hover:bg-gray-50 disabled:opacity-40">Siguiente</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: REGISTRO */}
      {tab === 'registro' && (
        <div className="space-y-5 max-w-4xl">

          {/* SECCIÓN 1: COLEGIADO */}
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-text-main mb-3">1. Buscar Colegiado</h3>
            <div className="relative">
              <input ref={searchInputRef} type="text" placeholder="Ingrese CIP, DNI o nombre..."
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); buscarColegiado(e.target.value); }}
                onFocus={() => sugerencias.length > 0 && setShowSugerencias(true)}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              {showSugerencias && sugerencias.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                  {sugerencias.map((s) => (
                    <button key={s.COLEGIADO_ID}
                      onClick={() => seleccionarColegiado(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-border/50 last:border-0">
                      <span className="text-sm font-medium text-text-main">{s.NUM_COLEGIATURA}</span>
                      <span className="text-sm text-text-sec ml-2">{s.NOMBRE_COLEGIADO}</span>
                      <span className="text-xs text-text-sec ml-2">DNI: {s.DNI}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {colegiado && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
                <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-text-main">
                  <strong>{colegiado.NUM_COLEGIATURA}</strong> — {colegiado.NOMBRE_COLEGIADO}
                  <span className="text-text-sec ml-2">DNI: {colegiado.DNI}</span>
                </span>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: BENEFICIARIOS + SOLICITANTE */}
          {colegiado && (
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-text-main mb-3">2. Beneficiarios y Solicitante</h3>

              {/* MODALIDAD */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-text-sec uppercase mb-2">Forma de beneficio*</label>
                <div className="flex gap-3">
                  {MODALIDAD_OPTIONS.map((m) => (
                    <button key={m.value} onClick={() => setModalidad(m.value)}
                      className={`flex-1 border rounded-lg px-4 py-3 text-left transition-colors ${modalidad === m.value ? 'border-primary bg-blue-50 ring-1 ring-primary/20' : 'border-border hover:border-gray-300'}`}>
                      <span className="text-sm font-medium text-text-main block">{m.label}</span>
                      <span className="text-xs text-text-sec">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {cargandoBenes ? (
                <div className="py-6 text-center text-text-sec text-sm">Cargando beneficiarios...</div>
              ) : beneficiariosReg.length === 0 ? (
                <div className="py-6 text-center text-text-sec text-sm">No se encontraron beneficiarios para este colegiado.</div>
              ) : (
                <div className="space-y-2">
                  {beneficiariosReg.map((f, idx) => {
                    const esSolicitante = solicitanteKey === f.key;
                    const porcentaje = Number(f.porcentaje) || 0;
                    const corresponde = (porcentaje / 100) * Number(monto || 0);
                    return (
                      <div key={f.key}
                        className={`grid grid-cols-12 gap-2 items-center border rounded-lg p-3 transition-colors ${esSolicitante ? 'border-primary bg-blue-50/60' : 'border-border bg-white'}`}>
                        <label className="col-span-12 sm:col-span-4 flex items-center gap-2.5 cursor-pointer min-w-0" title="Marcar como solicitante">
                          <input type="radio" name="solicitante-covid" checked={esSolicitante}
                            onChange={() => setSolicitanteKey(f.key)}
                            className="w-4 h-4 accent-[#3258CA]" />
                          <span className="text-sm font-medium text-text-main truncate">{f.nombre}</span>
                        </label>
                        <span className="col-span-2 text-xs text-text-sec">{f.dni || '—'}</span>
                        <span className="col-span-3 sm:col-span-1 text-xs text-text-sec">{f.parentesco}</span>
                        <span className="col-span-2 sm:col-span-1 text-xs text-text-sec font-semibold text-right">{porcentaje}%</span>
                        {modalidad === 'opcion_sucesiva' && (
                          <span className="col-span-1 text-xs text-primary font-semibold text-center">#{idx + 1}</span>
                        )}
                        <div className="col-span-3 sm:col-span-3 text-right">
                          <span className="text-sm font-semibold text-text-main">→ S/ {corresponde.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-right text-sm font-semibold text-text-main pt-1">
                    Suma: {sumaPorcentajes}%
                    {modalidad === 'monto_compartido' && sumaPorcentajes !== 100 && (
                      <span className="text-[#DC2626] ml-2">≠ 100%</span>
                    )}
                    {modalidad === 'monto_compartido' && sumaPorcentajes === 100 && (
                      <span className="text-[#16A34A] ml-2">✓</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN 3: DATOS + CATÁLOGOS */}
          {colegiado && (
            <div className="bg-white border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-text-main mb-3">3. Datos de la Asignación y Documentación</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Monto entregado (S/)*</label>
                  <input type="number" step="0.01" min="0" value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de pago</label>
                  <input type="date" value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Memorándum*</label>
                  <select value={memorandoId} onChange={(e) => setMemorandoId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                    <option value="">-- Seleccionar --</option>
                    {memorandos.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.numero}{m.asunto ? ` — ${m.asunto}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Carta*</label>
                  <select value={cartaId} onChange={(e) => setCartaId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                    <option value="">-- Seleccionar --</option>
                    {cartas.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.numero}{c.referencia ? ` — ${c.referencia}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Observaciones</label>
                  <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                    rows={2} className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN 4: COMPROBANTES */}
          {colegiado && (
            <div className="bg-white border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-main">4. Documentos Contables Verificables para Reembolso</h3>
                <button onClick={addComprobante}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Agregar comprobante
                </button>
              </div>

              {comprobantes.length === 0 ? (
                <div className="py-6 text-center text-text-sec text-sm border border-dashed border-border rounded-lg">
                  No hay comprobantes registrados. Haga clic en &quot;Agregar comprobante&quot; para comenzar.
                </div>
              ) : (
                <div className="space-y-3">
                  {comprobantes.map((comp, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end border border-border rounded-lg p-3 bg-gray-50/50">
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-xs text-text-sec mb-1">Tipo*</label>
                        <select value={comp.tipoComprobante} onChange={(e) => updateComprobante(idx, 'tipoComprobante', e.target.value)}
                          className="w-full px-2 py-1.5 border border-border rounded text-sm">
                          {TIPOS_COMPROBANTE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-6 sm:col-span-1">
                        <label className="block text-xs text-text-sec mb-1">Serie</label>
                        <input type="text" value={comp.serie} onChange={(e) => updateComprobante(idx, 'serie', e.target.value)}
                          className="w-full px-2 py-1.5 border border-border rounded text-sm" placeholder="B001" />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-xs text-text-sec mb-1">N.°</label>
                        <input type="text" value={comp.numero} onChange={(e) => updateComprobante(idx, 'numero', e.target.value)}
                          className="w-full px-2 py-1.5 border border-border rounded text-sm" placeholder="000123" />
                      </div>
                      <div className="col-span-12 sm:col-span-3">
                        <label className="block text-xs text-text-sec mb-1">Concepto</label>
                        <input type="text" value={comp.concepto} onChange={(e) => updateComprobante(idx, 'concepto', e.target.value)}
                          className="w-full px-2 py-1.5 border border-border rounded text-sm" placeholder="Gastos de sepelio" />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-xs text-text-sec mb-1">Importe total*</label>
                        <input type="number" step="0.01" min="0" value={comp.importeTotal}
                          onChange={(e) => updateComprobante(idx, 'importeTotal', e.target.value)}
                          className="w-full px-2 py-1.5 border border-border rounded text-sm" />
                      </div>
                      <div className="col-span-3 sm:col-span-1 flex flex-col items-center gap-1">
                        <label className="block text-xs text-text-sec mb-1">PDF</label>
                        <label className="cursor-pointer">
                          <input type="file" accept=".pdf" className="hidden"
                            onChange={(e) => onPdfUpload(idx, e.target.files?.[0] || null)} />
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${comp.pdfBase64 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {comp.pdfBase64 ? '✓ Cargado' : 'Subir'}
                          </span>
                        </label>
                      </div>
                      <div className="col-span-3 sm:col-span-1 flex items-end justify-end">
                        <button onClick={() => removeComprobante(idx)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Quitar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-sm font-semibold text-text-main pt-1">
                    Suma comprobantes: S/ {sumaImportes.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOTONES */}
          {colegiado && (
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { resetForm(); setTab('lista'); }}
                className="px-5 py-2.5 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={saving}
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar Asignación'}
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
