'use client';

import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  loading?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  onConfirm,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmVariant = 'primary',
  loading = false,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const variantClasses: Record<string, string> = {
    primary: 'btn-primary',
    danger: 'btn-danger',
    success: 'btn-success',
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all">
          <div className="flex items-center justify-between p-4 border-b border-border-main">
            <h2 className="text-lg font-semibold text-text-main">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bg-layout transition-colors"
            >
              <svg className="w-5 h-5 text-text-sec" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4">{children}</div>
          {onConfirm && (
            <div className="flex justify-end gap-2 p-4 border-t border-border-main">
              <button onClick={onClose} className="btn-secondary">
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`${variantClasses[confirmVariant]} disabled:opacity-50`}
              >
                {loading ? 'Procesando...' : confirmText}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
