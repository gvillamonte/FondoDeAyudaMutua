import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUsuarioDto } from './dto/query-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private sanitizeUser(user: any) {
    if (!user) return null;
    const { passwordHash, ...sanitized } = user;
    let modulos: string[] = [];
    if (user.rolInfo?.modulos) {
      try {
        modulos = JSON.parse(user.rolInfo.modulos);
      } catch {
        modulos = [];
      }
    }
    return {
      ...sanitized,
      rolNombre: user.rolInfo?.nombre || user.rol,
      modulos,
    };
  }

  async findAll(query: QueryUsuarioDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 25);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { username: { contains: s } },
        { email: { contains: s } },
        { nombreCompleto: { contains: s } },
      ];
    }

    if (query.rol) {
      where.rol = query.rol;
    }

    if (query.activo !== undefined && query.activo !== '') {
      where.activo = query.activo === 'true' || query.activo === '1';
    }

    const [total, usuarios] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rolInfo: {
            select: {
              id: true,
              nombre: true,
              modulos: true,
              activo: true,
            },
          },
        },
      }),
    ]);

    return {
      data: usuarios.map((u) => this.sanitizeUser(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        rolInfo: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    return this.sanitizeUser(usuario);
  }

  async create(
    dto: CreateUsuarioDto,
    currentUserId: string = '00000000-0000-0000-0000-000000000001',
    ip?: string,
    ua?: string,
  ) {
    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();

    // Validar unicidad de username y email
    const existing = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existing) {
      if (existing.username.toLowerCase() === username) {
        throw new ConflictException(`El nombre de usuario '${username}' ya está registrado`);
      }
      if (existing.email.toLowerCase() === email) {
        throw new ConflictException(`El correo electrónico '${email}' ya está registrado`);
      }
    }

    // Validar que el rol exista
    const rol = await this.prisma.rol.findUnique({
      where: { id: dto.rol },
    });

    if (!rol) {
      throw new BadRequestException(`El rol '${dto.rol}' no existe en el sistema`);
    }

    if (!rol.activo) {
      throw new BadRequestException(`El rol '${rol.nombre}' está desactivado`);
    }

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const usuario = await this.prisma.usuario.create({
      data: {
        username,
        email,
        passwordHash,
        nombreCompleto: dto.nombreCompleto.trim(),
        rol: dto.rol,
        activo: dto.activo ?? true,
      },
      include: {
        rolInfo: true,
      },
    });

    await this.auditService.log({
      userId: currentUserId,
      action: 'CREATE',
      entity: 'usuario',
      entityId: usuario.id,
      changes: {
        username: { old: null, new: usuario.username },
        email: { old: null, new: usuario.email },
        nombreCompleto: { old: null, new: usuario.nombreCompleto },
        rol: { old: null, new: usuario.rol },
        activo: { old: null, new: usuario.activo },
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return this.sanitizeUser(usuario);
  }

  async update(
    id: string,
    dto: UpdateUsuarioDto,
    currentUserId: string = '00000000-0000-0000-0000-000000000001',
    ip?: string,
    ua?: string,
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    const dataToUpdate: any = {};
    const changes: Record<string, { old: any; new: any }> = {};

    if (dto.nombreCompleto !== undefined) {
      const nombreCompleto = dto.nombreCompleto.trim();
      changes.nombreCompleto = { old: usuario.nombreCompleto, new: nombreCompleto };
      dataToUpdate.nombreCompleto = nombreCompleto;
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== usuario.email.toLowerCase()) {
        const existingEmail = await this.prisma.usuario.findUnique({ where: { email } });
        if (existingEmail && existingEmail.id !== id) {
          throw new ConflictException(`El correo electrónico '${email}' ya pertenece a otro usuario`);
        }
      }
      changes.email = { old: usuario.email, new: email };
      dataToUpdate.email = email;
    }

    if (dto.rol !== undefined) {
      const rol = await this.prisma.rol.findUnique({ where: { id: dto.rol } });
      if (!rol) {
        throw new BadRequestException(`El rol '${dto.rol}' no existe`);
      }
      changes.rol = { old: usuario.rol, new: dto.rol };
      dataToUpdate.rol = dto.rol;
    }

    if (dto.activo !== undefined) {
      if (usuario.username === 'admin' && dto.activo === false) {
        throw new BadRequestException('No se puede desactivar la cuenta del administrador principal');
      }
      changes.activo = { old: usuario.activo, new: dto.activo };
      dataToUpdate.activo = dto.activo;

      if (!dto.activo) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: id, revoked: false },
          data: { revoked: true },
        });
      }
    }

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: dataToUpdate,
      include: { rolInfo: true },
    });

    await this.auditService.log({
      userId: currentUserId,
      action: 'UPDATE',
      entity: 'usuario',
      entityId: id,
      changes,
      ipAddress: ip,
      userAgent: ua,
    });

    return this.sanitizeUser(updated);
  }

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    currentUserId: string = '00000000-0000-0000-0000-000000000001',
    ip?: string,
    ua?: string,
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    const newPasswordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash: newPasswordHash },
    });

    // Revocar tokens anteriores por seguridad
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true },
    });

    await this.auditService.log({
      userId: currentUserId,
      action: 'CHANGE_PASSWORD',
      entity: 'usuario',
      entityId: id,
      changes: {
        password: { old: '***', new: '***' },
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  async toggleEstado(
    id: string,
    currentUserId: string = '00000000-0000-0000-0000-000000000001',
    ip?: string,
    ua?: string,
  ) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    if (usuario.username === 'admin') {
      throw new BadRequestException('No se puede desactivar la cuenta del administrador principal');
    }

    const nuevoEstado = !usuario.activo;

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: { activo: nuevoEstado },
      include: { rolInfo: true },
    });

    if (!nuevoEstado) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true },
      });
    }

    await this.auditService.log({
      userId: currentUserId,
      action: 'UPDATE',
      entity: 'usuario',
      entityId: id,
      changes: {
        activo: { old: usuario.activo, new: nuevoEstado },
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return this.sanitizeUser(updated);
  }

  async remove(
    id: string,
    currentUserId: string = '00000000-0000-0000-0000-000000000001',
    ip?: string,
    ua?: string,
  ) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            beneficiosCreados: true,
            solicitudesResueltas: true,
            pagosRegistrados: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID '${id}' no encontrado`);
    }

    if (usuario.username === 'admin') {
      throw new BadRequestException('No se puede eliminar al administrador principal');
    }

    const totalRelations =
      usuario._count.beneficiosCreados +
      usuario._count.solicitudesResueltas +
      usuario._count.pagosRegistrados;

    if (totalRelations > 0) {
      // Si tiene relaciones históricas, desactivar la cuenta en lugar de borrarla físicamente
      await this.prisma.usuario.update({
        where: { id },
        data: { activo: false },
      });

      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true },
      });

      await this.auditService.log({
        userId: currentUserId,
        action: 'DEACTIVATE_USER',
        entity: 'usuario',
        entityId: id,
        changes: { activo: { old: true, new: false } },
        ipAddress: ip,
        userAgent: ua,
      });

      return {
        message: 'El usuario tiene registros históricos asociados; la cuenta fue desactivada en lugar de eliminarse para preservar la integridad de datos.',
        deactivated: true,
      };
    }

    // Si no tiene registros vinculados, eliminar físicamente
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    await this.prisma.usuario.delete({ where: { id } });

    await this.auditService.log({
      userId: currentUserId,
      action: 'DELETE',
      entity: 'usuario',
      entityId: id,
      changes: {
        username: { old: usuario.username, new: null },
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return { message: `Usuario '${usuario.username}' eliminado correctamente`, deactivated: false };
  }
}
