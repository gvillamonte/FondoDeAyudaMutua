import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CrearMontoFamDto,
  ActualizarMontoFamDto,
  CrearEstadoSolicitudDto,
  ActualizarEstadoSolicitudDto,
  CrearMonedaDto,
  ActualizarMonedaDto,
  CrearTipoBeneficioConfigDto,
  ActualizarTipoBeneficioConfigDto,
  CrearMemorandoDto,
  ActualizarMemorandoDto,
  CrearCartaDto,
  ActualizarCartaDto,
} from './dto/catalogos.dto';

@Injectable()
export class CatalogosService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ================= MONTOS FAM =================
  async listarMontosFam(soloActivos: boolean) {
    return this.prisma.montoFam.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { id: 'asc' },
    });
  }

  async crearMontoFam(dto: CrearMontoFamDto, userId: string, ip?: string) {
    const dup = await this.prisma.montoFam.findFirst({ where: { nombre: dto.nombre.trim() } });
    if (dup) throw new ConflictException(`El monto '${dto.nombre}' ya existe`);

    const creado = await this.prisma.montoFam.create({
      data: {
        nombre: dto.nombre.trim(),
        aplicaA: dto.aplicaA || null,
        monto: dto.monto,
        descripcion: dto.descripcion || null,
        activo: dto.activo ?? true,
      },
    });
    await this.registrar('CREATE', 'monto_fam', creado.id, null, creado, userId, ip);
    return creado;
  }

  async actualizarMontoFam(id: number, dto: ActualizarMontoFamDto, userId: string, ip?: string) {
    const existing = await this.prisma.montoFam.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Monto FAM ${id} no encontrado`);
    if (dto.nombre !== undefined && dto.nombre.trim() !== existing.nombre) {
      const dup = await this.prisma.montoFam.findFirst({
        where: { nombre: dto.nombre.trim(), NOT: { id } },
      });
      if (dup) throw new ConflictException(`El monto '${dto.nombre}' ya existe`);
    }

    const actualizado = await this.prisma.montoFam.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.aplicaA !== undefined && { aplicaA: dto.aplicaA }),
        ...(dto.monto !== undefined && { monto: dto.monto }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion || null }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });
    await this.registrar('UPDATE', 'monto_fam', id, existing, actualizado, userId, ip);
    return actualizado;
  }

  async eliminarMontoFam(id: number, userId: string, ip?: string) {
    const existing = await this.prisma.montoFam.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Monto FAM ${id} no encontrado`);
    await this.prisma.montoFam.delete({ where: { id } });
    await this.registrar('DELETE', 'monto_fam', id, existing, null, userId, ip);
    return { message: 'Monto FAM eliminado exitosamente' };
  }

  // ================= ESTADOS DE SOLICITUD =================
  async listarEstadosSolicitud(soloActivos: boolean) {
    return this.prisma.estadoSolicitud.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });
  }

  async crearEstadoSolicitud(dto: CrearEstadoSolicitudDto, userId: string, ip?: string) {
    const dup = await this.prisma.estadoSolicitud.findFirst({ where: { nombre: dto.nombre.trim() } });
    if (dup) throw new ConflictException(`El estado '${dto.nombre}' ya existe`);

    const creado = await this.prisma.estadoSolicitud.create({
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion || null,
        orden: dto.orden ?? 0,
        activo: dto.activo ?? true,
      },
    });
    await this.registrar('CREATE', 'estado_solicitud', creado.id, null, creado, userId, ip);
    return creado;
  }

  async actualizarEstadoSolicitud(id: number, dto: ActualizarEstadoSolicitudDto, userId: string, ip?: string) {
    const existing = await this.prisma.estadoSolicitud.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Estado de solicitud ${id} no encontrado`);
    if (dto.nombre !== undefined && dto.nombre.trim() !== existing.nombre) {
      const dup = await this.prisma.estadoSolicitud.findFirst({
        where: { nombre: dto.nombre.trim(), NOT: { id } },
      });
      if (dup) throw new ConflictException(`El estado '${dto.nombre}' ya existe`);
    }

    const actualizado = await this.prisma.estadoSolicitud.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion || null }),
        ...(dto.orden !== undefined && { orden: dto.orden }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });
    await this.registrar('UPDATE', 'estado_solicitud', id, existing, actualizado, userId, ip);
    return actualizado;
  }

  async eliminarEstadoSolicitud(id: number, userId: string, ip?: string) {
    const existing = await this.prisma.estadoSolicitud.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Estado de solicitud ${id} no encontrado`);
    const enUso = await this.prisma.solicitudBeneficio.count({ where: { estado: existing.nombre.toUpperCase().replace(/\s+/g, '_') } });
    if (enUso > 0) {
      throw new ConflictException(`No se puede eliminar: ${enUso} solicitud(es) lo usan. Desactívelo.`);
    }
    await this.prisma.estadoSolicitud.delete({ where: { id } });
    await this.registrar('DELETE', 'estado_solicitud', id, existing, null, userId, ip);
    return { message: 'Estado de solicitud eliminado exitosamente' };
  }

  // ================= MONEDAS =================
  async listarMonedas(soloActivos: boolean) {
    return this.prisma.moneda.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { id: 'asc' },
    });
  }

  async crearMoneda(dto: CrearMonedaDto, userId: string, ip?: string) {
    const dup = await this.prisma.moneda.findFirst({ where: { nombre: dto.nombre.trim() } });
    if (dup) throw new ConflictException(`La moneda '${dto.nombre}' ya existe`);

    const creado = await this.prisma.moneda.create({
      data: {
        nombre: dto.nombre.trim(),
        simbolo: dto.simbolo.trim(),
        descripcion: dto.descripcion || null,
        activo: dto.activo ?? true,
      },
    });
    await this.registrar('CREATE', 'moneda', creado.id, null, creado, userId, ip);
    return creado;
  }

  async actualizarMoneda(id: number, dto: ActualizarMonedaDto, userId: string, ip?: string) {
    const existing = await this.prisma.moneda.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Moneda ${id} no encontrada`);
    if (dto.nombre !== undefined && dto.nombre.trim() !== existing.nombre) {
      const dup = await this.prisma.moneda.findFirst({
        where: { nombre: dto.nombre.trim(), NOT: { id } },
      });
      if (dup) throw new ConflictException(`La moneda '${dto.nombre}' ya existe`);
    }

    const actualizado = await this.prisma.moneda.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.simbolo !== undefined && { simbolo: dto.simbolo.trim() }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion || null }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });
    await this.registrar('UPDATE', 'moneda', id, existing, actualizado, userId, ip);
    return actualizado;
  }

  async eliminarMoneda(id: number, userId: string, ip?: string) {
    const existing = await this.prisma.moneda.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Moneda ${id} no encontrada`);
    const enUso =
      (await this.prisma.beneficio.count({ where: { moneda: existing.nombre } })) +
      (await this.prisma.pago.count({ where: { moneda: existing.nombre } }));
    if (enUso > 0) {
      throw new ConflictException(`No se puede eliminar: ${enUso} registro(s) la usan. Desactívela.`);
    }
    await this.prisma.moneda.delete({ where: { id } });
    await this.registrar('DELETE', 'moneda', id, existing, null, userId, ip);
    return { message: 'Moneda eliminada exitosamente' };
  }

  // ================= TIPOS DE BENEFICIO =================
  async listarTiposBeneficioConfig(soloActivos: boolean) {
    return this.prisma.tipoBeneficioConfig.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { id: 'asc' },
    });
  }

  async crearTipoBeneficioConfig(dto: CrearTipoBeneficioConfigDto, userId: string, ip?: string) {
    const dup = await this.prisma.tipoBeneficioConfig.findFirst({ where: { nombre: dto.nombre.trim() } });
    if (dup) throw new ConflictException(`El tipo '${dto.nombre}' ya existe`);

    const creado = await this.prisma.tipoBeneficioConfig.create({
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion || null,
        activo: dto.activo ?? true,
      },
    });
    await this.registrar('CREATE', 'tipo_beneficio_config', creado.id, null, creado, userId, ip);
    return creado;
  }

  async actualizarTipoBeneficioConfig(id: number, dto: ActualizarTipoBeneficioConfigDto, userId: string, ip?: string) {
    const existing = await this.prisma.tipoBeneficioConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Tipo de beneficio ${id} no encontrado`);
    if (dto.nombre !== undefined && dto.nombre.trim() !== existing.nombre) {
      const dup = await this.prisma.tipoBeneficioConfig.findFirst({
        where: { nombre: dto.nombre.trim(), NOT: { id } },
      });
      if (dup) throw new ConflictException(`El tipo '${dto.nombre}' ya existe`);
    }

    const actualizado = await this.prisma.tipoBeneficioConfig.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion || null }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });
    await this.registrar('UPDATE', 'tipo_beneficio_config', id, existing, actualizado, userId, ip);
    return actualizado;
  }

  async eliminarTipoBeneficioConfig(id: number, userId: string, ip?: string) {
    const existing = await this.prisma.tipoBeneficioConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Tipo de beneficio ${id} no encontrado`);
    const enUso = await this.prisma.beneficio.count({ where: { tipo: existing.nombre.toUpperCase().replace(/\s+/g, '_') } });
    if (enUso > 0) {
      throw new ConflictException(`No se puede eliminar: ${enUso} beneficio(s) lo usan. Desactívelo.`);
    }
    await this.prisma.tipoBeneficioConfig.delete({ where: { id } });
    await this.registrar('DELETE', 'tipo_beneficio_config', id, existing, null, userId, ip);
    return { message: 'Tipo de beneficio eliminado exitosamente' };
  }

  // ================= AUDITORIA =================
  private async registrar(
    action: string,
    entity: string,
    entityId: number,
    oldData: any,
    newData: any,
    userId: string,
    ip?: string,
  ) {
    await this.auditService.log({
      userId,
      action,
      entity,
      entityId: String(entityId),
      changes: { registro: { old: oldData, new: newData } },
      ipAddress: ip,
    });
  }

  private async registrarStr(
    action: string,
    entity: string,
    entityId: string,
    oldData: any,
    newData: any,
    userId: string,
    ip?: string,
  ) {
    await this.auditService.log({
      userId,
      action,
      entity,
      entityId,
      changes: { registro: { old: oldData, new: newData } },
      ipAddress: ip,
    });
  }

  // ================= MEMORÁNDUMS =================
  async listarMemorandos(soloActivos: boolean) {
    return this.prisma.memorando.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { numero: 'asc' },
    });
  }

  async crearMemorando(dto: CrearMemorandoDto, userId: string, ip?: string) {
    const dup = await this.prisma.memorando.findFirst({ where: { numero: dto.numero.trim() } });
    if (dup) throw new ConflictException(`El memorándum '${dto.numero}' ya existe`);

    const creado = await this.prisma.memorando.create({
      data: {
        numero: dto.numero.trim(),
        fecha: dto.fecha ? new Date(dto.fecha) : null,
        asunto: dto.asunto || null,
        activo: dto.activo ?? true,
      },
    });
    await this.registrarStr('CREATE', 'memorando', creado.id, null, creado, userId, ip);
    return creado;
  }

  async actualizarMemorando(id: string, dto: ActualizarMemorandoDto, userId: string, ip?: string) {
    const existing = await this.prisma.memorando.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Memorándum ${id} no encontrado`);
    if (dto.numero !== undefined && dto.numero.trim() !== existing.numero) {
      const dup = await this.prisma.memorando.findFirst({
        where: { numero: dto.numero.trim(), NOT: { id } },
      });
      if (dup) throw new ConflictException(`El memorándum '${dto.numero}' ya existe`);
    }

    const actualizado = await this.prisma.memorando.update({
      where: { id },
      data: {
        ...(dto.numero !== undefined && { numero: dto.numero.trim() }),
        ...(dto.fecha !== undefined && { fecha: dto.fecha ? new Date(dto.fecha) : null }),
        ...(dto.asunto !== undefined && { asunto: dto.asunto || null }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });
    await this.registrarStr('UPDATE', 'memorando', id, existing, actualizado, userId, ip);
    return actualizado;
  }

  async eliminarMemorando(id: string, userId: string, ip?: string) {
    const existing = await this.prisma.memorando.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Memorándum ${id} no encontrado`);
    await this.prisma.memorando.delete({ where: { id } });
    await this.registrarStr('DELETE', 'memorando', id, existing, null, userId, ip);
    return { message: 'Memorándum eliminado exitosamente' };
  }

  // ================= CARTAS =================
  async listarCartas(soloActivos: boolean) {
    return this.prisma.carta.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { numero: 'asc' },
    });
  }

  async crearCarta(dto: CrearCartaDto, userId: string, ip?: string) {
    const dup = await this.prisma.carta.findFirst({ where: { numero: dto.numero.trim() } });
    if (dup) throw new ConflictException(`La carta '${dto.numero}' ya existe`);

    const creado = await this.prisma.carta.create({
      data: {
        numero: dto.numero.trim(),
        fecha: dto.fecha ? new Date(dto.fecha) : null,
        referencia: dto.referencia || null,
        activo: dto.activo ?? true,
      },
    });
    await this.registrarStr('CREATE', 'carta', creado.id, null, creado, userId, ip);
    return creado;
  }

  async actualizarCarta(id: string, dto: ActualizarCartaDto, userId: string, ip?: string) {
    const existing = await this.prisma.carta.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Carta ${id} no encontrada`);
    if (dto.numero !== undefined && dto.numero.trim() !== existing.numero) {
      const dup = await this.prisma.carta.findFirst({
        where: { numero: dto.numero.trim(), NOT: { id } },
      });
      if (dup) throw new ConflictException(`La carta '${dto.numero}' ya existe`);
    }

    const actualizado = await this.prisma.carta.update({
      where: { id },
      data: {
        ...(dto.numero !== undefined && { numero: dto.numero.trim() }),
        ...(dto.fecha !== undefined && { fecha: dto.fecha ? new Date(dto.fecha) : null }),
        ...(dto.referencia !== undefined && { referencia: dto.referencia || null }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });
    await this.registrarStr('UPDATE', 'carta', id, existing, actualizado, userId, ip);
    return actualizado;
  }

  async eliminarCarta(id: string, userId: string, ip?: string) {
    const existing = await this.prisma.carta.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Carta ${id} no encontrada`);
    await this.prisma.carta.delete({ where: { id } });
    await this.registrarStr('DELETE', 'carta', id, existing, null, userId, ip);
    return { message: 'Carta eliminada exitosamente' };
  }
}
