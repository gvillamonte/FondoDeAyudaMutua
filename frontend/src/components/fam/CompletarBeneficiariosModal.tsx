'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import Drawer from '@/components/ui/Drawer';
import PdfViewerModal from '@/components/common/PdfViewerModal';

interface BeneficiarioDetalle {
  id: string;
  nombre: string;
  dni: string | null;
  parentesco: string;
  porcentajeAsignado: number;
  tieneDeclaracionJurada?: boolean;
  declaracionJuradaDni?: string | null;
  tieneOrdenPago?: boolean;
}

interface FilaBeneficiario {
  key: string;
  id?: string;
  nombre: string;
  dni: string;
  parentesco: string;
  porcentaje: string;
  incluido: boolean;
  tieneDeclaracionJurada: boolean;
  declaracionJuradaDni: string;
  declaracionJurada?: string;
  nuevoPdf?: { base64: string; size: number } | null;
  tieneOrdenPago: boolean;
  ordenPago?: string;
  nuevoOrdenPdf?: { base64: string; size: number } | null;
  yaVinculado: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  expedienteId: string;
  colegiadoId: string;
  pagada: boolean;
  isAdmin: boolean;
  modalidad?: string | null;
  vinculados: BeneficiarioDetalle[];
}

const MAX_PDF_MB = 10;

export default function CompletarBeneficiariosModal({
  isOpen,
  onClose,
  onSaved,
  expedienteId,
  colegiadoId,
  pagada,
  isAdmin,
  modalidad,
  vinculados,
}: Props) {
  const [filas, setFilas] = useState<FilaBeneficiario[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [pdfViewer, setPdfViewer] = useState<{ base64: string; nombre: string } | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/fam/colegiado/${colegiadoId}/beneficiarios`);
      const legado = Array.isArray(data) ? data : [];
      const mapa = new Map<string, FilaBeneficiario>();

      for (const v of vinculados) {
        mapa.set(v.id, {
          key: v.id,
          id: v.id,
          nombre: v.nombre,
          dni: v.dni || '',
          parentesco: v.parentesco,
          porcentaje: String(v.porcentajeAsignado),
          incluido: true,
          tieneDeclaracionJurada: Boolean(v.tieneDeclaracionJurada),
          declaracionJuradaDni: v.declaracionJuradaDni || v.dni || '',
          tieneOrdenPago: Boolean(v.tieneOrdenPago),
          yaVinculado: true,
        });
      }

      for (const b of legado) {
        const esSistema = b.ORIGEN === 'SISTEMA';
        const id = esSistema ? String(b.FAM_ID || '') : '';
        const key = id || `legado-${String(b.FAM_ID || b.DNI || Math.random().toString(36).slice(2))}`;
        if (esSistema && !id) continue;
        if (mapa.has(key)) continue;
        const dniLegado = String(b.DNI || '').trim();
        if (dniLegado && vinculados.some((v) => (v.dni || '').trim() === dniLegado)) continue;
        mapa.set(key, {
          key,
          id: id || undefined,
          nombre: b.NOMBRE_BENEFICIARIO || b.nombre || '',
          dni: b.DNI || b.dni || '',
          parentesco: b.PARENTESCO || b.parentesco || 'Otros',
          porcentaje: String(b.PORCENTAJE ?? b.porcentaje ?? 0),
          incluido: false,
          tieneDeclaracionJurada: false,
          declaracionJuradaDni: dniLegado,
          tieneOrdenPago: false,
          yaVinculado: false,
        });
      }

      setFilas([...mapa.values()]);
    } catch {
      setError('No se pudieron cargar los beneficiarios del colegiado');
    } finally {
      setLoading(false);
    }
  }, [colegiadoId, vinculados]);

  useEffect(() => {
    if (isOpen) cargar();
  }, [isOpen, cargar]);

  const suma = useMemo(
    () => filas.filter((f) => f.incluido).reduce((acc, f) => acc + (parseFloat(f.porcentaje) || 0), 0),
    [filas],
  );

  const actualizar = (key: string, cambios: Partial<FilaBeneficiario>) => {
    setFilas((prev) => prev.map((f) => (f.key === key ? { ...f, ...cambios } : f)));
  };

  const todosIncluidos = filas.length > 0 && filas.every((f) => f.incluido);

  const repartirEntreIncluidos = (lista: FilaBeneficiario[]) => {
    const incluidas = lista.filter((f) => f.incluido);
    if (incluidas.length === 0) return lista;
    const base = Math.floor((100 / incluidas.length) * 100) / 100;
    const posiciones = new Map(incluidas.map((f, idx) => [f.key, idx]));
    let acumulado = 0;
    return lista.map((f) => {
      if (!f.incluido) return f;
      const idx = posiciones.get(f.key) ?? 0;
      const porcentaje =
        idx === incluidas.length - 1
          ? Number((100 - acumulado).toFixed(2))
          : base;
      acumulado = Number((acumulado + porcentaje).toFixed(2));
      return { ...f, porcentaje: String(porcentaje) };
    });
  };

  const seleccionarTodos = (checked: boolean) => {
    setFilas((prev) => {
      const actualizadas = prev.map((f) => ({ ...f, incluido: checked }));
      if (!checked || pagada || modalidad !== 'monto_compartido') return actualizadas;
      const sumaActual = actualizadas.reduce(
        (acc, f) => acc + (parseFloat(f.porcentaje) || 0),
        0,
      );
      return Math.abs(sumaActual - 100) < 0.01
        ? actualizadas
        : repartirEntreIncluidos(actualizadas);
    });
  };

  const repartirManual = () => {
    if (pagada) return;
    setFilas((prev) => repartirEntreIncluidos(prev));
  };

  const subirDeclaracion = (fila: FilaBeneficiario, file: File) => {
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Formato inválido', 'Solo se permiten archivos PDF');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage('error', 'Archivo demasiado grande', `Máximo ${MAX_PDF_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      actualizar(fila.key, {
        nuevoPdf: { base64, size: file.size },
        declaracionJurada: base64,
        tieneDeclaracionJurada: true,
      });
      showConfirmMessage('success', 'Declaración jurada cargada', fila.nombre);
    };
    reader.readAsDataURL(file);
  };

  const verDeclaracion = async (fila: FilaBeneficiario) => {
    try {
      if (fila.nuevoPdf?.base64) {
        setPdfViewer({ base64: fila.nuevoPdf.base64, nombre: fila.nombre });
        return;
      }
      const { data } = await api.get(`/fam-beneficios/${expedienteId}/beneficiario/${fila.id}/declaracion`);
      setPdfViewer({ base64: data.contenido, nombre: fila.nombre });
    } catch {
      showConfirmMessage('error', 'No se pudo abrir la declaración jurada');
    }
  };

  const subirOrdenPago = (fila: FilaBeneficiario, file: File) => {
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Formato inválido', 'Solo se permiten archivos PDF');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      showConfirmMessage('error', 'Archivo demasiado grande', `Máximo ${MAX_PDF_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = ((e.target?.result as string) || '').split(',')[1] || '';
      actualizar(fila.key, {
        nuevoOrdenPdf: { base64, size: file.size },
        ordenPago: base64,
        tieneOrdenPago: true,
      });
      showConfirmMessage('success', 'Orden de pago cargada', fila.nombre);
    };
    reader.readAsDataURL(file);
  };

  const verOrdenPago = async (fila: FilaBeneficiario) => {
    try {
      if (fila.nuevoOrdenPdf?.base64) {
        setPdfViewer({ base64: fila.nuevoOrdenPdf.base64, nombre: `Orden de pago - ${fila.nombre}` });
        return;
      }
      const { data } = await api.get(`/fam-beneficios/${expedienteId}/beneficiario/${fila.id}/orden-pago`);
      setPdfViewer({ base64: data.contenido, nombre: `Orden de pago - ${fila.nombre}` });
    } catch {
      showConfirmMessage('error', 'No se pudo abrir la orden de pago');
    }
  };

  const guardar = async () => {
    const incluidas = filas.filter((f) => f.incluido);
    if (incluidas.length === 0) {
      setError('Debe incluir al menos un beneficiario');
      return;
    }
    if (!pagada && suma > 100) {
      setError('La suma de porcentajes no puede exceder el 100%');
      return;
    }
    for (const f of incluidas) {
      if (!f.nombre.trim()) {
        setError('Todos los beneficiarios incluidos deben tener nombre');
        return;
      }
      const dniDecl = f.declaracionJuradaDni.trim() || f.dni.trim();
      if (dniDecl && !/^\d{8}$/.test(dniDecl)) {
        setError(`El DNI del declarante de ${f.nombre} debe tener 8 dígitos`);
        return;
      }
      if (f.declaracionJurada && !dniDecl) {
        setError(`Indique el DNI del declarante de ${f.nombre}`);
        return;
      }
    }

    setGuardando(true);
    setError('');
    try {
      await api.put(`/fam-beneficios/${expedienteId}/beneficiarios`, {
        beneficiarios: incluidas.map((f) => ({
          ...(f.id ? { id: f.id } : {}),
          nombre: f.nombre.trim(),
          dni: f.dni.trim() || undefined,
          parentesco: f.parentesco || 'Otros',
          porcentaje: parseFloat(f.porcentaje) || 0,
          ...(f.declaracionJurada && { declaracionJurada: f.declaracionJurada }),
          ...((f.declaracionJuradaDni.trim() || f.dni.trim()) && {
            declaracionJuradaDni: f.declaracionJuradaDni.trim() || f.dni.trim(),
          }),
          ...(f.ordenPago && { ordenPago: f.ordenPago }),
        })),
      });
      showConfirmMessage('success', 'Beneficiarios actualizados correctamente');
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'No se pudieron guardar los beneficiarios';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Drawer isOpen={isOpen} onClose={onClose} title={pagada ? 'Corregir documentos de beneficiarios' : 'Completar beneficiarios'} width="sm:w-[46rem]">
        <div className="space-y-4">
          <p className="text-sm text-text-sec">
            Cada beneficiario debe tener su propia declaración jurada y su orden de pago. El expediente solo se podrá pagar cuando la suma de porcentajes sea 100% y todas las declaraciones estén cargadas.
          </p>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

          {loading ? (
            <p className="text-sm text-text-sec py-6 text-center">Cargando beneficiarios…</p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-bg-layout px-3 py-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-text-main cursor-pointer">
                  <input
                    type="checkbox"
                    checked={todosIncluidos}
                    disabled={pagada || filas.length === 0}
                    onChange={(e) => seleccionarTodos(e.target.checked)}
                    className="w-4 h-4 accent-[#3258CA]"
                  />
                  Seleccionar todos
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-text-sec">
                    {filas.filter((f) => f.incluido).length} de {filas.length} seleccionados
                  </span>
                  {modalidad === 'monto_compartido' && !pagada && (
                    <button
                      type="button"
                      onClick={repartirManual}
                      className="px-2.5 py-1 text-[11px] font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
                    >
                      Repartir 100% en partes iguales
                    </button>
                  )}
                </div>
              </div>

              {filas.length > 0 && (
                <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${suma > 100 ? 'bg-red-50 text-red-700 border border-red-200' : suma === 100 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  Reparto asignado: {suma}% de 100%
                </div>
              )}

              <div className="space-y-2">
                {filas.map((f) => (
                  <div key={f.key} className={`border rounded-lg p-3 ${f.incluido ? 'border-primary/40 bg-primary/5' : 'border-border bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={f.incluido} disabled={pagada || (f.yaVinculado && pagada)}
                        onChange={(e) => actualizar(f.key, { incluido: e.target.checked })}
                        className="mt-1 w-4 h-4 accent-[#3258CA]" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-text-main">{f.nombre}</span>
                          <span className="text-xs text-text-sec">DNI: {f.dni || '—'}</span>
                          {f.yaVinculado && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">YA INCLUIDO</span>}
                        </div>
                        {f.incluido ? (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">Parentesco</label>
                                <input value={f.parentesco} onChange={(e) => actualizar(f.key, { parentesco: e.target.value })}
                                  className="w-full px-2 py-1.5 border border-border rounded text-xs" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">%</label>
                                <input type="number" min={0} max={100} step="0.01" value={f.porcentaje}
                                  disabled={pagada}
                                  onChange={(e) => actualizar(f.key, { porcentaje: e.target.value })}
                                  className="w-full px-2 py-1.5 border border-border rounded text-xs" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-text-sec uppercase mb-0.5">DNI declarante (DJ)</label>
                                <input maxLength={8} value={f.declaracionJuradaDni} placeholder="8 dígitos"
                                  onChange={(e) => actualizar(f.key, { declaracionJuradaDni: e.target.value.replace(/\D/g, '') })}
                                  className="w-full px-2 py-1.5 border border-border rounded text-xs" />
                              </div>
                              <div className="flex flex-col justify-end">
                                <span className="text-[10px] font-semibold text-text-sec uppercase mb-0.5">Declaración jurada</span>
                                <div className="flex items-center gap-2">
                                  {f.tieneDeclaracionJurada || f.nuevoPdf ? (
                                    <button type="button" onClick={() => verDeclaracion(f)} className="text-xs text-primary hover:underline">Ver</button>
                                  ) : (
                                    <span className="text-xs text-amber-600 font-medium">Falta</span>
                                  )}
                                  <label className="cursor-pointer text-xs text-primary hover:underline">
                                    {f.tieneDeclaracionJurada || f.nuevoPdf ? 'Reemplazar' : 'Subir'}
                                    <input type="file" accept="application/pdf,.pdf" className="hidden"
                                      onChange={(e) => { if (e.target.files?.[0]) subirDeclaracion(f, e.target.files[0]); }} />
                                  </label>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                              <span className="text-[10px] font-semibold text-text-sec uppercase">Orden de pago</span>
                              {f.tieneOrdenPago || f.nuevoOrdenPdf ? (
                                <button type="button" onClick={() => verOrdenPago(f)} className="text-xs text-primary hover:underline">Ver</button>
                              ) : (
                                <span className="text-xs text-amber-600 font-medium">Falta</span>
                              )}
                              <label className="cursor-pointer text-xs text-primary hover:underline">
                                {f.tieneOrdenPago || f.nuevoOrdenPdf ? 'Reemplazar' : 'Subir'}
                                <input type="file" accept="application/pdf,.pdf" className="hidden"
                                  onChange={(e) => { if (e.target.files?.[0]) subirOrdenPago(f, e.target.files[0]); }} />
                              </label>
                              <span className="text-[10px] text-text-sec ml-auto">PDF individual del beneficiario</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-text-sec">
                            Activa el checkbox para editar el porcentaje, el DNI y cargar sus documentos individuales.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg text-text-main hover:bg-gray-50">Cancelar</button>
            <button onClick={guardar} disabled={guardando || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar beneficiarios'}
            </button>
          </div>
          {pagada && !isAdmin && (
            <p className="text-xs text-amber-600">Solo el ADMINISTRADOR puede corregir un expediente pagado.</p>
          )}
        </div>
      </Drawer>

      {pdfViewer && (
        <PdfViewerModal base64={pdfViewer.base64} nombre={pdfViewer.nombre} onClose={() => setPdfViewer(null)} />
      )}
    </>
  );
}
