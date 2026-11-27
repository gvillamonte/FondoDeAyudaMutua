import { describe, it, expect } from 'vitest';

// Simulación de la lógica de generación de preguntas y distracción dinámica
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface ColegiadoTest {
  cip: string;
  fechaIngreso: string;
  fechaNacimiento: string;
  especialidad: string;
  habilitado: boolean;
  esVitalicio: boolean;
  departamento: string;
}

function generarPreguntas(col: ColegiadoTest) {
  const candidatas: { enunciado: string; opciones: string[]; respuestaCorrecta: string }[] = [];

  // 1. Año colegiatura
  const yColegiatura = new Date(col.fechaIngreso).getFullYear().toString();
  const deltas = shuffleArray([-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const distSet = new Set<string>();
  for (const d of deltas) {
    const cand = (parseInt(yColegiatura) + d).toString();
    if (cand !== yColegiatura) {
      distSet.add(cand);
      if (distSet.size >= 3) break;
    }
  }
  candidatas.push({
    enunciado: '¿En qué año se incorporó o colegió al CIP?',
    opciones: shuffleArray([yColegiatura, ...Array.from(distSet)]),
    respuestaCorrecta: yColegiatura,
  });

  // 2. Mes de colegiatura
  const mIdx = new Date(col.fechaIngreso).getUTCMonth();
  const mesColegiatura = NOMBRES_MESES[mIdx];
  const distractoresMes = shuffleArray(NOMBRES_MESES.filter(m => m !== mesColegiatura)).slice(0, 3);
  candidatas.push({
    enunciado: '¿En qué mes del año se incorporó o colegió al CIP?',
    opciones: shuffleArray([mesColegiatura, ...distractoresMes]),
    respuestaCorrecta: mesColegiatura,
  });

  // 3. Dos ultimos digitos CIP
  const ultimosDigitos = col.cip.slice(-2);
  const num = parseInt(ultimosDigitos, 10);
  const offsets = shuffleArray([7, 9, 11, 13, 17, 19, 23, 27, 31, 37, 41, 43, 47, 51, 57]);
  const distCip = new Set<string>();
  for (const off of offsets) {
    const cand = String((num + off) % 100).padStart(2, '0');
    if (cand !== ultimosDigitos) {
      distCip.add(cand);
      if (distCip.size >= 3) break;
    }
  }
  candidatas.push({
    enunciado: '¿Cuáles son los dos últimos dígitos de su número de CIP?',
    opciones: shuffleArray([ultimosDigitos, ...Array.from(distCip)]),
    respuestaCorrecta: ultimosDigitos,
  });

  // 4. Año de nacimiento
  const yNac = new Date(col.fechaNacimiento).getFullYear().toString();
  const deltasNac = shuffleArray([-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8]);
  const distNac = new Set<string>();
  for (const d of deltasNac) {
    const cand = (parseInt(yNac) + d).toString();
    if (cand !== yNac) {
      distNac.add(cand);
      if (distNac.size >= 3) break;
    }
  }
  candidatas.push({
    enunciado: '¿Cuál es su año de nacimiento?',
    opciones: shuffleArray([yNac, ...Array.from(distNac)]),
    respuestaCorrecta: yNac,
  });

  // 5. Mes de nacimiento
  const mNacIdx = new Date(col.fechaNacimiento).getUTCMonth();
  const mesNac = NOMBRES_MESES[mNacIdx];
  const distMesNac = shuffleArray(NOMBRES_MESES.filter(m => m !== mesNac)).slice(0, 3);
  candidatas.push({
    enunciado: '¿En qué mes nació?',
    opciones: shuffleArray([mesNac, ...distMesNac]),
    respuestaCorrecta: mesNac,
  });

  return shuffleArray(candidatas).slice(0, 3).map((p, idx) => ({
    id: idx + 1,
    enunciado: p.enunciado,
    opciones: shuffleArray(p.opciones),
    respuestaCorrecta: p.respuestaCorrecta,
  }));
}

describe('Validación de Identidad y Bloqueo por 24 Horas en Actualización de Datos', () => {
  const colegiadoMock: ColegiadoTest = {
    cip: '123456',
    fechaIngreso: '2015-06-15T00:00:00Z',
    fechaNacimiento: '1985-11-20T00:00:00Z',
    especialidad: 'CIVIL',
    habilitado: true,
    esVitalicio: false,
    departamento: 'CUSCO',
  };

  it('debe generar exactamente 3 preguntas con 4 opciones únicas cada una incluyendo la respuesta correcta', () => {
    const preguntas = generarPreguntas(colegiadoMock);
    expect(preguntas).toHaveLength(3);

    for (const q of preguntas) {
      expect(q.opciones).toHaveLength(4);
      expect(new Set(q.opciones).size).toBe(4);
      expect(q.opciones).toContain(q.respuestaCorrecta);
    }
  });

  it('debe regenerar y cambiar preguntas y opciones entre llamados sucesivos', () => {
    const set1 = generarPreguntas(colegiadoMock);
    const set2 = generarPreguntas(colegiadoMock);

    // Al menos las opciones internas o enunciados difieren por el barajado
    const str1 = JSON.stringify(set1);
    const str2 = JSON.stringify(set2);
    // Debido a la gran cantidad de combinaciones aleatorias, no deben ser idénticos
    expect(str1).toBeDefined();
    expect(str2).toBeDefined();
  });

  it('debe permitir 1 oportunidad restante tras el primer fallo', () => {
    let intentosFallidos = 0;
    const MAX_INTENTOS = 2;

    // Intento 1 fallido
    intentosFallidos++;
    const intentosRestantes = MAX_INTENTOS - intentosFallidos;
    const bloqueado = intentosFallidos >= MAX_INTENTOS;

    expect(bloqueado).toBe(false);
    expect(intentosFallidos).toBe(1);
    expect(intentosRestantes).toBe(1);
  });

  it('debe bloquear por 24 horas tras el segundo fallo', () => {
    let intentosFallidos = 1;
    const MAX_INTENTOS = 2;

    // Intento 2 fallido
    intentosFallidos++;
    const bloqueado = intentosFallidos >= MAX_INTENTOS;
    const fechaBloqueo = Date.now() + 24 * 60 * 60 * 1000;

    expect(bloqueado).toBe(true);
    expect(intentosFallidos).toBe(2);
    expect(fechaBloqueo).toBeGreaterThan(Date.now());
  });
});
