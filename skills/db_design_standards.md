# SKILL: Estándares de Diseño de Base de Datos (APP_DB)

## CUÁNDO APLICAR
Siempre que se cree o modifique una tabla en la base de datos de aplicación
(`DBCIPBeneficios`). Obligatorio ANTES de generar cualquier DDL.

## REGLAS DE DISEÑO OBLIGATORIAS

### 1. Claves Primarias
- Toda tabla usa **PK `id INT IDENTITY(1,1)`** (numérica autoincremental).
- PROHIBIDO: UUID/NVarChar(36) como PK, columnas `codigo`/`clave` como identificador
  de negocio dentro de la PK o como sustituto de la PK.
- Los códigos legibles (ej. `PEN`, `FALLECIMIENTO`) NO se usan como identificadores;
  si un vínculo lógico con otro sistema lo requiere, va en columna aparte documentada
  (ej. `aplica_a`) nunca como clave.

### 2. Relaciones (FOREIGN KEYS)
- Toda relación entre tablas internas se declara como **CONSTRAINT FK real** en la BD,
  no solo en el ORM.
- Convención de nombre de FK: `FK_<tabla_hija>_<tabla_padre>`.
- Columna FK: `<entidad>_id INT` (ej. `metodo_pago_id`, `usuario_id`, `beneficio_id`).
- Referencias al LEGACY_DB (`DBCIPCusco`, ej. `colegiado_id`) quedan como `VARCHAR`
  por diseño multi-base (referencia lógica, sin FK física posible). Documentarlo siempre.

### 3. Normalización mínima exigida
- 1FN: sin columnas repetidas/grupo (listas en texto).
- 2FN/3FN: ningún atributo no clave dependiente de otra columna no clave
  (ej. NO guardar nombre del método en `pagos`; guardar `metodo_pago_id` y resolver por JOIN).
- Catálogos separados en su propia tabla (estados, monedas, métodos, montos, tipos).

### 4. Columnas de auditoría técnica
Toda tabla incluye: `created_at DATETIME2 DEFAULT GETDATE()`,
`updated_at DATETIME2 DEFAULT GETDATE()` (mantenido por Prisma `@updatedAt`).
La auditoría de negocio va en `audit_logs` (inmutable), no en las tablas.

### 5. Nombres (snake_case)
- Tablas: plural snake_case (`metodos_pago`, `solicitudes_beneficio`).
- Columnas: singular snake_case (`fecha_pago`, `registrado_por`).
- Sin abreviaturas ambiguas.

## FLUJO DE TRABAJO DEL AGENTE

1. **Diseñar antes de crear**: proponer el diagrama entidad-relación de la zona afectada
   (tablas, PK, FK, tipos) y las sentencias DDL antes de ejecutar.
2. **Preguntar alcance**: si el cambio afecta tablas existentes o datos, preguntar
   explícitamente qué tablas entran y si se migran datos.
3. **Migración reproducible**: todo DDL va a `sql/NNN_*.sql` secuencial e idempotente
   (`IF NOT EXISTS` / `IF EXISTS`), nunca solo a mano contra la BD.
4. **Prisma sincronizado**: tras cada DDL, actualizar `schema.prisma`
   (Int @id @default(autoincrement()), relaciones `@relation`) y `npx prisma generate`.
5. **Código acorde**: DTOs con `@IsInt()` para IDs numéricos (no `@IsUUID`),
   servicios resolviendo entidades por `id` numérico.
6. **Verificación**: probar CRUD end-to-end y validar que los JOINs por FK funcionan.

## ANTI-PATRONES PROHIBIDOS (detectados y corregidos en este proyecto)
- ❌ Guardar el nombre/código del catálogo en la tabla de hechos (`pagos.medio_pago = 'YAPE'`)
  en lugar de una FK (`pagos.metodo_pago_id`).
- ❌ Mezclar catálogos genéricos en una sola tabla polimórfica
  (`fam_configuracion` con grupo+clave+valor) cuando cada catálogo merece tabla propia.
- ❌ Crear tablas nuevas sin consultar cómo impactan las existentes.
