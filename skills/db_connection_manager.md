# SKILL: DB Connection Manager - Multi-Database Security Enforcement

## OBJETIVO
Gestionar las conexiones a las dos bases de datos del sistema garantizando la integridad de datos y la separación estricta de permisos entre `LEGACY_DB` y `APP_DB`.

## CONEXIONES

### LEGACY_DB (Read-Only Data Source)
- **Propósito:** Consulta del padrón maestro de colegiados.
- **Permisos:** EXCLUSIVAMENTE `SELECT`.
- **PROHIBICIONES ABSOLUTAS:**
  - `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, `ALTER`, `CREATE`.
  - Cualquier DDL o DML que modifique datos.
  - Uso de `FOR UPDATE`, `FOR SHARE` (bloqueos de escritura implícitos).
- **Pooling:** Configurado con mínimo 2, máximo 10 conexiones.

### APP_DB (Read-Write Data Source)
- **Propósito:** CRUD completo del dominio de Beneficios, Pagos, Usuarios y Audit Log.
- **Permisos:** `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `EXECUTE` (Stored Procedures y Functions).
- **Pooling:** Configurado con mínimo 5, máximo 20 conexiones.

## REGLAS DE IMPLEMENTACIÓN

### Patrón de Separación (Dual DataSource con Prisma)
```typescript
// LEGACY_DB - Cliente de solo lectura
const legacyPrisma = new PrismaClient({
  datasources: {
    db: { url: process.env.LEGACY_DB_URL },
  },
});

// APP_DB - Cliente de lectura/escritura
const appPrisma = new PrismaClient({
  datasources: {
    db: { url: process.env.APP_DB_URL },
  },
});
```

### ⛔ REGLA CRÍTICA: NO compartir objetos `Request` de mssql (BUG HISTÓRICO 2026-08)

Un objeto `Request` de mssql **NO es reutilizable concurrentemente**. Lanzar dos o más `.query()` sobre el MISMO `Request` dentro de un `Promise.all()` produce error 500 ("request already executing").

**PROHIBIDO:**
```typescript
// ❌ BUG: mismo request para queries concurrentes
const request = this.pool.request();
const [a, b] = await Promise.all([
  request.query(countQuery),
  request.query(dataQuery),   // ← FALLA
]);
```

**OBLIGATORIO:** crear un `Request` independiente por query:
```typescript
// ✅ CORRECTO: request separado por query
const countReq = this.pool.request();
countReq.input('search', sql.VarChar, term);
const dataReq = this.pool.request();
dataReq.input('search', sql.VarChar, term);

const [a, b] = await Promise.all([
  countReq.query(countQuery),
  dataReq.query(dataQuery),
]);
```

> **Nota histórica:** Este bug rompió `/api/legacy/colegiados/search` y `/api/fam/resumen`.
> Al modificar cualquier método de `LegacyService` o `FamService`, verificar que cada
> query tenga su propio `pool.request()`.

### ⚠️ REGLA: Fusión de fuentes para beneficiarios FAM

Los beneficiarios del dominio FAM viven en **dos fuentes distintas**:
- `LEGACY_DB.TBeneficiarioColegiado` (padrón histórico, FAM_ID numérico)
- `APP_DB.fam_beneficiarios` (registrados desde el sistema, FAM_ID uuid)

**OBLIGATORIO** en `getBeneficiariosByColegiado()`: fusionar ambas fuentes, deduplicando por `(nombre, dni)`. Cada fila debe incluir campo `ORIGEN: 'LEGADO' | 'SISTEMA'`. Solo las de ORIGEN SISTEMA tienen `id` válido para vincular a `solicitud_beneficiario`. Las de ORIGEN LEGADO se crean automáticamente en APP_DB al registrar el expediente (via `crearRegistro`).

**PROHIBIDO:** usar únicamente una fuente (legacy o sistema) sin fusionar — el drawer y el backend perderían beneficiarios reales.

### Guard de Solo Lectura
Cualquier servicio que acceda a `LEGACY_DB` DEBE usar el decorador `@ReadOnly()` y pasar por el `ReadOnlyGuard`:

```typescript
@UseGuards(ReadOnlyGuard)
@Controller('colegiados')
export class ColegiadosController {
  // Solo métodos GET permitidos
}
```

### Validación en Runtime
El sistema debe interceptar y rechazar cualquier query que contenga patrones de escritura:
- Regex de detección: `/^\s*(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|MERGE)/i`
- Si se detecta una escritura, lanzar excepción `ForbiddenException` y registrar el intento en logs.

### Transacciones en APP_DB
Las operaciones que involucren múltiples tablas en `APP_DB` DEBEN usar transacciones:
```typescript
await this.appPrisma.$transaction(async (tx) => {
  const beneficio = await tx.beneficio.create({ data: beneficioData });
  const pago = await tx.pago.create({ data: { ...pagoData, beneficio_id: beneficio.id } });
  return { beneficio, pago };
});
```

### ⚠️ Módulo Ayuda COVID: Fuentes de datos

El módulo `fam-covid` consulta **tres fuentes de datos**:
- `LEGACY_DB` (mssql): Para obtener snapshot del colegiado (`TAdmDatosColegiado`, `TBeneficiarioColegiado`, `TAdmDatosEconomicos`). Solo lectura.
- `APP_DB.fam_covid_asignaciones` + `fam_covid_asignacion_beneficiarios` (Prisma): Para persistir las asignaciones COVID y sus beneficiarios.
- `APP_DB.fam_reembolso_comprobantes` (Prisma): Para comprobantes PDFs y datos de reembolso.

**Regla crítica:** El snapshot del colegiado (`solicitanteNombre`, `solicitanteDni`, etc.) se obtiene de LEGACY_DB en el momento de la creación y se persiste en `fam_covid_asignaciones`. Si LEGACY_DB falla, la creación debe fallar — nunca usar datos vacíos o hardcodeados.

**Integración con expedientes:** Cuando se crea un expediente de tipo `FALLECIMIENTO`, el backend busca automáticamente la asignación COVID activa del colegiado (`fam_covid_asignaciones.estado = 'APROBADA'`). Si existe, se aplica descuento automático al monto del beneficio (campos `descuento_covid`, `monto_final`, `covid_asignacion_id` en `fam_solicitud_beneficio`).

## CHECKLIST DE VALIDACIÓN
- [ ] Cada query a `LEGACY_DB` es exclusivamente `SELECT`.
- [ ] No existen conexiones cruzadas (APP_DB en módulos legacy).
- [ ] Las transacciones solo se usan en `APP_DB`.
- [ ] El Connection Pool está configurado correctamente.
- [ ] Los tiempos de espera (timeouts) están configurados: LEGACY_DB (5s), APP_DB (10s).
- [ ] Se registra cada intento de escritura fallido en `LEGACY_DB`.
- [ ] **Cada query concurrente usa su propio `pool.request()`** (nunca compartir un Request en Promise.all).
