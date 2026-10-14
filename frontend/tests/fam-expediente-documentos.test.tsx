import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const ctx = vi.hoisted(() => ({
  EXP_ID: '841035d3-18e7-41f2-9b4c-bd65eb3793d2',
  rol: 'ADMINISTRADOR',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: ctx.EXP_ID }),
  usePathname: () => `/dashboard/fam/expedientes/${ctx.EXP_ID}`,
}));

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: () => ({
    id: 1,
    username: ctx.rol === 'ADMINISTRADOR' ? 'admin' : 'operador1',
    rol: ctx.rol,
  }),
  logout: vi.fn(),
}));

vi.mock('@/components/common/PdfViewerModal', () => ({ default: () => null }));
vi.mock('@/components/common/ConfirmCenterMessage', () => ({
  default: () => null,
  showConfirmMessage: vi.fn(),
}));
vi.mock('@/components/fam/EditarExpedienteModal', () => ({ default: () => null }));

import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import ExpedientePage from '@/app/dashboard/fam/expedientes/[id]/page';

const PDF_BASE64 = Buffer.from('%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%EOF\n').toString('base64');

const DOCS = [
  'fichaAdmisibilidad',
  'solicitudAsignacion',
  'cartaRemision',
  'memorando',
  'ordenPago',
  'sucesionIntestada',
] as const;

const documentosIncompletos: Record<string, boolean> = {
  fichaAdmisibilidad: true,
  solicitudAsignacion: false,
  cartaRemision: false,
  memorando: false,
  ordenPago: false,
  sucesionIntestada: false,
};

const construirDetalle = (documentos: Record<string, boolean> = documentosIncompletos) => ({
  id: ctx.EXP_ID,
  colegiadoId: 'C-7148',
  NUM_COLEGIATURA: '62799',
  DNI: '71480001',
  NOMBRE_COLEGIADO: 'COLEGIADO DE PRUEBA',
  ESTADO_COLEGIADO: 'HABILITADO',
  FECHA_ULTIMO_PAGO: null,
  tipoBeneficio: { id: 'TB-FAM-003', codigo: 'ENF_TERMINAL', nombre: 'Enfermedad Terminal' },
  monto: 2000,
  moneda: 'PEN',
  estado: 'PAGADA',
  fechaSolicitud: '2026-01-01T00:00:00.000Z',
  fechaPago: '2026-01-05T00:00:00.000Z',
  documentacionCompleta: false,
  documentacionObservacion: null,
  solicitanteNombre: 'TEST',
  solicitanteDni: '12345678',
  expedienteNumero: 'EXP-2026-001',
  cartaNumero: null,
  cartaFecha: null,
  memorandoNumero: null,
  memorandoFecha: null,
  formaPago: null,
  banco: null,
  ordenPagoFecha: null,
  observaciones: null,
  descuentoCovid: 0,
  montoFinal: 2000,
  modalidadBeneficio: null,
  documentosDisponibles: documentos,
  beneficiariosVinculados: [],
  covidMontoTotal: 0,
  tieneFallecimiento: false,
  historialBeneficios: [
    {
      id: ctx.EXP_ID,
      tipo: 'ENF_TERMINAL',
      tipoNombre: 'Enfermedad Terminal',
      monto: 2000,
      descuentoCovid: 0,
      montoFinal: 2000,
      fecha: '2026-01-01T00:00:00.000Z',
      fechaPago: '2026-01-05T00:00:00.000Z',
      expediente: 'EXP-2026-001',
      solicitanteNombre: 'TEST',
      solicitanteDni: '12345678',
      estado: 'PAGADA',
      esActual: true,
    },
  ],
});

const apiGet = vi.mocked(api.get);
const apiPut = vi.mocked(api.put);

const preparar = (detalle = construirDetalle()) => {
  apiGet.mockImplementation((url: any): any => {
    if (String(url).startsWith(`/fam-beneficios/${ctx.EXP_ID}/documento/`)) {
      return Promise.resolve({ data: { contenido: PDF_BASE64 } });
    }
    if (url === `/fam-beneficios/${ctx.EXP_ID}`) {
      return Promise.resolve({ data: detalle });
    }
    return Promise.resolve({ data: [] });
  });
  apiPut.mockResolvedValue({ data: {} } as any);
  return detalle;
};

const renderDocumentos = async () => {
  const utils = render(<ExpedientePage />);
  const tabDocumentos = await screen.findByRole('button', { name: 'Documentos' });
  fireEvent.click(tabDocumentos);
  await screen.findByText('Ficha de Admisibilidad');
  return utils;
};

const iniciarSubida = (container: HTMLElement, etiquetaDocumento: string) => {
  const fila = screen
    .getByText(etiquetaDocumento)
    .closest('div.flex.items-center.justify-between') as HTMLElement;
  const boton = within(fila).getByRole('button', { name: /^(Subir PDF|Reemplazar)$/ });
  fireEvent.click(boton);
  return container.querySelector('input[type="file"]') as HTMLInputElement;
};

beforeEach(() => {
  ctx.rol = 'ADMINISTRADOR';
});

describe('Documentos - control de subida por rol', () => {
  it('ADMINISTRADOR ve "Subir PDF" en los pendientes y "Reemplazar" en los subidos', async () => {
    preparar();
    await renderDocumentos();

    expect(screen.getAllByText('Reemplazar')).toHaveLength(1);
    expect(screen.getAllByText('Subir PDF')).toHaveLength(DOCS.length - 1);
    expect(screen.getAllByText('Ver PDF')).toHaveLength(1);
    expect(screen.getByText(/Como ADMINISTRADOR puede subir/)).not.toBeNull();
    expect(screen.queryByText('No cargado')).toBeNull();
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('OPERADOR_PAGOS no ve ninguna opcion de subida y solo puede ver', async () => {
    ctx.rol = 'OPERADOR_PAGOS';
    preparar();
    await renderDocumentos();

    expect(screen.queryByText('Subir PDF')).toBeNull();
    expect(screen.queryByText('Reemplazar')).toBeNull();
    expect(screen.getAllByText('No cargado')).toHaveLength(DOCS.length - 1);
    expect(screen.getByText('Ver PDF')).not.toBeNull();
    expect(screen.getByText('Solo el ADMINISTRADOR puede subir documentos.')).not.toBeNull();
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('AUDITOR tampoco puede subir documentos', async () => {
    ctx.rol = 'AUDITOR';
    preparar();
    await renderDocumentos();

    expect(screen.queryByText('Subir PDF')).toBeNull();
    expect(screen.queryByText('Reemplazar')).toBeNull();
    expect(screen.getByText('Solo el ADMINISTRADOR puede subir documentos.')).not.toBeNull();
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('el rol sin permiso no dispara ninguna escritura al backend', async () => {
    ctx.rol = 'OPERADOR_PAGOS';
    preparar();
    await renderDocumentos();

    expect(screen.queryByRole('button', { name: 'Subir PDF' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reemplazar' })).toBeNull();
    expect(apiPut).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });
});

describe('Documentos - subida real', () => {
  it('ADMINISTRADOR sube un documento y envia solo ese campo en el PUT', async () => {
    preparar();
    const { container } = await renderDocumentos();

    const input = iniciarSubida(container, 'Memorándum');
    expect(input).not.toBeNull();
    expect(input.accept).toContain('application/pdf');

    fireEvent.change(input, {
      target: { files: [new File(['%PDF-1.4 memorando'], 'memorando.pdf', { type: 'application/pdf' })] },
    });

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));

    const [url, body] = apiPut.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe(`/fam-beneficios/${ctx.EXP_ID}`);
    expect(typeof body.memorando).toBe('string');
    expect(String(body.memorando)).toMatch(/^JVBERi/);
    expect(body).not.toHaveProperty('documentacionCompleta');
    for (const campo of DOCS) {
      if (campo === 'memorando') continue;
      expect(body).not.toHaveProperty(campo);
    }
    expect(showConfirmMessage).toHaveBeenCalledWith(
      'success',
      'Memorándum subido correctamente',
      'EXP-2026-001',
    );
  });

  it('marca documentacionCompleta=true cuando el documento completaba el nucleo', async () => {
    preparar(
      construirDetalle({
        fichaAdmisibilidad: true,
        solicitudAsignacion: true,
        cartaRemision: true,
        memorando: false,
        ordenPago: true,
        sucesionIntestada: false,
      }),
    );
    const { container } = await renderDocumentos();

    const input = iniciarSubida(container, 'Memorándum');
    fireEvent.change(input, {
      target: { files: [new File(['%PDF-1.4 memorando'], 'memorando.pdf', { type: 'application/pdf' })] },
    });

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
    const body = apiPut.mock.calls[0][1] as Record<string, unknown>;
    expect(body.documentacionCompleta).toBe(true);
    expect(body.memorando).toMatch(/^JVBERi/);
  });

  it('rechaza archivos que no son PDF sin llamar al backend', async () => {
    preparar();
    const { container } = await renderDocumentos();

    const input = iniciarSubida(container, 'Memorándum');
    fireEvent.change(input, {
      target: { files: [new File(['no soy pdf'], 'nota.txt', { type: 'text/plain' })] },
    });

    await waitFor(() => expect(showConfirmMessage).toHaveBeenCalledTimes(1));
    expect(vi.mocked(showConfirmMessage).mock.calls[0][0]).toBe('error');
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('no escribe en el backend hasta que se elige un archivo', async () => {
    preparar();
    const { container } = await renderDocumentos();

    iniciarSubida(container, 'Memorándum');

    await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull());
    expect(apiPut).not.toHaveBeenCalled();
  });
});

describe('Documentos - lectura', () => {
  it('cualquier rol puede ver el PDF subido', async () => {
    ctx.rol = 'OPERADOR_PAGOS';
    preparar();
    await renderDocumentos();

    fireEvent.click(screen.getByText('Ver PDF'));

    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        `/fam-beneficios/${ctx.EXP_ID}/documento/fichaAdmisibilidad`,
      ),
    );
    expect(apiPut).not.toHaveBeenCalled();
  });
});
