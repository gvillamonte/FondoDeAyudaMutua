import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyService } from '../legacy/legacy.service';
import { AuditService } from '../audit/audit.service';
import { ActualizacionDatosEmailService } from './actualizacion-datos-email.service';
import { ConsultarColegiadoDto, ActualizarDatosColegiadoDto, FiltroActualizacionesDto } from './dto/actualizacion-datos.dto';

@Injectable()
export class ActualizacionDatosService {
  private readonly logger = new Logger(ActualizacionDatosService.name);

  constructor(
    private prisma: PrismaService,
    private legacyService: LegacyService,
    private auditService: AuditService,
    private emailService: ActualizacionDatosEmailService,
  ) {}

  /**
   * Verifica si un N° CIP existe en el padrón del colegio.
   * Primer paso del flujo de actualización antes de solicitar el DNI.
   */
  async verificarCip(cip: string) {
    const cipNormalized = String(cip).trim();
    if (!cipNormalized) {
      throw new BadRequestException('El número de CIP es obligatorio');
    }

    let colegiado: any = null;
    try {
      colegiado = await this.legacyService.getColegiadoByNumero(cipNormalized);
    } catch {
      colegiado = null;
    }

    if (!colegiado) {
      throw new NotFoundException(`No se encontró ningún colegiado con el N° CIP ${cipNormalized}`);
    }

    const nombreCompleto = [
      colegiado.NOMBRES,
      colegiado.APELLIDO_PATERNO,
      colegiado.APELLIDO_MATERNO,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Enmascarar nombre para confirmar visualmente al titular (ej: J*** P*** L***)
    const partes = nombreCompleto.split(' ');
    const nombreEnmascarado = partes
      .map((p) => (p.length > 2 ? p[0] + '*'.repeat(Math.min(5, p.length - 2)) + p[p.length - 1] : p))
      .join(' ');

    return {
      valido: true,
      cip: String(colegiado.NUM_COLEGIATURA || cipNormalized).trim(),
      nombreEnmascarado,
      especialidad: colegiado.ESPECIALIDAD || '',
      estadoColegiatura: colegiado.ESTADO_COLEGIATURA || (colegiado.HABILITADO ? 'HABILITADO' : 'NO HABILITADO'),
      habilitado: Boolean(colegiado.HABILITADO),
    };
  }

  /**
   * Consulta los datos de un colegiado por CIP y DNI.
   * Si ya tiene actualizaciones registradas en APP_DB, fusiona los datos
   * para presentar siempre la versión más reciente.
   */
  async consultarPorCipYDni(dto: ConsultarColegiadoDto) {
    const colegiado = await this.legacyService.getColegiadoByCipAndDni(dto.cip, dto.dni);
    if (!colegiado) {
      throw new NotFoundException('No se encontró ningún colegiado con los datos ingresados');
    }

    const cipStr = String(colegiado.NUM_COLEGIATURA || dto.cip).trim();
    const dniStr = String(colegiado.DNI || dto.dni).trim();

    // Buscar si ya tiene una actualización previa en APP_DB
    let ultimaActualizacion: any = null;
    try {
      ultimaActualizacion = await this.prisma.colegiadoActualizacion.findFirst({
        where: {
          OR: [
            { cip: cipStr },
            { dni: dniStr },
            { colegiadoId: String(colegiado.COLEGIADO_ID) },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err: any) {
      this.logger.warn(`No se pudo consultar historial en APP_DB: ${err.message}`);
    }

    const nombreCompleto = [
      colegiado.NOMBRES,
      colegiado.APELLIDO_PATERNO,
      colegiado.APELLIDO_MATERNO,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Formatear fecha de nacimiento si viene de legacy
    let fechaNacimientoOriginal = '';
    if (colegiado.FECHA_NACIMIENTO) {
      try {
        fechaNacimientoOriginal = new Date(colegiado.FECHA_NACIMIENTO).toISOString().slice(0, 10);
      } catch {}
    }

    // Normalizar sexo (soporta 'M', 'F', '1' (Masculino), '2' (Femenino))
    const normalizarSexo = (valor: string | null | undefined): string => {
      if (!valor) return '';
      const v = String(valor).toUpperCase().trim();
      if (v === '1' || v.startsWith('M')) return 'M';
      if (v === '2' || v.startsWith('F')) return 'F';
      return v;
    };

    // Normalizar estado civil a las opciones estándar del sistema:
    // 'Soltero(a)', 'Casado(a)', 'Viudo(a)', 'Divorciado(a)', 'Conviviente'
    const normalizarEstadoCivil = (
      texto: string | null | undefined,
      codigo: string | null | undefined,
    ): string => {
      const t = String(texto || '').toUpperCase().trim();
      const c = String(codigo || '').toUpperCase().trim();
      const combinado = `${t} ${c}`.trim();

      if (!combinado) return '';

      // Divorciado(a) - Mapea '4', '04', 'D', 'DIV', 'DIVORCIADO', 'DIVORCIADA', etc.
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

      return (texto || '').trim();
    };

    return {
      colegiadoId: String(colegiado.COLEGIADO_ID),
      cip: cipStr,
      dni: dniStr,
      nombres: colegiado.NOMBRES || '',
      apellidoPaterno: colegiado.APELLIDO_PATERNO || '',
      apellidoMaterno: colegiado.APELLIDO_MATERNO || '',
      nombreCompleto,
      especialidad: colegiado.ESPECIALIDAD || '',
      estadoColegiatura: colegiado.ESTADO_COLEGIATURA || (colegiado.HABILITADO ? 'HABILITADO' : 'NO HABILITADO'),
      habilitado: Boolean(colegiado.HABILITADO),
      fechaUltimoPago: colegiado.FECHA_ULTIMO_PAGO ? new Date(colegiado.FECHA_ULTIMO_PAGO).toISOString().slice(0, 10) : null,
      fechaHabilitado: colegiado.FECHA_HABILITADO ? new Date(colegiado.FECHA_HABILITADO).toISOString().slice(0, 10) : null,
      fechaIngreso: colegiado.FECHA_INGRESO ? new Date(colegiado.FECHA_INGRESO).toISOString().slice(0, 10) : null,
      // Datos editables (priorizan la última actualización en APP_DB)
      email: ultimaActualizacion?.emailNuevo ?? colegiado.EMAIL ?? '',
      celular: ultimaActualizacion?.celularNuevo ?? colegiado.TELEFONO ?? '',
      fechaNacimiento: ultimaActualizacion?.fechaNacimientoNuevo ?? fechaNacimientoOriginal,
      sexo: normalizarSexo(ultimaActualizacion?.sexoNuevo ?? colegiado.SEXO),
      direccion: ultimaActualizacion?.direccionNuevo ?? colegiado.DIRECCION ?? '',
      departamento: ultimaActualizacion?.departamentoNuevo ?? colegiado.DEPARTAMENTO ?? '',
      provincia: ultimaActualizacion?.provinciaNuevo ?? colegiado.PROVINCIA ?? '',
      distrito: ultimaActualizacion?.distritoNuevo ?? colegiado.DISTRITO ?? '',
      referencia: ultimaActualizacion?.referenciaNuevo ?? colegiado.REFERENCIA ?? '',
      estadoCivil:
        ultimaActualizacion?.estadoCivilNuevo
          ? normalizarEstadoCivil(ultimaActualizacion.estadoCivilNuevo, null)
          : normalizarEstadoCivil(colegiado.ESTADO_CIVIL, colegiado.ESTADO_CIVIL_COD),
      estadoCivilCodigo: colegiado.ESTADO_CIVIL_COD ? String(colegiado.ESTADO_CIVIL_COD).trim() : '',
      // Metadatos de actualización
      tieneActualizacionPrevia: Boolean(ultimaActualizacion),
      ultimaActualizacionFecha: ultimaActualizacion?.createdAt || null,
    };
  }

  /**
   * Catálogos para el formulario de actualización (Ubigeos y Estados Civiles)
   */
  async obtenerCatalogos() {
    const ubigeos = await this.legacyService.getUbigeosCatalog();
    const estadosCiviles = [
      { codigo: '1', nombre: 'Soltero(a)' },
      { codigo: '2', nombre: 'Casado(a)' },
      { codigo: '3', nombre: 'Viudo(a)' },
      { codigo: '4', nombre: 'Divorciado(a)' },
      { codigo: '5', nombre: 'Conviviente' },
    ];
    return {
      ubigeos,
      estadosCiviles,
    };
  }

  /**
   * Registra una actualización de datos del colegiado en APP_DB.
   * Guarda historial inmutable para auditoría y reporte administrativo.
   */
  async actualizarDatos(dto: ActualizarDatosColegiadoDto, ip?: string, userAgent?: string) {
    // 1. Validar que el colegiado existe con CIP y DNI
    const datosActuales = await this.consultarPorCipYDni({ cip: dto.cip, dni: dto.dni });

    // 2. Normalizar valores nuevos
    const emailNuevo = dto.email.trim().toLowerCase();
    const celularNuevo = dto.celular.trim().replace(/\s+/g, '');
    const fechaNacimientoNuevo = dto.fechaNacimiento ? dto.fechaNacimiento.trim().slice(0, 10) : null;
    const sexoNuevo = dto.sexo ? (dto.sexo.toUpperCase().startsWith('M') || dto.sexo === '1' ? 'M' : 'F') : null;

    // Validación estricta de correo (evitar correos de prueba o ficticios)
    if (process.env.NODE_ENV !== 'test') {
      const dominiosProhibidos = ['test.com', 'prueba.com', 'ejemplo.com', 'fake.com', 'correo.com', 'yopmail.com', 'mailinator.com', 'tempmail.com', 'asdf.com'];
      const usuariosProhibidos = ['test', 'prueba', 'fake', 'asdf', 'correo', 'email', 'usuario', 'admin'];
      const [uPart, dPart] = emailNuevo.split('@');
      if (dominiosProhibidos.includes(dPart) || usuariosProhibidos.includes(uPart)) {
        throw new BadRequestException('El correo electrónico no puede ser ficticio o de prueba.');
      }
    }

    // Validación estricta de celular (evitar números de prueba o ficticios)
    const digitosCel = celularNuevo.replace(/\D/g, '');
    const telefonosPrueba = [
      '999999999', '911111111', '900000000', '922222222', '933333333',
      '944444444', '955555555', '966666666', '977777777', '988888888',
      '987654321', '987654320', '912345678', '923456789', '901234567',
      '987987987', '912912912', '909090909', '989898989', '900000001',
    ];
    if (telefonosPrueba.includes(digitosCel)) {
      throw new BadRequestException('El número de celular ingresado es un número de prueba no permitido.');
    }

    // Validación de coherencia de fechas: Nacimiento vs Colegiatura
    if (fechaNacimientoNuevo && datosActuales.fechaIngreso) {
      const fNac = new Date(`${fechaNacimientoNuevo}T00:00:00`);
      const fCol = new Date(`${datosActuales.fechaIngreso}T00:00:00`);
      if (!isNaN(fNac.getTime()) && !isNaN(fCol.getTime())) {
        if (fNac >= fCol) {
          throw new BadRequestException(
            `Inconsistencia en fechas: Su fecha de nacimiento (${fechaNacimientoNuevo}) no puede ser igual o posterior a su fecha de incorporación/colegiatura (${datosActuales.fechaIngreso}).`,
          );
        }
        let edad = fCol.getFullYear() - fNac.getFullYear();
        const mDiff = fCol.getMonth() - fNac.getMonth();
        if (mDiff < 0 || (mDiff === 0 && fCol.getDate() < fNac.getDate())) edad--;
        if (edad < 18) {
          throw new BadRequestException(
            `Inconsistencia en fechas: La fecha de nacimiento indica que tenía ${edad} años al colegiarse. Se requiere al menos 18 años.`,
          );
        }
      }
    }
    const direccionNuevo = dto.direccion ? dto.direccion.trim() : null;
    const departamentoNuevo = dto.departamento ? dto.departamento.trim().toUpperCase() : null;
    const provinciaNuevo = dto.provincia ? dto.provincia.trim().toUpperCase() : null;
    const distritoNuevo = dto.distrito ? dto.distrito.trim().toUpperCase() : null;
    const referenciaNuevo = dto.referencia ? dto.referencia.trim() : null;
    const ecNorm = dto.estadoCivil ? dto.estadoCivil.trim() : null;
    const estadoCivilNuevo = ecNorm
      ? ecNorm.toUpperCase().startsWith('DIV') || ecNorm === '4' || ecNorm === 'D'
        ? 'Divorciado(a)'
        : ecNorm.toUpperCase().startsWith('CAS') || ecNorm === '2' || ecNorm === 'C'
        ? 'Casado(a)'
        : ecNorm.toUpperCase().startsWith('VIU') || ecNorm === '3' || ecNorm === 'V'
        ? 'Viudo(a)'
        : ecNorm.toUpperCase().startsWith('CONV') || ecNorm === '5'
        ? 'Conviviente'
        : ecNorm.toUpperCase().startsWith('SOL') || ecNorm === '1' || ecNorm === 'S'
        ? 'Soltero(a)'
        : ecNorm
      : null;

    // 3. Actualizar directamente en la base de datos principal (TPersona y TPersonaNatural)
    // Permite que los cambios se reflejen inmediatamente en todo el sistema CIP
    await this.legacyService.actualizarDatosColegiado(datosActuales.cip, {
      email: emailNuevo,
      celular: celularNuevo,
      fechaNacimiento: fechaNacimientoNuevo,
      sexo: sexoNuevo,
      direccion: direccionNuevo,
      referencia: referenciaNuevo,
      departamento: departamentoNuevo,
      provincia: provinciaNuevo,
      distrito: distritoNuevo,
      estadoCivil: estadoCivilNuevo,
    });

    // 4. Guardar únicamente la última modificación en APP_DB (un solo registro por colegiado)
    const registroExistente = await this.prisma.colegiadoActualizacion.findFirst({
      where: { cip: datosActuales.cip },
      orderBy: { createdAt: 'desc' },
    });

    let registro;
    if (registroExistente) {
      registro = await this.prisma.colegiadoActualizacion.update({
        where: { id: registroExistente.id },
        data: {
          nombres: datosActuales.nombreCompleto,
          emailAnterior: datosActuales.email || registroExistente.emailAnterior || null,
          emailNuevo,
          celularAnterior: datosActuales.celular || registroExistente.celularAnterior || null,
          celularNuevo,
          fechaNacimientoAnterior: datosActuales.fechaNacimiento || registroExistente.fechaNacimientoAnterior || null,
          fechaNacimientoNuevo,
          sexoAnterior: datosActuales.sexo || registroExistente.sexoAnterior || null,
          sexoNuevo,
          direccionAnterior: datosActuales.direccion || registroExistente.direccionAnterior || null,
          direccionNuevo,
          departamentoAnterior: datosActuales.departamento || registroExistente.departamentoAnterior || null,
          departamentoNuevo,
          provinciaAnterior: datosActuales.provincia || registroExistente.provinciaAnterior || null,
          provinciaNuevo,
          distritoAnterior: datosActuales.distrito || registroExistente.distritoAnterior || null,
          distritoNuevo,
          referenciaAnterior: datosActuales.referencia || registroExistente.referenciaAnterior || null,
          referenciaNuevo,
          estadoCivilAnterior: datosActuales.estadoCivil || registroExistente.estadoCivilAnterior || null,
          estadoCivilNuevo,
          ipAddress: ip || 'unknown',
          userAgent: userAgent ? userAgent.slice(0, 500) : 'unknown',
          estado: 'ACTUALIZADO',
          updatedAt: new Date(),
        },
      });
    } else {
      registro = await this.prisma.colegiadoActualizacion.create({
        data: {
          colegiadoId: datosActuales.colegiadoId,
          cip: datosActuales.cip,
          dni: datosActuales.dni,
          nombres: datosActuales.nombreCompleto,
          emailAnterior: datosActuales.email || null,
          emailNuevo,
          celularAnterior: datosActuales.celular || null,
          celularNuevo,
          fechaNacimientoAnterior: datosActuales.fechaNacimiento || null,
          fechaNacimientoNuevo,
          sexoAnterior: datosActuales.sexo || null,
          sexoNuevo,
          direccionAnterior: datosActuales.direccion || null,
          direccionNuevo,
          departamentoAnterior: datosActuales.departamento || null,
          departamentoNuevo,
          provinciaAnterior: datosActuales.provincia || null,
          provinciaNuevo,
          distritoAnterior: datosActuales.distrito || null,
          distritoNuevo,
          referenciaAnterior: datosActuales.referencia || null,
          referenciaNuevo,
          estadoCivilAnterior: datosActuales.estadoCivil || null,
          estadoCivilNuevo,
          ipAddress: ip || 'unknown',
          userAgent: userAgent ? userAgent.slice(0, 500) : 'unknown',
          estado: 'ACTUALIZADO',
        },
      });
    }

    // 5. Registrar en AuditLog
    try {
      const systemColegiadoUserId = '00000000-0000-0000-0000-000000000001';
      await this.auditService.log({
        userId: systemColegiadoUserId,
        action: 'UPDATE',
        entity: 'colegiado_actualizacion',
        entityId: registro.id,
        changes: {
          cip: { old: null, new: datosActuales.cip },
          email: { old: datosActuales.email, new: emailNuevo },
          celular: { old: datosActuales.celular, new: celularNuevo },
          fechaNacimiento: { old: datosActuales.fechaNacimiento, new: fechaNacimientoNuevo },
          sexo: { old: datosActuales.sexo, new: sexoNuevo },
          direccion: { old: datosActuales.direccion, new: direccionNuevo },
          departamento: { old: datosActuales.departamento, new: departamentoNuevo },
          provincia: { old: datosActuales.provincia, new: provinciaNuevo },
          distrito: { old: datosActuales.distrito, new: distritoNuevo },
          referencia: { old: datosActuales.referencia, new: referenciaNuevo },
          estadoCivil: { old: datosActuales.estadoCivil, new: estadoCivilNuevo },
        },
        ipAddress: ip,
        userAgent,
      });
    } catch (auditErr: any) {
      this.logger.warn(`Error al guardar auditLog de actualización: ${auditErr.message}`);
    }

    // 6. Enviar constancia oficial con todos los datos registrados al correo del colegiado
    let emailEnviado = false;
    try {
      emailEnviado = await this.emailService.enviarConstanciaActualizacion({
        cip: datosActuales.cip,
        dni: datosActuales.dni,
        nombres: datosActuales.nombreCompleto,
        fechaIngreso: datosActuales.fechaIngreso,
        fechaUltimoPago: datosActuales.fechaUltimoPago,
        email: emailNuevo,
        celular: celularNuevo,
        fechaNacimiento: fechaNacimientoNuevo,
        sexo: sexoNuevo,
        estadoCivil: estadoCivilNuevo,
        departamento: departamentoNuevo,
        provincia: provinciaNuevo,
        distrito: distritoNuevo,
        direccion: direccionNuevo,
        referencia: referenciaNuevo,
        fechaRegistro: registro.updatedAt || registro.createdAt,
        idOperacion: registro.id,
      });
    } catch (emailErr: any) {
      this.logger.warn(`No se pudo enviar el correo de constancia a ${emailNuevo}: ${emailErr.message}`);
    }

    // 7. Actualizar el estado del registro con el resultado del despacho de correo
    try {
      await this.prisma.colegiadoActualizacion.update({
        where: { id: registro.id },
        data: {
          estado: emailEnviado ? 'EMAIL_ENVIADO' : 'EMAIL_NO_ENVIADO',
        },
      });
    } catch (statusErr: any) {
      this.logger.warn(`No se pudo actualizar estado de correo en registro: ${statusErr.message}`);
    }

    return {
      success: true,
      message: emailEnviado
        ? `Datos actualizados correctamente. Se ha enviado una constancia a su correo electrónico ${emailNuevo}.`
        : 'Datos actualizados correctamente en el sistema.',
      emailEnviado,
      data: {
        id: registro.id,
        cip: registro.cip,
        dni: registro.dni,
        nombres: registro.nombres,
        email: registro.emailNuevo,
        celular: registro.celularNuevo,
        fechaNacimiento: registro.fechaNacimientoNuevo,
        sexo: registro.sexoNuevo,
        direccion: registro.direccionNuevo,
        departamento: registro.departamentoNuevo,
        provincia: registro.provinciaNuevo,
        distrito: registro.distritoNuevo,
        referencia: registro.referenciaNuevo,
        estadoCivil: registro.estadoCivilNuevo,
        fechaActualizacion: registro.updatedAt || registro.createdAt,
      },
    };
  }

  /**
   * Lista las últimas modificaciones de datos realizadas por los colegiados
   * con paginación en el servidor, filtros de búsqueda y fechas.
   * Cada colegiado aparece una sola vez con su última modificación.
   */
  async listarActualizaciones(filtros: FiltroActualizacionesDto) {
    const page = Math.max(1, filtros.page || 1);
    const limit = Math.max(1, Math.min(100, filtros.limit || 25));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filtros.search?.trim()) {
      const q = filtros.search.trim();
      where.OR = [
        { cip: { contains: q } },
        { dni: { contains: q } },
        { nombres: { contains: q } },
        { emailNuevo: { contains: q } },
        { celularNuevo: { contains: q } },
        { distritoNuevo: { contains: q } },
      ];
    }

    if (filtros.fechaDesde || filtros.fechaHasta) {
      where.updatedAt = {};
      if (filtros.fechaDesde) {
        where.updatedAt.gte = new Date(filtros.fechaDesde);
      }
      if (filtros.fechaHasta) {
        const hasta = new Date(filtros.fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        where.updatedAt.lte = hasta;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.colegiadoActualizacion.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.colegiadoActualizacion.count({ where }),
    ]);

    return {
      data: data.map((d) => ({
        ...d,
        fechaModificacion: d.updatedAt || d.createdAt,
        emailEnviado: d.estado === 'EMAIL_ENVIADO',
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Obtiene el detalle de la última modificación de un colegiado por ID.
   */
  async obtenerPorId(id: string) {
    const registro = await this.prisma.colegiadoActualizacion.findUnique({
      where: { id },
    });
    if (!registro) {
      throw new NotFoundException('Registro de actualización no encontrado');
    }
    return {
      ...registro,
      fechaModificacion: registro.updatedAt || registro.createdAt,
      emailEnviado: registro.estado === 'EMAIL_ENVIADO',
    };
  }

  /**
   * Exporta todos los registros filtrados para descarga en Excel/CSV.
   */
  async exportarTodos(filtros: FiltroActualizacionesDto) {
    const where: any = {};

    if (filtros.search?.trim()) {
      const q = filtros.search.trim();
      where.OR = [
        { cip: { contains: q } },
        { dni: { contains: q } },
        { nombres: { contains: q } },
        { emailNuevo: { contains: q } },
        { celularNuevo: { contains: q } },
        { distritoNuevo: { contains: q } },
      ];
    }

    if (filtros.fechaDesde || filtros.fechaHasta) {
      where.updatedAt = {};
      if (filtros.fechaDesde) {
        where.updatedAt.gte = new Date(filtros.fechaDesde);
      }
      if (filtros.fechaHasta) {
        const hasta = new Date(filtros.fechaHasta);
        hasta.setHours(23, 59, 59, 999);
        where.updatedAt.lte = hasta;
      }
    }

    return this.prisma.colegiadoActualizacion.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });
  }
}
