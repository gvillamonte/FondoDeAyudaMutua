# SKILL: Color Palette Checker - UI/UX Design Compliance

## OBJETIVO
Validar que todos los componentes UI del sistema cumplan estrictamente con la paleta de colores institucional y las restricciones de diseño definidas en AGENTS.md.

## PALETA DE COLORES AUTORIZADA

| Token CSS          | Valor HEX  | Aplicación                                     |
|--------------------|------------|------------------------------------------------|
| `--color-primary`  | `#3258CA`  | Sidebar, Header, botones principales, menús    |
| `--color-white`    | `#FFFFFF`  | Contenedores, tarjetas, formularios            |
| `--color-bg`       | `#F8FAFC`  | Fondo general del layout                       |
| `--color-text`     | `#1E293B`  | Títulos, labels, contenido                     |
| `--color-text-sec` | `#64748B`  | Descripciones, placeholders                    |
| `--color-border`   | `#E2E8F0`  | Separadores, bordes                            |
| `--color-error`    | `#DC2626`  | Errores, validación                            |
| `--color-success`  | `#16A34A`  | Éxito, estados activos                         |
| `--color-warning`  | `#D97706`  | Advertencias, estados pendientes               |

## PROHIBICIONES DE COLOR

### Colores Prohibidos (Clasificación de Rechazo Automático)
- **Neón/Fluorescentes:** `#00FF00`, `#FF00FF`, `#00FFFF`, `#FFFF00` y derivados saturados.
- **Morados/Violetas:** Cualquier tono en el rango `hsl(260-300, ...)`.
- **Gradientes Tech/AI:** `linear-gradient(...)` con colores no autorizados.
- **Sombras Coloridas:** `box-shadow` con valores que no sean grises o con alpha bajo.
- **Glow Effects:** `text-shadow`, `box-shadow` con spread > 0 y color saturado.

### Clases CSS de Tailwind Prohibidas
```css
/* PROHIBIDO */
.bg-gradient-to-r from-purple-500 to-pink-500
.shadow-lg.shadow-purple-500/50
.text-fuchsia-500
.bg-neon-green
.animate-pulse (en elementos decorativos)

/* PERMITIDO */
.bg-[#3258CA]
.text-white
.bg-[#F8FAFC]
.text-[#1E293B]
.border-[#E2E8F0]
.bg-[#16A34A]
.bg-[#DC2626]
```

## REGLAS DE VALIDACIÓN

### Para Componentes React/Next.js
1. **Tailwind CSS:** Solo usar colores de la paleta autorizada en clases utilitarias.
2. **CSS Modules:** Definir variables CSS en `:root` y referenciarlas.
3. **Styled Components / Emotion:** Usar tokens de diseño, no valores hardcoded no autorizados.

### Para Archivos CSS Globales
```css
:root {
  --color-primary: #3258CA;
  --color-white: #FFFFFF;
  --color-bg: #F8FAFC;
  --color-text: #1E293B;
  --color-text-sec: #64748B;
  --color-border: #E2E8F0;
  --color-error: #DC2626;
  --color-success: #16A34A;
  --color-warning: #D97706;
}
```

### Configuración de Tailwind
```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        primary: '#3258CA',
        'bg-layout': '#F8FAFC',
        'text-main': '#1E293B',
        'text-sec': '#64748B',
        'border-main': '#E2E8F0',
        error: '#DC2626',
        success: '#16A34A',
        warning: '#D97706',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
};
```

## CHECKLIST DE VALIDACIÓN
- [ ] No existen valores hex fuera de la paleta en componentes.
- [ ] No hay gradientes con colores no autorizados.
- [ ] No hay sombras con colores saturados.
- [ ] Tipografía es exclusivamente Inter/system-ui/sans-serif.
- [ ] La sidebar usa `#3258CA` como fondo.
- [ ] El header usa `#3258CA` como fondo.
- [ ] Los botones principales usan `#3258CA`.
- [ ] El fondo general del layout es `#F8FAFC`.
- [ ] No hay animaciones decorativas excesivas.
- [ ] La apariencia es sobria, bancaria y profesional.
