import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    changes?: Record<string, { old: any; new: any }>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    let resolvedUserId = params.userId;
    if (this.prisma.databaseAvailable) {
      try {
        const exists = await this.prisma.usuario.findUnique({
          where: { id: resolvedUserId },
          select: { id: true },
        });
        if (!exists) {
          const adminUser = await this.prisma.usuario.findFirst({
            where: { rol: 'ADMINISTRADOR' },
            select: { id: true },
          });
          if (adminUser) resolvedUserId = adminUser.id;
        }
      } catch {}
    }

    try {
      return await this.prisma.auditLog.create({
        data: {
          userId: resolvedUserId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          changesJson: params.changes ? JSON.stringify(params.changes) : null,
          ipAddress: params.ipAddress || 'unknown',
          userAgent: params.userAgent || 'unknown',
        },
      });
    } catch (err: any) {
      console.warn('Advertencia en AuditLog:', err.message);
      return null;
    }
  }

  async findAll(filters: {
    entity?: string;
    action?: string;
    actionCategory?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { entity, action, actionCategory, userId, startDate, endDate, page, limit } = filters;
    const p = Number(page);
    const l = Number(limit);
    const pageNum = Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1;
    const limitNum = Number.isFinite(l) && l >= 1 ? Math.floor(l) : 10;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (actionCategory) where.actionCategory = actionCategory;
    if (userId) {
      if (this.prisma.databaseAvailable) {
        try {
          const matchingUsers = await this.prisma.usuario.findMany({
            where: {
              OR: [
                { id: userId },
                { username: { contains: userId } },
                { nombreCompleto: { contains: userId } },
              ],
            },
            select: { id: true },
          });
          if (matchingUsers.length > 0) {
            where.userId = { in: matchingUsers.map((u) => u.id) };
          } else {
            where.userId = userId;
          }
        } catch {
          where.userId = userId;
        }
      } else {
        where.userId = userId;
      }
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const userIds = Array.from(new Set(data.map((d) => d.userId).filter(Boolean)));
    let userMap = new Map<string, { username: string; nombreCompleto: string; rol: string }>();

    if (userIds.length > 0 && this.prisma.databaseAvailable) {
      try {
        const usuarios = await this.prisma.usuario.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, nombreCompleto: true, rol: true },
        });
        userMap = new Map(usuarios.map((u) => [u.id, { username: u.username, nombreCompleto: u.nombreCompleto, rol: u.rol }]));
      } catch (err: any) {
        console.warn('Advertencia al enriquecer logs con usuarios:', err.message);
      }
    }

    const enrichedData = data.map((log) => {
      const u = userMap.get(log.userId);
      return {
        ...log,
        usuarioNombre: u?.nombreCompleto || null,
        usuarioUsername: u?.username || null,
        usuarioRol: u?.rol || null,
      };
    });

    return {
      data: enrichedData,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    };
  }
}
