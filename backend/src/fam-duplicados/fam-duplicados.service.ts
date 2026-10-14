import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FamService } from '../fam/fam.service';
import {
  CrearDuplicadoDto,
  ActualizarDuplicadoDto,
  DocumentoDuplicadoDto,
} from './dto/fam-duplicado.dto';

const ESTADOS_EXCLUIDOS = ['RECHAZADA'];
const ORDEN_ESTADO: Record<string, number> = {
  CONFIRMADO: 0,
  DETECTADO: 1,
  DESCARTADO: 2,
};

interface ExpedienteLigero {
  id: string;
  expedienteNumero: string | null;
  estado: string;
  monto: number;
  montoFinal: number | null;
  fechaSolicitud: Date;
  fechaPago: Date | null;
}

@Injectable()
export class FamDuplicadosService {
  constructor(
    private prisma: PrismaService,
    private famService: FamService,
    private auditService: AuditService,
  ) {}

  async listar(params: { search?: string } = {}) {
    const { search } = params;

    // 1) Expedientes livianos (APP_DB) para detectar grupos duplicados
    const solicitudes = await this.prisma.famSolicitudBeneficio.findMany({
      select: {
        id: true,
        colegiadoId: true,
        tipoBeneficioId: true,
        estado: true,
        monto: true,
        montoFinal: true,
        expedienteNumero: true,
        fechaSolicitud: true,
        fechaPago: true,
        tipoBeneficio: { select: { id: true, codigo: true, nombre: true } },
      },
      where: { estado: { notIn: ESTADOS_EXCLUIDOS } },
      orderBy: [{ fechaSolicitud: 'asc' }, { createdAt: 'asc' }],
    });

    const porClave = new Map<string, any[]>();
    for (const s of solicitudes) {
      const clave = `${s.colegiadoId}|${s.tipoBeneficioId}`;
      const arr = porClave.get(clave) || [];
      arr.push(s);
      porClave.set(clave, arr);
    }

    // 2) Registros guardados (marca manual / confirmacion / descarte)
    const guardados = await this.prisma.famDuplicado.findMany({
      include: {
        tipoBeneficio: { select: { id: true, codigo: true, nombre: true } },
        documentos: {
          select: { id: true, etiqueta: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 3) Union: auto (>= 2 expedientes) + todo lo guardado
    const claves = new Set<string>();
    for (const [clave, arr] of porClave) {
      if (arr.length >= 2) claves.add(clave);
    }
    for (const g of guardados) claves.add(`${g.colegiadoId}|${g.tipoBeneficioId}`);

    const guardadoPorClave = new Map(
      guardados.map((g) => [`${g.colegiadoId}|${g.tipoBeneficioId}`, g]),
    );

    const items: any[] = [];
    for (const clave of claves) {
      const [colegiadoId, tipoBeneficioId] = clave.split('|');
      const guardado = guardadoPorClave.get(clave);
      const grupo = porClave.get(clave) || [];
      const expedientes: ExpedienteLigero[] = grupo.map((s) => ({
        id: s.id,
        expedienteNumero: s.expedienteNumero,
        estado: s.estado,
        monto: Number(s.monto),
        montoFinal: s.montoFinal !== null && s.montoFinal !== undefined ? Number(s.montoFinal) : null,
        fechaSolicitud: s.fechaSolicitud,
        fechaPago: s.fechaPago,
      }));

      items.push({
        id: guardado?.id ?? null,
        colegiadoId,
        tipoBeneficio:
          guardado?.tipoBeneficio ??
          grupo[0]?.tipoBeneficio ??
          (await this.tipoDeColeccion(grupo, tipoBeneficioId)),
        estado: guardado?.estado ?? 'DETECTADO',
        motivo: guardado?.motivo ?? null,
        observaciones: guardado?.observaciones ?? null,
        registradoPor: guardado?.registradoPor ?? null,
        updatedAt: guardado?.updatedAt ?? null,
        expedientes,
        totalMonto: expedientes.reduce((sum, e) => sum + (e.montoFinal ?? e.monto), 0),
        documentos: guardado?.documentos ?? [],
      });
    }

    // 4) Enriquecer con datos del colegiado (LEGACY, sin N+1; si falla, no tumba el listado)
    const idsColegiados = [...new Set(items.map((i) => i.colegiadoId))];
    let mapaColegiados = new Map<
      string,
      { NUM_COLEGIATURA: string; DNI: string; NOMBRE_COLEGIADO: string; ESTADO: string }
    >();
    try {
      mapaColegiados = await this.famService.buscarColegiadosPorIds(idsColegiados);
    } catch {
      mapaColegiados = new Map();
    }

    for (const item of items) {
      const c = mapaColegiados.get(item.colegiadoId);
      item.NUM_COLEGIATURA = c?.NUM_COLEGIATURA || '';
      item.DNI = c?.DNI || '';
      item.NOMBRE_COLEGIADO = c?.NOMBRE_COLEGIADO || '';
      item.ESTADO_COLEGIADO = c?.ESTADO || '';
    }

    // 5) Busqueda por CIP/DNI/nombre/n° expediente (legacy con timeout, como en listar)
    const termino = (search || '').trim();
    if (termino.length >= 2) {
      let filtrados = items.filter(
        (i) =>
          (i.NUM_COLEGIATURA || '').toLowerCase().includes(termino.toLowerCase()) ||
          (i.DNI || '').toLowerCase().includes(termino.toLowerCase()) ||
          (i.NOMBRE_COLEGIADO || '').toLowerCase().includes(termino.toLowerCase()) ||
          i.expedientes.some((e: ExpedienteLigero) =>
            (e.expedienteNumero || '').toLowerCase().includes(termino.toLowerCase()),
          ),
      );
      if (filtrados.length === 0) {
        try {
          const autocompletePromise = this.famService.autocomplete(termino).catch(() => [] as any[]);
          const sugerencias = await Promise.race([
            autocompletePromise,
            new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 5000)),
          ]);
          const idsLegacy = new Set((sugerencias || []).map((s: any) => String(s.COLEGIADO_ID)));
          filtrados = items.filter((i) => idsLegacy.has(i.colegiadoId));
        } catch {
          filtrados = [];
        }
      }
      items.splice(0, items.length, ...filtrados);
    }

    items.sort((a, b) => {
      const orden = (ORDEN_ESTADO[a.estado] ?? 9) - (ORDEN_ESTADO[b.estado] ?? 9);
      if (orden !== 0) return orden;
      return (a.NOMBRE_COLEGIADO || '').localeCompare(b.NOMBRE_COLEGIADO || '');
    });

    return { data: items };
  }

  async crear(dto: CrearDuplicadoDto, userId: string, ip?: string) {
    const tipo = await this.prisma.tipoBeneficio.findUnique({
      where: { id: dto.tipoBeneficioId },
    });
    if (!tipo) throw new NotFoundException('Tipo de beneficio no encontrado');

    const existente = await this.prisma.famDuplicado.findFirst({
      where: { colegiadoId: dto.colegiadoId, tipoBeneficioId: dto.tipoBeneficioId },
    });
    if (existente) {
      throw new ConflictException(
        'Ya existe un caso de duplicado registrado para este colegiado y tipo de beneficio',
      );
    }

    let expedienteIds = dto.expedienteIds?.length ? dto.expedienteIds : [];
    if (!expedienteIds.length) {
      const base = await this.prisma.famSolicitudBeneficio.findMany({
        where: {
          colegiadoId: dto.colegiadoId,
          tipoBeneficioId: dto.tipoBeneficioId,
          estado: { notIn: ESTADOS_EXCLUIDOS },
        },
        select: { id: true },
      });
      expedienteIds = base.map((b) => b.id);
    }

    const registro = await this.prisma.famDuplicado.create({
      data: {
        colegiadoId: dto.colegiadoId,
        tipoBeneficioId: dto.tipoBeneficioId,
        estado: dto.estado ?? 'DETECTADO',
        motivo: dto.motivo,
        observaciones: dto.observaciones,
        expedienteIds: JSON.stringify(expedienteIds),
        registradoPor: userId,
        ...(dto.documentos?.length
          ? {
              documentos: {
                create: dto.documentos.map((d) => ({
                  etiqueta: d.etiqueta,
                  pdfBase64: d.pdfBase64,
                  registradoPor: userId,
                })),
              },
            }
          : {}),
      },
      include: {
        tipoBeneficio: { select: { id: true, codigo: true, nombre: true } },
        documentos: {
          select: { id: true, etiqueta: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'duplicado',
      entityId: registro.id,
      changes: {
        duplicado: {
          old: null,
          new: {
            colegiadoId: dto.colegiadoId,
            tipoBeneficioId: dto.tipoBeneficioId,
            tipo: tipo.nombre,
            estado: registro.estado,
            expedienteIds,
            documentos: (dto.documentos || []).map((d) => d.etiqueta),
          },
        },
      },
      ipAddress: ip,
    });

    return { data: this.mapearGuardado(registro) };
  }

  async actualizar(id: string, dto: ActualizarDuplicadoDto, userId: string, ip?: string) {
    const registro = await this.prisma.famDuplicado.findUnique({
      where: { id },
      include: { documentos: { select: { id: true, etiqueta: true, createdAt: true } } },
    });
    if (!registro) throw new NotFoundException('Caso de duplicado no encontrado');

    const cambios: Record<string, { old: any; new: any }> = {};
    if (dto.estado !== undefined && dto.estado !== registro.estado) {
      cambios.estado = { old: registro.estado, new: dto.estado };
    }
    if (dto.motivo !== undefined && dto.motivo !== registro.motivo) {
      cambios.motivo = { old: registro.motivo, new: dto.motivo };
    }
    if (dto.observaciones !== undefined && dto.observaciones !== registro.observaciones) {
      cambios.observaciones = { old: registro.observaciones, new: dto.observaciones };
    }
    if (!Object.keys(cambios).length) return { data: this.mapearGuardado(registro) };

    const actualizado = await this.prisma.famDuplicado.update({
      where: { id },
      data: {
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        ...(dto.motivo !== undefined ? { motivo: dto.motivo } : {}),
        ...(dto.observaciones !== undefined ? { observaciones: dto.observaciones } : {}),
      },
      include: {
        tipoBeneficio: { select: { id: true, codigo: true, nombre: true } },
        documentos: {
          select: { id: true, etiqueta: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'duplicado',
      entityId: id,
      changes: cambios,
      ipAddress: ip,
    });

    return { data: this.mapearGuardado(actualizado) };
  }

  async agregarDocumento(
    duplicadoId: string,
    dto: DocumentoDuplicadoDto,
    userId: string,
    ip?: string,
  ) {
    const registro = await this.prisma.famDuplicado.findUnique({
      where: { id: duplicadoId },
    });
    if (!registro) throw new NotFoundException('Caso de duplicado no encontrado');

    const doc = await this.prisma.famDuplicadoDocumento.create({
      data: {
        duplicadoId,
        etiqueta: dto.etiqueta,
        pdfBase64: dto.pdfBase64,
        registradoPor: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'duplicado_documento',
      entityId: doc.id,
      changes: {
        documento: {
          old: null,
          new: { duplicadoId, etiqueta: dto.etiqueta },
        },
      },
      ipAddress: ip,
    });

    return { data: { id: doc.id, etiqueta: doc.etiqueta, createdAt: doc.createdAt } };
  }

  async eliminarDocumento(duplicadoId: string, documentoId: string, userId: string, ip?: string) {
    const doc = await this.prisma.famDuplicadoDocumento.findFirst({
      where: { id: documentoId, duplicadoId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.prisma.famDuplicadoDocumento.delete({ where: { id: documentoId } });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'duplicado_documento',
      entityId: documentoId,
      changes: {
        documento: {
          old: { duplicadoId, etiqueta: doc.etiqueta },
          new: null,
        },
      },
      ipAddress: ip,
    });

    return { data: { id: documentoId, eliminado: true } };
  }

  async obtenerDocumentoPdf(duplicadoId: string, documentoId: string) {
    const doc = await this.prisma.famDuplicadoDocumento.findFirst({
      where: { id: documentoId, duplicadoId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    return {
      data: { id: doc.id, etiqueta: doc.etiqueta, pdfBase64: doc.pdfBase64 },
    };
  }

  async eliminar(id: string, userId: string, ip?: string) {
    const registro = await this.prisma.famDuplicado.findUnique({
      where: { id },
      include: { documentos: { select: { id: true, etiqueta: true } } },
    });
    if (!registro) throw new NotFoundException('Caso de duplicado no encontrado');

    await this.prisma.famDuplicado.delete({ where: { id } });

    await this.auditService.log({
      userId,
      action: 'DELETE',
      entity: 'duplicado',
      entityId: id,
      changes: {
        duplicado: {
          old: {
            colegiadoId: registro.colegiadoId,
            tipoBeneficioId: registro.tipoBeneficioId,
            estado: registro.estado,
            documentos: registro.documentos.map((d) => d.etiqueta),
          },
          new: null,
        },
      },
      ipAddress: ip,
    });

    return { data: { id, eliminado: true } };
  }

  private async tipoDeColeccion(colegados: any[], tipoBeneficioId: string) {
    const conTipo = colegados.find((c) => c.tipoBeneficio);
    if (conTipo?.tipoBeneficio) return conTipo.tipoBeneficio;
    const tipo = await this.prisma.tipoBeneficio.findUnique({
      where: { id: tipoBeneficioId },
      select: { id: true, codigo: true, nombre: true },
    });
    return tipo ?? { id: tipoBeneficioId, codigo: '', nombre: '' };
  }

  private mapearGuardado(registro: any) {
    let expedienteIds: string[] = [];
    try {
      expedienteIds = JSON.parse(registro.expedienteIds || '[]');
    } catch {
      expedienteIds = [];
    }
    return {
      id: registro.id,
      colegiadoId: registro.colegiadoId,
      tipoBeneficio: registro.tipoBeneficio,
      estado: registro.estado,
      motivo: registro.motivo,
      observaciones: registro.observaciones,
      expedienteIds,
      registradoPor: registro.registradoPor,
      createdAt: registro.createdAt,
      updatedAt: registro.updatedAt,
      documentos: registro.documentos ?? [],
    };
  }
}
