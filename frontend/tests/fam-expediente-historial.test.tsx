import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock('@/components/common/PdfViewerModal', () => ({ default: () => null }));
vi.mock('@/components/common/ConfirmCenterMessage', () => ({
  default: () => null,
  showConfirmMessage: vi.fn(),
}));

import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import HistorialExpediente from '@/components/fam/HistorialExpediente';

const EXP_ID = 'exp-historial-1';
const PDF_BASE64 = Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64');

const historial = (overrides: Record<string, any> = {}) => ({
  expediente: {
    id: EXP_ID,
    estado: 'PENDIENTE',
    tipoBeneficio: 'Fallecimiento',
    tipoBeneficioCodigo: 'FALLECIMIENTO',
    monto: 3000,
    montoFinal: null,
    fechaSolicitud: '2026-01-10T00:00:00.000Z',
    fechaPago: null,
    expedienteNumero: 'EXP-2026-010',
    documentacionCompleta: false,
    documentacionObservacion: 'Falta memorando',
  },
  etapas: [
    { key: 'registro', nombre: 'Registro', estado: 'completado', fecha: '2026-01-10T00:00:00.000Z', detalle: 'Fallecimiento' },
    { key: 'documentos', nombre: 'Documentos', estado: 'actual', fecha: null, detalle: 'Falta memorando' },
    { key: 'revision', nombre: 'Revisión', estado: 'pendiente', fecha: null, detalle: 'Pendiente de completar documentos' },
    { key: 'aprobado', nombre: 'Aprobado', estado: 'pendiente', fecha: null, detalle: 'Pendiente de revisión' },
    { key: 'pagado', nombre: 'Pagado', estado: 'pendiente', fecha: null, detalle: 'Pendiente de pago' },
  ],
  siguientePaso: {
    etapa: 'documentos',
    titulo: 'Completar documentación',
    descripcion: 'Falta memorando',
    accion: { tipo: 'SUBIR', etiqueta: 'Subir Memorando', documentoId: 'exp:memorando' },
  },
  documentos: [
    {
      id: 'exp:fichaAdmisibilidad',
      grupo: 'Expediente',
      nombre: 'Ficha de admisibilidad',
      campo: 'fichaAdmisibilidad',
      tipo: 'expediente',
      cargado: true,
      fechaCarga: '2026-01-11T00:00:00.000Z',
      puedeSubir: true,
    },
    {
      id: 'exp:memorando',
      grupo: 'Expediente',
      nombre: 'Memorando',
      campo: 'memorando',
      tipo: 'expediente',
      cargado: false,
      fechaCarga: null,
      puedeSubir: true,
    },
  ],
  beneficiarios: [
    {
      id: 'B1',
      nombre: 'Ana Pérez',
      dni: '11111111',
      parentesco: 'Hija',
      porcentaje: 50,
      tieneDeclaracionJurada: true,
      declaracionJuradaDni: '12345678',
      tieneOrdenPago: true,
    },
    {
      id: 'B2',
      nombre: 'Luis Pérez',
      dni: '22222222',
      parentesco: 'Hijo',
      porcentaje: 50,
      tieneDeclaracionJurada: false,
      declaracionJuradaDni: null,
      tieneOrdenPago: false,
    },
  ],
  resumen: { documentosCargados: 1, documentosPendientes: 1, beneficiarios: 2, depositos: 0 },
  actividad: [
    {
      id: 'log-1',
      fecha: '2026-01-10T00:00:00.000Z',
      usuario: 'Admin',
      tipo: 'registro',
      titulo: 'Expediente registrado',
      detalle: 'Estado inicial: PENDIENTE',
    },
  ],
  permisos: { puedeSubirDocumentos: true },
  ...overrides,
});

const mockGet = vi.mocked(api.get);
const mockPut = vi.mocked(api.put);

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
  mockGet.mockResolvedValue({ data: historial() } as any);
  mockPut.mockResolvedValue({ data: {} } as any);
});

describe('HistorialExpediente', () => {
  it('muestra las 5 etapas, el siguiente paso y los documentos reales', async () => {
    render(<HistorialExpediente expedienteId={EXP_ID} />);

    expect(await screen.findByText('Estado del expediente')).not.toBeNull();
    expect(screen.getByText('Registro')).not.toBeNull();
    expect(screen.getAllByText('Documentos').length).toBeGreaterThan(0);
    expect(screen.getByText('Revisión')).not.toBeNull();
    expect(screen.getByText('Aprobado')).not.toBeNull();
    expect(screen.getByText('Pagado')).not.toBeNull();
    expect(screen.getByText('Completar documentación')).not.toBeNull();
    expect(screen.getAllByText('Falta memorando').length).toBeGreaterThan(0);
    expect(screen.getByText('Ficha de admisibilidad')).not.toBeNull();
    expect(screen.getByText('Expediente registrado')).not.toBeNull();
    expect(mockGet).toHaveBeenCalledWith(`/fam-beneficios/${EXP_ID}/historial`);
  });

  it('muestra los dos beneficiarios vinculados y su reparto', async () => {
    render(<HistorialExpediente expedienteId={EXP_ID} />);

    await screen.findByText('Estado del expediente');
    expect(screen.getByText('Ana Pérez')).not.toBeNull();
    expect(screen.getByText('Luis Pérez')).not.toBeNull();
    expect(screen.getByText('2 beneficiarios')).not.toBeNull();
    expect(screen.getByText('DJ cargada')).not.toBeNull();
    expect(screen.getByText('Orden de pago pendiente')).not.toBeNull();
  });

  it('sube un documento del expediente desde el historial y recarga', async () => {
    const { container } = render(<HistorialExpediente expedienteId={EXP_ID} />);
    await screen.findByText('Estado del expediente');

    fireEvent.click(screen.getByRole('button', { name: 'Subir Memorando' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, {
      target: { files: [new File(['%PDF-1.4 memorando'], 'memorando.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subir documento' }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        `/fam-beneficios/${EXP_ID}/historial/documento/memorando`,
        expect.objectContaining({ contenido: expect.any(String) }),
      );
    });
    expect(showConfirmMessage).toHaveBeenCalledWith('success', 'Documento cargado', 'Memorando');
  });

  it('oculta acciones de subida cuando el usuario no tiene permiso', async () => {
    mockGet.mockResolvedValue({
      data: historial({
        siguientePaso: {
          etapa: 'revision',
          titulo: 'Revisar documentación',
          descripcion: 'La documentación está marcada como completa.',
          accion: null,
        },
        documentos: historial().documentos.map((d: any) => ({ ...d, puedeSubir: false })),
        permisos: { puedeSubirDocumentos: false },
      }),
    } as any);

    render(<HistorialExpediente expedienteId={EXP_ID} />);
    await screen.findByText('Estado del expediente');

    expect(screen.queryByRole('button', { name: /^Subir$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reemplazar' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Subir Memorando/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver' })).not.toBeNull();
  });
});
