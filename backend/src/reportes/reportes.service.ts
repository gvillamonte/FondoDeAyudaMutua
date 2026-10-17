import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import * as ExcelJS from 'exceljs';
import * as JSZip from 'jszip';
import { randomUUID } from 'crypto';
import { LegacyService } from '../legacy/legacy.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubirLogoDto } from './dto/reportes.dto';

export interface FilaEstadoHabilidad {
  nota: string;
  fechaAporte: string;
  comprobante: string;
  fechaComprobante: string;
  monto: number | null;
  estado: string;
}

export interface ReporteEstadosHabilidad {
  cabecera: {
    colegiadoId: string;
    nroCip: string;
    capitulo: string;
    especialidad: string;
    fechaIncorporacion: string;
    nombres: string;
    fechaReporte: string;
  };
  filas: FilaEstadoHabilidad[];
}

export interface LogoInfo {
  mimeType: string;
  filename: string;
  contenido: string;
  updatedAt: string | null;
}

interface RowCalendario {
  MES: any;
  MONTO: any;
  ESTADO_CAL: any;
  FECHA_PAGO: any;
  SERIE: any;
  CORRELATIVO: any;
  FECHA_VENTA: any;
}

interface RowMensual {
  MES: any;
  HABILITADO: any;
}

interface EventoPago {
  fecha: Date;
  mes: string;
}

const SIN_COMPROBANTE = 'No se registra comprobante';
const SIN_INFORMACION = 'Sin información';
const RAYA = '—';

@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);

  constructor(
    private legacyService: LegacyService,
    private prisma: PrismaService,
  ) {}

  // ---------------------------------------------------------------
  // Utilidades de formato
  // ---------------------------------------------------------------

  private toDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const d = value instanceof Date ? value : new Date(value as any);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Formatea una fecha datetime del legado (dd/MM/yyyy) usando componentes UTC (evita desfase de zona horaria). */
  private fmtFecha(value: unknown): string {
    const d = this.toDate(value);
    if (!d) return RAYA;
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }

  /** Clave 'YYYY-MM' a partir de un datetime del legado. */
  private ymUTC(value: unknown): string | null {
    const d = this.toDate(value);
    if (!d) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** Clave 'YYYY-MM' del mes local actual. */
  private ymLocal(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Suma meses a una clave 'YYYY-MM'. */
  private ymAdd(ym: string, months: number): string {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + months, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** Lista de claves 'YYYY-MM' desde inicio hasta fin (inclusive). */
  private listarMeses(inicio: string, fin: string): string[] {
    const meses: string[] = [];
    let actual = inicio;
    let guard = 0;
    while (actual <= fin && guard < 1200) {
      meses.push(actual);
      actual = this.ymAdd(actual, 1);
      guard++;
    }
    return meses;
  }

  /** Normaliza un periodo 'desde' (YYYY-MM o YYYY-MM-DD) a clave 'YYYY-MM'. */
  private normalizarDesde(desde?: string): string | null {
    if (!desde) return null;
    const match = /^(\d{4})(?:-(\d{2}))?/.exec(desde.trim());
    if (!match) return null;
    return `${match[1]}-${match[2] || '01'}`;
  }

  private fmtFechaLocal(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${date.getFullYear()}`;
  }

  private fmtFechaHoraLocal(date: Date): string {
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${this.fmtFechaLocal(date)} ${hh}:${mi}`;
  }

  // ---------------------------------------------------------------
  // Logo del CIP (APP_DB - fam_configuracion)
  // ---------------------------------------------------------------

  async getLogo(): Promise<LogoInfo | null> {
    if (!this.prisma.databaseAvailable) return null;
    try {
      const cfg = await this.prisma.famConfiguracion.findUnique({
        where: { clave: 'LOGO_CIP' },
      });
      if (!cfg || !cfg.valor) return null;
      const parsed = JSON.parse(cfg.valor);
      if (!parsed || !parsed.data) return null;
      return {
        mimeType: parsed.mime || 'image/png',
        filename: parsed.filename || 'logo-cip.png',
        contenido: parsed.data,
        updatedAt: cfg.updatedAt ? cfg.updatedAt.toISOString() : null,
      };
    } catch (error: any) {
      this.logger.error(`Error leyendo LOGO_CIP: ${error.message}`);
      return null;
    }
  }

  async subirLogo(dto: SubirLogoDto, username: string) {
    if (!this.prisma.databaseAvailable) {
      throw new BadRequestException('Base de datos de la aplicacion no disponible');
    }

    const base64 = dto.contenido.includes(',')
      ? dto.contenido.substring(dto.contenido.indexOf(',') + 1)
      : dto.contenido;

    // ~300 KB en binario
    if (base64.length > 400000) {
      throw new BadRequestException('La imagen no debe superar los 300 KB');
    }

    const inicio = base64.substring(0, 12);
    const esPng = inicio.startsWith('iVBORw0KGgo');
    const esJpg = inicio.startsWith('/9j/');
    const esWebp = inicio.startsWith('UklGR');
    if (
      (dto.mimeType === 'image/png' && !esPng) ||
      (dto.mimeType === 'image/jpeg' && !esJpg) ||
      (dto.mimeType === 'image/webp' && !esWebp)
    ) {
      throw new BadRequestException('El contenido no coincide con el formato declarado');
    }

    const payload = JSON.stringify({
      mime: dto.mimeType,
      filename: dto.filename,
      data: base64,
      uploadedAt: new Date().toISOString(),
      uploadedBy: username,
    });

    await this.prisma.famConfiguracion.upsert({
      where: { clave: 'LOGO_CIP' },
      update: { valor: payload },
      create: {
        id: randomUUID(),
        clave: 'LOGO_CIP',
        valor: payload,
        grupo: 'GENERAL',
        descripcion: 'Logo institucional del CIP para reportes (base64)',
        activo: true,
      },
    });

    this.logger.log(`Logo del CIP actualizado por ${username} (${dto.filename})`);
    return { ok: true, filename: dto.filename };
  }

  // ---------------------------------------------------------------
  // Reporte: Estados de Habilidad
  // ---------------------------------------------------------------

  async getEstadosHabilidad(cip: string, desde?: string): Promise<ReporteEstadosHabilidad> {
    const { cabecera, filas } = await this.construirReporte(cip, desde);
    return { cabecera, filas };
  }

  private async construirReporte(
    cip: string,
    desde?: string,
  ): Promise<ReporteEstadosHabilidad> {
    if (!this.legacyService.databaseAvailable) {
      throw new NotFoundException('Base de datos legado no disponible');
    }

    const colegiado = await this.legacyService.getColegiadoByNumero(cip.trim());
    const colegiadoId = Number(colegiado.COLEGIADO_ID);

    // --- Cabecera: capitulo (TCapitulo) y especialidad (titulo profesional) ---
    const capitulo = String(colegiado.ESPECIALIDAD || '').trim();
    const especialidad = await this.obtenerEspecialidad(colegiadoId, colegiado.NUM_COLEGIATURA);

    const fechaIncorporacion =
      this.fmtFecha(colegiado.FECHA_INGRESO) !== RAYA
        ? this.fmtFecha(colegiado.FECHA_INGRESO)
        : RAYA;

    const nombres = [
      colegiado.APELLIDO_PATERNO || '',
      colegiado.APELLIDO_MATERNO || '',
      colegiado.NOMBRES || '',
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // --- Datos mensuales ---
    const [calendario, mensual] = await Promise.all([
      this.obtenerCalendario(colegiadoId),
      this.obtenerMensual(colegiadoId),
    ]);

    const calendarioPorMes = new Map<string, RowCalendario>();
    // En meses duplicados, preferir la fila con estado '1' (paga) que lleva comprobante
    const prioridadCalendario = (row: RowCalendario) =>
      String(row.ESTADO_CAL) === '1' ? 2 : 1;
    for (const row of calendario) {
      const key = this.ymUTC(row.MES);
      if (!key) continue;
      const existente = calendarioPorMes.get(key);
      if (!existente || prioridadCalendario(row) > prioridadCalendario(existente)) {
        calendarioPorMes.set(key, row);
      }
    }

    const mensualPorMes = new Map<string, boolean>();
    for (const row of mensual) {
      const key = this.ymUTC(row.MES);
      if (key) mensualPorMes.set(key, Number(row.HABILITADO) === 1);
    }

    // Eventos de pago para la regla de 3 meses (mismo criterio que spu_Rep_ColegiadosHabilitados)
    const eventos: EventoPago[] = [];
    for (const row of calendario) {
      const estadoCal = String(row.ESTADO_CAL ?? '');
      const mes = this.ymUTC(row.MES);
      const fecha = this.toDate(row.FECHA_PAGO) || this.toDate(row.FECHA_VENTA);
      if (estadoCal === '1' && mes && fecha) {
        eventos.push({ fecha, mes });
      }
    }
    eventos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    // Rango de meses: desde la incorporacion hasta el mes anterior al mes de reporte.
    // Si se indica periodo 'desde', el inicio pasa a ser el mayor entre incorporacion y 'desde'.
    const ahora = new Date();
    const mesReporte = this.ymLocal(ahora);
    const mesFin = this.ymAdd(mesReporte, -1);
    let mesInicio = this.ymUTC(colegiado.FECHA_INGRESO) || mesReporte;
    const desdeMes = this.normalizarDesde(desde);
    if (desdeMes && desdeMes > mesInicio) {
      mesInicio = desdeMes;
    }

    const mesesDisponibles = [...new Set([...calendarioPorMes.keys(), ...mensualPorMes.keys()])].sort();
    const primeraData = mesesDisponibles.length ? mesesDisponibles[0] : null;

    const filas: FilaEstadoHabilidad[] = [];
    let prevHab: boolean | null = null;

    for (const mes of this.listarMeses(mesInicio, mesFin)) {
      // Meses anteriores a los datos disponibles en la BD
      if (!primeraData || mes < primeraData) {
        filas.push({
          nota: '',
          fechaAporte: mes,
          comprobante: SIN_COMPROBANTE,
          fechaComprobante: RAYA,
          monto: null,
          estado: SIN_INFORMACION,
        });
        prevHab = null;
        continue;
      }

      const cal = calendarioPorMes.get(mes);
      const venta = cal ? this.toDate(cal.FECHA_VENTA) : null;
      const serie = cal && cal.SERIE ? String(cal.SERIE).trim() : '';
      const correlativo = cal && cal.CORRELATIVO ? String(cal.CORRELATIVO).trim() : '';
      const tieneVenta = !!venta && (serie !== '' || correlativo !== '');
      const monto = cal && cal.MONTO !== null && cal.MONTO !== undefined ? Number(cal.MONTO) : null;

      // --- Estado del mes ---
      let hab: boolean;
      const snapshot = mensualPorMes.get(mes);
      if (snapshot !== undefined) {
        hab = snapshot;
      } else {
        const porRegla = this.reglaTresMeses(eventos, mes);
        if (porRegla !== undefined) {
          hab = porRegla;
        } else {
          hab = prevHab === true;
        }
      }

      let nota = '';
      let estado: string;
      if (hab) {
        if (prevHab === false && venta && this.ymUTC(venta) === mes) {
          const dia = venta.getUTCDate();
          if (dia > 1) {
            nota = `No Habilitado del 01 al ${String(dia - 1).padStart(2, '0')}`;
          }
          estado = `Habilitado desde el ${this.fmtFecha(venta)}`;
        } else {
          estado = 'Habilitado';
        }
      } else {
        estado = 'No Habilitado';
      }
      prevHab = hab;

      filas.push({
        nota,
        fechaAporte: mes,
        comprobante: tieneVenta ? `${serie}${serie && correlativo ? '-' : ''}${correlativo}` : SIN_COMPROBANTE,
        fechaComprobante: tieneVenta ? this.fmtFecha(venta) : RAYA,
        monto,
        estado,
      });
    }

    return {
      cabecera: {
        colegiadoId: String(colegiado.COLEGIADO_ID),
        nroCip: String(colegiado.NUM_COLEGIATURA || ''),
        capitulo,
        especialidad,
        fechaIncorporacion,
        nombres,
        fechaReporte: this.fmtFechaHoraLocal(ahora),
      },
      filas,
    };
  }

  /**
   * Regla oficial de habilitacion (misma formula que spu_Rep_ColegiadosHabilitados):
   * un mes M esta habilitado si el ultimo mes pagado conocido a fin de M + 3 meses >= M.
   * Devuelve undefined cuando no hay eventos de pago previos a M.
   */
  private reglaTresMeses(eventos: EventoPago[], mes: string): boolean | undefined {
    const [anio, mesNum] = mes.split('-').map(Number);
    const finDeMes = new Date(Date.UTC(anio, mesNum, 0)); // ultimo dia del mes M
    let ultimoMesPagado: string | null = null;
    for (const ev of eventos) {
      if (ev.fecha.getTime() <= finDeMes.getTime()) {
        if (!ultimoMesPagado || ev.mes > ultimoMesPagado) {
          ultimoMesPagado = ev.mes;
        }
      }
    }
    if (!ultimoMesPagado) return undefined;
    return this.ymAdd(ultimoMesPagado, 3) >= mes;
  }

  private async obtenerEspecialidad(colegiadoId: number, cip: string): Promise<string> {
    const rows = await this.legacyService.runReadOnlyQuery(
      `SELECT TOP 1 cc.cDenominacionTituloProfesional AS ESPECIALIDAD
       FROM TColegiadoCapitulo cc
       WHERE cc.nIdColegiado = @id
       ORDER BY ISNULL(cc.dFechaIncorporacionACIP, '1900-01-01') DESC, cc.nIdColegiadoCapitulo DESC`,
      [{ name: 'id', type: sql.Int, value: colegiadoId }],
    );
    const titulo = rows.length ? String(rows[0].ESPECIALIDAD || '').trim() : '';
    if (titulo) return titulo;

    const cert = await this.legacyService.runReadOnlyQuery(
      `SELECT TOP 1 cEspecialidad AS ESPECIALIDAD
       FROM TCertificadoHabilidad
       WHERE cCodigoCIP = @cip
         AND cEspecialidad IS NOT NULL
         AND cEspecialidad <> ''
       ORDER BY dFechaEmision DESC`,
      [{ name: 'cip', type: sql.VarChar, value: String(cip) }],
    );
    return cert.length ? String(cert[0].ESPECIALIDAD || '').trim() : '';
  }

  private async obtenerCalendario(colegiadoId: number): Promise<RowCalendario[]> {
    return this.legacyService.runReadOnlyQuery<RowCalendario>(
      `SELECT
         cp.dMesAportacion       AS MES,
         cp.nMonto               AS MONTO,
         cp.cConsValorEstado     AS ESTADO_CAL,
         cp.dFechaPago           AS FECHA_PAGO,
         v.cNroSerie             AS SERIE,
         v.cNroCorrelativo       AS CORRELATIVO,
         v.dFechaVenta           AS FECHA_VENTA
       FROM TCalendarioPagos cp
       LEFT JOIN TVenta v ON cp.nIdVenta = v.nIdVenta
       WHERE cp.nIdColegiado = @id
       ORDER BY cp.dMesAportacion`,
      [{ name: 'id', type: sql.Int, value: colegiadoId }],
    );
  }

  private async obtenerMensual(colegiadoId: number): Promise<RowMensual[]> {
    return this.legacyService.runReadOnlyQuery<RowMensual>(
      `SELECT MES, HABILITADO FROM (
         SELECT
           m.dFechaMensual AS MES,
           m.bHabilitado   AS HABILITADO,
           ROW_NUMBER() OVER (
             PARTITION BY FORMAT(m.dFechaMensual, 'yyyy-MM')
             ORDER BY m.nId DESC
           ) AS RN
         FROM TColegiadoMensual m
         WHERE m.nIdColegiado = @id
       ) t
       WHERE t.RN = 1
       ORDER BY t.MES`,
      [{ name: 'id', type: sql.Int, value: colegiadoId }],
    );
  }

  // ---------------------------------------------------------------
  // Exportacion Excel (exceljs)
  // ---------------------------------------------------------------

  /** Construye el workbook completo del reporte (reutilizado por descarga individual y lote). */
  private async crearWorkbookReporte(
    cip: string,
    logo: LogoInfo | null,
    desde?: string,
  ): Promise<{ workbook: ExcelJS.Workbook; cabecera: ReporteEstadosHabilidad['cabecera'] }> {
    const { cabecera, filas } = await this.construirReporte(cip, desde);

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Estados de Habilidad');

    const borders = {
      top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    };

    ws.getColumn(1).width = 27; // Nota
    ws.getColumn(2).width = 13; // Fecha Aporte
    ws.getColumn(3).width = 24; // Comprobante
    ws.getColumn(4).width = 18; // Fecha Comprobante
    ws.getColumn(5).width = 14; // Monto
    ws.getColumn(6).width = 34; // Estado

    // --- Fila 1: logo + titulo ---
    ws.getRow(1).height = 58;
    const soloLogo =
      logo && (logo.mimeType === 'image/png' || logo.mimeType === 'image/jpeg');
    if (soloLogo && logo) {
      try {
        const imageId = workbook.addImage({
          buffer: Buffer.from(logo.contenido, 'base64') as any,
          extension: logo.mimeType === 'image/png' ? 'png' : 'jpeg',
        });
        ws.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 74, height: 66 },
        });
      } catch (error: any) {
        this.logger.warn(`No se pudo incrustar el logo en Excel: ${error.message}`);
      }
    }

    const titulo = ws.getCell('A1');
    titulo.value = 'RESUMEN DE APORTES Y SERVICIOS';
    titulo.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E293B' } };
    titulo.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.mergeCells(soloLogo ? 'B1:F1' : 'A1:F1');

    // --- Filas 3-6: encabezado del reporte (estilo formulario) ---
    const labelStyle: PartialExcelJS.CellStyle = {
      font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
      alignment: { vertical: 'middle', horizontal: 'left' },
      border: borders,
    };
    const valueStyle: PartialExcelJS.CellStyle = {
      font: { name: 'Calibri', size: 11, color: { argb: 'FF1E293B' } },
      alignment: { vertical: 'middle', horizontal: 'left' },
      border: borders,
    };

    const bloques: { rangoLabel: string; rangoValor: string; label: string; valor: string }[][] = [
      [
        { rangoLabel: 'A3:B3', rangoValor: 'A4:B4', label: 'Nro Cip:', valor: cabecera.nroCip },
        { rangoLabel: 'C3:D3', rangoValor: 'C4:D4', label: 'Capitulo:', valor: cabecera.capitulo },
        { rangoLabel: 'E3:F3', rangoValor: 'E4:F4', label: 'Fecha Incorporacion:', valor: cabecera.fechaIncorporacion },
      ],
      [
        { rangoLabel: 'A5:B5', rangoValor: 'A6:B6', label: 'Nombres y Apellidos:', valor: cabecera.nombres },
        { rangoLabel: 'C5:D5', rangoValor: 'C6:D6', label: 'Especialidad', valor: cabecera.especialidad },
        { rangoLabel: 'E5:F5', rangoValor: 'E6:F6', label: 'Fecha Reporte:', valor: cabecera.fechaReporte },
      ],
    ];

    for (const filaBloques of bloques) {
      for (const bloque of filaBloques) {
        const labelCell = ws.getCell(bloque.rangoLabel.split(':')[0]);
        ws.mergeCells(bloque.rangoLabel);
        labelCell.value = bloque.label;
        labelCell.style = labelStyle as ExcelJS.Style;

        const valorCell = ws.getCell(bloque.rangoValor.split(':')[0]);
        ws.mergeCells(bloque.rangoValor);
        valorCell.value = bloque.valor;
        valorCell.style = valueStyle as ExcelJS.Style;
      }
    }
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 18;
    ws.getRow(5).height = 18;
    ws.getRow(6).height = 18;
    ws.getRow(7).height = 8;

    // --- Fila 8: cabecera de la tabla ---
    const encabezados = [
      'Nota',
      'Fecha Aporte',
      'Comprobante',
      'Fecha Comprobante',
      'Monto',
      'Estado',
    ];
    const headerRow = ws.getRow(8);
    encabezados.forEach((texto, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = texto;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3258CA' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = borders;
    });
    headerRow.height = 22;

    // --- Filas de datos ---
    filas.forEach((fila, index) => {
      const row = ws.getRow(9 + index);
      const esTransicion = fila.nota !== '';

      const notaCell = row.getCell(1);
      notaCell.value = fila.nota || null;
      notaCell.alignment = { vertical: 'middle', horizontal: 'left' };
      notaCell.font = { name: 'Calibri', size: 10, color: { argb: 'FFD97706' } };

      const mesCell = row.getCell(2);
      mesCell.value = fila.fechaAporte;
      mesCell.alignment = { vertical: 'middle', horizontal: 'center' };
      mesCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

      const comprobanteCell = row.getCell(3);
      comprobanteCell.value = fila.comprobante;
      comprobanteCell.alignment = { vertical: 'middle', horizontal: 'center' };
      comprobanteCell.font = {
        name: 'Calibri',
        size: 10,
        color: {
          argb:
            fila.comprobante === SIN_COMPROBANTE
              ? 'FF64748B'
              : 'FF1E293B',
        },
      };

      const fechaCell = row.getCell(4);
      fechaCell.value = fila.fechaComprobante;
      fechaCell.alignment = { vertical: 'middle', horizontal: 'center' };
      fechaCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

      const montoCell = row.getCell(5);
      if (fila.monto !== null) {
        montoCell.value = fila.monto;
        montoCell.numFmt = '"S/." #,##0.00';
      } else {
        montoCell.value = RAYA;
      }
      montoCell.alignment = { vertical: 'middle', horizontal: 'right' };
      montoCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

      const estadoCell = row.getCell(6);
      estadoCell.value = fila.estado;
      estadoCell.alignment = { vertical: 'middle', horizontal: 'left' };
      let colorEstado = 'FF64748B';
      if (fila.estado.startsWith('No Habilitado')) colorEstado = 'FFDC2626';
      else if (fila.estado.startsWith('Habilitado')) colorEstado = 'FF16A34A';
      estadoCell.font = {
        name: 'Calibri',
        size: 10,
        bold: esTransicion,
        color: { argb: colorEstado },
      };

      for (let c = 1; c <= 6; c++) {
        row.getCell(c).border = borders;
      }
      row.height = 16;
    });

    // Congelar paneles bajo la cabecera y repetir encabezados al imprimir
    ws.views = [{ state: 'frozen', ySplit: 8 }];
    ws.pageSetup = {
      orientation: 'portrait',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: '1:8',
    };

    return { workbook, cabecera };
  }

  private nombreArchivoReporte(
    cabecera: ReporteEstadosHabilidad['cabecera'],
    cip: string,
    ext: 'xlsx' | 'pdf',
  ): string {
    const nombreArchivo = this.sanitizarNombreArchivo(cabecera.nombres || '');
    const baseArchivo = [cabecera.nroCip || cip, nombreArchivo].filter(Boolean).join('_');
    return `Estado_Habilidad_${baseArchivo}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  async generarExcel(
    cip: string,
    desde?: string,
  ): Promise<{ filename: string; contenido: string }> {
    const logo = await this.getLogo();
    const { workbook, cabecera } = await this.crearWorkbookReporte(cip, logo, desde);
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      filename: this.nombreArchivoReporte(cabecera, cip, 'xlsx'),
      contenido: Buffer.from(buffer).toString('base64'),
    };
  }

  /** ZIP con un Excel por colegiado (descarga en bloque, maximo 20 colegiados). */
  async generarExcelLote(
    cips: string[],
    desde?: string,
  ): Promise<{ filename: string; contenido: string }> {
    const logo = await this.getLogo();
    const zip = new JSZip();
    const unicos = [...new Set(cips.map((c) => String(c).trim()).filter(Boolean))];

    for (const cip of unicos) {
      try {
        const { workbook, cabecera } = await this.crearWorkbookReporte(cip, logo, desde);
        const buffer = await workbook.xlsx.writeBuffer();
        zip.file(this.nombreArchivoReporte(cabecera, cip, 'xlsx'), Buffer.from(buffer));
      } catch (error: any) {
        if (error instanceof NotFoundException) {
          throw new BadRequestException(`El colegiado con N° ${cip} no fue encontrado`);
        }
        throw error;
      }
    }

    const contenido = await zip.generateAsync({ type: 'nodebuffer' });
    const fecha = new Date().toISOString().slice(0, 10);
    return {
      filename: `Estados_Habilidad_Lote_${unicos.length}_colegiados_${fecha}.zip`,
      contenido: contenido.toString('base64'),
    };
  }

  /** Normaliza un nombre para incluirlo en filenames: sin acentos, espacios/simbolos -> '_' */
  private sanitizarNombreArchivo(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60)
      .replace(/_+$/g, '');
  }
}

// Namespace auxiliar para tipar estilos de celda parciales de exceljs
declare namespace PartialExcelJS {
  type CellStyle = Partial<import('exceljs').Style>;
}
