'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';
import Drawer from '@/components/ui/Drawer';
import { procesarArchivoDocumento } from '@/lib/pdf-utils';

export interface BeneficiarioOpcionPoder {
  id?: string;
  nombre: string;
  dni: string | null;
  parentesco?: string | null;
  depositoId?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  expedienteId: string;
  expedienteNumero?: string;
  colegiadoNombre?: string;
  colegiadoDni?: string;
  beneficiarios: BeneficiarioOpcionPoder[];
  formaPagoActual?: string | null;
  bancoActual?: string | null;
  conCartaPoderActual?: boolean;
  poderOtorganteNombreActual?: string | null;
  poderOtorganteDniActual?: string | null;
  poderOtorganteParentescoActual?: string | null;
  apoderadoNombreActual?: string | null;
  apoderadoDniActual?: string | null;
  apoderadoParentescoActual?: string | null;
  poderFechaActual?: string | null;
  poderMotivoActual?: string | null;
  poderChequeNumeroActual?: string | null;
  tieneCartaPoderDoc?: boolean;
}

const PARENTESCO_OTORGANTE_OPTIONS = [
  'Hijo(a)',
  'Cónyuge',
  'Padre',
  'Madre',
  'Hermano(a)',
  'Titular (Colegiado)',
  'Heredero Legal',
  'Otro',
];

const PARENTESCO_APODERADO_OPTIONS = [
  'Familiar / Pariente',
  'Madre / Padre del Beneficiario',
  'Hermano(a)',
  'Tío(a)',
  'Abuelo(a)',
  'Cónyuge',
  'Hijo(a)',
  'Representante / Apoderado Legal',
  'Tercero Autorizado con Carta Poder',
];

const BANCOS_SUGERIDOS = [
  'BCP',
  'BBVA',
  'Scotiabank',
  'Interbank',
  'Banco de la Nación',
  'BanBif',
  'Caja Piura',
  'Caja Huancayo',
  'Caja Arequipa',
];

export default function ModalCartaPoder({
  isOpen,
  onClose,
  onSaved,
  expedienteId,
  expedienteNumero,
  colegiadoNombre,
  colegiadoDni,
  beneficiarios,
  formaPagoActual,
  bancoActual,
  conCartaPoderActual,
  poderOtorganteNombreActual,
  poderOtorganteDniActual,
  poderOtorganteParentescoActual,
  apoderadoNombreActual,
  apoderadoDniActual,
  apoderadoParentescoActual,
  poderFechaActual,
  poderMotivoActual,
  poderChequeNumeroActual,
  tieneCartaPoderDoc,
}: Props) {
  const [conCartaPoder, setConCartaPoder] = useState(true);
  const [beneficiarioId, setBeneficiarioId] = useState<string>('');
  const [depositoId, setDepositoId] = useState<string>('');
  const [poderOtorganteNombre, setPoderOtorganteNombre] = useState('');
  const [poderOtorganteDni, setPoderOtorganteDni] = useState('');
  const [poderOtorganteParentesco, setPoderOtorganteParentesco] = useState('Hijo(a)');
  const [apoderadoNombre, setApoderadoNombre] = useState('');
  const [apoderadoDni, setApoderadoDni] = useState('');
  const [apoderadoParentesco, setApoderadoParentesco] = useState('Tercero Autorizado con Carta Poder');
  const [poderFecha, setPoderFecha] = useState('');
  const [formaPago, setFormaPago] = useState('CHEQUE');
  const [banco, setBanco] = useState('');
  const [poderChequeNumero, setPoderChequeNumero] = useState('');
  const [poderMotivo, setPoderMotivo] = useState('');
  const [cartaPoderBase64, setCartaPoderBase64] = useState<string | null>(null);
  const [cartaPoderSize, setCartaPoderSize] = useState<number>(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setConCartaPoder(conCartaPoderActual !== undefined ? Boolean(conCartaPoderActual) : true);
    setCartaPoderBase64(null);
    setCartaPoderSize(0);
    setError('');

    const primerBenef = beneficiarios[0];
    setBeneficiarioId(primerBenef?.id || '');
    setDepositoId(primerBenef?.depositoId || '');

    setPoderOtorganteNombre(
      poderOtorganteNombreActual ||
        primerBenef?.nombre ||
        colegiadoNombre ||
        '',
    );
    setPoderOtorganteDni(
      poderOtorganteDniActual ||
        primerBenef?.dni ||
        colegiadoDni ||
        '',
    );
    setPoderOtorganteParentesco(
      poderOtorganteParentescoActual ||
        primerBenef?.parentesco ||
        (primerBenef ? 'Hijo(a)' : 'Titular (Colegiado)'),
    );

    setApoderadoNombre(apoderadoNombreActual || '');
    setApoderadoDni(apoderadoDniActual || '');
    setApoderadoParentesco(apoderadoParentescoActual || 'Tercero Autorizado con Carta Poder');
    setPoderFecha(
      poderFechaActual
        ? new Date(poderFechaActual).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setFormaPago((formaPagoActual || 'CHEQUE').toUpperCase());
    setBanco(bancoActual || '');
    setPoderChequeNumero(poderChequeNumeroActual || '');
    setPoderMotivo(poderMotivoActual || '');
  }, [
    isOpen,
    conCartaPoderActual,
    poderOtorganteNombreActual,
    poderOtorganteDniActual,
    poderOtorganteParentescoActual,
    apoderadoNombreActual,
    apoderadoDniActual,
    apoderadoParentescoActual,
    poderFechaActual,
    poderMotivoActual,
    poderChequeNumeroActual,
    formaPagoActual,
    bancoActual,
    beneficiarios,
    colegiadoNombre,
    colegiadoDni,
  ]);

  const seleccionarOtorgante = (op: {
    id?: string;
    depositoId?: string;
    nombre: string;
    dni: string | null;
    parentesco?: string | null;
  }) => {
    setBeneficiarioId(op.id || '');
    setDepositoId(op.depositoId || '');
    setPoderOtorganteNombre(op.nombre);
    setPoderOtorganteDni(op.dni || '');
    setPoderOtorganteParentesco(op.parentesco || 'Hijo(a)');
  };

  const subirArchivo = async (file: File) => {
    try {
      const res = await procesarArchivoDocumento(file, 10);
      setCartaPoderBase64(res.base64);
      setCartaPoderSize(res.size);
      showConfirmMessage(
        'success',
        res.esImagenConvertida ? 'Imagen convertida a PDF' : 'Carta Poder cargada',
        file.name,
      );
    } catch (err: any) {
      showConfirmMessage('error', 'Archivo inválido', err?.message || 'No se pudo procesar el archivo');
    }
  };

  const verCartaPoderActual = async () => {
    try {
      const { data } = await api.get(`/fam-beneficios/${expedienteId}/documento/cartaPoder`);
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(
        `<iframe src="data:application/pdf;base64,${data.contenido}" style="border:0;width:100%;height:100%"></iframe>`,
      );
    } catch {
      showConfirmMessage('error', 'No se pudo abrir la Carta Poder');
    }
  };

  const guardar = async () => {
    setError('');
    if (conCartaPoder) {
      if (!poderOtorganteNombre.trim()) {
        setError('Indique quién es el beneficiario / titular que otorga el poder (ej. el Hijo o el Colegiado)');
        return;
      }
      if (!apoderadoNombre.trim()) {
        setError('Indique los nombres y apellidos completos de la persona que recibe el poder para cobrar');
        return;
      }
      if (!/^\d{8}$/.test(apoderadoDni.trim())) {
        setError('El DNI de la persona que cobra (apoderado) debe tener exactamente 8 dígitos');
        return;
      }
    }

    setGuardando(true);
    try {
      await api.post(`/fam-beneficios/${expedienteId}/carta-poder`, {
        conCartaPoder,
        ...(beneficiarioId ? { beneficiarioId } : {}),
        ...(depositoId ? { depositoId } : {}),
        poderOtorganteNombre: poderOtorganteNombre.trim() || undefined,
        poderOtorganteDni: poderOtorganteDni.trim() || undefined,
        poderOtorganteParentesco: poderOtorganteParentesco.trim() || undefined,
        apoderadoNombre: apoderadoNombre.trim() || undefined,
        apoderadoDni: apoderadoDni.trim() || undefined,
        apoderadoParentesco: apoderadoParentesco.trim() || undefined,
        poderFecha: poderFecha || undefined,
        poderMotivo: poderMotivo.trim() || undefined,
        poderChequeNumero: poderChequeNumero.trim() || undefined,
        formaPago: formaPago || undefined,
        banco: banco.trim() || undefined,
        ...(cartaPoderBase64 ? { cartaPoder: cartaPoderBase64 } : {}),
      });
      showConfirmMessage(
        'success',
        conCartaPoder ? 'Carta Poder y trazabilidad registradas' : 'Carta Poder desactivada',
        conCartaPoder
          ? `${poderOtorganteNombre} → cobra: ${apoderadoNombre} (DNI ${apoderadoDni})`
          : undefined,
      );
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'No se pudo guardar la trazabilidad de Carta Poder';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Registrar / Gestionar Carta Poder${expedienteNumero ? ` · Exp. ${expedienteNumero}` : ''}`}
      width="sm:w-[44rem]"
    >
      <div className="space-y-4">
        <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 text-xs text-slate-700 leading-relaxed">
          <p className="font-bold text-[#3258CA] uppercase tracking-wider mb-1">
            📋 Trazabilidad de Delegación de Cobro (Hijo / Beneficiario / Titular → Apoderado)
          </p>
          Permite registrar cuando el titular del beneficio o su beneficiario directo (por ejemplo, el{' '}
          <strong>Hijo(a)</strong> del colegiado) le otorga una <strong>Carta Poder</strong> a otra persona para cobrar el cheque o recibir el desembolso, manteniendo intacto el registro del beneficiario legítimo y dejando constancia en el historial de auditoría.
        </div>

        <label className="flex items-center gap-2.5 p-3 rounded-lg border border-amber-300 bg-amber-50/70 cursor-pointer">
          <input
            type="checkbox"
            checked={conCartaPoder}
            onChange={(e) => setConCartaPoder(e.target.checked)}
            className="w-4 h-4 accent-[#3258CA] rounded"
          />
          <span className="text-xs font-bold text-amber-900">
            Habilitar cobro / entrega mediante Carta Poder en este expediente
          </span>
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        {conCartaPoder && (
          <div className="space-y-4">
            {/* PASO 1: QUIÉN OTORGA EL PODER */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  1. ¿Quién es el dueño del beneficio que otorga el poder? (Otorgante)
                </h4>
                <span className="text-[11px] text-slate-500">Ej: El Hijo beneficiario o el Colegiado</span>
              </div>

              {(beneficiarios.length > 0 || colegiadoNombre) && (
                <div>
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                    Selección rápida del expediente:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {beneficiarios.map((b, idx) => {
                      const activo =
                        poderOtorganteNombre === b.nombre &&
                        (poderOtorganteDni || '') === (b.dni || '');
                      return (
                        <button
                          key={`${b.id || b.dni || idx}`}
                          type="button"
                          onClick={() => seleccionarOtorgante(b)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            activo
                              ? 'bg-[#3258CA] text-white border-[#3258CA]'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-50'
                          }`}
                        >
                          👤 {b.nombre} {b.parentesco ? `(${b.parentesco})` : ''}{' '}
                          {b.dni ? `· DNI ${b.dni}` : ''}
                        </button>
                      );
                    })}
                    {colegiadoNombre && (
                      <button
                        type="button"
                        onClick={() =>
                          seleccionarOtorgante({
                            nombre: colegiadoNombre,
                            dni: colegiadoDni || null,
                            parentesco: 'Titular (Colegiado)',
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          poderOtorganteNombre === colegiadoNombre
                            ? 'bg-[#3258CA] text-white border-[#3258CA]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-50'
                        }`}
                      >
                        🎓 {colegiadoNombre} (Colegiado Titular)
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Nombre del Beneficiario / Otorgante *
                  </label>
                  <input
                    type="text"
                    value={poderOtorganteNombre}
                    onChange={(e) => setPoderOtorganteNombre(e.target.value)}
                    placeholder="Nombre del hijo beneficiario o colegiado"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    DNI Otorgante
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={poderOtorganteDni}
                    onChange={(e) => setPoderOtorganteDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="8 dígitos"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Condición / Vínculo
                  </label>
                  <select
                    value={poderOtorganteParentesco}
                    onChange={(e) => setPoderOtorganteParentesco(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    {PARENTESCO_OTORGANTE_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* PASO 2: A QUIÉN SE OTORGA EL PODER */}
            <div className="border border-amber-300 rounded-xl p-3.5 bg-amber-50/40 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  2. ¿A quién se le entrega el poder para cobrar el cheque? (Apoderado)
                </h4>
                <span className="text-[11px] text-amber-800">Persona que cobrará / recibirá el pago</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-semibold text-amber-900 uppercase mb-1">
                    Nombres y Apellidos del Apoderado *
                  </label>
                  <input
                    type="text"
                    value={apoderadoNombre}
                    onChange={(e) => setApoderadoNombre(e.target.value)}
                    placeholder="Persona autorizada en la Carta Poder"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-amber-900 uppercase mb-1">
                    DNI Apoderado *
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    value={apoderadoDni}
                    onChange={(e) => setApoderadoDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="8 dígitos"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs font-mono bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-amber-900 uppercase mb-1">
                    Vínculo / Relación
                  </label>
                  <select
                    value={apoderadoParentesco}
                    onChange={(e) => setApoderadoParentesco(e.target.value)}
                    className="w-full px-2.5 py-2 border border-amber-300 rounded-lg text-xs bg-white"
                  >
                    {PARENTESCO_APODERADO_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* PASO 3: DATOS DEL MOMENTO, CHEQUE Y SUSTENTO */}
            <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                3. Datos del Cheque / Cobro y Registro del Momento
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Fecha del Poder / Registro
                  </label>
                  <input
                    type="date"
                    value={poderFecha}
                    onChange={(e) => setPoderFecha(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Modalidad de Cobro
                  </label>
                  <select
                    value={formaPago}
                    onChange={(e) => setFormaPago(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="CHEQUE">Cheque</option>
                    <option value="DEPOSITO">Depósito Bancario</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="EFECTIVO">Efectivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    Banco
                  </label>
                  <input
                    type="text"
                    list="bancos-poder-list"
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    placeholder="BCP, BBVA, BN..."
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <datalist id="bancos-poder-list">
                    {BANCOS_SUGERIDOS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                    {formaPago === 'CHEQUE' ? 'N° de Cheque' : 'N° Cheque / Cuenta / Op.'}
                  </label>
                  <input
                    type="text"
                    value={poderChequeNumero}
                    onChange={(e) => setPoderChequeNumero(e.target.value)}
                    placeholder="Ej. CHQ-0045821"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Motivo / Observación de Trazabilidad
                </label>
                <textarea
                  rows={2}
                  value={poderMotivo}
                  onChange={(e) => setPoderMotivo(e.target.value)}
                  placeholder="Ej. El hijo beneficiario otorga carta poder legalizada a su familiar/apoderado para el cobro del cheque por encontrarse fuera de la ciudad..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Documento de Carta Poder (PDF o Imagen):
                  </span>
                  {cartaPoderBase64 ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      ✓ Cargado ({(cartaPoderSize / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  ) : tieneCartaPoderDoc ? (
                    <button
                      type="button"
                      onClick={verCartaPoderActual}
                      className="text-xs font-semibold text-[#3258CA] hover:underline"
                    >
                      Ver Carta Poder actual
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Sin archivo adjunto</span>
                  )}
                </div>

                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-[#3258CA] border border-blue-200 hover:bg-blue-100">
                  <span>{cartaPoderBase64 || tieneCartaPoderDoc ? 'Reemplazar archivo' : 'Adjuntar Carta Poder'}</span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) subirArchivo(f);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#3258CA] rounded-lg hover:bg-[#2847A6] disabled:opacity-50"
          >
            {guardando ? 'Guardando trazabilidad…' : 'Guardar Carta Poder y Trazabilidad'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
