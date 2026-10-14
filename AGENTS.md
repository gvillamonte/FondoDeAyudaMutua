# AGENT DIRECTIVES & GUIDELINES: SISTEMA DE BENEFICIOS COLEGIALES

## CONTEXTO Y ARQUITECTURA

- **Stack:** TypeScript end-to-end (Node.js/NestJS backend + React/Next.js frontend).
- **Patrón:** Multi-Database / Dual DataSource.
  1. `LEGACY_DB` (SQL Server / PostgreSQL): Solo lectura (`SELECT`). Contiene el padrón maestro de colegiados.
  2. `APP_DB` (PostgreSQL): Lectura y Escritura (`CRUD`). Dominio de Beneficios, Pagos, Usuarios, Audit Log, Stored Procedures y Funciones.
- **Vinculación:** Clave foránea lógica `colegiado_id` en `APP_DB` referenciando registros en `LEGACY_DB`.
- **ORM:** Prisma con tipado estático estricto y Connection Pooling.
- **API Protocol:** RESTful con respuestas estandarizadas `{ success: boolean, data: T, error: string | null }`.

## REGLAS DE DISEÑO UI/UX (Enterprise Strict)

### Layout
- **Patrón:** Classic Admin Dashboard.
  - Header superior fijo con datos del usuario y rol.
  - Sidebar colapsable a la izquierda.
  - Área central de trabajo con scroll independiente.
  - Modales/Drawers para formularios de captura rápida.
  - Breadcrumbs para navegación jerárquica.

### Paleta de Colores
| Elemento           | Color     | Uso                                          |
|--------------------|-----------|----------------------------------------------|
| Primario Institucional | `#3258CA` | Sidebar, Header, botones principales, menús activos |
| Blanco             | `#FFFFFF` | Contenedores, tarjetas, formularios           |
| Gris Claro         | `#F8FAFC` | Fondo general del layout                      |
| Texto Principal    | `#1E293B` | Títulos, labels, contenido                    |
| Texto Secundario   | `#64748B` | Descripciones, placeholders                   |
| Borde              | `#E2E8F0` | Separadores, bordes de tarjetas               |
| Error              | `#DC2626` | Mensajes de error, validación                 |
| Éxito              | `#16A34A` | Confirmaciones, estados activos               |
| Advertencia        | `#D97706` | Warnings, estados pendientes                  |

### Prohibiciones de Diseño
- **NO** usar gradientes neón, tonos morados o estéticas tipo 'AI/Tech'.
- **NO** usar sombras coloridas o glow effects.
- **NO** usar animaciones excesivas o transiciones llamativas.
- **NO** usar tipografías decorativas. Solo Inter, system-ui o fuentes sans-serif estándar.
- **SIEMPRE** mantener apariencia sobria, bancaria y profesional.

### Componentes UI
- DataTables con Server-Side Pagination (10, 25, 50 registros).
- Ordenamiento por columna Asc/Desc.
- Búsqueda global por campos clave (DNI, N° Colegiatura).
- Filtros por columna con dropdowns.
- Exportación a PDF y Excel/CSV.
- Drawers laterales para formularios de captura.
- Modales de confirmación para acciones destructivas.
- Toast notifications para feedback de operaciones.

## ESTÁNDARES DE CÓDIGO

### DTOs y Validación
- Uso estricto de `class-validator` y `class-transformer` para validación de entradas.
- Todos los endpoints deben recibir DTOs tipados con decoradores de validación.
- Validación a nivel de controller antes de llegar al service.

### Manejo de Errores
- Respuestas HTTP estandarizadas:
  ```json
  {
    "success": boolean,
    "data": T | null,
    "error": string | null,
    "timestamp": "ISO-8601"
  }
  ```
- Códigos HTTP correctos: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 500 (Internal Server Error).

### Audit Log
- Toda mutación en `APP_DB` debe registrar:
  - `user_id`: ID del usuario que realiza la acción.
  - `action`: Tipo de acción (`CREATE`, `UPDATE`, `DELETE`).
  - `entity`: Entidad afectada (`beneficio`, `pago`, `usuario`).
  - `entity_id`: ID del registro afectado.
  - `changes_json`: JSON con los cambios realizados (old vs new).
  - `ip_address`: Dirección IP del cliente.
  - `timestamp`: Marca de tiempo ISO-8601.
- La tabla `audit_logs` es **IMMUTABLE**: no permite UPDATE ni DELETE.

### Naming Conventions
- **Archivos:** `kebab-case` para archivos (`beneficio.service.ts`), `PascalCase` para clases.
- **Variables/Funciones:** `camelCase`.
- **Tablas DB:** `snake_case` plural (`beneficios`, `pagos`, `audit_logs`).
- **Endpoints REST:** `kebab-case` plural (`/api/beneficios`, `/api/pagos`).
- **DTOs:** Sufijo `.dto.ts`, Clases con sufijo `Dto` (`CrearBeneficioDto`).

## SEGURIDAD

### Autenticación
- Protocolo JWT con Access Token (15 min) y Refresh Token (7 días).
- Tokens almacenados en httpOnly cookies (producción) o localStorage (desarrollo).
- **SHA-256 hash** en refresh tokens (NO bcrypt) — ver `skills/auth_token_lifecycle.md`.
- Endpoint de refresh token para renovación silenciosa. El frontend usa `api` axios client (nunca `fetch()` directo).

### Control de Acceso (RBAC)
- Roles definidos:
  - `ADMINISTRADOR`: Acceso total a todos los módulos y configuración.
  - `OPERADOR_PAGOS`: CRUD de beneficios y pagos, lectura de colegiados.
  - `AUDITOR`: Solo lectura de todos los módulos + exportación de reportes.
- Guards a nivel de API (NestJS Guards) y Frontend (middleware de rutas).
- Cada endpoint debe especificar los roles permitidos.

### Base de Datos Legado
- **PROHIBICIÓN ABSOLUTA:** No ejecutar `INSERT`, `UPDATE`, `DELETE` o `TRUNCATE` sobre `LEGACY_DB`.
- Solo se permiten consultas `SELECT` con `JOIN` opcional.
- Cualquier intento de escritura sobre `LEGACY_DB` debe ser bloqueado por el `ReadOnlyGuard`.

## ESTRUCTURA DEL PROYECTO

```
Sistema CIP/
├── AGENTS.md                    # Este archivo
├── .env.example                 # Variables de entorno
├── backend/                     # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma        # APP_DB schema (beneficiarios, solicitudes, tipos_beneficio, etc.)
│   │   └── legacy.prisma        # LEGACY_DB schema (read-only)
│   └── src/
│       ├── config/              # Configuración global
│       ├── auth/                # JWT, RBAC, Guards, tokens hasheados con SHA-256
│       ├── legacy/              # Consultas a DB legado (read-only, cada query su propio Request)
│       ├── colegiados/          # Proxy de lectura de colegiados (getByDni, etc.)
│       ├── fam/                 # Dominio FAM: colegiados, beneficiarios (APP_DB + legacy fusion)
│       ├── fam-beneficios/      # Expedientes de beneficio: crearRegistro, listar, detalle, documentos
│       ├── fam-covid/           # Ayuda COVID: CRUD asignaciones, comprobantes, modalidades, PDF
│       ├── beneficios/          # CRUD Beneficios legados (legacy, solo lectura)
│       ├── pagos/               # CRUD Pagos (APP_DB)
│       ├── audit/               # Sistema de auditoría (audit_logs immutables)
│       └── common/              # Filtros, interceptores, DTOs compartidos
├── frontend/                    # Next.js App
│   └── src/
│       ├── app/                 # App Router pages
│       │   └── dashboard/
│       │       ├── beneficios/  # Módulo beneficios (legacy)
│       │       ├── colegiados/  # Módulo colegiados (autocomplete, tabla)
│       │       ├── pagos/       # Módulo pagos
│       │       └── fam/         # Módulo FAM: beneficiarios, expedientes
│       │           └── covid/   # Ayuda COVID: registro, comprobantes, PDFs
│       ├── components/
│       │   ├── fam/             # RegistroExpedienteDrawer, DetalleExpedienteModal
│       │   └── layout/          # Sidebar (auto-open por ruta activa)
│       ├── lib/                 # api.ts (axios auto-refresh), auth.ts
│       └── types/               # Tipos TypeScript compartidos
├── sql/                         # Scripts de migración secuenciales
│   ├── 001_create_app_db.sql
│   ├── ...010_expediente_solicitante.sql
│   ├── 011_catalogos_memorandos_cartas.sql
│   ├── 012_fam_covid_asignaciones.sql
│   └── 013_reembolso_comprobantes.sql
├── skills/                      # Reglas para el agente de IA (CRÍTICAS — evitar regresiones)
│   ├── db_connection_manager.md # Dual datasource, Request sharing, fusión legacy+APP_DB
│   ├── color_palette_checker.md # Paleta #3258CA
│   ├── audit_logger_interceptor.md # Campos exactos AuditLog, snapshot solicitante
│   └── auth_token_lifecycle.md  # SHA-256 refresh, api client, localStorage
└── backend/cleanup.js           # Utilidad para limpiar datos de tests
```

## COMANDOS DE DESARROLLO

### Backend
```bash
cd backend
npm install                    # Instalar dependencias
npx prisma generate            # Generar cliente Prisma
npx prisma migrate dev         # Ejecutar migraciones
npm run start:dev              # Servidor en desarrollo (puerto 3001)
npm run build                  # Build de producción
npm run lint                   # Linting con ESLint
```

### Frontend
```bash
cd frontend
npm install                    # Instalar dependencias
npm run dev                    # Servidor en desarrollo (puerto 3000)
npm run build                  # Build de producción
npm run lint                   # Linting con ESLint + TypeScript
```

### SQL Migrations
```bash
# Ejecutar en orden secuencial contra APP_DB:
psql -U app_user -d app_db -f sql/001_create_app_db.sql
psql -U app_user -d app_db -f sql/002_create_stored_procedures.sql
psql -U app_user -d app_db -f sql/003_create_functions.sql
# ... (migraciones intermedias 004-008)
psql -U app_user -d app_db -f sql/009_expedientes_fam.sql
psql -U app_user -d app_db -f sql/010_expediente_solicitante.sql
```

## FLUJO DE DESARROLLO

1. **Explorar** el contexto del código existente antes de generar código nuevo.
2. **Validar** que los colores cumplan con la paleta institucional `#3258CA`.
3. **Crear** DTOs con validación antes de implementar endpoints.
4. **Implementar** el Audit Log en cada operación de escritura.
5. **Verificar** que `LEGACY_DB` solo reciba consultas SELECT.
6. **Ejecutar** lint y typecheck después de cada cambio significativo.
7. **No** crear documentación a menos que se solicite explícitamente.
