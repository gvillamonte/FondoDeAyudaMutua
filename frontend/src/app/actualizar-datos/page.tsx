'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import api from '@/lib/api';
import {
  validarEmail,
  validarCelular,
  validarFechas,
  detectarSexoPorNombre,
  normalizarEstadoCivil,
} from '@/lib/validadores-actualizacion';

interface ColegiadoData {
  colegiadoId: string;
  cip: string;
  dni: string;
  tipoDocumento?: string;
  tipoDocumentoNombre?: string;
  esVitalicio?: boolean;
  tipoAsociado?: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  especialidad: string;
  estadoColegiatura: string;
  habilitado: boolean;
  fechaUltimoPago: string | null;
  fechaHabilitado: string | null;
  fechaIngreso: string | null;
  email: string;
  celular: string;
  fechaNacimiento: string;
  sexo: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  referencia: string;
  estadoCivil: string;
  estadoCivilCodigo: string;
  tieneActualizacionPrevia: boolean;
  ultimaActualizacionFecha: string | null;
}

type PasoVerificacion = 'CONSULTA' | 'PREGUNTAS' | 'FORM';

interface PreguntaSeguridad {
  id: number;
  enunciado: string;
  opciones: string[];
  respuestaCorrecta: string;
}

// Algoritmo Fisher-Yates para barajar arreglos de forma imparcial
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CAPITULOS_CIP_CUSCO: { nombre: string; keywords: string[] }[] = [
  {
    nombre: 'agroindustrial',
    keywords: ['AGROINDUSTRIAL', 'AGROINDUSTRIAS'],
  },
  {
    nombre: 'agronómica',
    keywords: ['AGRONOMICA', 'AGRONOMIA', 'AGRICOLA'],
  },
  {
    nombre: 'ambiental',
    keywords: ['AMBIENTAL', 'ECOLOGICA', 'RECURSOS NATURALES'],
  },
  {
    nombre: 'civil',
    keywords: ['CIVIL', 'ESTRUCTURAS', 'CONSTRUCCION', 'VIAL', 'HIDRAULICA'],
  },
  {
    nombre: 'eléctrica',
    keywords: ['ELECTRICA', 'ELECTROMECANICA'],
  },
  {
    nombre: 'electrónica',
    keywords: ['ELECTRONICA', 'TELECOMUNICACIONES'],
  },
  {
    nombre: 'geológica',
    keywords: ['GEOLOGICA', 'GEOLOGIA', 'GEOFISICA'],
  },
  {
    nombre: 'industrial',
    keywords: ['INDUSTRIAL', 'INDUSTRIAS', 'PRODUCCION'],
  },
  {
    nombre: 'informática y de sistemas',
    keywords: ['SISTEMAS', 'INFORMATICA', 'SOFTWARE', 'COMPUTACION', 'REDES'],
  },
  {
    nombre: 'mecánica',
    keywords: ['MECANICA', 'MECATRONICA'],
  },
  {
    nombre: 'metalúrgica',
    keywords: ['METALURGICA', 'METALURGIA'],
  },
  {
    nombre: 'minas',
    keywords: ['MINAS', 'MINERA'],
  },
  {
    nombre: 'química',
    keywords: ['QUIMICA', 'PETROQUIMICA'],
  },
  {
    nombre: 'zootécnica',
    keywords: ['ZOOTECNICA', 'ZOOTECNIA'],
  },
];

function obtenerCapituloPregunta(esp: string | null | undefined): string {
  if (!esp) return 'civil';
  const espNorm = esp.toUpperCase();
  const cap = CAPITULOS_CIP_CUSCO.find((c) => c.keywords.some((kw) => espNorm.includes(kw)));
  if (cap) return cap.nombre;

  return (
    esp
      .trim()
      .toLowerCase()
      .replace(/^ingenier[ií]a\s+(de\s+|del\s+)?/i, '')
      .replace(/^ing\.\s+(de\s+|del\s+)?/i, '')
      .trim() || 'civil'
  );
}

function generarPreguntasSeguridad(col: ColegiadoData): PreguntaSeguridad[] {
  const candidatas: { enunciado: string; opciones: string[]; respuestaCorrecta: string }[] = [];

  // 1. Pregunta: Año de Incorporación / Colegiatura CIP
  let yearColegiatura = '';
  if (col.fechaIngreso) {
    try {
      const y = new Date(col.fechaIngreso).getFullYear();
      if (!isNaN(y) && y > 1950 && y <= new Date().getFullYear()) {
        yearColegiatura = y.toString();
      }
    } catch { }
  }

  if (yearColegiatura) {
    const yNum = parseInt(yearColegiatura, 10);
    const deltas = shuffleArray([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
    const distSet = new Set<string>();
    for (const d of deltas) {
      const cand = (yNum + d).toString();
      if (cand !== yearColegiatura && parseInt(cand) > 1950 && parseInt(cand) <= new Date().getFullYear()) {
        distSet.add(cand);
        if (distSet.size >= 3) break;
      }
    }
    let fallback = 6;
    while (distSet.size < 3) {
      distSet.add((yNum + fallback).toString());
      fallback++;
    }
    candidatas.push({
      enunciado: '¿En qué año se incorporó o colegió al Colegio de Ingenieros del Perú (CIP)?',
      opciones: shuffleArray(Array.from(new Set([yearColegiatura, ...Array.from(distSet)]))),
      respuestaCorrecta: yearColegiatura,
    });
  }

  // 2. Pregunta: Dos últimos dígitos del número de CIP
  if (col.cip && col.cip.trim().length >= 2) {
    const ultimosDigitos = col.cip.trim().slice(-2);
    const num = parseInt(ultimosDigitos, 10) || 0;
    const offsets = shuffleArray([11, 17, 23, 29, 37, 43, 53, 67, 79]);
    const distSet = new Set<string>();
    for (const off of offsets) {
      const cand = String((num + off) % 100).padStart(2, '0');
      if (cand !== ultimosDigitos) {
        distSet.add(cand);
        if (distSet.size >= 3) break;
      }
    }
    candidatas.push({
      enunciado: '¿Cuáles son los dos últimos dígitos de su número de CIP?',
      opciones: shuffleArray(Array.from(new Set([ultimosDigitos, ...Array.from(distSet)]))),
      respuestaCorrecta: ultimosDigitos,
    });
  }

  // 3. Pregunta: Año de Nacimiento
  let yearNac = '';
  if (col.fechaNacimiento) {
    try {
      const y = new Date(col.fechaNacimiento).getFullYear();
      if (!isNaN(y) && y > 1930 && y < 2010) {
        yearNac = y.toString();
      }
    } catch { }
  }

  if (yearNac) {
    const yNum = parseInt(yearNac, 10);
    const deltas = shuffleArray([-4, -3, -2, -1, 1, 2, 3, 4]);
    const distSet = new Set<string>();
    for (const d of deltas) {
      const cand = (yNum + d).toString();
      if (cand !== yearNac && parseInt(cand) > 1930 && parseInt(cand) < 2010) {
        distSet.add(cand);
        if (distSet.size >= 3) break;
      }
    }
    let fallback = 5;
    while (distSet.size < 3) {
      distSet.add((yNum + fallback).toString());
      fallback++;
    }
    candidatas.push({
      enunciado: '¿Cuál es su año de nacimiento según su documento de identidad?',
      opciones: shuffleArray(Array.from(new Set([yearNac, ...Array.from(distSet)]))),
      respuestaCorrecta: yearNac,
    });
  }

  // 4. Pregunta: Condición colegial actual
  const estadoReal = col.esVitalicio
    ? 'Miembro Vitalicio'
    : col.habilitado
      ? 'Colegiado Habilitado'
      : 'Colegiado No Habilitado';
  const opcionesCondicion = shuffleArray([
    'Colegiado Habilitado',
    'Colegiado No Habilitado',
    'Miembro Vitalicio',
    'Colegiado Temporal',
  ]);
  candidatas.push({
    enunciado: '¿Cuál es su condición colegial actual registrada en el CIP Cusco?',
    opciones: opcionesCondicion,
    respuestaCorrecta: estadoReal,
  });

  // 5. Pregunta: Capítulo Profesional Oficial CIP Cusco (en minúsculas y sin "ingeniería")
  const espReal = obtenerCapituloPregunta(col.especialidad);

  const distractoresEsp = shuffleArray(
    CAPITULOS_CIP_CUSCO.map((c) => c.nombre).filter((nom) => nom !== espReal)
  ).slice(0, 3);

  const opcionesEsp = shuffleArray(Array.from(new Set([espReal, ...distractoresEsp])));
  candidatas.push({
    enunciado: '¿A qué capítulo pertenece en el CIP Cusco?',
    opciones: opcionesEsp,
    respuestaCorrecta: espReal,
  });

  // Barajar aleatoriamente todas las preguntas candidatas para que cambien cada vez
  const preguntasSeleccionadas = shuffleArray(candidatas).slice(0, 3);

  // Asignar id secuencial (1, 2, 3) y barajar las opciones internas de respuesta
  return preguntasSeleccionadas.map((p, idx) => ({
    id: idx + 1,
    enunciado: p.enunciado,
    opciones: shuffleArray(p.opciones),
    respuestaCorrecta: p.respuestaCorrecta,
  }));
}

function formatearFechaDisplay(f: string | null | undefined): string {
  if (!f) return 'No registrada';
  const parte = f.slice(0, 10);
  const match = parte.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return parte;
}

// ============================================================================
// GENERADOR DE CAPTCHA LOCAL CONFIABLE (SVG Anti-Bot)
// Sin ambigüedades (excluye 0, O, 1, I, L) - 100% Funcional sin dependencias
// ============================================================================
const CARACTERES_SEGUROS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const COLORES_TEXTO = ['#ac0505', '#8f0404', '#1E293B', '#334155', '#0f172a'];
const COLORES_LINEAS = ['#CBD5E1', '#94A3B8', '#E2E8F0', '#FCA5A5'];

interface CaptchaChar {
  char: string;
  x: number;
  y: number;
  rotate: number;
  fontSize: number;
  color: string;
}

interface CaptchaLine {
  d: string;
  color: string;
  strokeWidth: number;
}

interface CaptchaDot {
  cx: number;
  cy: number;
  r: number;
  color: string;
}

interface CaptchaData {
  code: string;
  chars: CaptchaChar[];
  lines: CaptchaLine[];
  dots: CaptchaDot[];
}

function generarCaptchaData(longitud = 5): CaptchaData {
  let code = '';
  const chars: CaptchaChar[] = [];
  const width = 180;
  const height = 48;
  const step = (width - 32) / longitud;

  for (let i = 0; i < longitud; i++) {
    const c = CARACTERES_SEGUROS[Math.floor(Math.random() * CARACTERES_SEGUROS.length)];
    code += c;
    chars.push({
      char: c,
      x: 18 + i * step + (Math.random() - 0.5) * 5,
      y: height / 2 + 7 + (Math.random() - 0.5) * 4,
      rotate: (Math.random() - 0.5) * 24, // rotación sutil (-12° a +12°)
      fontSize: Math.floor(Math.random() * 3) + 23, // 23 a 25px
      color: COLORES_TEXTO[Math.floor(Math.random() * COLORES_TEXTO.length)],
    });
  }

  const lines: CaptchaLine[] = [];
  for (let i = 0; i < 4; i++) {
    const y1 = Math.random() * height;
    const cy1 = Math.random() * height;
    const cy2 = Math.random() * height;
    const y2 = Math.random() * height;
    lines.push({
      d: `M 6 ${y1.toFixed(1)} C 60 ${cy1.toFixed(1)}, 120 ${cy2.toFixed(1)}, 174 ${y2.toFixed(1)}`,
      color: COLORES_LINEAS[i % COLORES_LINEAS.length],
      strokeWidth: Number((Math.random() * 1 + 1).toFixed(1)),
    });
  }

  const dots: CaptchaDot[] = [];
  for (let i = 0; i < 20; i++) {
    dots.push({
      cx: Math.floor(Math.random() * (width - 16) + 8),
      cy: Math.floor(Math.random() * (height - 12) + 6),
      r: Number((Math.random() * 1.2 + 0.8).toFixed(1)),
      color: i % 2 === 0 ? '#64748B' : '#ac0505',
    });
  }

  return { code, chars, lines, dots };
}

// ============================================================================
// PANEL INFORMATIVO CON EFECTO MÁQUINA DE ESCRIBIR (LETRAS BLANCAS)
// Simula digitación en tiempo real con cursor activo de alta precisión
// ============================================================================
const LINEAS_MANDATO = [
  {
    tipo: 'titulo',
    texto: '¡Mantén tus Datos Actualizados, Colegiado!',
  },
  {
    tipo: 'intro',
    texto:
      'Tener tu información al día garantiza el acceso inmediato e ininterrumpido a todos los servicios y beneficios institucionales del CIP Cusco:',
  },
  {
    tipo: 'item',
    tag: 'Grupos de WhatsApp de tu Capítulo',
    texto: 'Integración a la comunidad oficial de WhatsApp de tu Capítulo Profesional para coordinaciones y actividades gremiales.',
  },
  {
    tipo: 'item',
    tag: 'Cursos y Congresos Oficiales del CIP',
    texto: 'Tarifas especiales de colegiado, becas y certificaciones en congresos nacionales, diplomados y cursos del IEPI.',
  },
  {
    tipo: 'item',
    tag: 'Certificados Digitales de Habilidad',
    texto: 'Recepción instantánea de certificados en tu correo electrónico.',
  },
  {
    tipo: 'item',
    tag: 'Avisos Preventivos y Cuotas',
    texto: 'Alertas oportunas de cuotas ordinarias para asegurar tu condición permanente de Colegiado Habilitado.',
  },
  {
    tipo: 'item',
    tag: 'Seguridad y Confidencialidad',
    texto: 'Trámite seguro amparado bajo la Ley N° 29733 de Protección de Datos Personales.',
  },
];

function PanelInformativoMecanografiado() {
  const [lineIndex, setLineIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [terminado, setTerminado] = useState(false);

  useEffect(() => {
    if (terminado || lineIndex >= LINEAS_MANDATO.length) {
      setTerminado(true);
      return;
    }

    const currentItem = LINEAS_MANDATO[lineIndex];
    const fullText =
      currentItem.tipo === 'titulo' || currentItem.tipo === 'intro'
        ? currentItem.texto
        : `${currentItem.tag}: ${currentItem.texto}`;

    if (typedChars < fullText.length) {
      const timer = setTimeout(() => {
        setTypedChars((prev) => prev + 1);
      }, 16); // Velocidad fluida y realista de digitación
      return () => clearTimeout(timer);
    } else {
      const pause = setTimeout(() => {
        setLineIndex((prev) => prev + 1);
        setTypedChars(0);
      }, 120);
      return () => clearTimeout(pause);
    }
  }, [lineIndex, typedChars, terminado]);

  return (
    <div className="space-y-4 pt-1 select-none">
      {/* Título en Letras Blancas con Efecto Typewriter */}
      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-md leading-tight flex items-baseline flex-wrap">
        {lineIndex === 0 ? (
          <>
            <span className="text-white">{LINEAS_MANDATO[0].texto.slice(0, typedChars)}</span>
            <span className="inline-block w-2.5 h-5 bg-white ml-1.5 animate-pulse" />
          </>
        ) : (
          <span className="text-white">{LINEAS_MANDATO[0].texto}</span>
        )}
      </h1>

      {/* Texto de Introducción en Letras Blancas */}
      {lineIndex >= 1 && (
        <p className="text-xs sm:text-sm text-white/95 font-medium leading-relaxed drop-shadow-sm">
          {lineIndex === 1 ? (
            <>
              <span className="text-white">{LINEAS_MANDATO[1].texto.slice(0, typedChars)}</span>
              <span className="inline-block w-2 h-4 bg-white ml-1 animate-pulse" />
            </>
          ) : (
            <span className="text-white">{LINEAS_MANDATO[1].texto}</span>
          )}
        </p>
      )}

      {/* Lista de Beneficios que se van escribiendo secuencialmente */}
      <div className="space-y-2.5 pt-1 text-xs">
        {LINEAS_MANDATO.slice(2).map((item, idx) => {
          const itemAbsIndex = idx + 2;
          if (lineIndex < itemAbsIndex) return null;

          const isCurrent = lineIndex === itemAbsIndex;
          const fullText = `${item.tag}: ${item.texto}`;
          const currentDisplayed = isCurrent ? fullText.slice(0, typedChars) : fullText;

          const tagPrefix = `${item.tag}: `;
          let renderedTag = '';
          let renderedDesc = '';

          if (currentDisplayed.length <= tagPrefix.length) {
            renderedTag = currentDisplayed;
          } else {
            renderedTag = tagPrefix;
            renderedDesc = currentDisplayed.slice(tagPrefix.length);
          }

          return (
            <div
              key={item.tag}
              className="flex items-start gap-2.5 bg-black/40 backdrop-blur-md p-3.5 border border-white/20 text-left shadow-sm transition-all animate-in fade-in duration-200"
            >
              <span className="text-white font-bold text-sm leading-none mt-0.5 shrink-0">✓</span>
              <div className="flex-1 text-white">
                <strong className="text-white font-bold uppercase tracking-wider text-[11px] block">
                  {renderedTag.replace(': ', '')}
                </strong>
                <span className="text-white font-normal text-xs leading-snug block mt-0.5">
                  {renderedDesc}
                </span>
                {isCurrent && (
                  <span className="inline-block w-1.5 h-3.5 bg-white ml-1 animate-pulse align-middle" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// GRUPOS OFICIALES DE WHATSAPP POR CAPÍTULO PROFESIONAL (CIP CUSCO)
// ============================================================================
interface CapituloWhatsApp {
  id: string;
  nombre: string;
  enlace: string;
  keywords: string[];
}

const CAPITULOS_WHATSAPP: CapituloWhatsApp[] = [
  {
    id: 'agroindustrial',
    nombre: 'Capítulo de Ingeniería Agroindustrial',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-agroindustrial',
    keywords: ['AGROINDUSTRIAL', 'AGROINDUSTRIAS'],
  },
  {
    id: 'agronomica',
    nombre: 'Capítulo de Ingeniería Agronómica',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-agronomica',
    keywords: ['AGRONOMICA', 'AGRONOMIA', 'AGRICOLA'],
  },
  {
    id: 'ambiental',
    nombre: 'Capítulo de Ingeniería Ambiental',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-ambiental',
    keywords: ['AMBIENTAL', 'ECOLOGICA', 'RECURSOS NATURALES'],
  },
  {
    id: 'civil',
    nombre: 'Capítulo de Ingeniería Civil',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-civil',
    keywords: ['CIVIL', 'ESTRUCTURAS', 'CONSTRUCCION', 'VIAL', 'HIDRAULICA'],
  },
  {
    id: 'electrica',
    nombre: 'Capítulo de Ingeniería Eléctrica',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-electrica',
    keywords: ['ELECTRICA', 'ELECTROMECANICA'],
  },
  {
    id: 'electronica',
    nombre: 'Capítulo de Ingeniería Electrónica',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-electronica',
    keywords: ['ELECTRONICA', 'TELECOMUNICACIONES'],
  },
  {
    id: 'geologica',
    nombre: 'Capítulo de Ingeniería Geológica',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-geologica',
    keywords: ['GEOLOGICA', 'GEOLOGIA', 'GEOFISICA'],
  },
  {
    id: 'industrial',
    nombre: 'Capítulo de Ingeniería Industrial',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-industrial',
    keywords: ['INDUSTRIAL', 'INDUSTRIAS', 'PRODUCCION'],
  },
  {
    id: 'sistemas',
    nombre: 'Capítulo de Ingeniería Informática y de Sistemas',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-sistemas',
    keywords: ['SISTEMAS', 'INFORMATICA', 'SOFTWARE', 'COMPUTACION', 'REDES'],
  },
  {
    id: 'mecanica',
    nombre: 'Capítulo de Ingeniería Mecánica',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-mecanica',
    keywords: ['MECANICA', 'MECATRONICA'],
  },
  {
    id: 'metalurgica',
    nombre: 'Capítulo de Ingeniería Metalúrgica',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-metalurgica',
    keywords: ['METALURGICA', 'METALURGIA'],
  },
  {
    id: 'minas',
    nombre: 'Capítulo de Ingeniería de Minas',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-minas',
    keywords: ['MINAS', 'MINERA'],
  },
  {
    id: 'quimica',
    nombre: 'Capítulo de Ingeniería Química',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-quimica',
    keywords: ['QUIMICA', 'PETROQUIMICA'],
  },
  {
    id: 'zootecnica',
    nombre: 'Capítulo de Ingeniería Zootécnica',
    enlace: 'https://chat.whatsapp.com/invite/cip-cusco-zootecnica',
    keywords: ['ZOOTECNICA', 'ZOOTECNIA'],
  },
];

function obtenerCapituloPorEspecialidad(esp: string | undefined): CapituloWhatsApp {
  if (!esp) return CAPITULOS_WHATSAPP[0];
  const espNorm = esp.toUpperCase();
  const encontrado = CAPITULOS_WHATSAPP.find((c) =>
    c.keywords.some((kw) => espNorm.includes(kw))
  );
  return (
    encontrado || {
      id: 'general',
      nombre: `Capítulo de Ingeniería ${esp.trim()}`,
      enlace: 'https://chat.whatsapp.com/invite/cip-cusco-oficial',
      keywords: [],
    }
  );
}

interface PaisTelefono {
  codigo: string;
  pais: string;
  iso: string;
  bandera: string;
}

const PAISES_TELEFONO: PaisTelefono[] = [
  // Perú por defecto
  { codigo: '+51', pais: 'Perú', iso: 'PE', bandera: '🇵🇪' },
  // Sudamérica
  { codigo: '+54', pais: 'Argentina', iso: 'AR', bandera: '🇦🇷' },
  { codigo: '+591', pais: 'Bolivia', iso: 'BO', bandera: '🇧🇴' },
  { codigo: '+55', pais: 'Brasil', iso: 'BR', bandera: '🇧🇷' },
  { codigo: '+56', pais: 'Chile', iso: 'CL', bandera: '🇨🇱' },
  { codigo: '+57', pais: 'Colombia', iso: 'CO', bandera: '🇨🇴' },
  { codigo: '+593', pais: 'Ecuador', iso: 'EC', bandera: '🇪🇨' },
  { codigo: '+595', pais: 'Paraguay', iso: 'PY', bandera: '🇵🇾' },
  { codigo: '+598', pais: 'Uruguay', iso: 'UY', bandera: '🇺🇾' },
  { codigo: '+58', pais: 'Venezuela', iso: 'VE', bandera: '🇻🇪' },
  // Norteamérica y Centroamérica
  { codigo: '+1', pais: 'Estados Unidos / Canadá', iso: 'US', bandera: '🇺🇸' },
  { codigo: '+52', pais: 'México', iso: 'MX', bandera: '🇲🇽' },
  { codigo: '+506', pais: 'Costa Rica', iso: 'CR', bandera: '🇨🇷' },
  { codigo: '+507', pais: 'Panamá', iso: 'PA', bandera: '🇵🇦' },
  { codigo: '+502', pais: 'Guatemala', iso: 'GT', bandera: '🇬🇹' },
  { codigo: '+504', pais: 'Honduras', iso: 'HN', bandera: '🇭🇳' },
  { codigo: '+503', pais: 'El Salvador', iso: 'SV', bandera: '🇸🇻' },
  { codigo: '+505', pais: 'Nicaragua', iso: 'NI', bandera: '🇳🇮' },
  { codigo: '+53', pais: 'Cuba', iso: 'CU', bandera: '🇨🇺' },
  { codigo: '+1809', pais: 'República Dominicana', iso: 'DO', bandera: '🇩🇴' },
  // Europa
  { codigo: '+34', pais: 'España', iso: 'ES', bandera: '🇪🇸' },
  { codigo: '+39', pais: 'Italia', iso: 'IT', bandera: '🇮🇹' },
  { codigo: '+33', pais: 'Francia', iso: 'FR', bandera: '🇫🇷' },
  { codigo: '+49', pais: 'Alemania', iso: 'DE', bandera: '🇩🇪' },
  { codigo: '+44', pais: 'Reino Unido', iso: 'GB', bandera: '🇬🇧' },
  { codigo: '+351', pais: 'Portugal', iso: 'PT', bandera: '🇵🇹' },
  { codigo: '+41', pais: 'Suiza', iso: 'CH', bandera: '🇨🇭' },
  { codigo: '+31', pais: 'Países Bajos', iso: 'NL', bandera: '🇳🇱' },
  { codigo: '+32', pais: 'Bélgica', iso: 'BE', bandera: '🇧🇪' },
  { codigo: '+46', pais: 'Suecia', iso: 'SE', bandera: '🇸🇪' },
  { codigo: '+47', pais: 'Noruega', iso: 'NO', bandera: '🇳🇴' },
  { codigo: '+7', pais: 'Rusia', iso: 'RU', bandera: '🇷🇺' },
  // Asia y Oceanía
  { codigo: '+86', pais: 'China', iso: 'CN', bandera: '🇨🇳' },
  { codigo: '+81', pais: 'Japón', iso: 'JP', bandera: '🇯🇵' },
  { codigo: '+82', pais: 'Corea del Sur', iso: 'KR', bandera: '🇰🇷' },
  { codigo: '+91', pais: 'India', iso: 'IN', bandera: '🇮🇳' },
  { codigo: '+61', pais: 'Australia', iso: 'AU', bandera: '🇦🇺' },
  { codigo: '+64', pais: 'Nueva Zelanda', iso: 'NZ', bandera: '🇳🇿' },
  { codigo: '+27', pais: 'Sudáfrica', iso: 'ZA', bandera: '🇿🇦' },
];

function parsearTelefono(raw: string | null | undefined): { codigoPais: string; numero: string } {
  if (!raw) return { codigoPais: '+51', numero: '' };
  const str = raw.trim();
  if (str.startsWith('+')) {
    const ordenados = [...PAISES_TELEFONO].sort((a, b) => b.codigo.length - a.codigo.length);
    const match = ordenados.find((p) => str.startsWith(p.codigo));
    if (match) {
      const resto = str.slice(match.codigo.length).replace(/[^\d]/g, '');
      return { codigoPais: match.codigo, numero: resto };
    }
  }
  const soloNum = str.replace(/[^\d]/g, '');
  return { codigoPais: '+51', numero: soloNum };
}

export default function ActualizarDatosPage() {
  const [paso, setPaso] = useState<PasoVerificacion>('CONSULTA');

  // Campos de verificación inicial
  const [tipoDocumentoConsulta, setTipoDocumentoConsulta] = useState<'DNI' | 'CE'>('DNI');
  const [cip, setCip] = useState('');
  const [dni, setDni] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [errorCaptcha, setErrorCaptcha] = useState('');
  const [refrescandoAnim, setRefrescandoAnim] = useState(false);

  const [verificando, setVerificando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState('');

  // Preguntas secretas de seguridad
  const [preguntasSeguridad, setPreguntasSeguridad] = useState<PreguntaSeguridad[]>([]);
  const [respuestasUsuario, setRespuestasUsuario] = useState<{ [key: number]: string }>({});
  const [errorPreguntas, setErrorPreguntas] = useState('');

  // Datos recuperados del colegiado
  const [colegiado, setColegiado] = useState<ColegiadoData | null>(null);
  const [capituloWhatsAppId, setCapituloWhatsAppId] = useState<string>('');

  // Catálogos
  const [ubigeos, setUbigeos] = useState<any[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [estadosCiviles, setEstadosCiviles] = useState<{ codigo: string; nombre: string }[]>([]);

  // Formulario de edición
  const [email, setEmail] = useState('');
  const [codigoPaisCelular, setCodigoPaisCelular] = useState<string>('+51');
  const [celular, setCelular] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [sexo, setSexo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [provincia, setProvincia] = useState('');
  const [distrito, setDistrito] = useState('');
  const [referencia, setReferencia] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');

  // Declaración jurada y modales
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [modalBloqueoEstado, setModalBloqueoEstado] = useState<{
    tipo: 'FALLECIDO' | 'TEMPORAL' | 'TRANSFERIDO' | 'COOLDOWN_24H' | string;
    mensaje: string;
    cip?: string;
    proximaFechaStr?: string;
    tiempoTexto?: string;
  } | null>(null);
  const [cuentaRegresivaRedireccion, setCuentaRegresivaRedireccion] = useState(3);
  const [resumenExito, setResumenExito] = useState<any | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState('');

  // Estados de validación en tiempo real y banner central
  const [erroresValidacionCentral, setErroresValidacionCentral] = useState<string[]>([]);
  const [errorEmail, setErrorEmail] = useState('');
  const [sugerenciaEmail, setSugerenciaEmail] = useState('');
  const [errorCelular, setErrorCelular] = useState('');
  const [errorFechas, setErrorFechas] = useState('');
  const [infoSexo, setInfoSexo] = useState('');
  const centroErroresRef = useRef<HTMLDivElement>(null);

  // Temporizador estricto de edición (180 segundos / 3 minutos)
  const TIEMPO_LIMITE_EDICION_SEGUNDOS = 180;
  const [segundosRestantes, setSegundosRestantes] = useState(TIEMPO_LIMITE_EDICION_SEGUNDOS);
  const [widgetTiempoMinimizado, setWidgetTiempoMinimizado] = useState(false);

  // Control de concurrencia: Solo una pestaña activa a la vez
  const [bloqueadoPorMultiplesPestanas, setBloqueadoPorMultiplesPestanas] = useState(false);
  const tabIdRef = useRef<string>('');

  // Detección y bloqueo estricto de múltiples pestañas simultáneas
  useEffect(() => {
    let currentTabId = '';
    try {
      currentTabId = sessionStorage.getItem('cip_actualizar_datos_tab_instance_id') || '';
      if (!currentTabId) {
        currentTabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('cip_actualizar_datos_tab_instance_id', currentTabId);
      }
    } catch {
      currentTabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    tabIdRef.current = currentTabId;

    const LOCK_KEY = 'cip_actualizar_datos_active_tab_lock';
    const CHANNEL_NAME = 'cip_actualizar_datos_tab_sync';

    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
      } catch {}
    }

    const checkLockStatus = (): boolean => {
      try {
        const raw = localStorage.getItem(LOCK_KEY);
        if (!raw) return false;
        const lock = JSON.parse(raw);
        const ahora = Date.now();
        if (lock.tabId && lock.tabId !== currentTabId && ahora - lock.timestamp < 3500) {
          return true;
        }
      } catch {}
      return false;
    };

    const takeLock = () => {
      try {
        localStorage.setItem(
          LOCK_KEY,
          JSON.stringify({ tabId: currentTabId, timestamp: Date.now() })
        );
        channel?.postMessage({ type: 'CLAIM_TAB', tabId: currentTabId });
        setBloqueadoPorMultiplesPestanas(false);
      } catch {}
    };

    if (checkLockStatus()) {
      setBloqueadoPorMultiplesPestanas(true);
    } else {
      takeLock();
    }

    const heartbeatInterval = setInterval(() => {
      try {
        const raw = localStorage.getItem(LOCK_KEY);
        if (raw) {
          const lock = JSON.parse(raw);
          if (lock.tabId && lock.tabId !== currentTabId && Date.now() - lock.timestamp < 3500) {
            setBloqueadoPorMultiplesPestanas(true);
            return;
          }
        }
        localStorage.setItem(
          LOCK_KEY,
          JSON.stringify({ tabId: currentTabId, timestamp: Date.now() })
        );
      } catch {}
    }, 1000);

    const handleChannelMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || !data.type) return;

      if (data.type === 'CLAIM_TAB' && data.tabId !== currentTabId) {
        setBloqueadoPorMultiplesPestanas(true);
      } else if (data.type === 'PING_TAB' && data.tabId !== currentTabId) {
        try {
          const raw = localStorage.getItem(LOCK_KEY);
          if (raw) {
            const lock = JSON.parse(raw);
            if (lock.tabId === currentTabId) {
              channel?.postMessage({ type: 'PONG_ACTIVE', tabId: currentTabId });
            }
          }
        } catch {}
      } else if (data.type === 'PONG_ACTIVE' && data.tabId !== currentTabId) {
        setBloqueadoPorMultiplesPestanas(true);
      } else if (data.type === 'RELEASE_TAB' && data.tabId !== currentTabId) {
        setTimeout(() => {
          if (!checkLockStatus()) {
            takeLock();
          }
        }, 300);
      }
    };

    channel?.addEventListener('message', handleChannelMessage);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCK_KEY && e.newValue) {
        try {
          const lock = JSON.parse(e.newValue);
          if (lock.tabId !== currentTabId && Date.now() - lock.timestamp < 3500) {
            setBloqueadoPorMultiplesPestanas(true);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleUnload = () => {
      try {
        const raw = localStorage.getItem(LOCK_KEY);
        if (raw) {
          const lock = JSON.parse(raw);
          if (lock.tabId === currentTabId) {
            localStorage.removeItem(LOCK_KEY);
            channel?.postMessage({ type: 'RELEASE_TAB', tabId: currentTabId });
          }
        }
      } catch {}
    };
    window.addEventListener('beforeunload', handleUnload);

    channel?.postMessage({ type: 'PING_TAB', tabId: currentTabId });

    return () => {
      clearInterval(heartbeatInterval);
      channel?.removeEventListener('message', handleChannelMessage);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
      try {
        channel?.close();
      } catch {}
    };
  }, []);

  const handleTomarControlPestana = () => {
    const currentTabId = tabIdRef.current || `tab_${Date.now()}`;
    const LOCK_KEY = 'cip_actualizar_datos_active_tab_lock';
    const CHANNEL_NAME = 'cip_actualizar_datos_tab_sync';

    try {
      localStorage.setItem(
        LOCK_KEY,
        JSON.stringify({ tabId: currentTabId, timestamp: Date.now() })
      );
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel(CHANNEL_NAME);
        ch.postMessage({ type: 'CLAIM_TAB', tabId: currentTabId });
        ch.close();
      }
    } catch {}

    setBloqueadoPorMultiplesPestanas(false);
  };

  // Inicializar CAPTCHA al montar el cliente
  useEffect(() => {
    setCaptcha(generarCaptchaData(5));
  }, []);

  // Temporizador regresivo estricto para la edición de datos (180 segundos / 3 minutos)
  useEffect(() => {
    if (paso !== 'FORM' || showSuccessModal || bloqueadoPorMultiplesPestanas) return;

    const interval = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowConfirmModal(false);
          setShowTimeoutModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paso, showSuccessModal]);

  // Reinicio total y regreso a la pantalla de inicio de Actualizar Datos cuando culminan los 180 segundos
  useEffect(() => {
    if (!showTimeoutModal) {
      setCuentaRegresivaRedireccion(3);
      return;
    }

    const timer = setInterval(() => {
      setCuentaRegresivaRedireccion((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowTimeoutModal(false);
          handleReiniciar();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showTimeoutModal]);

  const formatearTiempo = (seg: number) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleIrAInicio = () => {
    setShowTimeoutModal(false);
    handleReiniciar();
  };

  // Función para refrescar el CAPTCHA
  const refrescarCaptcha = useCallback(() => {
    setRefrescandoAnim(true);
    setCaptcha(generarCaptchaData(5));
    setCaptchaInput('');
    setErrorCaptcha('');
    setTimeout(() => {
      setRefrescandoAnim(false);
    }, 250);
  }, []);

  // Cargar catálogos
  useEffect(() => {
    api
      .get('/actualizacion-datos/catalogos')
      .then((res) => {
        const uList = res.data?.ubigeos || [];
        setUbigeos(uList);
        const deps = (
          Array.from(new Set(uList.map((u: any) => u.departamento))).filter(Boolean) as string[]
        ).sort();
        setDepartamentos(deps);
        if (res.data?.estadosCiviles) {
          setEstadosCiviles(res.data.estadosCiviles);
        }
      })
      .catch((err) => {
        console.warn('No se pudieron cargar catálogos:', err.message);
      });
  }, []);

  // Provincias sincronizadas
  const provincias = useMemo(() => {
    if (!departamento || ubigeos.length === 0) return [];
    return (
      Array.from(
        new Set(
          ubigeos
            .filter((u: any) => u.departamento?.toUpperCase() === departamento.toUpperCase())
            .map((u: any) => u.provincia)
        )
      ).filter(Boolean) as string[]
    ).sort();
  }, [departamento, ubigeos]);

  // Distritos sincronizados
  const distritos = useMemo(() => {
    if (!departamento || !provincia || ubigeos.length === 0) return [];
    return (
      Array.from(
        new Set(
          ubigeos
            .filter(
              (u: any) =>
                u.departamento?.toUpperCase() === departamento.toUpperCase() &&
                u.provincia?.toUpperCase() === provincia.toUpperCase()
            )
            .map((u: any) => u.distrito)
        )
      ).filter(Boolean) as string[]
    ).sort();
  }, [departamento, provincia, ubigeos]);

  // Audio del CAPTCHA por voz
  const reproducirCaptchaVoz = () => {
    if (!captcha || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const textoPronunciar = captcha.code.split('').join(' ');
    const utter = new SpeechSynthesisUtterance(textoPronunciar);
    utter.lang = 'es-PE';
    utter.rate = 0.8;
    window.speechSynthesis.speak(utter);
  };

  // Validación inicial: CIP + DNI + CAPTCHA
  const handleConsultarColegiado = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorConsulta('');
    setErrorCaptcha('');

    const cipLimpio = cip.trim();
    const dniLimpio = dni.trim();
    const captchaLimpio = captchaInput.trim().toUpperCase();

    if (bloqueadoPorMultiplesPestanas) {
      setErrorConsulta('No puede realizar consultas mientras otra pestaña esté activa en este navegador.');
      return;
    }

    if (!cipLimpio) {
      setErrorConsulta('Por favor ingrese su número de CIP.');
      return;
    }

    if (!dniLimpio || dniLimpio.length < 4) {
      setErrorConsulta('Por favor ingrese su Documento de Identidad (DNI de 8 dígitos o Cédula).');
      return;
    }

    // Validación estricta del CAPTCHA local
    if (!captchaLimpio) {
      setErrorCaptcha('Debe escribir el código de seguridad de 5 caracteres.');
      return;
    }

    if (!captcha || captchaLimpio !== captcha.code.toUpperCase()) {
      setErrorCaptcha('Código de seguridad incorrecto. Ingrese el nuevo código mostrado.');
      refrescarCaptcha();
      return;
    }

    setVerificando(true);
    try {
      const res = await api.post('/actualizacion-datos/consultar', {
        cip: cipLimpio,
        dni: dniLimpio,
      });

      const data: ColegiadoData = res.data;
      setColegiado(data);
      setEmail(data.email || '');

      const parsedTel = parsearTelefono(data.celular);
      setCodigoPaisCelular(parsedTel.codigoPais);
      setCelular(parsedTel.numero);

      setFechaNacimiento(data.fechaNacimiento ? data.fechaNacimiento.slice(0, 10) : '');

      const deteccion = detectarSexoPorNombre(
        data.nombres || data.nombreCompleto,
        data.sexo
      );

      let sexoInicial = data.sexo || '';
      let mensajeSexo = '';
      if (!sexoInicial && deteccion.sexoDetectado) {
        sexoInicial = deteccion.sexoDetectado;
        mensajeSexo = `ℹ️ Sugerido automáticamente como ${sexoInicial === 'M' ? 'Masculino' : 'Femenino'} según su nombre ("${data.nombres || data.nombreCompleto}"). Puede modificarlo libremente.`;
      } else if (sexoInicial && deteccion.confianza === 'ALTA' && deteccion.sexoDetectado !== sexoInicial) {
        sexoInicial = deteccion.sexoDetectado;
        mensajeSexo = `ℹ️ Detectado como ${sexoInicial === 'M' ? 'Masculino' : 'Femenino'} según su nombre ("${data.nombres || data.nombreCompleto}"). Puede modificarlo si lo requiere.`;
      } else if (sexoInicial) {
        mensajeSexo = 'Según registro de colegiatura. Puede modificarlo si es necesario.';
      } else {
        mensajeSexo = `Por favor seleccione su sexo según su ${data.tipoDocumentoNombre || 'documento'}.`;
      }

      setSexo(sexoInicial);
      setInfoSexo(mensajeSexo);
      setDireccion(data.direccion || '');
      setReferencia(data.referencia || '');
      setDepartamento(data.departamento || 'CUSCO');
      setProvincia(data.provincia || 'CUSCO');
      setDistrito(data.distrito || 'WANCHAQ');

      const ecNormalizado = normalizarEstadoCivil(data.estadoCivil, data.estadoCivilCodigo);
      setEstadoCivil(ecNormalizado || 'Soltero(a)');

      const capSugerido = obtenerCapituloPorEspecialidad(data.especialidad);
      setCapituloWhatsAppId(capSugerido.id);

      // Generar 3 preguntas secretas de validación de identidad
      const questions = generarPreguntasSeguridad(data);
      setPreguntasSeguridad(questions);
      setRespuestasUsuario({});
      setErrorPreguntas('');

      // Pasar a la validación de preguntas secretas
      setPaso('PREGUNTAS');
      setErrorConsulta('');
      setErroresValidacionCentral([]);
      setErrorEmail('');
      setSugerenciaEmail('');
      setErrorCelular('');
      setErrorFechas('');
      setAceptoTerminos(false);
    } catch (err: any) {
      const errData = err.response?.data;
      const status = err.response?.status;
      const msgRaw = String(errData?.message || errData?.error || err.message || '');
      const esBloqueo =
        status === 403 ||
        Boolean(errData?.bloqueado) ||
        Boolean(errData?.cooldown) ||
        /fallecid|temporal|transferid|cooldown|24 hora/i.test(msgRaw);

      if (esBloqueo) {
        const tipoBloqueo =
          errData?.estadoColegiado ||
          (/fallecid/i.test(msgRaw)
            ? 'FALLECIDO'
            : /temporal/i.test(msgRaw)
            ? 'TEMPORAL'
            : /transferid/i.test(msgRaw)
            ? 'TRANSFERIDO'
            : 'COOLDOWN_24H');

        setModalBloqueoEstado({
          tipo: tipoBloqueo,
          mensaje:
            errData?.message ||
            (tipoBloqueo === 'FALLECIDO'
              ? 'El colegiado figura como FALLECIDO en el padrón institucional. Por disposición reglamentaria del Colegio de Ingenieros del Perú, no está permitida la actualización de datos personales.'
              : tipoBloqueo === 'TEMPORAL'
              ? 'El colegiado figura con estado TEMPORAL en el padrón institucional. No está habilitado para realizar la actualización de datos a través de este portal.'
              : tipoBloqueo === 'TRANSFERIDO'
              ? 'El colegiado figura con estado TRANSFERIDO en el padrón institucional. No está habilitado para realizar la actualización de datos en el Consejo Departamental de Cusco.'
              : 'Por motivos de seguridad institucional y resguardo de identidad, sus datos fueron actualizados recientemente. Solo se permite una actualización cada 24 horas.'),
          cip: cipLimpio,
          proximaFechaStr: errData?.proximaFechaStr,
          tiempoTexto: errData?.tiempoTexto,
        });
        refrescarCaptcha();
        return;
      }

      const isServerDown =
        err.isConnectionError ||
        err.code === 'ERR_NETWORK' ||
        !err.response ||
        (err.response?.status >= 500 && !err.response?.data?.message);
      const msg =
        err.friendlyMessage ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        (isServerDown
          ? 'Error de comunicación con el servidor. Verifique que el servicio esté activo y accesible.'
          : 'Los datos ingresados (CIP o Documento de Identidad) no coinciden con ningún colegiado registrado en el padrón oficial.');
      setErrorConsulta(msg);
      refrescarCaptcha();
    } finally {
      setVerificando(false);
    }
  };

  // Validar las 3 preguntas secretas de identidad
  const handleValidarPreguntas = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPreguntas('');

    for (const q of preguntasSeguridad) {
      if (!respuestasUsuario[q.id]) {
        setErrorPreguntas(`Por favor responda la pregunta ${q.id} para validar su identidad.`);
        return;
      }
    }

    const incorrectas = preguntasSeguridad.filter(
      (q) => String(respuestasUsuario[q.id]).trim().toLowerCase() !== String(q.respuestaCorrecta).trim().toLowerCase()
    );

    if (incorrectas.length > 0) {
      setErrorPreguntas('Una o más respuestas no coinciden con los registros oficiales de su expediente colegial. Verifique e intente nuevamente.');
      return;
    }

    // Identidad validada con éxito: dar acceso a la ficha y formulario para modificar datos
    setSegundosRestantes(TIEMPO_LIMITE_EDICION_SEGUNDOS);
    setWidgetTiempoMinimizado(false);
    setShowTimeoutModal(false);
    setPaso('FORM');
  };

  // Validaciones en tiempo real
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (!val) {
      setErrorEmail('');
      setSugerenciaEmail('');
      return;
    }
    const res = validarEmail(val);
    if (!res.valido) {
      setErrorEmail(res.mensaje || 'Formato de correo no válido');
    } else {
      setErrorEmail('');
    }
    setSugerenciaEmail(res.sugerenciaCorreccion || '');
  };

  const handleCodigoPaisChange = (nuevoCodigo: string) => {
    setCodigoPaisCelular(nuevoCodigo);
    if (!celular) {
      setErrorCelular('');
      return;
    }
    const res = validarCelular(celular, nuevoCodigo);
    if (!res.valido) {
      setErrorCelular(res.mensaje || 'Celular no válido');
    } else {
      setErrorCelular('');
    }
  };

  const handleCelularChange = (val: string) => {
    const maxLen = codigoPaisCelular === '+51' ? 9 : 15;
    const soloNum = val.replace(/\D/g, '').slice(0, maxLen);
    setCelular(soloNum);
    if (!soloNum) {
      setErrorCelular('');
      return;
    }
    const res = validarCelular(soloNum, codigoPaisCelular);
    if (!res.valido) {
      setErrorCelular(res.mensaje || 'Celular no válido');
    } else {
      setErrorCelular('');
    }
  };

  const handleFechaNacimientoChange = (val: string) => {
    setFechaNacimiento(val);
    if (!val) {
      setErrorFechas('');
      return;
    }
    const res = validarFechas(val, colegiado?.fechaIngreso);
    if (!res.valido) {
      setErrorFechas(res.mensaje || 'Fecha de nacimiento inconsistente');
    } else {
      setErrorFechas('');
    }
  };

  // Validar antes de guardar
  const handlePreGuardar = (e: React.FormEvent) => {
    e.preventDefault();

    if (bloqueadoPorMultiplesPestanas) {
      setErrorGuardar('La sesión se encuentra activa en otra pestaña.');
      return;
    }

    if (segundosRestantes <= 0) {
      setErrorGuardar(`El tiempo límite de ${TIEMPO_LIMITE_EDICION_SEGUNDOS} segundos (3 minutos) ha culminado. Por favor inicie nuevamente.`);
      return;
    }

    const listaErrores: string[] = [];

    const resEmail = validarEmail(email);
    if (!resEmail.valido) {
      listaErrores.push(`Correo Electrónico: ${resEmail.mensaje || 'Formato de correo inválido.'}`);
      setErrorEmail(resEmail.mensaje || '');
    } else {
      setErrorEmail('');
    }

    const resCelular = validarCelular(celular, codigoPaisCelular);
    if (!resCelular.valido) {
      listaErrores.push(`Número Celular: ${resCelular.mensaje || 'Número celular no válido.'}`);
      setErrorCelular(resCelular.mensaje || '');
    } else {
      setErrorCelular('');
    }

    const resFechas = validarFechas(fechaNacimiento, colegiado?.fechaIngreso);
    if (!resFechas.valido) {
      listaErrores.push(`Fecha de Nacimiento: ${resFechas.mensaje || 'Inconsistencia en fecha de nacimiento.'}`);
      setErrorFechas(resFechas.mensaje || '');
    } else {
      setErrorFechas('');
    }

    if (!sexo) {
      listaErrores.push('Sexo: Debe seleccionar Masculino o Femenino según su documento de identidad.');
    }

    if (!aceptoTerminos) {
      listaErrores.push('Declaración Jurada: Debe marcar la casilla de aceptación y veracidad de datos para continuar.');
    }

    if (listaErrores.length > 0) {
      setErroresValidacionCentral(listaErrores);
      setTimeout(() => {
        if (centroErroresRef.current) {
          centroErroresRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    setErroresValidacionCentral([]);
    setShowConfirmModal(true);
  };

  // Guardar definitivamente
  const handleConfirmarGuardar = async () => {
    if (!colegiado) return;
    setGuardando(true);
    setErrorGuardar('');

    const celularCompleto = `${codigoPaisCelular} ${celular.trim()}`.trim();

    try {
      const res = await api.post('/actualizacion-datos/actualizar', {
        cip: colegiado.cip,
        dni: colegiado.dni,
        email: email.trim(),
        celular: celularCompleto,
        fechaNacimiento: fechaNacimiento || undefined,
        sexo: sexo || undefined,
        direccion: direccion ? direccion.trim() : undefined,
        departamento: departamento ? departamento.trim() : undefined,
        provincia: provincia ? provincia.trim() : undefined,
        distrito: distrito ? distrito.trim() : undefined,
        referencia: referencia ? referencia.trim() : undefined,
        estadoCivil: estadoCivil ? estadoCivil.trim() : undefined,
      });

      const dataGuardada = res.data?.data || res.data;
      setResumenExito({
        ...dataGuardada,
        emailEnviado: res.data?.emailEnviado,
        message: res.data?.message,
        proximaFechaStr: res.data?.proximaFechaStr || dataGuardada?.proximaFechaStr,
        proximaActualizacionDisponible: res.data?.proximaActualizacionDisponible || dataGuardada?.proximaActualizacionDisponible,
        avisoSeguridad: res.data?.avisoSeguridad || dataGuardada?.avisoSeguridad,
      });
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      const errData = err.response?.data;
      if (err.response?.status === 403 && (errData?.bloqueado || errData?.cooldown || /24 hora|cooldown/i.test(errData?.message || ''))) {
        setShowConfirmModal(false);
        setModalBloqueoEstado({
          tipo: 'COOLDOWN_24H',
          mensaje: errData?.message || 'No se puede volver a actualizar datos dentro de las próximas 24 horas.',
          cip: colegiado.cip,
          proximaFechaStr: errData?.proximaFechaStr,
          tiempoTexto: errData?.tiempoTexto,
        });
        return;
      }
      const msg =
        err.friendlyMessage ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Ocurrió un error al guardar los datos. Intente nuevamente.';
      setErrorGuardar(msg);
    } finally {
      setGuardando(false);
    }
  };

  // Reiniciar
  const handleReiniciar = () => {
    setPaso('CONSULTA');
    setColegiado(null);
    setCip('');
    setDni('');
    setTipoDocumentoConsulta('DNI');
    setPreguntasSeguridad([]);
    setRespuestasUsuario({});
    setErrorPreguntas('');
    setCaptchaInput('');
    setEmail('');
    setCodigoPaisCelular('+51');
    setCelular('');
    setFechaNacimiento('');
    setSexo('');
    setDireccion('');
    setReferencia('');
    setDepartamento('');
    setProvincia('');
    setDistrito('');
    setEstadoCivil('');
    setErrorConsulta('');
    setErrorGuardar('');
    setErrorCaptcha('');
    setErroresValidacionCentral([]);
    setErrorEmail('');
    setSugerenciaEmail('');
    setErrorCelular('');
    setErrorFechas('');
    setInfoSexo('');
    setAceptoTerminos(false);
    setShowConfirmModal(false);
    setShowSuccessModal(false);
    setShowTimeoutModal(false);
    setCapituloWhatsAppId('');
    setSegundosRestantes(TIEMPO_LIMITE_EDICION_SEGUNDOS);
    setWidgetTiempoMinimizado(false);
    refrescarCaptcha();
  };

  const capituloActual =
    CAPITULOS_WHATSAPP.find((c) => c.id === capituloWhatsAppId) ||
    obtenerCapituloPorEspecialidad(colegiado?.especialidad);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-800 font-sans selection:bg-[#ac0505] selection:text-white">
      {/* ============================================================== */}
      {/* COLUMNA IZQUIERDA: ROJO OSCURO QUE OCUPA TODA LA PANTALLA      */}
      {/* ============================================================== */}
      {(paso === 'CONSULTA' || paso === 'PREGUNTAS') && (
        <aside className="w-full lg:w-5/12 xl:w-5/12 bg-gradient-to-b from-[#8f0404] via-[#ac0505] to-[#730202] text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between shadow-2xl z-20 border-r border-black/20 relative shrink-0">
          {/* Patrón de micro-trama arquitectónica de alta gama */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:18px_18px] pointer-events-none" />

          <div className="relative z-10 flex flex-col space-y-6">
            {/* Logo Oficial CIP Cusco Transparente (Sin Fondo) */}
            <div className="flex flex-col gap-3">
              <div className="relative h-14 sm:h-16 w-52 sm:w-64 shrink-0 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                <Image
                  src="/logo-cip-white.png"
                  alt="Colegio de Ingenieros del Perú - Consejo Departamental Cusco"
                  fill
                  sizes="(max-width: 640px) 208px, 256px"
                  className="object-contain object-left"
                  priority
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black tracking-widest uppercase text-white bg-black/30 px-2.5 py-0.5 border border-white/20 shadow-sm">
                  Consejo Departamental Cusco
                </span>
                <span className="text-[11px] font-semibold text-white/90 bg-white/10 px-2 py-0.5 border border-white/20">
                  Padrón Oficial
                </span>
              </div>
            </div>

            {/* Información con Efecto Máquina de Escribir en Letras Blancas */}
            <PanelInformativoMecanografiado />
          </div>

          {/* Pie Institucional de la Columna Izquierda */}
          <div className="relative z-10 pt-6 mt-6 border-t border-white/15 text-[11px] text-white/80 flex items-center justify-between">
            <span>Colegio de Ingenieros del Perú</span>
            <span className="text-white/90 font-bold tracking-wider">Cusco • Perú</span>
          </div>
        </aside>
      )}

      {/* ============================================================== */}
      {/* COLUMNA DERECHA O PANTALLA COMPLETA EN FORMULARIO              */}
      {/* ============================================================== */}
      <main
        className={`w-full ${paso === 'FORM' ? 'w-full' : 'lg:w-7/12 xl:w-7/12'} min-h-screen flex flex-col bg-slate-50`}
      >
        {/* Barra superior institucional */}
        <div className="h-1.5 w-full bg-[#ac0505] shadow-sm shrink-0" />

        {/* Encabezado de la Columna de Datos */}
        <header className="bg-white border-b border-slate-200 px-6 sm:px-10 py-4 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            {paso === 'FORM' && (
              <div className="relative h-10 w-36 sm:w-44 shrink-0 hidden sm:block">
                <Image
                  src="/logo-cip.png"
                  alt="CIP Cusco"
                  fill
                  sizes="176px"
                  className="object-contain object-left"
                  priority
                />
              </div>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Portal de Actualización de Datos</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-red-50 text-[#ac0505] border border-red-200">
                  Periodo Oficial 2026
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {paso === 'CONSULTA'
                  ? 'Paso 1: Validación de identidad del colegiado'
                  : paso === 'PREGUNTAS'
                    ? 'Paso 2: Validación de seguridad y preguntas de identidad'
                    : 'Paso 3: Edición y confirmación de información colegial'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {paso === 'FORM' && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 border text-xs font-semibold ${
                  segundosRestantes <= 20
                    ? 'bg-red-50 border-red-300 text-[#ac0505] animate-pulse'
                    : 'bg-slate-50 border-slate-300 text-slate-700'
                }`}
              >
                <svg
                  className={`w-4 h-4 shrink-0 ${segundosRestantes <= 20 ? 'text-[#ac0505] animate-pulse' : 'text-[#ac0505]'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline text-slate-500">Tiempo restante:</span>
                <span className={`font-mono font-bold ${segundosRestantes <= 20 ? 'text-[#ac0505]' : 'text-slate-900'}`}>
                  {formatearTiempo(segundosRestantes)}
                </span>
                <span className="text-[10px] text-slate-400">/ {TIEMPO_LIMITE_EDICION_SEGUNDOS}s</span>
              </div>
            )}

            {paso !== 'CONSULTA' && (
              <button
                type="button"
                onClick={handleReiniciar}
                className="text-xs font-semibold px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
                title="Volver a la pantalla de inicio de actualización de datos"
              >
                <svg className="w-4 h-4 text-[#ac0505]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Inicio / Consultar CIP</span>
              </button>
            )}
          </div>
        </header>

        {/* ============================================================== */}
        {/* TEMPORIZADOR AL COSTADO DE LA PANTALLA (180 SEGUNDOS)          */}
        {/* ============================================================== */}
        {paso === 'FORM' && !showSuccessModal && (
          <aside
            role="timer"
            aria-live="polite"
            className={`fixed right-3 sm:right-6 top-24 z-40 bg-white border border-slate-300 shadow-2xl transition-all duration-200 select-none ${widgetTiempoMinimizado ? 'w-auto' : 'w-52 sm:w-60'
              }`}
          >
            {widgetTiempoMinimizado ? (
              <button
                type="button"
                onClick={() => setWidgetTiempoMinimizado(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold bg-[#ac0505] text-white hover:bg-[#8f0404] transition-colors shadow-md border border-black/20"
                title={`Mostrar temporizador de seguridad de ${TIEMPO_LIMITE_EDICION_SEGUNDOS}s`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-mono">{formatearTiempo(segundosRestantes)}</span>
              </button>
            ) : (
              <div className="p-3">
                <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 tracking-wide uppercase">
                    <svg
                      className={`w-4 h-4 shrink-0 ${segundosRestantes <= 20 ? 'text-[#ac0505] animate-pulse' : 'text-[#ac0505]'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="truncate">Tiempo Restante</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 border ${segundosRestantes <= 20
                          ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                    >
                      {segundosRestantes}s
                    </span>
                    <button
                      type="button"
                      onClick={() => setWidgetTiempoMinimizado(true)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 text-xs font-bold"
                      title="Minimizar panel"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <div className="text-[11px] text-slate-500 font-medium leading-tight">
                    Límite de actualización
                  </div>
                  <div
                    className={`text-2xl sm:text-3xl font-black tracking-tight font-mono my-1 ${segundosRestantes <= 20 ? 'text-[#ac0505] animate-pulse' : 'text-slate-900'
                      }`}
                  >
                    {formatearTiempo(segundosRestantes)}
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-slate-200 h-1.5 overflow-hidden my-1.5">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        segundosRestantes <= 20 ? 'bg-red-600' : 'bg-[#ac0505]'
                      }`}
                      style={{ width: `${(segundosRestantes / TIEMPO_LIMITE_EDICION_SEGUNDOS) * 100}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-slate-500 leading-tight">
                    {segundosRestantes > 20
                      ? `Dispone de ${TIEMPO_LIMITE_EDICION_SEGUNDOS} segundos (3 minutos) para completar y confirmar sus datos.`
                      : segundosRestantes > 0
                        ? '¡Atención! Quedan pocos segundos antes del reinicio automático.'
                        : 'Tiempo culminado. Reiniciando sesión...'}
                  </p>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Contenido Dinámico: Formulario para poner los datos */}
        <div className={`flex-1 p-4 sm:p-6 lg:p-8 flex flex-col ${paso === 'FORM' ? 'w-full max-w-6xl mx-auto' : 'justify-center items-center'}`}>
          {/* ============================================================== */}
          {/* VISTA 1: FORMULARIO INTEGRADO (CIP + DNI + CAPTCHA)            */}
          {/* ============================================================== */}
          {paso === 'CONSULTA' && (
            <div className="max-w-xl mx-auto w-full my-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-white border border-slate-300 shadow-2xl overflow-hidden">
                {/* Encabezado de la Tarjeta */}
                <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-[#ac0505] text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Identificación del Colegiado Titular
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Ingrese su CIP, Documento de Identidad y resuelva el código de seguridad.
                    </p>
                  </div>
                </div>

                {/* Formulario */}
                <form onSubmit={handleConsultarColegiado} className="p-6 sm:p-8 space-y-5">
                  {/* Alerta de Error de Consulta */}
                  {errorConsulta && (
                    <div className="p-4 text-xs sm:text-sm border border-red-200 bg-red-50 text-red-700 flex items-start gap-3 shadow-sm animate-in fade-in duration-150">
                      <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="leading-relaxed font-medium">{errorConsulta}</span>
                    </div>
                  )}

                  {/* Campos CIP y Documento de Identidad */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Campo N° CIP */}
                    <div>
                      <div className="flex flex-col items-center justify-center mb-1.5 gap-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 text-center">
                          Número de CIP <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] text-slate-500 font-semibold px-2 py-0.5 bg-slate-100 border border-slate-200">
                          Colegiatura Oficial
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          value={cip}
                          onChange={(e) => setCip(e.target.value.replace(/\D/g, ''))}
                          placeholder="Ej. 123456"
                          required
                          autoFocus
                          className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] font-mono tracking-wider text-center text-slate-900 transition-all bg-white"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 text-center">Solo dígitos numéricos.</p>
                    </div>

                    {/* Campo Tipo y N° de Documento */}
                    <div>
                      <div className="flex flex-col items-center justify-center mb-1.5 gap-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 text-center">
                          Documento de Identidad <span className="text-red-500">*</span>
                        </label>
                        {/* Selector de Tipo de Documento: DNI o Carné de Extranjería */}
                        <div className="inline-flex border border-slate-300 overflow-hidden text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setTipoDocumentoConsulta('DNI');
                              setDni('');
                            }}
                            className={`px-2.5 py-0.5 transition-colors font-bold ${tipoDocumentoConsulta === 'DNI'
                                ? 'bg-[#ac0505] text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                          >
                            DNI
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTipoDocumentoConsulta('CE');
                              setDni('');
                            }}
                            className={`px-2.5 py-0.5 transition-colors font-bold ${tipoDocumentoConsulta === 'CE'
                                ? 'bg-[#ac0505] text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                            title="Carné de Extranjería"
                          >
                            Carné Extranjería
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          inputMode={tipoDocumentoConsulta === 'DNI' ? 'numeric' : 'text'}
                          maxLength={tipoDocumentoConsulta === 'DNI' ? 8 : 15}
                          value={dni}
                          onChange={(e) =>
                            setDni(
                              tipoDocumentoConsulta === 'DNI'
                                ? e.target.value.replace(/\D/g, '').slice(0, 8)
                                : e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 15)
                            )
                          }
                          placeholder={tipoDocumentoConsulta === 'DNI' ? 'Ej. 45678912' : 'Ej. 001234567'}
                          required
                          className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:border-[#ac0505] focus:ring-[#ac0505] font-mono tracking-wider text-center text-slate-900 transition-all bg-white"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 text-center">
                        {tipoDocumentoConsulta === 'DNI'
                          ? 'DNI peruano (8 dígitos numéricos).'
                          : 'Carné de Extranjería (CE) o Cédula (hasta 15 caracteres).'}
                      </p>
                    </div>
                  </div>

                  {/* Sección CAPTCHA de Seguridad Local */}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Código de Seguridad (Anti-Bot) <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500 font-medium">5 caracteres</span>
                    </div>

                    <div className="p-4 border border-slate-300 bg-slate-50 flex flex-col sm:flex-row items-center gap-3.5">
                      {/* Visualizador SVG del CAPTCHA Local */}
                      <div className="relative overflow-hidden border border-slate-300 shadow-sm shrink-0 bg-white">
                        {captcha ? (
                          <svg
                            width="180"
                            height="48"
                            viewBox="0 0 180 48"
                            className="block select-none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <defs>
                              <linearGradient id="captchaBg" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#FFFFFF" />
                                <stop offset="50%" stopColor="#F8FAFC" />
                                <stop offset="100%" stopColor="#F1F5F9" />
                              </linearGradient>
                            </defs>
                            <rect width="180" height="48" fill="url(#captchaBg)" stroke="#CBD5E1" strokeWidth="1.5" rx="0" />

                            {captcha.lines.map((l, idx) => (
                              <path key={`line-${idx}`} d={l.d} stroke={l.color} strokeWidth={l.strokeWidth} fill="none" opacity="0.75" />
                            ))}

                            {captcha.dots.map((d, idx) => (
                              <circle key={`dot-${idx}`} cx={d.cx} cy={d.cy} r={d.r} fill={d.color} opacity="0.4" />
                            ))}

                            {captcha.chars.map((c, idx) => (
                              <text
                                key={`char-${idx}`}
                                x={c.x}
                                y={c.y}
                                transform={`rotate(${c.rotate} ${c.x} ${c.y})`}
                                fill={c.color}
                                fontFamily="Courier New, monospace"
                                fontWeight="900"
                                fontSize={c.fontSize}
                                textAnchor="middle"
                                style={{ userSelect: 'none' }}
                              >
                                {c.char}
                              </text>
                            ))}
                          </svg>
                        ) : (
                          <div className="w-[180px] h-[48px] bg-slate-100 flex items-center justify-center text-xs text-slate-600 font-mono">
                            Generando...
                          </div>
                        )}
                      </div>

                      {/* Botones de Acción: Refrescar y Audio */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={refrescarCaptcha}
                          className="p-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors shadow-sm"
                          title="Generar nuevo código"
                        >
                          <svg
                            className={`w-4 h-4 text-[#ac0505] transition-transform ${refrescandoAnim ? 'animate-spin' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={reproducirCaptchaVoz}
                          className="p-2 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors shadow-sm"
                          title="Escuchar código por voz"
                        >
                          <svg className="w-4 h-4 text-slate-600 hover:text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                        </button>
                      </div>

                      {/* Input para ingresar el CAPTCHA */}
                      <div className="w-full">
                        <input
                          type="text"
                          maxLength={5}
                          value={captchaInput}
                          onChange={(e) => {
                            setCaptchaInput(e.target.value.toUpperCase());
                            if (errorCaptcha) setErrorCaptcha('');
                          }}
                          placeholder="Escriba el código"
                          required
                          className="w-full px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] font-mono tracking-widest text-center uppercase font-bold text-slate-900 bg-white shadow-inner"
                          style={{
                            borderColor: errorCaptcha ? '#DC2626' : '#CBD5E1',
                            backgroundColor: errorCaptcha ? '#FEF2F2' : '#FFFFFF',
                          }}
                        />
                      </div>
                    </div>

                    {errorCaptcha ? (
                      <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1 animate-in fade-in">
                        <span>✕ {errorCaptcha}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Ingrese las 5 letras o números mostrados. No distingue mayúsculas de minúsculas.
                      </p>
                    )}
                  </div>

                  {/* Botón Principal de Envío */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={verificando || !cip.trim() || !dni.trim() || !captchaInput.trim()}
                      className="w-full py-3.5 px-6 font-bold text-white shadow-md bg-[#ac0505] hover:bg-[#8f0404] transition-colors duration-150 flex items-center justify-center gap-2.5 text-sm sm:text-base border-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
                    >
                      {verificando ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Verificando Identidad en el Padrón...</span>
                        </>
                      ) : (
                        <>
                          <span>Verificar Identidad y Continuar</span>
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VISTA 2: TRES PREGUNTAS SECRETAS DE SEGURIDAD                  */}
          {/* ============================================================== */}
          {paso === 'PREGUNTAS' && colegiado && (
            <div className="max-w-2xl mx-auto w-full my-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-white border border-slate-300 shadow-xl overflow-hidden">
                {/* Encabezado de Preguntas de Seguridad */}
                <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-[#ac0505] text-white flex items-center justify-center font-bold text-sm shadow-md shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#ac0505] block">
                        Paso 2: Validación de Identidad
                      </span>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">
                        Preguntas Secretas de Seguridad
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Colegiado Titular: <strong className="text-slate-800">{colegiado.nombreCompleto}</strong> (CIP: {colegiado.cip})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={handleReiniciar}
                      className="text-xs font-semibold px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
                      title="Volver a ingresar datos"
                    >
                      <svg className="w-3.5 h-3.5 text-[#ac0505]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      <span>Volver</span>
                    </button>
                  </div>
                </div>

                {/* Formulario de Preguntas */}
                <form onSubmit={handleValidarPreguntas} className="p-6 sm:p-8 space-y-6">
                  {/* Banner Explicativo */}
                  <div className="p-3.5 bg-slate-50 border border-slate-300 text-xs text-slate-700 flex items-start gap-3 shadow-sm">
                    <svg className="w-5 h-5 text-[#ac0505] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="leading-relaxed">
                      <span className="font-bold text-slate-900 block mb-0.5">Control de Privacidad y Seguridad Institucional:</span>
                      Para validar que usted es el titular acreditado antes de modificar sus datos personales, responda correctamente las siguientes 3 preguntas con su información oficial en el padrón del CIP.
                    </div>
                  </div>

                  {/* Alerta de Error si se equivocó */}
                  {errorPreguntas && (
                    <div className="p-4 text-xs sm:text-sm border border-red-200 bg-red-50 text-red-700 flex items-start gap-3 shadow-sm animate-in fade-in duration-150">
                      <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="leading-relaxed font-semibold">{errorPreguntas}</span>
                    </div>
                  )}

                  {/* Las 3 Preguntas */}
                  <div className="space-y-5">
                    {preguntasSeguridad.map((q, idx) => (
                      <div key={q.id} className="p-4 border border-slate-200 bg-slate-50/70 shadow-sm">
                        <label className="block text-xs font-bold text-slate-900 mb-2.5">
                          <span className="inline-block w-5 h-5 bg-[#ac0505] text-white text-center leading-5 text-[11px] font-bold mr-2">
                            {idx + 1}
                          </span>
                          <span>{q.enunciado}</span>
                          <span className="text-red-500 ml-1">*</span>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          {q.opciones.map((opc) => {
                            const seleccionada = respuestasUsuario[q.id] === opc;
                            return (
                              <button
                                key={opc}
                                type="button"
                                onClick={() =>
                                  setRespuestasUsuario((prev) => ({
                                    ...prev,
                                    [q.id]: opc,
                                  }))
                                }
                                className={`p-3 text-left text-xs font-medium border-2 transition-all flex items-center justify-between cursor-pointer ${
                                  seleccionada
                                    ? 'border-[#ac0505] bg-red-50 text-[#ac0505] font-bold shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800 hover:bg-slate-50 shadow-sm'
                                }`}
                              >
                                <span className="pr-2 leading-relaxed break-words">{opc}</span>
                                <span
                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                    seleccionada
                                      ? 'border-[#ac0505] bg-[#ac0505]'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {seleccionada && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Botones de Envío */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleReiniciar}
                      className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                      ← Cancelar y Volver
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-2.5 text-white text-xs sm:text-sm font-bold shadow-md bg-[#ac0505] hover:bg-[#8f0404] transition-colors duration-150 flex items-center justify-center gap-2 border-0 cursor-pointer active:scale-[0.99]"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Validar Respuestas y Modificar Datos</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VISTA 2: FICHA Y FORMULARIO DE ACTUALIZACIÓN                   */}
          {/* ============================================================== */}
          {paso === 'FORM' && colegiado && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Tarjeta de Ficha de Colegiado con estilo Carné Oficial - Bordes Rectos */}
              <div className="bg-white border border-slate-300 shadow-md overflow-hidden">
                <div className="bg-[#ac0505] text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/20">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                      {colegiado.nombres ? colegiado.nombres[0] : 'C'}
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider uppercase text-white/80 block">
                        Colegiado Titular Acreditado
                      </span>
                      <h3 className="text-base sm:text-lg font-bold leading-tight text-white">
                        {colegiado.nombreCompleto}
                      </h3>
                      <p className="text-xs text-red-100 font-medium mt-0.5">
                        {colegiado.especialidad || 'Ingeniería'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {colegiado.esVitalicio && (
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold bg-slate-900 text-white border border-slate-700 shadow-sm">
                        ★ Vitalicio
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-3 py-1 text-xs font-bold shadow-sm ${colegiado.habilitado
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                        }`}
                    >
                      ● {colegiado.esVitalicio ? 'HABILITADO' : (colegiado.estadoColegiatura || (colegiado.habilitado ? 'HABILITADO' : 'NO HABILITADO'))}
                    </span>
                  </div>
                </div>

                {/* Grid Informativo de la Colegiatura - Bordes Rectos */}
                <div
                  className={`p-6 grid grid-cols-2 sm:grid-cols-3 ${colegiado.esVitalicio ? 'lg:grid-cols-4' : 'lg:grid-cols-6'
                    } gap-3 sm:gap-4 text-xs bg-slate-50/60`}
                >
                  <div className="bg-white p-3 border border-slate-300 shadow-sm">
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">N° Colegiatura (CIP)</span>
                    <span className="font-mono font-bold text-[#ac0505] text-sm sm:text-base mt-0.5 block">{colegiado.cip}</span>
                  </div>
                  <div className="bg-white p-3 border border-slate-300 shadow-sm">
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">
                      {colegiado.tipoDocumentoNombre || 'DNI'}
                    </span>
                    <span className="font-mono font-bold text-slate-800 text-sm sm:text-base mt-0.5 block">{colegiado.dni}</span>
                  </div>
                  <div className="bg-white p-3 border border-slate-300 shadow-sm">
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Fecha Colegiatura</span>
                    <span className="font-semibold text-slate-800 text-xs sm:text-sm mt-0.5 block">{formatearFechaDisplay(colegiado.fechaIngreso)}</span>
                  </div>
                  {!colegiado.esVitalicio && (
                    <>
                      <div className="bg-white p-3 border border-slate-300 shadow-sm">
                        <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Último Pago</span>
                        <span className="font-semibold text-slate-800 text-xs sm:text-sm mt-0.5 block">{formatearFechaDisplay(colegiado.fechaUltimoPago)}</span>
                      </div>
                      <div className="bg-white p-3 border border-slate-300 shadow-sm">
                        <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Habilitado Hasta</span>
                        <span className="font-bold text-emerald-700 text-xs sm:text-sm mt-0.5 block">
                          {colegiado.fechaHabilitado ? formatearFechaDisplay(colegiado.fechaHabilitado) : 'Al día'}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="bg-white p-3 border border-slate-300 shadow-sm col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider block">Correo en Padrón</span>
                    <span className="font-semibold text-[#ac0505] text-xs sm:text-sm mt-0.5 block truncate" title={colegiado.email || email || 'Sin registrar'}>
                      {colegiado.email || email || 'Sin registrar'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Formulario Principal de Datos - Bordes Rectos */}
              <div className="bg-white border border-slate-300 shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-[#ac0505]/10 flex items-center justify-center text-[#ac0505]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-900">
                        Formulario de Actualización de Datos
                      </h3>
                      <p className="text-xs text-slate-500">
                        Complete y revise los campos con información verídica y vigente.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handlePreGuardar} className="p-6 sm:p-8 space-y-6">
                  {/* Banner de Errores de Validación */}
                  {erroresValidacionCentral.length > 0 && (
                    <div
                      ref={centroErroresRef}
                      className="p-4 border border-red-200 bg-red-50 text-red-700 flex flex-col gap-2 shadow-sm animate-in fade-in"
                    >
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span>Por favor corrija los siguientes campos para continuar:</span>
                      </div>
                      <ul className="list-disc list-inside text-xs space-y-1 pl-1 font-medium">
                        {erroresValidacionCentral.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Sección 1: Datos de Contacto */}
                  <div className="bg-slate-50/70 p-5 border border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#ac0505] mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-[#ac0505] text-white flex items-center justify-center text-xs">
                        1
                      </span>
                      <span>Información de Contacto</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Correo Electrónico */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                            Correo Electrónico <span className="text-red-500">*</span>
                          </label>
                          {email && !errorEmail && (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Válido
                            </span>
                          )}
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          placeholder="ejemplo@correo.com"
                          required
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] transition-colors bg-white text-slate-900"
                          style={{
                            borderColor: errorEmail ? '#DC2626' : undefined,
                            backgroundColor: errorEmail ? '#FFF5F5' : undefined,
                          }}
                        />
                        {sugerenciaEmail && (
                          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                            <span>💡 ¿Quiso escribir</span>
                            <button
                              type="button"
                              onClick={() => handleEmailChange(sugerenciaEmail)}
                              className="underline font-bold text-[#ac0505]"
                            >
                              {sugerenciaEmail}
                            </button>
                            <span>?</span>
                          </p>
                        )}
                        {errorEmail ? (
                          <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                            <span>✕ {errorEmail}</span>
                          </p>
                        ) : null}

                        {/* Aviso claro sobre el envío de datos actualizados a este correo */}
                        <div className="p-3 bg-red-50 border border-red-200 text-xs text-slate-800 flex items-start gap-2.5 mt-2.5 shadow-sm">
                          <svg className="w-4 h-4 text-[#ac0505] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <div className="leading-snug">
                            <span className="font-bold text-slate-900 block">Destino de Entrega Oficial:</span>
                            A este correo electrónico se enviará automáticamente la <strong>constancia oficial con todos sus datos actualizados</strong> al momento de guardar.
                          </div>
                        </div>
                      </div>

                      {/* Teléfono Celular */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                            Teléfono Celular <span className="text-red-500">*</span>
                          </label>
                          {celular && !errorCelular && (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {codigoPaisCelular === '+51' ? '9 dígitos' : 'Internacional'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-stretch gap-2">
                          {/* Selector de País / Prefijo Internacional */}
                          <div className="w-40 sm:w-48 shrink-0">
                            <select
                              value={codigoPaisCelular}
                              onChange={(e) => handleCodigoPaisChange(e.target.value)}
                              className="w-full h-full px-2.5 py-2 text-xs font-semibold border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] cursor-pointer"
                              title="Seleccione el país / prefijo internacional"
                            >
                              {PAISES_TELEFONO.map((p) => (
                                <option key={`${p.iso}-${p.codigo}`} value={p.codigo}>
                                  {p.bandera} {p.pais} ({p.codigo})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Input del Número */}
                          <div className="relative flex-1">
                            <input
                              type="tel"
                              inputMode="numeric"
                              maxLength={codigoPaisCelular === '+51' ? 9 : 15}
                              value={celular}
                              onChange={(e) => handleCelularChange(e.target.value)}
                              placeholder={codigoPaisCelular === '+51' ? '9XXXXXXXX' : 'Número celular'}
                              required
                              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] font-mono transition-colors bg-white text-slate-900"
                              style={{
                                borderColor: errorCelular ? '#DC2626' : undefined,
                                backgroundColor: errorCelular ? '#FFF5F5' : undefined,
                              }}
                            />
                          </div>
                        </div>
                        {errorCelular ? (
                          <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                            <span>✕ {errorCelular}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-1">
                            {codigoPaisCelular === '+51'
                              ? 'Celular peruano de 9 dígitos para notificaciones y WhatsApp institucional.'
                              : `Número internacional (${codigoPaisCelular}) para colegiados temporales o residentes en el extranjero.`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sección 2: Filiación y Estado Civil */}
                  <div className="bg-slate-50/70 p-5 border border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#ac0505] mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-[#ac0505] text-white flex items-center justify-center text-xs">
                        2
                      </span>
                      <span>Filiación y Estado Civil</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      {/* Fecha de Nacimiento */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                            Fecha de Nacimiento <span className="text-red-500">*</span>
                          </label>
                          {fechaNacimiento && !errorFechas && (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Válida
                            </span>
                          )}
                        </div>
                        <input
                          type="date"
                          value={fechaNacimiento}
                          onChange={(e) => handleFechaNacimientoChange(e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] transition-colors bg-white text-slate-900"
                          style={{
                            borderColor: errorFechas ? '#DC2626' : undefined,
                            backgroundColor: errorFechas ? '#FFF5F5' : undefined,
                          }}
                        />
                        {errorFechas ? (
                          <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                            <span>✕ {errorFechas}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 mt-1">
                            Requerida para beneficios previsionales.
                          </p>
                        )}
                      </div>

                      {/* Sexo */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                            Sexo <span className="text-red-500">*</span>
                          </label>
                          {sexo && (
                            <span className="text-xs font-bold text-slate-600">
                              {sexo === 'M' ? '♂ Masculino' : '♀ Femenino'}
                            </span>
                          )}
                        </div>
                        <select
                          value={sexo}
                          onChange={(e) => {
                            setSexo(e.target.value);
                            setInfoSexo('Modificado manualmente según su preferencia.');
                          }}
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] bg-white text-slate-900"
                        >
                          <option value="">-- Seleccionar Sexo --</option>
                          <option value="M">Masculino</option>
                          <option value="F">Femenino</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {infoSexo || 'Según DNI registrado.'}
                        </p>
                      </div>

                      {/* Estado Civil */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Estado Civil
                        </label>
                        <select
                          value={normalizarEstadoCivil(estadoCivil) || estadoCivil}
                          onChange={(e) => setEstadoCivil(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] bg-white text-slate-900"
                        >
                          <option value="">-- Seleccionar --</option>
                          {estadosCiviles.length > 0 ? (
                            estadosCiviles.map((ec) => (
                              <option key={ec.codigo} value={ec.nombre}>
                                {ec.nombre}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="Soltero(a)">Soltero(a)</option>
                              <option value="Casado(a)">Casado(a)</option>
                              <option value="Viudo(a)">Viudo(a)</option>
                              <option value="Divorciado(a)">Divorciado(a)</option>
                              <option value="Conviviente">Conviviente</option>
                            </>
                          )}
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Registro oficial para el legajo y acreditación colegial.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sección 3: Residencia y Ubicación */}
                  <div className="bg-slate-50/70 p-5 border border-slate-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#ac0505] mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-[#ac0505] text-white flex items-center justify-center text-xs">
                        3
                      </span>
                      <span>Residencia Domiciliaria y Ubigeo</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
                      {/* Departamento */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Departamento
                        </label>
                        <select
                          value={departamentos.find((d) => d.toUpperCase() === departamento.toUpperCase()) || departamento}
                          onChange={(e) => {
                            setDepartamento(e.target.value);
                            setProvincia('');
                            setDistrito('');
                          }}
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] bg-white text-slate-900"
                        >
                          <option value="">-- Seleccionar Departamento --</option>
                          {departamentos.map((dep) => (
                            <option key={dep} value={dep}>
                              {dep}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Provincia */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Provincia
                        </label>
                        <select
                          value={provincias.find((p) => p.toUpperCase() === provincia.toUpperCase()) || provincia}
                          disabled={!departamento}
                          onChange={(e) => {
                            setProvincia(e.target.value);
                            setDistrito('');
                          }}
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">-- Seleccionar Provincia --</option>
                          {provincias.map((prov) => (
                            <option key={prov} value={prov}>
                              {prov}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Distrito */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Distrito
                        </label>
                        <select
                          value={distritos.find((d) => d.toUpperCase() === distrito.toUpperCase()) || distrito}
                          disabled={!provincia}
                          onChange={(e) => setDistrito(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">-- Seleccionar Distrito --</option>
                          {distritos.map((dist) => (
                            <option key={dist} value={dist}>
                              {dist}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Dirección y Referencia */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Dirección Domiciliaria
                        </label>
                        <input
                          type="text"
                          value={direccion}
                          onChange={(e) => setDireccion(e.target.value)}
                          placeholder="Ej. Av. De la Cultura 750, Urb. Magisterio"
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#ac0505] focus:border-[#ac0505] bg-white text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Referencia de Dirección
                        </label>
                        <input
                          type="text"
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                          placeholder="Ej. Frente al parque, al lado de la botica"
                          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 focus:outline-none focus:ring-1 focus:border-[#ac0505] focus:ring-[#ac0505] bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sección 4: Declaración Jurada */}
                  <div className="p-4 border border-slate-300 bg-slate-50 shadow-sm">
                    <div className="flex items-start gap-3 text-xs text-slate-800 leading-relaxed">
                      <svg className="w-5 h-5 text-[#ac0505] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <div>
                        <strong className="block text-slate-900 font-bold mb-0.5 text-xs sm:text-sm">
                          Declaración Jurada y Veracidad de la Información (Ley N° 29733):
                        </strong>
                        Declaro bajo juramento que los datos consignados son verídicos, legítimos y personales. Al confirmar, se guardará la actualización en el padrón y se enviará la constancia oficial con todos sus datos actualizados a su correo:{' '}
                        <strong className="text-[#ac0505] font-bold">{email || 'registrado'}</strong>.
                      </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer select-none pt-3 mt-3 border-t border-slate-200">
                      <input
                        type="checkbox"
                        checked={aceptoTerminos}
                        onChange={(e) => setAceptoTerminos(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-[#ac0505] focus:ring-[#ac0505] border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-900 leading-snug">
                        He leído, comprendo y acepto la Declaración Jurada de Veracidad, asumiendo la responsabilidad de la información consignada.
                      </span>
                    </label>
                  </div>

                  {/* Botones de Acción - Bordes Rectos */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleReiniciar}
                      className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 text-sm font-semibold transition-colors hover:bg-slate-100 text-slate-700 shadow-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-2.5 text-white text-sm font-bold shadow-md bg-[#ac0505] hover:bg-[#8f0404] transition-colors duration-150 flex items-center justify-center gap-2 border-0"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Guardar Actualización</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer Institucional en Columna de Datos */}
        <footer className="border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500 bg-white mt-auto shrink-0">
          <p className="font-semibold text-slate-700">Colegio de Ingenieros del Perú — Consejo Departamental Cusco</p>
          <p className="mt-0.5 text-slate-400">Sistema Integrado de Padrón Oficial</p>
        </footer>
      </main>

      {/* ============================================================== */}
      {/* MODAL DE CONFIRMACIÓN PREVIA - BORDES RECTOS                   */}
      {/* ============================================================== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="max-w-xl w-full shadow-2xl overflow-hidden border border-slate-300 my-8 bg-white animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#ac0505] flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  CIP
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-tight">
                    Confirmar Datos Registrados
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Revise la información antes de guardar en el padrón
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-semibold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200">
                <div className="text-slate-500 font-medium">Colegiado Titular:</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {colegiado?.nombreCompleto}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                    CIP: {colegiado?.cip}
                  </span>
                  <span className="px-2 py-0.5 font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {colegiado?.tipoDocumentoNombre || 'DNI'}: {colegiado?.dni}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 overflow-hidden bg-white">
                <div className="p-2.5 flex justify-between items-center bg-slate-50">
                  <span className="text-slate-600 font-semibold">Correo Electrónico:</span>
                  <span className="font-bold text-[#ac0505]">{email}</span>
                </div>
                <div className="p-2.5 flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Número Celular:</span>
                  <span className="font-mono font-bold text-green-700">{codigoPaisCelular} {celular}</span>
                </div>
                <div className="p-2.5 flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Fecha de Nacimiento:</span>
                  <span className="font-medium text-slate-800">{fechaNacimiento || 'No especificada'}</span>
                </div>
                <div className="p-2.5 flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Sexo:</span>
                  <span className="font-medium text-slate-800">
                    {sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : 'No especificado'}
                  </span>
                </div>
                <div className="p-2.5 flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Estado Civil:</span>
                  <span className="font-medium text-slate-800">{estadoCivil || 'No especificado'}</span>
                </div>
                <div className="p-2.5 flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Ubicación:</span>
                  <span className="font-medium text-slate-800">
                    {[departamento, provincia, distrito].filter(Boolean).join(' / ') || 'No especificada'}
                  </span>
                </div>
                {direccion && (
                  <div className="p-2.5 flex justify-between items-start gap-4">
                    <span className="text-slate-600 font-semibold shrink-0">Dirección:</span>
                    <span className="font-medium text-slate-800 text-right">{direccion}</span>
                  </div>
                )}
                {referencia && (
                  <div className="p-2.5 flex justify-between items-start gap-4">
                    <span className="text-slate-600 font-semibold shrink-0">Referencia:</span>
                    <span className="font-medium text-slate-800 text-right">{referencia}</span>
                  </div>
                )}
              </div>

              <div className="bg-red-50 border border-red-200 p-3.5 text-xs text-slate-800 leading-relaxed font-medium shadow-sm">
                <span className="font-bold text-[#ac0505] block mb-0.5">Envío Oficial de Datos Actualizados:</span>
                Al confirmar, se guardarán los datos en el sistema y se remitirá una copia completa de la <strong>constancia oficial con sus datos actualizados</strong> al correo electrónico: <strong className="text-[#ac0505] font-bold underline">{email}</strong>.
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 leading-relaxed font-medium shadow-sm flex items-start gap-2.5">
                <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <strong className="text-amber-950 font-bold block mb-0.5">Aviso de Seguridad Institucional:</strong>
                  Al confirmar, sus datos serán procesados y se activará un <strong>período de resguardo de 24 horas</strong>, durante el cual no podrá realizar nuevas modificaciones a través del portal.
                </div>
              </div>

              {errorGuardar && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                  <span>✕ {errorGuardar}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={guardando}
                onClick={() => setShowConfirmModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors shadow-sm"
              >
                Volver y Modificar
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={handleConfirmarGuardar}
                className="w-full sm:w-auto px-6 py-2.5 text-white text-xs font-bold shadow-md bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 transition-all flex items-center justify-center gap-2"
              >
                {guardando ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Guardando y enviando constancia...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Confirmar y Guardar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE ÉXITO - BORDES RECTOS                                 */}
      {/* ============================================================== */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="max-w-lg w-full shadow-2xl overflow-hidden border border-emerald-300 my-8 bg-white animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center border-b border-emerald-100 bg-emerald-50/70">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-sm border border-emerald-200">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                ¡Actualización Registrada con Éxito!
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Su información ha sido guardada en el padrón oficial del Colegio de Ingenieros del Perú.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 text-emerald-900 flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div className="leading-relaxed">
                  <span className="font-bold block text-emerald-950">Constancia remitida por correo:</span>
                  Se ha enviado la constancia oficial a: <strong className="font-bold underline text-emerald-800">{resumenExito?.email || email}</strong>.
                </div>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Colegiado:</span>
                  <span className="font-bold text-slate-900">{resumenExito?.nombres || colegiado?.nombreCompleto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">N° CIP / DNI:</span>
                  <span className="font-mono font-bold text-slate-800">
                    CIP {resumenExito?.cip || colegiado?.cip} • {resumenExito?.dni || colegiado?.dni}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Correo Electrónico:</span>
                  <span className="font-medium text-[#ac0505]">{resumenExito?.email || email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Número Celular:</span>
                  <span className="font-mono font-bold text-green-700">{resumenExito?.celular || `${codigoPaisCelular} ${celular}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ubicación:</span>
                  <span className="font-medium text-slate-800">
                    {[departamento, provincia, distrito].filter(Boolean).join(' / ') || 'No especificada'}
                  </span>
                </div>
              </div>

              {/* ALERTA DE SEGURIDAD ESTRICTA: COOLDOWN 24 HORAS */}
              <div className="bg-amber-50 border-2 border-amber-400 p-4 text-amber-950 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-950">
                      Período de Seguridad Activo (24 Horas)
                    </h4>
                    <span className="text-[11px] text-amber-800 font-medium">Protección de identidad y resguardo institucional</span>
                  </div>
                </div>
                <div className="p-2.5 bg-white border border-amber-300 text-xs text-amber-900 leading-relaxed font-semibold">
                  ⚠️ <strong>ADVERTENCIA:</strong> Por motivos de seguridad y resguardo de su identidad institucional, <strong>no se podrá volver a actualizar datos dentro de las próximas 24 horas</strong>.
                </div>
                {resumenExito?.proximaFechaStr && (
                  <div className="pt-1.5 border-t border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-amber-950">
                    <span className="font-medium text-amber-900">Nueva actualización disponible a partir de:</span>
                    <span className="font-mono font-bold bg-amber-100 px-2 py-0.5 border border-amber-300 text-amber-950">
                      {resumenExito.proximaFechaStr}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-center">
              <button
                type="button"
                onClick={handleReiniciar}
                className="w-full py-2.5 text-white font-bold text-sm shadow-md bg-[#ac0505] hover:bg-[#8f0404] transition-colors duration-150 flex items-center justify-center gap-2 border-0"
              >
                <span>Aceptar y Finalizar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE TIEMPO AGOTADO (180 SEGUNDOS)                         */}
      {/* ============================================================== */}
      {showTimeoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden text-left animate-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-[#8f0404] to-[#ac0505] p-5 text-white flex items-center gap-3.5">
              <div className="w-11 h-11 bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-6 h-6 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Tiempo de Edición Culminado
                </h3>
                <p className="text-xs text-red-100 font-medium">
                  Límite de seguridad: 180 segundos (3 minutos)
                </p>
              </div>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 text-xs text-slate-700 leading-relaxed">
                <svg className="w-5 h-5 text-[#ac0505] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="space-y-1">
                  <span className="font-bold text-[#ac0505] block">
                    Sesión finalizada por tiempo límite
                  </span>
                  <p>
                    Han transcurrido los <strong>180 segundos (3 minutos)</strong> permitidos para realizar la actualización de sus datos. Por políticas de seguridad, confidencialidad y protección de la información gremial, el proceso se ha reiniciado por completo.
                  </p>
                </div>
              </div>

              <div className="text-center py-2">
                <p className="text-xs text-slate-500 font-medium">
                  Regresando a la pantalla inicial de consulta en{' '}
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {cuentaRegresivaRedireccion}s
                  </span>
                  ...
                </p>
                <div className="w-full bg-slate-100 h-1.5 mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#ac0505] transition-all duration-1000"
                    style={{ width: `${(cuentaRegresivaRedireccion / 3) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer con Botón */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={handleIrAInicio}
                className="w-full sm:w-auto px-5 py-2.5 text-white text-xs font-bold shadow-md bg-[#ac0505] hover:bg-[#8f0404] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Aceptar y Volver al Inicio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE ADVERTENCIA / BLOQUEO POR ESTADO EN MEDIO DE PANTALLA */}
      {/* ============================================================== */}
      {modalBloqueoEstado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white border border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header del Modal según estado */}
            <div
              className={`p-5 text-white flex items-center gap-3.5 ${
                modalBloqueoEstado.tipo === 'FALLECIDO'
                  ? 'bg-slate-900 border-b-2 border-slate-700'
                  : modalBloqueoEstado.tipo === 'COOLDOWN_24H'
                  ? 'bg-slate-900 border-b-2 border-amber-500'
                  : modalBloqueoEstado.tipo === 'TEMPORAL'
                  ? 'bg-[#d97706] border-b-2 border-amber-600'
                  : 'bg-[#d97706] border-b-2 border-amber-700'
              }`}
            >
              <div className="w-12 h-12 bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-xs">
                {modalBloqueoEstado.tipo === 'FALLECIDO' ? (
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                ) : modalBloqueoEstado.tipo === 'COOLDOWN_24H' ? (
                  <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : modalBloqueoEstado.tipo === 'TEMPORAL' ? (
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/80 block">
                  {modalBloqueoEstado.tipo === 'COOLDOWN_24H'
                    ? 'Período de Seguridad Activo (24 Horas)'
                    : 'Acceso Restringido al Portal'}
                </span>
                <h3 className="text-lg font-extrabold text-white leading-tight mt-0.5">
                  {modalBloqueoEstado.tipo === 'FALLECIDO'
                    ? 'Colegiado en Condición de Fallecido'
                    : modalBloqueoEstado.tipo === 'COOLDOWN_24H'
                    ? 'Actualización de Datos en Espera'
                    : modalBloqueoEstado.tipo === 'TEMPORAL'
                    ? 'Colegiado con Estado Temporal'
                    : 'Colegiado con Estado Transferido'}
                </h3>
              </div>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-4">
              {modalBloqueoEstado.cip && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800">
                  <span>CIP:</span>
                  <span>{modalBloqueoEstado.cip}</span>
                </div>
              )}

              <div
                className={`p-4 border text-xs sm:text-sm leading-relaxed ${
                  modalBloqueoEstado.tipo === 'COOLDOWN_24H'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : modalBloqueoEstado.tipo === 'FALLECIDO'
                    ? 'bg-slate-50 border-slate-300 text-slate-800'
                    : modalBloqueoEstado.tipo === 'TEMPORAL'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-[#730202]'
                }`}
              >
                <p className="font-bold mb-2">
                  {modalBloqueoEstado.tipo === 'COOLDOWN_24H'
                    ? '🔒 Sus datos ya fueron actualizados recientemente.'
                    : modalBloqueoEstado.tipo === 'FALLECIDO'
                    ? 'El colegiado figura con estado FALLECIDO en el padrón oficial.'
                    : modalBloqueoEstado.tipo === 'TEMPORAL'
                    ? 'El colegiado figura con estado TEMPORAL en el padrón oficial.'
                    : 'El colegiado figura con estado TRANSFERIDO en el padrón oficial.'}
                </p>
                <p>{modalBloqueoEstado.mensaje}</p>

                {modalBloqueoEstado.tipo === 'COOLDOWN_24H' && modalBloqueoEstado.proximaFechaStr && (
                  <div className="mt-3 pt-2.5 border-t border-amber-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-semibold text-amber-950">
                    <span className="text-amber-900">Disponible nuevamente a partir de:</span>
                    <span className="font-mono bg-white px-2.5 py-1 border border-amber-300">
                      {modalBloqueoEstado.proximaFechaStr}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">
                  {modalBloqueoEstado.tipo === 'COOLDOWN_24H'
                    ? '¿Por qué existe este período de seguridad?'
                    : '¿Requiere orientación o regularización?'}
                </p>
                <p>
                  {modalBloqueoEstado.tipo === 'COOLDOWN_24H'
                    ? 'Para evitar suplantaciones y modificaciones indebidas, el sistema establece un intervalo mínimo de 24 horas entre actualizaciones. Si necesita un cambio urgente, comuníquese con el Consejo Departamental de Cusco.'
                    : 'Para consultas sobre este estado registral, comuníquese con Mesa de Partes o Secretaría del Consejo Departamental del CIP Cusco.'}
                </p>
              </div>
            </div>

            {/* Footer con Botón */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setModalBloqueoEstado(null);
                  setErrorConsulta('');
                }}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-xs"
              >
                Entendido / Regresar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* BLOQUEO POR PESTAÑAS MÚLTIPLES (CONTROL DE CONCURRENCIA)       */}
      {/* ============================================================== */}
      {bloqueadoPorMultiplesPestanas && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
          <div className="bg-white border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden text-center animate-in zoom-in-95 duration-200">
            {/* Header del Bloqueo */}
            <div className="bg-gradient-to-r from-[#8f0404] to-[#ac0505] p-6 text-white text-center">
              <div className="w-14 h-14 bg-white/20 border border-white/30 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <svg className="w-8 h-8 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-red-200 block mb-1">
                Restricción de Seguridad
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Portal Abierto en Otra Pestaña
              </h2>
            </div>

            {/* Mensaje Informativo */}
            <div className="p-6 sm:p-8 space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p className="font-semibold text-slate-900">
                El Portal de Actualización de Datos solo puede estar abierto en <strong>una sola pestaña a la vez</strong> en este navegador.
              </p>
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs text-left leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <svg className="w-4 h-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Control de Seguridad y Protección de Datos:</span>
                </div>
                <p>
                  Por motivos de seguridad gremial, protección de datos personales y consistencia en el padrón oficial del CIP Cusco, no se permite el uso simultáneo en dos o más pestañas a la vez.
                </p>
              </div>
              <p className="text-slate-500 text-xs">
                Si desea continuar trabajando en <strong>esta pestaña</strong>, presione el botón a continuación. La otra pestaña se inactivará de inmediato.
              </p>
            </div>

            {/* Botones de Acción */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleTomarControlPestana}
                className="w-full sm:w-auto px-6 py-2.5 text-white text-xs sm:text-sm font-bold shadow-md bg-[#ac0505] hover:bg-[#8f0404] transition-colors flex items-center justify-center gap-2 border-0"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Usar en esta Pestaña</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
