import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';
import { MODULOS_SISTEMA } from './modulos.constant';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  getModulosCatalogo() {
    return MODULOS_SISTEMA;
  }

  async findAll() {
    const roles = await this.prisma.rol.findMany({
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return roles.map((r) => {
      let modulos: string[] = [];
      try {
        modulos = JSON.parse(r.modulos);
      } catch {
        modulos = [];
      }
      return {
        id: r.id,
        nombre: r.nombre,
        descripcion: r.descripcion,
        modulos,
        activo: r.activo,
        usuariosCount: r._count.usuarios,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  async findOne(id: string) {
    const rol = await this.prisma.rol.findUnique({
      where: { id },
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con identificador '${id}' no encontrado`);
    }

    let modulos: string[] = [];
    try {
      modulos = JSON.parse(rol.modulos);
    } catch {
      modulos = [];
    }

    return {
      id: rol.id,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      modulos,
      activo: rol.activo,
      usuariosCount: rol._count.usuarios,
      createdAt: rol.createdAt,
      updatedAt: rol.updatedAt,
    };
  }

  async create(dto: CreateRolDto, currentUserId: string = '00000000-0000-0000-0000-000000000001', ip?: string, ua?: string) {
    const rolId = dto.id.trim().toUpperCase();

    const existing = await this.prisma.rol.findUnique({
      where: { id: rolId },
    });

    if (existing) {
      throw new ConflictException(`Ya existe un rol con el código '${rolId}'`);
    }

    // Validar que los módulos existan en el catálogo
    const modulosValidos = new Set(MODULOS_SISTEMA.map((m) => m.id));
    const modulosInvalidos = dto.modulos.filter((m) => !modulosValidos.has(m));
    if (modulosInvalidos.length > 0) {
      throw new BadRequestException(`Módulos no válidos: ${modulosInvalidos.join(', ')}`);
    }

    const rol = await this.prisma.rol.create({
      data: {
        id: rolId,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        modulos: JSON.stringify(dto.modulos),
        activo: dto.activo ?? true,
      },
    });

    await this.auditService.log({
      userId: currentUserId,
      action: 'CREATE',
      entity: 'rol',
      entityId: rol.id,
      changes: {
        id: { old: null, new: rol.id },
        nombre: { old: null, new: rol.nombre },
        modulos: { old: null, new: dto.modulos },
        activo: { old: null, new: rol.activo },
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return this.findOne(rol.id);
  }

  async update(id: string, dto: UpdateRolDto, currentUserId: string = '00000000-0000-0000-0000-000000000001', ip?: string, ua?: string) {
    const rol = await this.prisma.rol.findUnique({ where: { id } });
    if (!rol) {
      throw new NotFoundException(`Rol con identificador '${id}' no encontrado`);
    }

    if (id === 'ADMINISTRADOR') {
      if (dto.activo === false) {
        throw new BadRequestException('No se puede desactivar el rol principal ADMINISTRADOR');
      }
      if (dto.modulos && !dto.modulos.includes('usuarios')) {
        throw new BadRequestException('El rol ADMINISTRADOR no puede perder acceso al módulo de usuarios');
      }
    }

    let modulosJson = rol.modulos;
    if (dto.modulos) {
      const modulosValidos = new Set(MODULOS_SISTEMA.map((m) => m.id));
      const modulosInvalidos = dto.modulos.filter((m) => !modulosValidos.has(m));
      if (modulosInvalidos.length > 0) {
        throw new BadRequestException(`Módulos no válidos: ${modulosInvalidos.join(', ')}`);
      }
      modulosJson = JSON.stringify(dto.modulos);
    }

    const dataToUpdate: any = {};
    if (dto.nombre !== undefined) dataToUpdate.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) dataToUpdate.descripcion = dto.descripcion.trim();
    if (dto.modulos !== undefined) dataToUpdate.modulos = modulosJson;
    if (dto.activo !== undefined) dataToUpdate.activo = dto.activo;

    const updated = await this.prisma.rol.update({
      where: { id },
      data: dataToUpdate,
    });

    await this.auditService.log({
      userId: currentUserId,
      action: 'UPDATE',
      entity: 'rol',
      entityId: id,
      changes: {
        nombre: { old: rol.nombre, new: updated.nombre },
        modulos: { old: rol.modulos, new: updated.modulos },
        activo: { old: rol.activo, new: updated.activo },
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return this.findOne(id);
  }

  async toggleEstado(id: string, currentUserId: string = '00000000-0000-0000-0000-000000000001', ip?: string, ua?: string) {
    const rol = await this.prisma.rol.findUnique({ where: { id } });
    if (!rol) {
      throw new NotFoundException(`Rol '${id}' no encontrado`);
    }

    if (id === 'ADMINISTRADOR') {
      throw new BadRequestException('No se puede desactivar el rol ADMINISTRADOR');
    }

    const nuevoEstado = !rol.activo;
    const updated = await this.prisma.rol.update({
      where: { id },
      data: { activo: nuevoEstado },
    });

    await this.auditService.log({
      userId: currentUserId,
      action: 'UPDATE',
      entity: 'rol',
      entityId: id,
      changes: {
        activo: { old: rol.activo, new: nuevoEstado },
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return this.findOne(id);
  }

  async remove(id: string, currentUserId: string = '00000000-0000-0000-0000-000000000001', ip?: string, ua?: string) {
    if (['ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR'].includes(id)) {
      throw new BadRequestException(`No se puede eliminar el rol base '${id}' del sistema`);
    }

    const rol = await this.prisma.rol.findUnique({
      where: { id },
      include: { _count: { select: { usuarios: true } } },
    });

    if (!rol) {
      throw new NotFoundException(`Rol '${id}' no encontrado`);
    }

    if (rol._count.usuarios > 0) {
      throw new ConflictException(`No se puede eliminar el rol '${rol.nombre}' porque tiene ${rol._count.usuarios} usuario(s) asignado(s)`);
    }

    await this.prisma.rol.delete({ where: { id } });

    await this.auditService.log({
      userId: currentUserId,
      action: 'DELETE',
      entity: 'rol',
      entityId: id,
      changes: {
        id: { old: id, new: null },
        nombre: { old: rol.nombre, new: null },
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return { message: `Rol '${rol.nombre}' eliminado correctamente` };
  }
}
