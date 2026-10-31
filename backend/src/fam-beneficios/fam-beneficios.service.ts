import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FamService } from '../fam/fam.service';
import { CrearFamSolicitudDto, ActualizarFamSolicitudDto, CrearRegistroFamDto } from './dto/fam-solicitud.dto';

const CAMPOS_DOCUMENTO = [
  'fichaAdmisibilidad',
  'solicitudAsignacion',
  'cartaRemision',
  'memorando',
  'ordenPago',
  'sucesionIntestada',
  'declaracionJurada',
  'actaDefuncion',
  'otrosDocumentos',
] as const;

type CampoDocumento = (typeof CAMPOS_DOCUMENTO)[number];

const NOMBRES_DOCUMENTO: Record<CampoDocumento, string> = {
  fichaAdmisibilidad: 'Ficha de admisibilidad',
  solicitudAsignacion: 'Solicitud de asignación',
  cartaRemision: 'Carta de remisión',
  memorando: 'Memorando',
  ordenPago: 'Orden de pago',
  sucesionIntestada: 'Sucesión intestada',
  declaracionJurada: 'Declaración jurada',
  actaDefuncion: 'Acta de defunción',
  otrosDocumentos: 'Otros / Documentación completa',
};

const TIPOS_DOCUMENTO_BENEFICIARIO = ['declaracionJurada', 'ordenPago'] as const;
type TipoDocumentoBeneficiario = (typeof TIPOS_DOCUMENTO_BENEFICIARIO)[number];

const fmtMontoHistorial = (monto: number) =>
  `S/ ${Number(monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const TIPOS_BOLSA = ['FALLECIMIENTO', 'INCAPACIDAD', 'ENF_TERMINAL'];
const ALIAS_CODIGO_TIPO: Record<string, string> = {
  FALLECIMIENTO: 'FALLECIMIENTO',
  INCAPACIDAD: 'INCAPACIDAD',
  ACCIDENTE: 'INCAPACIDAD',
  ACCIDENTE_GRAVE: 'INCAPACIDAD',
  ENF_TERMINAL: 'ENF_TERMINAL',
  ENFERMEDAD_TERMINAL: 'ENF_TERMINAL',
};
const MONTO_BASE_POR_DEFECTO: Record<string, number> = {
  FALLECIMIENTO: 3000,
  INCAPACIDAD: 2000,
  ENF_TERMINAL: 2000,
};

@Injectable()
export class FamBeneficiosService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private famService: FamService,
  ) {}

  private async calcularCovidTotal(colegiadoId: string): Promise<number> {
    let total = 0;
    try {
      const asignaciones = await this.prisma.famCovidAsignacion.findMany({
        where: { colegiadoId, activo: true },
        select: { monto: true },
      });
      total += asignaciones.reduce((sum, a) => sum + Number(a.monto), 0);
    } catch {}
    try {
      const expedientes = await this.prisma.famSolicitudBeneficio.findMany({
        where: {
          colegiadoId,
          estado: { in: ['PAGADA', 'APROBADA'] },
          tipoBeneficio: { codigo: 'COVID_19' },
        },
        select: { monto: true },
      });
      total += expedientes.reduce((sum, e) => sum + Number(e.monto), 0);
    } catch {}
    return total;
  }

  private validarDocumentacion(dto: {
    documentacionCompleta?: boolean;
    documentacionObservacion?: string;
    declaracionJurada?: string;
    declaracionJuradaDni?: string;
  }) {
    if (dto.documentacionCompleta === false && !dto.documentacionObservacion?.trim()) {
      throw new BadRequestException(
        'Si la documentacion esta incompleta debe indicar una justificacion (documentacionObservacion)',
      );
    }

    const dni = dto.declaracionJuradaDni?.trim();
    if (dni && !/^\d{8}$/.test(dni)) {
      throw new BadRequestException('El DNI de la Declaracion Jurada debe tener exactamente 8 digitos');
    }
    if (dto.declaracionJurada && !dni) {
      throw new BadRequestException('La Declaracion Jurada requiere el DNI del declarante (8 digitos)');
    }
  }

  /**
   * Reglas del solicitante:
   * - Con beneficiarios registrados: solicitanteBeneficiarioId debe pertenecer a la lista.
   * - Sin beneficiarios (sucesion intestada): exige el PDF de sucesion + nombre manual.
   */
  private validarSolicitante(dto: CrearRegistroFamDto) {
    const conBeneficiarios = dto.beneficiarios.length > 0;

    if (conBeneficiarios) {
      const ids = (dto.solicitanteBeneficiarioIds?.length
        ? dto.solicitanteBeneficiarioIds
        : [dto.solicitanteBeneficiarioId].filter(Boolean)) as string[];
      const indices = (dto.solicitanteIndices?.length
        ? dto.solicitanteIndices
        : (dto.solicitanteIndice !== undefined ? [dto.solicitanteIndice] : [])) as number[];

      const porId = dto.solicitanteBeneficiarioId?.trim();
      const indiceValido =
        dto.solicitanteIndice !== undefined &&
        dto.solicitanteIndice >= 0 &&
        dto.solicitanteIndice < dto.beneficiarios.length;
      const idValido = !!porId && dto.beneficiarios.some((b) => b.id && b.id === porId);

      const algunIdInvalido = ids.some((id) => !dto.beneficiarios.some((b) => b.id && b.id === id));
      const algunIndiceInvalido = indices.some((idx) => idx < 0 || idx >= dto.beneficiarios.length);

      if ((porId && !idValido) || algunIdInvalido || algunIndiceInvalido) {
        throw new BadRequestException('El solicitante seleccionado no pertenece a los beneficiarios del expediente');
      }
      if (!porId && !indiceValido && ids.length === 0 && indices.length === 0) {
        throw new BadRequestException('Debe seleccionar quien es el solicitante entre los beneficiarios registrados');
      }
    } else {
      if (!dto.sucesionIntestada?.trim()) {
        throw new BadRequestException('Sin beneficiarios registrados es obligatorio adjuntar la Sucesión Intestada (PDF)');
      }
      if (!dto.solicitanteNombre?.trim()) {
        throw new BadRequestException('Sin beneficiarios registrados debe indicar el nombre del solicitante según la sucesión intestada');
      }
    }
  }

  private construirSolicitanteData(dto: Record<string, any>) {
    return {
      ...(dto.solicitanteBeneficiarioId !== undefined && {
        solicitanteBeneficiarioId: dto.solicitanteBeneficiarioId || null,
      }),
      ...(dto.solicitanteNombre !== undefined && {
        solicitanteNombre: dto.solicitanteNombre?.trim() || null,
      }),
      ...(dto.solicitanteDni !== undefined && {
        solicitanteDni: dto.solicitanteDni?.trim() || null,
      }),
    };
  }

  // Datos capturados segun el tipo de beneficio (fallecimiento / enfermedad terminal / accidente grave)
  private construirDatosEspeciales(dto: Record<string, any>, soloDefinidos = false) {
    const fechas = ['fechaDefuncion', 'fechaDiagnostico', 'fechaAccidente'];
    const textos = ['causaFallecimiento', 'diagnosticoMedico', 'descripcionAccidente'];
    const data: Record<string, any> = {};

    for (const campo of fechas) {
      const valor = dto[campo];
      if (soloDefinidos) {
        if (valor !== undefined) data[campo] = valor ? new Date(valor) : null;
      } else if (valor) {
        data[campo] = new Date(valor);
      }
    }

    for (const campo of textos) {
      const valor = dto[campo];
      if (soloDefinidos) {
        if (valor !== undefined) data[campo] = valor?.trim() || null;
      } else if (valor?.trim()) {
        data[campo] = valor.trim();
      }
    }

    return data;
  }

  private construirDataExpediente(dto: CrearRegistroFamDto) {
    return {
      estado: dto.estado || 'PENDIENTE',
      ...(dto.fechaSolicitud && { fechaSolicitud: new Date(dto.fechaSolicitud) }),
      ...(dto.fechaPago && { fechaPago: new Date(dto.fechaPago) }),
      documentacionCompleta: dto.documentacionCompleta !== false,
      ...(dto.documentacionObservacion?.trim() && { documentacionObservacion: dto.documentacionObservacion.trim() }),
      ...this.construirSolicitanteData(dto),
      ...CAMPOS_DOCUMENTO.reduce((acc, campo: CampoDocumento) => {
        const valor = (dto as any)[campo];
        if (valor) acc[campo] = valor;
        return acc;
      }, {} as Record<string, string>),
      ...(dto.declaracionJuradaDni?.trim() && { declaracionJuradaDni: dto.declaracionJuradaDni.trim() }),
      ...this.construirDatosEspeciales(dto as any),
    };
  }

  private redondearMonto(valor: number): number {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
  }

  private sumaPorcentajes(
    vinculos: { porcentajeAsignado: unknown }[] | { porcentaje: unknown }[],
  ): number {
    return this.redondearMonto(
      vinculos.reduce((acc, v: any) => acc + Number(v.porcentajeAsignado ?? v.porcentaje ?? 0), 0),
    );
  }

  private validarDeclaracionesBeneficiarios(
    beneficiarios: { nombre?: string; dni?: string; declaracionJurada?: string; declaracionJuradaDni?: string }[],
    obligatorio: boolean,
  ) {
    const faltantes: string[] = [];
    for (const b of beneficiarios) {
      const dni = b.declaracionJuradaDni?.trim();
      if (dni && !/^\d{8}$/.test(dni)) {
        throw new BadRequestException(
          `La Declaración Jurada de ${b.nombre || 'un beneficiario'} requiere un DNI de 8 dígitos`,
        );
      }
      if (b.declaracionJurada && !dni) {
        throw new BadRequestException(
          `La Declaración Jurada de ${b.nombre || 'un beneficiario'} requiere el DNI del declarante`,
        );
      }
      if (obligatorio && !b.declaracionJurada) {
        faltantes.push(b.nombre || b.dni || 'Beneficiario sin nombre');
      }
    }
    if (faltantes.length) {
      throw new BadRequestException(
        `Falta la Declaración Jurada de: ${faltantes.join(', ')}`,
      );
    }
  }

  private construirMontosDeposito(
    total: number,
    items: { beneficiarioId?: string; nombre?: string; dni?: string; porcentaje: number }[],
  ) {
    const totalRedondeado = this.redondearMonto(total);
    let acumulado = 0;
    return items.map((item, index) => {
      const esUltimo = index === items.length - 1;
      const monto = esUltimo
        ? this.redondearMonto(totalRedondeado - acumulado)
        : this.redondearMonto((totalRedondeado * item.porcentaje) / 100);
      acumulado = this.redondearMonto(acumulado + monto);
      return { ...item, monto };
    });
  }

  private construirEstadoReparto(solicitud: any) {    const vinculos = solicitud.vinculos || [];
    const depositos = solicitud.depositos || [];
    const porcentajeAsignado = this.sumaPorcentajes(vinculos);
    const beneficiariosFaltantes = vinculos
      .filter((v: any) => !v.declaracionJurada)
      .map((v: any) => v.beneficiario?.nombre || 'Beneficiario');
    const sinBeneficiarios = vinculos.length === 0;
    const pagada = solicitud.estado === 'PAGADA';
    const completo = porcentajeAsignado >= 100 || (sinBeneficiarios && !!solicitud.sucesionIntestada);
    const declaracionesCompletas = sinBeneficiarios
      ? !!solicitud.sucesionIntestada
      : beneficiariosFaltantes.length === 0;

    return {
      porcentajeAsignado,
      completo,
      declaracionesCompletas,
      beneficiariosFaltantes,
      depositosRegistrados: depositos.length,
      listoParaPago: !pagada && completo && declaracionesCompletas && depositos.length === 0,
      pagada,
    };
  }

  private normalizarCodigoTipo(nombre: string): string | null {
    const clave = (nombre || '').toUpperCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
    return ALIAS_CODIGO_TIPO[clave] || null;
  }

  private buscarTipoPorConfig<T extends { codigo: string; nombre: string }>(
    todosTipos: T[],
    nombreConfig: string,
  ): T | undefined {
    const alias = this.normalizarCodigoTipo(nombreConfig);
    return todosTipos.find(
      (t) =>
        (alias !== null && t.codigo === alias) ||
        t.nombre.toUpperCase().trim() === (nombreConfig || '').toUpperCase().trim(),
    );
  }

  async montoBaseTipo(codigo: string): Promise<number> {
    try {
      const monto = await this.prisma.montoFam.findFirst({
        where: { aplicaA: codigo, activo: true },
        orderBy: { id: 'asc' },
        select: { monto: true },
      });
      if (monto) return Number(monto.monto);
    } catch {}
    return MONTO_BASE_POR_DEFECTO[codigo] ?? 0;
  }

  // Un colegiado solo puede tener un expediente vigente por tipo de beneficio.
  // Si existe uno parcial, debe completarse en lugar de crear otro.
  private async obtenerExpedienteActivo(colegiadoId: string, tipoCodigo: string) {
    if (!TIPOS_BOLSA.includes(tipoCodigo)) return null;
    try {
      return await this.prisma.famSolicitudBeneficio.findFirst({
        where: {
          colegiadoId,
          estado: { not: 'RECHAZADA' },
          tipoBeneficio: { codigo: tipoCodigo },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          tipoBeneficio: true,
          vinculos: { include: { beneficiario: true } },
          depositos: true,
        },
      });
    } catch {
      return null;
    }
  }

  async verificarColegiadoFallecido(colegiadoId: string, ignorarSolicitudId?: string) {
    if (!colegiadoId) return null;
    const cleanId = String(colegiadoId).trim();
    const idSinPrefijo = cleanId.replace(/^C-/, '');
    const posiblesIds = [cleanId, idSinPrefijo, `C-${idSinPrefijo}`];

    try {
      const sol = await this.prisma.famSolicitudBeneficio.findFirst({
        where: {
          colegiadoId: { in: posiblesIds },
          estado: { not: 'RECHAZADA' },
          ...(ignorarSolicitudId && { id: { not: ignorarSolicitudId } }),
          OR: [
            { tipoBeneficio: { codigo: 'FALLECIMIENTO' } },
            { tipoBeneficio: { nombre: { contains: 'Fallecimiento' } } },
            { fechaDefuncion: { not: null } },
            { actaDefuncion: { not: null } },
          ],
        },
        include: {
          tipoBeneficio: true,
          vinculos: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!sol) return null;

      const esFallecimiento =
        sol.tipoBeneficio?.codigo === 'FALLECIMIENTO' ||
        (sol.tipoBeneficio?.nombre || '').toUpperCase().includes('FALLECIMIENTO') ||
        Boolean(sol.fechaDefuncion) ||
        Boolean(sol.actaDefuncion);

      if (!esFallecimiento) return null;

      return sol;
    } catch {
      return null;
    }
  }

  async validarColegiadoFallecido(colegiadoId: string, tipoCodigo?: string, ignorarSolicitudId?: string) {
    const fallecimiento = await this.verificarColegiadoFallecido(colegiadoId, ignorarSolicitudId);
    if (!fallecimiento) return;

    // Si el beneficio solicitado no es fallecimiento, queda totalmente bloqueado
    if (tipoCodigo && tipoCodigo !== 'FALLECIMIENTO') {
      throw new BadRequestException(
        'No se pueden registrar más beneficios porque el colegiado está fallecido.',
      );
    }

    // Si el beneficio solicitado es fallecimiento (o no se especificó), verificar si ya está pagado o completo
    const reparto = this.construirEstadoReparto(fallecimiento);
    if (reparto.completo || reparto.pagada || fallecimiento.estado === 'PAGADA' || fallecimiento.estado === 'APROBADA') {
      throw new BadRequestException(
        'No se pueden registrar más beneficios porque el colegiado está fallecido.',
      );
    }
  }

  private async validarExpedienteUnico(colegiadoId: string, tipoCodigo: string) {
    await this.validarColegiadoFallecido(colegiadoId, tipoCodigo);

    if (!TIPOS_BOLSA.includes(tipoCodigo)) return null;
    const existente = await this.obtenerExpedienteActivo(colegiadoId, tipoCodigo);
    if (!existente) return null;

    const reparto = this.construirEstadoReparto(existente);
    if (tipoCodigo === 'FALLECIMIENTO' && (reparto.completo || reparto.pagada)) {
      throw new BadRequestException(
        'No se pueden registrar más beneficios porque el colegiado está fallecido.',
      );
    }

    throw new ConflictException({
      statusCode: 409,
      message: reparto.completo
        ? `El colegiado ya tiene el beneficio ${existente.tipoBeneficio?.nombre || tipoCodigo} cubierto al 100%. No se pueden registrar más beneficios.`
        : `El colegiado ya tiene un expediente de ${existente.tipoBeneficio?.nombre || tipoCodigo} en curso (${reparto.porcentajeAsignado}% asignado). Debe completar ese expediente.`,
      solicitudId: existente.id,
      porcentajeAsignado: reparto.porcentajeAsignado,
      completo: reparto.completo,
    });
  }

  async crearRegistro(dto: CrearRegistroFamDto, userId: string, ip?: string) {
    if (!dto.colegiadoId?.trim()) {
      throw new BadRequestException('colegiadoId es requerido');
    }
    this.validarDocumentacion(dto);
    this.validarSolicitante(dto);

    // Snapshot del solicitante elegido entre los beneficiarios registrados:
    // Si viene más de uno o ya tiene solicitanteNombre armado, respetarlo.
    const idsSel = (dto.solicitanteBeneficiarioIds?.length
      ? dto.solicitanteBeneficiarioIds
      : [dto.solicitanteBeneficiarioId].filter(Boolean)) as string[];
    const indicesSel = (dto.solicitanteIndices?.length
      ? dto.solicitanteIndices
      : (dto.solicitanteIndice !== undefined ? [dto.solicitanteIndice] : [])) as number[];

    const bensSolicitantes = dto.beneficiarios.filter((b, idx) =>
      (b.id && idsSel.includes(b.id)) || indicesSel.includes(idx)
    );

    if (bensSolicitantes.length > 0) {
      if (!dto.solicitanteNombre?.trim()) {
        dto.solicitanteNombre = bensSolicitantes.map((b) => b.nombre.trim()).join(' / ');
      }
      if (!dto.solicitanteDni?.trim()) {
        const dnis = bensSolicitantes.map((b) => b.dni?.trim()).filter(Boolean);
        const dniStr = dnis.join(' / ');
        dto.solicitanteDni = dniStr.length <= 20 ? dniStr : (dnis[0] || undefined);
      }
      if (!dto.solicitanteBeneficiarioId && bensSolicitantes[0]?.id) {
        dto.solicitanteBeneficiarioId = bensSolicitantes[0].id;
      }
    } else {
      const benSolicitante = dto.beneficiarios.find((b) => b.id && b.id === dto.solicitanteBeneficiarioId);
      if (benSolicitante) {
        if (!dto.solicitanteNombre?.trim()) {
          dto.solicitanteNombre = benSolicitante.nombre.trim();
        }
        if (!dto.solicitanteDni?.trim()) {
          dto.solicitanteDni = benSolicitante.dni || undefined;
        }
      }
    }

    if (dto.solicitanteNombre && dto.solicitanteNombre.length > 200) {
      dto.solicitanteNombre = dto.solicitanteNombre.slice(0, 200);
    }
    if (dto.solicitanteDni && dto.solicitanteDni.length > 20) {
      dto.solicitanteDni = dto.solicitanteDni.slice(0, 20);
    }

    // Calcular suma de porcentajes (necesaria para validaciones)
    const suma = this.redondearMonto(
      dto.beneficiarios.reduce((acc, b) => acc + Number(b.porcentaje || 0), 0),
    );

    // Validación según modalidad de beneficio
    if (dto.modalidadBeneficio) {
      switch (dto.modalidadBeneficio) {
        case 'monto_unico':
          // 0 beneficiarios solo permitido con sucesion intestada adjunta
          if (dto.beneficiarios.length === 0 && !dto.sucesionIntestada?.trim()) {
            throw new BadRequestException('Monto Único requiere exactamente 1 beneficiario, o 0 con Sucesión Intestada adjunta');
          }
          if (dto.beneficiarios.length > 1) {
            throw new BadRequestException('Monto Único admite como máximo 1 beneficiario');
          }
          // Forzar porcentaje a 100% si no viene o es distinto
          dto.beneficiarios.forEach(b => {
            b.porcentaje = 100;
          });
          break;

        case 'monto_compartido':
          if (dto.beneficiarios.length === 0) {
            throw new BadRequestException('Monto Compartido requiere al menos 1 beneficiario registrado');
          }
          if (suma > 100) {
            throw new BadRequestException('Monto Compartido: la suma de porcentajes no puede exceder el 100%');
          }
          break;

        case 'opcion_sucesiva':
          // Sucesion sucesiva: TODOS los beneficiarios quedan al 100%;
          // cobra el primero disponible segun el orden de inscripcion.
          // Si el primero no quiere o ha fallecido, pasa al siguiente, etc.
          dto.beneficiarios.forEach((b, i) => {
            b.porcentaje = 100;
            if (!b.orden) b.orden = i + 1;
          });
          // Ordenar beneficiarios por el campo orden ASC
          dto.beneficiarios.sort((a, b) => (a.orden || 0) - (b.orden || 0));
          break;

        default:
          // Si la modalidad no es reconocida, mantener validación antigua de suma <= 100
          if (suma > 100) {
            throw new BadRequestException(`La suma de porcentajes (${suma}%) excede el 100%`);
          }
          break;
      }
    } else if (suma > 100) {
      // Validación original si no hay modalidad especificada y suma > 100
      throw new BadRequestException(`La suma de porcentajes (${suma}%) excede el 100%`);
    }

    // Resolver tipo de beneficio: aceptar tipoBeneficioId (UUID) o tipoBeneficioConfigId (catálogo)
    let tipoBeneficio;
    if (dto.tipoBeneficioConfigId) {
      const configTipo = await this.prisma.tipoBeneficioConfig.findUnique({
        where: { id: dto.tipoBeneficioConfigId },
      });
      if (!configTipo) throw new BadRequestException('Tipo de beneficio (catálogo) no encontrado');
      // Buscar por nombre en la tabla operacional (case-insensitive via JS)
      const todosTipos = await this.prisma.tipoBeneficio.findMany({
        where: { programa: 'FAM', activo: true },
      });
      tipoBeneficio = this.buscarTipoPorConfig(todosTipos, configTipo.nombre) || null;
      // Si no existe, crearlo automáticamente
      if (!tipoBeneficio) {
        tipoBeneficio = await this.prisma.tipoBeneficio.create({
          data: {
            id: `TB-FAM-${Date.now()}`,
            codigo: this.normalizarCodigoTipo(configTipo.nombre)
              || configTipo.nombre.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_'),
            nombre: configTipo.nombre,
            descripcion: configTipo.descripcion || `Tipo operacional FAM para ${configTipo.nombre}`,
            programa: 'FAM',
            activo: true,
          },
        });
      }
    } else if (dto.tipoBeneficioId) {
      tipoBeneficio = await this.prisma.tipoBeneficio.findUnique({
        where: { id: dto.tipoBeneficioId },
      });
    } else {
      throw new BadRequestException('Debe indicar tipoBeneficioId o tipoBeneficioConfigId');
    }
    if (!tipoBeneficio) {
      throw new BadRequestException('Tipo de beneficio no encontrado');
    }

    // Validar siempre si el colegiado ya se encuentra registrado por fallecimiento
    await this.validarColegiadoFallecido(dto.colegiadoId.trim(), tipoBeneficio.codigo);

    if (TIPOS_BOLSA.includes(tipoBeneficio.codigo)) {
      await this.validarExpedienteUnico(dto.colegiadoId.trim(), tipoBeneficio.codigo);
      const base = await this.montoBaseTipo(tipoBeneficio.codigo);
      if (base > 0 && dto.monto > base) {
        throw new BadRequestException(
          `El monto del expediente no puede superar el monto base de ${tipoBeneficio.nombre} (S/ ${base.toFixed(2)})`,
        );
      }
      this.validarDeclaracionesBeneficiarios(dto.beneficiarios, false);

      const porcentajes = dto.beneficiarios.reduce((acc, b) => acc + Number(b.porcentaje || 0), 0);
      if (dto.beneficiarios.length > 0 && this.redondearMonto(porcentajes) > 100) {
        throw new BadRequestException('La suma de porcentajes de los beneficiarios no puede exceder el 100%');
      }
      if (dto.estado === 'PAGADA' && dto.beneficiarios.length > 0 && this.redondearMonto(porcentajes) < 100) {
        throw new BadRequestException(
          'No se puede registrar como PAGADA: la suma de porcentajes de los beneficiarios debe ser 100%',
        );
      }
    }

    // COVID_19: NO se descuenta aquí, solo se registra
    // ENF_TERMINAL: Se descuenta el total de COVID recibido (fam_covid_asignaciones)
    let descuentoCovid = 0;
    let montoFinal = dto.monto;
    let covidAsignacionId: string | null = null;

    if (tipoBeneficio.codigo === 'ENF_TERMINAL') {
      const covidTotal = await this.calcularCovidTotal(dto.colegiadoId.trim());
      if (covidTotal > 0) {
        descuentoCovid = covidTotal;
        montoFinal = Math.max(0, dto.monto - descuentoCovid);
        // Guardar referencia de la última asignación COVID
        try {
          const ultimaCovid = await this.prisma.famCovidAsignacion.findFirst({
            where: { colegiadoId: dto.colegiadoId.trim(), activo: true },
            orderBy: { createdAt: 'desc' },
          });
          if (ultimaCovid) covidAsignacionId = ultimaCovid.id;
        } catch {}
      }
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const idsVinculados: {
        beneficiarioId: string;
        porcentajeAsignado: number;
        nombre: string;
        dni: string | null;
        declaracionJurada: string | null;
        declaracionJuradaDni: string | null;
        ordenPago: string | null;
      }[] = [];

      for (const b of dto.beneficiarios) {
        let beneficiarioId = b.id;
        if (beneficiarioId) {
          const existing = await tx.famBeneficiario.findUnique({ where: { id: beneficiarioId } });
          if (!existing || existing.colegiadoId !== dto.colegiadoId) {
            throw new BadRequestException(`Beneficiario ${b.nombre} no pertenece al colegiado`);
          }
          await tx.famBeneficiario.update({
            where: { id: beneficiarioId },
            data: {
              nombre: b.nombre.trim(),
              dni: b.dni || null,
              parentesco: b.parentesco,
              porcentaje: b.porcentaje,
              observaciones: b.observaciones || null,
            },
          });
        } else {
          const nuevo = await tx.famBeneficiario.create({
            data: {
              colegiadoId: dto.colegiadoId,
              nombre: b.nombre.trim(),
              dni: b.dni || null,
              parentesco: b.parentesco,
              porcentaje: b.porcentaje,
              observaciones: b.observaciones || null,
              registradoPor: userId,
            },
          });
          beneficiarioId = nuevo.id;
        }
        idsVinculados.push({
          beneficiarioId,
          porcentajeAsignado: b.porcentaje,
          nombre: b.nombre.trim(),
          dni: b.dni?.trim() || null,
          declaracionJurada: b.declaracionJurada || dto.declaracionJurada || null,
          declaracionJuradaDni: b.declaracionJuradaDni?.trim() || dto.declaracionJuradaDni?.trim() || null,
          ordenPago: b.ordenPago || (dto.beneficiarios.length === 1 ? dto.ordenPago || null : null),
        });
      }

      // Resolver solicitante: por id directo o por indice (origen legado, sin id previo)
      let solBenId: string | null = dto.solicitanteBeneficiarioId?.trim() || null;
      const idxSolicitante = dto.solicitanteIndice;
      if (!solBenId && typeof idxSolicitante === 'number' && dto.beneficiarios[idxSolicitante]) {
        solBenId = idsVinculados[idxSolicitante]?.beneficiarioId || null;
      }
      const payloadSolic = typeof idxSolicitante === 'number' ? dto.beneficiarios[idxSolicitante] : undefined;
      const solNombre =
        dto.solicitanteNombre?.trim() || payloadSolic?.nombre?.trim() || null;
      const solDni = dto.solicitanteDni?.trim() || payloadSolic?.dni?.trim() || null;

      const solicitud = await tx.famSolicitudBeneficio.create({
        data: {
          colegiadoId: dto.colegiadoId,
          tipoBeneficioId: tipoBeneficio.id,
          monto: dto.monto,
          moneda: dto.moneda || 'PEN',
          observaciones: dto.observaciones || null,
          cartaNumero: dto.cartaNumero || null,
          expedienteNumero: dto.expedienteNumero || null,
          cartaFecha: dto.cartaFecha ? new Date(dto.cartaFecha) : null,
          memorandoNumero: dto.memorandoNumero || null,
          memorandoFecha: dto.memorandoFecha ? new Date(dto.memorandoFecha) : null,
          formaPago: dto.formaPago || null,
          banco: dto.banco || null,
          ordenPagoFecha: dto.ordenPagoFecha ? new Date(dto.ordenPagoFecha) : null,
          registradoPor: userId,
          ...this.construirDataExpediente(dto),
          ...(dto.beneficiarios.length > 0 && {
            solicitanteBeneficiarioId: solBenId,
            solicitanteNombre: solNombre,
            solicitanteDni: solDni,
          }),
          ...(covidAsignacionId && {
            covidAsignacionId,
            descuentoCovid,
            montoFinal,
          }),
          ...(dto.modalidadBeneficio && { modalidadBeneficio: dto.modalidadBeneficio }),
        },
      });

      for (const v of idsVinculados) {
        await tx.famSolicitudBeneficiario.create({
          data: {
            solicitudId: solicitud.id,
            beneficiarioId: v.beneficiarioId,
            porcentajeAsignado: v.porcentajeAsignado,
            declaracionJurada: v.declaracionJurada,
            declaracionJuradaDni: v.declaracionJuradaDni,
            ordenPago: v.ordenPago,
          },
        });
      }

      if (solicitud.estado === 'PAGADA' && TIPOS_BOLSA.includes(tipoBeneficio.codigo)) {
        const total = Number(solicitud.montoFinal ?? solicitud.monto);
        const depositos = idsVinculados.length
          ? this.construirMontosDeposito(
              total,
              idsVinculados.map((v) => ({
                beneficiarioId: v.beneficiarioId,
                nombre: v.nombre,
                dni: v.dni || undefined,
                porcentaje: v.porcentajeAsignado,
              })),
            )
          : [
              {
                beneficiarioId: undefined,
                nombre: solicitud.solicitanteNombre || undefined,
                dni: solicitud.solicitanteDni || undefined,
                porcentaje: 100,
                monto: total,
              },
            ];

        for (const d of depositos) {
          await tx.famDepositoBeneficiario.create({
            data: {
              solicitudId: solicitud.id,
              beneficiarioId: d.beneficiarioId || null,
              nombreBeneficiario: d.nombre || null,
              dniBeneficiario: d.dni || null,
              porcentaje: d.porcentaje,
              monto: d.monto,
              fechaPago: solicitud.fechaPago,
              estado: 'PAGADO',
              registradoPor: userId,
            },
          });
        }
      }

      return solicitud;
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'fam_registro',
      entityId: resultado.id,
      changes: {
        registro: {
          old: null,
          new: {
            colegiadoId: dto.colegiadoId,
            tipoBeneficioId: tipoBeneficio.id,
            monto: dto.monto,
            estado: dto.estado || 'PENDIENTE',
            documentacionCompleta: dto.documentacionCompleta !== false,
            documentacionObservacion: dto.documentacionObservacion || null,
            documentosPdf: CAMPOS_DOCUMENTO.filter((c) => (dto as any)[c]),
            beneficiarios: dto.beneficiarios.map((b) => ({ nombre: b.nombre, porcentaje: b.porcentaje })),
          },
        },
      },
      ipAddress: ip,
    });

    return this.obtenerPorId(resultado.id);
  }

  async crear(dto: CrearFamSolicitudDto, userId: string) {
    if (!dto.colegiadoId || !dto.tipoBeneficioId || dto.monto === undefined) {
      throw new BadRequestException('colegiadoId, tipoBeneficioId y monto son requeridos');
    }

    const tipoBeneficio = await this.prisma.tipoBeneficio.findUnique({
      where: { id: dto.tipoBeneficioId },
    });
    if (!tipoBeneficio) {
      throw new BadRequestException('Tipo de beneficio no encontrado');
    }

    await this.validarColegiadoFallecido(dto.colegiadoId, tipoBeneficio.codigo);
    await this.validarExpedienteUnico(dto.colegiadoId, tipoBeneficio.codigo);

    if (TIPOS_BOLSA.includes(tipoBeneficio.codigo)) {
      const base = await this.montoBaseTipo(tipoBeneficio.codigo);
      if (base > 0 && dto.monto > base) {
        throw new BadRequestException(
          `El monto del expediente no puede superar el monto base de ${tipoBeneficio.nombre} (S/ ${base.toFixed(2)})`,
        );
      }
    }

    return this.prisma.famSolicitudBeneficio.create({
      data: {
        colegiadoId: dto.colegiadoId,
        tipoBeneficioId: dto.tipoBeneficioId,
        monto: dto.monto,
        moneda: dto.moneda || 'PEN',
        observaciones: dto.observaciones || null,
        fichaAdmisibilidad: dto.fichaAdmisibilidad || null,
        solicitudAsignacion: dto.solicitudAsignacion || null,
        cartaRemision: dto.cartaRemision || null,
        cartaNumero: dto.cartaNumero || null,
        expedienteNumero: dto.expedienteNumero || null,
        cartaFecha: dto.cartaFecha ? new Date(dto.cartaFecha) : null,
        memorando: dto.memorando || null,
        memorandoNumero: dto.memorandoNumero || null,
        memorandoFecha: dto.memorandoFecha ? new Date(dto.memorandoFecha) : null,
        ordenPago: dto.ordenPago || null,
        formaPago: dto.formaPago || null,
        banco: dto.banco || null,
        ordenPagoFecha: dto.ordenPagoFecha ? new Date(dto.ordenPagoFecha) : null,
        registradoPor: userId,
      },
      include: { tipoBeneficio: true },
    });
  }

  async listar(params: {
    colegiadoId?: string;
    estado?: string;
    tipoBeneficioId?: string;
    search?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    documentacionCompleta?: string; // 'SI' | 'NO'
    ordenarPor?: string; // 'ingreso' | 'solicitud' | 'pago'
    page?: number;
    limit?: number;
  }) {
    const {
      colegiadoId,
      estado,
      tipoBeneficioId,
      search,
      fechaDesde,
      fechaHasta,
      documentacionCompleta,
      ordenarPor,
      page = 1,
      limit = 25,
    } = params;
    const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit ?? 25), 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (colegiadoId) where.colegiadoId = colegiadoId;
    if (estado) where.estado = estado;
    if (tipoBeneficioId) where.tipoBeneficioId = tipoBeneficioId;
    if (documentacionCompleta === 'SI') where.documentacionCompleta = true;
    else if (documentacionCompleta === 'NO') where.documentacionCompleta = false;
    if (fechaDesde || fechaHasta) {
      where.fechaSolicitud = {};
      if (fechaDesde) where.fechaSolicitud.gte = new Date(fechaDesde);
      if (fechaHasta) where.fechaSolicitud.lte = new Date(`${fechaHasta}T23:59:59.999Z`);
    }

    // Busqueda: CIP/DNI/nombre resuelto contra LEGACY_DB (con timeout para no colgar el listado)
    const termino = (search || '').trim();
    if (termino.length >= 2) {
      let idsDesdeLegacy: string[] = [];
      try {
        const autocompletePromise = this.famService.autocomplete(termino).catch(() => [] as any[]);
        const sugerencias = await Promise.race([
          autocompletePromise,
          new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 5000)),
        ]);
        idsDesdeLegacy = (sugerencias || []).map((s: any) => String(s.COLEGIADO_ID));
      } catch {
        idsDesdeLegacy = [];
      }
      const condicionesOr: any[] = [
        { expedienteNumero: { contains: termino } },
        { cartaNumero: { contains: termino } },
      ];
      if (idsDesdeLegacy.length) {
        condicionesOr.unshift({ colegiadoId: { in: idsDesdeLegacy } });
      }
      where.OR = condicionesOr;
    }

    let orderBy: any[] = [{ createdAt: 'desc' }, { fechaSolicitud: 'desc' }];
    if (ordenarPor === 'pago') {
      orderBy = [{ fechaPago: 'desc' }, { createdAt: 'desc' }];
    } else if (ordenarPor === 'solicitud') {
      orderBy = [{ fechaSolicitud: 'desc' }, { createdAt: 'desc' }];
    }

    const [data, total] = await Promise.all([
      this.prisma.famSolicitudBeneficio.findMany({
        where,
        include: {
          tipoBeneficio: { select: { id: true, codigo: true, nombre: true } },
          vinculos: {
            include: {
              beneficiario: {
                select: { id: true, nombre: true, dni: true, parentesco: true },
              },
            },
          },
          depositos: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      this.prisma.famSolicitudBeneficio.count({ where }),
    ]);

    // Enriquecer con datos del colegiado (batch, sin N+1). Si LEGACY falla, no tumbar el listado.
    const idsColegiados = [...new Set(data.map((d) => d.colegiadoId))];
    let mapaColegiados = new Map<string, { NUM_COLEGIATURA: string; DNI: string; NOMBRE_COLEGIADO: string; ESTADO: string; FECHA_ULTIMO_PAGO: string | null }>();
    try {
      mapaColegiados = await this.famService.buscarColegiadosPorIds(idsColegiados);
    } catch {
      mapaColegiados = new Map();
    }

    return {
      data: data.map((s) => {
        const colegiado = mapaColegiados.get(s.colegiadoId);
        const montoExpediente = s.montoFinal != null ? Number(s.montoFinal) : Number(s.monto);

        let listaBeneficiarios: Array<{
          beneficiarioId?: string | null;
          nombre: string;
          dni: string;
          parentesco: string;
          porcentaje: number;
          monto: number;
          banco: string;
          numeroCuenta: string;
          cci: string;
          fechaPago: string | null;
          estado: string;
        }> = [];

        if (s.depositos && s.depositos.length > 0) {
          listaBeneficiarios = s.depositos.map((d) => {
            const vinc = s.vinculos?.find(
              (v) =>
                (d.beneficiarioId && v.beneficiarioId === d.beneficiarioId) ||
                (v.beneficiario?.dni && d.dniBeneficiario && v.beneficiario.dni === d.dniBeneficiario),
            );
            const dniBen = d.dniBeneficiario || vinc?.beneficiario?.dni || '';
            const esTitular = colegiado?.DNI && dniBen === colegiado.DNI;
            return {
              beneficiarioId: d.beneficiarioId || null,
              nombre:
                d.nombreBeneficiario ||
                vinc?.beneficiario?.nombre ||
                s.solicitanteNombre ||
                colegiado?.NOMBRE_COLEGIADO ||
                'Sin registro',
              dni: dniBen || s.solicitanteDni || colegiado?.DNI || '',
              parentesco:
                vinc?.beneficiario?.parentesco ||
                (esTitular ? 'Colegiado / Titular' : 'Beneficiario'),
              porcentaje: Number(d.porcentaje) || (s.depositos.length === 1 ? 100 : 0),
              monto: Number(d.monto) || 0,
              banco: d.banco || s.banco || '',
              numeroCuenta: d.numeroCuenta || '',
              cci: d.cci || '',
              fechaPago: d.fechaPago ? d.fechaPago.toISOString() : s.fechaPago ? s.fechaPago.toISOString() : null,
              estado: d.estado || s.estado,
            };
          });
        } else if (s.vinculos && s.vinculos.length > 0) {
          listaBeneficiarios = s.vinculos.map((v) => {
            const pct = Number(v.porcentajeAsignado) || 0;
            const montoCalculado = Number(((montoExpediente * pct) / 100).toFixed(2));
            const dniBen = v.beneficiario?.dni || '';
            const esTitular = colegiado?.DNI && dniBen === colegiado.DNI;
            return {
              beneficiarioId: v.beneficiario?.id || null,
              nombre: v.beneficiario?.nombre || 'Sin registro',
              dni: dniBen,
              parentesco:
                v.beneficiario?.parentesco ||
                (esTitular ? 'Colegiado / Titular' : 'Beneficiario'),
              porcentaje: pct,
              monto: montoCalculado,
              banco: s.banco || '',
              numeroCuenta: '',
              cci: '',
              fechaPago: s.fechaPago ? s.fechaPago.toISOString() : null,
              estado: s.estado,
            };
          });
        } else {
          const dniSol = s.solicitanteDni || colegiado?.DNI || '';
          const esTitular = colegiado?.DNI && dniSol === colegiado.DNI;
          listaBeneficiarios = [
            {
              beneficiarioId: s.solicitanteBeneficiarioId || null,
              nombre:
                s.solicitanteNombre ||
                colegiado?.NOMBRE_COLEGIADO ||
                'Sin registro',
              dni: dniSol,
              parentesco: esTitular ? 'Colegiado / Titular' : 'Solicitante',
              porcentaje: 100,
              monto: montoExpediente,
              banco: s.banco || '',
              numeroCuenta: '',
              cci: '',
              fechaPago: s.fechaPago ? s.fechaPago.toISOString() : null,
              estado: s.estado,
            },
          ];
        }

        return {
          id: s.id,
          colegiadoId: s.colegiadoId,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          NUM_COLEGIATURA: colegiado?.NUM_COLEGIATURA || '',
          DNI: colegiado?.DNI || '',
          NOMBRE_COLEGIADO: colegiado?.NOMBRE_COLEGIADO || '',
          ESTADO_COLEGIADO: colegiado?.ESTADO || '',
          tipoBeneficio: s.tipoBeneficio,
          monto: Number(s.monto),
          moneda: s.moneda,
          estado: s.estado,
          fechaSolicitud: s.fechaSolicitud,
          fechaPago: s.fechaPago,
          documentacionCompleta: s.documentacionCompleta,
          documentacionObservacion: s.documentacionObservacion,
          solicitanteBeneficiarioId: s.solicitanteBeneficiarioId,
          solicitanteNombre: s.solicitanteNombre,
          solicitanteDni: s.solicitanteDni,
          declaracionJuradaDni: s.declaracionJuradaDni || null,
          expedienteNumero: s.expedienteNumero,
          cartaNumero: s.cartaNumero,
          formaPago: s.formaPago,
          banco: s.banco,
          observaciones: s.observaciones,
          modalidadBeneficio: s.modalidadBeneficio,
          covidAsignacionId: s.covidAsignacionId,
          descuentoCovid: Number(s.descuentoCovid),
          montoFinal: s.montoFinal ? Number(s.montoFinal) : null,
          beneficiarios: listaBeneficiarios,
          documentos: CAMPOS_DOCUMENTO.reduce((acc, campo: CampoDocumento) => {
            acc[campo] = Boolean((s as any)[campo]);
            return acc;
          }, {} as Record<string, boolean>),
        };
      }),
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    };
  }

  async obtenerPorId(id: string) {
    const solicitud = await this.prisma.famSolicitudBeneficio.findUnique({
      where: { id },
      include: {
        tipoBeneficio: true,
        vinculos: {
          include: {
            beneficiario: true,
          },
        },
        depositos: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud de beneficio no encontrada');
    }

    const [mapaColegiados] = await Promise.all([
      this.famService.buscarColegiadosPorIds([solicitud.colegiadoId]),
    ]);
    const colegiado = mapaColegiados.get(solicitud.colegiadoId);

    // Excluir blobs base64 de la respuesta: se sirven on-demand via /documento/:campo
    const {
      fichaAdmisibilidad, solicitudAsignacion, cartaRemision,
      memorando, ordenPago, sucesionIntestada, declaracionJurada,
      actaDefuncion, otrosDocumentos,
      ...resto
    } = solicitud as any;

    const beneficiarioSolicitante = resto.solicitanteBeneficiarioId
      ? solicitud.vinculos.find((v) => v.beneficiario.id === resto.solicitanteBeneficiarioId)?.beneficiario
      : null;

    // COVID: monto total recibido por el colegiado (ambas fuentes: tabla COVID + expedientes FAM tipo COVID_19)
    let covidMontoTotal = 0;
    try {
      const covidAsignaciones = await this.prisma.famCovidAsignacion.findMany({
        where: { colegiadoId: solicitud.colegiadoId, activo: true },
        select: { monto: true },
      });
      covidMontoTotal += covidAsignaciones.reduce((sum, a) => sum + Number(a.monto), 0);
    } catch {}
    try {
      const covidExpedientes = await this.prisma.famSolicitudBeneficio.findMany({
        where: {
          colegiadoId: solicitud.colegiadoId,
          estado: { in: ['PAGADA', 'APROBADA'] },
          tipoBeneficio: { codigo: 'COVID_19' },
        },
        select: { monto: true },
      });
      covidMontoTotal += covidExpedientes.reduce((sum, e) => sum + Number(e.monto), 0);
    } catch {}

    // Historial de beneficios pagados del colegiado (incluye el actual)
    let historialBruto: any[] = [];
    try {
      historialBruto = await this.prisma.famSolicitudBeneficio.findMany({
        where: {
          colegiadoId: solicitud.colegiadoId,
          estado: { in: ['PAGADA', 'APROBADA'] },
        },
        include: { tipoBeneficio: { select: { codigo: true, nombre: true } } },
        orderBy: { fechaSolicitud: 'asc' },
      });
    } catch {
      historialBruto = [];
    }

    const historialBeneficios = historialBruto.map((h) => ({
      id: h.id,
      tipo: h.tipoBeneficio?.codigo || '',
      tipoNombre: h.tipoBeneficio?.nombre || '',
      monto: Number(h.monto),
      descuentoCovid: Number(h.descuentoCovid || 0),
      montoFinal: h.montoFinal ? Number(h.montoFinal) : Number(h.monto),
      fecha: h.fechaSolicitud?.toISOString() || h.createdAt.toISOString(),
      fechaPago: h.fechaPago?.toISOString() || null,
      expediente: h.expedienteNumero || '',
      solicitanteNombre: h.solicitanteNombre || null,
      solicitanteDni: h.solicitanteDni || null,
      estado: h.estado,
      esActual: h.id === id,
    }));

    const estadoReparto = this.construirEstadoReparto(solicitud);
    const tipoCodigo = solicitud.tipoBeneficio?.codigo || '';
    let tieneFallecimiento = false;
    if (tipoCodigo === 'FALLECIMIENTO') {
      tieneFallecimiento = estadoReparto.pagada || estadoReparto.completo;
    } else {
      const fallecimiento = await this.obtenerExpedienteActivo(solicitud.colegiadoId, 'FALLECIMIENTO');
      if (fallecimiento) {
        const repartoFallecimiento = this.construirEstadoReparto(fallecimiento);
        tieneFallecimiento = repartoFallecimiento.pagada || repartoFallecimiento.completo;
      }
    }

    return {
      ...resto,
      monto: Number(resto.monto),
      descuentoCovid: Number(resto.descuentoCovid || 0),
      montoFinal: resto.montoFinal ? Number(resto.montoFinal) : null,
      covidAsignacionId: resto.covidAsignacionId || null,
      modalidadBeneficio: resto.modalidadBeneficio || null,
      covidMontoTotal,
      tieneFallecimiento,
      estadoReparto,
      montoBase: TIPOS_BOLSA.includes(tipoCodigo) ? await this.montoBaseTipo(tipoCodigo) : null,
      historialBeneficios,
      NUM_COLEGIATURA: colegiado?.NUM_COLEGIATURA || '',
      DNI: colegiado?.DNI || '',
      NOMBRE_COLEGIADO: colegiado?.NOMBRE_COLEGIADO || '',
      ESTADO_COLEGIADO: colegiado?.ESTADO || '',
      FECHA_ULTIMO_PAGO: colegiado?.FECHA_ULTIMO_PAGO || null,
      solicitanteNombre: resto.solicitanteNombre || beneficiarioSolicitante?.nombre || null,
      solicitanteDni: resto.solicitanteDni || beneficiarioSolicitante?.dni || null,
      declaracionJuradaDni: resto.declaracionJuradaDni || null,
      documentosDisponibles: CAMPOS_DOCUMENTO.reduce((acc, campo: CampoDocumento) => {
        acc[campo] = Boolean((solicitud as any)[campo]);
        return acc;
      }, {} as Record<string, boolean>),
      beneficiariosVinculados: solicitud.vinculos.map((v) => ({
        id: v.beneficiario.id,
        nombre: v.beneficiario.nombre,
        dni: v.beneficiario.dni,
        parentesco: v.beneficiario.parentesco,
        porcentajeAsignado: Number(v.porcentajeAsignado),
        tieneDeclaracionJurada: Boolean(v.declaracionJurada),
        declaracionJuradaDni: v.declaracionJuradaDni || null,
        tieneOrdenPago:
          Boolean(v.ordenPago) || Boolean((solicitud as any).ordenPago),
      })),
      depositos: (solicitud.depositos || []).map((d) => ({
        id: d.id,
        beneficiarioId: d.beneficiarioId,
        nombreBeneficiario: d.nombreBeneficiario,
        dniBeneficiario: d.dniBeneficiario,
        porcentaje: Number(d.porcentaje),
        monto: Number(d.monto),
        banco: d.banco,
        numeroCuenta: d.numeroCuenta,
        cci: d.cci,
        fechaPago: d.fechaPago?.toISOString() || null,
        estado: d.estado,
        tieneComprobante: Boolean(d.comprobantePdf),
      })),
    };
  }

  async obtenerDocumento(id: string, campo: CampoDocumento) {
    if (!CAMPOS_DOCUMENTO.includes(campo)) {
      throw new BadRequestException('Tipo de documento invalido');
    }
    const solicitud = await this.prisma.famSolicitudBeneficio.findUnique({
      where: { id },
      select: { id: true, expedienteNumero: true, [campo]: true },
    });
    if (!solicitud) throw new NotFoundException('Solicitud de beneficio no encontrada');

    const contenido = (solicitud as any)[campo] as string | null;
    if (!contenido) throw new NotFoundException('Documento no cargado');

    return { id: solicitud.id, campo, contenido };
  }

  async obtenerDeclaracionBeneficiario(id: string, beneficiarioId: string) {
    const vinculo = await this.prisma.famSolicitudBeneficiario.findUnique({
      where: { solicitudId_beneficiarioId: { solicitudId: id, beneficiarioId } },
      select: { declaracionJurada: true, declaracionJuradaDni: true },
    });
    if (!vinculo) throw new NotFoundException('Beneficiario no vinculado al expediente');
    if (!vinculo.declaracionJurada) throw new NotFoundException('Declaración jurada no cargada');
    return {
      solicitudId: id,
      beneficiarioId,
      declaracionJuradaDni: vinculo.declaracionJuradaDni,
      contenido: vinculo.declaracionJurada,
    };
  }

  async obtenerOrdenPagoBeneficiario(id: string, beneficiarioId: string) {
    const vinculo = await this.prisma.famSolicitudBeneficiario.findUnique({
      where: { solicitudId_beneficiarioId: { solicitudId: id, beneficiarioId } },
      select: { ordenPago: true },
    });
    if (!vinculo) throw new NotFoundException('Beneficiario no vinculado al expediente');

    let contenido = vinculo.ordenPago;
    if (!contenido) {
      // Compatibilidad: expedientes antiguos guardaban la orden de pago
      // a nivel de expediente. Se usa como respaldo hasta que se cargue
      // una orden individual por beneficiario.
      const solicitud = await this.prisma.famSolicitudBeneficio.findUnique({
        where: { id },
        select: { ordenPago: true },
      });
      contenido = solicitud?.ordenPago || null;
    }
    if (!contenido) throw new NotFoundException('Orden de pago no cargada');
    return {
      solicitudId: id,
      beneficiarioId,
      contenido,
    };
  }

  async obtenerComprobanteDeposito(id: string, depositoId: string) {
    const deposito = await this.prisma.famDepositoBeneficiario.findFirst({
      where: { id: depositoId, solicitudId: id },
      select: { comprobantePdf: true, nombreBeneficiario: true },
    });
    if (!deposito) throw new NotFoundException('Depósito no encontrado');
    if (!deposito.comprobantePdf) throw new NotFoundException('Comprobante no cargado');
    return {
      solicitudId: id,
      depositoId,
      nombreBeneficiario: deposito.nombreBeneficiario,
      contenido: deposito.comprobantePdf,
    };
  }

  private puedeSubirDocumentos(estado: string, userRole?: string) {
    if (!['ADMINISTRADOR', 'OPERADOR_PAGOS'].includes(userRole || '')) return false;
    if (estado === 'PAGADA') return userRole === 'ADMINISTRADOR';
    return true;
  }

  private parseCambios(log: { changesJson?: string | null }) {
    if (!log.changesJson) return null;
    try {
      return JSON.parse(log.changesJson);
    } catch {
      return null;
    }
  }

  private normalizarActividad(log: any, nombresUsuarios: Map<string, string>) {
    const cambios = this.parseCambios(log);
    const usuario = nombresUsuarios.get(log.userId) || 'Sistema';
    const base = {
      id: log.id,
      fecha: log.createdAt?.toISOString?.() || null,
      usuario,
      entidad: log.entity,
      accion: log.action,
    };

    if (log.entity === 'fam_documento' && cambios?.documento) {
      return {
        ...base,
        tipo: 'documento',
        titulo: 'Documento cargado',
        detalle: cambios.documento.new?.nombre || cambios.documento.nombre || 'Documento del expediente',
      };
    }

    if (log.entity === 'fam_documento_beneficiario' && cambios?.documento) {
      const doc = cambios.documento.new || cambios.documento;
      return {
        ...base,
        tipo: 'documento',
        titulo: 'Documento de beneficiario cargado',
        detalle: [doc?.beneficiarioNombre, doc?.nombre].filter(Boolean).join(' · '),
      };
    }

    if (log.entity === 'fam_deposito') {
      if (cambios?.comprobante) {
        return {
          ...base,
          tipo: 'pago',
          titulo: 'Comprobante de depósito cargado',
          detalle: [
            cambios.comprobante.beneficiarioNombre,
            cambios.comprobante.monto !== undefined
              ? `S/ ${Number(cambios.comprobante.monto).toFixed(2)}`
              : null,
          ].filter(Boolean).join(' · '),
        };
      }
      return {
        ...base,
        tipo: 'pago',
        titulo: 'Depósito actualizado',
        detalle: cambios?.deposito?.new?.banco || '',
      };
    }

    if (log.entity === 'fam_registro') {
      if (log.action === 'CREATE') {
        return {
          ...base,
          tipo: 'registro',
          titulo: 'Expediente registrado',
          detalle: cambios?.registro?.new?.estado
            ? `Estado inicial: ${cambios.registro.new.estado}`
            : '',
        };
      }
      if (cambios?.pago) {
        const depositos = cambios.pago.new?.depositos || [];
        const montoTotal = depositos.reduce(
          (sum: number, d: any) => sum + Number(d.monto || 0),
          0,
        );
        return {
          ...base,
          tipo: 'pago',
          titulo: 'Pago registrado',
          detalle: depositos.length
            ? `${depositos.length} depósito(s) por ${fmtMontoHistorial(montoTotal)}`
            : '',
        };
      }
      if (cambios?.beneficiarios) {
        return {
          ...base,
          tipo: 'beneficiario',
          titulo: 'Beneficiarios actualizados',
          detalle: (cambios.beneficiarios.new || [])
            .map((b: any) => b.nombre)
            .filter(Boolean)
            .join(', '),
        };
      }
      if (log.action === 'DELETE') {
        return { ...base, tipo: 'estado', titulo: 'Expediente eliminado', detalle: '' };
      }
      return { ...base, tipo: 'estado', titulo: 'Expediente actualizado', detalle: '' };
    }

    return { ...base, tipo: 'estado', titulo: 'Movimiento registrado', detalle: '' };
  }

  async obtenerHistorial(id: string, userRole?: string) {
    const solicitud = await this.prisma.famSolicitudBeneficio.findUnique({
      where: { id },
      include: {
        tipoBeneficio: true,
        vinculos: { include: { beneficiario: true } },
        depositos: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!solicitud) throw new NotFoundException('Solicitud de beneficio no encontrada');

    const depositoIds = (solicitud.depositos || []).map((d) => d.id);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'fam_registro', entityId: id },
          { entity: 'fam_documento', entityId: { startsWith: id } },
          { entity: 'fam_documento_beneficiario', entityId: { startsWith: id } },
          ...(depositoIds.length
            ? [{ entity: 'fam_deposito', entityId: { in: depositoIds } }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const userIds = Array.from(new Set(logs.map((l) => l.userId).filter(Boolean)));
    const usuarios = userIds.length
      ? await this.prisma.usuario.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nombreCompleto: true, username: true },
        })
      : [];
    const nombresUsuarios = new Map(
      usuarios.map((u) => [u.id, u.nombreCompleto || u.username]),
    );

    const fechaCarga = new Map<string, string>();
    for (const log of logs) {
      if (
        log.entity === 'fam_documento' ||
        log.entity === 'fam_documento_beneficiario' ||
        (log.entity === 'fam_deposito' && this.parseCambios(log)?.comprobante)
      ) {
        if (!fechaCarga.has(log.entityId)) {
          fechaCarga.set(log.entityId, log.createdAt.toISOString());
        }
      }
    }

    const tipoCodigo = solicitud.tipoBeneficio?.codigo || '';
    const estado = solicitud.estado;
    const pagada = estado === 'PAGADA';
    const aprobada = estado === 'APROBADA' || pagada;
    const documentacionCompleta = Boolean(solicitud.documentacionCompleta) || pagada;
    const puedeSubir = this.puedeSubirDocumentos(estado, userRole);
    const vinculos = solicitud.vinculos || [];
    const tieneBeneficiarios = vinculos.length > 0;

    const documentos: any[] = [];
    const agregarDocumento = (doc: any) => {
      documentos.push({
        ...doc,
        fechaCarga: fechaCarga.get(doc.id) || null,
        puedeSubir,
      });
    };

    const camposExpediente: CampoDocumento[] = [
      'fichaAdmisibilidad',
      'solicitudAsignacion',
      'cartaRemision',
      'memorando',
    ];
    if (!tieneBeneficiarios) camposExpediente.push('ordenPago');
    if (!tieneBeneficiarios || solicitud.sucesionIntestada) {
      camposExpediente.push('sucesionIntestada');
    }
    if (tipoCodigo === 'FALLECIMIENTO' || solicitud.actaDefuncion) {
      camposExpediente.push('actaDefuncion');
    }
    if (!tieneBeneficiarios && solicitud.declaracionJurada) {
      camposExpediente.push('declaracionJurada');
    }

    for (const campo of camposExpediente) {
      agregarDocumento({
        id: `exp:${campo}`,
        grupo: 'Expediente',
        nombre: NOMBRES_DOCUMENTO[campo],
        campo,
        tipo: 'expediente',
        cargado: Boolean((solicitud as any)[campo]),
      });
    }

    for (const vinculo of vinculos) {
      const nombreBeneficiario = vinculo.beneficiario?.nombre || 'Beneficiario';
      agregarDocumento({
        id: `ben:${vinculo.beneficiarioId}:declaracionJurada`,
        grupo: 'Beneficiarios',
        nombre: `Declaración jurada · ${nombreBeneficiario}`,
        campo: 'declaracionJurada',
        tipo: 'declaracionJurada',
        beneficiarioId: vinculo.beneficiarioId,
        beneficiarioNombre: nombreBeneficiario,
        cargado: Boolean(vinculo.declaracionJurada),
        dniDeclarante: vinculo.declaracionJuradaDni || null,
      });
      const ordenIndividual = Boolean(vinculo.ordenPago);
      const ordenExpediente = Boolean(solicitud.ordenPago);
      agregarDocumento({
        id: `ben:${vinculo.beneficiarioId}:ordenPago`,
        grupo: 'Beneficiarios',
        nombre: `Orden de pago · ${nombreBeneficiario}`,
        campo: 'ordenPago',
        tipo: 'ordenPago',
        beneficiarioId: vinculo.beneficiarioId,
        beneficiarioNombre: nombreBeneficiario,
        cargado: ordenIndividual || ordenExpediente,
        origen: ordenIndividual ? 'beneficiario' : ordenExpediente ? 'expediente' : null,
      });
    }

    for (const deposito of solicitud.depositos || []) {
      const nombre = deposito.nombreBeneficiario || 'Beneficiario';
      agregarDocumento({
        id: `dep:${deposito.id}:comprobante`,
        grupo: 'Pagos',
        nombre: `Comprobante de depósito · ${nombre}`,
        campo: 'comprobante',
        tipo: 'comprobante',
        depositoId: deposito.id,
        beneficiarioNombre: nombre,
        monto: Number(deposito.monto),
        cargado: Boolean(deposito.comprobantePdf),
      });
    }

    const actividad = logs.map((log) => this.normalizarActividad(log, nombresUsuarios));

    const fechaRegistro =
      solicitud.fechaSolicitud?.toISOString() || solicitud.createdAt.toISOString();
    if (!actividad.some((a) => a.tipo === 'registro')) {
      actividad.push({
        id: `registro:${id}`,
        fecha: fechaRegistro,
        usuario: (solicitud.registradoPor && nombresUsuarios.get(solicitud.registradoPor)) || 'Sistema',
        entidad: 'fam_registro',
        accion: 'CREATE',
        tipo: 'registro',
        titulo: 'Expediente registrado',
        detalle: solicitud.tipoBeneficio?.nombre || '',
      });
    }
    if (pagada && !actividad.some((a) => a.tipo === 'pago' && a.titulo === 'Pago registrado')) {
      actividad.push({
        id: `pago:${id}`,
        fecha: solicitud.fechaPago?.toISOString() || null,
        usuario: 'Sistema',
        entidad: 'fam_pago',
        accion: 'UPDATE',
        tipo: 'pago',
        titulo: 'Pago registrado',
        detalle: (solicitud.depositos || []).length
          ? `${solicitud.depositos.length} depósito(s)`
          : '',
      });
    }
    actividad.sort((a, b) => {
      const fa = a.fecha ? new Date(a.fecha).getTime() : 0;
      const fb = b.fecha ? new Date(b.fecha).getTime() : 0;
      return fb - fa;
    });

    const documentosCargados = documentos.filter((d) => d.cargado).length;
    const documentosPendientes = documentos.filter((d) => !d.cargado).length;
    const depositosCargados = (solicitud.depositos || []).length;

    const etapas: any[] = [
      {
        key: 'registro',
        nombre: 'Registro',
        estado: 'completado',
        fecha: fechaRegistro,
        detalle: solicitud.tipoBeneficio?.nombre || '',
      },
      {
        key: 'documentos',
        nombre: 'Documentos',
        estado: documentacionCompleta ? 'completado' : 'pendiente',
        fecha: null,
        detalle: documentacionCompleta
          ? `${documentosCargados} documento(s) cargado(s)`
          : solicitud.documentacionObservacion || 'Documentación pendiente',
      },
      {
        key: 'revision',
        nombre: 'Revisión',
        estado: documentacionCompleta
          ? aprobada
            ? 'completado'
            : 'pendiente'
          : 'pendiente',
        fecha: null,
        detalle:
          estado === 'RECHAZADA'
            ? 'Expediente rechazado'
            : documentacionCompleta
              ? aprobada
                ? 'Documentación revisada'
                : 'Documentación lista para revisión'
              : 'Pendiente de completar documentos',
      },
      {
        key: 'aprobado',
        nombre: 'Aprobado',
        estado: aprobada ? 'completado' : 'pendiente',
        fecha: null,
        detalle: aprobada ? `Estado: ${estado}` : 'Pendiente de revisión',
      },
      {
        key: 'pagado',
        nombre: 'Pagado',
        estado: pagada ? 'completado' : 'pendiente',
        fecha: solicitud.fechaPago?.toISOString() || null,
        detalle: pagada
          ? `${depositosCargados} depósito(s) registrado(s)`
          : 'Pendiente de pago',
      },
    ];

    if (!pagada) {
      const siguiente = etapas.find((e) => e.estado === 'pendiente');
      if (siguiente) siguiente.estado = 'actual';
    }

    let siguientePaso: any;
    if (estado === 'RECHAZADA') {
      siguientePaso = {
        etapa: 'revision',
        titulo: 'Expediente rechazado',
        descripcion: 'El expediente fue rechazado. Revisa las observaciones registradas.',
        accion: null,
      };
    } else if (pagada) {
      siguientePaso = {
        etapa: 'pagado',
        titulo: 'Pago registrado',
        descripcion: depositosCargados
          ? `Se registraron ${depositosCargados} depósito(s). Puedes consultar los comprobantes en la lista de documentos.`
          : 'El expediente figura como pagado. No hay depósitos registrados.',
        accion: null,
      };
    } else if (!documentacionCompleta) {
      const primerPendiente = documentos.find((d) => !d.cargado);
      siguientePaso = {
        etapa: 'documentos',
        titulo: primerPendiente ? 'Completar documentación' : 'Documentación cargada',
        descripcion: primerPendiente
          ? solicitud.documentacionObservacion ||
            'Carga los documentos pendientes para que el expediente pueda pasar a revisión.'
          : 'Todos los documentos disponibles están cargados. La documentación figura como incompleta; revisa la pestaña Documentos o solicita su validación.',
        accion:
          puedeSubir && primerPendiente
            ? {
                tipo: 'SUBIR',
                etiqueta: `Subir ${primerPendiente.nombre}`,
                documentoId: primerPendiente.id,
              }
            : null,
      };
    } else if (!aprobada) {
      siguientePaso = {
        etapa: 'revision',
        titulo: 'Revisar documentación',
        descripcion:
          'La documentación está marcada como completa. Verifica la información antes de aprobar el expediente.',
        accion: null,
      };
    } else {
      siguientePaso = {
        etapa: 'pagado',
        titulo: 'Registrar pago',
        descripcion: 'El expediente está aprobado y pendiente de pago.',
        accion: null,
      };
    }

    return {
      expediente: {
        id: solicitud.id,
        estado,
        tipoBeneficio: solicitud.tipoBeneficio?.nombre || '',
        tipoBeneficioCodigo: tipoCodigo,
        monto: Number(solicitud.monto),
        montoFinal: solicitud.montoFinal ? Number(solicitud.montoFinal) : null,
        fechaSolicitud: solicitud.fechaSolicitud?.toISOString() || null,
        fechaPago: solicitud.fechaPago?.toISOString() || null,
        expedienteNumero: solicitud.expedienteNumero || null,
        documentacionCompleta: Boolean(solicitud.documentacionCompleta),
        documentacionObservacion: solicitud.documentacionObservacion || null,
      },
      etapas,
      siguientePaso,
      documentos,
      beneficiarios: vinculos.map((vinculo) => ({
        id: vinculo.beneficiarioId,
        nombre: vinculo.beneficiario?.nombre || 'Beneficiario',
        dni: vinculo.beneficiario?.dni || null,
        parentesco: vinculo.beneficiario?.parentesco || null,
        porcentaje: Number(vinculo.porcentajeAsignado),
        tieneDeclaracionJurada: Boolean(vinculo.declaracionJurada),
        declaracionJuradaDni: vinculo.declaracionJuradaDni || null,
        tieneOrdenPago: Boolean(vinculo.ordenPago || solicitud.ordenPago),
      })),
      resumen: {
        documentosCargados,
        documentosPendientes,
        beneficiarios: vinculos.length,
        depositos: depositosCargados,
      },
      actividad,
      permisos: { puedeSubirDocumentos: puedeSubir },
    };
  }

  async subirDocumentoHistorial(
    id: string,
    campo: string,
    contenido: string,
    userId: string,
    userRole?: string,
    ip?: string,
  ) {
    if (!CAMPOS_DOCUMENTO.includes(campo as CampoDocumento)) {
      throw new BadRequestException('Tipo de documento invalido');
    }
    const solicitud: any = await this.prisma.famSolicitudBeneficio.findUnique({
      where: { id },
      select: { id: true, estado: true, [campo]: true } as any,
    });
    if (!solicitud) throw new NotFoundException('Solicitud de beneficio no encontrada');
    if (!this.puedeSubirDocumentos(solicitud.estado, userRole)) {
      throw new ForbiddenException(
        solicitud.estado === 'PAGADA'
          ? 'Solo el ADMINISTRADOR puede subir documentos de un expediente pagado'
          : 'No tiene permiso para subir documentos de este expediente',
      );
    }

    await this.prisma.famSolicitudBeneficio.update({
      where: { id },
      data: { [campo]: contenido } as any,
    });

    const nombre = NOMBRES_DOCUMENTO[campo as CampoDocumento];
    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'fam_documento',
      entityId: `${id}:${campo}`,
      changes: {
        documento: {
          old: { cargado: Boolean((solicitud as any)[campo]) },
          new: { cargado: true, campo, nombre },
        },
      },
      ipAddress: ip,
    });

    return { solicitudId: id, campo, nombre, cargado: true };
  }

  async subirDocumentoBeneficiarioHistorial(
    id: string,
    beneficiarioId: string,
    tipo: string,
    dto: { contenido: string; declaracionJuradaDni?: string },
    userId: string,
    userRole?: string,
    ip?: string,
  ) {
    if (!TIPOS_DOCUMENTO_BENEFICIARIO.includes(tipo as TipoDocumentoBeneficiario)) {
      throw new BadRequestException('Tipo de documento de beneficiario invalido');
    }
    const vinculo = await this.prisma.famSolicitudBeneficiario.findUnique({
      where: { solicitudId_beneficiarioId: { solicitudId: id, beneficiarioId } },
      include: {
        beneficiario: { select: { nombre: true } },
        solicitud: { select: { estado: true } },
      },
    });
    if (!vinculo) throw new NotFoundException('Beneficiario no vinculado al expediente');
    if (!this.puedeSubirDocumentos(vinculo.solicitud.estado, userRole)) {
      throw new ForbiddenException(
        vinculo.solicitud.estado === 'PAGADA'
          ? 'Solo el ADMINISTRADOR puede subir documentos de un expediente pagado'
          : 'No tiene permiso para subir documentos de este expediente',
      );
    }

    const data: any = {};
    let dni: string | null = null;
    if (tipo === 'declaracionJurada') {
      dni = dto.declaracionJuradaDni?.trim() || vinculo.declaracionJuradaDni || null;
      if (!dni || !/^\d{8}$/.test(dni)) {
        throw new BadRequestException(
          'La Declaración Jurada requiere el DNI del declarante (8 dígitos)',
        );
      }
      data.declaracionJurada = dto.contenido;
      data.declaracionJuradaDni = dni;
    } else {
      data.ordenPago = dto.contenido;
    }

    await this.prisma.famSolicitudBeneficiario.update({
      where: { solicitudId_beneficiarioId: { solicitudId: id, beneficiarioId } },
      data,
    });

    const nombre = tipo === 'declaracionJurada' ? 'Declaración jurada' : 'Orden de pago';
    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'fam_documento_beneficiario',
      entityId: `${id}:${beneficiarioId}:${tipo}`,
      changes: {
        documento: {
          old: {
            cargado:
              tipo === 'declaracionJurada'
                ? Boolean(vinculo.declaracionJurada)
                : Boolean(vinculo.ordenPago),
          },
          new: {
            cargado: true,
            campo: tipo,
            nombre,
            beneficiarioId,
            beneficiarioNombre: vinculo.beneficiario.nombre,
            ...(dni ? { declaracionJuradaDni: dni } : {}),
          },
        },
      },
      ipAddress: ip,
    });

    return { solicitudId: id, beneficiarioId, campo: tipo, nombre, cargado: true };
  }

  async subirComprobanteDepositoHistorial(
    id: string,
    depositoId: string,
    contenido: string,
    userId: string,
    userRole?: string,
    ip?: string,
  ) {
    if (userRole !== 'ADMINISTRADOR') {
      throw new ForbiddenException('Solo el ADMINISTRADOR puede subir comprobantes de depósito');
    }
    const deposito = await this.prisma.famDepositoBeneficiario.findFirst({
      where: { id: depositoId, solicitudId: id },
    });
    if (!deposito) throw new NotFoundException('Depósito no encontrado');

    await this.prisma.famDepositoBeneficiario.update({
      where: { id: depositoId },
      data: { comprobantePdf: contenido },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'fam_deposito',
      entityId: depositoId,
      changes: {
        comprobante: {
          old: { cargado: Boolean(deposito.comprobantePdf) },
          new: {
            cargado: true,
            beneficiarioNombre: deposito.nombreBeneficiario,
            monto: Number(deposito.monto),
          },
        },
      },
      ipAddress: ip,
    });

    return {
      solicitudId: id,
      depositoId,
      nombre: 'Comprobante de depósito',
      cargado: true,
    };
  }

  async actualizarBeneficiarios(
    id: string,
    dto: { beneficiarios: any[] },
    userId: string,
    userRole?: string,
    ip?: string,
  ) {
    const existing = await this.prisma.famSolicitudBeneficio.findUnique({
      where: { id },
      include: {
        tipoBeneficio: true,
        vinculos: { include: { beneficiario: true } },
        depositos: true,
      },
    });
    if (!existing) throw new NotFoundException('Solicitud de beneficio no encontrada');

    const pagada = existing.estado === 'PAGADA';
    if (pagada && userRole !== 'ADMINISTRADOR') {
      throw new ForbiddenException(
        'Solo el ADMINISTRADOR puede corregir documentos de un expediente pagado',
      );
    }

    const lista = dto.beneficiarios || [];
    const suma = this.redondearMonto(
      lista.reduce((acc, b) => acc + Number(b.porcentaje || 0), 0),
    );
    if (lista.length > 0 && suma > 100) {
      throw new BadRequestException('La suma de porcentajes no puede exceder el 100%');
    }
    this.validarDeclaracionesBeneficiarios(lista, false);

    const duplicados = new Set<string>();
    for (const b of lista) {
      if (b.id) {
        if (duplicados.has(b.id)) {
          throw new BadRequestException(`El beneficiario ${b.nombre || b.id} está repetido`);
        }
        duplicados.add(b.id);
      }
    }

    if (pagada) {
      const idsActuales = existing.vinculos.map((v) => v.beneficiarioId).sort();
      const idsNuevos = lista.filter((b) => b.id).map((b) => b.id).sort();
      if (idsActuales.length !== idsNuevos.length || idsActuales.some((v, i) => v !== idsNuevos[i])) {
        throw new BadRequestException(
          'Un expediente pagado no permite agregar ni quitar beneficiarios; solo corregir sus documentos',
        );
      }
      for (const b of lista) {
        const vinculo = existing.vinculos.find((v) => v.beneficiarioId === b.id);
        if (vinculo && Number(vinculo.porcentajeAsignado) !== Number(b.porcentaje)) {
          throw new BadRequestException(
            'Un expediente pagado no permite modificar los porcentajes de los beneficiarios',
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const b of lista) {
        let beneficiarioId = b.id as string | undefined;
        if (beneficiarioId) {
          const beneficiario = await tx.famBeneficiario.findUnique({ where: { id: beneficiarioId } });
          if (!beneficiario || beneficiario.colegiadoId !== existing.colegiadoId) {
            throw new BadRequestException(`Beneficiario ${b.nombre} no pertenece al colegiado`);
          }
          await tx.famBeneficiario.update({
            where: { id: beneficiarioId },
            data: {
              ...(b.nombre !== undefined && { nombre: String(b.nombre).trim() }),
              ...(b.dni !== undefined && { dni: b.dni || null }),
              ...(b.parentesco !== undefined && { parentesco: b.parentesco }),
              ...(b.porcentaje !== undefined && { porcentaje: b.porcentaje }),
              ...(b.observaciones !== undefined && { observaciones: b.observaciones || null }),
            },
          });
          await tx.famSolicitudBeneficiario.update({
            where: { solicitudId_beneficiarioId: { solicitudId: id, beneficiarioId } },
            data: {
              ...(b.porcentaje !== undefined && { porcentajeAsignado: b.porcentaje }),
              ...(b.declaracionJurada !== undefined && {
                declaracionJurada: b.declaracionJurada || null,
              }),
              ...(b.declaracionJuradaDni !== undefined && {
                declaracionJuradaDni: b.declaracionJuradaDni?.trim() || null,
              }),
              ...(b.ordenPago !== undefined && {
                ordenPago: b.ordenPago || null,
              }),
            },
          });
        } else {
          if (pagada) {
            throw new BadRequestException(
              'Un expediente pagado no permite agregar beneficiarios',
            );
          }
          const nuevo = await tx.famBeneficiario.create({
            data: {
              colegiadoId: existing.colegiadoId,
              nombre: String(b.nombre || '').trim(),
              dni: b.dni || null,
              parentesco: b.parentesco || 'Otros',
              porcentaje: Number(b.porcentaje || 0),
              observaciones: b.observaciones || null,
              registradoPor: userId,
            },
          });
          beneficiarioId = nuevo.id;
          await tx.famSolicitudBeneficiario.create({
            data: {
              solicitudId: id,
              beneficiarioId,
              porcentajeAsignado: Number(b.porcentaje || 0),
              declaracionJurada: b.declaracionJurada || null,
              declaracionJuradaDni: b.declaracionJuradaDni?.trim() || null,
              ordenPago: b.ordenPago || null,
            },
          });
        }
      }

      if (!pagada) {
        const idsConservados = new Set(
          lista.filter((b) => b.id).map((b) => b.id as string),
        );
        const idsAEliminar = existing.vinculos
          .map((v) => v.beneficiarioId)
          .filter((beneficiarioId) => !idsConservados.has(beneficiarioId));
        if (idsAEliminar.length) {
          await tx.famSolicitudBeneficiario.deleteMany({
            where: { solicitudId: id, beneficiarioId: { in: idsAEliminar } },
          });
        }
      }
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'fam_registro',
      entityId: id,
      changes: {
        beneficiarios: {
          old: existing.vinculos.map((v) => ({
            id: v.beneficiarioId,
            nombre: v.beneficiario.nombre,
            porcentaje: Number(v.porcentajeAsignado),
          })),
          new: lista.map((b) => ({
            id: b.id || null,
            nombre: b.nombre,
            porcentaje: b.porcentaje,
          })),
        },
      },
      ipAddress: ip,
    });

    return this.obtenerPorId(id);
  }

  async pagar(
    id: string,
    dto: { fechaPago?: string; depositos?: any[] },
    userId: string,
    ip?: string,
  ) {
    const existing = await this.prisma.famSolicitudBeneficio.findUnique({
      where: { id },
      include: {
        tipoBeneficio: true,
        vinculos: { include: { beneficiario: true } },
        depositos: true,
      },
    });
    if (!existing) throw new NotFoundException('Solicitud de beneficio no encontrada');
    if (existing.estado === 'PAGADA') {
      throw new ConflictException('El expediente ya fue pagado');
    }
    if (existing.depositos.length > 0) {
      throw new ConflictException('El expediente ya tiene depósitos registrados');
    }

    const vinculos = existing.vinculos;
    const suma = this.sumaPorcentajes(vinculos);
    if (vinculos.length > 0 && suma !== 100) {
      throw new BadRequestException(
        `No se puede pagar: los porcentajes asignados suman ${suma}% (deben sumar 100%)`,
      );
    }
    if (vinculos.length === 0) {
      if (!existing.sucesionIntestada) {
        throw new BadRequestException(
          'Sin beneficiarios registrados es obligatorio adjuntar la Sucesión Intestada para pagar',
        );
      }
      if (!existing.solicitanteNombre?.trim()) {
        throw new BadRequestException('Indique el solicitante de la Sucesión Intestada');
      }
    } else {
      this.validarDeclaracionesBeneficiarios(
        vinculos.map((v) => ({
          nombre: v.beneficiario.nombre,
          dni: v.beneficiario.dni || undefined,
          declaracionJurada: v.declaracionJurada || undefined,
          declaracionJuradaDni: v.declaracionJuradaDni || undefined,
        })),
        TIPOS_BOLSA.includes(existing.tipoBeneficio.codigo),
      );
    }

    const total = Number(existing.montoFinal ?? existing.monto);
    if (total <= 0) {
      throw new BadRequestException('El monto del expediente debe ser mayor a cero');
    }

    const cuentas = new Map<string, any>();
    for (const d of dto.depositos || []) {
      if (d.beneficiarioId) cuentas.set(String(d.beneficiarioId), d);
    }

    const items = vinculos.length
      ? vinculos.map((v) => ({
          beneficiarioId: v.beneficiarioId,
          nombre: v.beneficiario.nombre,
          dni: v.beneficiario.dni || undefined,
          porcentaje: Number(v.porcentajeAsignado),
        }))
      : [
          {
            beneficiarioId: undefined,
            nombre: existing.solicitanteNombre || undefined,
            dni: existing.solicitanteDni || undefined,
            porcentaje: 100,
          },
        ];

    const montos = this.construirMontosDeposito(total, items);
    const fechaPago = dto.fechaPago ? new Date(dto.fechaPago) : new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const item of montos) {
        const cuenta = item.beneficiarioId ? cuentas.get(item.beneficiarioId) || {} : {};
        await tx.famDepositoBeneficiario.create({
          data: {
            solicitudId: id,
            beneficiarioId: item.beneficiarioId || null,
            nombreBeneficiario: item.nombre || null,
            dniBeneficiario: item.dni || null,
            porcentaje: item.porcentaje,
            monto: item.monto,
            banco: cuenta.banco || existing.banco || null,
            numeroCuenta: cuenta.numeroCuenta || null,
            cci: cuenta.cci || null,
            comprobantePdf: cuenta.comprobantePdf || null,
            fechaPago,
            estado: 'PAGADO',
            registradoPor: userId,
          },
        });
      }
      await tx.famSolicitudBeneficio.update({
        where: { id },
        data: { estado: 'PAGADA', fechaPago },
      });
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'fam_registro',
      entityId: id,
      changes: {
        pago: {
          old: { estado: existing.estado, fechaPago: existing.fechaPago?.toISOString() || null },
          new: {
            estado: 'PAGADA',
            fechaPago: fechaPago.toISOString(),
            depositos: montos.map((m) => ({
              beneficiarioId: m.beneficiarioId || null,
              nombre: m.nombre || null,
              monto: m.monto,
            })),
          },
        },
      },
      ipAddress: ip,
    });

    return this.obtenerPorId(id);
  }

  async actualizarDeposito(
    id: string,
    depositoId: string,
    dto: { banco?: string; numeroCuenta?: string; cci?: string; comprobantePdf?: string; fechaPago?: string },
    userId: string,
    userRole?: string,
    ip?: string,
  ) {
    if (userRole !== 'ADMINISTRADOR') {
      throw new ForbiddenException('Solo el ADMINISTRADOR puede corregir depósitos');
    }
    const deposito = await this.prisma.famDepositoBeneficiario.findFirst({
      where: { id: depositoId, solicitudId: id },
    });
    if (!deposito) throw new NotFoundException('Depósito no encontrado');

    const data = {
      ...(dto.banco !== undefined && { banco: dto.banco || null }),
      ...(dto.numeroCuenta !== undefined && { numeroCuenta: dto.numeroCuenta || null }),
      ...(dto.cci !== undefined && { cci: dto.cci || null }),
      ...(dto.comprobantePdf !== undefined && { comprobantePdf: dto.comprobantePdf || null }),
      ...(dto.fechaPago !== undefined && {
        fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : null,
      }),
    };

    const actualizado = await this.prisma.famDepositoBeneficiario.update({
      where: { id: depositoId },
      data,
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'fam_deposito',
      entityId: depositoId,
      changes: {
        deposito: {
          old: {
            banco: deposito.banco,
            numeroCuenta: deposito.numeroCuenta,
            cci: deposito.cci,
            tieneComprobante: Boolean(deposito.comprobantePdf),
            fechaPago: deposito.fechaPago?.toISOString() || null,
          },
          new: {
            banco: actualizado.banco,
            numeroCuenta: actualizado.numeroCuenta,
            cci: actualizado.cci,
            tieneComprobante: Boolean(actualizado.comprobantePdf),
            fechaPago: actualizado.fechaPago?.toISOString() || null,
          },
        },
      },
      ipAddress: ip,
    });

    return {
      ...actualizado,
      monto: Number(actualizado.monto),
      porcentaje: Number(actualizado.porcentaje),
      comprobantePdf: undefined,
      tieneComprobante: Boolean(actualizado.comprobantePdf),
    };
  }

  async obtenerExpedienteActivoResumen(colegiadoId: string, tipoBeneficioId?: string, tipoBeneficioConfigId?: string) {
    if (!colegiadoId) {
      throw new BadRequestException('colegiadoId es requerido');
    }

    let tipo: { id: string; codigo: string; nombre: string } | null = null;
    if (tipoBeneficioId) {
      tipo = await this.prisma.tipoBeneficio.findUnique({
        where: { id: tipoBeneficioId },
        select: { id: true, codigo: true, nombre: true },
      });
    } else if (tipoBeneficioConfigId) {
      const config = await this.prisma.tipoBeneficioConfig.findUnique({
        where: { id: Number(tipoBeneficioConfigId) },
        select: { nombre: true },
      });
      if (config) {
        const todos = await this.prisma.tipoBeneficio.findMany({
          where: { programa: 'FAM', activo: true },
          select: { id: true, codigo: true, nombre: true },
        });
        tipo = this.buscarTipoPorConfig(todos, config.nombre) || null;
      }
    }

    // 1. Verificar si el colegiado ya se encuentra registrado por fallecimiento
    const fallecimiento = await this.verificarColegiadoFallecido(colegiadoId);
    if (fallecimiento) {
      const reparto = this.construirEstadoReparto(fallecimiento);
      const esMismoFallecimientoIncompleto =
        tipo?.codigo === 'FALLECIMIENTO' && !reparto.completo && !reparto.pagada && fallecimiento.estado !== 'PAGADA';

      if (!esMismoFallecimientoIncompleto) {
        return {
          id: fallecimiento.id,
          estado: fallecimiento.estado,
          tipoBeneficio: fallecimiento.tipoBeneficio,
          colegiadoFallecido: true,
          bloqueadoPorFallecimiento: true,
          mensajeFallecido: 'No se pueden registrar más beneficios porque el colegiado está fallecido.',
          porcentajeAsignado: reparto.porcentajeAsignado,
          completo: reparto.completo,
          beneficiarios: [],
        };
      }
    }

    if (!tipoBeneficioId && !tipoBeneficioConfigId) {
      return null;
    }

    if (!tipo) throw new NotFoundException('Tipo de beneficio no encontrado');

    const expediente = await this.obtenerExpedienteActivo(colegiadoId, tipo.codigo);
    if (!expediente) return null;

    return {
      id: expediente.id,
      estado: expediente.estado,
      tipoBeneficio: tipo,
      monto: Number(expediente.monto),
      montoFinal: expediente.montoFinal ? Number(expediente.montoFinal) : null,
      montoBase: await this.montoBaseTipo(tipo.codigo),
      ...this.construirEstadoReparto(expediente),
      beneficiarios: expediente.vinculos.map((v: any) => ({
        id: v.beneficiario.id,
        nombre: v.beneficiario.nombre,
        dni: v.beneficiario.dni,
        parentesco: v.beneficiario.parentesco,
        porcentajeAsignado: Number(v.porcentajeAsignado),
        tieneDeclaracionJurada: Boolean(v.declaracionJurada),
        declaracionJuradaDni: v.declaracionJuradaDni || null,
        tieneOrdenPago:
          Boolean(v.ordenPago) || Boolean(expediente.ordenPago),
      })),
    };
  }

  async actualizar(id: string, dto: ActualizarFamSolicitudDto, userRole?: string) {
    const existing = await this.prisma.famSolicitudBeneficio.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Solicitud de beneficio no encontrada');
    }

    this.validarDocumentacion({
      ...(dto as any),
      declaracionJuradaDni: dto.declaracionJuradaDni ?? existing.declaracionJuradaDni ?? undefined,
    });

    // Si cambia tipoBeneficio, resolver nuevo tipo
    let nuevoTipoBeneficioId = existing.tipoBeneficioId;
    if (dto.tipoBeneficioConfigId) {
      const configTipo = await this.prisma.tipoBeneficioConfig.findUnique({
        where: { id: dto.tipoBeneficioConfigId },
      });
      if (configTipo) {
        const todosTipos = await this.prisma.tipoBeneficio.findMany({
          where: { programa: 'FAM', activo: true },
        });
        let tipoEncontrado = this.buscarTipoPorConfig(todosTipos, configTipo.nombre);
        if (!tipoEncontrado) {
          tipoEncontrado = await this.prisma.tipoBeneficio.create({
            data: {
              id: `TB-FAM-${Date.now()}`,
              codigo: this.normalizarCodigoTipo(configTipo.nombre)
                || configTipo.nombre.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_'),
              nombre: configTipo.nombre,
              descripcion: configTipo.descripcion || `Tipo operacional FAM para ${configTipo.nombre}`,
              programa: 'FAM',
              activo: true,
            },
          });
        }
        nuevoTipoBeneficioId = tipoEncontrado.id;
      }
    } else if (dto.tipoBeneficioId) {
      nuevoTipoBeneficioId = dto.tipoBeneficioId;
    }

    // Recalcular descuentoCovid y montoFinal si se cambia tipo o monto
    let descuentoCovid = Number(existing.descuentoCovid || 0);
    let montoFinal = dto.monto !== undefined ? dto.monto : Number(existing.monto);
    if (dto.descuentoCovid !== undefined && userRole === 'ADMINISTRADOR') {
      descuentoCovid = dto.descuentoCovid;
      montoFinal = Math.max(0, montoFinal - descuentoCovid);
    }

    // Verificar si el nuevo tipo requiere descuento COVID
    const nuevoTipo = await this.prisma.tipoBeneficio.findUnique({ where: { id: nuevoTipoBeneficioId } });
    if (nuevoTipo?.codigo === 'ENF_TERMINAL' && dto.descuentoCovid === undefined) {
      const covidTotal = await this.calcularCovidTotal(existing.colegiadoId);
      if (covidTotal > 0) {
        descuentoCovid = covidTotal;
        montoFinal = Math.max(0, montoFinal - descuentoCovid);
      }
    }

    const dataUpdate: any = {
      ...(dto.monto !== undefined && { monto: dto.monto }),
      ...(dto.estado !== undefined && { estado: dto.estado }),
      ...(dto.fechaSolicitud !== undefined && { fechaSolicitud: dto.fechaSolicitud ? new Date(dto.fechaSolicitud) : null }),
      ...(dto.fechaPago !== undefined && { fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : null }),
      ...(dto.documentacionCompleta !== undefined && { documentacionCompleta: dto.documentacionCompleta }),
      ...(dto.documentacionObservacion !== undefined && { documentacionObservacion: dto.documentacionObservacion }),
      ...(dto.modalidadBeneficio !== undefined && { modalidadBeneficio: dto.modalidadBeneficio }),
      ...(dto.descuentoCovid !== undefined && { descuentoCovid, montoFinal }),
      ...this.construirSolicitanteData(dto as any),
      ...(dto.observaciones !== undefined && { observaciones: dto.observaciones }),
      ...CAMPOS_DOCUMENTO.reduce((acc, campo: CampoDocumento) => {
        if ((dto as any)[campo] !== undefined) acc[campo] = (dto as any)[campo];
        return acc;
      }, {} as Record<string, string>),
      ...(dto.declaracionJuradaDni !== undefined && {
        declaracionJuradaDni: dto.declaracionJuradaDni?.trim() || null,
      }),
      ...this.construirDatosEspeciales(dto as any, true),
      ...(dto.cartaNumero !== undefined && { cartaNumero: dto.cartaNumero }),
      ...(dto.expedienteNumero !== undefined && { expedienteNumero: dto.expedienteNumero }),
      ...(dto.cartaFecha !== undefined && { cartaFecha: dto.cartaFecha ? new Date(dto.cartaFecha) : null }),
      ...(dto.memorandoNumero !== undefined && { memorandoNumero: dto.memorandoNumero }),
      ...(dto.memorandoFecha !== undefined && { memorandoFecha: dto.memorandoFecha ? new Date(dto.memorandoFecha) : null }),
      ...(dto.formaPago !== undefined && { formaPago: dto.formaPago }),
      ...(dto.banco !== undefined && { banco: dto.banco }),
      ...(dto.ordenPagoFecha !== undefined && { ordenPagoFecha: dto.ordenPagoFecha ? new Date(dto.ordenPagoFecha) : null }),
    };

    if (
      dto.estado === 'PAGADA' &&
      existing.estado !== 'PAGADA' &&
      nuevoTipo &&
      TIPOS_BOLSA.includes(nuevoTipo.codigo)
    ) {
      const depositos = await this.prisma.famDepositoBeneficiario.count({
        where: { solicitudId: id },
      });
      if (depositos === 0) {
        throw new BadRequestException(
          'Para marcar el expediente como PAGADA use la acción "Registrar pago", que genera un depósito por beneficiario.',
        );
      }
    }

    if (nuevoTipoBeneficioId && nuevoTipoBeneficioId !== existing.tipoBeneficioId) {
      dataUpdate.tipoBeneficio = { connect: { id: nuevoTipoBeneficioId } };
    }

    return this.prisma.famSolicitudBeneficio.update({
      where: { id },
      data: dataUpdate,
      include: { tipoBeneficio: true },
    });
  }

  async eliminar(id: string, userId: string, ip?: string) {
    const existing = await this.prisma.famSolicitudBeneficio.findUnique({
      where: { id },
      include: {
        tipoBeneficio: true,
        vinculos: { include: { beneficiario: true } },
        depositos: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Solicitud de beneficio no encontrada');
    }

    // Snapshot completo antes de eliminar (para audit log). No se guardan PDFs,
    // solo la existencia de cada documento para evitar duplicar archivos en auditoría.
    const snapshot = {
      id: existing.id,
      colegiadoId: existing.colegiadoId,
      tipoBeneficioId: existing.tipoBeneficioId,
      tipoBeneficioNombre: existing.tipoBeneficio?.nombre || '',
      tipoBeneficioCodigo: existing.tipoBeneficio?.codigo || '',
      monto: Number(existing.monto),
      estado: existing.estado,
      fechaSolicitud: existing.fechaSolicitud?.toISOString(),
      fechaPago: existing.fechaPago?.toISOString(),
      expedienteNumero: existing.expedienteNumero,
      cartaNumero: existing.cartaNumero,
      memorandoNumero: existing.memorandoNumero,
      modalidadBeneficio: existing.modalidadBeneficio,
      descuentoCovid: Number(existing.descuentoCovid || 0),
      montoFinal: existing.montoFinal ? Number(existing.montoFinal) : null,
      registradoPor: existing.registradoPor,
      documentos: Object.fromEntries(
        CAMPOS_DOCUMENTO.map((campo) => [campo, Boolean((existing as any)[campo])]),
      ),
      beneficiarios: existing.vinculos.map((vinculo) => ({
        beneficiarioId: vinculo.beneficiarioId,
        nombre: vinculo.beneficiario?.nombre || '',
        dni: vinculo.beneficiario?.dni || null,
        porcentaje: Number(vinculo.porcentajeAsignado),
        tieneDeclaracionJurada: Boolean(vinculo.declaracionJurada),
        tieneOrdenPago: Boolean(vinculo.ordenPago),
      })),
      depositos: existing.depositos.map((deposito) => ({
        id: deposito.id,
        beneficiarioId: deposito.beneficiarioId,
        nombreBeneficiario: deposito.nombreBeneficiario,
        monto: Number(deposito.monto),
        estado: deposito.estado,
        tieneComprobante: Boolean(deposito.comprobantePdf),
      })),
    };

    // Eliminar en transacción. Se borran explícitamente depósitos y vínculos
    // (documentos individuales) antes del expediente, sin depender del cascade.
    await this.prisma.$transaction(async (tx) => {
      await tx.famDepositoBeneficiario.deleteMany({ where: { solicitudId: id } });
      await tx.famSolicitudBeneficiario.deleteMany({ where: { solicitudId: id } });
      await tx.famSolicitudBeneficio.delete({ where: { id } });
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'fam_registro',
      entityId: id,
      changes: {
        registro: {
          old: snapshot,
          new: null,
        },
      },
      ipAddress: ip,
    });

    return { message: 'Solicitud eliminada exitosamente', eliminado: snapshot };
  }

  async listarTiposBeneficio() {
    return this.prisma.tipoBeneficio.findMany({
      where: { programa: 'FAM', activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, codigo: true, nombre: true },
    });
  }

  async obtenerMontos() {
    const configs = await this.prisma.famConfiguracion.findMany({
      where: { activo: true },
    });

    const montos: Record<string, number> = {};
    for (const config of configs) {
      if (config.clave.startsWith('FAM_MONTO_')) {
        montos[config.clave] = parseFloat(config.valor);
      }
    }

    return montos;
  }

  async bulkDeleteAllRegistros(adminUserId: string) {
    // El guard ya validó que es SUPER_ADMINISTRADOR, pero hacemos defensa en profundidad
    if (!adminUserId) {
      throw new BadRequestException('Identificación de administrador requerida');
    }

    // 1. Contar registros antes de eliminar para el audit log
    const totalRegistros = await this.prisma.famSolicitudBeneficio.count();

    // 2. Eliminar TODOS los registros en una transacción
    // Esto causará cascade a: fam_solicitud_beneficiario, y beneficiarios que ya no sean referenciados
    await this.prisma.famSolicitudBeneficio.deleteMany({});

    // 3. Registrar en audit_logs la operación masiva (excepción a la regla de inmutabilidad)
    // SUPER_ADMINISTRADOR puede operar sobre la tabla IMMUTABLE
    await this.auditService.log({
      userId: adminUserId,
      action: 'DELETE',
      entity: 'fam_registro',
      entityId: '0',
      ipAddress: 'SUPER_ADMIN_BULK_DELETE',
    });

    return {
      message: `Se eliminaron ${totalRegistros} registros FAM permanentemente`,
      total_eliminados: totalRegistros,
    };
  }
}
