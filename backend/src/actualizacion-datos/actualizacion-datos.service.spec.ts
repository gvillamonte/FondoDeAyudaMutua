import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ActualizacionDatosService } from './actualizacion-datos.service';

describe('ActualizacionDatosService', () => {
  let service: ActualizacionDatosService;
  let prismaMock: any;
  let legacyServiceMock: any;
  let auditServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      colegiadoActualizacion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn(),
      },
    };

    legacyServiceMock = {
      getColegiadoByNumero: jest.fn(),
      getColegiadoByCipAndDni: jest.fn(),
      actualizarDatosColegiado: jest.fn().mockResolvedValue({ nIdPersona: 101, updatedFields: ['cCorreoElectronico1'] }),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    const emailServiceMock: any = {
      enviarConstanciaActualizacion: jest.fn().mockResolvedValue(true),
    };

    service = new ActualizacionDatosService(prismaMock, legacyServiceMock, auditServiceMock, emailServiceMock);
  });

  describe('verificarCip', () => {
    it('debe lanzar NotFoundException si el CIP no existe', async () => {
      legacyServiceMock.getColegiadoByNumero.mockResolvedValue(null);

      await expect(service.verificarCip('999999')).rejects.toThrow(NotFoundException);
    });

    it('debe retornar datos parciales del colegiado si el CIP existe', async () => {
      legacyServiceMock.getColegiadoByNumero.mockResolvedValue({
        NUM_COLEGIATURA: '123456',
        NOMBRES: 'JUAN',
        APELLIDO_PATERNO: 'PEREZ',
        APELLIDO_MATERNO: 'LOPEZ',
        ESPECIALIDAD: 'CIVIL',
        HABILITADO: 1,
      });

      const res = await service.verificarCip('123456');
      expect(res.valido).toBe(true);
      expect(res.cip).toBe('123456');
      expect(res.especialidad).toBe('CIVIL');
      expect(res.tipoDocumento).toBe('DNI');
      expect(res.tipoDocumentoNombre).toBe('DNI');
      expect(res.esVitalicio).toBe(false);
    });

    it('debe detectar Cédula de Extranjería y condición de Vitalicio al verificar CIP', async () => {
      legacyServiceMock.getColegiadoByNumero.mockResolvedValue({
        NUM_COLEGIATURA: '312260',
        NOMBRES: 'PIERRE',
        APELLIDO_PATERNO: 'DUBOIS',
        ESPECIALIDAD: 'CIVIL',
        HABILITADO: 1,
        TIPO_DOC_COD: '4',
        TIPO_ASOCIADO_COD: '2',
      });

      const res = await service.verificarCip('312260');
      expect(res.tipoDocumento).toBe('CE');
      expect(res.tipoDocumentoNombre).toBe('Cédula de Extranjería');
      expect(res.esVitalicio).toBe(true);
      expect(res.tipoAsociado).toBe('Vitalicio');
      expect(res.estadoColegiatura).toBe('HABILITADO');
    });
  });

  describe('consultarPorCipYDni', () => {
    it('debe lanzar NotFoundException si no existe el colegiado', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue(null);

      await expect(
        service.consultarPorCipYDni({ cip: '999999', dni: '00000000' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe retornar datos del colegiado correctamente si existe', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue({
        COLEGIADO_ID: 101,
        NUM_COLEGIATURA: '123456',
        DNI: '45678912',
        NOMBRES: 'JUAN',
        APELLIDO_PATERNO: 'PEREZ',
        APELLIDO_MATERNO: 'LOPEZ',
        ESPECIALIDAD: 'INGENIERIA CIVIL',
        ESTADO_COLEGIATURA: 'HABILITADO',
        HABILITADO: 1,
        EMAIL: 'juan.perez@test.com',
        TELEFONO: '987654321',
        SEXO: 'MASCULINO',
      });
      prismaMock.colegiadoActualizacion.findFirst.mockResolvedValue(null);

      const res = await service.consultarPorCipYDni({ cip: '123456', dni: '45678912' });

      expect(res.cip).toBe('123456');
      expect(res.dni).toBe('45678912');
      expect(res.nombreCompleto).toBe('JUAN PEREZ LOPEZ');
      expect(res.sexo).toBe('M');
      expect(res.email).toBe('juan.perez@test.com');
      expect(res.esVitalicio).toBe(false);
      expect(res.tipoDocumento).toBe('DNI');
    });

    it('debe suprimir fechaUltimoPago y fechaHabilitado si el colegiado es Vitalicio', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue({
        COLEGIADO_ID: 202,
        NUM_COLEGIATURA: '16947',
        DNI: '000092170',
        TIPO_DOC_COD: '4',
        TIPO_ASOCIADO_COD: '2',
        NOMBRES: 'ALBERTO',
        APELLIDO_PATERNO: 'GARCIA',
        FECHA_ULTIMO_PAGO: '2015-05-01',
        FECHA_HABILITADO: '2090-12-31',
        HABILITADO: 1,
      });
      prismaMock.colegiadoActualizacion.findFirst.mockResolvedValue(null);

      const res = await service.consultarPorCipYDni({ cip: '16947', dni: '000092170' });

      expect(res.esVitalicio).toBe(true);
      expect(res.tipoAsociado).toBe('Vitalicio');
      expect(res.tipoDocumento).toBe('CE');
      expect(res.tipoDocumentoNombre).toBe('Cédula de Extranjería');
      expect(res.fechaUltimoPago).toBeNull();
      expect(res.fechaHabilitado).toBeNull();
      expect(res.estadoColegiatura).toBe('HABILITADO');
      expect(res.habilitado).toBe(true);
    });

    it('debe fusionar datos actualizados si ya existen en APP_DB', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue({
        COLEGIADO_ID: 101,
        NUM_COLEGIATURA: '123456',
        DNI: '45678912',
        NOMBRES: 'JUAN',
        APELLIDO_PATERNO: 'PEREZ',
        APELLIDO_MATERNO: 'LOPEZ',
        EMAIL: 'antiguo@test.com',
        TELEFONO: '900000000',
      });
      prismaMock.colegiadoActualizacion.findFirst.mockResolvedValue({
        emailNuevo: 'nuevo@test.com',
        celularNuevo: '999888777',
        fechaNacimientoNuevo: '1985-05-20',
        sexoNuevo: 'M',
        direccionNuevo: 'Av. Las Palmeras 123',
        createdAt: new Date('2026-10-27T10:00:00Z'),
      });

      const res = await service.consultarPorCipYDni({ cip: '123456', dni: '45678912' });

      expect(res.email).toBe('nuevo@test.com');
      expect(res.celular).toBe('999888777');
      expect(res.fechaNacimiento).toBe('1985-05-20');
      expect(res.tieneActualizacionPrevia).toBe(true);
    });

    it('debe bloquear con ForbiddenException si el colegiado figura como FALLECIDO', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue({
        COLEGIADO_ID: 10443,
        NUM_COLEGIATURA: '10443',
        DNI: '24949223',
        NOMBRES: 'AQUILINO',
        APELLIDO_PATERNO: 'VILLA',
        ESTADO_COLEGIADO_COD: '5',
        ESTADO_COLEGIADO: 'Fallecido',
      });

      await expect(
        service.consultarPorCipYDni({ cip: '10443', dni: '24949223' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe bloquear con ForbiddenException si el colegiado figura como TEMPORAL', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue({
        COLEGIADO_ID: 21818,
        NUM_COLEGIATURA: '330087',
        DNI: '70134547',
        NOMBRES: 'THALIA',
        APELLIDO_PATERNO: 'MOSQUEIRA',
        ESTADO_COLEGIADO_COD: '2',
        ESTADO_COLEGIADO: 'Temporal',
      });

      await expect(
        service.consultarPorCipYDni({ cip: '330087', dni: '70134547' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe bloquear con ForbiddenException si el colegiado figura como TRANSFERIDO', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue({
        COLEGIADO_ID: 2323,
        NUM_COLEGIATURA: '10018',
        DNI: '10271409',
        NOMBRES: 'PELAYO',
        APELLIDO_PATERNO: 'MIRANDA',
        ESTADO_COLEGIADO_COD: '3',
        ESTADO_COLEGIADO: 'Transferido',
      });

      await expect(
        service.consultarPorCipYDni({ cip: '10018', dni: '10271409' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe bloquear con ForbiddenException (COOLDOWN_24H) si el colegiado actualizó hace menos de 24 horas', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue({
        COLEGIADO_ID: 101,
        NUM_COLEGIATURA: '123456',
        DNI: '45678912',
        NOMBRES: 'JUAN',
        APELLIDO_PATERNO: 'PEREZ',
      });
      // Actualización realizada hace 2 horas
      prismaMock.colegiadoActualizacion.findFirst.mockResolvedValue({
        id: 'act-prev',
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      });

      await expect(
        service.consultarPorCipYDni({ cip: '123456', dni: '45678912' }),
      ).rejects.toThrow(ForbiddenException);

      try {
        await service.consultarPorCipYDni({ cip: '123456', dni: '45678912' });
      } catch (err: any) {
        expect(err.getResponse().bloqueado).toBe(true);
        expect(err.getResponse().estadoColegiado).toBe('COOLDOWN_24H');
        expect(err.getResponse().cooldown).toBe(true);
        expect(err.getResponse().message).toContain('24 horas');
      }
    });
  });

  describe('actualizarDatos', () => {
    it('debe registrar la actualización y llamar al auditService', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue({
        COLEGIADO_ID: 101,
        NUM_COLEGIATURA: '123456',
        DNI: '45678912',
        NOMBRES: 'JUAN',
        APELLIDO_PATERNO: 'PEREZ',
        EMAIL: 'antiguo@test.com',
        TELEFONO: '900000000',
      });
      prismaMock.colegiadoActualizacion.findFirst.mockResolvedValue(null);

      const fakeRegistro = {
        id: 'act-123',
        colegiadoId: '101',
        cip: '123456',
        dni: '45678912',
        nombres: 'JUAN PEREZ',
        emailNuevo: 'nuevo@test.com',
        celularNuevo: '984123987',
        fechaNacimientoNuevo: '1990-01-15',
        sexoNuevo: 'M',
        direccionNuevo: 'Calle 1',
        createdAt: new Date(),
      };
      prismaMock.colegiadoActualizacion.create.mockResolvedValue(fakeRegistro);

      const res = await service.actualizarDatos(
        {
          cip: '123456',
          dni: '45678912',
          email: 'nuevo@test.com',
          celular: '984123987',
          fechaNacimiento: '1990-01-15',
          sexo: 'M',
          direccion: 'Calle 1',
        },
        '192.168.20.50',
        'Mozilla/5.0',
      );

      expect(res.success).toBe(true);
      expect(res.data.email).toBe('nuevo@test.com');
      expect(res.message).toContain('24 horas');
      expect(res.cooldownHoras).toBe(24);
      expect(res.avisoSeguridad).toContain('24 horas');
      expect(legacyServiceMock.actualizarDatosColegiado).toHaveBeenCalledWith(
        '123456',
        expect.objectContaining({
          email: 'nuevo@test.com',
          celular: '984123987',
          fechaNacimiento: '1990-01-15',
          sexo: 'M',
        }),
      );
      expect(prismaMock.colegiadoActualizacion.create).toHaveBeenCalled();
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          entity: 'colegiado_actualizacion',
          entityId: 'act-123',
        }),
      );
    });

    it('debe bloquear con ForbiddenException si el registro existente fue modificado hace menos de 24 horas', async () => {
      legacyServiceMock.getColegiadoByCipAndDni.mockResolvedValue({
        COLEGIADO_ID: 101,
        NUM_COLEGIATURA: '123456',
        DNI: '45678912',
        NOMBRES: 'JUAN',
        APELLIDO_PATERNO: 'PEREZ',
      });
      // Primer findFirst en consultarPorCipYDni devuelve null o fecha antigua (>24h)
      // pero el registroExistente en APP_DB tiene fecha reciente (< 24h)
      prismaMock.colegiadoActualizacion.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'act-123',
          updatedAt: new Date(Date.now() - 30 * 60 * 1000), // Hace 30 minutos
        });

      await expect(
        service.actualizarDatos({
          cip: '123456',
          dni: '45678912',
          email: 'nuevo@test.pe',
          celular: '984123987',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listarActualizaciones', () => {
    it('debe listar paginado', async () => {
      prismaMock.colegiadoActualizacion.findMany.mockResolvedValue([
        { id: 'act-1', cip: '123456', emailNuevo: 'test@cip.pe' },
      ]);
      prismaMock.colegiadoActualizacion.count.mockResolvedValue(1);

      const res = await service.listarActualizaciones({ page: 1, limit: 10 });
      expect(res.total).toBe(1);
      expect(res.data.length).toBe(1);
      expect(res.totalPages).toBe(1);
    });
  });

  describe('reenviarCorreo', () => {
    it('debe lanzar NotFoundException si el registro no existe', async () => {
      prismaMock.colegiadoActualizacion.findUnique.mockResolvedValue(null);
      await expect(service.reenviarCorreo('no-existe')).rejects.toThrow(NotFoundException);
    });

    it('debe reenviar el correo y actualizar estado a EMAIL_ENVIADO', async () => {
      prismaMock.colegiadoActualizacion.findUnique.mockResolvedValue({
        id: 'act-1',
        cip: '123456',
        dni: '44187939',
        nombres: 'JUAN PEREZ',
        emailNuevo: 'juan@cip.pe',
        celularNuevo: '984123456',
        estado: 'EMAIL_NO_ENVIADO',
      });
      legacyServiceMock.getColegiadoByNumero.mockResolvedValue({
        TIPO_ASOCIADO_COD: '1',
        FECHA_INGRESO: '2015-05-10',
        FECHA_ULTIMO_PAGO: '2024-01-01',
      });

      const res = await service.reenviarCorreo('act-1', 'user-admin', '127.0.0.1');
      expect(res.success).toBe(true);
      expect(res.estado).toBe('EMAIL_ENVIADO');
      expect(prismaMock.colegiadoActualizacion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'act-1' },
          data: { estado: 'EMAIL_ENVIADO' },
        }),
      );
    });
  });

  describe('reenviarCorreosPendientes', () => {
    it('debe procesar todos los registros con correos pendientes', async () => {
      prismaMock.colegiadoActualizacion.findMany.mockResolvedValue([
        { id: 'act-1', cip: '111', emailNuevo: 'a@cip.pe' },
        { id: 'act-2', cip: '222', emailNuevo: 'b@cip.pe' },
      ]);
      prismaMock.colegiadoActualizacion.findUnique
        .mockResolvedValueOnce({ id: 'act-1', cip: '111', emailNuevo: 'a@cip.pe', nombres: 'A' })
        .mockResolvedValueOnce({ id: 'act-2', cip: '222', emailNuevo: 'b@cip.pe', nombres: 'B' });

      const res = await service.reenviarCorreosPendientes('admin', '127.0.0.1');
      expect(res.total).toBe(2);
      expect(res.enviados).toBe(2);
      expect(res.fallidos).toBe(0);
    });
  });

  describe('seguridadPreguntasIdentidad (Intentos y Bloqueo 24 Horas)', () => {
    it('debe registrar el primer intento fallido permitiendo 1 oportunidad restante', async () => {
      prismaMock.$queryRawUnsafe = jest.fn().mockResolvedValue([]);
      prismaMock.$executeRawUnsafe = jest.fn().mockResolvedValue(1);

      const res = await service.registrarIntentoFallido('123456', '45678912', '127.0.0.1');
      expect(res.bloqueado).toBe(false);
      expect(res.intentosFallidos).toBe(1);
      expect(res.intentosRestantes).toBe(1);
      expect(res.mensaje).toContain('1 oportunidad');
    });

    it('debe bloquear por 24 horas si falla en la segunda oportunidad', async () => {
      prismaMock.$queryRawUnsafe = jest.fn().mockResolvedValue([
        { id: 'sec-1', intentos_fallidos: 1, bloqueado_hasta: null },
      ]);
      prismaMock.$executeRawUnsafe = jest.fn().mockResolvedValue(1);

      const res = await service.registrarIntentoFallido('123456', '45678912', '127.0.0.1');
      expect(res.bloqueado).toBe(true);
      expect(res.intentosFallidos).toBe(2);
      expect(res.intentosRestantes).toBe(0);
      expect(res.horasRestantes).toBe(24);
      expect(res.proximaFechaDisponible).toBeDefined();
      expect(res.mensaje).toContain('bloqueado por 24 horas');
    });

    it('debe limpiar los intentos fallidos al responder correctamente', async () => {
      prismaMock.$executeRawUnsafe = jest.fn().mockResolvedValue(1);

      const res = await service.limpiarIntentosFallidos('123456');
      expect(res.success).toBe(true);
      expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM colegiado_seguridad_bloqueos'),
        '123456',
      );
    });

    it('verificarBloqueoSeguridad debe retornar bloqueado si tiene bloqueo activo', async () => {
      const en23Horas = new Date(Date.now() + 23 * 60 * 60 * 1000);
      prismaMock.$queryRawUnsafe = jest.fn().mockResolvedValue([
        { id: 'sec-1', cip: '123456', intentos_fallidos: 2, bloqueado_hasta: en23Horas },
      ]);

      const res = await service.verificarBloqueoSeguridad('123456');
      expect(res).not.toBeNull();
      expect(res.bloqueado).toBe(true);
      expect(res.tipo).toBe('BLOQUEO_INTENTOS_24H');
      expect(res.horasRestantes).toBeGreaterThanOrEqual(22);
    });
  });
});
