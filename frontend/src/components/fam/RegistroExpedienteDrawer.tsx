'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import PdfViewerModal from '@/components/common/PdfViewerModal';
import SucesionIntestadaMultiplesBeneficiarios, {
  HerederoForm,
} from '@/components/fam/SucesionIntestadaMultiplesBeneficiarios';
import ModalNuevaCarta from '@/components/fam/ModalNuevaCarta';
import ModalNuevoMemorando from '@/components/fam/ModalNuevoMemorando';

interface ColegiadoSel {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  ESTADO: string;
}

interface FilaBeneficiario {
  key: string;
  id?: string;
  nombre: string;
  dni: string;
  parentesco: string;
  porcentaje: string;
  observaciones?: string;
  orden?: string;
}

interface TipoBeneficioOpt {
  id: number;
  nombre: string;
  descripcion?: string;
}

interface MontoConfig {
  id: number;
  nombre: string;
  aplicaA: string | null;
  monto: number;
}

const PARENTESCO_OPTIONS = ['Conyugue', 'Madre', 'Padre', 'Hijo(a)', 'Hermano(a)', 'Tio(a)', 'Primo(a)', 'Abuelo(a)', 'Otros'];
const MODALIDAD_OPTIONS = [
  { value: 'monto_unico', label: 'Monto Único' },
  { value: 'monto_compartido', label: 'Monto Compartido' },
  { value: 'opcion_sucesiva', label: 'Opción Sucesiva' },
];
const FORMA_PAGO_OPTIONS = ['TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'EFECTIVO'];

const DOCS_PDF = [
  { key: 'fichaAdmisibilidad', label: 'Ficha de Admisibilidad' },
  { key: 'solicitudAsignacion', label: 'Solicitud de Asignación' },
  { key: 'cartaRemision', label: 'Carta de Remisión' },
  { key: 'memorando', label: 'Memorándum' },
  { key: 'ordenPago', label: 'Orden de Pago' },
  { key: 'declaracionJurada', label: 'Declaración Jurada' },
  { key: 'actaDefuncion', label: 'Acta de Defunción' },
  { key: 'otrosDocumentos', label: 'Otros / Documentación Completa' },
] as const;

type DocKey = (typeof DOCS_PDF)[number]['key'];
const MAX_PDF_MB = 10;
const DNI_KEY: DocKey = 'declaracionJurada';

interface BeneficiarioRegistrado {
  key: string;
  id?: string;
  nombre: string;
  dni: string;
  parentesco: string;
  porcentaje: string; // % segun ficha del beneficiario
  esManual?: boolean;
}

const formatearClaveMonto = (clave: string) =>
  (clave || '').replace(/^FAM_MONTO_/, '').replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export default function RegistroExpedienteDrawer({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [pdfViewer, setPdfViewer] = useState<{ base64: string; nombre: string } | null>(null);
  const abrirPdfBase64 = (base64: string, nombre: string) => setPdfViewer({ base64, nombre });
  const [colegiado, setColegiado] = useState<ColegiadoSel | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<ColegiadoSel[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const sugerenciasRef = useRef<HTMLDivElement>(null);

  const [beneficiariosReg, setBeneficiariosReg] = useState<BeneficiarioRegistrado[]>([]);
  const [solicitanteKeys, setSolicitanteKeys] = useState<string[]>([]);
  const [solicitanteManual, setSolicitanteManual] = useState({ nombre: '', dni: '' });
  const [sucesionPdf, setSucesionPdf] = useState<{ base64: string; size: number } | null>(null);
  const [cuentaConSucesion, setCuentaConSucesion] = useState(true);
  const [observacionSinSucesion, setObservacionSinSucesion] = useState('');
  const [tramitarPorSucesion, setTramitarPorSucesion] = useState(false);
  const [herederosSucesion, setHerederosSucesion] = useState<HerederoForm[]>([]);
  const [numeroPartida, setNumeroPartida] = useState('');
  const [notariaJuzgado, setNotariaJuzgado] = useState('');
  const [beneficiarioEsTitular, setBeneficiarioEsTitular] = useState(false);
  const [modalidad, setModalidad] = useState('monto_compartido');

  const [tipos, setTipos] = useState<TipoBeneficioOpt[]>([]);
  const [montos, setMontos] = useState<MontoConfig[]>([]);

  const [form, setForm] = useState({
    tipoBeneficioConfigId: null as number | null,
    montoSeleccion: '',
    monto: '',
    expedienteNumero: '',
    fechaSolicitud: new Date().toISOString().slice(0, 10),
    observaciones: '',
    cartaNumero: '',
    cartaFecha: '',
    memorandoNumero: '',
    memorandoFecha: '',
    formaPago: '',
    banco: '',
    ordenPagoFecha: '',
    declaracionJuradaDni: '',
    documentacionCompleta: true,
    documentacionObservacion: '',
    fechaPago: new Date().toISOString().slice(0, 10),
  });

  const [docs, setDocs] = useState<Record<string, { base64: string; size: number } | null>>({});
  const [docsPresentados, setDocsPresentados] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargandoBenes, setCargandoBenes] = useState(false);
  const [covidDescuento, setCovidDescuento] = useState<{ monto: number; asignacionId: string } | null>(null);
  const [catalogoCartas, setCatalogoCartas] = useState<any[]>([]);
  const [catalogoMemorandos, setCatalogoMemorandos] = useState<any[]>([]);
  const [modalCartaOpen, setModalCartaOpen] = useState(false);
  const [modalMemorandoOpen, setModalMemorandoOpen] = useState(false);

  const onCartaCreada = (nuevaCarta: any) => {
    setCatalogoCartas((prev) => [nuevaCarta, ...prev.filter((c) => c.numero !== nuevaCarta.numero)]);
    setForm((f) => ({
      ...f,
      cartaNumero: nuevaCarta.numero,
      cartaFecha: nuevaCarta.fecha ? new Date(nuevaCarta.fecha).toISOString().slice(0, 10) : f.cartaFecha,
    }));
  };

  const onMemorandoCreado = (nuevoMemo: any) => {
    setCatalogoMemorandos((prev) => [nuevoMemo, ...prev.filter((m) => m.numero !== nuevoMemo.numero)]);
    setForm((f) => ({
      ...f,
      memorandoNumero: nuevoMemo.numero,
      memorandoFecha: nuevoMemo.fecha ? new Date(nuevoMemo.fecha).toISOString().slice(0, 10) : f.memorandoFecha,
    }));
  };
  const [colegiadoFallecido, setColegiadoFallecido] = useState(false);
  const [mensajeFallecido, setMensajeFallecido] = useState('');

  const resetForm = useCallback(() => {
    setColegiado(null);
    setBusqueda('');
    setSugerencias([]);
    setBeneficiariosReg([]);
    setSolicitanteKeys([]);
    setSolicitanteManual({ nombre: '', dni: '' });
    setSucesionPdf(null);
    setCuentaConSucesion(true);
    setObservacionSinSucesion('');
    setTramitarPorSucesion(false);
    setHerederosSucesion([]);
    setNumeroPartida('');
    setNotariaJuzgado('');
    setModalidad('monto_compartido');
    setBeneficiarioEsTitular(false);
    setDocs({});
    setDocsPresentados({});
    setError('');
    setColegiadoFallecido(false);
    setMensajeFallecido('');
    setCovidDescuento(null);
    setForm({
      tipoBeneficioConfigId: null,
      montoSeleccion: '',
      monto: '',
      expedienteNumero: '',
      fechaSolicitud: new Date().toISOString().slice(0, 10),
      observaciones: '',
      cartaNumero: '',
      cartaFecha: '',
      memorandoNumero: '',
      memorandoFecha: '',
      formaPago: '',
      banco: '',
      ordenPagoFecha: '',
      declaracionJuradaDni: '',
      documentacionCompleta: true,
      documentacionObservacion: '',
      fechaPago: new Date().toISOString().slice(0, 10),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForm();
    (async () => {
      try {
        const [t, m] = await Promise.all([
          api.get('/tipos-beneficio-config', { params: { activos: 'true' } }).catch(() => ({ data: [] })),
          api.get('/configuraciones/montos-fam').catch(() => ({ data: [] })),
        ]);
        setTipos(Array.isArray(t.data) ? t.data : []);
        setMontos(Array.isArray(m.data) ? m.data : []);
      } catch {}
    })();
  }, [open, resetForm]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sugerenciasRef.current && !sugerenciasRef.current.contains(e.target as Node)) setShowSugerencias(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    api.get('/cartas', { params: { activos: 'true' } })
      .then(({ data }) => setCatalogoCartas(Array.isArray(data) ? data : []))
      .catch(() => {});
    api.get('/memorandos', { params: { activos: 'true' } })
      .then(({ data }) => setCatalogoMemorandos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const handleBusqueda = (value: string) => {
    setBusqueda(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const { data } = await api.get('/fam/autocomplete', { params: { q: value.trim() } });
          setSugerencias(Array.isArray(data) ? data : []);
          setShowSugerencias(true);
        } catch {}
      }, 300);
    } else {
      setSugerencias([]);
      setShowSugerencias(false);
    }
  };

  const seleccionarColegiado = async (col: ColegiadoSel) => {
    setColegiado(col);
    setBusqueda(`${col.NUM_COLEGIATURA} - ${col.NOMBRE_COLEGIADO}`);
    setShowSugerencias(false);
    setError('');
    setSolicitanteKeys([]);
    setSolicitanteManual({ nombre: '', dni: '' });
    setSucesionPdf(null);
    setCuentaConSucesion(true);
    setObservacionSinSucesion('');
    setTramitarPorSucesion(false);
    setHerederosSucesion([]);
    setNumeroPartida('');
    setNotariaJuzgado('');
    setCargandoBenes(true);
    try {
      const { data } = await api.get(`/fam/colegiado/${col.COLEGIADO_ID}/beneficiarios`);
      const registrados: BeneficiarioRegistrado[] = (Array.isArray(data) ? data : []).map((b: any) => ({
        key: String(b.FAM_ID || Math.random().toString(36).slice(2)),
        // Solo los de origen SISTEMA tienen id en APP_DB; los LEGADO se crean al guardar
        id: b.ORIGEN === 'SISTEMA' && b.FAM_ID ? String(b.FAM_ID) : undefined,
        nombre: b.NOMBRE_BENEFICIARIO || '',
        dni: b.DNI || '',
        parentesco: b.PARENTESCO || 'Hijo(a)',
        porcentaje: b.PORCENTAJE !== undefined && b.PORCENTAJE !== null ? String(b.PORCENTAJE) : '0',
      }));
      setBeneficiariosReg(registrados);
      // Seleccionar a todos los beneficiarios por defecto para que figuren como solicitantes conjuntos
      setSolicitanteKeys(registrados.map((r) => r.key));

      // Si no tiene beneficiarios registrados, inicializar 1 bloque de heredero
      if (registrados.length === 0) {
        const mtoInit = Math.max(0, (parseFloat(form.monto) || 0) - (covidDescuento?.monto || 0));
        setHerederosSucesion([
          {
            key: Math.random().toString(36).slice(2),
            tipoDocumento: 'DNI',
            numeroDocumento: '',
            nombres: '',
            apellidos: '',
            parentesco: 'Hijo(a)',
            porcentaje: 100,
            monto: mtoInit,
            telefono: '',
            email: '',
          },
        ]);
      }

      // Verificar si el colegiado ya se encuentra registrado por fallecimiento
      try {
        const { data: act } = await api.get('/fam-beneficios/activo', {
          params: { colegiadoId: col.COLEGIADO_ID },
        });
        if (act?.colegiadoFallecido || act?.bloqueadoPorFallecimiento) {
          setColegiadoFallecido(true);
          const msg = act.mensajeFallecido || 'No se pueden registrar más beneficios porque el colegiado está fallecido.';
          setMensajeFallecido(msg);
          setError(msg);
        } else {
          setColegiadoFallecido(false);
          setMensajeFallecido('');
        }
      } catch {
        setColegiadoFallecido(false);
      }

      // Verificar asignación COVID activa
      try {
        const { data: covid } = await api.get(`/fam-covid/colegiado/${col.COLEGIADO_ID}`);
        if (covid?.tieneAsignacion) {
          setCovidDescuento({ monto: covid.monto, asignacionId: covid.asignacionId });
        } else {
          setCovidDescuento(null);
        }
      } catch { setCovidDescuento(null); }
    } catch {
      setBeneficiariosReg([]);
    } finally {
      setCargandoBenes(false);
    }
  };

  const seleccionarTipo = (tipoId: string) => {
    const tipo = tipos.find((t) => String(t.id) === tipoId);
    const config = montos.find((m) => tipo && (m.nombre || '').toUpperCase().includes(tipo.nombre.toUpperCase().replace(/\s+/g, '_')));
    const nuevoEsFallecimiento = (tipo?.nombre || '').toUpperCase().includes('FALLECIMIENTO');

    setForm((prev) => ({
      ...prev,
      tipoBeneficioConfigId: tipo ? tipo.id : null,
      montoSeleccion: config ? String(config.monto) : prev.montoSeleccion,
      ...(config && { monto: String(config.monto) }),
    }));

    if (nuevoEsFallecimiento) {
      if (beneficiarioEsTitular && beneficiariosReg.every((b) => b.parentesco === 'Titular')) {
        setBeneficiariosReg([]);
        setSolicitanteKeys([]);
        setBeneficiarioEsTitular(false);
      }
    } else {
      if (colegiado && (beneficiariosReg.length === 0 || beneficiariosReg.every((b) => b.parentesco === 'Titular'))) {
        const titularBene: BeneficiarioRegistrado = {
          key: 'titular-' + colegiado.COLEGIADO_ID,
          nombre: colegiado.NOMBRE_COLEGIADO,
          dni: colegiado.DNI,
          parentesco: 'Titular',
          porcentaje: '100',
        };
        setBeneficiariosReg([titularBene]);
        setSolicitanteKeys([titularBene.key]);
        setBeneficiarioEsTitular(true);
      }
    }
  };

  const tipoSeleccionado = tipos.find((t) => t.id === form.tipoBeneficioConfigId);
  const esFallecimiento = (tipoSeleccionado?.nombre || '').toUpperCase().includes('FALLECIMIENTO');
  const docsRequeridos = DOCS_PDF.filter(({ key }) => key !== 'otrosDocumentos' && (key !== 'actaDefuncion' || esFallecimiento));

  const handlePdf = (key: DocKey, file: File) => {
    const label = DOCS_PDF.find((d) => d.key === key)?.label || 'Documento';
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', `${label}: formato inválido`, 'Solo se permiten archivos PDF (.pdf)');
      setError(`${label}: solo se permiten archivos PDF`);
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage('error', `${label}: archivo demasiado grande`, `Máximo permitido: ${MAX_PDF_MB}MB — Archivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      setError(`El PDF no debe superar ${MAX_PDF_MB}MB`);
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      setDocs((prev) => ({ ...prev, [key]: { base64, size: file.size } }));
      setDocsPresentados((prev) => ({ ...prev, [key]: true }));
      showConfirmMessage('success', `${label} cargado correctamente`, `Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    };
    reader.readAsDataURL(file);
  };

  const handleSucesionPdf = (file: File) => {
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Sucesión Intestada: formato inválido', 'Solo se permiten archivos PDF (.pdf)');
      setError('La Sucesión Intestada debe ser un archivo PDF');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage('error', 'Sucesión Intestada: archivo demasiado grande', `Máximo: ${MAX_PDF_MB}MB — Archivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      setError(`El PDF no debe superar ${MAX_PDF_MB}MB`);
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      setSucesionPdf({ base64, size: file.size });
      showConfirmMessage('success', 'Sucesión Intestada cargada correctamente', `Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    };
    reader.readAsDataURL(file);
  };

  const sumaPorcentajes = beneficiariosReg.reduce((acc, f) => acc + (parseFloat(f.porcentaje) || 0), 0);
  const sinBeneficiarios = !!colegiado && !cargandoBenes && beneficiariosReg.length === 0;
  const esSucesionIntestada = esFallecimiento && (sinBeneficiarios || tramitarPorSucesion);

  const montoBase = parseFloat(form.monto) || 0;
  const descuentoMonto = covidDescuento?.monto || 0;
  const montoFinal = Math.max(0, montoBase - descuentoMonto);

  const calcularCorresponde = (porcentaje: number) => {
    if (modalidad === 'monto_compartido') return (porcentaje / 100) * montoFinal;
    return montoFinal;
  };

  const repartirPorcentajesEnPartesIguales = (lista?: BeneficiarioRegistrado[]) => {
    const baseList = lista || beneficiariosReg;
    if (baseList.length === 0) return baseList;
    const base = Math.floor((100 / baseList.length) * 100) / 100;
    let acumulado = 0;
    const resultado = baseList.map((b, idx) => {
      const pct = idx === baseList.length - 1 ? Number((100 - acumulado).toFixed(2)) : base;
      acumulado = Number((acumulado + pct).toFixed(2));
      return { ...b, porcentaje: String(pct) };
    });
    if (!lista) setBeneficiariosReg(resultado);
    return resultado;
  };

  const agregarBeneficiarioManual = () => {
    const nuevaKey = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nuevo: BeneficiarioRegistrado = {
      key: nuevaKey,
      nombre: '',
      dni: '',
      parentesco: 'Hijo(a)',
      porcentaje: '0',
      esManual: true,
    };
    setBeneficiariosReg((prev) => {
      const list = [...prev, nuevo];
      return repartirPorcentajesEnPartesIguales(list);
    });
    setSolicitanteKeys((prev) => [...prev, nuevaKey]);
  };

  const eliminarBeneficiarioManual = (key: string) => {
    setBeneficiariosReg((prev) => {
      const filtrados = prev.filter((b) => b.key !== key);
      return repartirPorcentajesEnPartesIguales(filtrados);
    });
    setSolicitanteKeys((prev) => prev.filter((k) => k !== key));
  };

  // Monto total a enviar (con descuento incluido)
  const montoAEnviar = montoFinal;

  const validar = (): string => {
    if (!colegiado) return 'Seleccione el colegiado';
    if (colegiadoFallecido) return mensajeFallecido || 'No se pueden registrar más beneficios porque el colegiado está fallecido.';
    if (!form.tipoBeneficioConfigId) return 'Seleccione el tipo de beneficio';
    if (!(parseFloat(form.monto) > 0)) return 'Ingrese un monto válido mayor a 0';
    if (form.documentacionCompleta === false && !form.documentacionObservacion.trim())
      return 'Si la documentación está incompleta, la justificación es obligatoria';

    const dniDJ = form.declaracionJuradaDni.trim();
    if (docs.declaracionJurada?.base64 && !/^\d{8}$/.test(dniDJ))
      return 'La Declaración Jurada requiere el DNI del declarante (8 dígitos)';
    if (!docs.declaracionJurada?.base64 && dniDJ && !/^\d{8}$/.test(dniDJ))
      return 'El DNI de la Declaración Jurada debe tener exactamente 8 dígitos';

    if (!esSucesionIntestada) {
      if (beneficiariosReg.length === 0) {
        return 'Debe asignar al menos a un beneficiario para este tipo de beneficio (active "¿El titular del colegiado es el beneficiario?" o use "+ Agregar Beneficiario")';
      }
      for (const b of beneficiariosReg) {
        if (!b.nombre.trim()) return 'Todos los beneficiarios deben tener nombre completo';
        if (b.dni.trim() && !/^\d{8}$/.test(b.dni.trim())) return `El DNI de ${b.nombre} debe tener 8 dígitos`;
      }
      if (modalidad === 'monto_unico' && beneficiariosReg.length !== 1)
        return 'Monto Único requiere exactamente 1 beneficiario registrado (tiene ' + beneficiariosReg.length + ')';
      if (modalidad === 'monto_compartido' && Math.abs(sumaPorcentajes - 100) > 0.05)
        return `Monto Compartido: los porcentajes suman ${sumaPorcentajes.toFixed(2)}%. Deben sumar 100% (use "Repartir en partes iguales")`;
      if (!solicitanteKeys.length)
        return 'Seleccione al menos a un solicitante entre los beneficiarios registrados';
      return '';
    }

    if (esSucesionIntestada) {
      if (cuentaConSucesion && !sucesionPdf?.base64) {
        return 'Adjunte el sustento de Sucesión Intestada (PDF) o seleccione "No cuenta con Sucesión" para registrar las observaciones y poder guardar.';
      }
      if (!cuentaConSucesion && !observacionSinSucesion.trim()) {
        return 'Cuando el colegiado no tiene Sucesión Intestada, debe ingresar las observaciones detallando el porqué no se está cargando para permitir el guardado.';
      }
      if (herederosSucesion.length === 0) {
        return 'Debe registrar al menos un beneficiario heredero en la sucesión intestada';
      }
      for (const h of herederosSucesion) {
        if (!h.numeroDocumento.trim()) {
          return 'Todos los herederos deben tener número de documento';
        }
        if (!h.nombres.trim() || !h.apellidos.trim()) {
          return `Indique nombres y apellidos para el heredero con documento ${h.numeroDocumento}`;
        }
        if (!(h.porcentaje > 0) || !(h.monto > 0)) {
          return `El heredero ${h.nombres} ${h.apellidos} debe tener porcentaje y monto asignado mayor a 0`;
        }
      }
      // Validar duplicados
      const docsVistos = new Set<string>();
      for (const h of herederosSucesion) {
        const k = `${h.tipoDocumento}-${h.numeroDocumento.trim()}`;
        if (docsVistos.has(k)) {
          return `Documento duplicado entre los herederos: ${h.tipoDocumento} ${h.numeroDocumento}`;
        }
        docsVistos.add(k);
      }
      const sumPct = Number(herederosSucesion.reduce((acc, h) => acc + (Number(h.porcentaje) || 0), 0).toFixed(2));
      if (Math.abs(sumPct - 100) > 0.05) {
        return `La suma de porcentajes de los herederos (${sumPct}%) debe ser exactamente 100%`;
      }
      const sumMto = Number(herederosSucesion.reduce((acc, h) => acc + (Number(h.monto) || 0), 0).toFixed(2));
      if (Math.abs(sumMto - montoFinal) > 0.05) {
        return `La suma de montos (S/ ${sumMto.toFixed(2)}) debe coincidir con el monto total (S/ ${montoFinal.toFixed(2)})`;
      }
      for (const h of herederosSucesion) {
        if (!h.declaracionJuradaPdf) {
          return `Falta generar o cargar la Declaración Jurada para el heredero: ${h.nombres} ${h.apellidos}`;
        }
      }
      return '';
    }

    return '';
  };

  const guardar = async () => {
    const err = validar();
    if (err) { setError(err); return; }
    setError('');
    setGuardando(true);
    try {
      const todosPresentados = Boolean(docs.otrosDocumentos) || docsRequeridos.every(({ key }) => docsPresentados[key] === true || docs[key] !== null);
      const body: any = {
        colegiadoId: colegiado!.COLEGIADO_ID,
        estado: todosPresentados ? 'PAGADA' : 'PENDIENTE',
        // Beneficiarios ya registrados: solo se vinculan (sin creacion/edicion)
        beneficiarios: beneficiariosReg.map((f, i) => ({
          ...(f.id ? { id: f.id } : {}),
          nombre: f.nombre.trim(),
          dni: f.dni.trim() || undefined,
          parentesco: f.parentesco,
          porcentaje: modalidad !== 'monto_compartido' ? 100 : (parseFloat(f.porcentaje) || 0),
          ...(modalidad === 'opcion_sucesiva' && { orden: i + 1 }),
        })),
        tipoBeneficioConfigId: form.tipoBeneficioConfigId,
        monto: parseFloat(form.monto),
        moneda: 'PEN',
        modalidadBeneficio: modalidad,
        ...(covidDescuento && { covidAsignacionId: covidDescuento.asignacionId }),
        fechaSolicitud: form.fechaSolicitud || undefined,
        fechaPago: form.fechaPago || undefined,
        documentacionCompleta: todosPresentados,
        documentacionObservacion: !todosPresentados ? (form.documentacionObservacion.trim() || 'Documentación pendiente de presentar') : undefined,
        expedienteNumero: form.expedienteNumero.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
        cartaNumero: form.cartaNumero.trim() || undefined,
        cartaFecha: form.cartaFecha || undefined,
        memorandoNumero: form.memorandoNumero.trim() || undefined,
        memorandoFecha: form.memorandoFecha || undefined,
        formaPago: form.formaPago || undefined,
        banco: form.banco.trim() || undefined,
        ordenPagoFecha: form.ordenPagoFecha || undefined,
      };

      if (esSucesionIntestada) {
        const obsFinal = [
          !cuentaConSucesion || !sucesionPdf?.base64
            ? `[SIN SUCESIÓN INTESTADA]: ${observacionSinSucesion.trim()}`
            : '',
          form.observaciones.trim(),
        ]
          .filter(Boolean)
          .join('\n');

        const payloadSucesion = {
          colegiadoId: colegiado!.COLEGIADO_ID,
          tipoBeneficioConfigId: form.tipoBeneficioConfigId,
          montoTotal: montoFinal,
          sustentoPdf: sucesionPdf?.base64 || undefined,
          observacionSinSucesion: observacionSinSucesion.trim() || undefined,
          numeroPartidaRegistral: numeroPartida || undefined,
          notariaJuzgado: notariaJuzgado || undefined,
          estado: todosPresentados && sucesionPdf ? 'PAGADA' : 'ENVIADO',
          observaciones: obsFinal || undefined,
          herederos: herederosSucesion.map((h) => ({
            tipoDocumento: h.tipoDocumento,
            numeroDocumento: h.numeroDocumento.trim(),
            nombres: h.nombres.trim(),
            apellidos: h.apellidos.trim(),
            parentesco: h.parentesco,
            porcentaje: Number(h.porcentaje),
            monto: Number(h.monto),
            telefono: h.telefono?.trim() || undefined,
            email: h.email?.trim() || undefined,
            declaracionJuradaPdf: h.declaracionJuradaPdf || undefined,
            ordenPagoPdf: h.ordenPagoPdf || undefined,
          })),
          ...(docs.actaDefuncion?.base64 && { actaDefuncion: docs.actaDefuncion.base64 }),
          ...(docs.solicitudAsignacion?.base64 && { solicitudAsignacion: docs.solicitudAsignacion.base64 }),
          ...(docs.fichaAdmisibilidad?.base64 && { fichaAdmisibilidad: docs.fichaAdmisibilidad.base64 }),
          ...(docs.cartaRemision?.base64 && { cartaRemision: docs.cartaRemision.base64 }),
          ...(docs.memorando?.base64 && { memorando: docs.memorando.base64 }),
          ...(docs.ordenPago?.base64 && { ordenPago: docs.ordenPago.base64 }),
          ...(docs.otrosDocumentos?.base64 && { otrosDocumentos: docs.otrosDocumentos.base64 }),
          fechaSolicitud: form.fechaSolicitud || undefined,
          fechaPago: form.fechaPago || undefined,
          expedienteNumero: form.expedienteNumero.trim() || undefined,
          cartaNumero: form.cartaNumero.trim() || undefined,
          cartaFecha: form.cartaFecha || undefined,
          memorandoNumero: form.memorandoNumero.trim() || undefined,
          memorandoFecha: form.memorandoFecha || undefined,
          banco: form.banco.trim() || undefined,
          formaPago: form.formaPago || undefined,
        };
        await api.post('/fam-sucesion', payloadSucesion);
        showConfirmMessage('success', 'Expediente con múltiples herederos registrado exitosamente');
        onSaved();
        onClose();
        return;
      } else {
        const selBenes = beneficiariosReg.filter((f) => solicitanteKeys.includes(f.key));
        if (selBenes.length === 0) {
          setError('Debe seleccionar al menos un solicitante entre los beneficiarios registrados');
          showConfirmMessage('error', 'Debe seleccionar al menos un solicitante');
          setGuardando(false);
          return;
        }
        const selFirst = selBenes[0];
        if (selFirst.id) {
          body.solicitanteBeneficiarioId = selFirst.id;
        } else {
          body.solicitanteIndice = beneficiariosReg.findIndex((f) => f.key === selFirst.key);
        }
        body.solicitanteBeneficiarioIds = selBenes.map((b) => b.id).filter(Boolean) as string[];
        body.solicitanteIndices = selBenes.map((b) => beneficiariosReg.findIndex((f) => f.key === b.key));
        body.solicitanteNombre = selBenes.map((b) => b.nombre.trim()).join(' / ');
        const dnis = selBenes.map((b) => b.dni.trim()).filter(Boolean);
        const dniStr = dnis.join(' / ');
        body.solicitanteDni = (dniStr.length <= 20 ? dniStr : dnis[0]) || undefined;
      }

      DOCS_PDF.forEach(({ key }) => {
        if (docs[key]?.base64) body[key] = docs[key]!.base64;
      });
      if (body.declaracionJurada && form.declaracionJuradaDni.trim()) {
        body.declaracionJuradaDni = form.declaracionJuradaDni.trim();
      }

      await api.post('/fam-registros', body);
      showConfirmMessage('success', 'Expediente registrado correctamente');
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Error al registrar el expediente';
      setError(msg);
      showConfirmMessage('error', msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full sm:w-[860px] sm:max-w-[96vw] max-h-[95vh] sm:max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-text-main">Registrar Expediente de Beneficio</h3>
            <p className="text-sm text-text-sec">Entrega histórica - se registrará como PAGADA</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 sm:py-5 space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {/* 1. Colegiado */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider">1. Colegiado</h4>
            <div className="relative max-w-xl" ref={sugerenciasRef}>
              <input
                type="text"
                placeholder="Buscar por CIP, DNI o apellido..."
                value={busqueda}
                onChange={(e) => handleBusqueda(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {showSugerencias && sugerencias.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {sugerencias.map((s) => (
                    <button key={s.COLEGIADO_ID} onClick={() => seleccionarColegiado(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-border last:border-0 transition-colors">
                      <span className="text-sm font-semibold text-primary">{s.NUM_COLEGIATURA}</span>
                      <span className="text-sm text-text-main ml-2">{s.NOMBRE_COLEGIADO}</span>
                      <span className="text-xs text-text-sec float-right mt-0.5">DNI: {s.DNI || '-'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {colegiado && (
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-4 text-sm">
                <span className="font-semibold text-primary">{colegiado.NUM_COLEGIATURA}</span>
                <span className="text-text-main">{colegiado.NOMBRE_COLEGIADO}</span>
                <span className={`ml-auto inline-flex px-2 py-0.5 text-xs rounded-full ${colegiado.ESTADO === 'HABILITADO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{colegiado.ESTADO}</span>
              </div>
            )}
            {colegiadoFallecido && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex items-start gap-3 text-sm">
                <span className="text-xl shrink-0">⚠️</span>
                <div>
                  <h4 className="font-bold text-red-800">Colegiado Fallecido - Registro Bloqueado</h4>
                  <p className="text-xs text-red-700 mt-0.5 font-medium">
                    {mensajeFallecido || 'No se pueden registrar más beneficios porque el colegiado está fallecido.'}
                  </p>
                </div>
              </div>
            )}
          </section>

          {covidDescuento && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-amber-600 text-lg">&#9888;</span>
              <div className="text-sm">
                <span className="font-semibold text-amber-800">Descuento COVID aplicable: </span>
                <span className="text-amber-700">S/ {covidDescuento.monto.toFixed(2)} se descontar&aacute; del monto total del beneficio.</span>
              </div>
              <span className="ml-auto text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Automatico</span>
            </div>
          )}

          {/* 2. Beneficiarios registrados (solo lectura) + Solicitante */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider">2. Beneficiarios Registrados</h4>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-text-sec">Modalidad:</span>
                <select value={modalidad} onChange={(e) => setModalidad(e.target.value)}
                  className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {MODALIDAD_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Tipo de Beneficio *</label>
                <select value={form.tipoBeneficioConfigId ?? ''} onChange={(e) => seleccionarTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Seleccionar tipo</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Monto (S/) *</label>
                <select
                  value={form.montoSeleccion}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, montoSeleccion: v, monto: v === '__otro__' ? '' : v });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                  <option value="">Seleccionar monto configurado</option>
                  {montos.map((m) => (
                    <option key={m.nombre} value={String(m.monto)}>{formatearClaveMonto(m.nombre)} — S/ {Number(m.monto).toLocaleString('es-PE')}</option>
                  ))}
                  <option value="__otro__">✏️ Otro monto (personalizado)</option>
                </select>
                <input
                  type="number" min={0} step="0.01" placeholder="Monto editable (S/)"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg text-sm font-semibold"
                />
              </div>
            </div>
            {form.tipoBeneficioConfigId && !esFallecimiento && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <button type="button" onClick={() => {
                  const nuevoEstado = !beneficiarioEsTitular;
                  setBeneficiarioEsTitular(nuevoEstado);
                  if (nuevoEstado && colegiado) {
                    const yaExiste = beneficiariosReg.some((b) => b.dni === colegiado.DNI);
                    if (!yaExiste) {
                      const nuevoBene: BeneficiarioRegistrado = {
                        key: 'titular-' + colegiado.COLEGIADO_ID,
                        nombre: colegiado.NOMBRE_COLEGIADO,
                        dni: colegiado.DNI,
                        parentesco: 'Titular',
                        porcentaje: modalidad === 'monto_compartido' ? String(100) : '100',
                      };
                      setBeneficiariosReg((prev) => [...prev, nuevoBene]);
                      setSolicitanteKeys((prev) => [...prev, nuevoBene.key]);
                    }
                  } else if (!nuevoEstado && colegiado) {
                    setBeneficiariosReg((prev) => prev.filter((b) => b.dni !== colegiado.DNI));
                    setSolicitanteKeys((prev) => prev.filter((k) => !k.startsWith('titular-')));
                  }
                }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${beneficiarioEsTitular ? 'bg-primary' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${beneficiarioEsTitular ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-text-main font-medium">¿El titular del colegiado es el beneficiario?</span>
              </div>
            )}
            {esFallecimiento && !sinBeneficiarios && (
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tramitarPorSucesion}
                    onChange={(e) => setTramitarPorSucesion(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary accent-[#3258CA] cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-amber-900">
                    ¿Tramitar mediante Sucesión Intestada (Múltiples Herederos / Beneficiarios)?
                  </span>
                </label>
                <span className="text-[11px] text-amber-700 hidden sm:inline">Habilita sustento notarial y desglose de herederos</span>
              </div>
            )}
            {cargandoBenes ? (
              <p className="text-sm text-text-sec py-2">Cargando beneficiarios del colegiado...</p>
            ) : esSucesionIntestada ? (
              <SucesionIntestadaMultiplesBeneficiarios
                montoTotal={montoFinal}
                colegiado={colegiado}
                expedienteNumero={form.expedienteNumero}
                herederos={herederosSucesion}
                onChangeHerederos={setHerederosSucesion}
                sucesionPdf={sucesionPdf}
                onChangeSucesionPdf={setSucesionPdf}
                numeroPartidaRegistral={numeroPartida}
                onChangePartida={setNumeroPartida}
                notariaJuzgado={notariaJuzgado}
                onChangeNotaria={setNotariaJuzgado}
                onAbrirPdf={abrirPdfBase64}
                cuentaConSucesion={cuentaConSucesion}
                onChangeCuentaConSucesion={setCuentaConSucesion}
                observacionSinSucesion={observacionSinSucesion}
                onChangeObservacionSinSucesion={setObservacionSinSucesion}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                  <button
                    type="button"
                    onClick={agregarBeneficiarioManual}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#3258CA] hover:bg-[#2846a2] rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ Agregar Beneficiario</span>
                  </button>
                  {beneficiariosReg.length > 1 && (
                    <button
                      type="button"
                      onClick={() => repartirPorcentajesEnPartesIguales()}
                      className="px-2.5 py-1 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      Repartir en partes iguales (100%)
                    </button>
                  )}
                </div>

                {beneficiariosReg.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-border rounded-lg text-center space-y-2">
                    <p className="text-sm text-text-sec">Este colegiado no tiene beneficiarios registrados en el padrón para este trámite.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (colegiado) {
                            const titularBene: BeneficiarioRegistrado = {
                              key: 'titular-' + colegiado.COLEGIADO_ID,
                              nombre: colegiado.NOMBRE_COLEGIADO,
                              dni: colegiado.DNI,
                              parentesco: 'Titular',
                              porcentaje: '100',
                            };
                            setBeneficiariosReg([titularBene]);
                            setSolicitanteKeys([titularBene.key]);
                            setBeneficiarioEsTitular(true);
                          }
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#3258CA] hover:bg-[#2846a2] rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        <span>+ Asignar Colegiado Titular como Beneficiario</span>
                      </button>
                      <button
                        type="button"
                        onClick={agregarBeneficiarioManual}
                        className="px-3.5 py-1.5 text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5 rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        <span>+ Registrar Beneficiario Manual</span>
                      </button>
                    </div>
                  </div>
                ) : null}
                {beneficiariosReg.map((f, idx) => {
                  const esSolicitante = solicitanteKeys.includes(f.key);
                  const corresponde = calcularCorresponde(parseFloat(f.porcentaje) || 0);
                  return (
                    <div key={f.key}
                      className={`border rounded-lg p-3 transition-colors ${esSolicitante ? 'border-primary bg-blue-50/60' : 'border-border bg-white'}`}>
                      {f.esManual ? (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 mb-2 border-b border-border/60">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                            <div>
                              <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">Nombre Completo *</label>
                              <input
                                type="text"
                                placeholder="Nombres y Apellidos"
                                value={f.nombre}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBeneficiariosReg((prev) => prev.map((b) => (b.key === f.key ? { ...b, nombre: val } : b)));
                                }}
                                className="w-full px-2 py-1.5 border border-border rounded text-xs font-medium text-text-main"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">DNI</label>
                              <input
                                type="text"
                                placeholder="8 dígitos"
                                maxLength={8}
                                value={f.dni}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  setBeneficiariosReg((prev) => prev.map((b) => (b.key === f.key ? { ...b, dni: val } : b)));
                                }}
                                className="w-full px-2 py-1.5 border border-border rounded text-xs font-medium text-text-main"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">Parentesco</label>
                              <select
                                value={f.parentesco}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBeneficiariosReg((prev) => prev.map((b) => (b.key === f.key ? { ...b, parentesco: val } : b)));
                                }}
                                className="w-full px-2 py-1.5 border border-border rounded text-xs bg-white"
                              >
                                {['Hijo(a)', 'Cónyuge', 'Conviviente', 'Madre', 'Padre', 'Hermano(a)', 'Sobrino(a)', 'Tío(a)', 'Nieto(a)', 'Otros'].map((opc) => (
                                  <option key={opc} value={opc}>{opc}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => eliminarBeneficiarioManual(f.key)}
                            className="text-xs text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 inline-flex items-center gap-1 self-start sm:self-center ml-auto"
                            title="Quitar este beneficiario"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="text-[11px]">Quitar</span>
                          </button>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-12 gap-2 items-center">
                        <label className="col-span-12 sm:col-span-4 flex items-center gap-2.5 cursor-pointer min-w-0" title="Marcar como solicitante">
                          <input
                            type="checkbox"
                            checked={esSolicitante}
                            onChange={() => {
                              setSolicitanteKeys((prev) =>
                                prev.includes(f.key)
                                  ? prev.filter((k) => k !== f.key)
                                  : [...prev, f.key]
                              );
                            }}
                            className="w-4 h-4 rounded text-primary focus:ring-primary accent-[#3258CA] flex-shrink-0 cursor-pointer"
                          />
                          <span className="text-sm font-medium text-text-main truncate">{f.nombre || (f.esManual ? 'Nuevo Beneficiario' : '-')}</span>
                        </label>
                        <span className="col-span-6 sm:col-span-2 text-xs text-text-sec">DNI: {f.dni || '-'}</span>
                        <span className="col-span-3 sm:col-span-1">
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">{f.parentesco}</span>
                        </span>
                        <span className="col-span-3 sm:col-span-2 text-center flex items-center justify-center gap-1">
                          {modalidad === 'monto_compartido' ? (
                            <div className="inline-flex items-center gap-0.5">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={f.porcentaje}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBeneficiariosReg((prev) => prev.map((b) => (b.key === f.key ? { ...b, porcentaje: val } : b)));
                                }}
                                className="w-16 px-1.5 py-0.5 text-xs font-bold text-center border border-border rounded bg-white"
                              />
                              <span className="text-xs font-bold text-text-sec">%</span>
                            </div>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-lg bg-green-50 text-green-700">
                              100%
                            </span>
                          )}
                          {modalidad === 'opcion_sucesiva' && (
                            <span className="ml-1 inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700" title="Orden de prioridad">#{idx + 1}</span>
                          )}
                        </span>
                        <span className="col-span-6 sm:col-span-2 text-right">
                          <span className="text-sm font-semibold text-green-700">S/ {corresponde.toFixed(2)}</span>
                          {covidDescuento && (
                            <span className="block text-[10px] text-amber-600">(monto final)</span>
                          )}
                        </span>
                        <span className="col-span-6 sm:col-span-1 text-right">
                          {esSolicitante && (
                            <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-primary text-white">Solicita</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {modalidad === 'monto_compartido' && beneficiariosReg.length > 0 && (
                  <p className={`text-xs ${sumaPorcentajes === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                    Suma de porcentajes de ficha: <strong>{sumaPorcentajes}%</strong>{sumaPorcentajes !== 100 ? ' — deben sumar 100%, corrija las fichas en FAM > Beneficiarios' : ''}
                  </p>
                )}
                {modalidad === 'monto_unico' && (
                  <p className="text-xs text-green-600">
                    Monto Único: requiere exactamente <strong>1 beneficiario registrado</strong>; recibe el 100% del beneficio.
                  </p>
                )}
                {modalidad === 'opcion_sucesiva' && (
                  <p className="text-xs text-indigo-600">
                    Opción Sucesiva: todos quedan al <strong>100%</strong>. Cobra el primero disponible según su orden (#1, #2, ...); si no quiere o ha fallecido, pasa al siguiente.
                  </p>
                )}
                <p className="text-xs text-text-sec pt-1">
                  Marque con la casilla <strong>quiénes son los solicitantes</strong> del expediente (puede seleccionar a uno o varios). Los beneficiarios se administran desde FAM &gt; Beneficiarios.
                </p>
              </div>
            )}
          </section>

          {/* 3. Solicitud */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider">3. Datos de la Solicitud</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">N.° de Expediente</label>
                <input type="text" value={form.expedienteNumero} onChange={(e) => setForm({ ...form, expedienteNumero: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de Recepción</label>
                <input type="date" value={form.fechaSolicitud} onChange={(e) => setForm({ ...form, fechaSolicitud: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Observaciones generales</label>
                <textarea rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
            </div>
          </section>

          {/* 4. Documentos PDF */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider">4. Documentación (PDF, máx. {MAX_PDF_MB}MB c/u)</h4>
            <div className="grid grid-cols-1 gap-2">
              {docsRequeridos.map(({ key, label }) => {
                const doc = docs[key];
                const presentado = docsPresentados[key] ?? false;
                return (
                  <div key={key} className={`flex items-center gap-3 border rounded-lg px-3 py-2 ${presentado ? 'border-border bg-white' : 'border-amber-300 bg-amber-50'}`}>
                    <span className="text-sm text-text-main w-52">{label}</span>
                    {key === DNI_KEY && (
                      <label className="inline-flex items-center gap-1.5 text-xs text-text-sec">
                        DNI
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={8}
                          value={form.declaracionJuradaDni}
                          onChange={(e) => setForm({ ...form, declaracionJuradaDni: e.target.value.replace(/\D/g, '') })}
                          placeholder="8 dígitos"
                          className="w-28 px-2 py-1.5 border border-border rounded-lg text-sm"
                        />
                      </label>
                    )}
                    {doc ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          ✓ {(doc.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <button type="button" onClick={() => abrirPdfBase64(doc.base64, label)}
                          className="text-xs text-primary hover:underline">Ver</button>
                        <button type="button" onClick={() => { setDocs((prev) => ({ ...prev, [key]: null })); setDocsPresentados((prev) => ({ ...prev, [key]: false })); }}
                          className="text-xs text-red-500 hover:text-red-700">Quitar</button>
                      </>
                    ) : (
                      <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        Seleccionar PDF
                        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handlePdf(key, e.target.files[0]); }} />
                      </label>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-text-sec">{presentado ? 'Presentado' : 'Pendiente'}</span>
                      <button type="button" onClick={() => setDocsPresentados((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${presentado ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${presentado ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5. Datos administrativos */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-text-sec uppercase tracking-wider">5. Documentación Administrativa</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">¿Documentación completa?</label>
                <div className="flex items-center gap-4 h-[38px]">
                  <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={form.documentacionCompleta === true} onChange={() => setForm({ ...form, documentacionCompleta: true })} />
                    <span className="text-green-700 font-medium">Sí, completa</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={form.documentacionCompleta === false} onChange={() => setForm({ ...form, documentacionCompleta: false })} />
                    <span className="text-red-600 font-medium">⚠️ No cumple</span>
                  </label>
                </div>
                <p className="text-[11px] text-text-sec mt-1">
                  {docsRequeridos.filter(({ key }) => !docsPresentados[key] && !docs[key]).length} de {docsRequeridos.length} documentos pendientes de presentar
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de Pago *</label>
                <input type="date" value={form.fechaPago} onChange={(e) => setForm({ ...form, fechaPago: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              {form.documentacionCompleta === false && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-red-600 uppercase mb-1">Justificación del incumplimiento * (obligatoria)</label>
                  <textarea rows={2} value={form.documentacionObservacion} onChange={(e) => setForm({ ...form, documentacionObservacion: e.target.value })}
                    placeholder="Explique qué documentos no presenta y por qué se autoriza el registro..."
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200" />
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-text-sec uppercase">N.° de Carta *</label>
                  <button
                    type="button"
                    onClick={() => setModalCartaOpen(true)}
                    className="text-xs font-semibold text-[#3258CA] hover:text-[#2846a2] hover:underline inline-flex items-center gap-1"
                    title="Registrar nueva carta en un popup"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ Nueva Carta</span>
                  </button>
                </div>
                <select
                  value={form.cartaNumero}
                  onChange={(e) => {
                    if (e.target.value === '__NUEVA__') {
                      setModalCartaOpen(true);
                      return;
                    }
                    const carta = catalogoCartas.find((c: any) => c.numero === e.target.value);
                    setForm({ ...form, cartaNumero: e.target.value, cartaFecha: carta?.fecha ? new Date(carta.fecha).toISOString().slice(0, 10) : '' });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                >
                  <option value="">-- Seleccionar carta --</option>
                  <option value="__NUEVA__" className="font-semibold text-[#3258CA] bg-blue-50">
                    + Registrar nueva carta...
                  </option>
                  {catalogoCartas.map((c: any) => (
                    <option key={c.id} value={c.numero}>{c.numero}{c.referencia ? ` — ${c.referencia}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de Carta</label>
                <input type="date" value={form.cartaFecha} onChange={(e) => setForm({ ...form, cartaFecha: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-text-sec uppercase">N.° de Memorándum *</label>
                  <button
                    type="button"
                    onClick={() => setModalMemorandoOpen(true)}
                    className="text-xs font-semibold text-[#3258CA] hover:text-[#2846a2] hover:underline inline-flex items-center gap-1"
                    title="Registrar nuevo memorándum en un popup"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ Nuevo Memorándum</span>
                  </button>
                </div>
                <select
                  value={form.memorandoNumero}
                  onChange={(e) => {
                    if (e.target.value === '__NUEVO__') {
                      setModalMemorandoOpen(true);
                      return;
                    }
                    const mem = catalogoMemorandos.find((m: any) => m.numero === e.target.value);
                    setForm({ ...form, memorandoNumero: e.target.value, memorandoFecha: mem?.fecha ? new Date(mem.fecha).toISOString().slice(0, 10) : '' });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                >
                  <option value="">-- Seleccionar memorándum --</option>
                  <option value="__NUEVO__" className="font-semibold text-[#3258CA] bg-blue-50">
                    + Registrar nuevo memorándum...
                  </option>
                  {catalogoMemorandos.map((m: any) => (
                    <option key={m.id} value={m.numero}>{m.numero}{m.asunto ? ` — ${m.asunto}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de Memorándum</label>
                <input type="date" value={form.memorandoFecha} onChange={(e) => setForm({ ...form, memorandoFecha: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Forma de Pago</label>
                <select value={form.formaPago} onChange={(e) => setForm({ ...form, formaPago: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                  <option value="">--</option>
                  {FORMA_PAGO_OPTIONS.map((fp) => <option key={fp} value={fp}>{fp}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Banco</label>
                <input type="text" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha Orden de Pago</label>
                <input type="date" value={form.ordenPagoFecha} onChange={(e) => setForm({ ...form, ordenPagoFecha: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
            </div>
          </section>
        </div>

        <div className="px-4 sm:px-6 py-3 border-t border-border">
          {covidDescuento && (
            <div className="flex items-center gap-4 text-sm mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <span className="text-amber-700 font-medium">Desglose del monto:</span>
              <span className="text-text-main">S/ {montoBase.toFixed(2)}</span>
              <span className="text-red-600">- S/ {descuentoMonto.toFixed(2)} (COVID)</span>
              <span className="font-semibold text-green-700 ml-2">= S/ {montoFinal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancelar</button>
            <button onClick={guardar} disabled={guardando || colegiadoFallecido}
              className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors">
              {guardando && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              Registrar Expediente
            </button>
          </div>
        </div>
      </div>

      {pdfViewer && (
        <PdfViewerModal base64={pdfViewer.base64} nombre={pdfViewer.nombre} onClose={() => setPdfViewer(null)} />
      )}

      <ModalNuevaCarta
        open={modalCartaOpen}
        onClose={() => setModalCartaOpen(false)}
        onSuccess={onCartaCreada}
      />

      <ModalNuevoMemorando
        open={modalMemorandoOpen}
        onClose={() => setModalMemorandoOpen(false)}
        onSuccess={onMemorandoCreado}
      />
    </div>
  );
}
