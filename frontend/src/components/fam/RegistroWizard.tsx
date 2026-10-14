'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { showConfirmMessage } from '@/components/common/ConfirmCenterMessage';

interface ColegiadoSel {
  COLEGIADO_ID: string;
  NUM_COLEGIATURA: string;
  DNI: string;
  NOMBRE_COLEGIADO: string;
  ESTADO: string;
}

interface PersonaSearch {
  PERSONA_ID: string;
  NOMBRE_COMPLETO: string;
  DNI: string;
  NOMBRES: string;
  APELLIDO_PATERNO: string;
  APELLIDO_MATERNO: string;
  COLEGIADO_ID?: string;
}

interface FilaBeneficiario {
  key: string;
  id?: string;
  nombre: string;
  dni: string;
  parentesco: string;
  porcentaje: string;
  observaciones: string;
  orden?: string;
  colegiadoId?: string;
}

interface TipoBeneficioOpt {
  id: number;
  nombre: string;
  descripcion?: string;
}

interface MontoConfig {
  id: number;
  nombre: string;
  aplicaA: string | null;
  monto: number;
}

interface ModalidadBeneficioOpt {
  value: 'monto_unico' | 'monto_compartido' | 'opcion_sucesiva';
  label: string;
  desc: string;
  icon: string;
}

const MODALIDAD_BENEFICIO_OPCIONES: ModalidadBeneficioOpt[] = [
  { value: 'monto_unico', label: 'Monto Único', desc: '1 beneficiario · 100%', icon: '🎯' },
  { value: 'monto_compartido', label: 'Monto Compartido', desc: 'Varios · suma = 100%', icon: '📊' },
  { value: 'opcion_sucesiva', label: 'Opción Sucesiva', desc: 'Varios · 100% c/u · orden', icon: '🔗' },
];

const PASOS = ['Colegiado', 'Beneficiarios', 'Solicitud', 'Resumen'];

const nuevaFila = (): FilaBeneficiario => ({
  key: Math.random().toString(36).slice(2),
  nombre: '', dni: '', parentesco: '', porcentaje: '', observaciones: '',
});

const PARENTESCO_OPTIONS = ['Conyugue', 'Madre', 'Padre', 'Hijo(a)', 'Hermano(a)', 'Tio(a)', 'Primo(a)', 'Abuelo(a)', 'Otros'];

export default function RegistroWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [paso, setPaso] = useState(1);
  const [modalidadBeneficio, setModalidadBeneficio] = useState<'monto_unico' | 'monto_compartido' | 'opcion_sucesiva'>('monto_compartido');
  const [porcentajeTotal, setPorcentajeTotal] = useState(0);
  const [errorPaso, setErrorPaso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [registroOk, setRegistroOk] = useState<string | null>(null);

  // Paso 1
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<ColegiadoSel[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [colegiado, setColegiado] = useState<ColegiadoSel | null>(null);
  const personaDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Paso 2 - Beneficiarios
  const [filas, setFilas] = useState<FilaBeneficiario[]>([nuevaFila()]);
  const [beneficiarioEsTitular, setBeneficiarioEsTitular] = useState(false);
  const [cargandoBenes, setCargandoBenes] = useState(false);
  const [personaSearchIdx, setPersonaSearchIdx] = useState<number | null>(null);
  const [personaSearchValue, setPersonaSearchValue] = useState('');
  const [personaSuggestions, setPersonaSuggestions] = useState<PersonaSearch[]>([]);
  const [showPersonaSuggestions, setShowPersonaSuggestions] = useState(false);
  const personaDropdownRef = useRef<HTMLDivElement>(null);
  const personaDebounceRef2 = useRef<NodeJS.Timeout | null>(null);

  // Parentescos desde LEGACY_DB
  const [parentescos, setParentescos] = useState<{ codigo: string; descripcion: string }[]>([]);

  // Crear beneficiario
  const [showCrearBeneficiario, setShowCrearBeneficiario] = useState(false);
  const [crearBeneficiarioData, setCrearBeneficiarioData] = useState({
    nombres: '', apPaterno: '', apMaterno: '', dni: '', sexo: 'M' as 'M' | 'F',
    fechaNac: '', celular: '', email: '', direccion: '', parentescoCod: '',
  });

  // Paso 3
  const [tipos, setTipos] = useState<TipoBeneficioOpt[]>([]);
  const [montos, setMontos] = useState<MontoConfig[]>([]);
  const [catalogoCartas, setCatalogoCartas] = useState<any[]>([]);
  const [catalogoMemorandos, setCatalogoMemorandos] = useState<any[]>([]);
  const [solicitud, setSolicitud] = useState({
    tipoBeneficioConfigId: null as number | null,
    monto: '',
    observaciones: '',
    cartaNumero: '',
    expedienteNumero: '',
    cartaFecha: '',
    memorandoNumero: '',
    memorandoFecha: '',
    formaPago: '',
    banco: '',
    ordenPagoFecha: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [t, m] = await Promise.all([
          api.get('/tipos-beneficio-config', { params: { activos: 'true' } }).catch(() => ({ data: [] })),
          api.get('/configuraciones/montos-fam').catch(() => ({ data: [] })),
        ]);
        setTipos(Array.isArray(t.data) ? t.data : []);
        setMontos(Array.isArray(m.data) ? m.data : []);
      } catch {}
    })();
    api.get('/cartas', { params: { activos: 'true' } })
      .then(({ data }) => setCatalogoCartas(Array.isArray(data) ? data : []))
      .catch(() => {});
    api.get('/memorandos', { params: { activos: 'true' } })
      .then(({ data }) => setCatalogoMemorandos(Array.isArray(data) ? data : []))
      .catch(() => {});
    api.get('/fam/parentescos')
      .then(({ data }) => setParentescos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Cerrar dropdown de personas al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (personaDropdownRef.current && !personaDropdownRef.current.contains(e.target as Node)) {
        setShowPersonaSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const cargarColegiado = useCallback(async (col: ColegiadoSel) => {
    setColegiado(col);
    setBusqueda(col.NOMBRE_COLEGIADO);
    setSugerencias([]);
    setErrorPaso('');
    setCargandoBenes(true);
    try {
      const { data } = await api.get(`/fam/colegiado/${col.COLEGIADO_ID}/beneficiarios`);
      const existentes: FilaBeneficiario[] = (Array.isArray(data) ? data : []).map((b: any) => ({
        key: b.FAM_ID || Math.random().toString(36).slice(2),
        id: b.FAM_ID,
        nombre: b.NOMBRE_BENEFICIARIO || '',
        dni: b.DNI || '',
        parentesco: b.PARENTESCO || '',
        porcentaje: String(b.PORCENTAJE ?? ''),
        observaciones: '',
      }));
      setFilas(existentes.length ? existentes : [nuevaFila()]);
    } catch {
      setFilas([nuevaFila()]);
    } finally {
      setCargandoBenes(false);
    }
  }, []);

  // Precarga desde Beneficiarios (?colegiado=ID)
  useEffect(() => {
    const cid = searchParams?.get('colegiado');
    if (!cid || colegiado) return;
    (async () => {
      try {
        const { data } = await api.get('/fam/beneficiarios', { params: { search: cid, limit: 1 } });
        const row = Array.isArray(data?.data) ? data.data.find((c: any) => c.COLEGIADO_ID === cid) : null;
        if (row) {
          await cargarColegiado({
            COLEGIADO_ID: row.COLEGIADO_ID,
            NUM_COLEGIATURA: row.NUM_COLEGIATURA,
            DNI: row.DNI,
            NOMBRE_COLEGIADO: row.NOMBRE_COLEGIADO,
            ESTADO: row.ESTADO,
          });
          setPaso(2);
        }
      } catch {}
    })();
  }, [searchParams, colegiado, cargarColegiado]);

  const buscarColegiados = async () => {
    if (busqueda.trim().length < 2) {
      setShowSugerencias(false);
      return;
    }
    try {
      const { data } = await api.get('/fam/autocomplete', { params: { q: busqueda.trim() } });
      setSugerencias(Array.isArray(data) ? data : []);
      setShowSugerencias(true);
    } catch {
      setSugerencias([]);
      setShowSugerencias(false);
    }
  };

  const sumaPorcentajes = filas.reduce((acc, f) => acc + (parseFloat(f.porcentaje) || 0), 0);
  const sumaValida = modalidadBeneficio === 'monto_compartido'
    ? sumaPorcentajes === 100
    : sumaPorcentajes > 0 && sumaPorcentajes <= 100;

  const actualizarFila = (key: string, campo: keyof FilaBeneficiario, valor: string) => {
    setFilas(filas.map((f) => (f.key === key ? { ...f, [campo]: valor } : f)));
  };

  // Búsqueda de personas en TPersona
  const buscarPersonas = (value: string, idx: number) => {
    setPersonaSearchValue(value);
    setPersonaSearchIdx(idx);
    if (personaDebounceRef2.current) clearTimeout(personaDebounceRef2.current);
    if (value.trim().length >= 2) {
      personaDebounceRef2.current = setTimeout(async () => {
        try {
          const { data } = await api.get('/fam/buscar-personas', { params: { q: value.trim() } });
          setPersonaSuggestions(Array.isArray(data) ? data : []);
          setShowPersonaSuggestions(true);
        } catch {
          setPersonaSuggestions([]);
        }
      }, 300);
    } else {
      setPersonaSuggestions([]);
      setShowPersonaSuggestions(false);
    }
  };

  const seleccionarPersona = (persona: PersonaSearch, idx: number) => {
    const key = filas[idx]?.key;
    if (!key) return;
    setFilas(filas.map((f, i) => i === idx ? {
      ...f,
      nombre: persona.NOMBRE_COMPLETO,
      dni: persona.DNI || '',
      colegiadoId: persona.COLEGIADO_ID || undefined,
    } : f));
    setPersonaSearchValue(persona.NOMBRE_COMPLETO);
    setShowPersonaSuggestions(false);
    setPersonaSearchIdx(null);
  };

  const abrirCrearBeneficiario = () => {
    setCrearBeneficiarioData({
      nombres: '', apPaterno: '', apMaterno: '', dni: '', sexo: 'M',
      fechaNac: '', celular: '', email: '', direccion: '', parentescoCod: '',
    });
    setShowCrearBeneficiario(true);
  };

  const guardarNuevoBeneficiario = async () => {
    const d = crearBeneficiarioData;
    if (!d.nombres.trim() || !d.apPaterno.trim() || !d.apMaterno.trim() || !d.dni.trim() || !d.parentescoCod) {
      showConfirmMessage('error', 'Campos incompletos', 'Nombres, Apellidos, DNI y Parentesco son obligatorios');
      return;
    }
    if (d.dni.trim().length !== 8) {
      showConfirmMessage('error', 'DNI inválido', 'El DNI debe tener exactamente 8 dígitos');
      return;
    }
    try {
      const { data } = await api.post('/fam/personas', {
        nombres: d.nombres.trim(),
        apPaterno: d.apPaterno.trim(),
        apMaterno: d.apMaterno.trim(),
        dni: d.dni.trim(),
        sexo: d.sexo,
        fechaNac: d.fechaNac || undefined,
        celular: d.celular || undefined,
        email: d.email || undefined,
        direccion: d.direccion || undefined,
        parentescoCod: d.parentescoCod,
      });
      showConfirmMessage('success', 'Beneficiario creado correctamente', `${data.NOMBRE_COMPLETO} — DNI ${data.DNI}`);
      setShowCrearBeneficiario(false);
      if (personaSearchIdx !== null) {
        seleccionarPersona({
          PERSONA_ID: data.PERSONA_ID,
          NOMBRE_COMPLETO: data.NOMBRE_COMPLETO,
          DNI: data.DNI,
          NOMBRES: d.nombres.trim(),
          APELLIDO_PATERNO: d.apPaterno.trim(),
          APELLIDO_MATERNO: d.apMaterno.trim(),
          COLEGIADO_ID: undefined,
        }, personaSearchIdx);
      }
    } catch (e: any) {
      showConfirmMessage('error', 'Error al crear beneficiario', e.response?.data?.message || 'Error desconocido');
    }
  };

  // Reordenar filas para opción sucesiva
  const moverFila = (idx: number, dir: -1 | 1) => {
    const nuevoIdx = idx + dir;
    if (nuevoIdx < 0 || nuevoIdx >= filas.length) return;
    const copia = [...filas];
    [copia[idx], copia[nuevoIdx]] = [copia[nuevoIdx], copia[idx]];
    setFilas(copia);
  };

  const validarPaso = (n: number): string => {
    if (n >= 2 && !colegiado) return 'Selecciona un colegiado para continuar';
    
    const filasConNombre = filas.filter((f) => f.nombre.trim());
    
    if (n >= 3) {
      if (!solicitud.tipoBeneficioConfigId) return 'Selecciona el tipo de beneficio';
      if (!solicitud.monto || parseFloat(solicitud.monto) <= 0) return 'Ingresa un monto válido';
      if (modalidadBeneficio === 'monto_unico') {
        if (filasConNombre.length !== 1) {
          return 'Modo Monto Único: Debe haber exactamente 1 beneficiario';
        }
        if (parseFloat(filasConNombre[0].porcentaje) !== 100) {
          return 'Modo Monto Único: El beneficiario debe tener 100%';
        }
      } else if (modalidadBeneficio === 'monto_compartido') {
        const suma = filas.reduce((acc, f) => acc + (parseFloat(f.porcentaje) || 0), 0);
        if (suma !== 100) {
          return `Modo Monto Compartido: La suma de porcentajes debe ser exactamente 100% (actual: ${suma}%)`;
        }
      } else if (modalidadBeneficio === 'opcion_sucesiva') {
        if (filasConNombre.length === 0) {
          return 'Registra al menos un beneficiario con nombre y parentesco';
        }
      }
      
      const validas = filas.filter((f) => f.nombre.trim() && f.parentesco);
      if (!validas.length) return 'Registra al menos un beneficiario con nombre y parentesco';
      for (const f of filas) {
        if ((f.nombre.trim() || f.porcentaje) && (!f.nombre.trim() || !f.parentesco)) {
          return `Completa nombre y parentesco de '${f.nombre || 'fila sin nombre'}' o elimina la fila`;
        }
      }
    }
    if (n >= 4) {
      if (!solicitud.cartaNumero) return 'Selecciona un número de carta';
    }
    return '';
  };

  const siguiente = () => {
    const err = validarPaso(paso + 1);
    if (err) { setErrorPaso(err); return; }
    setErrorPaso('');
    setPaso(paso + 1);
  };

  const anterior = () => { setErrorPaso(''); setPaso(paso - 1); };

  const seleccionarTipo = (tipoId: string) => {
    const tipo = tipos.find((t) => String(t.id) === tipoId);
    const config = montos.find((m) => tipo && (m.nombre || '').toUpperCase().includes(tipo.nombre.toUpperCase().replace(/\s+/g, '_')));
    setSolicitud({ ...solicitud, tipoBeneficioConfigId: tipo ? tipo.id : null, monto: config ? String(config.monto) : solicitud.monto });
  };

  const confirmar = async () => {
    setGuardando(true);
    setErrorPaso('');
    try {
      const tieneCarta = !!solicitud.cartaNumero;
      const tieneMemorando = !!solicitud.memorandoNumero;
      const documentacionCompleta = tieneCarta && tieneMemorando;
      const body = {
        colegiadoId: colegiado!.COLEGIADO_ID,
        modalidadBeneficio,
        beneficiarios: filas.filter(f => f.nombre.trim()).map((f, idx) => ({
          ...(f.id ? { id: f.id } : {}),
          nombre: f.nombre.trim(),
          dni: f.dni.trim() || undefined,
          parentesco: f.parentesco,
          porcentaje: modalidadBeneficio === 'monto_compartido' ? (parseFloat(f.porcentaje) || 0) : 100,
          orden: modalidadBeneficio === 'opcion_sucesiva' ? (idx + 1) : undefined,
          observaciones: f.observaciones || undefined,
          colegiadoId: f.colegiadoId || undefined,
        })),
        tipoBeneficioConfigId: solicitud.tipoBeneficioConfigId,
        monto: parseFloat(solicitud.monto),
        documentacionCompleta,
        documentacionObservacion: !documentacionCompleta ? 'Documentación pendiente de presentar (Wizard)' : undefined,
        observaciones: solicitud.observaciones || undefined,
        cartaNumero: solicitud.cartaNumero || undefined,
        expedienteNumero: solicitud.expedienteNumero || undefined,
        cartaFecha: solicitud.cartaFecha || undefined,
        memorandoNumero: solicitud.memorandoNumero || undefined,
        memorandoFecha: solicitud.memorandoFecha || undefined,
        formaPago: solicitud.formaPago || undefined,
        banco: solicitud.banco || undefined,
        ordenPagoFecha: solicitud.ordenPagoFecha || undefined,
      };
      const { data } = await api.post('/fam-registros', body);
      setRegistroOk(data.id);
    } catch (err: any) {
      setErrorPaso(err.response?.data?.message || 'Error al registrar el caso');
    } finally { setGuardando(false); }
  };

  const reiniciar = () => {
    setColegiado(null); setBusqueda(''); setFilas([nuevaFila()]);
    setModalidadBeneficio('monto_compartido');
    setBeneficiarioEsTitular(false);
    setSolicitud({ tipoBeneficioConfigId: null, monto: '', observaciones: '', cartaNumero: '', expedienteNumero: '', cartaFecha: '', memorandoNumero: '', memorandoFecha: '', formaPago: '', banco: '', ordenPagoFecha: '' });
    setRegistroOk(null); setPaso(1); setErrorPaso('');
  };

  if (registroOk) {
    return (
      <div className="bg-white border border-border rounded-lg p-10 text-center">
        <svg className="w-12 h-12 mx-auto text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <h3 className="text-lg font-semibold text-text-main mt-3">Registro guardado correctamente</h3>
        <p className="text-text-sec text-sm mt-1">Folio de solicitud: <span className="font-mono font-semibold text-primary">{registroOk}</span></p>
        <div className="flex items-center justify-center gap-3 mt-5">
          <button onClick={reiniciar} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90">Nuevo registro</button>
          <button onClick={() => router.push('/dashboard/fam/registro?tab=historial')} className="px-4 py-2 text-sm font-medium text-text-sec bg-gray-100 rounded-lg hover:bg-gray-200">Ver historial</button>
        </div>
      </div>
    );
  }

  const MODALIDAD_LABEL: Record<string, string> = {
    monto_unico: 'Monto Único',
    monto_compartido: 'Monto Compartido',
    opcion_sucesiva: 'Opción Sucesiva',
  };

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="bg-white border border-border rounded-lg px-6 py-4 flex items-center">
        {PASOS.map((label, i) => {
          const n = i + 1;
          const activo = paso === n;
          const completado = paso > n;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${completado ? 'bg-green-600 text-white' : activo ? 'bg-primary text-white' : 'bg-gray-100 text-text-sec'}`}>
                  {completado ? '✓' : n}
                </span>
                <span className={`text-sm font-medium hidden sm:block ${activo ? 'text-primary' : completado ? 'text-green-700' : 'text-text-sec'}`}>{label}</span>
              </div>
              {n < PASOS.length && <div className={`flex-1 h-0.5 mx-3 ${paso > n ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>

      {errorPaso && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{errorPaso}</div>}

      {/* Modal Crear Beneficiario */}
      {showCrearBeneficiario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-auto shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-main text-base">Crear nuevo beneficiario</h3>
              <button onClick={() => setShowCrearBeneficiario(false)} className="text-text-sec hover:text-text-main">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <p className="text-xs text-text-sec mb-4">Se registrar&aacute; en la tabla TPersona de la base de datos legacy (DBCIPCusco).</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Nombres *</label>
                  <input value={crearBeneficiarioData.nombres} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, nombres: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Nombres completos" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">DNI *</label>
                  <input value={crearBeneficiarioData.dni} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, dni: e.target.value })} maxLength={8}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="8 dígitos" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Apellido Paterno *</label>
                  <input value={crearBeneficiarioData.apPaterno} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, apPaterno: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Apellido Materno *</label>
                  <input value={crearBeneficiarioData.apMaterno} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, apMaterno: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Sexo *</label>
                  <select value={crearBeneficiarioData.sexo} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, sexo: e.target.value as 'M' | 'F' })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Parentesco *</label>
                  <select value={crearBeneficiarioData.parentescoCod} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, parentescoCod: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                    <option value="">-- Seleccionar --</option>
                    {parentescos.map((p) => <option key={p.codigo} value={p.codigo}>{p.descripcion}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha de nacimiento</label>
                <input type="date" value={crearBeneficiarioData.fechaNac} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, fechaNac: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Celular</label>
                  <input value={crearBeneficiarioData.celular} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, celular: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Opcional" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-sec uppercase mb-1">Email</label>
                  <input value={crearBeneficiarioData.email} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Opcional" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-sec uppercase mb-1">Direcci&oacute;n</label>
                <textarea value={crearBeneficiarioData.direccion} onChange={(e) => setCrearBeneficiarioData({ ...crearBeneficiarioData, direccion: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Opcional" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-border">
              <button onClick={() => setShowCrearBeneficiario(false)}
                className="px-4 py-2 text-sm font-medium text-text-sec bg-white border border-border rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={guardarNuevoBeneficiario}
                disabled={!crearBeneficiarioData.nombres.trim() || !crearBeneficiarioData.apPaterno.trim() || !crearBeneficiarioData.apMaterno.trim() || !crearBeneficiarioData.dni.trim() || !crearBeneficiarioData.parentescoCod}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                Guardar beneficiario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 1 */}
      {paso === 1 && (
        <div className="bg-white border border-border rounded-lg p-6 space-y-4">
          <h3 className="font-semibold text-text-main">Datos del colegiado titular</h3>
          <div className="relative max-w-xl">
            <label className="block text-xs font-medium text-text-sec uppercase mb-1">Buscar por CIP, DNI o nombre *</label>
            <div className="flex gap-2">
              <input value={busqueda} onChange={(e) => {
        const val = e.target.value;
        setBusqueda(val);
        if (personaDebounceRef.current) clearTimeout(personaDebounceRef.current);
        personaDebounceRef.current = setTimeout(async () => {
          if (val.trim().length >= 2) {
            try {
              const { data } = await api.get('/fam/autocomplete', { params: { q: val.trim() } });
              setSugerencias(Array.isArray(data) ? data : []);
              setShowSugerencias(true);
            } catch {
              setSugerencias([]);
              setShowSugerencias(false);
            }
          } else {
            setSugerencias([]);
            setShowSugerencias(false);
          }
        }, 300);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') buscarColegiados(); }}
      placeholder="Ej: 101926, 09334452 o Apellido"
      className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={buscarColegiados} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90">Buscar</button>
            </div>
            {sugerencias.length > 0 && showSugerencias && !colegiado && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-64 overflow-auto">
                {sugerencias.map((s) => (
                  <button key={s.COLEGIADO_ID} onClick={() => cargarColegiado(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <span className="block text-sm font-medium text-text-main">{s.NOMBRE_COLEGIADO}</span>
                    <span className="block text-xs text-text-sec">CIP {s.NUM_COLEGIATURA} · DNI {s.DNI || '-'} · {s.ESTADO}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {colegiado && (
            <div className="border border-border rounded-lg p-4 bg-[#F8FAFC]">
              <p className="text-sm font-semibold text-text-main">{colegiado.NOMBRE_COLEGIADO}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-xs text-text-sec">
                <span>CIP: <b className="text-text-main">{colegiado.NUM_COLEGIATURA}</b></span>
                <span>DNI: <b className="text-text-main">{colegiado.DNI || '-'}</b></span>
                <span>Habilidad: <b className={colegiado.ESTADO === 'HABILITADO' ? 'text-green-700' : 'text-red-600'}>{colegiado.ESTADO}</b></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASO 2 */}
      {paso === 2 && (
        <div className="bg-white border border-border rounded-lg p-6 space-y-5">
          {/* Selector de modalidad */}
          <div>
            <h3 className="font-semibold text-text-main mb-1">Tipo de distribuci&oacute;n del beneficio</h3>
            <p className="text-xs text-text-sec mb-3">Define c&oacute;mo se reparte el monto entre los beneficiarios</p>
            <div className="grid grid-cols-3 gap-3">
              {MODALIDAD_BENEFICIO_OPCIONES.map((opt) => (
                <button key={opt.value} onClick={() => {
                  setModalidadBeneficio(opt.value);
                  if (opt.value === 'monto_unico' && filas.length > 1) {
                    setFilas([filas[0]]);
                  }
                  if (opt.value === 'opcion_sucesiva') {
                    setFilas(filas.map((f, i) => ({ ...f, porcentaje: '100', orden: String(i + 1) })));
                  }
                  if (opt.value === 'monto_compartido') {
                    setFilas(filas.map(f => ({ ...f, orden: undefined })));
                  }
                }}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${modalidadBeneficio === opt.value
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{opt.icon}</span>
                    <span className={`text-sm font-semibold ${modalidadBeneficio === opt.value ? 'text-primary' : 'text-text-main'}`}>{opt.label}</span>
                  </div>
                  <p className="text-xs text-text-sec pl-7">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de beneficio y monto */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Tipo de Beneficio *</label>
              <select value={solicitud.tipoBeneficioConfigId ?? ''} onChange={(e) => seleccionarTipo(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">-- Seleccione --</option>
                {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Monto (S/) *</label>
              <input
                type="number" min={0} step="0.01" placeholder="Monto del beneficio"
                value={solicitud.monto}
                onChange={(e) => setSolicitud({ ...solicitud, monto: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm font-semibold"
              />
            </div>
          </div>

          {solicitud.tipoBeneficioConfigId && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <button type="button" onClick={() => {
                const nuevoEstado = !beneficiarioEsTitular;
                setBeneficiarioEsTitular(nuevoEstado);
                if (nuevoEstado && colegiado) {
                  const yaExiste = filas.some((f) => f.dni === colegiado.DNI);
                  if (!yaExiste) {
                    const nuevaFila: FilaBeneficiario = {
                      key: Math.random().toString(36).slice(2),
                      nombre: colegiado.NOMBRE_COLEGIADO,
                      dni: colegiado.DNI,
                      parentesco: 'Titular',
                      porcentaje: '100',
                      observaciones: '',
                    };
                    setFilas((prev) => [...prev.filter((f) => f.nombre.trim()), nuevaFila]);
                  }
                }
              }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${beneficiarioEsTitular ? 'bg-primary' : 'bg-gray-300'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${beneficiarioEsTitular ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-text-main font-medium">¿El titular del colegiado es el beneficiario?</span>
            </div>
          )}

          {/* Tabla de beneficiarios */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-text-main">Beneficiarios que cobrar&aacute;n el beneficio</h4>
              <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${sumaValida ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {modalidadBeneficio === 'monto_unico' && `${filas.filter(f => f.nombre.trim()).length}/1 beneficiario`}
                {modalidadBeneficio === 'monto_compartido' && `Suma: ${sumaPorcentajes}% ${sumaValida ? '✓' : '(debe ser 100%)'}`}
                {modalidadBeneficio === 'opcion_sucesiva' && `${filas.filter(f => f.nombre.trim()).length} beneficiario(s) · 100% c/u`}
              </span>
            </div>
            {cargandoBenes ? (
              <p className="text-sm text-text-sec">Cargando beneficiarios existentes...</p>
            ) : (
              <>
                <p className="text-xs text-text-sec mb-3">Busca personas por nombre o DNI en el padr&oacute;n, o escribe manualmente los datos.</p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        {modalidadBeneficio === 'opcion_sucesiva' && <th className="px-2 py-2 text-center text-xs font-semibold text-text-sec uppercase w-10">Orden</th>}
                        <th className="px-3 py-2 text-left text-xs font-semibold text-text-sec uppercase w-56">Nombre *</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-text-sec uppercase w-32">DNI</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-text-sec uppercase w-40">Parentesco *</th>
                        {modalidadBeneficio === 'monto_compartido' && (
                          <th className="px-3 py-2 text-left text-xs font-semibold text-text-sec uppercase w-24">%</th>
                        )}
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filas.map((f, idx) => (
                        <tr key={f.key} className={modalidadBeneficio === 'opcion_sucesiva' ? 'bg-gray-50/50' : ''}>
                          {modalidadBeneficio === 'opcion_sucesiva' && (
                            <td className="px-2 py-2 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <button onClick={() => moverFila(idx, -1)} disabled={idx === 0}
                                  className="p-0.5 text-text-sec hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                </button>
                                <span className="text-sm font-bold text-primary">{idx + 1}</span>
                                <button onClick={() => moverFila(idx, 1)} disabled={idx === filas.length - 1}
                                  className="p-0.5 text-text-sec hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                              </div>
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <div className="relative" ref={personaSearchIdx === idx ? personaDropdownRef : undefined}>
                              <input
                                value={personaSearchIdx === idx ? personaSearchValue : f.nombre}
                                onChange={(e) => {
                                  if (modalidadBeneficio === 'monto_unico' && filas.length > 1) return;
                                  actualizarFila(f.key, 'nombre', e.target.value);
                                  buscarPersonas(e.target.value, idx);
                                }}
                                onFocus={() => {
                                  if (personaSearchValue && personaSuggestions.length > 0) {
                                    setPersonaSearchIdx(idx);
                                    setShowPersonaSuggestions(true);
                                  }
                                }}
                                placeholder="Buscar por nombre o DNI..."
                                className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30" />
                              {f.id && <span className="text-[10px] text-green-700">registrado</span>}
                              {showPersonaSuggestions && personaSearchIdx === idx && personaSuggestions.length > 0 && (
                                <div className="absolute z-30 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                                  {personaSuggestions.map((p) => (
                                    <button key={p.PERSONA_ID} onClick={() => seleccionarPersona(p, idx)}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                                      <span className="block text-sm font-medium text-text-main">{p.NOMBRE_COMPLETO}</span>
                                      <span className="block text-xs text-text-sec">DNI {p.DNI || '-'}{p.COLEGIADO_ID ? ' · Colegiado' : ''}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {showPersonaSuggestions && personaSearchIdx === idx && personaSuggestions.length === 0 && personaSearchValue.length >= 2 && (
                                <div className="absolute z-30 w-full mt-1 bg-white border border-border rounded-lg shadow-lg">
                                  <button onClick={() => { setPersonaSearchValue(''); setShowPersonaSuggestions(false); abrirCrearBeneficiario(); }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 text-primary font-medium text-sm border-t border-border">
                                    <span className="flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                      Crear nuevo beneficiario
                                    </span>
                                    <span className="block text-xs text-text-sec mt-0.5 ml-6">Registrar en TPersona (legacy)</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input value={f.dni} onChange={(e) => actualizarFila(f.key, 'dni', e.target.value)} maxLength={8}
                              className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30" />
                          </td>
                          <td className="px-3 py-2">
                            <select value={f.parentesco} onChange={(e) => actualizarFila(f.key, 'parentesco', e.target.value)}
                              className="w-full px-2 py-1.5 border border-border rounded text-sm">
                              <option value="">--</option>
                              {PARENTESCO_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </td>
                          {modalidadBeneficio === 'monto_compartido' && (
                            <td className="px-3 py-2">
                              <input type="number" min={0} max={100} value={f.porcentaje}
                                onChange={(e) => actualizarFila(f.key, 'porcentaje', e.target.value)}
                                className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30" />
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <button onClick={() => {
                              if (modalidadBeneficio === 'monto_unico') return;
                              setFilas(filas.filter((x) => x.key !== f.key));
                            }}
                              disabled={modalidadBeneficio === 'monto_unico'}
                              className="p-1.5 rounded hover:bg-red-50 text-red-500 disabled:opacity-20 disabled:cursor-not-allowed" title="Quitar fila">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {modalidadBeneficio !== 'monto_unico' && (
                  <button onClick={() => {
                    const nueva = nuevaFila();
                    if (modalidadBeneficio === 'opcion_sucesiva') {
                      nueva.porcentaje = '100';
                      nueva.orden = String(filas.length + 1);
                    }
                    setFilas([...filas, nueva]);
                  }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary border border-primary/40 rounded-lg hover:bg-primary/5 mt-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Agregar beneficiario
                  </button>
                )}
                <p className="text-xs text-text-sec mt-3">Las im&aacute;genes (DNI, carta declaratoria, sucesi&oacute;n) pueden completarse luego desde la secci&oacute;n Beneficiarios.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* PASO 3 */}
      {paso === 3 && (
        <div className="bg-white border border-border rounded-lg p-6 space-y-4">
          <h3 className="font-semibold text-text-main">Datos de la solicitud</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border">
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Carta N&deg; *</label>
              <select value={solicitud.cartaNumero} onChange={(e) => {
                const carta = catalogoCartas.find((c: any) => c.numero === e.target.value);
                setSolicitud({ ...solicitud, cartaNumero: e.target.value, cartaFecha: carta?.fecha ? new Date(carta.fecha).toISOString().slice(0, 10) : '' });
              }} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="">-- Seleccionar carta --</option>
                {catalogoCartas.map((c: any) => (
                  <option key={c.id} value={c.numero}>{c.numero}{c.referencia ? ` — ${c.referencia}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha carta</label>
              <input type="date" value={solicitud.cartaFecha} onChange={(e) => setSolicitud({ ...solicitud, cartaFecha: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Expediente N&deg;</label>
              <input value={solicitud.expedienteNumero} onChange={(e) => setSolicitud({ ...solicitud, expedienteNumero: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Memorando N&deg; *</label>
              <select value={solicitud.memorandoNumero} onChange={(e) => {
                const mem = catalogoMemorandos.find((m: any) => m.numero === e.target.value);
                setSolicitud({ ...solicitud, memorandoNumero: e.target.value, memorandoFecha: mem?.fecha ? new Date(mem.fecha).toISOString().slice(0, 10) : '' });
              }} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="">-- Seleccionar memorándum --</option>
                {catalogoMemorandos.map((m: any) => (
                  <option key={m.id} value={m.numero}>{m.numero}{m.asunto ? ` — ${m.asunto}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha memorando</label>
              <input type="date" value={solicitud.memorandoFecha} onChange={(e) => setSolicitud({ ...solicitud, memorandoFecha: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Forma de pago</label>
              <select value={solicitud.formaPago} onChange={(e) => setSolicitud({ ...solicitud, formaPago: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                <option value="">--</option>
                {['TRANSFERENCIA', 'DEPOSITO', 'CHEQUE', 'EFECTIVO'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Banco</label>
              <input value={solicitud.banco} onChange={(e) => setSolicitud({ ...solicitud, banco: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-sec uppercase mb-1">Fecha orden de pago</label>
              <input type="date" value={solicitud.ordenPagoFecha} onChange={(e) => setSolicitud({ ...solicitud, ordenPagoFecha: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-sec uppercase mb-1">Observaciones</label>
            <textarea value={solicitud.observaciones} onChange={(e) => setSolicitud({ ...solicitud, observaciones: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          </div>
        </div>
      )}

      {/* PASO 4 */}
      {paso === 4 && colegiado && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-lg p-6">
            <h3 className="font-semibold text-text-main mb-2">Colegiado</h3>
            <p className="text-sm text-text-main font-medium">{colegiado.NOMBRE_COLEGIADO}</p>
            <p className="text-xs text-text-sec">CIP {colegiado.NUM_COLEGIATURA} · DNI {colegiado.DNI || '-'}</p>
          </div>
          <div className="bg-white border border-border rounded-lg p-6">
            <h3 className="font-semibold text-text-main mb-3">
              Beneficiarios ({filas.filter((f) => f.nombre.trim()).length}) · {MODALIDAD_LABEL[modalidadBeneficio]}
              {modalidadBeneficio === 'monto_compartido' && <> · Suma {sumaPorcentajes}%</>}
            </h3>
            <ul className="space-y-2">
              {filas.filter((f) => f.nombre.trim()).map((f, idx) => (
                <li key={f.key} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                  <span className="text-text-main">
                    {modalidadBeneficio === 'opcion_sucesiva' && <span className="text-xs font-bold text-primary mr-1">#{idx + 1}</span>}
                    {f.nombre} <span className="text-text-sec">· {f.parentesco}{f.dni ? ` · DNI ${f.dni}` : ''}{f.id ? ' · (existente)' : ' · (nuevo)'}</span>
                  </span>
                  <span className="font-semibold text-primary">
                    {modalidadBeneficio === 'monto_compartido' ? `${f.porcentaje}%` : '100%'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border border-border rounded-lg p-6">
            <h3 className="font-semibold text-text-main mb-2">Solicitud</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-text-sec">Evento:</span><span className="text-text-main font-medium">{tipos.find((t) => t.id === solicitud.tipoBeneficioConfigId)?.nombre || '-'}</span>
              <span className="text-text-sec">Monto:</span><span className="text-text-main font-medium">S/ {Number(solicitud.monto).toFixed(2)}</span>
              <span className="text-text-sec">Modalidad:</span><span className="text-text-main font-medium">{MODALIDAD_LABEL[modalidadBeneficio]}</span>
              {solicitud.cartaNumero && <><span className="text-text-sec">Carta N&deg;:</span><span className="text-text-main">{solicitud.cartaNumero}</span></>}
              {solicitud.expedienteNumero && <><span className="text-text-sec">Expediente:</span><span className="text-text-main">{solicitud.expedienteNumero}</span></>}
              {solicitud.formaPago && <><span className="text-text-sec">Forma de pago:</span><span className="text-text-main">{solicitud.formaPago}</span></>}
            </div>
          </div>
        </div>
      )}

      {/* Navegacion */}
      <div className="flex items-center justify-between">
        <button onClick={anterior} disabled={paso === 1}
          className="px-5 py-2 text-sm font-medium text-text-sec bg-white border border-border rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
          Anterior
        </button>
        {paso < 4 ? (
          <button onClick={siguiente} className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90">
            Siguiente
          </button>
        ) : (
          <button onClick={confirmar} disabled={guardando}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Confirmar registro'}
          </button>
        )}
      </div>
    </div>
  );
}
