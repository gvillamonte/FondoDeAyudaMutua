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

vi.mock('@/components/common/ConfirmCenterMessage', () => ({
  default: () => null,
  showConfirmMessage: vi.fn(),
}));

import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import EliminarExpedienteModal from '@/components/fam/EliminarExpedienteModal';

const montarModal = (props: Partial<React.ComponentProps<typeof EliminarExpedienteModal>> = {}) => {
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  render(
    <EliminarExpedienteModal
      isOpen
      onClose={onClose}
      expedienteId="exp-1"
      expedienteNumero="EXP-2026-0001"
      estado="PENDIENTE"
      onDeleted={onDeleted}
      {...props}
    />,
  );
  return { onClose, onDeleted };
};

describe('EliminarExpedienteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no elimina si la confirmacion no coincide', async () => {
    montarModal();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'eliminar mal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => {
      expect(api.delete).not.toHaveBeenCalled();
    });
  });

  it('elimina el expediente al escribir ELIMINAR', async () => {
    const { onClose, onDeleted } = montarModal();
    (api.delete as any).mockResolvedValue({ data: { success: true } });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ELIMINAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/fam-beneficios/exp-1');
      expect(onClose).toHaveBeenCalled();
      expect(onDeleted).toHaveBeenCalled();
      expect(showConfirmMessage).toHaveBeenCalledWith(
        'success',
        'Expediente eliminado',
        expect.stringContaining('documentos y depósitos'),
      );
    });
  });

  it('acepta el numero de expediente como confirmacion', async () => {
    montarModal();
    (api.delete as any).mockResolvedValue({ data: { success: true } });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'EXP-2026-0001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/fam-beneficios/exp-1');
    });
  });

  it('advierte cuando el expediente esta PAGADA', () => {
    montarModal({ estado: 'PAGADA' });
    expect(screen.getByText('El expediente está PAGADA.')).toBeTruthy();
  });
});
