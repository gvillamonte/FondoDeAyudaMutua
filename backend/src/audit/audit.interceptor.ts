import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, ip, headers } = request;

    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return next.handle();
    }

    // No auditar endpoints de autenticacion (login / refresh)
    if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
      return next.handle();
    }

    const action = this.mapMethodToAction(method);
    const entity = this.extractEntityFromUrl(url);

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const entityId =
            response?.data?.id || response?.id || response?.solicitudId || 'unknown';

          let cambios = JSON.stringify({
            request_body: this.sanitizeBody(body),
            response_status: 'success',
            userName: user?.username || user?.nombre || user?.name || user?.email || 'Sistema',
          });
          // changes_json es NVarChar(4000): limitar tamano total
          if (cambios.length > 3900) {
            cambios = JSON.stringify({
              truncated: true,
              preview: cambios.slice(0, 3800),
            });
          }

          await this.prisma.auditLog.create({
            data: {
              userId: user?.sub || 'system',
              action,
              entity,
              entityId: String(entityId),
              changesJson: cambios,
              ipAddress: ip || headers['x-forwarded-for'] || 'unknown',
              userAgent: headers['user-agent'] || 'unknown',
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
    const apiIndex = segments.indexOf('api');
    const entitySegment = apiIndex >= 0 ? segments[apiIndex + 1] : segments[0];
    return entitySegment || 'unknown';
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.passwordHash;
    return this.truncateDeep(sanitized, 500);
  }

  /** Trunca strings largos (ej. base64 de imagenes) para no saturar audit_logs. */
  private truncateDeep(value: any, max: number, depth = 0): any {
    if (depth > 6) return value;
    if (typeof value === 'string') {
      return value.length > max ? `${value.slice(0, max)}...[truncado ${value.length} chars]` : value;
    }
    if (Array.isArray(value)) {
      return value.slice(0, 50).map((item) => this.truncateDeep(item, max, depth + 1));
    }
    if (value && typeof value === 'object' && value.constructor === Object) {
      const out: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        out[key] = this.truncateDeep(value[key], max, depth + 1);
      }
      return out;
    }
    return value;
  }
}
