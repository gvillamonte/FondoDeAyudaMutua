import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearBeneficioDto, ActualizarBeneficioDto } from './dto/beneficio.dto';

@Injectable()
export class BeneficiosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CrearBeneficioDto, userId: string) {
    return this.prisma.beneficio.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        tipo: dto.tipo,
        montoBase: dto.montoBase,
        moneda: dto.moneda || 'PEN',
        requiereJunta: dto.requiereJunta || false,
        createdBy: userId,
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    tipo?: string;
    activo?: boolean;
    search?: string;
  }) {
    const { page = 1, limit = 25, tipo, activo, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (tipo) where.tipo = tipo;
    if (activo !== undefined) where.activo = activo;
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.beneficio.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.beneficio.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const beneficio = await this.prisma.beneficio.findUnique({
      where: { id },
      include: {
        solicitudes: {
          take: 5,
          orderBy: { fechaSolicitud: 'desc' },
        },
      },
    });

    if (!beneficio) {
      throw new NotFoundException(`Beneficio con ID ${id} no encontrado`);
    }

    return beneficio;
  }

  async update(id: string, dto: ActualizarBeneficioDto) {
    const existing = await this.prisma.beneficio.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Beneficio con ID ${id} no encontrado`);
    }

    return this.prisma.beneficio.update({
      where: { id },
      data: dto,
    });
  }

  async toggleActivo(id: string) {
    const existing = await this.prisma.beneficio.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Beneficio con ID ${id} no encontrado`);
    }

    return this.prisma.beneficio.update({
      where: { id },
      data: { activo: !existing.activo },
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.beneficio.findUnique({
      where: { id },
      include: { solicitudes: true },
    });

    if (!existing) {
      throw new NotFoundException(`Beneficio con ID ${id} no encontrado`);
    }

    if (existing.solicitudes.length > 0) {
      throw new ForbiddenException(
        'No se puede eliminar un beneficio que tiene solicitudes asociadas. Desactívelo en su lugar.',
      );
    }

    return this.prisma.beneficio.delete({ where: { id } });
  }
}
