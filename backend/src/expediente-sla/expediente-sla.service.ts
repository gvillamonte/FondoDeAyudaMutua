import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FamService } from '../fam/fam.service';

@Injectable()
export class ExpedienteSlaService {
  private readonly logger = new Logger(ExpedienteSlaService.name);

  constructor(
    private prisma: PrismaService,
    private famService: FamService,
  ) {}

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

    const [
      total,
      porEstado,
      porTipo,
      sinAsignar,
      conSaldoPendienteCount,
      saldoPendienteAgg,
      expedientesFinancieros,
      saldosExp,
      pagadosExp,
      todosEstados,
      docsIncompletosExp,
    ] = await Promise.all([
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
      this.prisma.famSolicitudBeneficio.findMany({
        where: { tieneSaldoPendiente: true },
        include: { tipoBeneficio: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.famSolicitudBeneficio.findMany({
        where: { estado: 'PAGADA' },
        include: { tipoBeneficio: true },
        orderBy: { fechaPago: 'desc' },
        take: 100,
      }),
      this.prisma.famSolicitudBeneficio.groupBy({
        by: ['estado'],
        _count: true,
      }),
      this.prisma.famSolicitudBeneficio.findMany({
        where: {
          documentacionCompleta: false,
          estado: { notIn: ['PAGADA', 'RECHAZADA'] },
        },
        include: { tipoBeneficio: true },
        orderBy: { createdAt: 'desc' },
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
    const itemsVencer: any[] = [];
    proximosAVencer.forEach((exp) => {
      const horasLimite = mapaSla.get(exp.estado) || 72;
      if (horasLimite <= 0) return;
      const horasTranscurridas = (ahora.getTime() - new Date(exp.createdAt).getTime()) / (1000 * 60 * 60);
      const horasRestantes = horasLimite - horasTranscurridas;
      if (horasRestantes <= 0) {
        vencidos++;
        itemsVencer.push({
          id: exp.id,
          expedienteNumero: exp.expedienteNumero,
          colegiadoId: exp.colegiadoId,
          monto: Number(exp.monto),
          estado: exp.estado,
          tipoBeneficio: exp.tipoBeneficio?.nombre || 'Beneficio FAM',
          createdAt: exp.createdAt,
          horasLimite,
          horasTranscurridas: Math.round(horasTranscurridas * 10) / 10,
          horasRestantes: Math.round(horasRestantes * 10) / 10,
          condicion: 'VENCIDO',
          diasRetraso: Math.max(1, Math.ceil(Math.abs(horasRestantes) / 24)),
        });
      } else if (horasRestantes <= 12) {
        porVencer++;
        itemsVencer.push({
          id: exp.id,
          expedienteNumero: exp.expedienteNumero,
          colegiadoId: exp.colegiadoId,
          monto: Number(exp.monto),
          estado: exp.estado,
          tipoBeneficio: exp.tipoBeneficio?.nombre || 'Beneficio FAM',
          createdAt: exp.createdAt,
          horasLimite,
          horasTranscurridas: Math.round(horasTranscurridas * 10) / 10,
          horasRestantes: Math.round(horasRestantes * 10) / 10,
          condicion: 'POR_VENCER',
          horasParaVencer: Math.max(1, Math.round(horasRestantes)),
        });
      }
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

    const saldoPendienteList = saldosExp.map((exp) => ({
      id: exp.id,
      expedienteNumero: exp.expedienteNumero,
      colegiadoId: exp.colegiadoId,
      monto: Number(exp.monto),
      saldoPendiente: Number(exp.saldoPendiente || 0),
      montoAprobadoTotal: Number(exp.montoTotalAsignado || exp.montoFinal || exp.monto || 0),
      estado: exp.estado,
      tipoBeneficio: exp.tipoBeneficio?.nombre || 'Beneficio FAM',
      motivoSaldoPendiente: exp.observaciones || 'Saldo retenido / pendiente',
      createdAt: exp.createdAt,
    }));

    const pendientesList = proximosAVencer.map((exp) => {
      const horasLimite = mapaSla.get(exp.estado) || 72;
      const horasTranscurridas = (ahora.getTime() - new Date(exp.createdAt).getTime()) / (1000 * 60 * 60);
      const horasRestantes = horasLimite - horasTranscurridas;
      return {
        id: exp.id,
        expedienteNumero: exp.expedienteNumero,
        colegiadoId: exp.colegiadoId,
        monto: Number(exp.monto),
        estado: exp.estado,
        tipoBeneficio: exp.tipoBeneficio?.nombre || 'Beneficio FAM',
        createdAt: exp.createdAt,
        diasEspera: Math.max(0, Math.floor(horasTranscurridas / 24)),
        horasRestantes: Math.round(horasRestantes * 10) / 10,
        condicionSla: horasRestantes <= 0 ? 'VENCIDO' : horasRestantes <= 12 ? 'POR_VENCER' : 'EN_PLAZO',
      };
    });

    const ultimosPagadosList = pagadosExp.map((exp) => {
      const montoTotal =
        exp.montoTotalAsignado != null && Number(exp.montoTotalAsignado) > 0
          ? Number(exp.montoTotalAsignado)
          : exp.montoFinal != null
            ? Number(exp.montoFinal)
            : Number(exp.monto) || 0;
      return {
        id: exp.id,
        expedienteNumero: exp.expedienteNumero,
        colegiadoId: exp.colegiadoId,
        monto: montoTotal,
        estado: exp.estado,
        tipoBeneficio: exp.tipoBeneficio?.nombre || 'Beneficio FAM',
        fechaPago: exp.fechaPago || exp.updatedAt,
        formaPago: exp.formaPago || 'DEPOSITO',
        banco: exp.banco || null,
        numeroCuenta: exp.numeroCuenta || null,
      };
    });

    const docsIncompletosList = docsIncompletosExp.map((exp) => ({
      id: exp.id,
      expedienteNumero: exp.expedienteNumero,
      colegiadoId: exp.colegiadoId,
      monto: Number(exp.monto),
      estado: exp.estado,
      tipoBeneficio: exp.tipoBeneficio?.nombre || 'Beneficio FAM',
      documentacionObservacion: exp.documentacionObservacion || 'Documentos obligatorios pendientes de carga',
      createdAt: exp.createdAt,
    }));

    const todosColegiadoIds = [
      ...new Set([
        ...itemsVencer.map((i) => i.colegiadoId),
        ...saldoPendienteList.map((i) => i.colegiadoId),
        ...pendientesList.map((i) => i.colegiadoId),
        ...ultimosPagadosList.map((i) => i.colegiadoId),
        ...docsIncompletosList.map((i) => i.colegiadoId),
      ].filter(Boolean)),
    ];

    let mapaColegiados = new Map<string, any>();
    if (this.famService && todosColegiadoIds.length > 0) {
      try {
        mapaColegiados = await this.famService.buscarColegiadosPorIds(todosColegiadoIds);
      } catch (err: any) {
        this.logger.warn(`Error al buscar colegiados para dashboard SLA: ${err.message}`);
      }
    }

    const enriquecer = (item: any) => {
      const col = mapaColegiados.get(item.colegiadoId);
      return {
        ...item,
        nombreColegiado: col?.NOMBRE_COLEGIADO || 'Colegiado N/A',
        numColegiatura: col?.NUM_COLEGIATURA || '-',
        dni: col?.DNI || '-',
      };
    };

    const vencidosItems = itemsVencer.filter((i) => i.condicion === 'VENCIDO').map(enriquecer);
    const porVencerItems = itemsVencer.filter((i) => i.condicion === 'POR_VENCER').map(enriquecer);
    const docsIncompletosItems = docsIncompletosList.map(enriquecer);
    const saldoPendienteItems = saldoPendienteList.map(enriquecer);

    const alertasPendientes = {
      totalAlertas: vencidosItems.length + porVencerItems.length + docsIncompletosItems.length + saldoPendienteItems.length,
      vencidosCount: vencidosItems.length,
      porVencerCount: porVencerItems.length,
      docsIncompletosCount: docsIncompletosItems.length,
      saldoPendienteCount: saldoPendienteItems.length,
      vencidos: vencidosItems,
      porVencer: porVencerItems,
      docsIncompletos: docsIncompletosItems,
      saldoPendiente: saldoPendienteItems,
    };

    const totalExpedientesRegistrados = todosEstados.reduce((acc, curr) => acc + curr._count, 0);
    const porEstadoTotal = todosEstados.map((e) => ({
      estado: e.estado,
      count: e._count,
    }));

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
      totalExpedientes: totalExpedientesRegistrados,
      porEstadoTotal,
      alertasPendientes,
      docsIncompletosList: docsIncompletosItems,
      vencidosList: itemsVencer.map(enriquecer),
      saldoPendienteList: saldoPendienteItems,
      pendientesList: pendientesList.map(enriquecer),
      ultimosPagadosList: ultimosPagadosList.map(enriquecer),
    };
  }

  async getTrazabilidad(expedienteId: string) {
    const [solicitud, logs] = await Promise.all([
      this.prisma.famSolicitudBeneficio.findUnique({
        where: { id: expedienteId },
        include: {
          tipoBeneficio: true,
          vinculos: { include: { beneficiario: true } },
          depositos: true,
        },
      }),
      (this.prisma as any).auditLog.findMany({
        where: {
          entity: { in: ['fam_registro', 'fam_beneficio', 'fam_carta_poder', 'fam_documento', 'fam_deposito'] },
          entityId: { startsWith: expedienteId },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    // Resolver UUIDs de usuarios a usernames
    const userIds = [...new Set(logs.map((l: any) => l.userId).filter((id: string) => id && !['system', 'Sistema'].includes(id)))];
    if (solicitud?.registradoPor && !userIds.includes(solicitud.registradoPor)) {
      userIds.push(solicitud.registradoPor);
    }

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

    const documentosLista: Array<{ campo: string; nombre: string; cargado: boolean }> = [
      { campo: 'fichaAdmisibilidad', nombre: 'Ficha de Admisibilidad', cargado: Boolean((solicitud as any)?.fichaAdmisibilidad) },
      { campo: 'solicitudAsignacion', nombre: 'Solicitud de Asignación', cargado: Boolean((solicitud as any)?.solicitudAsignacion) },
      { campo: 'cartaRemision', nombre: 'Carta de Remisión', cargado: Boolean((solicitud as any)?.cartaRemision) },
      { campo: 'memorando', nombre: 'Memorando', cargado: Boolean((solicitud as any)?.memorando) },
      { campo: 'ordenPago', nombre: 'Orden de Pago', cargado: Boolean((solicitud as any)?.ordenPago) },
      { campo: 'actaDefuncion', nombre: 'Acta de Defunción', cargado: Boolean((solicitud as any)?.actaDefuncion) },
      { campo: 'declaracionJurada', nombre: 'Declaración Jurada', cargado: Boolean((solicitud as any)?.declaracionJurada) },
      { campo: 'cartaPoder', nombre: 'Carta Poder', cargado: Boolean((solicitud as any)?.cartaPoder) },
    ];

    const mapaDocsPorEstado: Record<string, any[]> = {
      PENDIENTE: documentosLista.filter((d) => ['fichaAdmisibilidad', 'solicitudAsignacion', 'actaDefuncion', 'declaracionJurada'].includes(d.campo)),
      EN_REVISION: documentosLista.filter((d) => ['cartaRemision', 'memorando', 'cartaPoder'].includes(d.campo)),
      APROBADA: documentosLista.filter((d) => ['ordenPago'].includes(d.campo)),
      PAGADA: (solicitud?.depositos || []).map((dep: any) => ({
        campo: 'comprobantePdf',
        nombre: `Comprobante de depósito · ${dep.nombreBeneficiario || 'Beneficiario'}`,
        cargado: Boolean(dep.comprobantePdf),
      })),
      RECHAZADA: [],
    };

    return logs.map((log: any) => {
      let mensaje = '';
      const changes = log.changesJson ? JSON.parse(log.changesJson) : {};
      const userName = changes.userName || userMap[log.userId] || log.userId || 'Sistema';

      const estadoAnterior =
        changes.transicion?.estadoAnterior ||
        changes.estado?.old ||
        changes.registro?.old?.estado ||
        changes.old?.estado ||
        (log.action === 'CREATE' ? null : 'PENDIENTE');

      const estadoNuevo =
        changes.transicion?.estadoNuevo ||
        changes.estado?.new ||
        changes.registro?.new?.estado ||
        changes.new?.estado ||
        (log.action === 'CREATE' ? (solicitud?.estado || 'PENDIENTE') : solicitud?.estado || 'PENDIENTE');

      const observaciones =
        changes.transicion?.observaciones ||
        changes.observaciones ||
        changes.registro?.new?.observaciones ||
        changes.documentacionObservacion ||
        (log.action === 'CREATE' ? solicitud?.observaciones : null) ||
        null;

      const etapa = estadoNuevo || 'PENDIENTE';
      const docsEtapa = mapaDocsPorEstado[etapa] || [];

      switch (log.action) {
        case 'CREATE':
          mensaje = `${userName} registró el expediente`;
          break;
        case 'UPDATE':
          if (estadoAnterior && estadoNuevo && estadoAnterior !== estadoNuevo) {
            mensaje = `${userName} cambió estado de "${estadoAnterior}" a "${estadoNuevo}"`;
          } else if (changes.campo) {
            mensaje = `${userName} actualizó documento ${changes.campo}`;
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

      const marcaTiempoExacta = log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString();
      const fechaHoraFormateada = log.createdAt
        ? new Date(log.createdAt).toLocaleString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })
        : '';

      return {
        id: log.id,
        accion: log.action,
        mensaje,
        estadoAnterior,
        estadoNuevo,
        marcaTiempoExacta,
        fechaHoraFormateada,
        usuarioResponsable: userName,
        observaciones,
        documentosAsociados: docsEtapa,
        detalles: changes,
      };
    });
  }
}
