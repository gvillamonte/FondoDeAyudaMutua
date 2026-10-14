# SKILL: Auth Token Lifecycle & API Client - Invariantes Protegidas

## OBJETIVO
Documentar los invariantes del flujo de autenticación JWT y del cliente API del frontend.
**Estos puntos fueron origen de fallas críticas (2026-08) y NO deben modificarse ni
revertirse durante actualizaciones.** Cualquier cambio en estos archivos requiere
verificación end-to-end del ciclo completo: login → 15 min → refresh → peticiones.

## ARCHIVOS PROTEGIDOS

| Archivo | Rol |
|---------|-----|
| `backend/src/auth/auth.service.ts` | Emisión y renovación de tokens |
| `frontend/src/lib/auth.ts` | Login/logout y persistencia en localStorage |
| `frontend/src/lib/api.ts` | Cliente axios con interceptor de auto-refresh |

## INVARIANTE 1: Hash determinista (SHA-256) para refresh tokens

El backend guarda un hash del refresh token y lo busca comparando hashes. El hash DEBE
ser **determinista** para que la búsqueda funcione:

```typescript
// ✅ CORRECTO (auth.service.ts)
private hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

**PROHIBIDO usar `bcrypt.hash()` para tokens de refresco:** bcrypt genera un hash
diferente en cada llamada (salt aleatoria), por lo que `findFirst({ where: { tokenHash } })`
NUNCA encontraría el token → el refresh siempre falla → sesión muerta a los 15 minutos.

> bcrypt sigue siendo correcto para `passwordHash` de usuarios (ahí la salt es deseable).
> No confundir ambos usos.

## INVARIANTE 2: El login debe persistir AMBOS tokens

`login()` en `frontend/src/lib/auth.ts` DEBE guardar:

```typescript
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);   // ← NUNCA eliminar esta línea
localStorage.setItem('user', JSON.stringify(data.usuario));
```

Sin `refreshToken`, el interceptor de `api.ts` no puede renovar y borra la sesión al
primer 401.

## INVARIANTE 3: Páginas del frontend usan SIEMPRE el cliente `api`

Las páginas de dashboard (`colegiados`, `beneficios`, `pagos`, `fam`, etc.) DEBEN usar
el cliente compartido:

```typescript
import api from '@/lib/api';
const { data } = await api.get('/legacy/colegiados/search', { params });
```

**PROHIBIDO usar `fetch()` crudo con `Authorization` manual desde localStorage:**
- No tiene auto-refresh → tablas vacías silenciosas al expirar el access token.
- Duplica lógica de headers/baseURL.

## INVARIANTE 4: Fallos visibles, no silenciosos

Los `catch` de las páginas deben mostrar feedback al usuario (mensaje de error en UI)
cuando corresponda. Un `catch {}` vacío en una carga de datos oculta errores de
backend/autenticación y dificulta el diagnóstico.

## CHECKLIST ANTES DE COMMIT (si se tocan archivos protegidos)

- [ ] `npx tsc --noEmit` pasa en `backend/` y `frontend/`.
- [ ] Login manual desde `/` funciona y guarda accessToken + refreshToken en localStorage.
- [ ] Tras expirar el access token (>15 min), una petición renueva el token automáticamente
      sin redirigir al login (verificar en DevTools → Network: POST /api/auth/refresh = 200).
- [ ] `/dashboard/colegiados` muestra registros (~18,000 con DB real).
- [ ] `/dashboard/fam` muestra registros.
