import { Injectable } from '@nestjs/common';
import { LegacyService } from '../legacy/legacy.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ColegiadosService {
  constructor(
    private legacyService: LegacyService,
    private prisma: PrismaService,
  ) {}

  async search(params: { search?: string; page?: number; limit?: number }) {
    return this.legacyService.searchColegiados(params);
  }

  async getById(id: string) {
    const colegiado = await this.legacyService.getColegiadoById(id);
    let beneficios: any[] = [];
    let pagos: any[] = [];

    if (this.prisma.databaseAvailable) {
      try {
        beneficios = await this.prisma.solicitudBeneficio.findMany({
          where: { colegiadoId: String(id) },
          include: { beneficio: true },
          orderBy: { fechaSolicitud: 'desc' },
          take: 10,
        });

        pagos = await this.prisma.pago.findMany({
          where: { colegiadoId: String(id) },
          orderBy: { fechaPago: 'desc' },
          take: 10,
        });
      } catch {
        beneficios = [];
        pagos = [];
      }
    }

    return {
      ...colegiado,
      beneficios,
      pagos,
    };
  }

  async getResumen(colegiadoId: string) {
    if (!this.prisma.databaseAvailable) {
      return {
        colegiadoId,
        totalSolicitudes: 0,
        solicitudesPendientes: 0,
        solicitudesAprobadas: 0,
        montoTotalPagado: 0,
      };
    }

    try {
      const [totalSolicitudes, solicitudesPendientes, solicitudesAprobadas, montoTotalPagado] =
        await Promise.all([
          this.prisma.solicitudBeneficio.count({ where: { colegiadoId } }),
          this.prisma.solicitudBeneficio.count({
            where: { colegiadoId, estado: 'PENDIENTE' },
          }),
          this.prisma.solicitudBeneficio.count({
            where: { colegiadoId, estado: 'APROBADA' },
          }),
          this.prisma.pago.aggregate({
            where: { colegiadoId, estado: 'COMPLETADO' },
            _sum: { montoPagado: true },
          }),
        ]);

      return {
        colegiadoId,
        totalSolicitudes,
        solicitudesPendientes,
        solicitudesAprobadas,
        montoTotalPagado: montoTotalPagado._sum.montoPagado || 0,
      };
    } catch {
      return {
        colegiadoId,
        totalSolicitudes: 0,
        solicitudesPendientes: 0,
        solicitudesAprobadas: 0,
        montoTotalPagado: 0,
      };
    }
  }
}
