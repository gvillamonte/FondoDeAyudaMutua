'use client';

import { useEffect, useState } from 'react';

interface PdfViewerModalProps {
  base64: string;
  nombre: string;
  onClose: () => void;
}

const nombreArchivo = (nombre: string) =>
  `${nombre.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/_+$/g, '').slice(0, 60) || 'Documento'}.pdf`;

export default function PdfViewerModal({ base64, nombre, onClose }: PdfViewerModalProps) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    try {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch {
      return;
    }
  }, [base64]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-border-main"
        onClick={(e) => e.stopPropagation()}>
        {/* Header con nombre corto */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border-main bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-main truncate" title={nombre}>{nombre}</p>
              <p className="text-[10px] text-text-sec">Documento PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {url && (
              <a href={url} download={nombreArchivo(nombre)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Descargar
              </a>
            )}
            <button type="button" onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-sec bg-white border border-border-main rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Cerrar
            </button>
          </div>
        </div>

        {/* Visor */}
        <div className="flex-1 bg-gray-100">
          {url ? (
            <iframe src={url} title={nombre} className="w-full h-full border-0" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-text-sec">Cargando documento...</div>
          )}
        </div>
      </div>
    </div>
  );
}
