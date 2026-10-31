'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import PdfViewerModal from '@/components/common/PdfViewerModal';
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

interface EtapaHistorial {
  key: string;
  nombre: string;
  estado: 'completado' | 'actual' | 'pendiente';
  fecha: string | null;
  detalle: string;
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

  const verDocumento = async (doc: DocumentoHistorial) => {
    setPdfLoadingId(doc.id);
    try {
      let url = '';
      if (doc.tipo === 'expediente') {
        url = `/fam-beneficios/${expedienteId}/documento/${doc.campo}`;
      } else if (doc.tipo === 'declaracionJurada') {
        url = `/fam-beneficios/${expedienteId}/beneficiario/${doc.beneficiarioId}/declaracion`;
      } else if (doc.tipo === 'ordenPago') {
        url = `/fam-beneficios/${expedienteId}/beneficiario/${doc.beneficiarioId}/orden-pago`;
      } else if (doc.tipo === 'comprobante') {
        url = `/fam-beneficios/${expedienteId}/deposito/${doc.depositoId}/comprobante`;
      }
      const { data: respuesta } = await api.get(url);
      setPdfViewer({ base64: respuesta.contenido, nombre: doc.nombre });
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
          <p className="text-[10px] uppercase tracking-wider text-text-sec">Monto del beneficio</p>
          <p className="text-base font-semibold text-text-main">{fmtMonto(monto)}</p>
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

      <section className="border border-border-main rounded-xl overflow-hidden">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-border-main">
          <div>
            <h4 className="text-sm font-semibold text-text-main">Beneficiarios</h4>
            <p className="text-[11px] text-text-sec">
              Personas vinculadas y reparto asignado en este expediente.
            </p>
          </div>
          <p className="text-[11px] text-text-main font-medium">
            {`${beneficiarios.length} ${
              beneficiarios.length === 1 ? 'beneficiario' : 'beneficiarios'
            }`}
          </p>
        </div>
        {beneficiarios.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-text-sec">
            Sin beneficiarios vinculados.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
            {beneficiarios.map((b) => (
              <div key={b.id} className="border border-border-main rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main truncate">{b.nombre}</p>
                    <p className="text-[11px] text-text-sec mt-0.5">
                      DNI: {b.dni || '—'}
                      {b.parentesco ? ` · ${b.parentesco}` : ''}
                    </p>
                  </div>
                  <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary flex-shrink-0">
                    {Number(b.porcentaje)}%
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]">
                  <span className={b.tieneDeclaracionJurada ? 'text-success' : 'text-warning'}>
                    {b.tieneDeclaracionJurada ? 'DJ cargada' : 'DJ pendiente'}
                  </span>
                  <span className={b.tieneOrdenPago ? 'text-success' : 'text-warning'}>
                    {b.tieneOrdenPago ? 'Orden de pago cargada' : 'Orden de pago pendiente'}
                  </span>
                  {b.declaracionJuradaDni && (
                    <span className="text-text-sec">DNI DJ: {b.declaracionJuradaDni}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
