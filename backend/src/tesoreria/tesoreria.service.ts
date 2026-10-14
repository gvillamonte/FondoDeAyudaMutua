import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LegacyService } from '../legacy/legacy.service';

export interface FraccionamientoResponse {
  colegiado: {
    id: string;
    cip: string;
    dni: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    nombreCompleto: string;
    estadoColegiatura: string;
    habilitado: boolean;
    fechaUltimoPago: string | null;
    fechaHabilitado: string | null;
    capitulo: string;
    telefono: string;
    email: string;
    direccion: string;
    fechaIngreso: string | null;
  };
  cuotas: {
    cuotaId: string;
    anio: number;
    mes: number;
    monto: number;
    estadoPago: string;
    fechaVencimiento: string | null;
    fechaPago: string | null;
    comprobante: string;
    observaciones: string;
  }[];
  resumenDeuda: {
    mesInicialDeuda: string;
    mesFinalDeuda: string;
    totalCuotasPendientes: number;
    deudaPorAportes: number;
    deudaPorMultas: number;
    deudaTotal: number;
    fechaUltimoPago: string | null;
    fechaHabilitado: string | null;
  };
}

@Injectable()
export class TesoreriaService {
  private readonly logger = new Logger(TesoreriaService.name);

  constructor(private legacyService: LegacyService) {}

  async getDatosFraccionamiento(colegiadoId: string): Promise<FraccionamientoResponse> {
    if (!this.legacyService.databaseAvailable) {
      throw new NotFoundException('Base de datos no disponible');
    }

    const colegiado = await this.legacyService.getColegiadoById(colegiadoId);
    const cuotasRaw = await this.legacyService.getCuotasColegiado(colegiadoId);

    const cuotas = cuotasRaw.map((c: any) => ({
      cuotaId: String(c.CUOTA_ID),
      anio: Number(c.ANIO),
      mes: Number(c.MES),
      monto: Number(c.MONTO),
      estadoPago: c.ESTADO_PAGO,
      fechaVencimiento: c.FECHA_VENCIMIENTO
        ? new Date(c.FECHA_VENCIMIENTO).toISOString()
        : null,
      fechaPago: c.FECHA_PAGO ? new Date(c.FECHA_PAGO).toISOString() : null,
      comprobante: c.COMPROBANTE || '',
      observaciones: c.OBSERVACIONES || '',
    }));

    const cuotasPendientes = cuotas.filter((c) => c.estadoPago === 'PENDIENTE');
    const cuotasPagadas = cuotas.filter((c) => c.estadoPago === 'PAGADO');

    let mesInicialDeuda = '';
    let mesFinalDeuda = '';

    if (cuotasPendientes.length > 0) {
      const ordenadas = [...cuotasPendientes].sort(
        (a, b) => a.anio * 100 + a.mes - (b.anio * 100 + b.mes),
      );
      const primera = ordenadas[0];
      const ultima = ordenadas[ordenadas.length - 1];
      mesInicialDeuda = `${String(primera.mes).padStart(2, '0')}-${primera.anio}`;
      mesFinalDeuda = `${String(ultima.mes).padStart(2, '0')}-${ultima.anio}`;
    }

    const deudaPorAportes = cuotasPendientes.reduce((sum, c) => sum + c.monto, 0);
    const deudaPorMultas = 0;
    const deudaTotal = deudaPorAportes + deudaPorMultas;

    const nombreCompleto = `${colegiado.APELLIDO_PATERNO} ${colegiado.APELLIDO_MATERNO || ''}, ${colegiado.NOMBRES}`.trim();

    return {
      colegiado: {
        id: String(colegiado.COLEGIADO_ID),
        cip: colegiado.NUM_COLEGIATURA,
        dni: colegiado.DNI,
        nombres: colegiado.NOMBRES,
        apellidoPaterno: colegiado.APELLIDO_PATERNO,
        apellidoMaterno: colegiado.APELLIDO_MATERNO || '',
        nombreCompleto,
        estadoColegiatura: colegiado.ESTADO_COLEGIATURA,
        habilitado: Number(colegiado.HABILITADO) === 1,
        fechaUltimoPago: colegiado.FECHA_ULTIMO_PAGO
          ? new Date(colegiado.FECHA_ULTIMO_PAGO).toISOString()
          : null,
        fechaHabilitado: colegiado.FECHA_HABILITADO
          ? new Date(colegiado.FECHA_HABILITADO).toISOString()
          : null,
        capitulo: colegiado.ESPECIALIDAD || '',
        telefono: colegiado.TELEFONO || '',
        email: colegiado.EMAIL || '',
        direccion: colegiado.DIRECCION || '',
        fechaIngreso: colegiado.FECHA_INGRESO
          ? new Date(colegiado.FECHA_INGRESO).toISOString()
          : null,
      },
      cuotas,
      resumenDeuda: {
        mesInicialDeuda,
        mesFinalDeuda,
        totalCuotasPendientes: cuotasPendientes.length,
        deudaPorAportes: Number(deudaPorAportes.toFixed(2)),
        deudaPorMultas: Number(deudaPorMultas.toFixed(2)),
        deudaTotal: Number(deudaTotal.toFixed(2)),
        fechaUltimoPago: colegiado.FECHA_ULTIMO_PAGO
          ? new Date(colegiado.FECHA_ULTIMO_PAGO).toISOString()
          : null,
        fechaHabilitado: colegiado.FECHA_HABILITADO
          ? new Date(colegiado.FECHA_HABILITADO).toISOString()
          : null,
      },
    };
  }

  async searchColegiadosForFraccionamiento(search: string) {
    return this.legacyService.searchColegiados({
      search,
      page: 1,
      limit: 10,
    });
  }

  async debugTableColumns(tableName: string) {
    return this.legacyService.getTableColumns(tableName);
  }

  async debugSearchColumns(keyword: string) {
    return this.legacyService.debugSearchColumns(keyword);
  }
}
