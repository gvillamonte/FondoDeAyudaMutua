import { Injectable, BadRequestException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FamService } from '../fam/fam.service';
import { FamBeneficiosService } from './fam-beneficios.service';
import {
  RegistrarSucesionIntestadaDto,
  ModificarDistribucionSucesionDto,
  HerederoSucesionItemDto,
} from './dto/fam-sucesion.dto';

@Injectable()
export class FamSucesionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly famService: FamService,
    @Inject(forwardRef(() => FamBeneficiosService))
    private readonly famBeneficiosService: FamBeneficiosService,
  ) {}

  private validarHerederos(herederos: HerederoSucesionItemDto[], montoTotal: number) {
    if (!herederos || herederos.length === 0) {
      throw new BadRequestException('Debe registrar al menos 1 beneficiario heredero');
    }
    if (herederos.length > 20) {
      throw new BadRequestException('No se permiten más de 20 beneficiarios herederos');
    }

    // 1. Validar no duplicados de documentos
    const docsVistos = new Set<string>();
    for (const h of herederos) {
      const docKey = `${(h.tipoDocumento || 'DNI').toUpperCase()}-${h.numeroDocumento.trim()}`;
      if (docsVistos.has(docKey)) {
        throw new BadRequestException(
          `Documento duplicado entre los herederos: ${h.tipoDocumento} ${h.numeroDocumento}`,
        );
      }
      docsVistos.add(docKey);

      if (!h.nombres?.trim() || !h.apellidos?.trim()) {
        throw new BadRequestException(
          `Nombres y apellidos son obligatorios para el heredero con documento ${h.numeroDocumento}`,
        );
      }

      if (h.porcentaje <= 0 || h.monto <= 0) {
        throw new BadRequestException(
          `Cada beneficiario debe tener un porcentaje y monto mayor a cero (> 0): ${h.nombres} ${h.apellidos}`,
        );
      }
    }

    // 2. Validar suma de porcentajes (no debe exceder 100%)
    const sumaPorcentajes = Number(
      herederos.reduce((acc, h) => acc + Number(h.porcentaje || 0), 0).toFixed(2),
    );
    if (sumaPorcentajes > 100.05) {
      throw new BadRequestException(
        `La suma de porcentajes no puede exceder el 100% (suma actual: ${sumaPorcentajes}%)`,
      );
    }

    // 3. Validar suma de montos (no debe exceder el monto total)
    const sumaMontos = Number(
      herederos.reduce((acc, h) => acc + Number(h.monto || 0), 0).toFixed(2),
    );
    if (sumaMontos > montoTotal + 0.05) {
      throw new BadRequestException(
        `La suma de montos asignados (S/ ${sumaMontos.toFixed(2)}) no puede exceder el monto total (S/ ${montoTotal.toFixed(2)})`,
      );
    }
  }

  async registrarSucesion(dto: RegistrarSucesionIntestadaDto, userId: string, ip?: string) {
    if (!dto.colegiadoId?.trim()) {
      throw new BadRequestException('colegiadoId es requerido');
    }
    const tieneSustento = Boolean(dto.sustentoPdf && dto.sustentoPdf.trim());
    const tieneObs = Boolean(
      (dto.observacionSinSucesion && dto.observacionSinSucesion.trim()) ||
      (dto.observaciones && dto.observaciones.trim()),
    );
    if (!tieneSustento && !tieneObs) {
      throw new BadRequestException(
        'Cuando no se cuenta con sustento de Sucesión Intestada (PDF), debe ingresar una observación justificando el motivo por el cual no se está cargando para poder guardar.',
      );
    }

    // Validar regla de negocio: el colegiado NO debe tener beneficiarios ya registrados
    const beneficiariosPrevios = await this.famService.getBeneficiariosByColegiado(dto.colegiadoId);
    if (beneficiariosPrevios && beneficiariosPrevios.length > 0) {
      throw new BadRequestException(
        `El colegiado ya cuenta con ${beneficiariosPrevios.length} beneficiario(s) registrado(s). Este trámite no califica como sucesión intestada sin beneficiarios.`,
      );
    }

    // Validar herederos y montos
    this.validarHerederos(dto.herederos, dto.montoTotal);

    // Resolver Tipo de Beneficio
    let tipoBeneficio;
    if (dto.tipoBeneficioConfigId) {
      const configTipo = await this.prisma.tipoBeneficioConfig.findUnique({
        where: { id: dto.tipoBeneficioConfigId },
      });
      if (!configTipo) throw new BadRequestException('Tipo de beneficio (catálogo) no encontrado');
      tipoBeneficio = await this.prisma.tipoBeneficio.findFirst({
        where: { programa: 'FAM', nombre: configTipo.nombre },
      });
      if (!tipoBeneficio) {
        tipoBeneficio = await this.prisma.tipoBeneficio.create({
          data: {
            id: `TB-FAM-${Date.now()}`,
            codigo: 'FALLECIMIENTO',
            nombre: configTipo.nombre,
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
      tipoBeneficio = await this.prisma.tipoBeneficio.findFirst({
        where: { programa: 'FAM', codigo: 'FALLECIMIENTO' },
      });
    }
    if (!tipoBeneficio) {
      throw new BadRequestException('Tipo de beneficio no encontrado');
    }

    const nombresConcat = dto.herederos
      .map((h) => `${h.nombres.trim()} ${h.apellidos.trim()}`)
      .join(' / ');
    const dnisConcat = dto.herederos.map((h) => h.numeroDocumento.trim()).join(' / ');

    const estadoFinal = dto.estado === 'PAGADA' ? 'PAGADA' : 'PENDIENTE';

    // T8: Calcular saldo pendiente para la sucesión intestada
    const sumaMontos = Number(
      dto.herederos.reduce((acc, h) => acc + Number(h.monto || 0), 0).toFixed(2),
    );
    const montoMinimo = await this.famBeneficiosService.obtenerMontoMinimoFallecimiento();
    const calculo = this.famBeneficiosService.calcularSaldoPendiente(sumaMontos, montoMinimo);

    const resultado = await this.prisma.$transaction(async (tx) => {
      // 1. Crear expediente principal
      const solicitud = await tx.famSolicitudBeneficio.create({
        data: {
          colegiadoId: dto.colegiadoId.trim(),
          tipoBeneficioId: tipoBeneficio.id,
          monto: dto.montoTotal,
          montoTotalAsignado: calculo.montoTotalAsignado,
          saldoPendiente: calculo.saldoPendiente,
          tieneSaldoPendiente: calculo.tieneSaldoPendiente,
          moneda: 'PEN',
          estado: estadoFinal,
          sucesionIntestada: dto.sustentoPdf || null,
          solicitanteNombre: nombresConcat.slice(0, 200),
          solicitanteDni: dnisConcat.slice(0, 20) || dto.herederos[0]?.numeroDocumento,
          modalidadBeneficio: 'monto_compartido',
          documentacionCompleta: Boolean(dto.sustentoPdf),
          documentacionObservacion: !dto.sustentoPdf
            ? (dto.observacionSinSucesion?.trim() || dto.observaciones?.trim() || 'Sin documento de sucesión intestada')
            : null,
          fechaSolicitud: dto.fechaSolicitud ? new Date(dto.fechaSolicitud) : new Date(),
          fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : null,
          fechaDefuncion: dto.fechaDefuncion ? new Date(dto.fechaDefuncion) : null,
          causaFallecimiento: dto.causaFallecimiento || null,
          expedienteNumero: dto.expedienteNumero || null,
          cartaNumero: dto.cartaNumero || null,
          cartaFecha: dto.cartaFecha ? new Date(dto.cartaFecha) : null,
          memorandoNumero: dto.memorandoNumero || null,
          memorandoFecha: dto.memorandoFecha ? new Date(dto.memorandoFecha) : null,
          banco: dto.banco || null,
          formaPago: dto.formaPago || null,
          observaciones: dto.observaciones || null,
          actaDefuncion: dto.actaDefuncion || null,
          solicitudAsignacion: dto.solicitudAsignacion || null,
          fichaAdmisibilidad: dto.fichaAdmisibilidad || null,
          cartaRemision: dto.cartaRemision || null,
          memorando: dto.memorando || null,
          ordenPago: dto.ordenPago || null,
          otrosDocumentos: dto.otrosDocumentos || null,
          registradoPor: userId,
        },
      });

      if (calculo.tieneSaldoPendiente) {
        await this.famBeneficiosService.registrarAuditoriaBeneficiarios({
          expedienteId: solicitud.id,
          accion: 'GUARDADO_CON_SALDO',
          usuarioId: userId,
          montoFaltante: calculo.saldoPendiente,
          montoTotal: calculo.montoTotalAsignado,
          detalleJson: {
            motivo: 'Registro inicial de sucesión intestada con saldo pendiente',
            herederos: dto.herederos.map((h) => ({
              nombres: `${h.nombres} ${h.apellidos}`.trim(),
              dni: h.numeroDocumento,
              porcentaje: h.porcentaje,
              monto: h.monto,
            })),
          },
          ipAddress: ip,
          tx,
        });
      }

      // 2. Crear cabecera de sucesión intestada
      const sucesion = await tx.famSucesionIntestada.create({
        data: {
          solicitudId: solicitud.id,
          colegiadoId: dto.colegiadoId.trim(),
          numeroPartidaRegistral: dto.numeroPartidaRegistral || null,
          notariaJuzgado: dto.notariaJuzgado || null,
          fechaEmisionDocumento: dto.fechaEmisionDocumento ? new Date(dto.fechaEmisionDocumento) : null,
          sustentoPdf: dto.sustentoPdf || null,
          montoTotal: dto.montoTotal,
          estadoTramite: dto.estado || 'BORRADOR',
          versionActual: 1,
          observaciones: dto.observaciones || null,
          observacionSinSucesion: dto.observacionSinSucesion || null,
          registradoPor: userId,
        },
      });

      // 3. Crear cada heredero en fam_beneficiarios, fam_sucesion_beneficiarios y fam_solicitud_beneficiarios
      for (let i = 0; i < dto.herederos.length; i++) {
        const h = dto.herederos[i];
        const nombreCompleto = `${h.nombres.trim()} ${h.apellidos.trim()}`;

        const ben = await tx.famBeneficiario.create({
          data: {
            colegiadoId: dto.colegiadoId.trim(),
            nombre: nombreCompleto,
            dni: h.numeroDocumento.trim(),
            parentesco: h.parentesco,
            porcentaje: h.porcentaje,
            registradoPor: userId,
          },
        });

        await tx.famSucesionBeneficiario.create({
          data: {
            sucesionId: sucesion.id,
            beneficiarioId: ben.id,
            tipoDocumento: (h.tipoDocumento || 'DNI').toUpperCase(),
            numeroDocumento: h.numeroDocumento.trim(),
            nombres: h.nombres.trim(),
            apellidos: h.apellidos.trim(),
            parentesco: h.parentesco,
            porcentaje: h.porcentaje,
            monto: h.monto,
            telefono: h.telefono || null,
            email: h.email || null,
            declaracionJuradaPdf: h.declaracionJuradaPdf || null,
            ordenPagoPdf: h.ordenPagoPdf || null,
            orden: i + 1,
          },
        });

        await tx.famSolicitudBeneficiario.create({
          data: {
            solicitudId: solicitud.id,
            beneficiarioId: ben.id,
            porcentajeAsignado: h.porcentaje,
            declaracionJurada: h.declaracionJuradaPdf || null,
            declaracionJuradaDni: h.numeroDocumento.trim(),
            ordenPago: h.ordenPagoPdf || null,
          },
        });

        // Si se registra directamente como PAGADA, generar registros de depósito iniciales
        if (estadoFinal === 'PAGADA') {
          await tx.famDepositoBeneficiario.create({
            data: {
              solicitudId: solicitud.id,
              beneficiarioId: ben.id,
              nombreBeneficiario: nombreCompleto,
              dniBeneficiario: h.numeroDocumento.trim(),
              porcentaje: h.porcentaje,
              monto: h.monto,
              banco: dto.banco || null,
              fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : new Date(),
              estado: 'PAGADO',
              registradoPor: userId,
            },
          });
        }
      }

      // 4. Crear versión 1 inmutable en fam_sucesion_versiones
      await tx.famSucesionVersion.create({
        data: {
          sucesionId: sucesion.id,
          numeroVersion: 1,
          snapshotDistribucionJson: JSON.stringify(dto.herederos),
          motivoModificacion: 'Registro inicial de sucesión intestada con múltiples herederos',
          modificadoPor: userId,
          ipAddress: ip || null,
        },
      });

      return { solicitud, sucesion };
    });

    // 5. Registrar en AuditLog
    await this.auditService.log({
      userId,
      action: 'CREATE',
      entity: 'fam_sucesion_intestada',
      entityId: resultado.sucesion.id,
      changes: {
        sucesion: {
          old: null,
          new: {
            solicitudId: resultado.solicitud.id,
            colegiadoId: dto.colegiadoId,
            montoTotal: dto.montoTotal,
            totalHerederos: dto.herederos.length,
            version: 1,
          },
        },
      },
      ipAddress: ip,
    });

    return resultado;
  }

  async obtenerSucesionPorSolicitud(solicitudId: string) {
    const sucesion = await this.prisma.famSucesionIntestada.findUnique({
      where: { solicitudId },
      include: {
        herederos: {
          orderBy: { orden: 'asc' },
        },
        versiones: {
          orderBy: { numeroVersion: 'desc' },
        },
        solicitud: {
          include: {
            tipoBeneficio: true,
          },
        },
      },
    });

    if (!sucesion) {
      throw new NotFoundException(`No se encontró registro de sucesión intestada para la solicitud ${solicitudId}`);
    }

    return sucesion;
  }

  async modificarDistribucion(
    sucesionId: string,
    dto: ModificarDistribucionSucesionDto,
    userId: string,
    ip?: string,
  ) {
    const sucesion = await this.prisma.famSucesionIntestada.findUnique({
      where: { id: sucesionId },
      include: { herederos: true },
    });
    if (!sucesion) {
      throw new NotFoundException(`Sucesión intestada ${sucesionId} no encontrada`);
    }

    if (!dto.motivoModificacion?.trim()) {
      throw new BadRequestException('Debe especificar el motivo de modificación de la distribución');
    }

    this.validarHerederos(dto.herederos, Number(sucesion.montoTotal));

    const nuevaVersionNum = sucesion.versionActual + 1;

    const actualizada = await this.prisma.$transaction(async (tx) => {
      // 1. Eliminar vínculos antiguos de la solicitud para refrescar
      await tx.famSolicitudBeneficiario.deleteMany({
        where: { solicitudId: sucesion.solicitudId },
      });

      // 2. Eliminar detalle previo de fam_sucesion_beneficiarios
      await tx.famSucesionBeneficiario.deleteMany({
        where: { sucesionId },
      });

      // 3. Insertar nueva lista de herederos
      for (let i = 0; i < dto.herederos.length; i++) {
        const h = dto.herederos[i];
        const nombreCompleto = `${h.nombres.trim()} ${h.apellidos.trim()}`;

        // Buscar si ya existe este beneficiario por colegiado y dni
        let ben = await tx.famBeneficiario.findFirst({
          where: {
            colegiadoId: sucesion.colegiadoId,
            dni: h.numeroDocumento.trim(),
          },
        });

        if (!ben) {
          ben = await tx.famBeneficiario.create({
            data: {
              colegiadoId: sucesion.colegiadoId,
              nombre: nombreCompleto,
              dni: h.numeroDocumento.trim(),
              parentesco: h.parentesco,
              porcentaje: h.porcentaje,
              registradoPor: userId,
            },
          });
        } else {
          ben = await tx.famBeneficiario.update({
            where: { id: ben.id },
            data: {
              nombre: nombreCompleto,
              parentesco: h.parentesco,
              porcentaje: h.porcentaje,
            },
          });
        }

        await tx.famSucesionBeneficiario.create({
          data: {
            sucesionId,
            beneficiarioId: ben.id,
            tipoDocumento: (h.tipoDocumento || 'DNI').toUpperCase(),
            numeroDocumento: h.numeroDocumento.trim(),
            nombres: h.nombres.trim(),
            apellidos: h.apellidos.trim(),
            parentesco: h.parentesco,
            porcentaje: h.porcentaje,
            monto: h.monto,
            telefono: h.telefono || null,
            email: h.email || null,
            declaracionJuradaPdf: h.declaracionJuradaPdf || null,
            ordenPagoPdf: h.ordenPagoPdf || null,
            orden: i + 1,
          },
        });

        await tx.famSolicitudBeneficiario.create({
          data: {
            solicitudId: sucesion.solicitudId,
            beneficiarioId: ben.id,
            porcentajeAsignado: h.porcentaje,
            declaracionJurada: h.declaracionJuradaPdf || null,
            declaracionJuradaDni: h.numeroDocumento.trim(),
            ordenPago: h.ordenPagoPdf || null,
          },
        });
      }

      // 4. Actualizar cabecera con nueva versión
      const sucActualizada = await tx.famSucesionIntestada.update({
        where: { id: sucesionId },
        data: {
          versionActual: nuevaVersionNum,
          updatedAt: new Date(),
        },
      });

      // 5. Actualizar resumen en famSolicitudBeneficio y recalcular saldo pendiente
      const nombresConcat = dto.herederos
        .map((h) => `${h.nombres.trim()} ${h.apellidos.trim()}`)
        .join(' / ');
      const dnisConcat = dto.herederos.map((h) => h.numeroDocumento.trim()).join(' / ');

      const sumaMontos = Number(
        dto.herederos.reduce((acc, h) => acc + Number(h.monto || 0), 0).toFixed(2),
      );
      const montoMinimo = await this.famBeneficiosService.obtenerMontoMinimoFallecimiento();
      const calculo = this.famBeneficiosService.calcularSaldoPendiente(sumaMontos, montoMinimo);

      await tx.famSolicitudBeneficio.update({
        where: { id: sucesion.solicitudId },
        data: {
          solicitanteNombre: nombresConcat.slice(0, 200),
          solicitanteDni: dnisConcat.slice(0, 20) || dto.herederos[0]?.numeroDocumento,
          montoTotalAsignado: calculo.montoTotalAsignado,
          saldoPendiente: calculo.saldoPendiente,
          tieneSaldoPendiente: calculo.tieneSaldoPendiente,
        },
      });

      await this.famBeneficiosService.registrarAuditoriaBeneficiarios({
        expedienteId: sucesion.solicitudId,
        accion: 'AJUSTE',
        usuarioId: userId,
        montoFaltante: calculo.saldoPendiente,
        montoTotal: calculo.montoTotalAsignado,
        detalleJson: {
          motivo: dto.motivoModificacion,
          version: nuevaVersionNum,
          herederos: dto.herederos.map((h) => ({
            nombres: `${h.nombres} ${h.apellidos}`.trim(),
            dni: h.numeroDocumento,
            porcentaje: h.porcentaje,
            monto: h.monto,
          })),
        },
        ipAddress: ip,
        tx,
      });

      // 6. Sincronizar depósitos si ya existían para este trámite
      const depositosExistentes = await tx.famDepositoBeneficiario.findMany({
        where: { solicitudId: sucesion.solicitudId },
      });
      if (depositosExistentes.length > 0) {
        await tx.famDepositoBeneficiario.deleteMany({
          where: { solicitudId: sucesion.solicitudId },
        });
        for (const h of dto.herederos) {
          const ben = await tx.famBeneficiario.findFirst({
            where: {
              colegiadoId: sucesion.colegiadoId,
              dni: h.numeroDocumento.trim(),
            },
          });
          await tx.famDepositoBeneficiario.create({
            data: {
              solicitudId: sucesion.solicitudId,
              beneficiarioId: ben?.id || null,
              nombreBeneficiario: `${h.nombres.trim()} ${h.apellidos.trim()}`,
              dniBeneficiario: h.numeroDocumento.trim(),
              porcentaje: h.porcentaje,
              monto: h.monto,
              banco: depositosExistentes[0]?.banco || null,
              fechaPago: depositosExistentes[0]?.fechaPago || new Date(),
              estado: depositosExistentes[0]?.estado || 'PAGADO',
              registradoPor: userId,
            },
          });
        }
      }

      // 7. Registrar versión en historial
      await tx.famSucesionVersion.create({
        data: {
          sucesionId,
          numeroVersion: nuevaVersionNum,
          snapshotDistribucionJson: JSON.stringify(dto.herederos),
          motivoModificacion: dto.motivoModificacion.trim(),
          modificadoPor: userId,
          ipAddress: ip || null,
        },
      });

      return sucActualizada;
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entity: 'fam_sucesion_intestada',
      entityId: sucesionId,
      changes: {
        distribucion: {
          old: {
            version: sucesion.versionActual,
            totalHerederos: sucesion.herederos.length,
          },
          new: {
            version: nuevaVersionNum,
            motivo: dto.motivoModificacion,
            totalHerederos: dto.herederos.length,
          },
        },
      },
      ipAddress: ip,
    });

    return actualizada;
  }

  async obtenerHistorialVersiones(sucesionId: string) {
    const versiones = await this.prisma.famSucesionVersion.findMany({
      where: { sucesionId },
      orderBy: { numeroVersion: 'desc' },
    });
    return versiones;
  }

  async obtenerDeclaracionHeredero(sucesionId: string, herederoId: string) {
    const heredero = await this.prisma.famSucesionBeneficiario.findFirst({
      where: { sucesionId, id: herederoId },
    });
    if (!heredero) throw new NotFoundException('Heredero no encontrado en la sucesión');
    if (!heredero.declaracionJuradaPdf) {
      throw new NotFoundException('Declaración jurada no cargada para este heredero');
    }
    return {
      sucesionId,
      herederoId,
      numeroDocumento: heredero.numeroDocumento,
      nombres: heredero.nombres,
      apellidos: heredero.apellidos,
      contenido: heredero.declaracionJuradaPdf,
    };
  }

  async obtenerVoucherHeredero(sucesionId: string, herederoId: string) {
    const heredero = await this.prisma.famSucesionBeneficiario.findFirst({
      where: { sucesionId, id: herederoId },
    });
    if (!heredero) throw new NotFoundException('Heredero no encontrado en la sucesión');
    if (!heredero.ordenPagoPdf) {
      throw new NotFoundException('Voucher / Orden de pago no cargada para este heredero');
    }
    return {
      sucesionId,
      herederoId,
      numeroDocumento: heredero.numeroDocumento,
      nombres: heredero.nombres,
      apellidos: heredero.apellidos,
      monto: Number(heredero.monto),
      contenido: heredero.ordenPagoPdf,
    };
  }
}
