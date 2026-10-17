import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CrearAsignacionCovidDto, ActualizarAsignacionCovidDto, BeneficiarioCovidDto } from './dto/fam-covid.dto';
import { AuditService } from '../audit/audit.service';
import { FamService } from '../fam/fam.service';

@Injectable()
export class FamCovidService {
  private prisma: PrismaClient;

  constructor(private auditService: AuditService, private famService: FamService) {
    this.prisma = new PrismaClient();
  }

  // ================= VALIDACIONES DE MODALIDAD (replican lógica de fam-beneficios) =================

  private validarModalidadBeneficiarios(dto: CrearAsignacionCovidDto) {
    const benes = dto.beneficiarios;
    const modalidad = dto.modalidadBeneficio;

    if (modalidad === 'monto_unico') {
      if (benes.length === 0) {
        throw new BadRequestException('Monto Único requiere exactamente 1 beneficiario');
      }
      if (benes.length > 1) {
        throw new BadRequestException('Monto Único admite como máximo 1 beneficiario');
      }
      benes[0].porcentaje = 100;
    }

    if (modalidad === 'monto_compartido') {
      if (benes.length === 0) {
        throw new BadRequestException('Monto Compartido requiere al menos 1 beneficiario');
      }
      const suma = benes.reduce((s, b) => s + (b.porcentaje || 0), 0);
      if (suma !== 100) {
        throw new BadRequestException(`Monto Compartido requiere que la suma de porcentajes sea exactamente 100% (actual: ${suma}%)`);
      }
    }

    if (modalidad === 'opcion_sucesiva') {
      if (benes.length === 0) {
        throw new BadRequestException('Opción Sucesiva requiere al menos 1 beneficiario');
      }
      benes.forEach((b, i) => {
        b.porcentaje = 100;
        if (!b.orden) b.orden = i + 1;
      });
      benes.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    }
  }

  private validarSolicitante(dto: CrearAsignacionCovidDto) {
    if (dto.beneficiarios.length === 0) return;

    const porId = dto.solicitanteBeneficiarioId?.trim();
    const indiceValido =
      dto.solicitanteIndice !== undefined &&
      dto.solicitanteIndice >= 0 &&
      dto.solicitanteIndice < dto.beneficiarios.length;
    const idValido = !!porId && dto.beneficiarios.some((b) => b.id && b.id === porId);

    if (porId && !idValido) {
      throw new BadRequestException('El solicitante seleccionado no pertenece a los beneficiarios del expediente');
    }
    if (!porId && !indiceValido && dto.beneficiarios.length > 0) {
      throw new BadRequestException('Debe seleccionar quién es el solicitante entre los beneficiarios registrados');
    }
  }

  // ================= CREAR ASIGNACIÓN =================

  async crearAsignacion(dto: CrearAsignacionCovidDto, userId: string, ip?: string) {
    this.validarModalidadBeneficiarios(dto);
    this.validarSolicitante(dto);

    const resultado = await this.prisma.$transaction(async (tx) => {
      // Crear beneficiarios en APP_DB y vincular
      const idsVinculados: { beneficiarioId: string; porcentajeAsignado: number; orden?: number }[] = [];

      for (const b of dto.beneficiarios) {
        let beneficiarioId = b.id;
        if (!beneficiarioId) {
          const nuevo = await tx.famBeneficiario.create({
            data: {
              colegiadoId: dto.colegiadoId,
              nombre: b.nombre.trim(),
              dni: b.dni || null,
              parentesco: b.parentesco,
              porcentaje: b.porcentaje,
              registradoPor: userId,
            },
          });
          beneficiarioId = nuevo.id;
        }
        idsVinculados.push({ beneficiarioId, porcentajeAsignado: b.porcentaje, orden: b.orden });
      }

      // Resolver solicitante
      let solBenId: string | null = dto.solicitanteBeneficiarioId?.trim() || null;
      const idxSolicitante = dto.solicitanteIndice;
      if (!solBenId && typeof idxSolicitante === 'number' && dto.beneficiarios[idxSolicitante]) {
        solBenId = idsVinculados[idxSolicitante]?.beneficiarioId || null;
      }
      const payloadSolic = typeof idxSolicitante === 'number' ? dto.beneficiarios[idxSolicitante] : undefined;
      const solNombre = dto.solicitanteNombre?.trim() || payloadSolic?.nombre?.trim() || null;
      const solDni = dto.solicitanteDni?.trim() || payloadSolic?.dni?.trim() || null;

      // Resolver cip/dni/nombre del colegiado (snapshot)
      let cip: string | null = null;
      let dni: string | null = null;
      let nombre: string | null = null;
      try {
        const sql = await import('mssql');
        const { createLegacyPool } = await import('../legacy/legacy-sql.helper');
        const { ConfigService } = await import('@nestjs/config');
        const config = new ConfigService();
        const { pool } = await createLegacyPool(config);
        await pool.connect();
        const req = pool.request();
        req.input('id', sql.VarChar, dto.colegiadoId.trim());
        const r = await req.query(`SELECT TOP 1 c.cCodigoCIP AS CIP, COALESCE(doc.cDocumentoIdentidad,'') AS DNI,
          (pc.cApPaterno+' '+COALESCE(pc.cApMaterno,'')+' '+pc.cNombres) AS NOMBRE
          FROM TColegiado c INNER JOIN TPersona pc ON c.nIdPersona=pc.nIdPersona
          LEFT JOIN TDocumentoPersona doc ON pc.nIdPersona=doc.nIdPersona
          WHERE CAST(c.nIdColegiado AS VARCHAR)=@id`);
        if (r.recordset.length > 0) {
          cip = r.recordset[0].CIP;
          dni = r.recordset[0].DNI || null;
          nombre = r.recordset[0].NOMBRE;
        }
        await pool.close();
      } catch { /* usar null si falla */ }

      const asignacion = await tx.famCovidAsignacion.create({
        data: {
          colegiadoId: dto.colegiadoId.trim(),
          cip,
          dni,
          nombreColegiado: nombre,
          modalidadBeneficio: dto.modalidadBeneficio,
          monto: dto.monto ?? 200,
          fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : null,
          memorandoId: dto.memorandoId?.trim() || null,
          cartaId: dto.cartaId?.trim() || null,
          observaciones: dto.observaciones || null,
          solicitanteBeneficiarioId: solBenId,
          solicitanteNombre: solNombre,
          solicitanteDni: solDni,
          registradoPor: userId,
        },
      });

      for (const v of idsVinculados) {
        await tx.famCovidAsignacionBeneficiario.create({
          data: {
            covidAsignacionId: asignacion.id,
            beneficiarioId: v.beneficiarioId,
            porcentajeAsignado: v.porcentajeAsignado,
            orden: v.orden || null,
          },
        });
      }

      // Crear comprobantes si existen
      if (dto.comprobantes && dto.comprobantes.length > 0) {
        for (const c of dto.comprobantes) {
          await tx.famReembolsoComprobante.create({
            data: {
              covidAsignacionId: asignacion.id,
              tipoComprobante: c.tipoComprobante,
              serie: c.serie || null,
              numero: c.numero || null,
              concepto: c.concepto || null,
              importeTotal: c.importeTotal,
              pdfBase64: c.pdfBase64 || null,
            },
          });
        }
      }

      return asignacion;
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'fam_covid_asignacion',
      entityId: resultado.id,
      changes: { registro: { old: null, new: resultado } },
      ipAddress: ip,
    });

    return resultado;
  }

  // ================= LISTAR =================

  async listar(params: { search?: string; activo?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 25));
    const term = (params.search || '').trim();

    const whereAsig: any = {};
    if (params.activo === 'true') whereAsig.activo = true;
    else if (params.activo === 'false') whereAsig.activo = false;
    if (term) {
      whereAsig.OR = [
        { cip: { contains: term } },
        { dni: { contains: term } },
        { nombreColegiado: { contains: term } },
        { colegiadoId: { contains: term } },
      ];
    }

    // Fuentes combinadas: asignaciones del módulo COVID + expedientes FAM del
    // concepto COVID_19 que ya fueron recibidos (PAGADA/APROBADA).
    const [asignaciones, expedientes] = await Promise.all([
      this.prisma.famCovidAsignacion.findMany({
        where: whereAsig,
        orderBy: { createdAt: 'desc' },
        include: {
          memorando: { select: { numero: true, asunto: true } },
          carta: { select: { numero: true, referencia: true } },
          vinculos: { select: { id: true } },
          comprobantes: { select: { id: true, importeTotal: true } },
        },
      }),
      params.activo === 'false'
        ? Promise.resolve([])
        : this.prisma.famSolicitudBeneficio.findMany({
            where: {
              tipoBeneficio: { codigo: 'COVID_19' },
              estado: { in: ['PAGADA', 'APROBADA'] },
            },
            orderBy: { fechaSolicitud: 'desc' },
          }),
    ]);

    // CIP/DNI/nombre de los colegiado de los expedientes (solo lectura en LEGACY_DB)
    const idsColegiados = [...new Set(expedientes.map((e) => e.colegiadoId))];
    let mapaColegiados = new Map<string, { NUM_COLEGIATURA: string; DNI: string; NOMBRE_COLEGIADO: string; ESTADO: string; FECHA_ULTIMO_PAGO: string | null }>();
    try {
      mapaColegiados = await this.famService.buscarColegiadosPorIds(idsColegiados);
    } catch {
      mapaColegiados = new Map();
    }

    const filasAsignaciones = asignaciones.map((a) => ({ ...a, origen: 'ASIGNACION' }));

    const filasExpedientes = expedientes
      .map((e) => {
        const col = mapaColegiados.get(e.colegiadoId);
        return {
          id: e.id,
          origen: 'EXPEDIENTE',
          colegiadoId: e.colegiadoId,
          cip: col?.NUM_COLEGIATURA || '',
          dni: col?.DNI || '',
          nombreColegiado: col?.NOMBRE_COLEGIADO || '',
          modalidadBeneficio: e.modalidadBeneficio || 'Expediente',
          monto: Number(e.monto),
          moneda: e.moneda,
          fechaPago: e.fechaPago,
          activo: true,
          createdAt: e.createdAt,
          memorando: e.memorandoNumero ? { numero: e.memorandoNumero, asunto: null as string | null } : null,
          carta: e.cartaNumero ? { numero: e.cartaNumero, referencia: null as string | null } : null,
          vinculos: [] as { id: string }[],
          comprobantes: [] as { id: string; importeTotal: number }[],
          expedienteNumero: e.expedienteNumero,
        };
      })
      .filter((f) => {
        if (!term) return true;
        const t = term.toLowerCase();
        return [f.cip, f.dni, f.nombreColegiado, f.colegiadoId].some((v) => (v || '').toLowerCase().includes(t));
      });

    const combinadas = [...filasAsignaciones, ...filasExpedientes].sort(
      (a, b) =>
        new Date(b.fechaPago || b.createdAt || 0).getTime() -
        new Date(a.fechaPago || a.createdAt || 0).getTime(),
    );

    const total = combinadas.length;
    const data = combinadas.slice((page - 1) * limit, page * limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ================= OBTENER POR ID =================

  async obtenerPorId(id: string) {
    const asignacion = await this.prisma.famCovidAsignacion.findUnique({
      where: { id },
      include: {
        memorando: true,
        carta: true,
        vinculos: {
          include: {
            beneficiario: { select: { id: true, nombre: true, dni: true, parentesco: true, porcentaje: true } },
          },
        },
        comprobantes: {
          select: {
            id: true,
            tipoComprobante: true,
            serie: true,
            numero: true,
            concepto: true,
            importeTotal: true,
            createdAt: true,
          },
        },
      },
    });

    if (!asignacion) throw new NotFoundException(`Asignación COVID ${id} no encontrada`);

    return {
      ...asignacion,
      documentosDisponibles: {
        comprobantes: asignacion.comprobantes.map(c => ({
          id: c.id,
          tipo: c.tipoComprobante,
          serie: c.serie,
          numero: c.numero,
          concepto: c.concepto,
          importe: c.importeTotal,
          tienePdf: !!asignacion.comprobantes.find(comp => comp.id === c.id),
        })),
      },
    };
  }

  // ================= SERVIR PDF COMPROBANTE =================

  async obtenerPdfComprobante(comprobanteId: string) {
    const comprobante = await this.prisma.famReembolsoComprobante.findUnique({
      where: { id: comprobanteId },
      select: { id: true, tipoComprobante: true, serie: true, numero: true, pdfBase64: true },
    });

    if (!comprobante) throw new NotFoundException('Comprobante no encontrado');
    if (!comprobante.pdfBase64) throw new NotFoundException('Este comprobante no tiene PDF adjunto');

    return {
      id: comprobante.id,
      campo: `${comprobante.tipoComprobante} ${comprobante.serie || ''}-${comprobante.numero || ''}`.trim(),
      contenido: comprobante.pdfBase64,
    };
  }

  // ================= VERIFICAR SI UN COLEGIADO TIENE ASIGNACIÓN ACTIVA =================

  async verificarColegiado(colegiadoId: string) {
    const asignacion = await this.prisma.famCovidAsignacion.findFirst({
      where: { colegiadoId: colegiadoId.trim(), activo: true },
      select: {
        id: true,
        monto: true,
        memorando: { select: { numero: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!asignacion) return { tieneAsignacion: false };

    return {
      tieneAsignacion: true,
      asignacionId: asignacion.id,
      monto: Number(asignacion.monto),
      memorandoNumero: asignacion.memorando?.numero || null,
    };
  }

  // ================= ACTUALIZAR =================

  async actualizar(id: string, dto: ActualizarAsignacionCovidDto, userId: string, ip?: string) {
    const existing = await this.prisma.famCovidAsignacion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Asignación COVID ${id} no encontrada`);

    const actualizado = await this.prisma.famCovidAsignacion.update({
      where: { id },
      data: {
        ...(dto.monto !== undefined && { monto: dto.monto }),
        ...(dto.fechaPago !== undefined && { fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : null }),
        ...(dto.memorandoId !== undefined && { memorandoId: dto.memorandoId?.trim() || null }),
        ...(dto.cartaId !== undefined && { cartaId: dto.cartaId?.trim() || null }),
        ...(dto.observaciones !== undefined && { observaciones: dto.observaciones || null }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        ...(dto.solicitanteNombre !== undefined && { solicitanteNombre: dto.solicitanteNombre || null }),
        ...(dto.solicitanteDni !== undefined && { solicitanteDni: dto.solicitanteDni || null }),
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'fam_covid_asignacion',
      entityId: id,
      changes: { registro: { old: existing, new: actualizado } },
      ipAddress: ip,
    });

    return actualizado;
  }

  // ================= ELIMINAR (SOFT DELETE) =================

  async eliminar(id: string, userId: string, ip?: string) {
    const existing = await this.prisma.famCovidAsignacion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Asignación COVID ${id} no encontrada`);

    const actualizado = await this.prisma.famCovidAsignacion.update({
      where: { id },
      data: { activo: false },
    });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'fam_covid_asignacion',
      entityId: id,
      changes: { registro: { old: existing, new: actualizado } },
      ipAddress: ip,
    });

    return { message: 'Asignación COVID desactivada exitosamente' };
  }

  // ================= AGREGAR COMPROBANTE =================

  async agregarComprobante(asignacionId: string, dto: { tipoComprobante: string; serie?: string; numero?: string; concepto?: string; importeTotal: number; pdfBase64?: string }, userId: string, ip?: string) {
    const asignacion = await this.prisma.famCovidAsignacion.findUnique({ where: { id: asignacionId } });
    if (!asignacion) throw new NotFoundException(`Asignación COVID ${asignacionId} no encontrada`);

    const comprobante = await this.prisma.famReembolsoComprobante.create({
      data: {
        covidAsignacionId: asignacionId,
        tipoComprobante: dto.tipoComprobante,
        serie: dto.serie || null,
        numero: dto.numero || null,
        concepto: dto.concepto || null,
        importeTotal: dto.importeTotal,
        pdfBase64: dto.pdfBase64 || null,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'fam_reembolso_comprobante',
      entityId: comprobante.id,
      changes: { registro: { old: null, new: comprobante } },
      ipAddress: ip,
    });

    return comprobante;
  }

  // ================= ELIMINAR COMPROBANTE =================

  async eliminarComprobante(comprobanteId: string, userId: string, ip?: string) {
    const existing = await this.prisma.famReembolsoComprobante.findUnique({ where: { id: comprobanteId } });
    if (!existing) throw new NotFoundException('Comprobante no encontrado');

    await this.prisma.famReembolsoComprobante.delete({ where: { id: comprobanteId } });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'fam_reembolso_comprobante',
      entityId: comprobanteId,
      changes: { registro: { old: existing, new: null } },
      ipAddress: ip,
    });

    return { message: 'Comprobante eliminado exitosamente' };
  }
}
