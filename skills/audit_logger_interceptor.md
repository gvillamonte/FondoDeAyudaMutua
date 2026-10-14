# SKILL: Audit Logger Interceptor - Automatic Write Operation Tracking

## ⛔ REGLA CRÍTICA: Campos EXACTOS del modelo `AuditLog` (BUG HISTÓRICO 2026-08)

El modelo Prisma `AuditLog` (backend/prisma/schema.prisma) define **ÚNICAMENTE** estos campos:

```typescript
id, userId, action, entity, entityId, changesJson, ipAddress, userAgent, createdAt
```

**PROHIBIDO** pasar al `prisma.auditLog.create()` cualquier campo fuera de esta lista
(`details`, `actionCategory`, `description`, etc.). Hacerlo produce el error de
compilación TS2353 y **impide que el backend arranque**, dejando todo el sistema sin API.

> Si se necesita información adicional en auditoría, agregarla DENTRO de `changesJson`
> (es un string JSON serializado), nunca como columna nueva sin migración previa.

## OBJETIVO
Interceptar automáticamente todas las operaciones de escritura (POST, PUT, DELETE, PATCH) en el backend NestJS y registrar un registro inmutable de auditoría en la tabla `audit_logs` de `APP_DB`.

## ESQUEMA DE LA TABLA audit_logs

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  action        VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
  entity        VARCHAR(50) NOT NULL,  -- beneficio, pago, usuario
  entity_id     VARCHAR(100) NOT NULL,
  changes_json  JSONB,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IMMUTABLE: No permite UPDATE ni DELETE
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
```

## IMPLEMENTACIÓN EN NESTJS

### 1. Interceptor de Auditoría (`AuditInterceptor`)

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, ip, headers } = request;

    // Solo interceptar mutaciones
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return next.handle();
    }

    const action = this.mapMethodToAction(method);
    const entity = this.extractEntityFromUrl(url);

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const entityId = response?.data?.id || response?.id || 'unknown';

          await this.prisma.auditLog.create({
            data: {
              user_id: user?.sub || 'system',
              action,
              entity,
              entity_id: String(entityId),
              changes_json: {
                request_body: this.sanitizeBody(body),
                response_status: 'success',
              },
              ip_address: ip || headers['x-forwarded-for'] || 'unknown',
              user_agent: headers['user-agent'] || 'unknown',
            },
          });
        } catch (error) {
          console.error('Audit log failed:', error);
        }
      }),
    );
  }

  private mapMethodToAction(method: string): string {
    const map: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    return map[method] || 'UNKNOWN';
  }

  private extractEntityFromUrl(url: string): string {
    const segments = url.split('/').filter(Boolean);
    return segments[1] || segments[0] || 'unknown';
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };
    delete sanitized.password;
    delete sanitized.token;
    return sanitized;
  }
}
```

### 2. Servicio de Auditoría para Consultas (`AuditService`)

```typescript
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    changes?: Record<string, { old: any; new: any }>;
    ipAddress: string;
    userAgent: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        user_id: params.userId,
        action: params.action,
        entity: params.entity,
        entity_id: params.entityId,
        changes_json: params.changes || {},
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      },
    });
  }

  async findAll(filters: {
    entity?: string;
    action?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { entity, action, userId, startDate, endDate, page = 1, limit = 25 } = filters;

    const where: any = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (userId) where.user_id = userId;
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = startDate;
      if (endDate) where.created_at.lte = endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
```

## MÓDULO DE AUDITORÍA

```typescript
@Module({
  imports: [],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
```

## REGLAS DE USO

1. **Interceptor Global:** Registrar `AuditInterceptor` globalmente en `main.ts` para cubrir todos los controllers.
2. **Excepciones:** No auditar endpoints de health check, login (autenticación), o refresh token.
3. **Cambio Detection:** Para operaciones UPDATE, capturar los campos modificados comparando el estado anterior y posterior.
4. **Retención:** Los registros de auditoría se conservan por un mínimo de 5 años.
5. **Consulta:** Solo los usuarios con rol `AUDITOR` o `ADMINISTRADOR` pueden consultar los logs.

## CHECKLIST DE VALIDACIÓN
- [ ] El interceptor cubre todos los endpoints de escritura.
- [ ] Los campos `user_id`, `action`, `entity`, `entity_id` siempre están presentes.
- [ ] Los datos sensibles (passwords, tokens) se eliminan del `changes_json`.
- [ ] La tabla `audit_logs` tiene reglas de inmutabilidad (NO UPDATE, NO DELETE).
- [ ] El interceptor no bloquea la respuesta original al cliente.
- [ ] Los errores de auditoría se registran pero no fallan la operación principal.

## Snapshot de Solicitante en FAM (evita lost-update al beneficiario)

Al registrar un expediente de beneficio con `solicitanteBeneficiarioId` o `solicitanteIndice`,
el sistema **snapshot** el nombre y DNI del beneficiario seleccionado en los campos:
- `solicitanteNombre` (nombre del beneficiario en el momento de la solicitud)
- `solicitanteDni` (DNI del beneficiario en el momento de la solicitud)
- `solicitanteBeneficiarioId` (FK al registro en `fam_beneficiarios`)

Esto garantiza que, si el beneficiario se modifica después (cambios de nombre o DNI),
la información del solicitante en la solicitud histórica permanezca intacta y verificable.
