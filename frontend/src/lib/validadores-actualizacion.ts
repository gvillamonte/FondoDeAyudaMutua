/**
 * Validadores y detectores inteligentes para el módulo de Actualización de Datos
 * Cumple con estándares de validación estricta y UX amigable del Colegio de Ingenieros del Perú.
 */

// --------------------------------------------------------------------------
// 1. VALIDADOR DE CORREO ELECTRÓNICO
// --------------------------------------------------------------------------

const DOMINIOS_FALSOS_PROHIBIDOS = new Set([
  'test.com',
  'prueba.com',
  'ejemplo.com',
  'example.com',
  'fake.com',
  'correo.com',
  'email.com',
  'yopmail.com',
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'asdf.com',
  'xxx.com',
  'abc.com',
  'none.com',
  'nada.com',
  'sinemail.com',
  'nomail.com',
  'correo.pe',
  'prueba.pe',
  'test.pe',
]);

const USUARIOS_FALSOS_PROHIBIDOS = new Set([
  'test',
  'prueba',
  'fake',
  'asdf',
  'correo',
  'email',
  'usuario',
  'user',
  'admin',
  '123',
  'abc',
  'xxx',
  'noemail',
  'sinemail',
  'prueba1',
  'test1',
  'ejemplo',
]);

const TIPOS_DOMINIOS_COMUNES: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'hotmali.com': 'hotmail.com',
  'jotmail.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outluk.com': 'outlook.com',
  'outlock.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.es': 'yahoo.es',
  'cipcusco.com': 'cipcusco.org.pe',
  'cipcusco.pe': 'cipcusco.org.pe',
};

export interface ResultadoValidacionEmail {
  valido: boolean;
  mensaje?: string;
  sugerenciaCorreccion?: string;
}

export function validarEmail(emailRaw: string): ResultadoValidacionEmail {
  const email = (emailRaw || '').trim();

  if (!email) {
    return { valido: false, mensaje: 'El correo electrónico es obligatorio.' };
  }

  if (email.includes(' ')) {
    return { valido: false, mensaje: 'El correo electrónico no puede contener espacios.' };
  }

  if (email.includes('..')) {
    return { valido: false, mensaje: 'El correo electrónico contiene puntos consecutivos no permitidos.' };
  }

  // Regex estándar RFC 5322 para correos válidos
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) {
    return { valido: false, mensaje: 'Formato de correo inválido (ej. nombre@dominio.com).' };
  }

  const partes = email.split('@');
  if (partes.length !== 2) {
    return { valido: false, mensaje: 'El correo debe contener exactamente un símbolo "@".' };
  }

  const [usuario, dominioRaw] = partes;
  const usuarioLower = usuario.toLowerCase();
  const dominio = dominioRaw.toLowerCase();

  // Validar extensión / TLD
  const partesDominio = dominio.split('.');
  const tld = partesDominio[partesDominio.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { valido: false, mensaje: 'La extensión del dominio (TLD) no es válida (ej. .com, .pe, .org).' };
  }

  // Verificar si es un usuario ficticio o de prueba
  if (USUARIOS_FALSOS_PROHIBIDOS.has(usuarioLower)) {
    return {
      valido: false,
      mensaje: `El usuario "${usuario}" es de prueba o ficticio. Ingrese su correo personal o institucional activo.`,
    };
  }

  // Verificar si es un dominio ficticio o temporal
  if (DOMINIOS_FALSOS_PROHIBIDOS.has(dominio)) {
    return {
      valido: false,
      mensaje: `No se permiten dominios de prueba o temporales (@${dominio}). Ingrese un correo real.`,
    };
  }

  // Verificar posibles errores de tipeo en dominios comunes
  if (TIPOS_DOMINIOS_COMUNES[dominio]) {
    const sugerido = `${usuario}@${TIPOS_DOMINIOS_COMUNES[dominio]}`;
    return {
      valido: false,
      mensaje: `Parece que hay un error de tipeo en "@${dominio}".`,
      sugerenciaCorreccion: sugerido,
    };
  }

  return { valido: true };
}

// --------------------------------------------------------------------------
// 2. VALIDADOR DE TELÉFONO / CELULAR PERUANO
// --------------------------------------------------------------------------

const TELEFONOS_PRUEBA_BLOQUEADOS = new Set([
  '999999999',
  '911111111',
  '900000000',
  '922222222',
  '933333333',
  '944444444',
  '955555555',
  '966666666',
  '977777777',
  '988888888',
  '987654321',
  '987654320',
  '912345678',
  '923456789',
  '901234567',
  '912345670',
  '987987987',
  '912912912',
  '909090909',
  '989898989',
  '919191919',
  '929292929',
  '939393939',
  '900000001',
  '900000002',
  '912349123',
  '987659876',
]);

export interface ResultadoValidacionCelular {
  valido: boolean;
  mensaje?: string;
}

export function validarCelular(celularRaw: string): ResultadoValidacionCelular {
  const digitos = (celularRaw || '').replace(/\D/g, '');

  if (!digitos) {
    return { valido: false, mensaje: 'El número de celular es obligatorio.' };
  }

  if (digitos.length !== 9) {
    return {
      valido: false,
      mensaje: `El celular debe contener exactamente 9 dígitos numéricos (actualmente tiene ${digitos.length}).`,
    };
  }

  if (!digitos.startsWith('9')) {
    return {
      valido: false,
      mensaje: 'En Perú, todos los números de celular inician obligatoriamente con el dígito 9 (9XXXXXXXX).',
    };
  }

  // Lista negra de números de prueba conocidos
  if (TELEFONOS_PRUEBA_BLOQUEADOS.has(digitos)) {
    return {
      valido: false,
      mensaje: 'No se permiten números telefónicos de prueba, ficticios o en secuencia consecutiva.',
    };
  }

  // Detección de dígitos idénticos repetidos en exceso (ej. 988888881 tiene siete 8s)
  const conteoDigitos: Record<string, number> = {};
  for (const d of digitos) {
    conteoDigitos[d] = (conteoDigitos[d] || 0) + 1;
    if (conteoDigitos[d] >= 6) {
      return {
        valido: false,
        mensaje: 'El número celular contiene demasiados dígitos idénticos repetidos. Ingrese su número personal real.',
      };
    }
  }

  // Detección de patrones repetitivos tipo 3 dígitos repetidos 3 veces
  if (digitos.slice(0, 3) === digitos.slice(3, 6) && digitos.slice(3, 6) === digitos.slice(6, 9)) {
    return {
      valido: false,
      mensaje: 'El número celular presenta un patrón repetitivo ficticio. Ingrese un celular real.',
    };
  }

  return { valido: true };
}

// --------------------------------------------------------------------------
// 3. VALIDADOR DE FECHAS (Nacimiento vs Colegiatura)
// --------------------------------------------------------------------------

export interface ResultadoValidacionFechas {
  valido: boolean;
  mensaje?: string;
}

function parsearFechaLocal(fechaStr: string): Date | null {
  if (!fechaStr) return null;
  const parte = fechaStr.slice(0, 10);
  const match = parte.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const anio = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10) - 1;
  const dia = parseInt(match[3], 10);
  const date = new Date(anio, mes, dia);
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatearFechaEspanol(date: Date): string {
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

export function validarFechas(
  fechaNacimientoStr: string,
  fechaColegiaturaStr?: string | null,
): ResultadoValidacionFechas {
  if (!fechaNacimientoStr || fechaNacimientoStr.trim() === '') {
    return {
      valido: false,
      mensaje: 'La fecha de nacimiento es obligatoria para la actualización de su legajo colegial.',
    };
  }

  const fechaNac = parsearFechaLocal(fechaNacimientoStr);
  if (!fechaNac) {
    return {
      valido: false,
      mensaje: 'La fecha de nacimiento no tiene un formato válido (AAAA-MM-DD).',
    };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (fechaNac > hoy) {
    return {
      valido: false,
      mensaje: 'Inconsistencia: La fecha de nacimiento no puede ser una fecha futura.',
    };
  }

  const anioMinimo = 1910;
  if (fechaNac.getFullYear() < anioMinimo) {
    return {
      valido: false,
      mensaje: `Inconsistencia: El año de nacimiento no puede ser anterior a ${anioMinimo}.`,
    };
  }

  // Si existe fecha de colegiatura / incorporación en el padrón
  if (fechaColegiaturaStr) {
    const fechaCol = parsearFechaLocal(fechaColegiaturaStr);
    if (fechaCol) {
      // 1. Nacimiento debe ser estrictamente anterior a colegiatura
      if (fechaNac >= fechaCol) {
        return {
          valido: false,
          mensaje: `Inconsistencia de Fechas: Su fecha de nacimiento (${formatearFechaEspanol(
            fechaNac,
          )}) no puede ser igual o posterior a su fecha de incorporación/colegiatura al CIP (${formatearFechaEspanol(
            fechaCol,
          )}).`,
        };
      }

      // 2. Edad mínima reglamentaria al momento de colegiarse (18 años)
      let edadAlColegiarse = fechaCol.getFullYear() - fechaNac.getFullYear();
      const mesDiff = fechaCol.getMonth() - fechaNac.getMonth();
      if (mesDiff < 0 || (mesDiff === 0 && fechaCol.getDate() < fechaNac.getDate())) {
        edadAlColegiarse--;
      }

      if (edadAlColegiarse < 18) {
        return {
          valido: false,
          mensaje: `Inconsistencia de Fechas: La fecha de nacimiento ingresada (${formatearFechaEspanol(
            fechaNac,
          )}) indica que tenía ${edadAlColegiarse} años al colegiarse (${formatearFechaEspanol(
            fechaCol,
          )}). La edad mínima para graduación y colegiatura profesional es de 18 años.`,
        };
      }
    }
  } else {
    // Si no hay fecha de colegiatura registrada, verificar al menos mayoría de edad actual
    let edadActual = hoy.getFullYear() - fechaNac.getFullYear();
    const mDiff = hoy.getMonth() - fechaNac.getMonth();
    if (mDiff < 0 || (mDiff === 0 && hoy.getDate() < fechaNac.getDate())) {
      edadActual--;
    }
    if (edadActual < 18) {
      return {
        valido: false,
        mensaje: `La fecha de nacimiento indica una edad de ${edadActual} años. Se requiere mayoría de edad para el ejercicio colegial.`,
      };
    }
  }

  return { valido: true };
}

// --------------------------------------------------------------------------
// 4. DETECTOR INTELIGENTE DE SEXO (MASCULINO / FEMENINO) POR EL NOMBRE
// --------------------------------------------------------------------------

// Diccionario exhaustivo de nombres peruanos e hispanos masculinos
const NOMBRES_MASCULINOS = new Set([
  'GUIDO', 'JUAN', 'CARLOS', 'JOSE', 'LUIS', 'PEDRO', 'JORGE', 'MIGUEL', 'MANUEL',
  'CESAR', 'VICTOR', 'EDGAR', 'EDWIN', 'MARCO', 'MARCOS', 'WALTER', 'ROLANDO',
  'RAUL', 'RUBEN', 'OSCAR', 'JULIO', 'HECTOR', 'FERNANDO', 'JAVIER', 'ALFREDO',
  'ENRIQUE', 'HERNAN', 'JAIME', 'ALBERTO', 'ROBERTO', 'RICARDO', 'GUSTAVO',
  'DIEGO', 'HUGO', 'CHRISTIAN', 'CRISTIAN', 'RODRIGO', 'SEBASTIAN', 'ALEJANDRO',
  'DANIEL', 'DAVID', 'FELIX', 'GABRIEL', 'GUILLERMO', 'IVAN', 'LEONARDO',
  'MARTIN', 'MAX', 'PABLO', 'RONALD', 'WILFREDO', 'FREDDY', 'FRANK', 'PERCY',
  'BORIS', 'ALEXANDER', 'JHON', 'JHONNY', 'ANTONIO', 'ARTURO', 'BERNARDO',
  'DARIO', 'EDUARDO', 'EMILIO', 'ESTEBAN', 'FELIPE', 'FRANCISCO', 'GERARDO',
  'GONZALO', 'IGNACIO', 'JOAQUIN', 'LUCAS', 'MAURICIO', 'NICOLAS', 'RAMIRO',
  'SALVADOR', 'SANTIAGO', 'TOMAS', 'ALONSO', 'BRUNO', 'CRISTOBAL', 'DAMIAN',
  'DANTE', 'ELIAN', 'FACUNDO', 'FEDERICO', 'FRANCO', 'GAEL', 'IAN', 'IKER',
  'JOEL', 'LEANDRO', 'LIAM', 'LORENZO', 'MATEO', 'MATIAS', 'MAXIMO', 'MILO',
  'NESTOR', 'ORLANDO', 'PATRICIO', 'RAFAEL', 'SAMUEL', 'THIAGO', 'VALENTIN',
  'WILBERT', 'BRAULIO', 'CLODOALDO', 'ELEUTERIO', 'SEGUNDO', 'AGUSTIN', 'ABEL',
  'ABRAHAM', 'ADOLFO', 'ALVARO', 'AMADOR', 'ARMANDO', 'BENJAMIN', 'CANDIDO',
  'CIRO', 'CLAUDIO', 'DIONISIO', 'EFRAIN', 'ELIAS', 'ELISEO', 'EZEQUIEL',
  'FAUSTINO', 'FIDEL', 'FLORENCIO', 'FORTUNATO', 'GENARO', 'GERMAN', 'GREGORIO',
  'HILARIO', 'ISIDRO', 'JUSTO', 'LUCIO', 'MARCELO', 'MAXIMILIANO', 'MODESTO',
  'MOISES', 'OCTAVIO', 'PASCUAL', 'PAUL', 'REMIGIO', 'REYNALDO', 'RODOLFO',
  'ROGELIO', 'ROMULO', 'SATURNINO', 'SILVESTRE', 'TEODORO', 'TIMOTEO', 'URBANO',
  'VALERIO', 'WENCESLAO', 'ZENON', 'ABELARDO', 'ANIBAL', 'AQUILINO', 'ASUNCION',
  'ATILIO', 'AURELIO', 'BALDOMERO', 'BASILIO', 'BENICIO', 'BENITO', 'BLAS',
  'BONIFACIO', 'CAMILO', 'CAYETANO', 'CELESTINO', 'CIRILO', 'CLEMENTE', 'CRISPULO',
  'DEMETRIO', 'DESIDERIO', 'DOMINGO', 'DONATO', 'EDMUNDO', 'ELIODORO', 'EMETERIO',
  'EPIFANIO', 'ERASMO', 'ERNESTO', 'EUGENIO', 'EUSEBIO', 'EVARISTO', 'EXPEDITO',
  'FABIAN', 'FELICIANO', 'FILEMON', 'FROILAN', 'FULGENCIO', 'GASPAR', 'GILDER',
  'GRIMALDO', 'HERMENEGILDO', 'HERMOGENES', 'HILDEBRANDO', 'HIPOLITO', 'HOMERO',
  'HONORATO', 'ISMAEL', 'JACINTO', 'JERONIMO', 'JUVENAL', 'LEOCADIO', 'LIDIO',
  'LINO', 'LISANDRO', 'LORETO', 'LUCIANO', 'LUDOVICO', 'MACARIO', 'MANASSER',
  'MARCIAL', 'MARIANO', 'MAURO', 'MAXIMINO', 'MELCHOR', 'MIGUELANGEL', 'NARCISO',
  'NICANOR', 'NICODEMOS', 'NORBERTO', 'NOLBERTO', 'OBDULIO', 'OCTAVIANO',
  'ONESIMO', 'ONOFRE', 'ORESTES', 'OSWALDO', 'PABLO', 'PANCRACIO', 'PANTALEON',
  'PETRONILO', 'PIO', 'PLACIDO', 'POLICARPO', 'POMPEYO', 'PORFIRIO', 'PRIMITIVO',
  'PROCOPIO', 'PRUDENCIO', 'QUIRINO', 'RADOMIRO', 'RAMON', 'REGINALDO', 'RENE',
  'REYES', 'RIGOBERTO', 'ROBUSTIANO', 'ROQUE', 'ROSENDO', 'RUFINO', 'RUPERTO',
  'SABINO', 'SALOMON', 'SANTOS', 'SAUL', 'SEVERINO', 'SEVERO', 'SIXTO',
  'STANLEY', 'TACITO', 'TARSICIO', 'TELMO', 'TEOFILO', 'TIBURCIO', 'TITO',
  'TORIBIO', 'UBALDO', 'ULISES', 'VALDEMAR', 'VALERIANO', 'VENANCIO', 'VICENTE',
  'VIDAL', 'VIRGILIO', 'VITALIANO', 'VLADIMIR', 'WASHINGTON', 'WILMER', 'YONATHAN',
  'YHON', 'YURI', 'ZACARIAS',
]);

// Diccionario exhaustivo de nombres peruanos e hispanos femeninos
const NOMBRES_FEMENINOS = new Set([
  'CYNTIA', 'CINTHIA', 'CINTHYA', 'DYANA', 'DIANA', 'MARIA', 'ANA', 'ROSA',
  'CARMEN', 'PATRICIA', 'LUCIA', 'ELIZABETH', 'GLADYS', 'VERONICA', 'MONICA',
  'SUSANA', 'TERESA', 'ROCIO', 'MIRIAM', 'MYRIAM', 'RUTH', 'SILVIA', 'SONIA',
  'SANDRA', 'YOLANDA', 'KAREN', 'KATIA', 'KARINA', 'LILIANA', 'LIZ', 'LIZBETH',
  'MARITZA', 'NANCY', 'NORMA', 'OLGA', 'PAOLA', 'PILAR', 'ROXANA', 'SHEILA',
  'STEPHANIE', 'VANESSA', 'VILMA', 'YENNY', 'JESSICA', 'ADRIANA', 'ALEJANDRA',
  'ALICIA', 'ANGELA', 'BEATRIZ', 'CAROLINA', 'CECILIA', 'CLAUDIA', 'CRISTINA',
  'DANIELA', 'DEBORA', 'ELENA', 'ESTHER', 'EUGENIA', 'EVA', 'FATIMA', 'FLAVIA',
  'FLOR', 'GABRIELA', 'GLORIA', 'GRACIELA', 'INES', 'IRENE', 'ISABEL', 'IVONNE',
  'JIMENA', 'XIMENA', 'JULIA', 'LAURA', 'LORENA', 'LUISA', 'MAGALY', 'MARGARITA',
  'MARLENE', 'MERCEDES', 'NATALIA', 'NURIA', 'PAMELA', 'RAQUEL', 'REBECA',
  'SARA', 'SOFIA', 'VALERIA', 'VICTORIA', 'VIVIANA', 'YULISSA', 'YULISA',
  'BLANCA', 'BERTHA', 'CATALINA', 'CELIA', 'CONSUELO', 'DORA', 'EDITH', 'ELSA',
  'EMMA', 'ESPERANZA', 'FELICITAS', 'FORTUNATA', 'GENOVEVA', 'GUILLERMINA',
  'HILDA', 'INMACULADA', 'IRMA', 'ISIDORA', 'JOSEFINA', 'JUANA', 'JUDITH',
  'JULIANA', 'JUSTINA', 'LEONOR', 'LIDIA', 'LUCILA', 'MAGDALENA', 'MANUELA',
  'MARCELA', 'MARIBEL', 'MARTA', 'MARTHA', 'MATILDE', 'MAXIMA', 'MILAGROS',
  'MODESTA', 'NOEMI', 'OFELIA', 'PETRONILA', 'REGINA', 'ROSALIA', 'SABINA',
  'SEBASTIANA', 'SILVANA', 'TEODORA', 'TOMASINA', 'URSULA', 'VALENTINA',
  'VICENTA', 'VIOLETA', 'VIRGINIA', 'YENIFER', 'YOVANA', 'ZULMA', 'AIDA',
  'ALBA', 'AMALIA', 'AMANDA', 'AMPARO', 'ANABEL', 'ANTONIA', 'ARACELI',
  'AURORA', 'AZUCENA', 'BELEN', 'BENITA', 'BERNARDINA', 'BERTA', 'BRIGIDA',
  'CAMILA', 'CANDELARIA', 'CARLA', 'CARMELA', 'CASILDA', 'CLARA', 'CLEMENCIA',
  'CORINA', 'CRISPINA', 'DALILA', 'DELIA', 'DELFINA', 'DINA', 'DIONISIA',
  'DOLORES', 'DOMINGA', 'ELBA', 'ELVIRA', 'EMERITA', 'EMILIA', 'ENRIQUETA',
  'ERNESTINA', 'EULALIA', 'EUSEBIA', 'EVANGELINA', 'FIDELA', 'FILOMENA',
  'FIORELLA', 'FLORENTINA', 'FRANCISCA', 'GENARA', 'GEORGINA', 'GISELA',
  'GREGORIA', 'GUADALUPE', 'GUISELA', 'HAYDEE', 'HELENA', 'HERMELINDA',
  'ILIANA', 'IRIS', 'ISOLINA', 'JACINTA', 'JANET', 'JOHANA', 'JOSEFA',
  'LEIDY', 'LILA', 'LINA', 'LORETO', 'LOURDES', 'LUCINDA', 'MARGARITA',
  'MARINA', 'MELISSA', 'MIRIAN', 'MIRTHA', 'NADIA', 'NATALIA', 'NELLY',
  'NILDA', 'ORIANA', 'PASTORA', 'PAULINA', 'PRISCILA', 'PURIFICACION',
  'RAMONA', 'RAYMUNDA', 'REMEDIOS', 'ROSANA', 'ROSARIO', 'ROSITA', 'ROXANA',
  'RUTH', 'SALOME', 'SATURNINA', 'SECUNDINA', 'SILVESTRA', 'SOCORRO', 'SOLEDAD',
  'SONIA', 'SUSI', 'TANIA', 'TATIANA', 'TEOFILA', 'TRINIDAD', 'VICENTINA',
  'WENDY', 'YANET', 'YESENIA', 'YESSICA', 'YOLANDA', 'ZAIDA',
]);

// Nombres típicamente ambiguos o utilizados por ambos sexos en Perú
const NOMBRES_AMBIGUOS = new Set([
  'ANDREA', 'ARIEL', 'ALEXIS', 'ROSARIO', 'GUADALUPE', 'RENE', 'RENEE',
  'DENIS', 'DENISE', 'YURI', 'CRUZ', 'EVELYN', 'CONSUELO', 'SOCORRO',
  'PAZ', 'AMOR', 'MILAN', 'NOA', 'SASHA', 'CHARLIE', 'JESUS', 'MARIEL',
  'SANTOS', 'REYES', 'ASUNCION', 'TRINIDAD',
]);

// Palabras conectores a ignorar en nombres compuestos
const CONECTORES = new Set(['DE', 'DEL', 'LA', 'LOS', 'LAS', 'Y', 'SAN', 'SANTA']);

export interface ResultadoDeteccionSexo {
  sexoDetectado: 'M' | 'F' | '';
  confianza: 'ALTA' | 'MEDIA' | 'AMBIGUO';
  motivo: string;
}

export function detectarSexoPorNombre(
  nombreCompleto: string,
  sexoRegistrado?: string,
): ResultadoDeteccionSexo {
  if (!nombreCompleto || typeof nombreCompleto !== 'string') {
    return {
      sexoDetectado: sexoRegistrado === 'M' || sexoRegistrado === 'F' ? sexoRegistrado : '',
      confianza: 'AMBIGUO',
      motivo: 'Nombre no disponible.',
    };
  }

  // Normalizar: mayúsculas, sin tildes ni diacríticos
  const limpio = nombreCompleto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // Extraer tokens
  const palabras = limpio
    .split(/\s+/)
    .map((p) => p.replace(/[^A-Z]/g, ''))
    .filter((p) => p.length > 0 && !CONECTORES.has(p));

  if (palabras.length === 0) {
    return {
      sexoDetectado: sexoRegistrado === 'M' || sexoRegistrado === 'F' ? sexoRegistrado : '',
      confianza: 'AMBIGUO',
      motivo: 'No se encontraron palabras analizables.',
    };
  }

  const primerNombre = palabras[0];
  const segundoNombre = palabras.length > 1 ? palabras[1] : null;

  // REGLA 1: Casos compuestos especiales emblemáticos en español
  // "JOSE MARIA" -> Masculino (el primer nombre JOSE es masculino)
  // "MARIA JOSE" -> Femenino (el primer nombre MARIA es femenino)
  // "JUAN DE DIOS" -> Masculino
  // "MARIA DEL CARMEN" -> Femenino

  // REGLA 2: Nombres ambiguos/unisex conocidos
  if (NOMBRES_AMBIGUOS.has(primerNombre)) {
    // Si hay un segundo nombre, evaluamos el segundo nombre para desambiguar
    if (segundoNombre) {
      if (NOMBRES_MASCULINOS.has(segundoNombre)) {
        return {
          sexoDetectado: 'M',
          confianza: 'MEDIA',
          motivo: `Nombre unisex "${primerNombre}" desambiguado por segundo nombre masculino "${segundoNombre}".`,
        };
      }
      if (NOMBRES_FEMENINOS.has(segundoNombre)) {
        return {
          sexoDetectado: 'F',
          confianza: 'MEDIA',
          motivo: `Nombre unisex "${primerNombre}" desambiguado por segundo nombre femenino "${segundoNombre}".`,
        };
      }
    }

    // Si no se puede desambiguar por segundo nombre, respetamos el registrado en padrón
    if (sexoRegistrado === 'M' || sexoRegistrado === 'F') {
      return {
        sexoDetectado: sexoRegistrado,
        confianza: 'AMBIGUO',
        motivo: `El nombre "${primerNombre}" es utilizado por ambos géneros; se preserva el registrado en padrón (${sexoRegistrado === 'M' ? 'Masculino' : 'Femenino'}).`,
      };
    }

    return {
      sexoDetectado: '',
      confianza: 'AMBIGUO',
      motivo: `El nombre "${primerNombre}" es unisex. Seleccione la opción correspondiente.`,
    };
  }

  // REGLA 3: Búsqueda en diccionario exhaustivo del primer nombre
  if (NOMBRES_MASCULINOS.has(primerNombre)) {
    return {
      sexoDetectado: 'M',
      confianza: 'ALTA',
      motivo: `Identificado como Masculino por el nombre "${primerNombre}".`,
    };
  }

  if (NOMBRES_FEMENINOS.has(primerNombre)) {
    return {
      sexoDetectado: 'F',
      confianza: 'ALTA',
      motivo: `Identificado como Femenino por el nombre "${primerNombre}".`,
    };
  }

  // REGLA 4: Si el primer nombre no está en diccionario, buscar en el segundo nombre
  if (segundoNombre) {
    if (NOMBRES_MASCULINOS.has(segundoNombre)) {
      return {
        sexoDetectado: 'M',
        confianza: 'MEDIA',
        motivo: `Identificado como Masculino por el segundo nombre "${segundoNombre}".`,
      };
    }
    if (NOMBRES_FEMENINOS.has(segundoNombre)) {
      return {
        sexoDetectado: 'F',
        confianza: 'MEDIA',
        motivo: `Identificado como Femenino por el segundo nombre "${segundoNombre}".`,
      };
    }
  }

  // REGLA 5: Heurística morfológica por terminaciones comunes en idioma español
  // Terminaciones masculinas: -o, -or, -el, -er, -an, -on, -io, -os, -ul, -ur
  if (/(O|OR|EL|ER|AN|ON|IO|OS|UL|UR)$/.test(primerNombre)) {
    return {
      sexoDetectado: 'M',
      confianza: 'MEDIA',
      motivo: `Sugerido Masculino por la terminación gramatical de "${primerNombre}".`,
    };
  }

  // Terminaciones femeninas: -a, -as, -ia, -ina, -ena, -ita, -ela, -ara, -isa
  if (/(A|AS|IA|INA|ENA|ITA|ELA|ARA|ISA|ETH|IS)$/.test(primerNombre)) {
    return {
      sexoDetectado: 'F',
      confianza: 'MEDIA',
      motivo: `Sugerido Femenino por la terminación gramatical de "${primerNombre}".`,
    };
  }

  // Si no coincide con ninguna regla, mantener el registrado o pedir selección
  if (sexoRegistrado === 'M' || sexoRegistrado === 'F') {
    return {
      sexoDetectado: sexoRegistrado,
      confianza: 'AMBIGUO',
      motivo: `Preservado según registro en padrón (${sexoRegistrado === 'M' ? 'Masculino' : 'Femenino'}).`,
    };
  }

  return {
    sexoDetectado: '',
    confianza: 'AMBIGUO',
    motivo: 'No se pudo determinar automáticamente el género. Por favor seleccione una opción.',
  };
}

// --------------------------------------------------------------------------
// 5. NORMALIZADOR ESTÁNDAR DE ESTADO CIVIL
// --------------------------------------------------------------------------

export function normalizarEstadoCivil(
  estadoCivilRaw?: string | null,
  codigoRaw?: string | null,
): string {
  const t = String(estadoCivilRaw || '').toUpperCase().trim();
  const c = String(codigoRaw || '').toUpperCase().trim();
  const val = `${t} ${c}`.trim();

  if (!val) return '';

  // Divorciado(a) - Códigos y variantes comunes en DB legado y padrón
  if (
    t.startsWith('DIV') ||
    t.includes('DIVORCIAD') ||
    c === '4' ||
    c === '04' ||
    c === 'D' ||
    c === 'DIV'
  ) {
    return 'Divorciado(a)';
  }

  // Casado(a)
  if (
    t.startsWith('CAS') ||
    t.includes('CASAD') ||
    c === '2' ||
    c === '02' ||
    c === 'C' ||
    c === 'CAS'
  ) {
    return 'Casado(a)';
  }

  // Viudo(a)
  if (
    t.startsWith('VIU') ||
    t.includes('VIUD') ||
    c === '3' ||
    c === '03' ||
    c === 'V' ||
    c === 'VIU'
  ) {
    return 'Viudo(a)';
  }

  // Conviviente
  if (
    t.startsWith('CONV') ||
    t.includes('CONVIV') ||
    t.includes('UNION') ||
    c === '5' ||
    c === '05'
  ) {
    return 'Conviviente';
  }

  // Soltero(a)
  if (
    t.startsWith('SOL') ||
    t.includes('SOLTER') ||
    c === '1' ||
    c === '01' ||
    c === 'S' ||
    c === 'SOL'
  ) {
    return 'Soltero(a)';
  }

  return (estadoCivilRaw || '').trim();
}
