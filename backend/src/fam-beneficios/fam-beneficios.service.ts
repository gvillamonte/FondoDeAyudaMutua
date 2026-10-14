import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
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
] as const;

type CampoDocumento = (typeof CAMPOS_DOCUMENTO)[number];

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

  private validarDocumentacion(dto: { documentacionCompleta?: boolean; documentacionObservacion?: string }) {
    if (dto.documentacionCompleta === false && !dto.documentacionObservacion?.trim()) {
      throw new BadRequestException(
        'Si la documentacion esta incompleta debe indicar una justificacion (documentacionObservacion)',
      );
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
      const porId = dto.solicitanteBeneficiarioId?.trim();
      const indiceValido =
        dto.solicitanteIndice !== undefined &&
        dto.solicitanteIndice >= 0 &&
        dto.solicitanteIndice < dto.beneficiarios.length;
      const idValido = !!porId && dto.beneficiarios.some((b) => b.id && b.id === porId);

      if (porId && !idValido) {
        throw new BadRequestException('El solicitante seleccionado no pertenece a los beneficiarios del expediente');
      }
      if (!porId && !indiceValido) {
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
    };
  }

  // Bloqueo de nuevos beneficios: si el colegiado ya tiene un expediente por
  // Fallecimiento activo (estado distinto de RECHAZADA), no se registran más.
  private async tieneFallecimientoActivo(colegiadoId: string): Promise<boolean> {
    try {
      const count = await this.prisma.famSolicitudBeneficio.count({
        where: {
          colegiadoId,
          estado: { not: 'RECHAZADA' },
          tipoBeneficio: { codigo: 'FALLECIMIENTO' },
        },
      });
      return count > 0;
    } catch {
      return false;
    }
  }

  async crearRegistro(dto: CrearRegistroFamDto, userId: string, ip?: string) {
    this.validarDocumentacion(dto);
    this.validarSolicitante(dto);

    if (dto.colegiadoId && (await this.tieneFallecimientoActivo(dto.colegiadoId))) {
      throw new ConflictException(
        'El colegiado ya tiene un beneficio por Fallecimiento registrado. No se pueden registrar más beneficios.',
      );
    }

    // Snapshot del solicitante elegido entre los beneficiarios registrados:
    // queda persistido aunque luego se renombre el beneficiario.
    const benSolicitante = dto.beneficiarios.find((b) => b.id && b.id === dto.solicitanteBeneficiarioId);
    if (benSolicitante) {
      dto.solicitanteNombre = benSolicitante.nombre.trim();
      dto.solicitanteDni = dto.solicitanteDni?.trim() || benSolicitante.dni || undefined;
    }

    // Calcular suma de porcentajes (necesaria para validaciones)
    const suma = dto.beneficiarios.reduce((acc, b) => acc + Number(b.porcentaje || 0), 0);

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
          if (suma !== 100) {
            throw new BadRequestException('Monto Compartido requiere que la suma de porcentajes sea exactamente 100%');
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
      tipoBeneficio = todosTipos.find(
        (t) => t.nombre.toUpperCase().trim() === configTipo.nombre.toUpperCase().trim()
      ) || null;
      // Si no existe, crearlo automáticamente
      if (!tipoBeneficio) {
        tipoBeneficio = await this.prisma.tipoBeneficio.create({
          data: {
            id: `TB-FAM-${Date.now()}`,
            codigo: configTipo.nombre.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_'),
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

    // Descuento automático COVID sobre Enfermedad Terminal
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
      const idsVinculados: { beneficiarioId: string; porcentajeAsignado: number }[] = [];

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
        idsVinculados.push({ beneficiarioId, porcentajeAsignado: b.porcentaje });
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
          },
        });
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

    if (await this.tieneFallecimientoActivo(dto.colegiadoId)) {
      throw new ConflictException(
        'El colegiado ya tiene un beneficio por Fallecimiento registrado. No se pueden registrar más beneficios.',
      );
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

    const [data, total] = await Promise.all([
      this.prisma.famSolicitudBeneficio.findMany({
        where,
        include: { tipoBeneficio: { select: { id: true, codigo: true, nombre: true } } },
        orderBy: [{ fechaSolicitud: 'desc' }, { createdAt: 'desc' }],
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
      data: data.map((s) => ({
        id: s.id,
        colegiadoId: s.colegiadoId,
        NUM_COLEGIATURA: mapaColegiados.get(s.colegiadoId)?.NUM_COLEGIATURA || '',
        DNI: mapaColegiados.get(s.colegiadoId)?.DNI || '',
        NOMBRE_COLEGIADO: mapaColegiados.get(s.colegiadoId)?.NOMBRE_COLEGIADO || '',
        ESTADO_COLEGIADO: mapaColegiados.get(s.colegiadoId)?.ESTADO || '',
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
        expedienteNumero: s.expedienteNumero,
        cartaNumero: s.cartaNumero,
        formaPago: s.formaPago,
        banco: s.banco,
        observaciones: s.observaciones,
        modalidadBeneficio: s.modalidadBeneficio,
        covidAsignacionId: s.covidAsignacionId,
        descuentoCovid: Number(s.descuentoCovid),
        montoFinal: s.montoFinal ? Number(s.montoFinal) : null,
        documentos: CAMPOS_DOCUMENTO.reduce((acc, campo: CampoDocumento) => {
          acc[campo] = Boolean((s as any)[campo]);
          return acc;
        }, {} as Record<string, boolean>),
      })),
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
      memorando, ordenPago, sucesionIntestada,
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

    const tieneFallecimiento = await this.tieneFallecimientoActivo(solicitud.colegiadoId);

    return {
      ...resto,
      monto: Number(resto.monto),
      descuentoCovid: Number(resto.descuentoCovid || 0),
      montoFinal: resto.montoFinal ? Number(resto.montoFinal) : null,
      covidAsignacionId: resto.covidAsignacionId || null,
      modalidadBeneficio: resto.modalidadBeneficio || null,
      covidMontoTotal,
      tieneFallecimiento,
      historialBeneficios,
      NUM_COLEGIATURA: colegiado?.NUM_COLEGIATURA || '',
      DNI: colegiado?.DNI || '',
      NOMBRE_COLEGIADO: colegiado?.NOMBRE_COLEGIADO || '',
      ESTADO_COLEGIADO: colegiado?.ESTADO || '',
      FECHA_ULTIMO_PAGO: colegiado?.FECHA_ULTIMO_PAGO || null,
      solicitanteNombre: resto.solicitanteNombre || beneficiarioSolicitante?.nombre || null,
      solicitanteDni: resto.solicitanteDni || beneficiarioSolicitante?.dni || null,
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

  async actualizar(id: string, dto: ActualizarFamSolicitudDto, userRole?: string) {
    const existing = await this.prisma.famSolicitudBeneficio.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Solicitud de beneficio no encontrada');
    }

    this.validarDocumentacion(dto as any);

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
        let tipoEncontrado = todosTipos.find(
          (t) => t.nombre.toUpperCase().trim() === configTipo.nombre.toUpperCase().trim()
        );
        if (!tipoEncontrado) {
          tipoEncontrado = await this.prisma.tipoBeneficio.create({
            data: {
              id: `TB-FAM-${Date.now()}`,
              codigo: configTipo.nombre.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_'),
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
      ...(dto.cartaNumero !== undefined && { cartaNumero: dto.cartaNumero }),
      ...(dto.expedienteNumero !== undefined && { expedienteNumero: dto.expedienteNumero }),
      ...(dto.cartaFecha !== undefined && { cartaFecha: dto.cartaFecha ? new Date(dto.cartaFecha) : null }),
      ...(dto.memorandoNumero !== undefined && { memorandoNumero: dto.memorandoNumero }),
      ...(dto.memorandoFecha !== undefined && { memorandoFecha: dto.memorandoFecha ? new Date(dto.memorandoFecha) : null }),
      ...(dto.formaPago !== undefined && { formaPago: dto.formaPago }),
      ...(dto.banco !== undefined && { banco: dto.banco }),
      ...(dto.ordenPagoFecha !== undefined && { ordenPagoFecha: dto.ordenPagoFecha ? new Date(dto.ordenPagoFecha) : null }),
    };

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
      include: { tipoBeneficio: true },
    });
    if (!existing) {
      throw new NotFoundException('Solicitud de beneficio no encontrada');
    }

    // Snapshot completo antes de eliminar (para audit log)
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
    };

    // Eliminar en transacción (cascade: fam_solicitud_beneficiarios)
    await this.prisma.$transaction(async (tx) => {
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
