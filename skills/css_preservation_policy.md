# SKILL: CSS Preservation Policy & Anti-Regression Design Standard

## OBJETIVO Y PRINCIPIO RECTOR
Garantizar la estabilidad visual absoluta de la interfaz del Sistema CIP. **QUEDA ESTRICTAMENTE PROHIBIDO MODIFICAR, SOBREESCRIBIR O BORRAR ARCHIVOS CSS GLOBALES** (`globals.css`, `tailwind.config.ts`, resets, o reglas base) salvo orden expresa, unívoca y literal del usuario.

---

## 1. REGLAS MANDATORIAS SOBRE EL CSS

### ❌ PROHIBICIONES TOTALES
1. **NO TOCAR `frontend/src/app/globals.css`:**
   - No alterar las variables CSS en `:root` (`--color-primary`, `--color-bg`, etc.).
   - No eliminar ni modificar las reglas de protección contra desbordamiento de SVGs (`svg { ... }`, `svg.animate-spin`).
   - No modificar las clases utilitarias de `@layer components` (`.btn-primary`, `.card`, `.input-field`, etc.).
2. **NO TOCAR `frontend/tailwind.config.ts`:**
   - La paleta y extensiones temáticas están congeladas. No renombrar ni redefinir tokens existentes.
3. **NO EJECUTAR `npm run build` MIENTRAS `npm run dev` ESTÉ CORRIENDO:**
   - **Causa raíz de CSS roto:** En Next.js, ejecutar `next build` sobreescribe el directorio `.next` mientras el servidor de desarrollo está activo. Esto invalida los hashes de los chunks de CSS en desarrollo y genera errores 404 / pantalla en blanco sin estilos (FOUC).
   - Para verificar tipos sin destruir la caché de desarrollo de CSS, usar `npx tsc --noEmit`.

---

## 2. POLÍTICA PARA CAMBIOS DE ESTILO ESPECÍFICOS

Cuando el usuario solicite un ajuste de color o estilo en una sección o componente puntual (por ejemplo: *"cambia el color del sidebar"* o *"cambia el botón de tal vista"*):

1. **Aislamiento a nivel de componente:**
   - El cambio se realiza **únicamente** en el archivo `.tsx` del componente afectado (ej. `Sidebar.tsx`).
   - Usar clases contextuales de Tailwind o estilos inline específicos del elemento.
2. **Cero efectos colaterales:**
   - Ningún cambio local debe propagarse a través de variables globales que puedan quebrar otros módulos o vistas.
3. **Restauración de caché de CSS si ocurre desincronización:**
   - Si el CSS llega a desfasarse en el navegador, detener el proceso `next dev`, purgar la carpeta `.next` y reiniciar `npm run dev` limpiamente para que Tailwind regenere los estilos JIT en tiempo real.

---

## 3. CHECKLIST ANTES DE FINALIZAR CUALQUIER TAREA UI
- [ ] ¿Se mantuvieron intactos `globals.css` y `tailwind.config.ts`? **SÍ**.
- [ ] ¿El servidor `next dev` sigue respondiendo HTTP 200 con su hoja de estilos generada? **SÍ**.
- [ ] ¿Se verificó que no haya desbordamiento de íconos o pérdida de fuentes tipográficas? **SÍ**.
