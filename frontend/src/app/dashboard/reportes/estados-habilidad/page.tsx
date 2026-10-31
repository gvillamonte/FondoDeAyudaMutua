'use client';

import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

interface ResultadoBusqueda {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRES: string;
  APELLIDO_PATERNO: string;
  APELLIDO_MATERNO: string;
  ESTADO_COLEGIATURA: string;
}

interface Cabecera {
  colegiadoId: string;
  nroCip: string;
  capitulo: string;
  especialidad: string;
  fechaIncorporacion: string;
  nombres: string;
  fechaReporte: string;
}

interface Fila {
  nota: string;
  fechaAporte: string;
  comprobante: string;
  fechaComprobante: string;
  monto: number | null;
  estado: string;
}

interface Reporte {
  cabecera: Cabecera;
  filas: Fila[];
}

interface LogoInfo {
  mimeType: string;
  filename: string;
  contenido: string;
}

const ENCABEZADOS = [
  'Nota',
  'Fecha Aporte',
  'Comprobante',
  'Fecha Comprobante',
  'Monto',
  'Estado',
];

function sanitizarNombreArchivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
    .replace(/_+$/g, '');
}

export default function EstadosDeHabilidadPage() {
  const [rol, setRol] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [desde, setDesde] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [seleccion, setSeleccion] = useState<Map<string, ResultadoBusqueda>>(new Map());
  const [buscando, setBuscando] = useState(false);
  const [cipActivo, setCipActivo] = useState<string | null>(null);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [exportando, setExportando] = useState<
    'excel' | 'pdf' | 'excel-lote' | 'pdf-lote' | null
  >(null);
  const [progresoLote, setProgresoLote] = useState<string | null>(null);
  const [logo, setLogo] = useState<LogoInfo | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_LOTE = 20;
  const esAdmin = rol === 'ADMINISTRADOR';

  useEffect(() => {
    setRol(getCurrentUser()?.rol || null);
    cargarLogo();
  }, []);

  // (Re)carga el reporte del colegiado activo cuando cambia el periodo 'desde'
  useEffect(() => {
    if (!cipActivo) return;
    let cancelado = false;
    setCargandoReporte(true);
    api
      .get('/reportes/estados-habilidad', {
        params: { cip: cipActivo, ...(desde ? { desde } : {}) },
      })
      .then(({ data }) => {
        if (!cancelado) setReporte(data);
      })
      .catch((err: any) => {
        if (!cancelado) {
          mostrarMensaje('error', msgError(err, 'Error al generar el reporte del colegiado.'));
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoReporte(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cipActivo, desde]);

  const mostrarMensaje = (tipo: 'ok' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  };

  const msgError = (err: any, fallback: string): string => {
    const data = err?.response?.data;
    const m = data?.message ?? data?.error;
    if (Array.isArray(m)) return m[0] || fallback;
    return typeof m === 'string' && m ? m : fallback;
  };

  const cargarLogo = async () => {
    try {
      const { data } = await api.get('/reportes/logo');
      setLogo(data || null);
    } catch {
      setLogo(null);
    }
  };

  const buscar = async () => {
    const termino = searchInput.trim();
    if (!termino) return;
    setBuscando(true);
    try {
      const { data } = await api.get('/legacy/colegiados/search', {
        params: { search: termino, page: 1, limit: 8 },
      });
      setResultados(data.data || []);
      if (!data.data || data.data.length === 0) {
        mostrarMensaje('error', 'No se encontraron colegiados con ese criterio.');
      }
    } catch {
      mostrarMensaje('error', 'Error al buscar colegiados. Verifique su sesión.');
    } finally {
      setBuscando(false);
    }
  };

  const seleccionarColegiado = (item: ResultadoBusqueda) => {
    setResultados([]);
    setSearchInput('');
    setReporte(null);
    setCipActivo(item.NUM_COLEGIATURA);
  };

  const alternarSeleccion = (item: ResultadoBusqueda) => {
    const cip = item.NUM_COLEGIATURA;
    setSeleccion((prev) => {
      const next = new Map(prev);
      if (next.has(cip)) {
        next.delete(cip);
      } else {
        if (next.size >= MAX_LOTE) return prev;
        next.set(cip, item);
      }
      return next;
    });
    if (!seleccion.has(cip) && seleccion.size >= MAX_LOTE) {
      mostrarMensaje('error', `La descarga en bloque admite un maximo de ${MAX_LOTE} colegiados.`);
    }
  };

  const quitarDeSeleccion = (cip: string) => {
    setSeleccion((prev) => {
      const next = new Map(prev);
      next.delete(cip);
      return next;
    });
  };

  const limpiarSeleccion = () => setSeleccion(new Map());

  const todosDeBusquedaMarcados =
    resultados.length > 0 && resultados.every((r) => seleccion.has(r.NUM_COLEGIATURA));

  const alternarTodo = () => {
    setSeleccion((prev) => {
      const next = new Map(prev);
      if (resultados.every((r) => next.has(r.NUM_COLEGIATURA))) {
        for (const r of resultados) next.delete(r.NUM_COLEGIATURA);
      } else {
        for (const r of resultados) {
          if (next.size >= MAX_LOTE) break;
          next.set(r.NUM_COLEGIATURA, r);
        }
      }
      return next;
    });
  };

  const base64ABlob = (base64: string, mime: string): Blob => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: mime });
  };

  const descargarBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const nombreArchivoReporte = (cab: Cabecera, ext: 'pdf' | 'xlsx'): string => {
    const nombre = sanitizarNombreArchivo(cab.nombres || '');
    const base = [cab.nroCip, nombre].filter(Boolean).join('_');
    return `Estado_Habilidad_${base}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  };

  const descargarExcel = async () => {
    if (!reporte) return;
    setExportando('excel');
    try {
      const { data } = await api.get('/reportes/estados-habilidad/excel', {
        params: { cip: reporte.cabecera.nroCip, ...(desde ? { desde } : {}) },
      });
      const { filename, contenido } = data;
      descargarBlob(
        base64ABlob(
          contenido,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ),
        filename,
      );
    } catch {
      mostrarMensaje('error', 'Error al generar el archivo Excel.');
    } finally {
      setExportando(null);
    }
  };

  const descargarExcelLote = async () => {
    const cips = [...seleccion.keys()];
    if (!cips.length) return;
    if (cips.length > MAX_LOTE) {
      mostrarMensaje('error', `La descarga en bloque admite un maximo de ${MAX_LOTE} colegiados.`);
      return;
    }
    setExportando('excel-lote');
    try {
      const { data } = await api.post('/reportes/estados-habilidad/excel-lote', {
        cips,
        ...(desde ? { desde } : {}),
      });
      descargarBlob(base64ABlob(data.contenido, 'application/zip'), data.filename);
      mostrarMensaje('ok', `Se descargaron ${cips.length} reportes Excel en un ZIP.`);
    } catch (err: any) {
      mostrarMensaje('error', msgError(err, 'Error al generar el ZIP de Excel.'));
    } finally {
      setExportando(null);
    }
  };

  const generarPDFReporte = (rep: Reporte): jsPDF => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 10;
      const anchoUtil = pageW - marginX * 2;

      // Logo institucional (solo PNG/JPG, que jsPDF soporta)
      let logoAncho = 0;
      let logoAlto = 0;
      const logoFmt =
        logo && logo.mimeType === 'image/png'
          ? 'PNG'
          : logo && logo.mimeType === 'image/jpeg'
            ? 'JPEG'
            : null;
      if (logo && logoFmt) {
        try {
          const props = doc.getImageProperties(
            `data:${logo.mimeType};base64,${logo.contenido}`,
          );
          logoAlto = 20;
          logoAncho = Math.min(40, (props.width / props.height) * logoAlto);
        } catch {
          logoAlto = 0;
          logoAncho = 0;
        }
      }

      const topY = 10;
      const altoTitulo = Math.max(logoAlto, 12);
      const tituloY = topY + altoTitulo / 2 + 4;
      const gridTop = topY + altoTitulo + 6;
      const labelH = 6;
      const valueH = 6;
      const tableTop = gridTop + (labelH + valueH) * 2 + 4;
      const colW = anchoUtil / 3;

      const celda = (x: number, y: number, label: string, valor: string) => {
        doc.setDrawColor(200, 205, 215);
        doc.setLineWidth(0.2);
        doc.rect(x, y, colW, labelH);
        doc.rect(x, y + labelH, colW, valueH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(label, x + 1.5, y + labelH - 2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        const lineas = doc.splitTextToSize(valor, colW - 3) as string[];
        doc.text(lineas[0] || '', x + 1.5, y + labelH + valueH - 2);
      };

      const dibujarEncabezado = () => {
        if (logo && logoFmt && logoAncho > 0) {
          try {
            doc.addImage(
              `data:${logo.mimeType};base64,${logo.contenido}`,
              logoFmt,
              marginX,
              topY,
              logoAncho,
              logoAlto,
            );
          } catch {
            /* sin logo */
          }
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('RESUMEN DE APORTES Y SERVICIOS', pageW / 2, tituloY, {
          align: 'center',
        });

        const cab = rep.cabecera;
        celda(marginX, gridTop, 'Nro Cip:', cab.nroCip);
        celda(marginX + colW, gridTop, 'Capitulo:', cab.capitulo);
        celda(marginX + colW * 2, gridTop, 'Fecha Incorporacion:', cab.fechaIncorporacion);
        celda(marginX, gridTop + labelH + valueH, 'Nombres y Apellidos:', cab.nombres);
        celda(marginX + colW, gridTop + labelH + valueH, 'Especialidad', cab.especialidad);
        celda(marginX + colW * 2, gridTop + labelH + valueH, 'Fecha Reporte:', cab.fechaReporte);
      };

      autoTable(doc, {
        head: [ENCABEZADOS],
        body: rep.filas.map((f) => [
          f.nota,
          f.fechaAporte,
          f.comprobante,
          f.fechaComprobante,
          f.monto !== null ? `S/. ${f.monto.toFixed(2)}` : '—',
          f.estado,
        ]),
        startY: tableTop,
        margin: { left: marginX, right: marginX, top: tableTop, bottom: 14 },
        styles: {
          fontSize: 7.5,
          cellPadding: 1.2,
          overflow: 'linebreak',
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [50, 88, 202],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 34, halign: 'left' },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 34, halign: 'center' },
          3: { cellWidth: 26, halign: 'center' },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: anchoUtil - 134, halign: 'left' },
        },
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          const raw = String(data.cell.raw ?? '');
          if (data.column.index === 5) {
            if (raw.startsWith('No Habilitado')) data.cell.styles.textColor = [220, 38, 38];
            else if (raw.startsWith('Habilitado')) data.cell.styles.textColor = [22, 163, 74];
            else data.cell.styles.textColor = [100, 116, 139];
          }
          if (data.column.index === 0 && raw) data.cell.styles.textColor = [217, 119, 6];
          if (data.column.index === 2 && raw === 'No se registra comprobante') {
            data.cell.styles.textColor = [100, 116, 139];
          }
        },
        didDrawPage: () => {
          dibujarEncabezado();
        },
      });

      const totalPaginas: number =
        typeof (doc as any).getNumberOfPages === 'function'
          ? (doc as any).getNumberOfPages()
          : (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 158, 170);
        doc.text(`Pagina ${i} de ${totalPaginas}`, pageW / 2, pageH - 6, {
          align: 'center',
        });
      }

      return doc;
  };

  const descargarPDF = () => {
    if (!reporte) return;
    setExportando('pdf');
    try {
      const doc = generarPDFReporte(reporte);
      doc.save(nombreArchivoReporte(reporte.cabecera, 'pdf'));
    } catch {
      mostrarMensaje('error', 'Error al generar el archivo PDF.');
    } finally {
      setExportando(null);
    }
  };

  const descargarPDFLote = async () => {
    const cips = [...seleccion.keys()];
    if (!cips.length) return;
    if (cips.length > MAX_LOTE) {
      mostrarMensaje('error', `La descarga en bloque admite un maximo de ${MAX_LOTE} colegiados.`);
      return;
    }
    setExportando('pdf-lote');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      let index = 0;
      for (const cip of cips) {
        index += 1;
        setProgresoLote(`${index} de ${cips.length}`);
        const { data } = await api.get('/reportes/estados-habilidad', {
          params: { cip, ...(desde ? { desde } : {}) },
        });
        const doc = generarPDFReporte(data as Reporte);
        zip.file(nombreArchivoReporte((data as Reporte).cabecera, 'pdf'), doc.output('arraybuffer'));
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      descargarBlob(blob, `Estados_Habilidad_Lote_${new Date().toISOString().slice(0, 10)}.zip`);
      mostrarMensaje('ok', `Se descargaron ${cips.length} reportes PDF en un ZIP.`);
    } catch (err: any) {
      mostrarMensaje('error', msgError(err, 'Error al generar el ZIP de PDF.'));
    } finally {
      setExportando(null);
      setProgresoLote(null);
    }
  };

  const descargarLogo = () => {
    if (!logo) return;
    descargarBlob(base64ABlob(logo.contenido, logo.mimeType), logo.filename);
  };

  const onArchivoLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      mostrarMensaje('error', 'Formato no permitido. Use PNG, JPG o WEBP.');
      return;
    }
    if (file.size > 300 * 1024) {
      mostrarMensaje('error', 'La imagen no debe superar los 300 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.post('/reportes/logo', {
          contenido: String(reader.result),
          mimeType: file.type,
          filename: file.name,
        });
        await cargarLogo();
        mostrarMensaje('ok', 'Logo actualizado correctamente.');
      } catch (err: any) {
        mostrarMensaje('error', msgError(err, 'Error al subir el logo.'));
      }
    };
    reader.readAsDataURL(file);
  };

  const cambiarColegiado = () => {
    setReporte(null);
    setCipActivo(null);
    setSearchInput('');
    setResultados([]);
  };

  const colorEstado = (estado: string) => {
    if (estado.startsWith('No Habilitado')) return 'text-error font-medium';
    if (estado.startsWith('Habilitado')) return 'text-success font-medium';
    return 'text-text-sec';
  };

  const nombreCompleto = (item: ResultadoBusqueda) =>
    `${item.APELLIDO_PATERNO || ''} ${item.APELLIDO_MATERNO || ''} ${item.NOMBRES || ''}`
      .replace(/\s+/g, ' ')
      .trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-text-main">Estados de Habilidad</h2>
          <p className="text-text-sec mt-1">
            Reporte de aportes y servicios por colegiado (Excel / PDF)
          </p>
        </div>
        {reporte && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={descargarExcel}
              disabled={exportando !== null}
              className="px-4 py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {exportando === 'excel' ? 'Generando...' : 'Descargar Excel'}
            </button>
            <button
              onClick={descargarPDF}
              disabled={exportando !== null}
              className="px-4 py-2 bg-error text-white text-sm font-medium rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {exportando === 'pdf' ? 'Generando...' : 'Descargar PDF'}
            </button>
          </div>
        )}
      </div>

      {mensaje && (
        <div
          className={`px-4 py-3 rounded-lg text-sm border ${
            mensaje.tipo === 'ok'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Buscador */}
      {!reporte && (
        <div className="bg-white border border-border-main rounded-lg p-6">
          <label className="block text-sm font-medium text-text-main mb-2">
            Buscar colegiado (N° CIP, DNI o apellidos)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="Ej.: 140313, 45678932, DOLMOS..."
              className="flex-1 min-w-[220px] px-3 py-2 border border-border-main rounded-lg text-sm text-text-main placeholder:text-text-sec focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <div>
              <label className="block text-xs font-medium text-text-sec mb-1">
                Periodo desde (opcional)
              </label>
              <input
                type="month"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="px-3 py-2 border border-border-main rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <button
              onClick={buscar}
              disabled={buscando || !searchInput.trim()}
              className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {buscando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {resultados.length > 0 && (
            <>
              <ul className="mt-4 border border-border-main rounded-lg divide-y divide-border-main max-h-72 overflow-y-auto">
                {resultados.map((item) => (
                  <li key={item.COLEGIADO_ID} className="flex items-center bg-white">
                    <input
                      type="checkbox"
                      checked={seleccion.has(item.NUM_COLEGIATURA)}
                      onChange={() => alternarSeleccion(item)}
                      aria-label={`Seleccionar CIP ${item.NUM_COLEGIATURA}`}
                      className="ml-4 h-4 w-4 rounded border-border-main text-primary focus:ring-primary/30 cursor-pointer"
                    />
                    <button
                      onClick={() => seleccionarColegiado(item)}
                      className="flex-1 flex items-center justify-between px-3 py-3 text-left hover:bg-bg-layout transition-colors"
                    >
                      <span className="text-sm text-text-main">
                        <span className="font-semibold">{item.NUM_COLEGIATURA}</span>
                        <span className="mx-2 text-text-sec">|</span>
                        {nombreCompleto(item)}
                        <span className="mx-2 text-text-sec">|</span>
                        <span className="text-text-sec">DNI: {item.DNI}</span>
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          (item.ESTADO_COLEGIATURA || '').toUpperCase().includes('NO HABILITADO')
                            ? 'bg-red-50 text-error'
                            : 'bg-green-50 text-success'
                        }`}
                      >
                        {item.ESTADO_COLEGIATURA}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
                  <input
                    type="checkbox"
                    checked={todosDeBusquedaMarcados}
                    onChange={alternarTodo}
                    className="h-4 w-4 rounded border-border-main text-primary focus:ring-primary/30"
                  />
                  Seleccionar todos los de esta búsqueda ({resultados.length})
                </label>
                <span className="text-xs text-text-sec">
                  La selección se acumula entre búsquedas (máx. {MAX_LOTE})
                </span>
              </div>
            </>
          )}

          {/* Selección persistente para descarga en bloque */}
          {seleccion.size > 0 && (
            <div className="mt-4 border-t border-border-main pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-text-main">
                  Selección para descarga en bloque ({seleccion.size}/{MAX_LOTE})
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={limpiarSeleccion}
                    disabled={exportando !== null}
                    className="px-3 py-1.5 border border-border-main text-text-sec text-xs font-medium rounded-lg hover:bg-bg-layout transition-colors disabled:opacity-50"
                  >
                    Limpiar selección
                  </button>
                  <button
                    onClick={descargarExcelLote}
                    disabled={exportando !== null}
                    className="px-4 py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50"
                  >
                    {exportando === 'excel-lote'
                      ? 'Generando...'
                      : `Descargar Excel (${seleccion.size})`}
                  </button>
                  <button
                    onClick={descargarPDFLote}
                    disabled={exportando !== null}
                    className="px-4 py-2 bg-error text-white text-sm font-medium rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
                  >
                    {exportando === 'pdf-lote'
                      ? progresoLote
                        ? `Generando ${progresoLote}...`
                        : 'Generando...'
                      : `Descargar PDF (${seleccion.size})`}
                  </button>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {[...seleccion.values()].map((item) => (
                  <li
                    key={item.NUM_COLEGIATURA}
                    className="flex items-center gap-2 px-3 py-1.5 bg-bg-layout border border-border-main rounded-lg text-xs text-text-main"
                  >
                    <span className="font-semibold">{item.NUM_COLEGIATURA}</span>
                    <span className="text-text-sec">{nombreCompleto(item)}</span>
                    <button
                      onClick={() => quitarDeSeleccion(item.NUM_COLEGIATURA)}
                      disabled={exportando !== null}
                      aria-label={`Quitar CIP ${item.NUM_COLEGIATURA}`}
                      className="text-text-sec hover:text-error font-bold px-1 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {cargandoReporte && (
        <div className="bg-white border border-border-main rounded-lg p-10 flex items-center justify-center gap-3 text-text-sec">
          <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Generando reporte...
        </div>
      )}

      {/* Vista previa del reporte */}
      {reporte && (
        <div className="bg-white border border-border-main rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-4">
            <span className="text-xs text-text-sec">
              Vista previa — {reporte.filas.length} meses
              {desde ? ` (periodo desde ${desde})` : ''}
            </span>
            <button
              onClick={cambiarColegiado}
              className="text-sm text-primary hover:underline font-medium"
            >
              Cambiar colegiado
            </button>
          </div>

          <div className="px-6 pb-4">
            <div className="flex items-center gap-4 pb-3">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:${logo.mimeType};base64,${logo.contenido}`}
                  alt="Logo CIP"
                  className="h-14 w-auto"
                />
              )}
              <h3 className="flex-1 text-center text-lg font-semibold text-text-main">
                RESUMEN DE APORTES Y SERVICIOS
              </h3>
              <span className="w-14" />
            </div>

            <table className="w-full border-collapse text-sm">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[17%]" />
                <col className="w-[13%]" />
                <col className="w-[17%]" />
                <col className="w-[16%]" />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <td className="border border-border-main bg-bg-layout px-3 py-2 font-semibold text-text-main">
                    Nro Cip:
                  </td>
                  <td className="border border-border-main px-3 py-2 text-text-main">
                    {reporte.cabecera.nroCip}
                  </td>
                  <td className="border border-border-main bg-bg-layout px-3 py-2 font-semibold text-text-main">
                    Capitulo:
                  </td>
                  <td className="border border-border-main px-3 py-2 text-text-main">
                    {reporte.cabecera.capitulo}
                  </td>
                  <td className="border border-border-main bg-bg-layout px-3 py-2 font-semibold text-text-main">
                    Fecha Incorporacion:
                  </td>
                  <td className="border border-border-main px-3 py-2 text-text-main">
                    {reporte.cabecera.fechaIncorporacion}
                  </td>
                </tr>
                <tr>
                  <td className="border border-border-main bg-bg-layout px-3 py-2 font-semibold text-text-main">
                    Nombres y Apellidos:
                  </td>
                  <td className="border border-border-main px-3 py-2 text-text-main">
                    {reporte.cabecera.nombres}
                  </td>
                  <td className="border border-border-main bg-bg-layout px-3 py-2 font-semibold text-text-main">
                    Especialidad
                  </td>
                  <td className="border border-border-main px-3 py-2 text-text-main">
                    {reporte.cabecera.especialidad}
                  </td>
                  <td className="border border-border-main bg-bg-layout px-3 py-2 font-semibold text-text-main">
                    Fecha Reporte:
                  </td>
                  <td className="border border-border-main px-3 py-2 text-text-main">
                    {reporte.cabecera.fechaReporte}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {reporte.filas.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-text-sec">
              No hay meses a mostrar para el rango del reporte.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto border-t border-border-main">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {ENCABEZADOS.map((h) => (
                      <th
                        key={h}
                        className="bg-primary text-white border border-primary px-3 py-2 text-left text-xs font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reporte.filas.map((fila, index) => (
                    <tr key={`${fila.fechaAporte}-${index}`} className="bg-white">
                      <td className="border border-border-main px-3 py-1.5 text-xs text-warning font-medium whitespace-nowrap">
                        {fila.nota}
                      </td>
                      <td className="border border-border-main px-3 py-1.5 text-text-main text-center whitespace-nowrap">
                        {fila.fechaAporte}
                      </td>
                      <td
                        className={`border border-border-main px-3 py-1.5 text-center whitespace-nowrap ${
                          fila.comprobante === 'No se registra comprobante'
                            ? 'text-text-sec italic text-xs'
                            : 'text-text-main'
                        }`}
                      >
                        {fila.comprobante}
                      </td>
                      <td className="border border-border-main px-3 py-1.5 text-text-main text-center whitespace-nowrap">
                        {fila.fechaComprobante}
                      </td>
                      <td className="border border-border-main px-3 py-1.5 text-text-main text-right whitespace-nowrap">
                        {fila.monto !== null ? `S/. ${fila.monto.toFixed(2)}` : '—'}
                      </td>
                      <td className={`border border-border-main px-3 py-1.5 whitespace-nowrap ${colorEstado(fila.estado)}`}>
                        {fila.estado}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Logo institucional */}
      <div className="bg-white border border-border-main rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-text-main">Logo institucional (CIP)</h3>
            <p className="text-sm text-text-sec mt-1">
              Se incrusta en los reportes Excel y PDF. Formatos: PNG, JPG o WEBP, máximo 300 KB.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={descargarLogo}
              disabled={!logo}
              className="px-4 py-2 border border-border-main text-text-main text-sm font-medium rounded-lg hover:bg-bg-layout transition-colors disabled:opacity-50"
            >
              Descargar logo
            </button>
            {esAdmin && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
              >
                Subir logo
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:${logo.mimeType};base64,${logo.contenido}`}
              alt="Logo CIP actual"
              className="h-16 w-auto border border-border-main rounded p-1 bg-white"
            />
          ) : (
            <div className="h-16 w-32 border border-dashed border-border-main rounded flex items-center justify-center text-xs text-text-sec">
              Sin logo
            </div>
          )}
          <span className="text-xs text-text-sec">{logo ? logo.filename : ''}</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onArchivoLogo}
        />
      </div>
    </div>
  );
}
