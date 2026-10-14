import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpedienteSlaService {
  constructor(private prisma: PrismaService) {}

  async listar(activos?: boolean) {
    return this.prisma.expedienteSlaConfig.findMany({
      where: activos !== undefined ? { activo: activos } : {},
      orderBy: { ordenFlujo: 'asc' },
    });
  }

  async obtenerPorEstado(estado: string) {
    return this.prisma.expedienteSlaConfig.findUnique({
      where: { estado: estado.toUpperCase() },
    });
  }

  async crear(data: { estado: string; nombreVisible: string; horasLimite: number; colorBadge?: string; ordenFlujo?: number }) {
    const existente = await this.prisma.expedienteSlaConfig.findUnique({
      where: { estado: data.estado.toUpperCase() },
    });
    if (existente) throw new BadRequestException(`Ya existe configuración para el estado ${data.estado}`);
    return this.prisma.expedienteSlaConfig.create({
      data: {
        estado: data.estado.toUpperCase(),
        nombreVisible: data.nombreVisible,
        horasLimite: data.horasLimite,
        colorBadge: data.colorBadge || 'gray',
        ordenFlujo: data.ordenFlujo || 0,
      },
    });
  }

  async actualizar(id: number, data: { nombreVisible?: string; horasLimite?: number; colorBadge?: string; ordenFlujo?: number; activo?: boolean }) {
    const config = await this.prisma.expedienteSlaConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Configuración SLA no encontrada');
    return this.prisma.expedienteSlaConfig.update({
      where: { id },
      data: {
        ...(data.nombreVisible !== undefined && { nombreVisible: data.nombreVisible }),
        ...(data.horasLimite !== undefined && { horasLimite: data.horasLimite }),
        ...(data.colorBadge !== undefined && { colorBadge: data.colorBadge }),
        ...(data.ordenFlujo !== undefined && { ordenFlujo: data.ordenFlujo }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
    });
  }

  async eliminar(id: number) {
    const config = await this.prisma.expedienteSlaConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Configuración SLA no encontrada');
    return this.prisma.expedienteSlaConfig.delete({ where: { id } });
  }

  async getResumenDashboard(userId: string, userRol: string) {
    const ahora = new Date();

    const [total, porEstado, porTipo, sinAsignar] = await Promise.all([
      this.prisma.famSolicitudBeneficio.count({ where: { estado: { notIn: ['PAGADA', 'RECHAZADA'] } } }),
      this.prisma.famSolicitudBeneficio.groupBy({ by: ['estado'], _count: true, where: { estado: { notIn: ['PAGADA', 'RECHAZADA'] } } }),
      this.prisma.famSolicitudBeneficio.groupBy({ by: ['tipoBeneficioId'], _count: true }),
      this.prisma.famSolicitudBeneficio.count({ where: { estado: 'PENDIENTE' } }),
    ]);

    const configSla = await this.prisma.expedienteSlaConfig.findMany({ where: { activo: true } });
    const mapaSla = new Map(configSla.map((c) => [c.estado, c.horasLimite]));

    const proximosAVencer = await this.prisma.famSolicitudBeneficio.findMany({
      where: { estado: { in: ['PENDIENTE', 'EN_REVISION', 'APROBADA'] } },
      include: { tipoBeneficio: true },
      orderBy: { createdAt: 'asc' },
    });

    let vencidos = 0;
    let porVencer = 0;
    proximosAVencer.forEach((exp) => {
      const horasLimite = mapaSla.get(exp.estado) || 72;
      if (horasLimite <= 0) return;
      const horasTranscurridas = (ahora.getTime() - new Date(exp.createdAt).getTime()) / (1000 * 60 * 60);
      const horasRestantes = horasLimite - horasTranscurridas;
      if (horasRestantes <= 0) vencidos++;
      else if (horasRestantes <= 12) porVencer++;
    });

    const mapaTipos = new Map<string, { nombre: string; count: number }>();
    const tipos = await this.prisma.tipoBeneficio.findMany({ where: { programa: 'FAM' } });
    tipos.forEach((t) => mapaTipos.set(t.id, { nombre: t.nombre, count: 0 }));
    porTipo.forEach((pt) => {
      const info = mapaTipos.get(pt.tipoBeneficioId);
      if (info) info.count = pt._count;
    });

    return {
      misTendientes: userRol === 'ADMINISTRADOR' ? total : porEstado.reduce((s, e) => s + e._count, 0),
      sinAsignar,
      proximosAVencer: vencidos + porVencer,
      vencidos,
      porTipo: Array.from(mapaTipos.values()),
    };
  }

  async getTrazabilidad(expedienteId: string) {
    const logs = await (this.prisma as any).auditLog.findMany({
      where: {
        entity: { in: ['fam_registro', 'fam_beneficio'] },
        entityId: expedienteId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Resolver UUIDs de usuarios a usernames
    const userIds = [...new Set(logs.map((l: any) => l.userId).filter((id: string) => id && !['system', 'Sistema'].includes(id)))];
    const userMap: Record<string, string> = {};
    if (userIds.length > 0) {
      try {
        const usuarios = await (this.prisma as any).usuario.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, nombreCompleto: true },
        });
        for (const u of usuarios) {
          userMap[u.id] = u.nombreCompleto || u.username;
        }
      } catch {}
    }

    return logs.map((log: any) => {
      let mensaje = '';
      const changes = log.changesJson ? JSON.parse(log.changesJson) : {};
      const userName = changes.userName || userMap[log.userId] || log.userId || 'Sistema';

      switch (log.action) {
        case 'CREATE':
          mensaje = `${userName} creó el expediente`;
          break;
        case 'UPDATE':
          if (changes.old?.estado && changes.new?.estado) {
            mensaje = `${userName} cambió estado de "${changes.old.estado}" a "${changes.new.estado}"`;
          } else if (changes.campo) {
            mensaje = `${userName} actualizó ${changes.campo}`;
          } else {
            mensaje = `${userName} actualizó el expediente`;
          }
          break;
        case 'DELETE':
          mensaje = `${userName} eliminó el expediente`;
          break;
        default:
          mensaje = `${userName} realizó una acción (${log.action})`;
      }

      return {
        id: log.id,
        accion: log.action,
        mensaje,
        usuario: userName,
        fecha: log.createdAt,
        detalles: changes,
      };
    });
  }
}
