import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CrearSolicitudDto,
  RegistrarPagoDto,
  ResolverSolicitudDto,
  FiltrarPagosDto,
} from './dto/pago.dto';

@Injectable()
export class PagosService {
  constructor(private prisma: PrismaService) {}

  // ========== SOLICITUDES ==========

  async crearSolicitud(dto: CrearSolicitudDto, userId: string) {
    // Verificar que el beneficio existe y está activo
    const beneficio = await this.prisma.beneficio.findUnique({
      where: { id: dto.beneficioId },
    });

    if (!beneficio || !beneficio.activo) {
      throw new NotFoundException('Beneficio no encontrado o inactivo');
    }

    // Verificar solicitudes activas del colegiado (máximo 3)
    const solicitudesActivas = await this.prisma.solicitudBeneficio.count({
      where: {
        colegiadoId: dto.colegiadoId,
        estado: { in: ['PENDIENTE', 'EN_REVISION'] },
      },
    });

    if (solicitudesActivas >= 3) {
      throw new BadRequestException(
        'El colegiado tiene 3 solicitudes activas. Debe esperar a que se resuelvan.',
      );
    }

    // Verificar monto no exceda el base
    const montoBase = Number(beneficio.montoBase);
    if (dto.montoSolicitado > montoBase) {
      throw new BadRequestException(
        `El monto solicitado (${dto.montoSolicitado}) excede el monto base del beneficio (${montoBase})`,
      );
    }

    return this.prisma.solicitudBeneficio.create({
      data: {
        colegiadoId: dto.colegiadoId,
        beneficioId: dto.beneficioId,
        montoSolicitado: dto.montoSolicitado,
        motivo: dto.motivo,
      },
      include: { beneficio: true },
    });
  }

  async findAllSolicitudes(params: {
    page?: number;
    limit?: number;
    estado?: string;
    colegiadoId?: string;
    search?: string;
  }) {
    const { page = 1, limit = 25, estado, colegiadoId, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (estado) where.estado = estado;
    if (colegiadoId) where.colegiadoId = colegiadoId;
    if (search) {
      where.OR = [
        { colegiadoId: { contains: search } },
        { motivo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.solicitudBeneficio.findMany({
        where,
        include: { beneficio: true },
        orderBy: { fechaSolicitud: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.solicitudBeneficio.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async resolverSolicitud(id: string, dto: ResolverSolicitudDto, userId: string) {
    const solicitud = await this.prisma.solicitudBeneficio.findUnique({
      where: { id },
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud ${id} no encontrada`);
    }

    if (!['PENDIENTE', 'EN_REVISION'].includes(solicitud.estado)) {
      throw new BadRequestException(
        `La solicitud no puede ser resuelta. Estado actual: ${solicitud.estado}`,
      );
    }

    return this.prisma.solicitudBeneficio.update({
      where: { id },
      data: {
        estado: dto.estado,
        fechaResolucion: new Date(),
        resueltoPor: userId,
        montoSolicitado: dto.montoAprobado || solicitud.montoSolicitado,
        observaciones: dto.observaciones,
      },
      include: { beneficio: true },
    });
  }

  // ========== PAGOS ==========

  async registrarPago(dto: RegistrarPagoDto, userId: string) {
    const solicitud = await this.prisma.solicitudBeneficio.findUnique({
      where: { id: dto.solicitudId },
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud ${dto.solicitudId} no encontrada`);
    }

    if (solicitud.estado !== 'APROBADA') {
      throw new BadRequestException(
        `La solicitud no está aprobada. Estado actual: ${solicitud.estado}`,
      );
    }

    const montoAprobado = Number(solicitud.montoSolicitado);
    if (dto.montoPagado > montoAprobado) {
      throw new BadRequestException(
        `El monto pagado (${dto.montoPagado}) excede el monto aprobado (${montoAprobado})`,
      );
    }

    const metodoPago = await this.prisma.metodoPago.findUnique({
      where: { id: dto.metodoPagoId },
    });
    if (!metodoPago || !metodoPago.activo) {
      throw new BadRequestException(
        `El método de pago ID ${dto.metodoPagoId} no existe o está inactivo`,
      );
    }
    if (metodoPago.requiereReferencia && !dto.referenciaPago?.trim()) {
      throw new BadRequestException(
        `El método '${metodoPago.nombre}' requiere un número de referencia`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.create({
        data: {
          solicitudId: dto.solicitudId,
          colegiadoId: solicitud.colegiadoId,
          montoPagado: dto.montoPagado,
          medioPago: metodoPago.nombre,
          metodoPagoId: metodoPago.id,
          referenciaPago: dto.referenciaPago,
          notas: dto.notas,
          comprobanteUrl: dto.comprobanteUrl,
          registradoPor: userId,
        },
        include: { metodoPago: true },
      });

      await tx.solicitudBeneficio.update({
        where: { id: dto.solicitudId },
        data: { estado: 'PAGADA' },
      });

      return pago;
    });
  }

  async findAllPagos(params: FiltrarPagosDto) {
    const { colegiadoId, estado, fechaDesde, fechaHasta, page = 1, limit = 25 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (colegiadoId) where.colegiadoId = colegiadoId;
    if (estado) where.estado = estado;
    if (fechaDesde || fechaHasta) {
      where.fechaPago = {};
      if (fechaDesde) where.fechaPago.gte = new Date(fechaDesde);
      if (fechaHasta) where.fechaPago.lte = new Date(fechaHasta);
    }

    const [data, total] = await Promise.all([
      this.prisma.pago.findMany({
        where,
        orderBy: { fechaPago: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pago.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async revertirPago(id: string, userId: string, motivo: string) {
    const pago = await this.prisma.pago.findUnique({ where: { id } });

    if (!pago) {
      throw new NotFoundException(`Pago ${id} no encontrado`);
    }

    if (pago.estado !== 'COMPLETADO') {
      throw new BadRequestException(
        `El pago no puede ser revertido. Estado: ${pago.estado}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const pagoRevertido = await tx.pago.update({
        where: { id },
        data: {
          estado: 'REVERTIDO',
          notas: `${pago.notas || ''}\nRevertido: ${motivo}`.trim(),
        },
      });

      await tx.solicitudBeneficio.update({
        where: { id: pago.solicitudId },
        data: { estado: 'APROBADA' },
      });

      return pagoRevertido;
    });
  }

  // ========== ESTADÍSTICAS ==========

  async getEstadisticas() {
    const [
      totalSolicitudes,
      solicitudesPendientes,
      solicitudesAprobadas,
      solicitudesRechazadas,
      solicitudesPagadas,
      totalPagosCompletados,
      montoTotalPagado,
    ] = await Promise.all([
      this.prisma.solicitudBeneficio.count(),
      this.prisma.solicitudBeneficio.count({ where: { estado: 'PENDIENTE' } }),
      this.prisma.solicitudBeneficio.count({ where: { estado: 'APROBADA' } }),
      this.prisma.solicitudBeneficio.count({ where: { estado: 'RECHAZADA' } }),
      this.prisma.solicitudBeneficio.count({ where: { estado: 'PAGADA' } }),
      this.prisma.pago.count({ where: { estado: 'COMPLETADO' } }),
      this.prisma.pago.aggregate({
        where: { estado: 'COMPLETADO' },
        _sum: { montoPagado: true },
        _avg: { montoPagado: true },
      }),
    ]);

    return {
      solicitudes: {
        total: totalSolicitudes,
        pendientes: solicitudesPendientes,
        aprobadas: solicitudesAprobadas,
        rechazadas: solicitudesRechazadas,
        pagadas: solicitudesPagadas,
      },
      pagos: {
        total: totalPagosCompletados,
        montoTotal: montoTotalPagado._sum.montoPagado || 0,
        promedio: montoTotalPagado._avg.montoPagado || 0,
      },
    };
  }
}
