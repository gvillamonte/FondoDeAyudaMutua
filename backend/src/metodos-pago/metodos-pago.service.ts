import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CrearMetodoPagoDto, ActualizarMetodoPagoDto } from './dto/metodo-pago.dto';

@Injectable()
export class MetodosPagoService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async listar(soloActivos: boolean) {
    return this.prisma.metodoPago.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: { id: 'asc' },
    });
  }

  async obtenerPorId(id: number) {
    const metodo = await this.prisma.metodoPago.findUnique({ where: { id } });
    if (!metodo) {
      throw new NotFoundException(`Método de pago ${id} no encontrado`);
    }
    return metodo;
  }

  async crear(dto: CrearMetodoPagoDto, userId: string, ipAddress?: string) {
    const existing = await this.prisma.metodoPago.findFirst({
      where: { nombre: dto.nombre.trim() },
    });
    if (existing) {
      throw new ConflictException(`El método '${dto.nombre}' ya existe`);
    }

    const metodo = await this.prisma.metodoPago.create({
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion || null,
        requiereReferencia: dto.requiereReferencia ?? false,
        activo: dto.activo ?? true,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'metodo_pago',
      entityId: String(metodo.id),
      changes: { registro: { old: null, new: metodo } },
      ipAddress,
    });

    return metodo;
  }

  async actualizar(id: number, dto: ActualizarMetodoPagoDto, userId: string, ipAddress?: string) {
    const existing = await this.prisma.metodoPago.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Método de pago ${id} no encontrado`);
    }

    if (dto.nombre !== undefined && dto.nombre.trim() !== existing.nombre) {
      const dup = await this.prisma.metodoPago.findFirst({
        where: { nombre: dto.nombre.trim(), NOT: { id } },
      });
      if (dup) {
        throw new ConflictException(`El método '${dto.nombre}' ya existe`);
      }
    }

    const metodo = await this.prisma.metodoPago.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion || null }),
        ...(dto.requiereReferencia !== undefined && { requiereReferencia: dto.requiereReferencia }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'metodo_pago',
      entityId: String(id),
      changes: {
        nombre: { old: existing.nombre, new: metodo.nombre },
        descripcion: { old: existing.descripcion, new: metodo.descripcion },
        requiereReferencia: { old: existing.requiereReferencia, new: metodo.requiereReferencia },
        activo: { old: existing.activo, new: metodo.activo },
      },
      ipAddress,
    });

    return metodo;
  }

  async eliminar(id: number, userId: string, ipAddress?: string) {
    const existing = await this.prisma.metodoPago.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Método de pago ${id} no encontrado`);
    }

    const enUso = await this.prisma.pago.count({ where: { metodoPagoId: id } });
    if (enUso > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${enUso} pago(s) registrados lo usan. Desactívelo.`,
      );
    }

    await this.prisma.metodoPago.delete({ where: { id } });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'metodo_pago',
      entityId: String(id),
      changes: { registro: { old: existing, new: null } },
      ipAddress,
    });

    return { message: 'Método de pago eliminado exitosamente' };
  }
}
