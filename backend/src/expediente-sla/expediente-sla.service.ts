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

    const [total, porEstado, porTipo, sinAsignar, conSaldoPendienteCount, saldoPendienteAgg, expedientesFinancieros] = await Promise.all([
      this.prisma.famSolicitudBeneficio.count({ where: { estado: { notIn: ['PAGADA', 'RECHAZADA'] } } }),
      this.prisma.famSolicitudBeneficio.groupBy({ by: ['estado'], _count: true, where: { estado: { notIn: ['PAGADA', 'RECHAZADA'] } } }),
      this.prisma.famSolicitudBeneficio.groupBy({ by: ['tipoBeneficioId'], _count: true }),
      this.prisma.famSolicitudBeneficio.count({ where: { estado: 'PENDIENTE' } }),
      this.prisma.famSolicitudBeneficio.count({ where: { tieneSaldoPendiente: true } }),
      this.prisma.famSolicitudBeneficio.aggregate({
        _sum: { saldoPendiente: true },
        where: { tieneSaldoPendiente: true },
      }),
      this.prisma.famSolicitudBeneficio.findMany({
        where: { estado: { not: 'RECHAZADA' } },
        select: {
          id: true,
          estado: true,
          monto: true,
          montoFinal: true,
          montoTotalAsignado: true,
          formaPago: true,
          banco: true,
          depositos: {
            select: {
              monto: true,
              banco: true,
            },
          },
        },
      }),
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

    let montoTotalEntregado = 0;
    let montoTotalAsignadoGlobal = 0;
    let pagadosCount = 0;
    const mapaFormaPago = new Map<string, { formaPago: string; count: number; monto: number }>();
    const mapaBanco = new Map<string, { banco: string; count: number; monto: number }>();

    const normalizarFormaPago = (fp: string | null | undefined, tieneDepositos: boolean, pagada: boolean): string => {
      const limpio = (fp || '')
        .toUpperCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (limpio.includes('CHEQUE')) return 'CHEQUE';
      if (limpio.includes('DEPOSITO')) return 'DEPOSITO';
      if (limpio.includes('TRANSFERENCIA')) return 'TRANSFERENCIA';
      if (limpio.includes('EFECTIVO')) return 'EFECTIVO';
      if (limpio) return limpio;
      if (tieneDepositos || pagada) return 'DEPOSITO';
      return 'POR DEFINIR';
    };

    for (const exp of expedientesFinancieros) {
      const depositos = exp.depositos || [];
      const sumaDepositos = depositos.reduce((acc, d) => acc + (Number(d.monto) || 0), 0);
      const montoBaseExp =
        exp.montoTotalAsignado != null && Number(exp.montoTotalAsignado) > 0
          ? Number(exp.montoTotalAsignado)
          : exp.montoFinal != null
            ? Number(exp.montoFinal)
            : Number(exp.monto) || 0;
      const montoDado = sumaDepositos > 0 ? sumaDepositos : montoBaseExp;

      montoTotalAsignadoGlobal += montoDado;
      const esPagada = exp.estado === 'PAGADA';
      if (esPagada) {
        pagadosCount += 1;
        montoTotalEntregado += montoDado;
      }

      const fpKey = normalizarFormaPago(exp.formaPago, depositos.length > 0, esPagada);
      if (esPagada || exp.formaPago || depositos.length > 0) {
        const itemFp = mapaFormaPago.get(fpKey) || { formaPago: fpKey, count: 0, monto: 0 };
        itemFp.count += 1;
        itemFp.monto = Math.round((itemFp.monto + montoDado) * 100) / 100;
        mapaFormaPago.set(fpKey, itemFp);
      }

      if (depositos.length > 0) {
        const bancosVistosEnExp = new Set<string>();
        for (const d of depositos) {
          const nombreBanco = (d.banco || exp.banco || '').trim().toUpperCase();
          if (!nombreBanco) continue;
          const itemB = mapaBanco.get(nombreBanco) || { banco: nombreBanco, count: 0, monto: 0 };
          if (!bancosVistosEnExp.has(nombreBanco)) {
            itemB.count += 1;
            bancosVistosEnExp.add(nombreBanco);
          }
          itemB.monto = Math.round((itemB.monto + (Number(d.monto) || 0)) * 100) / 100;
          mapaBanco.set(nombreBanco, itemB);
        }
      } else if (exp.banco && exp.banco.trim()) {
        const nombreBanco = exp.banco.trim().toUpperCase();
        const itemB = mapaBanco.get(nombreBanco) || { banco: nombreBanco, count: 0, monto: 0 };
        itemB.count += 1;
        itemB.monto = Math.round((itemB.monto + montoDado) * 100) / 100;
        mapaBanco.set(nombreBanco, itemB);
      }
    }

    return {
      misTendientes: userRol === 'ADMINISTRADOR' ? total : porEstado.reduce((s, e) => s + e._count, 0),
      sinAsignar,
      proximosAVencer: vencidos + porVencer,
      vencidos,
      porTipo: Array.from(mapaTipos.values()),
      conSaldoPendienteCount,
      saldoPendienteTotal: Number(saldoPendienteAgg._sum.saldoPendiente || 0),
      montoTotalEntregado: Math.round(montoTotalEntregado * 100) / 100,
      montoTotalAsignadoGlobal: Math.round(montoTotalAsignadoGlobal * 100) / 100,
      pagadosCount,
      porFormaPago: Array.from(mapaFormaPago.values()).sort((a, b) => b.monto - a.monto),
      porBanco: Array.from(mapaBanco.values()).sort((a, b) => b.monto - a.monto),
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
