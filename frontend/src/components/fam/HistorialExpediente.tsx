'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import PdfViewerModal from '@/components/common/PdfViewerModal';
import BeneficiariosDocumentacion from '@/components/fam/BeneficiariosDocumentacion';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

interface DocumentoHistorial {
  id: string;
  grupo: 'Expediente' | 'Beneficiarios' | 'Pagos';
  nombre: string;
  campo: string;
  tipo: 'expediente' | 'declaracionJurada' | 'ordenPago' | 'comprobante';
  cargado: boolean;
  fechaCarga: string | null;
  puedeSubir: boolean;
  beneficiarioId?: string;
  beneficiarioNombre?: string;
  depositoId?: string;
  dniDeclarante?: string | null;
  monto?: number;
  origen?: 'beneficiario' | 'expediente' | null;
}

interface TransicionHistorial {
  id: string;
  estadoAnterior: string | null;
  estadoNuevo: string;
  marcaTiempoExacta: string;
  fechaHoraFormateada: string;
  usuarioResponsable: string;
  usuarioId: string;
  observaciones: string | null;
  documentosAsociados: DocumentoHistorial[];
  accion: string;
}

interface EtapaHistorial {
  key: string;
  nombre: string;
  estado: 'completado' | 'actual' | 'pendiente';
  fecha: string | null;
  detalle: string;
  documentosAsociados?: DocumentoHistorial[];
}

interface ActividadHistorial {
  id: string;
  fecha: string | null;
  usuario: string;
  tipo: string;
  titulo: string;
  detalle: string;
}

interface BeneficiarioHistorial {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco: string | null;
  porcentaje: number;
  tieneDeclaracionJurada: boolean;
  declaracionJuradaDni: string | null;
  tieneOrdenPago: boolean;
}

interface HistorialData {
  expediente: {
    id: string;
    estado: string;
    tipoBeneficio: string;
    tipoBeneficioCodigo: string;
    monto: number;
    montoFinal: number | null;
    fechaSolicitud: string | null;
    fechaPago: string | null;
    expedienteNumero: string | null;
    documentacionCompleta: boolean;
    documentacionObservacion: string | null;
  };
  etapas: EtapaHistorial[];
  siguientePaso: {
    etapa: string;
    titulo: string;
    descripcion: string;
    accion: { tipo: string; etiqueta: string; documentoId: string } | null;
  };
  documentos: DocumentoHistorial[];
  beneficiarios: BeneficiarioHistorial[];
  resumen: {
    documentosCargados: number;
    documentosPendientes: number;
    beneficiarios: number;
    depositos: number;
  };
  actividad: ActividadHistorial[];
  transiciones?: TransicionHistorial[];
  permisos: { puedeSubirDocumentos: boolean };
}

interface Props {
  expedienteId: string;
  onUpdated?: () => void;
}

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  PAGADA: 'Pagada',
};

const ESTADO_DOT: Record<string, string> = {
  PENDIENTE: 'bg-warning',
  EN_REVISION: 'bg-primary',
  APROBADA: 'bg-success',
  RECHAZADA: 'bg-error',
  PAGADA: 'bg-success',
};

const GRUPOS: DocumentoHistorial['grupo'][] = ['Expediente', 'Beneficiarios', 'Pagos'];

const fmtMonto = (m: number) =>
  `S/ ${Number(m).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const fmtFecha = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

const fmtFechaHora = (v: string | null | undefined) =>
  v
    ? `${fmtFecha(v)} · ${new Date(v).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Sin fecha';

const leerArchivo = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(((e.target?.result as string) || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });

export default function HistorialExpediente({ expedienteId, onUpdated }: Props) {
  const [data, setData] = useState<HistorialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ base64: string; nombre: string } | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<DocumentoHistorial | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [dni, setDni] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: respuesta } = await api.get(`/fam-beneficios/${expedienteId}/historial`);
      setData(respuesta);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo cargar el historial del expediente.');
    } finally {
      setLoading(false);
    }
  }, [expedienteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const documentosPorGrupo = useMemo(() => {
    const mapa = new Map<string, DocumentoHistorial[]>();
    for (const grupo of GRUPOS) {
      const docs = (data?.documentos || []).filter((d) => d.grupo === grupo);
      if (docs.length) mapa.set(grupo, docs);
    }
    return mapa;
  }, [data]);

  const abrirSubida = (doc: DocumentoHistorial) => {
    setUploadTarget(doc);
    setArchivo(null);
    setDni(doc.dniDeclarante || '');
  };

  const cerrarSubida = () => {
    if (subiendo) return;
    setUploadTarget(null);
    setArchivo(null);
    setDni('');
  };

  const subirDocumento = async () => {
    if (!uploadTarget) return;
    if (!archivo) {
      showConfirmMessage('error', 'Archivo requerido', 'Selecciona un archivo PDF.');
      return;
    }
    if (archivo.type !== 'application/pdf') {
      showConfirmMessage('error', 'Formato inválido', 'Solo se permiten archivos PDF.');
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      showConfirmMessage('error', 'Archivo demasiado grande', 'El máximo permitido es 10 MB.');
      return;
    }
    if (uploadTarget.tipo === 'declaracionJurada' && !/^\d{8}$/.test(dni.trim())) {
      showConfirmMessage('error', 'DNI inválido', 'Ingresa el DNI del declarante (8 dígitos).');
      return;
    }

    setSubiendo(true);
    try {
      const contenido = await leerArchivo(archivo);
      const doc = uploadTarget;

      if (doc.tipo === 'expediente') {
        await api.put(`/fam-beneficios/${expedienteId}/historial/documento/${doc.campo}`, {
          contenido,
        });
      } else if (doc.tipo === 'declaracionJurada') {
        await api.put(
          `/fam-beneficios/${expedienteId}/historial/beneficiario/${doc.beneficiarioId}/documento/declaracionJurada`,
          { contenido, declaracionJuradaDni: dni.trim() },
        );
      } else if (doc.tipo === 'ordenPago') {
        await api.put(
          `/fam-beneficios/${expedienteId}/historial/beneficiario/${doc.beneficiarioId}/documento/ordenPago`,
          { contenido },
        );
      } else if (doc.tipo === 'comprobante') {
        await api.put(
          `/fam-beneficios/${expedienteId}/historial/deposito/${doc.depositoId}/comprobante`,
          { contenido },
        );
      }

      showConfirmMessage('success', 'Documento cargado', doc.nombre);
      setUploadTarget(null);
      setArchivo(null);
      setDni('');
      await cargar();
      onUpdated?.();
    } catch (err: any) {
      showConfirmMessage(
        'error',
        'No se pudo subir el documento',
        err?.response?.data?.message || 'Intenta nuevamente.',
      );
    } finally {
      setSubiendo(false);
    }
  };

  const urlDocumento = (doc: DocumentoHistorial) => {
    if (doc.tipo === 'expediente') return `/fam-beneficios/${expedienteId}/documento/${doc.campo}`;
    if (doc.tipo === 'declaracionJurada')
      return `/fam-beneficios/${expedienteId}/beneficiario/${doc.beneficiarioId}/declaracion`;
    if (doc.tipo === 'ordenPago')
      return `/fam-beneficios/${expedienteId}/beneficiario/${doc.beneficiarioId}/orden-pago`;
    return `/fam-beneficios/${expedienteId}/deposito/${doc.depositoId}/comprobante`;
  };

  const obtenerPdf = async (doc: DocumentoHistorial): Promise<string> => {
    const { data: respuesta } = await api.get(urlDocumento(doc));
    return respuesta.contenido as string;
  };

  const verDocumento = async (doc: DocumentoHistorial) => {
    setPdfLoadingId(doc.id);
    try {
      setPdfViewer({ base64: await obtenerPdf(doc), nombre: doc.nombre });
    } catch (err: any) {
      showConfirmMessage(
        'error',
        'No se pudo abrir el documento',
        err?.response?.data?.message || 'Intenta nuevamente.',
      );
    } finally {
      setPdfLoadingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-14 text-center">
        <p className="text-sm text-text-sec">Cargando historial...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm text-error">{error}</p>
        <button
          type="button"
          onClick={cargar}
          className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { expediente, etapas, siguientePaso, actividad, resumen, permisos } = data;
  const beneficiarios = data.beneficiarios || [];
  const accionDoc = siguientePaso.accion
    ? data.documentos.find((d) => d.id === siguientePaso.accion?.documentoId)
    : null;
  const monto = expediente.montoFinal ?? expediente.monto;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text-main">Estado del expediente</h3>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-main border border-border-main rounded-full px-2 py-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  ESTADO_DOT[expediente.estado] || 'bg-text-sec'
                }`}
              />
              {ESTADO_LABEL[expediente.estado] || expediente.estado}
            </span>
          </div>
          <p className="text-xs text-text-sec mt-1">
            {expediente.tipoBeneficio}
            {expediente.expedienteNumero ? ` · ${expediente.expedienteNumero}` : ''}
          </p>
        </div>
        <div className="text-left sm:text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-text-sec">
            {expediente.estado === 'PAGADA' ? 'Importe Recibido / Entregado' : 'Monto del beneficio'}
          </p>
          <p className={`text-base font-bold ${expediente.estado === 'PAGADA' ? 'text-success' : 'text-text-main'}`}>
            {fmtMonto(monto)}
          </p>
          {expediente.fechaPago && (
            <p className="text-[10px] text-text-sec mt-0.5">Pagado: {fmtFecha(expediente.fechaPago)}</p>
          )}
        </div>
      </div>

      <section className="border border-border-main rounded-xl p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 sm:gap-2">
          {etapas.map((etapa, index) => {
            const completado = etapa.estado === 'completado';
            const actual = etapa.estado === 'actual';
            return (
              <div key={etapa.key} className="flex sm:flex-col items-start sm:items-center gap-3 sm:gap-2 sm:text-center">
                <div
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${
                    completado
                      ? 'bg-success border-success text-white'
                      : actual
                        ? 'bg-white border-primary text-primary'
                        : 'bg-white border-border-main text-text-sec'
                  }`}
                >
                  {completado ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold ${
                      actual ? 'text-primary' : completado ? 'text-text-main' : 'text-text-sec'
                    }`}
                  >
                    {etapa.nombre}
                  </p>
                  {etapa.fecha && (
                    <p className="text-[10px] text-text-sec mt-0.5">{fmtFecha(etapa.fecha)}</p>
                  )}
                  <p className="text-[10px] text-text-sec mt-0.5 leading-snug sm:px-1">
                    {etapa.detalle}
                  </p>
                  {etapa.documentosAsociados && etapa.documentosAsociados.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 w-full text-left sm:items-center">
                      {etapa.documentosAsociados.map((doc) => (
                        <div
                          key={doc.id}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-50 border border-border-main"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              doc.cargado ? 'bg-success' : 'bg-warning'
                            }`}
                          />
                          <span className="truncate max-w-[90px]" title={doc.nombre}>
                            {doc.nombre}
                          </span>
                          {doc.cargado && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                verDocumento(doc);
                              }}
                              className="text-[#3258CA] font-medium hover:underline text-[9px] ml-0.5"
                              title="Ver documento en PDF"
                            >
                              PDF
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border border-border-main border-l-2 border-l-primary rounded-xl p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-sec">
          Siguiente paso
        </p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-text-main">{siguientePaso.titulo}</h4>
            <p className="text-xs text-text-sec mt-1 leading-relaxed">{siguientePaso.descripcion}</p>
          </div>
          {siguientePaso.accion && accionDoc && (
            <button
              type="button"
              onClick={() => abrirSubida(accionDoc)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-dark flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {siguientePaso.accion.etiqueta}
            </button>
          )}
        </div>
      </section>
      <BeneficiariosDocumentacion
        expedienteId={expedienteId}
        beneficiarios={beneficiarios}
        documentos={data.documentos}
        puedeSubir={permisos.puedeSubirDocumentos}
        obtenerPdf={obtenerPdf}
        onSubir={abrirSubida}
      />

      <section className="border border-border-main rounded-xl overflow-hidden">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-border-main">
          <div>
            <h4 className="text-sm font-semibold text-text-main">Documentos</h4>
            <p className="text-[11px] text-text-sec">
              Revisa lo que ya está cargado y completa lo pendiente.
            </p>
          </div>
          <p className="text-[11px] text-text-sec">
            <span className="text-success font-medium">{resumen.documentosCargados} cargados</span>
            {resumen.documentosPendientes > 0 && (
              <>
                {' · '}
                <span className="text-warning font-medium">
                  {resumen.documentosPendientes} pendientes
                </span>
              </>
            )}
          </p>
        </div>

        <div className="divide-y divide-border-main">
          {Array.from(documentosPorGrupo.entries()).map(([grupo, docs]) => (
            <div key={grupo} className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-sec mb-1">
                {grupo}
              </p>
              <div className="divide-y divide-border-main">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-8 h-8 rounded-lg border border-border-main text-text-sec flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6M9 17h4" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-main truncate" title={doc.nombre}>
                        {doc.nombre}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              doc.cargado ? 'bg-success' : 'bg-warning'
                            }`}
                          />
                          <span className={doc.cargado ? 'text-success' : 'text-warning'}>
                            {doc.cargado ? 'Cargado' : 'Pendiente'}
                          </span>
                        </span>
                        {doc.fechaCarga && (
                          <span className="text-text-sec">· {fmtFecha(doc.fechaCarga)}</span>
                        )}
                        {doc.origen === 'expediente' && (
                          <span className="text-text-sec">· Compartida del expediente</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {doc.cargado && (
                        <button
                          type="button"
                          onClick={() => verDocumento(doc)}
                          disabled={pdfLoadingId === doc.id}
                          className="px-2.5 py-1 text-[11px] font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 disabled:opacity-50"
                        >
                          {pdfLoadingId === doc.id ? 'Abriendo...' : 'Ver'}
                        </button>
                      )}
                      {permisos.puedeSubirDocumentos && doc.puedeSubir && (
                        <button
                          type="button"
                          onClick={() => abrirSubida(doc)}
                          className="px-2.5 py-1 text-[11px] font-medium text-text-main border border-border-main rounded-lg hover:bg-bg-layout"
                        >
                          {doc.cargado ? 'Reemplazar' : 'Subir'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Transiciones de Estado y Trazabilidad */}
      <section className="border border-border-main rounded-xl overflow-hidden bg-white">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-border-main bg-slate-50/70">
          <div>
            <h4 className="text-sm font-semibold text-text-main flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Transiciones de Estado y Trazabilidad
            </h4>
            <p className="text-[11px] text-text-sec">
              Detalle cronológico de cambios de estado, marca de tiempo exacta, responsable y documentos asociados.
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {(data.transiciones || []).length} {((data.transiciones || []).length === 1) ? 'transición' : 'transiciones'}
          </span>
        </div>

        <div className="p-4">
          {(!data.transiciones || data.transiciones.length === 0) ? (
            <p className="text-xs text-text-sec text-center py-4">
              Sin transiciones de estado registradas en auditoría.
            </p>
          ) : (
            <div className="space-y-4">
              {data.transiciones.map((t, idx) => {
                const anteriorLabel = t.estadoAnterior ? (ESTADO_LABEL[t.estadoAnterior] || t.estadoAnterior) : 'Registro Inicial';
                const nuevoLabel = ESTADO_LABEL[t.estadoNuevo] || t.estadoNuevo;
                return (
                  <div
                    key={t.id || idx}
                    className="p-3.5 border border-border-main rounded-lg bg-white hover:bg-slate-50/50 transition-colors space-y-2.5"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      {/* Transición de estados con badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {anteriorLabel}
                        </span>
                        <svg className="w-4 h-4 text-text-sec flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ESTADO_DOT[t.estadoNuevo] || 'bg-primary'
                            }`}
                          />
                          {nuevoLabel}
                        </span>
                      </div>

                      {/* Marca de tiempo exacta y responsable */}
                      <div className="flex items-center gap-3 text-right text-[11px] text-text-sec flex-wrap">
                        <span className="inline-flex items-center gap-1 font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-border-main" title={`Timestamp ISO: ${t.marcaTiempoExacta}`}>
                          <svg className="w-3.5 h-3.5 text-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {t.fechaHoraFormateada || t.marcaTiempoExacta}
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                          <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {t.usuarioResponsable}
                        </span>
                      </div>
                    </div>

                    {/* Observaciones registradas */}
                    {t.observaciones ? (
                      <div className="p-2.5 rounded-md bg-amber-50/60 border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
                        <span className="font-semibold text-amber-800">Observaciones registradas: </span>
                        {t.observaciones}
                      </div>
                    ) : (
                      <p className="text-[11px] text-text-sec italic">
                        Sin observaciones registradas en este cambio de estado.
                      </p>
                    )}

                    {/* Documentos asociados en esta transición/etapa */}
                    {t.documentosAsociados && t.documentosAsociados.length > 0 && (
                      <div className="pt-2 border-t border-border-main/60">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-sec mb-1.5">
                          Documentos asociados a esta etapa:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {t.documentosAsociados.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-border-main text-xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    doc.cargado ? 'bg-success' : 'bg-warning'
                                  }`}
                                />
                                <span className="truncate text-text-main text-[11px] font-medium" title={doc.nombre}>
                                  {doc.nombre}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span
                                  className={`text-[10px] font-medium ${
                                    doc.cargado ? 'text-success' : 'text-warning'
                                  }`}
                                >
                                  {doc.cargado ? 'Cargado' : 'Pendiente'}
                                </span>
                                {doc.cargado && (
                                  <button
                                    type="button"
                                    onClick={() => verDocumento(doc)}
                                    disabled={pdfLoadingId === doc.id}
                                    className="px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/30 rounded hover:bg-primary/5 disabled:opacity-50"
                                  >
                                    {pdfLoadingId === doc.id ? 'Abriendo...' : 'Ver PDF'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="border border-border-main rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-main">
          <h4 className="text-sm font-semibold text-text-main">Actividad</h4>
          <p className="text-[11px] text-text-sec">Movimientos registrados en este expediente.</p>
        </div>
        <div className="p-4">
          {actividad.length === 0 ? (
            <p className="text-xs text-text-sec text-center py-4">Sin movimientos registrados.</p>
          ) : (
            <ol className="relative border-l border-border-main ml-2">
              {actividad.map((item) => (
                <li key={item.id} className="relative ml-5 pb-4 last:pb-0">
                  <span
                    className={`absolute -left-[23px] top-1.5 w-2 h-2 rounded-full border-2 border-white ${
                      item.tipo === 'pago'
                        ? 'bg-success'
                        : item.tipo === 'documento'
                          ? 'bg-primary'
                          : 'bg-text-sec'
                    }`}
                  />
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                    <p className="text-xs font-medium text-text-main">{item.titulo}</p>
                    <p className="text-[10px] text-text-sec flex-shrink-0">{fmtFechaHora(item.fecha)}</p>
                  </div>
                  {item.detalle && <p className="text-[11px] text-text-sec mt-0.5">{item.detalle}</p>}
                  <p className="text-[10px] text-text-sec mt-0.5">{item.usuario}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <Modal
        isOpen={Boolean(uploadTarget)}
        onClose={cerrarSubida}
        title={uploadTarget?.cargado ? 'Reemplazar documento' : 'Subir documento'}
        onConfirm={subirDocumento}
        confirmText="Subir documento"
        loading={subiendo}
      >
        {uploadTarget && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-text-main">{uploadTarget.nombre}</p>
              <p className="text-[11px] text-text-sec mt-0.5">Archivo PDF, máximo 10 MB.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-main mb-1.5">
                Archivo PDF
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                className="block w-full text-xs text-text-sec border border-border-main rounded-lg p-2 file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {archivo && (
                <p className="text-[11px] text-text-sec mt-1">
                  {archivo.name} · {(archivo.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>

            {uploadTarget.tipo === 'declaracionJurada' && (
              <div>
                <label className="block text-xs font-medium text-text-main mb-1.5">
                  DNI del declarante
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                  placeholder="8 dígitos"
                  className="w-full px-3 py-2 text-sm border border-border-main rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {pdfViewer && (
        <PdfViewerModal
          base64={pdfViewer.base64}
          nombre={pdfViewer.nombre}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  );
}