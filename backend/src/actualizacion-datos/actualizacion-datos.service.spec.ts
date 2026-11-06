import { NotFoundException } from '@nestjs/common';
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
});
