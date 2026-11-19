import { FamBeneficiosService } from './fam-beneficios.service';
import { ExpedienteSlaService } from '../expediente-sla/expediente-sla.service';

describe('Pruebas de Trazabilidad, Transiciones y Panel de Alertas (Regresión Rigurosa)', () => {
  let prismaMock: any;
  let auditServiceMock: any;
  let famServiceMock: any;
  let famBeneficiosService: FamBeneficiosService;
  let expedienteSlaService: ExpedienteSlaService;

  beforeEach(() => {
    prismaMock = {
      famSolicitudBeneficio: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      famSolicitudBeneficiario: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      famDepositoBeneficiario: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      famBeneficiario: {
        findUnique: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
      },
      usuario: {
        findMany: jest.fn(),
      },
      tipoBeneficio: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      expedienteSlaConfig: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    famServiceMock = {
      buscarColegiadosPorIds: jest.fn().mockResolvedValue(new Map()),
      obtenerColegiadosPorIds: jest.fn().mockResolvedValue(new Map()),
    };

    famBeneficiosService = new FamBeneficiosService(
      prismaMock as any,
      auditServiceMock as any,
      famServiceMock as any,
    );

    expedienteSlaService = new ExpedienteSlaService(
      prismaMock as any,
      famServiceMock as any,
    );
  });

  describe('1. Trazabilidad detallada en obtenerHistorial()', () => {
    it('debe reconstruir cada transición con estado anterior, nuevo, marca de tiempo exacta, usuario responsable y observaciones', async () => {
      const expId = 'exp-trazabilidad-123';
      const mockExpediente = {
        id: expId,
        colegiadoId: 'COL-001',
        tipoBeneficioId: 'TB-01',
        tipoBeneficio: { id: 'TB-01', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
        monto: 3000,
        montoFinal: 3000,
        estado: 'EN_REVISION',
        createdAt: new Date('2026-11-10T10:00:00Z'),
        fechaSolicitud: new Date('2026-11-10T10:00:00Z'),
        fechaPago: null,
        expedienteNumero: 'EXP-2026-001',
        documentacionCompleta: false,
        documentacionObservacion: 'Falta carta de remisión',
        fichaAdmisibilidad: 'PDF_FICHA',
        solicitudAsignacion: 'PDF_SOLICITUD',
        cartaRemision: null,
        memorando: null,
        ordenPago: null,
        cartaPoder: null,
        sucesionIntestada: null,
        declaracionJurada: null,
        actaDefuncion: null,
        otrosDocumentos: null,
        beneficiarios: [],
        depositos: [],
      };

      prismaMock.famSolicitudBeneficio.findUnique.mockResolvedValue(mockExpediente);

      // Simulamos logs de auditoría para el historial
      const mockAuditLogs = [
        {
          id: 'audit-1',
          action: 'CREATE',
          entity: 'fam_solicitudes_beneficio',
          entityId: expId,
          userId: 'usr-admin-1',
          createdAt: new Date('2026-11-10T10:00:00.123Z'),
          changes: {
            estado: { old: null, new: 'PENDIENTE' },
          },
        },
        {
          id: 'audit-2',
          action: 'UPDATE_ESTADO',
          entity: 'fam_solicitudes_beneficio',
          entityId: expId,
          userId: 'usr-operador-2',
          createdAt: new Date('2026-11-12T15:30:45.678Z'),
          changes: {
            transicion: {
              old: { estado: 'PENDIENTE', estadoAnterior: null },
              new: {
                estado: 'EN_REVISION',
                estadoNuevo: 'EN_REVISION',
                marcaTiempoExacta: '2026-11-12T15:30:45.678Z',
                usuarioId: 'usr-operador-2',
                observaciones: 'Expediente revisado por mesa de partes, derivado a asesoría legal.',
              },
            },
          },
        },
      ];

      prismaMock.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      // Mock de usuarios para resolver los nombres
      prismaMock.usuario.findMany.mockResolvedValue([
        { id: 'usr-admin-1', nombreCompleto: 'Ing. Carlos Mendoza', username: 'cmendoza' },
        { id: 'usr-operador-2', nombreCompleto: 'Lic. Ana Quispe', username: 'aquispe' },
      ]);

      const historial = await famBeneficiosService.obtenerHistorial(expId);

      // Verificaciones estrictas
      expect(historial).toBeDefined();
      expect(historial.expediente.id).toBe(expId);
      expect(historial.transiciones).toHaveLength(2);

      // Primera transición (Registro Inicial)
      const t1 = historial.transiciones![0];
      expect(t1.estadoAnterior).toBeNull();
      expect(t1.estadoNuevo).toBe('PENDIENTE');
      expect(t1.usuarioResponsable).toBe('Ing. Carlos Mendoza');
      expect(t1.marcaTiempoExacta).toBe('2026-11-10T10:00:00.123Z');
      expect(t1.documentosAsociados).toBeDefined();
      expect(t1.documentosAsociados.some((d) => d.campo === 'solicitudAsignacion')).toBe(true);

      // Segunda transición (Pase a EN_REVISION con observaciones)
      const t2 = historial.transiciones![1];
      expect(t2.estadoAnterior).toBe('PENDIENTE');
      expect(t2.estadoNuevo).toBe('EN_REVISION');
      expect(t2.usuarioResponsable).toBe('Lic. Ana Quispe');
      expect(t2.marcaTiempoExacta).toBe('2026-11-12T15:30:45.678Z');
      expect(t2.observaciones).toBe('Expediente revisado por mesa de partes, derivado a asesoría legal.');
      expect(t2.documentosAsociados.some((d) => d.campo === 'cartaRemision')).toBe(true);

      // Verificación de documentos asociados en cada etapa
      expect(historial.etapas).toBeDefined();
      const etapaRevision = historial.etapas.find((e) => e.key === 'revision');
      expect(etapaRevision).toBeDefined();
      expect(etapaRevision?.documentosAsociados).toBeDefined();
      expect(etapaRevision?.documentosAsociados?.length).toBeGreaterThan(0);
    });
  });

  describe('2. Auditoría rigurosa al cambiar de estado en actualizar()', () => {
    it('debe registrar la transición con old y new, timestamp exacto, usuario y observaciones en AuditService', async () => {
      const expId = 'exp-update-456';
      const mockExpediente = {
        id: expId,
        colegiadoId: 'COL-002',
        tipoBeneficioId: 'TB-01',
        tipoBeneficio: { id: 'TB-01', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
        monto: 3000,
        estado: 'PENDIENTE',
        estadoAnterior: null,
        observaciones: 'Observación inicial',
      };

      prismaMock.famSolicitudBeneficio.findUnique.mockResolvedValue(mockExpediente);
      prismaMock.tipoBeneficio.findUnique.mockResolvedValue(mockExpediente.tipoBeneficio);
      prismaMock.famSolicitudBeneficio.update.mockResolvedValue({
        ...mockExpediente,
        estado: 'APROBADA',
        observaciones: 'Aprobado en sesión de consejo departamental.',
      });

      await famBeneficiosService.actualizar(
        expId,
        {
          estado: 'APROBADA',
          observaciones: 'Aprobado en sesión de consejo departamental.',
        } as any,
        'ADMINISTRADOR',
        'usr-aprobador-99',
        '192.168.20.100',
      );

      // Verificamos que se haya invocado a auditService.log
      expect(auditServiceMock.log).toHaveBeenCalled();
      const logCall = auditServiceMock.log.mock.calls[0][0];

      expect(logCall.userId).toBe('usr-aprobador-99');
      expect(logCall.action).toBe('UPDATE');
      expect(logCall.entity).toBe('fam_registro');
      expect(logCall.entityId).toBe(expId);
      expect(logCall.ipAddress).toBe('192.168.20.100');

      // Verificamos la estructura de cambios de la transición
      expect(logCall.changes).toHaveProperty('transicion');
      const transicionAudit = logCall.changes.transicion;
      expect(transicionAudit.old.estado).toBe('PENDIENTE');
      expect(transicionAudit.new.estadoNuevo).toBe('APROBADA');
      expect(transicionAudit.new.usuarioId).toBe('usr-aprobador-99');
      expect(transicionAudit.new.observaciones).toBe('Aprobado en sesión de consejo departamental.');
      expect(transicionAudit.new.marcaTiempoExacta).toBeDefined();
    });
  });

  describe('3. Panel de Alertas para Pendientes en ExpedienteSlaService', () => {
    it('debe clasificar correctamente vencidos, próximos a vencer, docs incompletos y saldos pendientes', async () => {
      const ahora = new Date();
      const hace5Dias = new Date(ahora.getTime() - 5 * 24 * 3600 * 1000);
      const hace10Horas = new Date(ahora.getTime() - 10 * 3600 * 1000);

      const mockExpedientes = [
        // 1. Vencido (hace 5 días en PENDIENTE con SLA de 72h)
        {
          id: 'exp-vencido-1',
          colegiadoId: 'C-01',
          tipoBeneficioId: 'TB-01',
          tipoBeneficio: { codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
          monto: 3000,
          montoFinal: 3000,
          estado: 'PENDIENTE',
          createdAt: hace5Dias,
          fechaSolicitud: hace5Dias,
          documentacionCompleta: true,
          documentacionObservacion: null,
          tieneSaldoPendiente: false,
          saldoPendiente: 0,
          expedienteNumero: 'EXP-VENCIDO-01',
          depositos: [],
        },
        // 2. Próximo a vencer (en PENDIENTE hace 65 horas con SLA de 72h -> restan 7 horas)
        {
          id: 'exp-porvencer-2',
          colegiadoId: 'C-02',
          tipoBeneficioId: 'TB-01',
          tipoBeneficio: { codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
          monto: 3000,
          montoFinal: 3000,
          estado: 'PENDIENTE',
          createdAt: new Date(ahora.getTime() - 65 * 3600 * 1000),
          fechaSolicitud: new Date(ahora.getTime() - 65 * 3600 * 1000),
          documentacionCompleta: true,
          documentacionObservacion: null,
          tieneSaldoPendiente: false,
          saldoPendiente: 0,
          expedienteNumero: 'EXP-PORVENCER-02',
          depositos: [],
        },
        // 3. Documentación Incompleta
        {
          id: 'exp-docsincompletos-3',
          colegiadoId: 'C-03',
          tipoBeneficioId: 'TB-01',
          tipoBeneficio: { codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
          monto: 3000,
          montoFinal: 3000,
          estado: 'PENDIENTE',
          createdAt: hace10Horas,
          fechaSolicitud: hace10Horas,
          documentacionCompleta: false,
          documentacionObservacion: 'Falta presentar sucesión intestada y DNI del apoderado',
          tieneSaldoPendiente: false,
          saldoPendiente: 0,
          expedienteNumero: 'EXP-DOCS-03',
          depositos: [],
        },
        // 4. Saldo Pendiente de Liquidar
        {
          id: 'exp-saldopendiente-4',
          colegiadoId: 'C-04',
          tipoBeneficioId: 'TB-01',
          tipoBeneficio: { codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
          monto: 3000,
          montoFinal: 3000,
          estado: 'APROBADA',
          createdAt: hace10Horas,
          fechaSolicitud: hace10Horas,
          documentacionCompleta: true,
          documentacionObservacion: null,
          tieneSaldoPendiente: true,
          saldoPendiente: 850.50,
          expedienteNumero: 'EXP-SALDO-04',
          depositos: [{ monto: 2149.50 }],
        },
      ];

      // Mocks de conteos y listas para getResumenDashboard
      prismaMock.famSolicitudBeneficio.count.mockResolvedValue(4);
      prismaMock.famSolicitudBeneficio.groupBy.mockResolvedValue([
        { estado: 'PENDIENTE', _count: 3 },
        { estado: 'APROBADA', _count: 1 },
      ]);
      prismaMock.famSolicitudBeneficio.aggregate.mockResolvedValue({
        _sum: { saldoPendiente: 850.50 },
      });

      // Mocks para las llamadas findMany de getResumenDashboard
      prismaMock.famSolicitudBeneficio.findMany.mockImplementation((args: any) => {
        if (args?.where?.tieneSaldoPendiente) {
          return [mockExpedientes[3]];
        }
        if (args?.where?.documentacionCompleta === false) {
          return [mockExpedientes[2]];
        }
        if (args?.where?.estado?.in) {
          return [mockExpedientes[0], mockExpedientes[1]];
        }
        if (args?.where?.estado === 'PAGADA') {
          return [];
        }
        return mockExpedientes;
      });

      prismaMock.expedienteSlaConfig.findMany.mockResolvedValue([
        { estado: 'PENDIENTE', horasLimite: 72, activo: true },
        { estado: 'EN_REVISION', horasLimite: 48, activo: true },
        { estado: 'APROBADA', horasLimite: 48, activo: true },
      ]);

      prismaMock.tipoBeneficio.findMany.mockResolvedValue([
        { id: 'TB-01', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
      ]);

      const dashboard = await expedienteSlaService.getResumenDashboard('usr-1', 'ADMINISTRADOR');

      expect(dashboard).toBeDefined();
      expect(dashboard.alertasPendientes).toBeDefined();

      const { alertasPendientes } = dashboard;
      expect(alertasPendientes.vencidosCount).toBeGreaterThanOrEqual(1);
      expect(alertasPendientes.porVencerCount).toBeGreaterThanOrEqual(1);
      expect(alertasPendientes.docsIncompletosCount).toBeGreaterThanOrEqual(1);
      expect(alertasPendientes.saldoPendienteCount).toBeGreaterThanOrEqual(1);
      expect(alertasPendientes.totalAlertas).toBe(
        alertasPendientes.vencidosCount +
        alertasPendientes.porVencerCount +
        alertasPendientes.docsIncompletosCount +
        alertasPendientes.saldoPendienteCount,
      );

      // Verificamos que el item con docs incompletos tenga su observación
      const docIncompleto = alertasPendientes.docsIncompletos.find((d: any) => d.id === 'exp-docsincompletos-3');
      expect(docIncompleto).toBeDefined();
      expect(docIncompleto.documentacionObservacion).toBe('Falta presentar sucesión intestada y DNI del apoderado');

      // Verificamos que el item con saldo pendiente tenga el monto faltante
      const saldoPendienteItem = alertasPendientes.saldoPendiente.find((s: any) => s.id === 'exp-saldopendiente-4');
      expect(saldoPendienteItem).toBeDefined();
      expect(saldoPendienteItem.saldoPendiente).toBe(850.50);
    });
  });

  describe('4. Finalización de proceso y actualización de monto recibido al subir orden de pago, memorando y carta', () => {
    it('al subir la orden de pago teniendo memorando y carta, el proceso se finaliza a PAGADA y actualiza el importe recibido', async () => {
      const expId = 'exp-finalizar-789';
      const mockExpediente = {
        id: expId,
        colegiadoId: 'COL-009',
        tipoBeneficioId: 'TB-01',
        tipoBeneficio: { id: 'TB-01', codigo: 'FALLECIMIENTO', nombre: 'Fallecimiento' },
        monto: 3000,
        montoFinal: 2500, // Descuento aplicado
        estado: 'EN_REVISION',
        fechaSolicitud: new Date('2026-11-01T10:00:00Z'),
        fechaPago: null,
        expedienteNumero: 'EXP-2026-789',
        documentacionCompleta: false,
        memorando: 'PDF_MEMORANDO',
        cartaRemision: 'PDF_CARTA',
        ordenPago: null,
        beneficiarios: [{ beneficiarioId: 'ben-1', ordenPago: null }],
        vinculos: [{ beneficiarioId: 'ben-1', ordenPago: null, beneficiario: { nombre: 'María Pérez' } }],
        depositos: [],
      };

      prismaMock.famSolicitudBeneficio.findUnique.mockResolvedValue(mockExpediente);
      prismaMock.famSolicitudBeneficio.update.mockResolvedValue({
        ...mockExpediente,
        ordenPago: 'PDF_ORDEN_PAGO',
        estado: 'PAGADA',
        fechaPago: new Date(),
        documentacionCompleta: true,
      });
      prismaMock.famSolicitudBeneficiario.updateMany = jest.fn().mockResolvedValue({ count: 1 });

      const resultado = await famBeneficiosService.subirDocumentoHistorial(
        expId,
        'ordenPago',
        'PDF_ORDEN_PAGO',
        'usr-operador-1',
        'ADMINISTRADOR',
        '192.168.20.125',
      );

      expect(resultado).toBeDefined();
      expect(resultado.cargado).toBe(true);

      // Verificamos que se actualizó a PAGADA
      expect(prismaMock.famSolicitudBeneficio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: expId },
          data: expect.objectContaining({
            estado: 'PAGADA',
            documentacionCompleta: true,
          }),
        }),
      );

      // Verificamos que se sincronizó la orden de pago a los beneficiarios
      expect(prismaMock.famSolicitudBeneficiario.updateMany).toHaveBeenCalledWith({
        where: { solicitudId: expId, ordenPago: null },
        data: { ordenPago: 'PDF_ORDEN_PAGO' },
      });
    });
  });
});
