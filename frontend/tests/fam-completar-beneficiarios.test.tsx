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
import CompletarBeneficiariosModal from '@/components/fam/CompletarBeneficiariosModal';

const mockGet = vi.mocked(api.get);

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({
    data: [
      {
        ORIGEN: 'SISTEMA',
        FAM_ID: 'B1',
        NOMBRE_BENEFICIARIO: 'Ana Uno',
        DNI: '11111111',
        PARENTESCO: 'Hija',
        PORCENTAJE: 0,
      },
      {
        ORIGEN: 'SISTEMA',
        FAM_ID: 'B2',
        NOMBRE_BENEFICIARIO: 'Luis Dos',
        DNI: '22222222',
        PARENTESCO: 'Hijo',
        PORCENTAJE: 0,
      },
    ],
  } as any);
});

describe('CompletarBeneficiariosModal', () => {
  it('selecciona todos, reparte 100% y abre la documentación individual', async () => {
    const { container } = render(
      <CompletarBeneficiariosModal
        isOpen
        onClose={vi.fn()}
        onSaved={vi.fn()}
        expedienteId="exp-1"
        colegiadoId="C-1"
        pagada={false}
        isAdmin
        modalidad="monto_compartido"
        vinculados={[]}
      />,
    );

    await screen.findByText('Ana Uno');
    expect(screen.queryByText('Orden de pago')).toBeNull();

    fireEvent.click(screen.getByLabelText('Seleccionar todos'));

    await waitFor(() => {
      const porcentajes = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="number"]'),
      ).map((input) => input.value);
      expect(porcentajes).toEqual(['50', '50']);
    });

    expect(screen.getAllByText('Declaración jurada')).toHaveLength(2);
    expect(screen.getAllByText('Orden de pago')).toHaveLength(2);
    expect(screen.getByText('2 de 2 seleccionados')).not.toBeNull();
  });
});
