---
name: audit-fixes-cip-cusco
description: Aplica correcciones de auditoría y seguridad, ejecuta las pruebas OBLIGATORIAMENTE de manera LOCAL y BLOQUEA cualquier subida o despliegue al servidor hasta contar con la confirmación explícita del usuario.
---

# Skill: Correcciones de Auditoría y Despliegue Seguro (CIP Cusco)

## Cuándo se activa
Cuando el usuario solicite aplicar correcciones de auditoría, ajustes de seguridad/usuarios/roles, o cuando se gestione el ciclo de pruebas y despliegue del sistema.

## Reglas de Oro (Límites Estrictos)
1. **Pruebas Primero de Manera LOCAL (Obligatorio):**
   - Toda validación técnica, compilación de frontend/backend, pruebas unitarias y pruebas de verificación DEBEN ejecutarse y aprobarse al 100% en el entorno LOCAL antes de considerar cualquier pase a producción.
2. **Confirmación Explícita para Subir al Servidor (Gate Bloqueante):**
   - TIENES PROHIBIDO hacer push a repositorios remotos o ejecutar scripts de despliegue hacia el servidor (`desplegar.ps1`, SSH directo de actualización) sin la aprobación y confirmación expresa del usuario.
   - Si las pruebas locales pasan, se debe reportar el resultado al usuario y **esperar su autorización explícita** antes de desplegar.
3. **Cero refactors no solicitados:** Solo se modifican los archivos involucrados directamente en la solicitud.
4. **Zonas Intocables:**
   - `backend/src/usuarios/usuarios.controller.ts` (ya blindado con RBAC).
   - El flujo de cambio obligatorio de contraseña (`debeCambiarPassword`), recuperación de tokens SHA-256 y auditoría inmutable.
   - Paleta sobria institucional `#8f0404` y directivas de diseño de `AGENTS.md`.

## Flujo de Trabajo Obligatorio (Fases)

### Fase A — Planificación
- Identificar archivos a modificar y presentar el alcance si la tarea involucra seguridad crítica.

### Fase B — Implementación
- Modificar el código respetando DTOs tipados, RBAC, auditoría y Tailwind soberbio institucional.

### Fase C — Gate de Pruebas y Validación LOCAL (OBLIGATORIO)
1. **Compilación Backend:** `npm --prefix backend run build` (100% exitoso).
2. **Compilación Frontend:** `npm --prefix frontend run build` (100% exitoso, rutas y tipados validados).
3. **Pruebas Unitarias:** `npm --prefix backend test` (100% de tests en verde).
4. **Validación de Funcionalidad Local:** Verificar endpoints y comportamiento localmente en desarrollo.

### Fase D — Notificación y Espera de Confirmación (BLOQUEO)
- Informar al usuario que todas las pruebas locales concluyeron en verde.
- Explicar las novedades listas para subir.
- **Detener el flujo y solicitar confirmación explícita** del usuario para proceder al despliegue remoto.

### Fase E — Despliegue al Servidor Remoto (Solo tras confirmación)
- Tras la confirmación del usuario, realizar el commit, push a `origin main`, y ejecutar el script `desplegar.ps1`.
- Verificar en el servidor el estado de PM2 y endpoints de salud.
