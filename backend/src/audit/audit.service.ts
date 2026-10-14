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
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        changesJson: params.changes ? JSON.stringify(params.changes) : null,
        ipAddress: params.ipAddress || 'unknown',
        userAgent: params.userAgent || 'unknown',
      },
    });
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
    const limitNum = Number.isFinite(l) && l >= 1 ? Math.floor(l) : 25;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (actionCategory) where.actionCategory = actionCategory;
    if (userId) where.userId = userId;
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

    return {
      data,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    };
  }
}
