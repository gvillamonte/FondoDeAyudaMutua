'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import PdfViewerModal from '@/components/common/PdfViewerModal';

/* ───────────── Tipos (compatibles con GET /fam-beneficios/:id/historial) ───────────── */

export interface DocumentoBeneficiario {
  id: string;
  grupo: 'Expediente' | 'Beneficiarios' | 'Pagos';
  nombre: string;
  campo: string;
  tipo: 'expediente' | 'declaracionJurada' | 'ordenPago' | 'comprobante';
  cargado: boolean;
  fechaCarga: string | null;
  puedeSubir: boolean;
  beneficiarioId?: string;
  depositoId?: string;
  origen?: 'beneficiario' | 'expediente' | null;
}

export interface BeneficiarioFila {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco: string | null;
  porcentaje: number;
}

interface TitularYPoder {
  titularNombre: string;
  titularDni: string;
  conCartaPoder: boolean;
  apoderadoNombre: string | null;
  apoderadoDni: string | null;
  apoderadoParentesco: string | null;
  poderFecha: string | null;
}

interface Props {
  expedienteId: string;
  beneficiarios: BeneficiarioFila[];
  documentos: DocumentoBeneficiario[];
  puedeSubir: boolean;
  /** Monto asignado por beneficiario (S/), por id. */
  montos?: Record<string, number>;
  /** Devuelve el PDF en base64 de un documento. */
  obtenerPdf: (doc: DocumentoBeneficiario) => Promise<string>;
  onSubir: (doc: DocumentoBeneficiario) => void;
}

/* ───────────── Utilidades ───────────── */

const fmtFecha = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

/** Documentos que corresponden a un beneficiario: los propios + los compartidos del expediente. */
function documentosDe(b: BeneficiarioFila, docs: DocumentoBeneficiario[]) {
  return docs.filter((d) => {
    if (d.grupo === 'Beneficiarios') return d.beneficiarioId === b.id;
    if (d.grupo === 'Expediente') return d.campo !== 'ordenPago'; // la orden de pago se evalúa por beneficiario
    return false;
  });
}

function estadoDocumentacion(b: BeneficiarioFila, docs: DocumentoBeneficiario[]) {
  const propios = documentosDe(b, docs);
  const cargados = propios.filter((d) => d.cargado).length;
  const faltantes = propios.filter((d) => !d.cargado);
  const porcentaje = propios.length ? Math.round((cargados / propios.length) * 100) : 0;
  return { propios, cargados, faltantes, porcentaje };
}

const colorPorcentaje = (p: number) =>
  p === 100
    ? { text: 'text-success', bar: 'bg-success', chip: 'bg-success/10 text-success' }
    : p >= 60
      ? { text: 'text-warning', bar: 'bg-warning', chip: 'bg-warning/10 text-warning' }
      : { text: 'text-error', bar: 'bg-error', chip: 'bg-error/10 text-error' };

const normDni = (v?: string | null) => (v || '').replace(/\D/g, '');

/* ───────────── Componentes pequeños ───────────── */

function BadgeColegiado({ esColegiado }: { esColegiado: boolean | null }) {
  if (esColegiado === null) return null;
  return esColegiado ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary">
      Es el colegiado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border border-border-main text-text-sec">
      No es el colegiado
    </span>
  );
}

function BadgeCartaPoder() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-warning/10 text-warning">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      Carta poder
    </span>
  );
}

function BarraDocumentacion({ porcentaje, faltantes }: { porcentaje: number; faltantes: DocumentoBeneficiario[] }) {
  const c = colorPorcentaje(porcentaje);
  return (
    <div className="min-w-[150px]">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-semibold ${c.text}`}>{porcentaje}%</span>
        {faltantes.length > 0 && (
          <span className="text-[10px] text-text-sec">Faltan {faltantes.length}</span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-border-main overflow-hidden">
        <div className={`h-full ${c.bar}`} style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}

/* ───────────── Componente principal ───────────── */

export default function BeneficiariosDocumentacion({
  expedienteId,
  beneficiarios,
  documentos,
  puedeSubir,
  montos,
  obtenerPdf,
  onSubir,
}: Props) {
  const [info, setInfo] = useState<TitularYPoder | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [visor, setVisor] = useState<{ base64: string; doc: DocumentoBeneficiario; b: BeneficiarioFila } | null>(null);
  const [abriendoId, setAbriendoId] = useState<string | null>(null);
  const [errorVisor, setErrorVisor] = useState<string | null>(null);

  // Datos del colegiado titular y de la carta poder (el historial no los incluye).
  useEffect(() => {
    let activo = true;
    api
      .get(`/fam-beneficios/${expedienteId}`)
      .then(({ data }) => {
        if (!activo) return;
        setInfo({
          titularNombre: data?.NOMBRE_COLEGIADO || '',
          titularDni: data?.DNI || '',
          conCartaPoder: Boolean(data?.conCartaPoder),
          apoderadoNombre: data?.apoderadoNombre || null,
          apoderadoDni: data?.apoderadoDni || null,
          apoderadoParentesco: data?.apoderadoParentesco || null,
          poderFecha: data?.poderFecha || null,
        });
      })
      .catch(() => activo && setInfo(null));
    return () => {
      activo = false;
    };
  }, [expedienteId]);

  const esColegiado = (b: BeneficiarioFila): boolean | null => {
    if (!info?.titularDni || !b.dni) return null;
    return normDni(b.dni) === normDni(info.titularDni);
  };

  const filas = useMemo(
    () => beneficiarios.map((b) => ({ b, ...estadoDocumentacion(b, documentos) })),
    [beneficiarios, documentos],
  );

  const seleccionado = filas.find((f) => f.b.id === seleccionadoId) || null;

  const abrirDocumento = async (doc: DocumentoBeneficiario, b: BeneficiarioFila) => {
    setAbriendoId(doc.id);
    setErrorVisor(null);
    try {
      const base64 = await obtenerPdf(doc);
      setVisor({ base64, doc, b });
    } catch (e: any) {
      setErrorVisor(e?.response?.data?.message || 'No se pudo abrir el documento.');
    } finally {
      setAbriendoId(null);
    }
  };

  return (
    <section className="border border-border-main rounded-xl overflow-hidden bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-main">
        <div>
          <h4 className="text-sm font-semibold text-text-main">Beneficiarios y documentación</h4>
          <p className="text-[11px] text-text-sec">
            Avance de documentos por beneficiario. Verde = completo, ámbar/rojo = faltan documentos.
          </p>
        </div>
        <p className="text-[11px] text-text-main font-medium">
          {beneficiarios.length} {beneficiarios.length === 1 ? 'beneficiario' : 'beneficiarios'}
        </p>
      </div>

      {filas.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-text-sec">Sin beneficiarios vinculados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-layout text-left text-[11px] uppercase tracking-wider text-text-sec">
                <th className="px-4 py-2 font-semibold">Beneficiario</th>
                <th className="px-4 py-2 font-semibold">Parentesco</th>
                <th className="px-4 py-2 font-semibold text-right">Reparto</th>
                <th className="px-4 py-2 font-semibold text-right">Monto</th>
                <th className="px-4 py-2 font-semibold">Documentación</th>
                <th className="px-4 py-2 font-semibold">Documentación subida</th>
                <th className="px-4 py-2 font-semibold text-right">Ver documentación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {filas.map(({ b, porcentaje, faltantes, propios }) => (
                <tr key={b.id} className="hover:bg-bg-layout/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-main">{b.nombre}</p>
                    <p className="text-[11px] text-text-sec">DNI: {b.dni || '—'}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <BadgeColegiado esColegiado={esColegiado(b)} />
                      {info?.conCartaPoder && <BadgeCartaPoder />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-sec">{b.parentesco || '—'}</td>
                  <td className="px-4 py-3 text-right text-text-main font-medium">{Number(b.porcentaje)}%</td>
                  <td className="px-4 py-3 text-right text-text-main font-semibold whitespace-nowrap">
                    {montos?.[b.id] != null
                      ? `S/ ${Number(montos[b.id]).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <BarraDocumentacion porcentaje={porcentaje} faltantes={faltantes} />
                  </td>
                  <td className="px-4 py-3 max-w-[300px]">
                    <div className="flex flex-wrap gap-1">
                      {propios
                        .filter((d) => d.cargado)
                        .map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => abrirDocumento(d, b)}
                            disabled={abriendoId === d.id}
                            title={`Ver ${d.nombre}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-success bg-success/10 rounded-full hover:bg-success/20 disabled:opacity-50"
                          >
                            ✓ {d.nombre.split(' · ')[0]}
                          </button>
                        ))}
                      {propios.every((d) => !d.cargado) && (
                        <span className="text-[11px] text-text-sec">Ningún documento subido</span>
                      )}
                    </div>
                    {faltantes.length > 0 && (
                      <p className="mt-1 text-[11px] text-warning">
                        Pendiente: {faltantes.map((d) => d.nombre.split(' · ')[0]).join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSeleccionadoId(b.id)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
                    >
                      Ver documentación
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ───────────── Drawer: perfil + documentos del beneficiario ───────────── */}
      {seleccionado && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setSeleccionadoId(null)}>
          <aside
            className="bg-white w-full max-w-md h-full flex flex-col border-l border-border-main"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-main">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-text-sec">Perfil del beneficiario</p>
                <h3 className="text-base font-semibold text-text-main truncate">{seleccionado.b.nombre}</h3>
                <p className="text-xs text-text-sec">
                  DNI {seleccionado.b.dni || '—'}
                  {seleccionado.b.parentesco ? ` · ${seleccionado.b.parentesco}` : ''} ·{' '}
                  {Number(seleccionado.b.porcentaje)}% del reparto
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <BadgeColegiado esColegiado={esColegiado(seleccionado.b)} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSeleccionadoId(null)}
                className="p-1.5 text-text-sec hover:text-text-main rounded-lg hover:bg-bg-layout"
                aria-label="Cerrar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Alerta de Carta Poder */}
              {info?.conCartaPoder && (
                <div className="border border-warning/40 bg-warning/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-warning font-semibold text-sm">
                    <BadgeCartaPoder />
                    <span>El beneficio será recogido por un apoderado</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs text-text-main">
                    <dt className="text-text-sec">Apoderado</dt>
                    <dd className="font-medium">{info.apoderadoNombre || '—'}</dd>
                    <dt className="text-text-sec">DNI</dt>
                    <dd>{info.apoderadoDni || '—'}</dd>
                    {info.apoderadoParentesco && (
                      <>
                        <dt className="text-text-sec">Parentesco</dt>
                        <dd>{info.apoderadoParentesco}</dd>
                      </>
                    )}
                    {info.poderFecha && (
                      <>
                        <dt className="text-text-sec">Fecha del poder</dt>
                        <dd>{fmtFecha(info.poderFecha)}</dd>
                      </>
                    )}
                  </dl>
                </div>
              )}

              {/* Avance */}
              <div>
                <p className="text-xs font-semibold text-text-main mb-2">
                  Documentación: {seleccionado.cargados} de {seleccionado.propios.length} documentos
                </p>
                <BarraDocumentacion porcentaje={seleccionado.porcentaje} faltantes={seleccionado.faltantes} />
              </div>

              {errorVisor && <p className="text-xs text-error">{errorVisor}</p>}

              {/* Lista de documentos */}
              <ul className="divide-y divide-border-main border border-border-main rounded-lg">
                {seleccionado.propios.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${doc.cargado ? 'bg-success' : 'bg-warning'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-main truncate" title={doc.nombre}>
                        {doc.nombre.split(' · ')[0]}
                      </p>
                      <p className={`text-[11px] ${doc.cargado ? 'text-success' : 'text-warning'}`}>
                        {doc.cargado ? `Cargado${doc.fechaCarga ? ` · ${fmtFecha(doc.fechaCarga)}` : ''}` : 'Pendiente'}
                        {doc.origen === 'expediente' && (
                          <span className="text-text-sec"> · Compartido del expediente</span>
                        )}
                        {doc.grupo === 'Expediente' && (
                          <span className="text-text-sec"> · Del expediente</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {doc.cargado && (
                        <button
                          type="button"
                          onClick={() => abrirDocumento(doc, seleccionado.b)}
                          disabled={abriendoId === doc.id}
                          className="px-2.5 py-1 text-[11px] font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 disabled:opacity-50"
                        >
                          {abriendoId === doc.id ? 'Abriendo...' : 'Ver documento'}
                        </button>
                      )}
                      {puedeSubir && doc.puedeSubir && (
                        <button
                          type="button"
                          onClick={() => onSubir(doc)}
                          className="px-2.5 py-1 text-[11px] font-medium text-text-main border border-border-main rounded-lg hover:bg-bg-layout"
                        >
                          {doc.cargado ? 'Reemplazar' : 'Subir'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}

      {/* ───────────── Visor con recuadro del beneficiario ───────────── */}
      {visor && (
        <div className="relative z-[60]">
          <PdfViewerModal
            base64={visor.base64}
            nombre={visor.doc.nombre}
            onClose={() => setVisor(null)}
            overlay={
              <div className="w-64 bg-white/95 border border-border-main rounded-lg p-3 shadow-sm text-xs">
                <p className="text-[10px] uppercase tracking-wider text-text-sec mb-1">Beneficiario</p>
                <p className="text-sm font-semibold text-text-main leading-tight">{visor.b.nombre}</p>
                <p className="text-text-sec mt-0.5">DNI {visor.b.dni || '—'}</p>
                {visor.b.parentesco && (
                  <p className="text-text-sec">Parentesco: {visor.b.parentesco}</p>
                )}
                <p className="text-text-sec">Reparto: {Number(visor.b.porcentaje)}%</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <BadgeColegiado esColegiado={esColegiado(visor.b)} />
                  {info?.conCartaPoder && <BadgeCartaPoder />}
                </div>
                {info?.titularNombre && (
                  <p className="mt-2 pt-2 border-t border-border-main text-text-sec">
                    Colegiado titular: <span className="text-text-main font-medium">{info.titularNombre}</span>
                  </p>
                )}
              </div>
            }
          />
        </div>
      )}
    </section>
  );
}

/* ───────────── Versión autónoma (carga sus propios datos) ───────────── */

function urlDocumento(expedienteId: string, doc: DocumentoBeneficiario) {
  const base = `/fam-beneficios/${expedienteId}`;
  if (doc.tipo === 'expediente') return `/documento/${doc.campo}`;
  if (doc.tipo === 'declaracionJurada') return `/beneficiario/${doc.beneficiarioId}/declaracion`;
  if (doc.tipo === 'ordenPago') return `/beneficiario/${doc.beneficiarioId}/orden-pago`;
  return `/deposito/${doc.depositoId}/comprobante`;
}

export function BeneficiariosDocumentacionAutonomo({
  expedienteId,
  montos,
  onSubir,
}: {
  expedienteId: string;
  montos?: Record<string, number>;
  /** Si se define, muestra el botón Subir/Reemplazar y delega la acción. */
  onSubir?: (doc: DocumentoBeneficiario) => void;
}) {
  const [data, setData] = useState<{ beneficiarios: BeneficiarioFila[]; documentos: DocumentoBeneficiario[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    api
      .get(`/fam-beneficios/${expedienteId}/historial`)
      .then(({ data: r }) => activo && setData({ beneficiarios: r.beneficiarios || [], documentos: r.documentos || [] }))
      .catch((e) => activo && setError(e?.response?.data?.message || 'No se pudo cargar la documentación.'));
    return () => {
      activo = false;
    };
  }, [expedienteId]);

  if (error) return <p className="text-sm text-error text-center py-8">{error}</p>;
  if (!data) return <p className="text-sm text-text-sec text-center py-8">Cargando beneficiarios...</p>;

  return (
    <BeneficiariosDocumentacion
      expedienteId={expedienteId}
      beneficiarios={data.beneficiarios}
      documentos={data.documentos}
      puedeSubir={Boolean(onSubir)}
      montos={montos}
      obtenerPdf={async (doc) => (await api.get(urlDocumento(expedienteId, doc))).data.contenido as string}
      onSubir={onSubir || (() => undefined)}
    />
  );
}