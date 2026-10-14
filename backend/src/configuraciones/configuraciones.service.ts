import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearConfiguracionDto, ActualizarConfiguracionDto } from './dto/configuracion.dto';

@Injectable()
export class ConfiguracionesService {
  constructor(private prisma: PrismaService) {}

  async crear(dto: CrearConfiguracionDto) {
    const existing = await this.prisma.famConfiguracion.findUnique({
      where: { clave: dto.clave },
    });
    if (existing) {
      throw new ConflictException(`La clave '${dto.clave}' ya existe`);
    }

    try {
      return await this.prisma.famConfiguracion.create({
        data: {
          clave: dto.clave,
          valor: dto.valor,
          grupo: dto.grupo || 'GENERAL',
          descripcion: dto.descripcion || null,
          activo: dto.activo !== undefined ? dto.activo : true,
        },
      });
    } catch (e: any) {
      if (e.message?.includes('grupo')) {
        return await this.prisma.$executeRawUnsafe(
          `INSERT INTO fam_configuracion (id, clave, valor, descripcion, activo, created_at, updated_at)
           VALUES (NEWID(), @p0, @p1, @p2, @p3, GETDATE(), GETDATE())`,
          dto.clave, dto.valor, dto.descripcion || null, dto.activo !== undefined ? dto.activo : 1,
        );
      }
      throw e;
    }
  }

  async listar(params: { search?: string; activo?: boolean; grupo?: string }) {
    try {
      const where: any = {};
      if (params.search) {
        where.OR = [
          { clave: { contains: params.search, mode: 'insensitive' } },
          { valor: { contains: params.search, mode: 'insensitive' } },
          { descripcion: { contains: params.search, mode: 'insensitive' } },
        ];
      }
      if (params.activo !== undefined) where.activo = params.activo;
      if (params.grupo) where.grupo = params.grupo;

      return await this.prisma.famConfiguracion.findMany({
        where,
        orderBy: { clave: 'asc' },
      });
    } catch {
      return await this.prisma.famConfiguracion.findMany({
        orderBy: { clave: 'asc' },
      });
    }
  }

  async listarPorGrupo(grupo: string) {
    return this.prisma.famConfiguracion.findMany({
      where: {
        grupo,
        activo: true,
      },
      orderBy: { clave: 'asc' },
    });
  }

  async obtenerPorId(id: string) {
    const config = await this.prisma.famConfiguracion.findUnique({ where: { id } });
    if (!config) {
      throw new NotFoundException('Configuración no encontrada');
    }
    return config;
  }

  async obtenerPorClave(clave: string) {
    const config = await this.prisma.famConfiguracion.findUnique({ where: { clave } });
    if (!config) {
      throw new NotFoundException(`Configuración '${clave}' no encontrada`);
    }
    return config;
  }

  async actualizar(id: string, dto: ActualizarConfiguracionDto) {
    const existing = await this.prisma.famConfiguracion.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Configuración no encontrada');
    }

    return this.prisma.famConfiguracion.update({
      where: { id },
      data: {
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
    });
  }

  async eliminar(id: string) {
    const existing = await this.prisma.famConfiguracion.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Configuración no encontrada');
    }

    await this.prisma.famConfiguracion.delete({ where: { id } });
    return { message: 'Configuración eliminada exitosamente' };
  }

  async obtenerMontosFam() {
    const montos = await this.prisma.montoFam.findMany({
      where: { activo: true },
      orderBy: { id: 'asc' },
    });

    return montos.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      aplicaA: m.aplicaA,
      monto: Number(m.monto),
      descripcion: m.descripcion,
      activo: m.activo,
    }));
  }
}
