'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import Drawer from '@/components/ui/Drawer';

interface Deposito {
  id: string;
  nombreBeneficiario: string | null;
  dniBeneficiario: string | null;
  porcentaje: number;
  monto: number;
  banco: string | null;
  numeroCuenta: string | null;
  cci: string | null;
  fechaPago: string | null;
  tieneComprobante: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  expedienteId: string;
  deposito: Deposito | null;
}

export default function EditarDepositoModal({ isOpen, onClose, onSaved, expedienteId, deposito }: Props) {
  const [banco, setBanco] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [cci, setCci] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !deposito) return;
    setBanco(deposito.banco || '');
    setNumeroCuenta(deposito.numeroCuenta || '');
    setCci(deposito.cci || '');
    setFechaPago(deposito.fechaPago ? new Date(deposito.fechaPago).toISOString().slice(0, 10) : '');
    setComprobante(null);
    setError('');
  }, [isOpen, deposito]);

  const subirComprobante = (file: File) => {
    if (file.type !== 'application/pdf') {
      showConfirmMessage('error', 'Formato inválido', 'Solo se permiten archivos PDF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showConfirmMessage('error', 'Archivo demasiado grande', 'Máximo 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setComprobante(((e.target?.result as string) || '').split(',')[1] || '');
      showConfirmMessage('success', 'Comprobante cargado');
    };
    reader.readAsDataURL(file);
  };

  const verComprobante = async () => {
    if (!deposito) return;
    try {
      const { data } = await api.get(`/fam-beneficios/${expedienteId}/deposito/${deposito.id}/comprobante`);
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(`<iframe src="data:application/pdf;base64,${data.contenido}" style="border:0;width:100%;height:100%"></iframe>`);
    } catch {
      showConfirmMessage('error', 'No se pudo abrir el comprobante');
    }
  };

  const guardar = async () => {
    if (!deposito) return;
    setGuardando(true);
    setError('');
    try {
      await api.put(`/fam-beneficios/${expedienteId}/depositos/${deposito.id}`, {
        banco: banco.trim() || undefined,
        numeroCuenta: numeroCuenta.trim() || undefined,
        cci: cci.trim() || undefined,
        ...(fechaPago && { fechaPago }),
        ...(comprobante && { comprobantePdf: comprobante }),
      });
      showConfirmMessage('success', 'Depósito actualizado correctamente');
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'No se pudo actualizar el depósito';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Corregir depósito" width="sm:w-[28rem]">
      <div className="space-y-3">
        {deposito && (
          <div className="bg-gray-50 border border-border rounded-lg p-3">
            <p className="text-sm font-semibold text-text-main">{deposito.nombreBeneficiario || 'Beneficiario'}</p>
            <p className="text-xs text-text-sec">DNI: {deposito.dniBeneficiario || '—'} · {deposito.porcentaje}%</p>
            <p className="text-sm font-bold text-primary mt-1">S/ {Number(deposito.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Banco</label>
          <input value={banco} onChange={(e) => setBanco(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-sec uppercase mb-1">N° cuenta</label>
          <input value={numeroCuenta} onChange={(e) => setNumeroCuenta(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-sec uppercase mb-1">CCI</label>
          <input value={cci} onChange={(e) => setCci(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-sec uppercase mb-1">Fecha de pago</label>
          <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-text-sec uppercase">Comprobante</span>
          {deposito?.tieneComprobante && (
            <button type="button" onClick={verComprobante} className="text-xs text-primary hover:underline">Ver</button>
          )}
          {comprobante && <span className="text-xs text-green-700 font-medium">PDF cargado</span>}
          <label className="cursor-pointer text-xs text-primary hover:underline">
            {deposito?.tieneComprobante || comprobante ? 'Reemplazar' : 'Subir PDF'}
            <input type="file" accept="application/pdf,.pdf" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) subirComprobante(e.target.files[0]); }} />
          </label>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg text-text-main hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
