'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

interface EliminarExpedienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  expedienteId: string;
  expedienteNumero?: string | null;
  estado?: string | null;
  onDeleted?: () => void;
}

export default function EliminarExpedienteModal({
  isOpen,
  onClose,
  expedienteId,
  expedienteNumero,
  estado,
  onDeleted,
}: EliminarExpedienteModalProps) {
  const [confirmacion, setConfirmacion] = useState('');
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmacion('');
      setEliminando(false);
    }
  }, [isOpen, expedienteId]);

  const textoEsperado = expedienteNumero?.trim() || 'ELIMINAR';
  const confirmacionValida =
    confirmacion.trim().toUpperCase() === 'ELIMINAR' ||
    (!!expedienteNumero && confirmacion.trim() === expedienteNumero.trim());

  const eliminar = async () => {
    if (!confirmacionValida || eliminando) return;
    setEliminando(true);
    try {
      await api.delete(`/fam-beneficios/${expedienteId}`);
      showConfirmMessage(
        'success',
        'Expediente eliminado',
        'Se eliminaron el expediente, sus documentos y depósitos.',
      );
      onClose();
      onDeleted?.();
    } catch (err: any) {
      const mensaje =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'No se pudo eliminar el expediente.';
      showConfirmMessage('error', 'Error al eliminar', mensaje);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Eliminar expediente"
      onConfirm={eliminar}
      confirmText="Eliminar definitivamente"
      confirmVariant="danger"
      loading={eliminando}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[#DC2626] bg-red-50 p-3">
          <p className="text-sm font-semibold text-[#DC2626]">
            Esta acción es irreversible.
          </p>
          <p className="mt-1 text-sm text-[#1E293B]">
            Se eliminarán el expediente{expedienteNumero ? ` ${expedienteNumero}` : ''}, su
            documentación, los vínculos de beneficiarios y los depósitos/comprobantes asociados.
          </p>
        </div>

        {estado === 'PAGADA' && (
          <div className="rounded-lg border border-[#D97706] bg-amber-50 p-3">
            <p className="text-sm font-semibold text-[#D97706]">
              El expediente está PAGADA.
            </p>
            <p className="mt-1 text-sm text-[#1E293B]">
              Se eliminarán también sus depósitos y comprobantes. El registro quedará en auditoría.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-[#1E293B]">
            Escribe <span className="font-semibold">ELIMINAR</span>
            {expedienteNumero ? ` o el N° de expediente (${expedienteNumero})` : ''} para confirmar:
          </label>
          <input
            type="text"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            className="input"
            placeholder={textoEsperado}
            autoComplete="off"
          />
        </div>
      </div>
    </Modal>
  );
}
