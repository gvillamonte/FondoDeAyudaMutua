'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import PdfViewerModal from '@/components/common/PdfViewerModal';
import ConfirmCenterMessage, { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import EditarExpedienteModal from '@/components/fam/EditarExpedienteModal';
import CompletarBeneficiariosModal from '@/components/fam/CompletarBeneficiariosModal';
import PagoExpedienteModal from '@/components/fam/PagoExpedienteModal';
import EditarDepositoModal from '@/components/fam/EditarDepositoModal';
import HistorialExpediente from '@/components/fam/HistorialExpediente';
import EliminarExpedienteModal from '@/components/fam/EliminarExpedienteModal';
import ModalRegularizarSaldo from '@/components/fam/ModalRegularizarSaldo';
import ModalCartaPoder from '@/components/fam/ModalCartaPoder';
import {
  procesarArchivoDocumento,
  unirDocumentosPdf,
  DocumentoParaUnir,
} from '@/lib/pdf-utils';

interface BeneficiarioVinculado {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco: string;
  porcentajeAsignado: number;
  tieneDeclaracionJurada?: boolean;
  declaracionJuradaDni?: string | null;
  tieneOrdenPago?: boolean;
}

interface DepositoBeneficiario {
  id: string;
  beneficiarioId: string | null;
  nombreBeneficiario: string | null;
  dniBeneficiario: string | null;
  porcentaje: number;
  monto: number;
  banco: string | null;
  numeroCuenta: string | null;
  cci: string | null;
  fechaPago: string | null;
  estado: string;
  tieneComprobante: boolean;
  conCartaPoder?: boolean;
  apoderadoNombre?: string | null;
  apoderadoDni?: string | null;
  apoderadoParentesco?: string | null;
  poderMotivo?: string | null;
  tieneCartaPoder?: boolean;
}

interface EstadoReparto {
  porcentajeAsignado: number;
  completo: boolean;
  declaracionesCompletas: boolean;
  beneficiariosFaltantes: string[];
  depositosRegistrados: number;
  listoParaPago: boolean;
  pagada: boolean;
}

interface HistorialBeneficio {
  id: string;
  tipo: string;
  tipoNombre: string;
  monto: number;
  descuentoCovid: number;
  montoFinal: number;
  fecha: string;
  fechaPago: string | null;
  expediente: string;
  solicitanteNombre: string | null;
  solicitanteDni: string | null;
  estado: string;
  esActual: boolean;
}

interface DetalleExpediente {
  id: string;
  colegiadoId: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  ESTADO_COLEGIADO: string;
  FECHA_ULTIMO_PAGO: string | null;
  tipoBeneficio?: { id: string; codigo: string; nombre: string };
  monto: number;
  moneda: string;
  estado: string;
  fechaSolicitud: string;
  fechaPago: string | null;
  documentacionCompleta: boolean;
  documentacionObservacion: string | null;
  solicitanteNombre: string | null;
  solicitanteDni: string | null;
  conCartaPoder?: boolean;
  apoderadoNombre?: string | null;
  apoderadoDni?: string | null;
  apoderadoParentesco?: string | null;
  poderOtorganteNombre?: string | null;
  poderOtorganteDni?: string | null;
  poderOtorganteParentesco?: string | null;
  poderFecha?: string | null;
  poderMotivo?: string | null;
  poderChequeNumero?: string | null;
  expedienteNumero: string | null;
  cartaNumero: string | null;
  cartaFecha: string | null;
  memorandoNumero: string | null;
  memorandoFecha: string | null;
  formaPago: string | null;
  banco: string | null;
  numeroCuenta?: string | null;
  cci?: string | null;
  ordenPagoFecha: string | null;
  observaciones: string | null;
  descuentoCovid: number | null;
  montoFinal: number | null;
  modalidadBeneficio: string | null;
  documentosDisponibles: Record<string, boolean>;
  declaracionJuradaDni: string | null;
  fechaDefuncion?: string | null;
  causaFallecimiento?: string | null;
  fechaDiagnostico?: string | null;
  diagnosticoMedico?: string | null;
  fechaAccidente?: string | null;
  descripcionAccidente?: string | null;
  beneficiariosVinculados: BeneficiarioVinculado[];
  covidMontoTotal: number;
  tieneFallecimiento?: boolean;
  tieneSaldoPendiente?: boolean;
  saldoPendiente?: number;
  montoTotalAsignado?: number;
  montoMinimoNormativo?: number;
  auditoriasBeneficiarios?: Array<{
    id: string;
    accion: string;
    usuarioId: string;
    fecha: string;
    montoFaltante: number;
    montoTotal: number;
    detalleJson?: any;
  }>;
  estadoReparto?: EstadoReparto | null;
  montoBase?: number | null;
  depositos?: DepositoBeneficiario[];
  historialBeneficios: HistorialBeneficio[];
}

const MONTOS_BASE: Record<string, number> = {
  FALLECIMIENTO: 3000,
  ACCIDENTE_GRAVE: 2000,
  ENF_TERMINAL: 2000,
};

const MONTOS_LABEL: Record<string, string> = {
  FALLECIMIENTO: 'Fallecimiento',
  ACCIDENTE_GRAVE: 'Accidente Grave',
  ENF_TERMINAL: 'Enfermedad Terminal',
};

const DOCS_LABELS: Record<string, string> = {
  fichaAdmisibilidad: 'Ficha de Admisibilidad',
  solicitudAsignacion: 'Solicitud de Asignación',
  cartaRemision: 'Carta de Remisión',
  memorando: 'Memorándum',
  ordenPago: 'Orden de Pago',
  cartaPoder: 'Carta Poder (Apoderado)',
  sucesionIntestada: 'Sucesión Intestada',
  declaracionJurada: 'Declaración Jurada',
  actaDefuncion: 'Acta de Defunción',
  otrosDocumentos: 'Otros / Documentación Completa',
};

const ESTADO_BADGE_STYLE: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-200',
  EN_REVISION: 'bg-blue-100 text-blue-800 border-blue-200',
  APROBADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  RECHAZADA: 'bg-rose-100 text-rose-800 border-rose-200',
  PAGADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const MODALIDAD_LABELS: Record<string, string> = {
  monto_unico: 'Monto Único',
  monto_compartido: 'Monto Compartido',
  opcion_sucesiva: 'Opción Sucesiva',
};

const fmt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const fmtMonto = (m: number) => `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

export default function DetalleExpedientePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [detalle, setDetalle] = useState<DetalleExpediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ base64: string; nombre: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'montos' | 'docs' | 'benef' | 'admin' | 'historial'>('montos');
  const [docsOtros, setDocsOtros] = useState<Record<string, { docs: Record<string, boolean>; expediente: string; dniDJ: string; benefCount: number }>>({});
  const [docsCargados, setDocsCargados] = useState(false);
  const [docsGrupoSel, setDocsGrupoSel] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [docTarget, setDocTarget] = useState<{ expedienteId: string; campo: string } | null>(null);
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [guardandoAdmin, setGuardandoAdmin] = useState(false);
  const [eliminarAbierto, setEliminarAbierto] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [editHistorialId, setEditHistorialId] = useState<string | null>(null);
  const [slaConfig, setSlaConfig] = useState<any[]>([]);
  const [completarOpen, setCompletarOpen] = useState(false);
  const [regularizarOpen, setRegularizarOpen] = useState(false);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [cartaPoderOpen, setCartaPoderOpen] = useState(false);
  const [depositoEdit, setDepositoEdit] = useState<DepositoBeneficiario | null>(null);
  const [formAdmin, setFormAdmin] = useState({
    estado: '', monto: '', fechaSolicitud: '', fechaPago: '',
    observaciones: '', formaPago: '', banco: '',
    numeroCuenta: '', cci: '',
    cartaNumero: '', cartaFecha: '', memorandoNumero: '', memorandoFecha: '',
    expedienteNumero: '',
  });

  useEffect(() => {
    const user = getCurrentUser();
    setIsAdmin(user?.rol === 'ADMINISTRADOR');
    setUserRole(user?.rol || '');
  }, []);

  useEffect(() => {
    if (!id) return;
    let activo = true;
    setLoading(true);
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'docs') setActiveTab('docs');
    api.get(`/fam-beneficios/${id}`)
      .then(({ data }) => {
        if (!activo) return;
        setDetalle(data);
        setFormAdmin({
          estado: data.estado || '',
          monto: String(data.monto ?? ''),
          fechaSolicitud: data.fechaSolicitud ? new Date(data.fechaSolicitud).toISOString().slice(0, 10) : '',
          fechaPago: data.fechaPago ? new Date(data.fechaPago).toISOString().slice(0, 10) : '',
          observaciones: data.observaciones || '',
          formaPago: data.formaPago || '',
          banco: data.banco || '',
          numeroCuenta: data.numeroCuenta || '',
          cci: data.cci || '',
          cartaNumero: data.cartaNumero || '',
          cartaFecha: data.cartaFecha ? new Date(data.cartaFecha).toISOString().slice(0, 10) : '',
          memorandoNumero: data.memorandoNumero || '',
          memorandoFecha: data.memorandoFecha ? new Date(data.memorandoFecha).toISOString().slice(0, 10) : '',
          expedienteNumero: data.expedienteNumero || '',
        });
      })
      .catch(() => { if (activo) setDetalle(null); })
      .finally(() => { if (activo) setLoading(false); });

    api.get('/expediente-sla/config', { params: { activos: 'true' } })
      .then((slaRes) => {
        if (!activo) return;
        setSlaConfig(Array.isArray(slaRes.data) ? slaRes.data : []);
      })
      .catch(() => {});
    return () => { activo = false; };
  }, [id]);

  const recargar = useCallback(() => {
    if (!id) return;
    api.get(`/fam-beneficios/${id}`).then(({ data }) => setDetalle(data));
  }, [id]);

  useEffect(() => {
    if (activeTab !== 'docs' || !detalle) return;
    const otros = [...new Set((detalle.historialBeneficios || []).map((h) => h.id).filter((hid) => hid !== id))];
    if (otros.length === 0) { setDocsOtros({}); setDocsCargados(true); return; }
    let activo = true;
    setDocsCargados(false);
    Promise.all(otros.map((hid) =>
      api.get(`/fam-beneficios/${hid}`)
        .then(({ data }) => ({ hid, info: { docs: (data.documentosDisponibles || {}) as Record<string, boolean>, expediente: (data.expedienteNumero || '') as string, dniDJ: (data.declaracionJuradaDni || '') as string, benefCount: (data.beneficiariosVinculados || []).length } }))
        .catch(() => null)
    )).then((res) => {
      if (!activo) return;
      const mapa: Record<string, { docs: Record<string, boolean>; expediente: string; dniDJ: string; benefCount: number }> = {};
      res.forEach((r) => { if (r) mapa[r.hid] = r.info; });
      setDocsOtros(mapa);
      setDocsCargados(true);
    });
    return () => { activo = false; };
  }, [activeTab, detalle, id]);

  const irADocumentacion = (expedienteId?: string | null) => {
    if (!expedienteId) return;
    if (expedienteId === id) {
      setActiveTab('docs');
      return;
    }
    router.push(`/dashboard/fam/expedientes/${expedienteId}?tab=docs`);
  };

  const abrirPdf = async (expedienteId: string, campo: string) => {
    const key = `${expedienteId}:${campo}`;
    setPdfLoadingKey(key);
    try {
      const { data } = await api.get(`/fam-beneficios/${expedienteId}/documento/${campo}`);
      const numero = expedienteId === id ? detalle?.expedienteNumero : docsOtros[expedienteId]?.expediente;
      setPdfViewer({
        base64: data.contenido,
        nombre: `${DOCS_LABELS[campo] || 'Documento'}${numero ? ` · ${numero}` : ''}`,
      });
    } catch {
      showConfirmMessage('error', 'Error al abrir documento', 'No se pudo abrir el documento solicitado.');
    } finally {
      setPdfLoadingKey(null);
    }
  };

  const verDeclaracionBeneficiario = async (beneficiarioId: string | null, nombre: string | null, dni: string | null) => {
    if (!beneficiarioId) {
      showConfirmMessage('error', 'Beneficiario no válido', 'No se cuenta con el identificador del beneficiario.');
      return;
    }
    try {
      const { data } = await api.get(`/fam-beneficios/${id}/beneficiario/${beneficiarioId}/declaracion`);
      setPdfViewer({ base64: data.contenido, nombre: `Declaración jurada - ${nombre || dni || 'Beneficiario'}` });
    } catch {
      showConfirmMessage('error', 'Error al abrir declaración', 'No se pudo abrir la declaración jurada.');
    }
  };

  const verOrdenPagoBeneficiario = async (beneficiarioId: string | null, nombre: string | null) => {
    if (!beneficiarioId) {
      showConfirmMessage('error', 'El beneficiario no está vinculado');
      return;
    }
    try {
      const { data } = await api.get(`/fam-beneficios/${id}/beneficiario/${beneficiarioId}/orden-pago`);
      setPdfViewer({ base64: data.contenido, nombre: `Orden de pago / Voucher - ${nombre || 'Beneficiario'}` });
    } catch {
      showConfirmMessage('error', 'Error al abrir orden de pago', 'No se pudo abrir la orden de pago del beneficiario.');
    }
  };

  const refrescarDocs = async (expedienteId: string) => {
    if (expedienteId === id) { recargar(); return; }
    try {
      const { data } = await api.get(`/fam-beneficios/${expedienteId}`);
      setDocsOtros((prev) => ({
        ...prev,
        [expedienteId]: {
          docs: data.documentosDisponibles || {},
          expediente: data.expedienteNumero || '',
          dniDJ: data.declaracionJuradaDni || '',
          benefCount: (data.beneficiariosVinculados || []).length,
        },
      }));
    } catch {}
  };

  const pedirDocumento = (expedienteId: string, campo: string) => {
    if (!isAdmin) return;
    setDocTarget({ expedienteId, campo });
    if (docInputRef.current) docInputRef.current.value = '';
    docInputRef.current?.click();
  };

  const [uniendoDocs, setUniendoDocs] = useState(false);

  const subirDocumento = async (file: File | null) => {
    if (!file || !docTarget) return;
    const { expedienteId, campo } = docTarget;
    const label = DOCS_LABELS[campo] || 'Documento';

    let declaracionJuradaDni: string | undefined;
    if (campo === 'declaracionJurada') {
      const previo = expedienteId === id ? (detalle?.declaracionJuradaDni || '') : (docsOtros[expedienteId]?.dniDJ || '');
      const respuesta = window.prompt('DNI del declarante (8 dígitos)', previo || '');
      if (respuesta === null) return;
      const dni = respuesta.trim();
      if (!/^\d{8}$/.test(dni)) {
        showConfirmMessage('error', 'DNI inválido', 'Debe tener exactamente 8 dígitos');
        return;
      }
      declaracionJuradaDni = dni;
    }

    let base64 = '';
    let esImagenConvertida = false;
    try {
      const res = await procesarArchivoDocumento(file, 10);
      base64 = res.base64;
      esImagenConvertida = res.esImagenConvertida;
    } catch (err: any) {
      showConfirmMessage('error', `${label}: formato inválido`, err?.message || 'Solo se permiten PDF o imágenes (JPG, PNG, WEBP)');
      return;
    }

    const key = `${expedienteId}:${campo}`;
    setSubiendoDoc(key);
    try {
      const previos = expedienteId === id ? (detalle?.documentosDisponibles || {}) : (docsOtros[expedienteId]?.docs || {});
      const nucleo = ['fichaAdmisibilidad', 'solicitudAsignacion', 'cartaRemision', 'memorando', 'ordenPago'];
      const tieneTodo = campo === 'otrosDocumentos' || Boolean(previos.otrosDocumentos);
      const completa = tieneTodo || nucleo.every((c) => c === campo || Boolean(previos[c]));
      await api.put(`/fam-beneficios/${expedienteId}`, {
        [campo]: base64,
        ...(declaracionJuradaDni && { declaracionJuradaDni }),
        ...(completa ? { documentacionCompleta: true } : {}),
      });
      showConfirmMessage(
        'success',
        `${label} subido correctamente`,
        esImagenConvertida
          ? 'La imagen fue convertida a PDF y guardada con éxito'
          : (expedienteId === id ? detalle?.expedienteNumero || '' : docsOtros[expedienteId]?.expediente || ''),
      );
      await refrescarDocs(expedienteId);
    } catch (err: any) {
      showConfirmMessage('error', 'No se pudo subir el documento', err?.response?.data?.message || 'Intente nuevamente');
    } finally {
      setSubiendoDoc(null);
      setDocTarget(null);
    }
  };

  const verExpedienteCompletoPdf = async (expedienteId = id) => {
    setUniendoDocs(true);
    try {
      const docsParaUnir: DocumentoParaUnir[] = [];
      const disponibles = expedienteId === id ? (detalle?.documentosDisponibles || {}) : (docsOtros[expedienteId]?.docs || {});

      // 1. Obtener todos los documentos del expediente
      const promesasDocs = Object.keys(disponibles)
        .filter((campo) => disponibles[campo])
        .map(async (campo) => {
          try {
            const { data } = await api.get(`/fam-beneficios/${expedienteId}/documento/${campo}`);
            if (data?.contenido) {
              return {
                titulo: DOCS_LABELS[campo] || campo,
                base64: data.contenido as string,
                campo,
              };
            }
          } catch (e) {
            console.warn(`No se pudo obtener el documento ${campo}:`, e);
          }
          return null;
        });

      const docsObtenidos = (await Promise.all(promesasDocs)).filter(Boolean) as { titulo: string; base64: string; campo: string }[];

      // Orden canónico según CAMPOS_DOCUMENTO
      const orden = [
        'fichaAdmisibilidad',
        'solicitudAsignacion',
        'cartaRemision',
        'memorando',
        'ordenPago',
        'cartaPoder',
        'sucesionIntestada',
        'declaracionJurada',
        'actaDefuncion',
        'otrosDocumentos',
      ];
      docsObtenidos.sort((a, b) => {
        const ia = orden.indexOf(a.campo);
        const ib = orden.indexOf(b.campo);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      docsObtenidos.forEach((d) => docsParaUnir.push({ titulo: d.titulo, base64: d.base64 }));

      // 2. Si es el expediente actual, incluir declaraciones u órdenes de pago de beneficiarios
      if (expedienteId === id && detalle?.beneficiariosVinculados) {
        const promesasBenes = detalle.beneficiariosVinculados.map(async (b) => {
          const benDocs: DocumentoParaUnir[] = [];
          if (b.tieneDeclaracionJurada) {
            try {
              const { data } = await api.get(`/fam-beneficios/${id}/beneficiario/${b.id}/declaracion`);
              if (data?.contenido) {
                benDocs.push({
                  titulo: `Declaración Jurada - ${b.nombre}`,
                  base64: data.contenido,
                  subtitulo: b.dni ? `DNI: ${b.dni}` : undefined,
                });
              }
            } catch {}
          }
          if (b.tieneOrdenPago) {
            try {
              const { data } = await api.get(`/fam-beneficios/${id}/beneficiario/${b.id}/orden-pago`);
              if (data?.contenido) {
                benDocs.push({
                  titulo: `Voucher / Orden de Pago - ${b.nombre}`,
                  base64: data.contenido,
                  subtitulo: `Asignado: ${b.porcentajeAsignado}%`,
                });
              }
            } catch {}
          }
          return benDocs;
        });

        const benesDocsList = await Promise.all(promesasBenes);
        benesDocsList.flat().forEach((d) => docsParaUnir.push(d));
      }

      // 3. Comprobantes de depósito realizados
      if (expedienteId === id && detalle?.depositos) {
        const promesasDepositos = detalle.depositos
          .filter((d) => d.tieneComprobante)
          .map(async (d) => {
            try {
              const { data } = await api.get(`/fam-beneficios/${id}/comprobante-deposito/${d.id}`);
              if (data?.contenido) {
                return {
                  titulo: `Comprobante de Depósito - ${d.nombreBeneficiario || 'Beneficiario'}`,
                  base64: data.contenido as string,
                  subtitulo: `Monto: S/ ${d.monto}${d.banco ? ` • Banco: ${d.banco}` : ''}`,
                };
              }
            } catch {}
            return null;
          });

        const depositosDocs = (await Promise.all(promesasDepositos)).filter(Boolean) as DocumentoParaUnir[];
        depositosDocs.forEach((d) => docsParaUnir.push(d));
      }

      if (docsParaUnir.length === 0) {
        showConfirmMessage('warning', 'Sin documentos', 'Este expediente no tiene documentos adjuntos para consolidar.');
        return;
      }

      const mergedBase64 = await unirDocumentosPdf(docsParaUnir, {
        expedienteNumero: detalle?.expedienteNumero || 'EXP-FAM',
        colegiadoNombre: detalle?.NOMBRE_COLEGIADO,
        colegiadoCip: detalle?.NUM_COLEGIATURA,
        tipoBeneficio: detalle?.tipoBeneficio?.nombre,
        incluirCaratula: true,
      });

      setPdfViewer({
        base64: mergedBase64,
        nombre: `Expediente Completo Consolidado - ${detalle?.expedienteNumero || detalle?.NOMBRE_COLEGIADO || 'FAM'}`,
      });
    } catch (err: any) {
      showConfirmMessage('error', 'Error al consolidar documentos', err?.message || 'No se pudieron consolidar los PDFs.');
    } finally {
      setUniendoDocs(false);
    }
  };

  const guardarAdmin = async () => {
    setGuardandoAdmin(true);
    try {
      await api.put(`/fam-beneficios/${id}`, {
        estado: formAdmin.estado || undefined,
        monto: formAdmin.monto ? parseFloat(formAdmin.monto) : undefined,
        fechaSolicitud: formAdmin.fechaSolicitud || undefined,
        fechaPago: formAdmin.fechaPago || undefined,
        observaciones: formAdmin.observaciones || undefined,
        formaPago: formAdmin.formaPago || undefined,
        banco: formAdmin.banco || undefined,
        numeroCuenta: formAdmin.numeroCuenta?.trim() || undefined,
        cci: formAdmin.cci?.trim() || undefined,
        cartaNumero: formAdmin.cartaNumero || undefined,
        cartaFecha: formAdmin.cartaFecha || undefined,
        memorandoNumero: formAdmin.memorandoNumero || undefined,
        memorandoFecha: formAdmin.memorandoFecha || undefined,
        expedienteNumero: formAdmin.expedienteNumero || undefined,
      });
      recargar();
      showConfirmMessage('success', 'Expediente actualizado', 'Los cambios administrativos se guardaron correctamente.');
    } catch (e: any) {
      showConfirmMessage('error', 'Error al guardar', e.response?.data?.message || 'Error desconocido');
    } finally {
      setGuardandoAdmin(false);
    }
  };

  const eliminarExpediente = () => {
    if (!detalle) return;
    setEliminarAbierto(true);
  };

  const calcFilasMontos = () => {
    if (!detalle) return [];
    const tipoActual = detalle.tipoBeneficio?.codigo || '';
    const covidTotal = detalle.covidMontoTotal || 0;

    // Asegurar que el expediente actual esté reflejado si está pagado o con orden de pago / documentos
    const listaHistorial = [...(detalle.historialBeneficios || [])];
    const tieneOrdenPagoActual = Boolean(
      detalle.documentosDisponibles?.ordenPago ||
      detalle.beneficiariosVinculados?.some((b) => b.tieneOrdenPago) ||
      detalle.depositos?.some((d) => d.tieneComprobante || d.fechaPago)
    );
    const tieneMemorandoActual = Boolean(detalle.documentosDisponibles?.memorando);
    const tieneCartaActual = Boolean(detalle.documentosDisponibles?.cartaRemision);
    const procesoFinalizado = detalle.estado === 'PAGADA' || tieneOrdenPagoActual || (tieneOrdenPagoActual && tieneMemorandoActual && tieneCartaActual);

    const montoActual = Number(detalle.montoFinal ?? detalle.monto) || 0;
    const idxActual = listaHistorial.findIndex((h) => h.id === id);

    if (idxActual >= 0) {
      listaHistorial[idxActual] = {
        ...listaHistorial[idxActual],
        monto: montoActual,
        montoFinal: montoActual,
        estado: procesoFinalizado ? 'PAGADA' : listaHistorial[idxActual].estado,
      };
    } else if (procesoFinalizado || detalle.estado === 'APROBADA') {
      listaHistorial.push({
        id,
        tipo: tipoActual,
        tipoNombre: detalle.tipoBeneficio?.nombre || tipoActual,
        monto: montoActual,
        descuentoCovid: Number(detalle.descuentoCovid || 0),
        montoFinal: montoActual,
        fecha: detalle.fechaSolicitud,
        fechaPago: detalle.fechaPago || new Date().toISOString(),
        expediente: detalle.expedienteNumero || '',
        solicitanteNombre: detalle.solicitanteNombre,
        solicitanteDni: detalle.solicitanteDni,
        estado: procesoFinalizado ? 'PAGADA' : detalle.estado,
        esActual: true,
      });
    }

    const filas = Object.entries(MONTOS_BASE).map(([codigo, base]) => {
      const historiales = listaHistorial.filter(
        (h) => h.tipo === codigo && (h.estado === 'PAGADA' || h.estado === 'APROBADA' || (h.id === id && procesoFinalizado))
      );
      const recibidoBruto = historiales.reduce((sum, h) => sum + (Number(h.montoFinal ?? h.monto) || 0), 0);
      const descuento = codigo === 'ENF_TERMINAL' ? covidTotal : 0;
      const baseNeto = base - descuento;
      const recibido = Math.min(recibidoBruto, Math.max(0, baseNeto));
      const porRecibir = Math.max(0, baseNeto - recibido);
      const esActual = historiales.some((h) => h.esActual || h.id === id);
      return {
        codigo, label: MONTOS_LABEL[codigo] || codigo, base, recibidoBruto,
        recibido, descuento, baseNeto, porRecibir, esActual,
        historial: historiales,
        expedientes: historiales.map((h) => h.expediente).filter(Boolean),
        estado: historiales.length > 0 ? (recibido >= baseNeto ? 'COMPLETO' : 'PARCIAL') : 'SIN_TRAMITE',
      };
    });

    filas.push({
      codigo: 'COVID_19', label: 'COVID-19 (Pandemia)',
      base: 0, recibidoBruto: covidTotal, recibido: covidTotal,
      descuento: 0, baseNeto: 0, porRecibir: 0,
      esActual: tipoActual === 'COVID_19',
      historial: listaHistorial.filter((h) => h.tipo === 'COVID_19'),
      expedientes: listaHistorial.filter((h) => h.tipo === 'COVID_19').map((h) => h.expediente).filter(Boolean),
      estado: covidTotal > 0 ? 'RECIBIDO' : 'SIN_REGISTRO',
    });

    const fallecimientoEjecutado = filas.some((f) => f.codigo === 'FALLECIMIENTO' && f.historial.length > 0);
    if (fallecimientoEjecutado) {
      filas.forEach((f) => { f.porRecibir = 0; });
    }

    return filas;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 min-h-[50vh]">
        <svg
          className="animate-spin w-8 h-8 text-[#3258CA]"
          width="32"
          height="32"
          style={{ width: '32px', height: '32px', color: '#3258CA' }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-slate-500 font-medium text-sm">Cargando expediente...</span>
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="text-center py-12 sm:py-16 bg-white rounded-xl border border-slate-200 p-6 sm:p-8 max-w-lg mx-auto shadow-xs">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-slate-800 text-base sm:text-lg font-bold">Expediente no encontrado</h2>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">El expediente solicitado no existe o fue eliminado.</p>
        <button
          onClick={() => router.push('/dashboard/fam/expedientes')}
          className="mt-5 inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-[#3258CA] rounded-lg hover:bg-[#2846a3] transition-colors"
        >
          Volver a Expedientes
        </button>
      </div>
    );
  }

  const filasMontos = calcFilasMontos();
  const baseTotalMontos = filasMontos.reduce((s, f) => s + f.base, 0);
  const recibidoNetoMontos = filasMontos.reduce((s, f) => s + f.recibido, 0);
  const porRecibirMontos = filasMontos.reduce((s, f) => s + f.porRecibir, 0);

  const registrosDocs: HistorialBeneficio[] = [...(detalle.historialBeneficios || [])];
  if (!registrosDocs.some((h) => h.id === id)) {
    registrosDocs.push({
      id,
      tipo: detalle.tipoBeneficio?.codigo || '',
      tipoNombre: detalle.tipoBeneficio?.nombre || '',
      monto: Number(detalle.monto) || 0,
      descuentoCovid: Number(detalle.descuentoCovid || 0),
      montoFinal: Number(detalle.montoFinal ?? detalle.monto) || 0,
      fecha: detalle.fechaSolicitud,
      fechaPago: detalle.fechaPago,
      expediente: detalle.expedienteNumero || '',
      solicitanteNombre: detalle.solicitanteNombre,
      solicitanteDni: detalle.solicitanteDni,
      estado: detalle.estado,
      esActual: true,
    });
  }

  const docsDeExpediente = (hid: string): Record<string, boolean> =>
    hid === id ? (detalle.documentosDisponibles || {}) : (docsOtros[hid]?.docs || {});

  const gruposDocs = registrosDocs.reduce((acc, h) => {
    const tieneDocs = Object.values(docsDeExpediente(h.id)).some(Boolean);
    if (!tieneDocs && !isAdmin) return acc;
    let g = acc.find((x) => x.tipo === h.tipo);
    if (!g) { g = { tipo: h.tipo, nombre: h.tipoNombre || h.tipo, registros: [] }; acc.push(g); }
    g.registros.push(h);
    return acc;
  }, [] as { tipo: string; nombre: string; registros: HistorialBeneficio[] }[]);

  const grupoDocsSel = gruposDocs.find((g) => g.tipo === docsGrupoSel)
    || gruposDocs.find((g) => g.registros.some((r) => r.id === id))
    || gruposDocs[0]
    || null;

  const puedeRegistrarHistorico = isAdmin || userRole === 'OPERADOR_PAGOS';
  const tiposFaltantes = ['Fallecimiento', 'Accidente Grave', 'Enfermedad Terminal'].filter((nombre) => {
    const configs: Record<string, string> = { 'Fallecimiento': 'FALLECIMIENTO', 'Accidente Grave': 'ACC_GRAVE', 'Enfermedad Terminal': 'ENF_TERMINAL' };
    const key = configs[nombre];
    return !detalle.historialBeneficios.some((h) => h.tipo === key && h.estado !== 'RECHAZADA');
  });

  const tieneFallecimiento = Boolean(detalle.tieneFallecimiento) ||
    (detalle.historialBeneficios || []).some((h) => h.tipo === 'FALLECIMIENTO' && h.estado !== 'RECHAZADA');

  const reparto = detalle.estadoReparto || null;
  const depositos = detalle.depositos || [];
  const puedeOperar = isAdmin || userRole === 'OPERADOR_PAGOS';

  const ESTADOS_FLUJO = ['PENDIENTE', 'EN_REVISION', 'APROBADA', 'PAGADA'];
  const idxActual = ESTADOS_FLUJO.indexOf(detalle.estado);
  const horasTranscurridas = (Date.now() - new Date(detalle.fechaSolicitud || detalle.id).getTime()) / (1000 * 60 * 60);
  const configActual = slaConfig.find((c) => c.estado === detalle.estado);
  const horasLimite = configActual?.horasLimite || 0;
  const horasRestantes = horasLimite > 0 ? horasLimite - horasTranscurridas : null;

  // Sustento legal activo en el encabezado
  const sustentoDocCampo = detalle.tipoBeneficio?.codigo === 'FALLECIMIENTO'
    ? (detalle.documentosDisponibles?.actaDefuncion ? 'actaDefuncion' : detalle.documentosDisponibles?.sucesionIntestada ? 'sucesionIntestada' : null)
    : (detalle.documentosDisponibles?.solicitudAsignacion ? 'solicitudAsignacion' : null);

  const sustentoDocLabel = sustentoDocCampo === 'actaDefuncion'
    ? 'Acta Defunción PDF'
    : sustentoDocCampo === 'sucesionIntestada'
    ? 'Sucesión Intestada PDF'
    : sustentoDocCampo === 'solicitudAsignacion'
    ? 'Solicitud Asignación PDF'
    : null;

  return (
    <div className="w-full space-y-5 pb-8 font-sans text-slate-800 antialiased">
      <ConfirmCenterMessage />

      {/* Alerta de Saldo Pendiente y Regularización */}
      {detalle.tieneSaldoPendiente && (
        <div className="w-full p-4 bg-amber-50 border border-amber-300 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-amber-900 text-sm">Expediente con Saldo Pendiente de Regularizar</h3>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-200 text-amber-900 rounded-full">
                  Falta: S/ {Number(detalle.saldoPendiente || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Monto total asignado actualmente:{' '}
                <strong>
                  S/ {Number(detalle.montoTotalAsignado ?? detalle.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </strong>
                {' · '}
                Monto mínimo normativo:{' '}
                <strong>
                  S/ {Number(detalle.montoMinimoNormativo || 3000).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </strong>
                . Puede incorporar beneficiarios adicionales o ajustar montos para cubrir el saldo normativo.
              </p>
            </div>
          </div>
          {puedeOperar && (
            <button
              onClick={() => setRegularizarOpen(true)}
              type="button"
              className="px-4 py-2 bg-[#3258CA] text-white text-xs font-semibold rounded-lg hover:bg-[#2846a3] transition-colors shrink-0 shadow-xs inline-flex items-center gap-1.5 self-start sm:self-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Regularizar Saldo
            </button>
          )}
        </div>
      )}

      {/* Alerta de SLA Vencido o Próximo a Vencer */}
      {horasRestantes !== null && (detalle.estado === 'PENDIENTE' || detalle.estado === 'EN_REVISION') && (
        horasRestantes <= 0 ? (
          <div className="w-full p-4 bg-red-50 border border-red-200 rounded-xl shadow-2xs flex items-center justify-between gap-3 text-red-900">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-700 rounded-lg shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-red-800">Alerta de SLA Superado / Plazo Vencido</h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded-full">
                    {Math.abs(Math.floor(horasRestantes))}h excedidas
                  </span>
                </div>
                <p className="text-xs text-red-700 mt-0.5">
                  Este expediente ha excedido el plazo límite normativo ({horasLimite}h) para la etapa de {detalle.estado}. Requiere atención prioritaria.
                </p>
              </div>
            </div>
          </div>
        ) : horasRestantes <= 12 ? (
          <div className="w-full p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-2xs flex items-center justify-between gap-3 text-amber-900">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-amber-800">Próximo a Vencer el Plazo de SLA</h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-600 text-white rounded-full">
                    Restan {Math.max(1, Math.floor(horasRestantes))}h
                  </span>
                </div>
                <p className="text-xs text-amber-700 mt-0.5">
                  El plazo límite normativo ({horasLimite}h) para resolver la etapa de {detalle.estado} vence en menos de 12 horas.
                </p>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* Alerta de Documentación Incompleta */}
      {!detalle.documentacionCompleta && detalle.estado !== 'PAGADA' && detalle.estado !== 'RECHAZADA' && (
        <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-2xs flex items-center justify-between gap-3 text-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-[#3258CA] rounded-lg shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#3258CA]">Requisitos y Documentación Incompleta</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 rounded-full">
                  Pendiente de carga
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {detalle.documentacionObservacion || 'El expediente aún cuenta con documentos obligatorios sin cargar. Revise la pestaña de Historial y Documentos para regularizarlos.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cabecera limpia integrada con el layout (sin cuadro flotante en el medio) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <button
            onClick={() => router.push('/dashboard/fam/expedientes')}
            className="text-slate-500 hover:text-[#3258CA] transition-colors font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Expedientes
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-semibold truncate max-w-[280px] sm:max-w-md">
            {detalle.expedienteNumero ? `Expediente #${detalle.expedienteNumero}` : detalle.NOMBRE_COLEGIADO}
          </span>
        </div>

        {/* Acciones principales a ancho natural */}
        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto print:hidden">
          <button
            onClick={() => verExpedienteCompletoPdf(id)}
            type="button"
            disabled={uniendoDocs}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-[#3258CA] hover:bg-[#2846a3] disabled:opacity-50 rounded-lg shadow-xs transition-colors"
            title="Ver todos los documentos del expediente unificados en un solo PDF"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {uniendoDocs ? 'Consolidando...' : 'Ver Expediente Completo (PDF)'}
          </button>
          <button
            onClick={() => window.print()}
            type="button"
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <svg className="w-4 h-4 mr-1 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
            Imprimir
          </button>
          {isAdmin && (
            <button
              onClick={() => setEditHistorialId(id)}
              type="button"
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-[#3258CA] bg-white border border-[#3258CA]/40 hover:bg-blue-50 rounded-lg shadow-xs transition-colors"
              title="Editar datos del expediente (solo Administrador)"
            >
              <svg className="w-4 h-4 mr-1 text-[#3258CA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar expediente
            </button>
          )}
          {isAdmin && (
            <button
              onClick={eliminarExpediente}
              type="button"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg shadow-xs transition-colors"
            >
              <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
              Eliminar expediente
            </button>
          )}
        </div>
      </div>

      {/* BEGIN: MemberAndFileHeaderCard (Abarca el 100% del ancho del dashboard) */}
      <section className="w-full bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 lg:p-6" data-purpose="member-summary">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 pb-5 sm:pb-6 border-b border-slate-100">
          {/* Identificación del Colegiado */}
          <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-[#3258CA] font-bold text-lg sm:text-xl">
              {detalle.NOMBRE_COLEGIADO?.charAt(0) || 'C'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight break-words">
                  {detalle.NOMBRE_COLEGIADO}
                </h1>
                <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border shrink-0 ${ESTADO_BADGE_STYLE[detalle.estado] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {detalle.estado.replace('_', ' ')}
                </span>
              </div>
              {/* Metadatos secundarios */}
              <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
                <div className="flex items-center space-x-1">
                  <span className="font-medium text-slate-400">CIP:</span>
                  <span className="font-semibold text-slate-700">{detalle.NUM_COLEGIATURA}</span>
                </div>
                <span className="text-slate-300">•</span>
                <div className="flex items-center space-x-1">
                  <span className="font-medium text-slate-400">DNI:</span>
                  <span className="font-semibold text-slate-700">{detalle.DNI}</span>
                </div>
                <span className="text-slate-300">•</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold border ${
                  detalle.ESTADO_COLEGIADO === 'HABILITADO'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-600 border-rose-200'
                }`}>
                  {detalle.ESTADO_COLEGIADO}
                </span>
              </div>
            </div>
          </div>

          {/* Hero Total Expediente */}
          <div className="bg-slate-50 lg:bg-transparent rounded-xl p-3.5 sm:p-4 lg:p-0 flex items-start lg:items-end flex-col justify-center border lg:border-none border-slate-100 w-full lg:w-auto">
            <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400 mb-0.5">Total Expediente</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {fmtMonto(detalle.monto)}
            </div>
            <span className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center">
              <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
              </svg>
              {detalle.estado === 'PAGADA' ? 'Liquidado al 100%' : detalle.estado === 'APROBADA' ? 'Aprobado para desembolso' : 'En proceso de evaluación'}
            </span>
          </div>
        </div>

        {/* Grilla de metadatos adaptable */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-4 sm:pt-6">
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Tipo</span>
            <p className="text-xs sm:text-sm font-semibold text-slate-800 break-words">{detalle.tipoBeneficio?.nombre || 'Fallecimiento'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Modalidad</span>
            <p className="text-xs sm:text-sm font-semibold text-slate-800 break-words">{MODALIDAD_LABELS[detalle.modalidadBeneficio || ''] || 'Monto Único'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">N° Expediente</span>
            <p className="text-xs sm:text-sm font-bold text-[#3258CA]"># {detalle.expedienteNumero || detalle.id.slice(0, 6)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">F. Recepción</span>
            <p className="text-xs sm:text-sm font-semibold text-slate-800">{fmt(detalle.fechaSolicitud)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">F. de Pago</span>
            <p className="text-xs sm:text-sm font-semibold text-slate-800">{fmt(detalle.fechaPago)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Sustento Legal</span>
            <div>
              {sustentoDocCampo ? (
                <button
                  onClick={() => abrirPdf(id, sustentoDocCampo)}
                  disabled={pdfLoadingKey === `${id}:${sustentoDocCampo}`}
                  className="inline-flex items-center text-xs font-semibold text-[#3258CA] hover:text-[#2846a3] bg-blue-50 hover:bg-blue-100 px-2 sm:px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 max-w-full truncate"
                  type="button"
                >
                  <svg className="w-3.5 h-3.5 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  <span className="truncate">{pdfLoadingKey === `${id}:${sustentoDocCampo}` ? 'Cargando...' : sustentoDocLabel}</span>
                </button>
              ) : isAdmin ? (
                <button
                  onClick={() => pedirDocumento(id, detalle.tipoBeneficio?.codigo === 'FALLECIMIENTO' ? 'actaDefuncion' : 'solicitudAsignacion')}
                  className="inline-flex items-center text-xs font-semibold text-[#3258CA] hover:underline"
                  type="button"
                >
                  + Cargar Sustento
                </button>
              ) : (
                <span className="text-xs text-slate-400">Sin sustento</span>
              )}
            </div>
          </div>
        </div>

        {/* Píldora inferior de contexto */}
        <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 bg-slate-50/70 p-3 rounded-lg">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {detalle.fechaDefuncion && (
              <span><strong>Fecha Fallecimiento:</strong> {fmt(detalle.fechaDefuncion)}</span>
            )}
            {detalle.causaFallecimiento && (
              <>
                <span className="text-slate-300">•</span>
                <span><strong>Causa:</strong> {detalle.causaFallecimiento}</span>
              </>
            )}
            {detalle.fechaDiagnostico && (
              <span><strong>Fecha Diagnóstico:</strong> {fmt(detalle.fechaDiagnostico)}</span>
            )}
            {detalle.diagnosticoMedico && (
              <>
                <span className="text-slate-300">•</span>
                <span><strong>Diagnóstico:</strong> {detalle.diagnosticoMedico}</span>
              </>
            )}
            {detalle.fechaAccidente && (
              <span><strong>Fecha Accidente:</strong> {fmt(detalle.fechaAccidente)}</span>
            )}
            {detalle.descripcionAccidente && (
              <>
                <span className="text-slate-300">•</span>
                <span><strong>Detalle:</strong> {detalle.descripcionAccidente}</span>
              </>
            )}
            {detalle.documentacionObservacion && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-amber-800 font-medium"><strong>Obs. Docs:</strong> {detalle.documentacionObservacion}</span>
              </>
            )}
            {detalle.formaPago && (
              <>
                <span className="text-slate-300">•</span>
                <span><strong>Forma Pago:</strong> {detalle.formaPago}</span>
              </>
            )}
            {detalle.banco && (
              <>
                <span className="text-slate-300">•</span>
                <span><strong>Banco:</strong> {detalle.banco}</span>
              </>
            )}
            {detalle.numeroCuenta && (
              <>
                <span className="text-slate-300">•</span>
                <span><strong>N.° Cuenta:</strong> <span className="font-mono font-semibold text-slate-700">{detalle.numeroCuenta}</span></span>
              </>
            )}
            {detalle.cci && (
              <>
                <span className="text-slate-300">•</span>
                <span><strong>CCI:</strong> <span className="font-mono font-semibold text-slate-700">{detalle.cci}</span></span>
              </>
            )}
            {detalle.observaciones && (
              <>
                <span className="text-slate-300">•</span>
                <span><strong>Observaciones:</strong> {detalle.observaciones}</span>
              </>
            )}
          </div>
          <span className="text-slate-400 italic font-mono text-[11px] break-all">Expediente ID: {detalle.id}</span>
        </div>

        {detalle.conCartaPoder && detalle.apoderadoNombre && (
          <div className="mt-4 bg-amber-50/90 border border-amber-300 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-amber-200/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    📋 Trazabilidad de Cobro con Carta Poder (Beneficio / Cheque)
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Registro auditado de delegación de cobro: se preserva el beneficiario legítimo y se identifica a quien cobra el cheque.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {detalle.documentosDisponibles?.cartaPoder ? (
                  <button
                    type="button"
                    onClick={() => abrirPdf(id, 'cartaPoder')}
                    disabled={pdfLoadingKey === `${id}:cartaPoder`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {pdfLoadingKey === `${id}:cartaPoder` ? 'Abriendo...' : 'Ver Carta Poder PDF'}
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-amber-800 bg-amber-100 px-2.5 py-1 rounded">
                    PDF Carta Poder pendiente
                  </span>
                )}
                {puedeOperar && (
                  <button
                    type="button"
                    onClick={() => setCartaPoderOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#3258CA] rounded-lg hover:bg-[#2846a3] transition-colors"
                  >
                    Editar Carta Poder
                  </button>
                )}
              </div>
            </div>

            {/* Cadena de Trazabilidad en 3 pasos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="bg-white/90 border border-amber-200 rounded-lg p-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  1. Colegiado Titular
                </span>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{detalle.NOMBRE_COLEGIADO}</p>
                <p className="text-[11px] text-slate-500">
                  CIP: {detalle.NUM_COLEGIATURA} · DNI: {detalle.DNI}
                </p>
              </div>

              <div className="bg-white/90 border border-blue-200 rounded-lg p-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#3258CA]">
                  2. Beneficiario / Quien otorga el Poder
                </span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">
                  {detalle.poderOtorganteNombre ||
                    detalle.beneficiariosVinculados[0]?.nombre ||
                    detalle.NOMBRE_COLEGIADO}
                </p>
                <p className="text-[11px] text-slate-600">
                  {detalle.poderOtorganteParentesco ||
                    detalle.beneficiariosVinculados[0]?.parentesco ||
                    'Titular'}
                  {(detalle.poderOtorganteDni || detalle.beneficiariosVinculados[0]?.dni)
                    ? ` · DNI: ${detalle.poderOtorganteDni || detalle.beneficiariosVinculados[0]?.dni}`
                    : ''}
                </p>
              </div>

              <div className="bg-white border-2 border-amber-400 rounded-lg p-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  3. Persona que cobra el Cheque (Apoderado)
                </span>
                <p className="text-xs font-bold text-slate-900 mt-0.5">{detalle.apoderadoNombre}</p>
                <p className="text-[11px] text-amber-900 font-medium">
                  DNI: {detalle.apoderadoDni || '—'} · {detalle.apoderadoParentesco || 'Apoderado'}
                </p>
              </div>
            </div>

            {(detalle.poderFecha || detalle.poderChequeNumero || detalle.poderMotivo) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-950 bg-amber-100/70 px-3 py-2 rounded-lg">
                {detalle.poderFecha && (
                  <span>
                    <strong>Fecha de Poder / Registro:</strong> {fmt(detalle.poderFecha)}
                  </span>
                )}
                {detalle.poderChequeNumero && (
                  <span>
                    <strong>N° Cheque / Ref:</strong>{' '}
                    <span className="font-mono font-bold">{detalle.poderChequeNumero}</span>
                  </span>
                )}
                {detalle.poderMotivo && (
                  <span>
                    <strong>Motivo / Trazabilidad:</strong> {detalle.poderMotivo}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </section>
      {/* END: MemberAndFileHeaderCard */}

      {/* BEGIN: StepperWorkflowSection (Abarca el 100% de ancho) */}
      <section className="w-full bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5" data-purpose="workflow-stepper">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Flujo del Expediente</h2>
          {detalle.estado === 'PAGADA' ? (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Proceso Completado
            </span>
          ) : detalle.estado === 'RECHAZADA' ? (
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Expediente Rechazado
            </span>
          ) : horasRestantes !== null && horasLimite > 0 ? (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
              horasRestantes <= 0 ? 'text-rose-700 bg-rose-50 border-rose-200' :
              horasRestantes <= 12 ? 'text-amber-700 bg-amber-50 border-amber-200' :
              'text-emerald-700 bg-emerald-50 border-emerald-200'
            }`}>
              {horasRestantes <= 0 ? `Vencido hace ${Math.abs(Math.floor(horasRestantes))}h` : `${Math.floor(horasRestantes)}h restantes`}
            </span>
          ) : (
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              En Evaluación
            </span>
          )}
        </div>

        {/* Tarjetas de pasos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {ESTADOS_FLUJO.map((estado, idx) => {
            const completado = idxActual >= 0 && idx < idxActual;
            const actual = estado === detalle.estado;
            const labelPaso = `Paso ${idx + 1}${actual ? ' (Actual)' : ''}`;
            const nombreVisible = slaConfig.find((c) => c.estado === estado)?.nombreVisible || estado.replace('_', ' ');

            return (
              <div
                key={estado}
                className={`flex items-center p-2.5 sm:p-3 rounded-xl border transition-colors ${
                  actual && estado === 'PAGADA'
                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                    : actual
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-[#3258CA]/15'
                    : completado
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-slate-50/60 border-slate-200/80'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    completado || (actual && estado === 'PAGADA')
                      ? 'bg-emerald-500 text-white'
                      : actual
                      ? 'bg-[#3258CA] text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {completado || (actual && estado === 'PAGADA') ? '✓' : idx + 1}
                </div>
                <div className="ml-2.5 sm:ml-3 min-w-0 flex-1">
                  <p className={`text-[10px] sm:text-xs uppercase font-semibold truncate ${actual ? (estado === 'PAGADA' ? 'text-emerald-700' : 'text-[#3258CA]') : 'text-slate-400'}`}>
                    {labelPaso}
                  </p>
                  <p className={`text-xs sm:text-sm font-semibold truncate ${actual ? 'text-slate-900 font-bold' : 'text-slate-800'}`}>
                    {nombreVisible}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {/* END: StepperWorkflowSection */}

      {/* BEGIN: PaymentSummaryCard / Distribución y Documentación por Beneficiario */}
      <section className="w-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" data-purpose="payment-banner">
        {/* Header Banner */}
        <div className="p-4 sm:p-5 border-b border-emerald-200/80 bg-emerald-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start sm:items-center space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Distribución y Documentación por Beneficiario</h3>
                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  {MODALIDAD_LABELS[detalle.modalidadBeneficio || ''] || 'Monto Compartido'} ({reparto ? `${reparto.porcentajeAsignado}% Asignado` : '100% Asignado'})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Cada beneficiario debe contar con sus documentos de identidad y sustento adjuntos individualmente para habilitar el desembolso.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {puedeOperar && (
              <button
                onClick={() => setCartaPoderOpen(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 transition-colors"
                type="button"
                title="Registrar cuando el beneficiario (ej. Hijo) o el colegiado otorga Carta Poder a otra persona para cobrar el cheque"
              >
                📋 {detalle.conCartaPoder ? 'Gestionar Carta Poder' : 'Registrar Carta Poder (Cobro)'}
              </button>
            )}
            {detalle.estado !== 'PAGADA' && puedeOperar && (
              <button
                onClick={() => setCompletarOpen(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-[#3258CA] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                type="button"
              >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                + Agregar Beneficiario
              </button>
            )}
            {detalle.estado === 'PAGADA' && isAdmin && (
              <button
                onClick={() => setCompletarOpen(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-2xs transition-colors"
                type="button"
              >
                Corregir declaraciones
              </button>
            )}
            {detalle.estado === 'APROBADA' && puedeOperar && (
              <button
                onClick={() => (reparto?.listoParaPago ? setPagoOpen(true) : setCompletarOpen(true))}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                type="button"
              >
                Registrar pago
              </button>
            )}
          </div>
        </div>

        {/* Tarjetas de Beneficiarios */}
        <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 bg-slate-50/50">
          {detalle.beneficiariosVinculados.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6 sm:p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-[#3258CA] flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-slate-900">Sin beneficiarios vinculados</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Este expediente aún no cuenta con beneficiarios asignados para el reparto del beneficio.
              </p>
              {puedeOperar && (
                <button
                  onClick={() => setCompletarOpen(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-[#3258CA] rounded-lg hover:bg-[#2846a3] transition-colors"
                >
                  + Asignar Beneficiarios
                </button>
              )}
            </div>
          ) : (
            detalle.beneficiariosVinculados.map((b, index) => {
              const dep = depositos.find((d) => d.beneficiarioId === b.id || (d.dniBeneficiario && d.dniBeneficiario === b.dni));
              const montoBenef = dep?.monto != null ? dep.monto : (detalle.monto * (b.porcentajeAsignado || 0)) / 100;
              const tieneDJ = Boolean(b.tieneDeclaracionJurada);
              const tieneVoucher = Boolean(b.tieneOrdenPago);
              const docsCompletos = tieneDJ && tieneVoucher;
              const docsCount = (tieneDJ ? 1 : 0) + (tieneVoucher ? 1 : 0);

              return (
                <div
                  key={b.id || index}
                  className={`bg-white rounded-xl border ${docsCompletos ? 'border-slate-200' : 'border-amber-300'} shadow-2xs p-3.5 sm:p-5 transition-colors`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-100">
                    <div className="flex items-start sm:items-center space-x-3 sm:space-x-3.5 min-w-0">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 border ${
                        docsCompletos
                          ? 'bg-blue-50 border-blue-100 text-[#3258CA]'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight break-words">{b.nombre}</h4>
                          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded font-mono">
                            DNI: {b.dni || '—'}
                          </span>
                          <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold border ${
                            docsCompletos
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-amber-100 text-amber-900 border-amber-200'
                          }`}>
                            {b.porcentajeAsignado}% Asignado
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span>Banco: <strong className="text-slate-700 font-semibold">{dep?.banco || detalle.banco || 'CMAC'}</strong></span>
                          {(dep?.numeroCuenta || detalle.numeroCuenta) && (
                            <>
                              <span>•</span>
                              <span>Cheque/Cta: <strong className="text-slate-700 font-mono font-semibold">{dep?.numeroCuenta || detalle.numeroCuenta}</strong></span>
                            </>
                          )}
                          <span>•</span>
                          <span>F. Pago: <strong className="text-slate-700 font-semibold">{fmt(dep?.fechaPago || detalle.fechaPago || detalle.fechaSolicitud)}</strong></span>
                          <span>•</span>
                          <span>Parentesco: <strong className="text-slate-700 font-semibold">{b.parentesco}</strong></span>
                          {dep && puedeOperar && (
                            <button
                              type="button"
                              onClick={() => setDepositoEdit(dep)}
                              className="text-[#3258CA] hover:underline font-semibold ml-1"
                            >
                              ✎ Editar cobro/cheque
                            </button>
                          )}
                        </p>
                        {(dep?.conCartaPoder || (detalle.conCartaPoder && (!detalle.poderOtorganteDni || detalle.poderOtorganteDni === b.dni))) &&
                          (dep?.apoderadoNombre || detalle.apoderadoNombre) && (
                            <div className="mt-2 inline-flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900">
                              <span className="font-bold">
                                📋 Cobro por Carta Poder:
                              </span>
                              <span>
                                <strong>{b.nombre}</strong> ({b.parentesco}) otorgó poder a{' '}
                                <strong>{dep?.apoderadoNombre || detalle.apoderadoNombre}</strong>
                                {(dep?.apoderadoDni || detalle.apoderadoDni) ? ` (DNI: ${dep?.apoderadoDni || detalle.apoderadoDni})` : ''}
                                {(dep?.apoderadoParentesco || detalle.apoderadoParentesco) ? ` · ${dep?.apoderadoParentesco || detalle.apoderadoParentesco}` : ''}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 lg:border-l lg:border-slate-200 lg:pl-4">
                      <div className="text-left lg:text-right">
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Monto a Liquidar</span>
                        <span className="text-base sm:text-lg font-bold text-slate-900">{fmtMonto(montoBenef)}</span>
                      </div>
                      <div>
                        {docsCompletos ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            2 de 2 docs adjuntados
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                            <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {docsCount === 0 ? '2 docs pendientes' : '1 doc pendiente'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Documentos Requeridos por Beneficiario */}
                  <div className="mt-3.5 sm:mt-4 pt-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
                      <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 truncate">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                        <span className="truncate">Docs: {b.nombre}</span>
                      </span>
                      {puedeOperar && (
                        <button
                          onClick={() => setCompletarOpen(true)}
                          className="inline-flex items-center text-xs font-semibold text-[#3258CA] hover:text-[#2846a3] bg-blue-50 hover:bg-blue-100 px-2 sm:px-2.5 py-1 rounded-md transition-colors self-start sm:self-auto"
                          type="button"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                          Gestionar Documentos
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                      {/* Doc 1: DNI / Identidad */}
                      <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-slate-50 border border-slate-200 gap-2">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-7 h-7 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                            </svg>
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="text-xs font-semibold text-slate-800 truncate">DNI / Identidad</p>
                            <p className="text-[11px] text-emerald-700 font-medium truncate">DNI {b.dni || 'Sin DNI'}</p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {b.tieneDeclaracionJurada ? (
                            <button
                              onClick={() => verDeclaracionBeneficiario(b.id, b.nombre, b.dni)}
                              className="text-xs font-semibold text-[#3258CA] hover:underline"
                              type="button"
                            >
                              Ver PDF
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Validado</span>
                          )}
                        </div>
                      </div>

                      {/* Doc 2: Declaración Jurada */}
                      {tieneDJ ? (
                        <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-slate-50 border border-slate-200 gap-2">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-7 h-7 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </div>
                            <div className="min-w-0 truncate">
                              <p className="text-xs font-semibold text-slate-800 truncate">Declaración Jurada</p>
                              <p className="text-[11px] text-emerald-700 font-medium truncate">dj_{b.dni || b.id}_firmada.pdf</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => verDeclaracionBeneficiario(b.id, b.nombre, b.dni)}
                              className="text-xs font-semibold text-[#3258CA] hover:underline"
                              type="button"
                            >
                              Ver PDF
                            </button>
                            {isAdmin && (
                              <>
                                <span className="text-slate-300">|</span>
                                <button onClick={() => setCompletarOpen(true)} className="text-xs text-slate-500 hover:text-slate-700" type="button">
                                  Editar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-amber-50/70 border border-amber-300 gap-2">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="w-7 h-7 rounded bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                              </svg>
                            </div>
                            <div className="min-w-0 truncate">
                              <p className="text-xs font-semibold text-slate-800 truncate">Declaración Jurada</p>
                              <p className="text-[11px] text-amber-800 font-medium truncate">Falta adjuntar sustento</p>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <button
                              onClick={() => setCompletarOpen(true)}
                              className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-white bg-[#3258CA] hover:bg-[#2846a3] rounded transition-colors shadow-2xs"
                              type="button"
                            >
                              + Cargar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
      {/* END: PaymentSummaryCard */}

      {/* BEGIN: QuickActionsPanel (Abarca el 100% de ancho) */}
      {puedeRegistrarHistorico && tiposFaltantes.length > 0 && (
        <section className="w-full bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs" data-purpose="quick-actions">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Registrar otros beneficios para este colegiado:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tiposFaltantes.map((nombre) => (
              <button
                key={nombre}
                onClick={() => router.push(`/dashboard/fam/registrar-historico?colegiadoId=${detalle.colegiadoId}&tipoPre=${encodeURIComponent(nombre)}`)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                type="button"
              >
                <span className="mr-1 text-[#3258CA] font-bold">+</span> {nombre}
              </button>
            ))}
            <button
              onClick={() => router.push(`/dashboard/fam/registrar-historico?colegiadoId=${detalle.colegiadoId}`)}
              className="text-xs font-semibold text-[#3258CA] hover:text-[#2846a3] ml-1 hover:underline"
              type="button"
            >
              Ver todos →
            </button>
          </div>
        </section>
      )}
      {/* END: QuickActionsPanel */}

      {/* Alerta de fallecimiento previo si aplica */}
      {tieneFallecimiento && detalle.tipoBeneficio?.codigo !== 'FALLECIMIENTO' && (
        <div className="w-full bg-rose-50 border-2 border-rose-200 rounded-xl p-4 sm:p-6 text-center shadow-xs">
          <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2.5 sm:mb-3 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-rose-900 uppercase tracking-wide">Beneficio por Fallecimiento ya registrado</h3>
          <p className="text-xs text-rose-700 mt-1 max-w-xl mx-auto">
            Este colegiado ya cuenta con un beneficio por Fallecimiento registrado. No se pueden registrar nuevos beneficios posteriores.
          </p>
        </div>
      )}

      {/* BEGIN: TabsAndConceptTableSection (Abarca el 100% de ancho) */}
      <section className="w-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" data-purpose="detailed-tabs">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 bg-slate-50/50 px-4 sm:px-6 pt-2 sm:pt-3">
          <nav aria-label="Pestañas de expediente" className="flex space-x-3 sm:space-x-6 -mb-px overflow-x-auto whitespace-nowrap py-0.5">
            <button
              onClick={() => setActiveTab('montos')}
              className={`py-2.5 sm:py-3 px-1 text-xs sm:text-sm font-bold flex items-center transition-colors shrink-0 ${
                activeTab === 'montos' ? 'border-b-2 border-[#3258CA] text-[#3258CA]' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
              type="button"
            >
              Montos
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`py-2.5 sm:py-3 px-1 text-xs sm:text-sm font-medium flex items-center transition-colors shrink-0 ${
                activeTab === 'docs' ? 'border-b-2 border-[#3258CA] text-[#3258CA] font-bold' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
              type="button"
            >
              Documentos
            </button>
            <button
              onClick={() => setActiveTab('benef')}
              className={`py-2.5 sm:py-3 px-1 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'benef' ? 'border-b-2 border-[#3258CA] text-[#3258CA] font-bold' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
              type="button"
            >
              Beneficiarios
              <span className="bg-blue-50 text-[#3258CA] border border-blue-100 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold">
                {detalle.beneficiariosVinculados.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`py-2.5 sm:py-3 px-1 text-xs sm:text-sm font-medium flex items-center transition-colors shrink-0 ${
                activeTab === 'historial' ? 'border-b-2 border-[#3258CA] text-[#3258CA] font-bold' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
              type="button"
            >
              Historial
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`py-2.5 sm:py-3 px-1 text-xs sm:text-sm font-medium flex items-center transition-colors shrink-0 ${
                  activeTab === 'admin' ? 'border-b-2 border-[#3258CA] text-[#3258CA] font-bold' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
                type="button"
              >
                Admin
              </button>
            )}
          </nav>
        </div>

        {/* CONTENIDO DE PESTAÑAS */}
        <div className="p-4 sm:p-5 lg:p-6">
          {/* TAB: MONTOS */}
          {activeTab === 'montos' && (
            <div>
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[620px]">
                  <thead>
                    <tr className="text-[10px] sm:text-xs uppercase text-slate-400 font-bold border-b border-slate-200 tracking-wider">
                      <th className="pb-3 pr-4" scope="col">Concepto</th>
                      <th className="pb-3 px-3 text-right" scope="col">Base</th>
                      <th className="pb-3 px-3 text-center" scope="col">Descuento</th>
                      <th className="pb-3 px-3 text-right" scope="col">Recibido Neto</th>
                      <th className="pb-3 px-3 text-right" scope="col">Por Recibir</th>
                      <th className="pb-3 pl-4" scope="col">Detalle / Docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {filasMontos.map((fila) => {
                      const esActualFila = fila.esActual;
                      const estaRecibido = fila.recibido >= fila.baseNeto && fila.baseNeto > 0;
                      return (
                        <tr
                          key={fila.codigo}
                          className={`${esActualFila ? 'bg-blue-50/20 hover:bg-blue-50/40' : 'hover:bg-slate-50/60'} transition-colors`}
                        >
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center space-x-2">
                              <span
                                onClick={() => { if (fila.historial.length > 0) irADocumentacion(fila.esActual ? id : fila.historial[fila.historial.length - 1].id); }}
                                className={`font-bold text-slate-900 ${fila.historial.length > 0 ? 'cursor-pointer hover:text-[#3258CA]' : ''}`}
                              >
                                {fila.label}
                              </span>
                              {esActualFila && (
                                <span className="bg-[#3258CA] text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                                  ACTUAL
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-semibold text-slate-800">
                            {fila.base > 0 ? fmtMonto(fila.base) : '—'}
                          </td>
                          <td className="py-3.5 px-3 text-center text-slate-400 font-normal">
                            {fila.descuento > 0 ? <span className="font-semibold text-red-600">- {fmtMonto(fila.descuento)}</span> : '—'}
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-emerald-600">
                            {fila.codigo === 'COVID_19' && fila.recibido === 0 ? (
                              <span className="text-slate-400 font-normal italic text-xs">No registrado</span>
                            ) : fila.recibido > 0 ? (
                              <span className={estaRecibido ? 'text-emerald-600' : 'text-amber-600'}>{fmtMonto(fila.recibido)}</span>
                            ) : (
                              <span className="text-slate-400 font-normal">S/ 0.00</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right font-medium text-slate-500">
                            {fila.codigo === 'COVID_19' && fila.recibido === 0 ? (
                              <span className="text-slate-400 font-normal italic text-xs">Sin registro</span>
                            ) : fila.porRecibir > 0 ? (
                              <span className="font-bold text-amber-600">{fmtMonto(fila.porRecibir)}</span>
                            ) : (
                              <span>S/ 0.00</span>
                            )}
                          </td>
                          <td className="py-3.5 pl-4 text-xs">
                            {fila.historial.length > 0 ? (
                              <div className="flex items-center space-x-2 text-slate-600 flex-wrap gap-y-1">
                                <span className="bg-slate-100 font-semibold px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] text-slate-700">
                                  Exp. {fila.historial[0]?.expediente || detalle.expedienteNumero || 'S/N'}
                                </span>
                                {esActualFila && detalle.beneficiariosVinculados.length > 0 && (
                                  <span className="text-[11px] sm:text-xs font-medium text-slate-700">
                                    {detalle.beneficiariosVinculados.length} Beneficiarios
                                  </span>
                                )}
                                <button
                                  onClick={() => irADocumentacion(fila.esActual ? id : fila.historial[0]?.id)}
                                  className="text-[#3258CA] hover:text-[#2846a3] font-semibold inline-flex items-center ml-1"
                                  type="button"
                                >
                                  <svg className="w-3.5 h-3.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                  </svg>
                                  Docs
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-[11px] sm:text-xs text-slate-400 italic">
                * Haga clic en un concepto o en el N° de expediente para ver los documentos adjuntos correspondientes.
              </p>

              {/* 3 Tarjetas Métricas de Resumen */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-slate-100">
                <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
                  <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Base Total</span>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900">
                    {fmtMonto(baseTotalMontos)}
                  </div>
                </div>
                <div className="bg-amber-50/70 rounded-xl p-3.5 sm:p-4 border border-amber-300">
                  <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-800 block mb-1">Recibido Neto Total</span>
                  <div className="text-xl sm:text-2xl font-black text-amber-900">
                    {fmtMonto(recibidoNetoMontos)}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
                  <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">Por Recibir Total</span>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900">
                    {fmtMonto(porRecibirMontos)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DOCUMENTOS */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              <input
                ref={docInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => {
                  subirDocumento(e.target.files?.[0] || null);
                  if (e.target) e.target.value = '';
                }}
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className={`rounded-lg px-3.5 py-2 border flex flex-col gap-1 ${detalle.documentacionCompleta ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <p className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                    {detalle.documentacionCompleta ? '✓ Documentación del expediente completa' : '⚠️ Documentación del expediente incompleta / observada'}
                  </p>
                  {detalle.documentacionObservacion && (
                    <p className="text-xs text-amber-900 bg-amber-100/70 rounded px-2 py-1 font-medium">
                      <strong>Observación / Justificación:</strong> {detalle.documentacionObservacion}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => verExpedienteCompletoPdf(id)}
                  disabled={uniendoDocs}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#3258CA] hover:bg-[#2846a3] disabled:opacity-50 rounded-lg shadow-xs transition-colors shrink-0 self-start sm:self-auto"
                >
                  {uniendoDocs ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Consolidando todos los documentos...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Ver todos los documentos en un solo PDF
                    </>
                  )}
                </button>
              </div>

              {!docsCargados ? (
                <div className="py-12 text-center text-slate-400 text-sm">Cargando documentos…</div>
              ) : gruposDocs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                  No hay documentos subidos en los beneficios de este colegiado.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Subpestañas por beneficio */}
                  <div className="flex border-b border-slate-200 overflow-x-auto whitespace-nowrap py-0.5">
                    {gruposDocs.map((g) => (
                      <button
                        key={g.tipo}
                        onClick={() => setDocsGrupoSel(g.tipo)}
                        className={`px-3 sm:px-4 py-2 text-xs font-semibold border-b-2 transition-colors shrink-0 ${
                          grupoDocsSel?.tipo === g.tipo ? 'border-[#3258CA] text-[#3258CA]' : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                        type="button"
                      >
                        {g.nombre}
                        <span className="ml-1.5 inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                          {g.registros.length}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Documentos del beneficio seleccionado */}
                  {grupoDocsSel && grupoDocsSel.registros.map((reg) => (
                    <div key={reg.id} className="rounded-xl p-3.5 sm:p-4 border border-slate-200 bg-slate-50/50">
                      {grupoDocsSel.registros.length > 1 && (
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded bg-[#3258CA] text-white">
                            {reg.expediente || 'S/N'}
                          </span>
                          <span className="text-xs text-slate-500">{fmt(reg.fecha)}</span>
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded border ${ESTADO_BADGE_STYLE[reg.estado] || 'bg-slate-100'}`}>
                            {reg.estado}
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                        {Object.entries(DOCS_LABELS)
                          .filter(([campo]) => {
                            if (campo !== 'ordenPago' && campo !== 'declaracionJurada') return true;
                            const benefCount = reg.id === id
                              ? (detalle?.beneficiariosVinculados?.length || 0)
                              : (docsOtros[reg.id]?.benefCount || 0);
                            return benefCount <= 1;
                          })
                          .map(([campo, label]) => {
                            const disponible = Boolean(docsDeExpediente(reg.id)[campo]);
                            const loadKey = `${reg.id}:${campo}`;
                            return (
                              <div key={campo} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 bg-white rounded-lg border border-slate-200 gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${disponible ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  <span className="text-xs font-semibold text-slate-800 truncate">{label}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                  {disponible && (
                                    <button
                                      onClick={() => abrirPdf(reg.id, campo)}
                                      disabled={pdfLoadingKey === loadKey}
                                      className="text-xs font-semibold text-[#3258CA] hover:underline disabled:opacity-50"
                                      type="button"
                                    >
                                      {pdfLoadingKey === loadKey ? 'Abriendo...' : 'Ver PDF'}
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button
                                      onClick={() => pedirDocumento(reg.id, campo)}
                                      disabled={subiendoDoc === loadKey}
                                      className={`text-xs font-medium hover:underline disabled:opacity-50 ${disponible ? 'text-slate-500' : 'text-[#3258CA]'}`}
                                      type="button"
                                    >
                                      {subiendoDoc === loadKey ? 'Subiendo...' : disponible ? 'Reemplazar' : 'Subir PDF o Imagen'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: BENEFICIARIOS */}
          {activeTab === 'benef' && (
            <div className="space-y-4">
              {puedeOperar && (isAdmin || detalle.estado !== 'PAGADA') && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setCompletarOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#3258CA] rounded-lg hover:bg-[#2846a3] transition-colors"
                    type="button"
                  >
                    + Agregar / Editar Beneficiarios
                  </button>
                </div>
              )}
              {detalle.beneficiariosVinculados.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full min-w-[640px] text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-xs font-bold uppercase text-slate-500">
                        <th className="px-3 sm:px-4 py-2.5 text-left">Nombre</th>
                        <th className="px-3 sm:px-4 py-2.5 text-left">DNI</th>
                        <th className="px-3 sm:px-4 py-2.5 text-left">Parentesco</th>
                        <th className="px-3 sm:px-4 py-2.5 text-right">% Asignado</th>
                        <th className="px-3 sm:px-4 py-2.5 text-left">Declaración Jurada</th>
                        <th className="px-3 sm:px-4 py-2.5 text-left">Orden de Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detalle.beneficiariosVinculados.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="px-3 sm:px-4 py-3 font-semibold text-slate-900">{b.nombre}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-500 font-mono text-xs">{b.dni || '—'}</td>
                          <td className="px-3 sm:px-4 py-3 text-slate-600">{b.parentesco}</td>
                          <td className="px-3 sm:px-4 py-3 text-right font-bold text-slate-900">{b.porcentajeAsignado}%</td>
                          <td className="px-3 sm:px-4 py-3">
                            {b.tieneDeclaracionJurada ? (
                              <button
                                onClick={() => verDeclaracionBeneficiario(b.id, b.nombre, b.dni)}
                                className="text-xs font-semibold text-[#3258CA] hover:underline"
                                type="button"
                              >
                                Ver PDF
                              </button>
                            ) : (
                              <span className="text-xs font-medium text-amber-600">Pendiente</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            {b.tieneOrdenPago ? (
                              <button
                                onClick={() => verOrdenPagoBeneficiario(b.id, b.nombre)}
                                className="text-xs font-semibold text-[#3258CA] hover:underline"
                                type="button"
                              >
                                Ver PDF
                              </button>
                            ) : (
                              <span className="text-xs font-medium text-amber-600">Pendiente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">No hay beneficiarios vinculados</p>
              )}
            </div>
          )}

          {/* TAB: HISTORIAL */}
          {activeTab === 'historial' && (
            <HistorialExpediente expedienteId={id} onUpdated={recargar} />
          )}

          {/* TAB: ADMIN */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Estado</label>
                  <select
                    value={formAdmin.estado}
                    onChange={(e) => setFormAdmin({ ...formAdmin, estado: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  >
                    <option value="PENDIENTE">PENDIENTE</option>
                    <option value="EN_REVISION">EN_REVISION</option>
                    <option value="APROBADA">APROBADA</option>
                    <option value="RECHAZADA">RECHAZADA</option>
                    <option value="PAGADA">PAGADA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Monto Asignado</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formAdmin.monto}
                    onChange={(e) => setFormAdmin({ ...formAdmin, monto: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">N° Expediente</label>
                  <input
                    type="text"
                    value={formAdmin.expedienteNumero}
                    onChange={(e) => setFormAdmin({ ...formAdmin, expedienteNumero: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Solicitud</label>
                  <input
                    type="date"
                    value={formAdmin.fechaSolicitud}
                    onChange={(e) => setFormAdmin({ ...formAdmin, fechaSolicitud: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={formAdmin.fechaPago}
                    onChange={(e) => setFormAdmin({ ...formAdmin, fechaPago: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Forma de Pago</label>
                  <select
                    value={formAdmin.formaPago}
                    onChange={(e) => setFormAdmin({ ...formAdmin, formaPago: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                    <option value="DEPOSITO">DEPÓSITO</option>
                    <option value="CHEQUE">CHEQUE</option>
                    <option value="EFECTIVO">EFECTIVO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Banco</label>
                  <input
                    type="text"
                    value={formAdmin.banco}
                    onChange={(e) => setFormAdmin({ ...formAdmin, banco: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">N.° Cuenta Bancaria donde se depositó</label>
                  <input
                    type="text"
                    value={formAdmin.numeroCuenta}
                    onChange={(e) => setFormAdmin({ ...formAdmin, numeroCuenta: e.target.value })}
                    placeholder="Ej. 0011-0123-0100012345"
                    className="w-full text-xs rounded-lg border-slate-300 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">CCI (Interbancario)</label>
                  <input
                    type="text"
                    value={formAdmin.cci}
                    onChange={(e) => setFormAdmin({ ...formAdmin, cci: e.target.value })}
                    placeholder="Ej. 002-011-000123456789-01"
                    className="w-full text-xs rounded-lg border-slate-300 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">N.° Carta</label>
                  <input
                    type="text"
                    value={formAdmin.cartaNumero}
                    onChange={(e) => setFormAdmin({ ...formAdmin, cartaNumero: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Carta</label>
                  <input
                    type="date"
                    value={formAdmin.cartaFecha}
                    onChange={(e) => setFormAdmin({ ...formAdmin, cartaFecha: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">N.° Memorándum</label>
                  <input
                    type="text"
                    value={formAdmin.memorandoNumero}
                    onChange={(e) => setFormAdmin({ ...formAdmin, memorandoNumero: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha de Memorándum</label>
                  <input
                    type="date"
                    value={formAdmin.memorandoFecha}
                    onChange={(e) => setFormAdmin({ ...formAdmin, memorandoFecha: e.target.value })}
                    className="w-full text-xs rounded-lg border-slate-300 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Observaciones</label>
                <textarea
                  rows={3}
                  value={formAdmin.observaciones}
                  onChange={(e) => setFormAdmin({ ...formAdmin, observaciones: e.target.value })}
                  className="w-full text-xs rounded-lg border-slate-300 p-2"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={eliminarExpediente}
                  className="px-4 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-center"
                  type="button"
                >
                  Eliminar Expediente
                </button>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={recargar}
                    className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-center"
                    type="button"
                  >
                    Restablecer
                  </button>
                  <button
                    onClick={guardarAdmin}
                    disabled={guardandoAdmin}
                    className="flex-1 sm:flex-initial px-5 py-2 text-xs font-semibold text-white bg-[#3258CA] rounded-lg hover:bg-[#2846a3] transition-colors disabled:opacity-50 text-center"
                    type="button"
                  >
                    {guardandoAdmin ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      {/* END: TabsAndConceptTableSection */}

      {/* MODALES */}
      {pdfViewer && (
        <PdfViewerModal base64={pdfViewer.base64} nombre={pdfViewer.nombre} onClose={() => setPdfViewer(null)} />
      )}

      {completarOpen && detalle && (
        <CompletarBeneficiariosModal
          isOpen={completarOpen}
          onClose={() => setCompletarOpen(false)}
          onSaved={recargar}
          expedienteId={id}
          colegiadoId={detalle.colegiadoId}
          pagada={detalle.estado === 'PAGADA'}
          isAdmin={isAdmin}
          modalidad={detalle.modalidadBeneficio}
          vinculados={detalle.beneficiariosVinculados}
        />
      )}

      {pagoOpen && detalle && (
        <PagoExpedienteModal
          isOpen={pagoOpen}
          onClose={() => setPagoOpen(false)}
          onSaved={recargar}
          expedienteId={id}
          monto={detalle.montoFinal ?? detalle.monto}
          fechaPagoSugerida={detalle.fechaPago || detalle.ordenPagoFecha}
          formaPagoSugerida={detalle.formaPago}
          bancoSugerido={detalle.banco}
          beneficiarios={detalle.beneficiariosVinculados}
          solicitanteNombre={detalle.solicitanteNombre}
          solicitanteDni={detalle.solicitanteDni}
          conCartaPoder={detalle.conCartaPoder}
          apoderadoNombre={detalle.apoderadoNombre}
          apoderadoDni={detalle.apoderadoDni}
          apoderadoParentesco={detalle.apoderadoParentesco}
          poderOtorganteDni={detalle.poderOtorganteDni}
          poderChequeNumero={detalle.poderChequeNumero}
          poderMotivo={detalle.poderMotivo}
        />
      )}

      {cartaPoderOpen && detalle && (
        <ModalCartaPoder
          isOpen={cartaPoderOpen}
          onClose={() => setCartaPoderOpen(false)}
          onSaved={recargar}
          expedienteId={id}
          expedienteNumero={detalle.expedienteNumero || undefined}
          colegiadoNombre={detalle.NOMBRE_COLEGIADO}
          colegiadoDni={detalle.DNI}
          beneficiarios={detalle.beneficiariosVinculados.map((b) => {
            const dep = (detalle.depositos || []).find(
              (d) => d.beneficiarioId === b.id || (d.dniBeneficiario && d.dniBeneficiario === b.dni),
            );
            return {
              id: b.id,
              nombre: b.nombre,
              dni: b.dni,
              parentesco: b.parentesco,
              depositoId: dep?.id,
            };
          })}
          formaPagoActual={detalle.formaPago}
          bancoActual={detalle.banco}
          conCartaPoderActual={detalle.conCartaPoder}
          poderOtorganteNombreActual={detalle.poderOtorganteNombre}
          poderOtorganteDniActual={detalle.poderOtorganteDni}
          poderOtorganteParentescoActual={detalle.poderOtorganteParentesco}
          apoderadoNombreActual={detalle.apoderadoNombre}
          apoderadoDniActual={detalle.apoderadoDni}
          apoderadoParentescoActual={detalle.apoderadoParentesco}
          poderFechaActual={detalle.poderFecha}
          poderMotivoActual={detalle.poderMotivo}
          poderChequeNumeroActual={detalle.poderChequeNumero}
          tieneCartaPoderDoc={Boolean(detalle.documentosDisponibles?.cartaPoder)}
        />
      )}

      {depositoEdit && (
        <EditarDepositoModal
          isOpen={Boolean(depositoEdit)}
          onClose={() => setDepositoEdit(null)}
          onSaved={recargar}
          expedienteId={id}
          deposito={depositoEdit}
        />
      )}

      {editHistorialId && (
        <EditarExpedienteModal
          expedienteId={editHistorialId}
          onClose={() => setEditHistorialId(null)}
          onSaved={() => {
            setEditHistorialId(null);
            recargar();
          }}
        />
      )}

      {regularizarOpen && detalle && (
        <ModalRegularizarSaldo
          isOpen={regularizarOpen}
          onClose={() => setRegularizarOpen(false)}
          onSuccess={recargar}
          expedienteId={id}
          expedienteNumero={detalle.expedienteNumero}
          colegiadoNombre={detalle.NOMBRE_COLEGIADO}
          montoTotalAsignado={Number(detalle.montoTotalAsignado ?? detalle.monto)}
          saldoPendiente={Number(detalle.saldoPendiente || 0)}
          montoMinimoNormativo={Number(detalle.montoMinimoNormativo || 3000)}
        />
      )}

      {detalle && (
        <EliminarExpedienteModal
          isOpen={eliminarAbierto}
          onClose={() => setEliminarAbierto(false)}
          expedienteId={id}
          expedienteNumero={detalle.expedienteNumero}
          estado={detalle.estado}
          onDeleted={() => router.push('/dashboard/fam/expedientes')}
        />
      )}
    </div>
  );
}
