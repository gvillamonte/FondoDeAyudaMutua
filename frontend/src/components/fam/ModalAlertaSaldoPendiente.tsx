'use client';

import Modal from '@/components/ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  montoTotalAsignado: number;
  montoMinimo: number;
  saldoPendiente: number;
  guardando?: boolean;
}

export default function ModalAlertaSaldoPendiente({
  isOpen,
  onClose,
  onConfirm,
  montoTotalAsignado,
  montoMinimo,
  saldoPendiente,
  guardando = false,
}: Props) {
  const fmt = (n: number) =>
    `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Aviso Informativo: Saldo Pendiente"
      onConfirm={onConfirm}
      confirmText="Continuar con el registro"
      cancelText="Revisar montos / Cancelar"
      confirmVariant="primary"
      loading={guardando}
    >
      <div className="space-y-4 text-sm text-text-main">
        {/* Banner de alerta informativa no bloqueante */}
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="p-1 bg-amber-100 text-amber-700 rounded-full flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-amber-900 text-sm">
              Monto total asignado no cubre el monto mínimo normativo
            </h4>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              La suma de montos asignados a los beneficiarios es inferior al monto mínimo establecido
              por normativa para el beneficio de fallecimiento.
            </p>
          </div>
        </div>

        {/* Resumen de montos */}
        <div className="bg-bg-layout border border-border-main rounded-lg p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-border-main/60">
            <span className="text-text-sec">Monto mínimo normativo:</span>
            <span className="font-semibold text-text-main">{fmt(montoMinimo)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-border-main/60">
            <span className="text-text-sec">Monto total asignado:</span>
            <span className="font-semibold text-text-main">{fmt(montoTotalAsignado)}</span>
          </div>
          <div className="flex justify-between items-center py-1 text-sm pt-1">
            <span className="font-medium text-amber-800">Saldo pendiente:</span>
            <span className="font-bold text-amber-700 bg-amber-100/70 px-2.5 py-0.5 rounded">
              {fmt(saldoPendiente)}
            </span>
          </div>
        </div>

        {/* Nota explicativa de no-bloqueo y regularización */}
        <p className="text-xs text-text-sec leading-relaxed">
          <strong>Esta alerta es informativa y no impide el guardado.</strong> Puede registrar el expediente
          ahora; el sistema mantendrá registrado el saldo pendiente (<strong>{fmt(saldoPendiente)}</strong>)
          para su regularización posterior agregando beneficiarios o ajustando montos.
        </p>
      </div>
    </Modal>
  );
}

