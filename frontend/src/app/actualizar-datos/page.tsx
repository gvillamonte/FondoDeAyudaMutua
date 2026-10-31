'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import api from '@/lib/api';
import {
  validarEmail,
  validarCelular,
  validarFechas,
  detectarSexoPorNombre,
  normalizarEstadoCivil,
} from '@/lib/validadores-actualizacion';

interface ColegiadoData {
  colegiadoId: string;
  cip: string;
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  especialidad: string;
  estadoColegiatura: string;
  habilitado: boolean;
  fechaUltimoPago: string | null;
  fechaHabilitado: string | null;
  fechaIngreso: string | null;
  email: string;
  celular: string;
  fechaNacimiento: string;
  sexo: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  referencia: string;
  estadoCivil: string;
  estadoCivilCodigo: string;
  tieneActualizacionPrevia: boolean;
  ultimaActualizacionFecha: string | null;
}

interface CipInfo {
  valido: boolean;
  cip: string;
  nombreEnmascarado: string;
  especialidad: string;
  estadoColegiatura: string;
  habilitado: boolean;
}

type PasoVerificacion = 'CIP' | 'DNI' | 'FORM';

function formatearFechaDisplay(f: string | null | undefined): string {
  if (!f) return 'No registrada';
  const parte = f.slice(0, 10);
  const match = parte.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return parte;
}

export default function ActualizarDatosPage() {
  // Flujo en pasos: Primero CIP, luego DNI, luego Formulario
  const [paso, setPaso] = useState<PasoVerificacion>('CIP');

  // Estados de consulta
  const [cip, setCip] = useState('');
  const [dni, setDni] = useState('');
  const [cipInfo, setCipInfo] = useState<CipInfo | null>(null);

  const [verificandoCip, setVerificandoCip] = useState(false);
  const [verificandoDni, setVerificandoDni] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState('');

  // Datos recuperados completos
  const [colegiado, setColegiado] = useState<ColegiadoData | null>(null);

  // Catálogos
  const [ubigeos, setUbigeos] = useState<any[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [estadosCiviles, setEstadosCiviles] = useState<{ codigo: string; nombre: string }[]>([]);

  // Formulario de edición
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [sexo, setSexo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [provincia, setProvincia] = useState('');
  const [distrito, setDistrito] = useState('');
  const [referencia, setReferencia] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');

  // Modales y estados de guardado
  const [showTerminosModal, setShowTerminosModal] = useState(false);
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [resumenExito, setResumenExito] = useState<any | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState('');

  // Estados de validación en tiempo real y banner central
  const [erroresValidacionCentral, setErroresValidacionCentral] = useState<string[]>([]);
  const [errorEmail, setErrorEmail] = useState('');
  const [sugerenciaEmail, setSugerenciaEmail] = useState('');
  const [errorCelular, setErrorCelular] = useState('');
  const [errorFechas, setErrorFechas] = useState('');
  const [infoSexo, setInfoSexo] = useState('');
  const centroErroresRef = useRef<HTMLDivElement>(null);

  // Carga inicial de catálogos
  useEffect(() => {
    api
      .get('/actualizacion-datos/catalogos')
      .then((res) => {
        const uList = res.data?.ubigeos || [];
        setUbigeos(uList);
        const deps = (
          Array.from(new Set(uList.map((u: any) => u.departamento))).filter(Boolean) as string[]
        ).sort();
        setDepartamentos(deps);
        if (res.data?.estadosCiviles) {
          setEstadosCiviles(res.data.estadosCiviles);
        }
      })
      .catch((err) => {
        console.warn('No se pudieron cargar catálogos:', err.message);
      });
  }, []);

  // Provincias sincronizadas según departamento seleccionado
  const provincias = useMemo(() => {
    if (!departamento || ubigeos.length === 0) return [];
    return (
      Array.from(
        new Set(
          ubigeos
            .filter((u: any) => u.departamento?.toUpperCase() === departamento.toUpperCase())
            .map((u: any) => u.provincia)
        )
      ).filter(Boolean) as string[]
    ).sort();
  }, [departamento, ubigeos]);

  // Distritos sincronizados según departamento y provincia seleccionados
  const distritos = useMemo(() => {
    if (!departamento || !provincia || ubigeos.length === 0) return [];
    return (
      Array.from(
        new Set(
          ubigeos
            .filter(
              (u: any) =>
                u.departamento?.toUpperCase() === departamento.toUpperCase() &&
                u.provincia?.toUpperCase() === provincia.toUpperCase()
            )
            .map((u: any) => u.distrito)
        )
      ).filter(Boolean) as string[]
    ).sort();
  }, [departamento, provincia, ubigeos]);

  // PASO 1: Verificar únicamente el N° CIP
  const handleVerificarCip = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorConsulta('');
    const cipLimpio = cip.trim();

    if (!cipLimpio) {
      setErrorConsulta('Por favor ingrese su número de CIP.');
      return;
    }

    setVerificandoCip(true);
    try {
      const res = await api.post('/actualizacion-datos/verificar-cip', {
        cip: cipLimpio,
      });

      setCipInfo(res.data);
      setPaso('DNI');
      setErrorConsulta('');
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        `No se encontró ningún colegiado activo con el N° CIP ${cipLimpio}.`;
      setErrorConsulta(msg);
    } finally {
      setVerificandoCip(false);
    }
  };

  // PASO 2: Confirmar identidad con el DNI del titular
  const handleVerificarDni = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorConsulta('');
    const dniLimpio = dni.trim();

    if (!dniLimpio || dniLimpio.length < 8) {
      setErrorConsulta('Por favor ingrese un DNI válido de 8 dígitos.');
      return;
    }

    setVerificandoDni(true);
    try {
      const res = await api.post('/actualizacion-datos/consultar', {
        cip: cip.trim(),
        dni: dniLimpio,
      });

      const data: ColegiadoData = res.data;
      setColegiado(data);
      setEmail(data.email || '');
      setCelular(data.celular || '');
      setFechaNacimiento(data.fechaNacimiento ? data.fechaNacimiento.slice(0, 10) : '');

      // Detección inteligente y contextual de sexo según el nombre del colegiado
      const deteccion = detectarSexoPorNombre(
        data.nombres || data.nombreCompleto,
        data.sexo,
      );

      let sexoInicial = data.sexo || '';
      let mensajeSexo = '';
      if (!sexoInicial && deteccion.sexoDetectado) {
        sexoInicial = deteccion.sexoDetectado;
        mensajeSexo = `ℹ️ Sugerido automáticamente como ${sexoInicial === 'M' ? 'Masculino' : 'Femenino'} según su nombre ("${data.nombres || data.nombreCompleto}"). Puede modificarlo libremente.`;
      } else if (sexoInicial && deteccion.confianza === 'ALTA' && deteccion.sexoDetectado !== sexoInicial) {
        // Corrección de discrepancia evidente con legado (ej. GUIDO con 'F' erróneo)
        sexoInicial = deteccion.sexoDetectado;
        mensajeSexo = `ℹ️ Detectado como ${sexoInicial === 'M' ? 'Masculino' : 'Femenino'} según su nombre ("${data.nombres || data.nombreCompleto}"). Puede modificarlo si lo requiere.`;
      } else if (sexoInicial) {
        mensajeSexo = 'Según registro de colegiatura. Puede modificarlo si es necesario.';
      } else {
        mensajeSexo = 'Por favor seleccione su sexo según DNI.';
      }

      setSexo(sexoInicial);
      setInfoSexo(mensajeSexo);
      setDireccion(data.direccion || '');
      setReferencia(data.referencia || '');
      const depIni = data.departamento || 'CUSCO';
      const provIni = data.provincia || 'CUSCO';
      const distIni = data.distrito || 'WANCHAQ';
      setDepartamento(depIni);
      setProvincia(provIni);
      setDistrito(distIni);
      const ecNormalizado = normalizarEstadoCivil(data.estadoCivil, data.estadoCivilCodigo);
      setEstadoCivil(ecNormalizado || 'Soltero(a)');
      setPaso('FORM');
      setErrorConsulta('');
      setErroresValidacionCentral([]);
      setErrorEmail('');
      setSugerenciaEmail('');
      setErrorCelular('');
      setErrorFechas('');
      setAceptoTerminos(false);
      setShowTerminosModal(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        `El DNI ingresado no coincide con el titular del N° CIP ${cip.trim()}.`;
      setErrorConsulta(msg);
    } finally {
      setVerificandoDni(false);
    }
  };

  // Validaciones en tiempo real para inputs
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (!val) {
      setErrorEmail('');
      setSugerenciaEmail('');
      return;
    }
    const r = validarEmail(val);
    if (!r.valido) {
      setErrorEmail(r.mensaje || '');
      setSugerenciaEmail(r.sugerenciaCorreccion || '');
    } else {
      setErrorEmail('');
      setSugerenciaEmail('');
    }
  };

  const handleCelularChange = (val: string) => {
    const soloNum = val.replace(/\D/g, '').slice(0, 9);
    setCelular(soloNum);
    if (!soloNum) {
      setErrorCelular('');
      return;
    }
    if (soloNum.length === 9) {
      const r = validarCelular(soloNum);
      setErrorCelular(r.valido ? '' : (r.mensaje || ''));
    } else {
      setErrorCelular(`Faltan ${9 - soloNum.length} dígitos para completar los 9 dígitos.`);
    }
  };

  const handleFechaNacimientoChange = (val: string) => {
    setFechaNacimiento(val);
    if (!val) {
      setErrorFechas('');
      return;
    }
    const r = validarFechas(val, colegiado?.fechaIngreso);
    setErrorFechas(r.valido ? '' : (r.mensaje || ''));
  };

  // Abrir modal de confirmación con validación exhaustiva
  const handlePreGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorGuardar('');
    const listaErrores: string[] = [];

    // 1. Validar Correo Electrónico
    const resEmail = validarEmail(email);
    if (!resEmail.valido) {
      listaErrores.push(`Correo Electrónico: ${resEmail.mensaje || 'Formato de correo no válido.'}`);
      setErrorEmail(resEmail.mensaje || '');
    } else {
      setErrorEmail('');
    }

    // 2. Validar Celular (9 dígitos peruanos, no secuencias ni números repetitivos de prueba)
    const resCelular = validarCelular(celular);
    if (!resCelular.valido) {
      listaErrores.push(`Número Celular: ${resCelular.mensaje || 'Debe ser un número celular peruano válido de 9 dígitos.'}`);
      setErrorCelular(resCelular.mensaje || '');
    } else {
      setErrorCelular('');
    }

    // 3. Validar Fecha de Nacimiento vs Fecha de Colegiatura
    const resFechas = validarFechas(fechaNacimiento, colegiado?.fechaIngreso);
    if (!resFechas.valido) {
      listaErrores.push(`Fecha de Nacimiento: ${resFechas.mensaje || 'Inconsistencia en fecha de nacimiento.'}`);
      setErrorFechas(resFechas.mensaje || '');
    } else {
      setErrorFechas('');
    }

    // 4. Validar Sexo (Obligatorio)
    if (!sexo) {
      listaErrores.push('Sexo: Debe seleccionar Masculino o Femenino según su documento de identidad.');
    }

    // 5. Validar Aceptación de Términos y Condiciones
    if (!aceptoTerminos) {
      listaErrores.push('Términos y Condiciones: Debe aceptar la Declaración Jurada de Veracidad para actualizar sus datos.');
    }

    // Si existen observaciones, mostrarlas en el banner central y hacer scroll suave hacia él
    if (listaErrores.length > 0) {
      setErroresValidacionCentral(listaErrores);
      setTimeout(() => {
        if (centroErroresRef.current) {
          centroErroresRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    // Sin inconsistencias: limpiar advertencias y abrir modal de confirmación
    setErroresValidacionCentral([]);
    setShowConfirmModal(true);
  };

  // Guardar definitivamente
  const handleConfirmarGuardar = async () => {
    if (!colegiado) return;
    setGuardando(true);
    setErrorGuardar('');

    try {
      const res = await api.post('/actualizacion-datos/actualizar', {
        cip: colegiado.cip,
        dni: colegiado.dni,
        email: email.trim(),
        celular: celular.trim(),
        fechaNacimiento: fechaNacimiento ? fechaNacimiento : undefined,
        sexo: sexo || undefined,
        direccion: direccion ? direccion.trim() : undefined,
        departamento: departamento ? departamento.trim() : undefined,
        provincia: provincia ? provincia.trim() : undefined,
        distrito: distrito ? distrito.trim() : undefined,
        referencia: referencia ? referencia.trim() : undefined,
        estadoCivil: estadoCivil ? estadoCivil.trim() : undefined,
      });

      const dataGuardada = res.data?.data || res.data;
      setResumenExito({
        ...dataGuardada,
        emailEnviado: res.data?.emailEnviado,
        message: res.data?.message,
      });
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Ocurrió un error al guardar los datos. Intente nuevamente.';
      setErrorGuardar(msg);
    } finally {
      setGuardando(false);
    }
  };

  // Reiniciar todo el proceso desde el Paso 1 (CIP)
  const handleReiniciar = () => {
    setPaso('CIP');
    setColegiado(null);
    setCipInfo(null);
    setCip('');
    setDni('');
    setEmail('');
    setCelular('');
    setFechaNacimiento('');
    setSexo('');
    setDireccion('');
    setReferencia('');
    setDepartamento('');
    setProvincia('');
    setDistrito('');
    setEstadoCivil('');
    setErrorConsulta('');
    setErrorGuardar('');
    setErroresValidacionCentral([]);
    setErrorEmail('');
    setSugerenciaEmail('');
    setErrorCelular('');
    setErrorFechas('');
    setInfoSexo('');
    setShowTerminosModal(false);
    setAceptoTerminos(false);
    setShowConfirmModal(false);
  };

  // Al cerrar el modal de confirmación exitosa: Volver al inicio (Paso 1)
  const handleCerrarExitoYVolverAlInicio = () => {
    setShowSuccessModal(false);
    handleReiniciar();
  };

  // Regresar de Paso 2 (DNI) a Paso 1 (CIP)
  const handleRegresarACip = () => {
    setPaso('CIP');
    setErrorConsulta('');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Header Institucional */}
      <header className="border-b sticky top-0 z-30 shadow-sm" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-sm"
              style={{ backgroundColor: '#3258CA' }}
            >
              CIP
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight" style={{ color: '#1E293B' }}>
                Colegio de Ingenieros del Perú
              </h1>
              <p className="text-xs" style={{ color: '#64748B' }}>
                Actualización de Datos
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Informativo */}
        <div
          className="rounded-xl p-5 mb-8 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
        >
          <div className="flex items-start gap-3.5">
            <div
              className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
              style={{ backgroundColor: '#EFF6FF', color: '#3258CA' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#1E293B' }}>
                Actualización Oficial de Datos del Colegiado
              </h2>
              <p className="text-xs sm:text-sm mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>
                Estimado Ingeniero, ingrese primero su <strong>N° de CIP</strong> y luego confirme su <strong>DNI</strong> para validar su identidad y actualizar su contacto, residencia, filiación y estado civil.
              </p>
            </div>
          </div>
        </div>

        {/* Indicador Visual de Pasos */}
        <div className="max-w-xl mx-auto mb-6">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-slate-200 -z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 transition-all duration-300 -z-0"
              style={{
                backgroundColor: '#3258CA',
                width: paso === 'CIP' ? '0%' : paso === 'DNI' ? '50%' : '100%',
              }}
            />

            {/* Paso 1: CIP */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  paso === 'CIP'
                    ? 'ring-4 ring-blue-100 text-white'
                    : 'text-white'
                }`}
                style={{ backgroundColor: '#3258CA' }}
              >
                {paso === 'CIP' ? '1' : '✓'}
              </div>
              <span className="text-xs font-semibold mt-1.5" style={{ color: '#1E293B' }}>
                1. N° CIP
              </span>
            </div>

            {/* Paso 2: DNI */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  paso === 'DNI'
                    ? 'ring-4 ring-blue-100 text-white'
                    : paso === 'FORM'
                    ? 'text-white'
                    : 'bg-white border-2 text-slate-400'
                }`}
                style={{
                  backgroundColor: paso === 'CIP' ? '#FFFFFF' : '#3258CA',
                  borderColor: paso === 'CIP' ? '#CBD5E1' : '#3258CA',
                }}
              >
                {paso === 'FORM' ? '✓' : '2'}
              </div>
              <span
                className="text-xs font-semibold mt-1.5"
                style={{ color: paso === 'CIP' ? '#94A3B8' : '#1E293B' }}
              >
                2. DNI
              </span>
            </div>

            {/* Paso 3: Formulario */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  paso === 'FORM'
                    ? 'ring-4 ring-blue-100 text-white'
                    : 'bg-white border-2 text-slate-400'
                }`}
                style={{
                  backgroundColor: paso === 'FORM' ? '#3258CA' : '#FFFFFF',
                  borderColor: paso === 'FORM' ? '#3258CA' : '#CBD5E1',
                }}
              >
                3
              </div>
              <span
                className="text-xs font-semibold mt-1.5"
                style={{ color: paso === 'FORM' ? '#1E293B' : '#94A3B8' }}
              >
                3. Actualización
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* PASO 1: Ingreso de N° CIP */}
        {/* ============================================================== */}
        {paso === 'CIP' && (
          <div className="max-w-md mx-auto">
            <div
              className="rounded-xl border shadow-sm p-6 sm:p-8"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
            >
              <div className="text-center mb-6">
                <div
                  className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3"
                  style={{ backgroundColor: '#EFF6FF', color: '#3258CA' }}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                </div>
                <h3 className="text-base font-bold" style={{ color: '#1E293B' }}>
                  Paso 1: Ingrese su N° de Colegiatura (CIP)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Ingrese su número de CIP para verificar su registro en el padrón institucional.
                </p>
              </div>

              <form onSubmit={handleVerificarCip} className="space-y-4">
                {errorConsulta && (
                  <div
                    className="p-3.5 rounded-lg text-xs sm:text-sm border flex items-start gap-2.5"
                    style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{errorConsulta}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#1E293B' }}>
                    Número de CIP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={cip}
                    onChange={(e) => setCip(e.target.value.replace(/\D/g, ''))}
                    placeholder="Nro de CIP"
                    required
                    autoFocus
                    className="w-full px-4 py-3 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent font-mono tracking-wider text-center"
                    style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                  />
                  <p className="text-xs text-slate-500 mt-1 text-center">
                    Solo números, tal como figura en su carné de colegiado.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={verificandoCip || !cip.trim()}
                  className="w-full py-3 rounded-lg text-white font-medium text-sm transition-colors duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: '#3258CA' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2848A8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3258CA'; }}
                >
                  {verificandoCip ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verificando CIP...
                    </>
                  ) : (
                    <>
                      Continuar al Paso 2
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 2: Confirmación con DNI */}
        {/* ============================================================== */}
        {paso === 'DNI' && cipInfo && (
          <div className="max-w-md mx-auto">
            <div
              className="rounded-xl border shadow-sm p-6 sm:p-8"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
            >
              {/* Tarjeta de Colegiado Encontrado */}
              <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 mb-5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-blue-700 text-xs font-semibold mb-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Colegiado Encontrado</span>
                </div>
                <p className="font-bold text-slate-900 text-sm">{cipInfo.nombreEnmascarado}</p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-600 mt-1">
                  <span>CIP: <strong className="font-mono text-slate-800">{cipInfo.cip}</strong></span>
                  <span>•</span>
                  <span className="font-medium text-slate-700">{cipInfo.especialidad || 'Ingeniería'}</span>
                </div>
              </div>

              <div className="text-center mb-5">
                <h3 className="text-base font-bold" style={{ color: '#1E293B' }}>
                  Paso 2: Confirme su Identidad con su DNI
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Para acceder a su ficha y autorizar la actualización, ingrese los 8 dígitos de su Documento Nacional de Identidad.
                </p>
              </div>

              <form onSubmit={handleVerificarDni} className="space-y-4">
                {errorConsulta && (
                  <div
                    className="p-3.5 rounded-lg text-xs sm:text-sm border flex items-start gap-2.5"
                    style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{errorConsulta}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#1E293B' }}>
                    Documento Nacional de Identidad (DNI) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                    placeholder="8 dígitos numéricos"
                    required
                    autoFocus
                    className="w-full px-4 py-3 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent font-mono tracking-wider text-center"
                    style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                  />
                  <p className="text-xs text-slate-500 mt-1 text-center">
                    Debe coincidir con el titular del N° CIP {cipInfo.cip}.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRegresarACip}
                    className="px-4 py-3 rounded-lg border text-sm font-medium hover:bg-slate-50 text-slate-700"
                    style={{ borderColor: '#E2E8F0' }}
                  >
                    ← Cambiar CIP
                  </button>

                  <button
                    type="submit"
                    disabled={verificandoDni || dni.length !== 8}
                    className="flex-1 py-3 rounded-lg text-white font-medium text-sm transition-colors duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: '#3258CA' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2848A8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3258CA'; }}
                  >
                    {verificandoDni ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Validando DNI...
                      </>
                    ) : (
                      <>
                        Validar y Abrir Ficha
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 3: Ficha Completa y Formulario de Actualización */}
        {/* ============================================================== */}
        {paso === 'FORM' && colegiado && (
          <div className="space-y-6">
            {/* Tarjeta de Ficha Institucional */}
            <div
              className="rounded-xl border shadow-sm overflow-hidden"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
            >
              <div
                className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
                    style={{ backgroundColor: '#3258CA' }}
                  >
                    {colegiado.nombres ? colegiado.nombres[0] : 'C'}
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight" style={{ color: '#1E293B' }}>
                      {colegiado.nombreCompleto}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {colegiado.especialidad || 'Ingeniería'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      colegiado.habilitado
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    ● {colegiado.estadoColegiatura || (colegiado.habilitado ? 'HABILITADO' : 'NO HABILITADO')}
                  </span>
                  <button
                    type="button"
                    onClick={handleReiniciar}
                    className="px-3 py-1 text-xs border rounded-lg hover:bg-slate-100 font-medium"
                    style={{ borderColor: '#E2E8F0', color: '#64748B' }}
                  >
                    Consultar Otro CIP
                  </button>
                </div>
              </div>

              {/* Grid de Datos del Colegiado */}
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">N° Colegiatura (CIP)</span>
                  <span className="font-mono font-bold text-slate-800 text-sm sm:text-base">{colegiado.cip}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">DNI</span>
                  <span className="font-mono font-bold text-slate-800 text-sm sm:text-base">{colegiado.dni}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">Fecha de Colegiatura</span>
                  <span className="font-semibold text-slate-800">{formatearFechaDisplay(colegiado.fechaIngreso)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">Fecha Último Pago</span>
                  <span className="font-semibold text-slate-800">{formatearFechaDisplay(colegiado.fechaUltimoPago)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">Habilitado Hasta</span>
                  <span className="font-semibold text-emerald-700">
                    {colegiado.fechaHabilitado ? formatearFechaDisplay(colegiado.fechaHabilitado) : 'Al día'}
                  </span>
                </div>
              </div>

              {colegiado.tieneActualizacionPrevia && colegiado.ultimaActualizacionFecha && (
                <div className="px-6 py-2.5 bg-blue-50/60 border-t border-blue-100 text-xs text-blue-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Última actualización de datos registrada: <strong>{new Date(colegiado.ultimaActualizacionFecha).toLocaleString('es-PE')}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Formulario de Actualización */}
            <div
              className="rounded-xl border shadow-sm overflow-hidden"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
            >
              <div
                className="px-6 py-4 border-b flex items-center gap-2"
                style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
              >
                <svg className="w-5 h-5" style={{ color: '#3258CA' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <h3 className="font-semibold text-sm" style={{ color: '#1E293B' }}>
                  Formulario de Actualización de Datos
                </h3>
              </div>

              <form onSubmit={handlePreGuardar} className="p-6 space-y-6">
                {/* BANNER CENTRAL DE OBSERVACIONES E INCONSISTENCIAS */}
                {erroresValidacionCentral.length > 0 && (
                  <div
                    ref={centroErroresRef}
                    className="p-5 rounded-xl border-2 shadow-sm animate-fade-in"
                    style={{ backgroundColor: '#FEF2F2', borderColor: '#DC2626' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-red-900 mb-1">
                          Se detectaron observaciones en sus datos que debe verificar antes de guardar:
                        </h4>
                        <p className="text-xs text-red-700 mb-3">
                          Para garantizar la veracidad del padrón oficial y el correcto despacho de su constancia, corrija los siguientes puntos:
                        </p>
                        <ul className="space-y-1.5 text-xs text-red-800 list-disc list-inside">
                          {erroresValidacionCentral.map((err, idx) => (
                            <li key={idx} className="leading-relaxed font-semibold">
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {errorGuardar && (
                  <div
                    className="p-3.5 rounded-lg text-xs sm:text-sm border flex items-start gap-2.5"
                    style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#DC2626' }}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{errorGuardar}</span>
                  </div>
                )}

                {/* Sección 1: Datos de Contacto */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    1. Información de Contacto
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Correo Electrónico */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#1E293B' }}>
                          Correo Electrónico <span className="text-red-500">*</span>
                        </label>
                        {email && !errorEmail && (
                          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Válido
                          </span>
                        )}
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        required
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                        style={{
                          borderColor: errorEmail ? '#DC2626' : '#E2E8F0',
                          color: '#1E293B',
                          backgroundColor: errorEmail ? '#FFF5F5' : '#FFFFFF',
                        }}
                      />
                      {errorEmail ? (
                        <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                          <span>✕ {errorEmail}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">
                          Medio oficial para notificaciones y constancias institucionales.
                        </p>
                      )}
                      {sugerenciaEmail && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEmail(sugerenciaEmail);
                              setErrorEmail('');
                              setSugerenciaEmail('');
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <span>💡 ¿Quiso decir <u>{sugerenciaEmail}</u>? Clic para aplicar</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Número de Celular */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#1E293B' }}>
                          Número de Celular <span className="text-red-500">*</span>
                        </label>
                        {celular.length === 9 && !errorCelular && (
                          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Válido
                          </span>
                        )}
                      </div>
                      <input
                        type="tel"
                        maxLength={9}
                        value={celular}
                        onChange={(e) => handleCelularChange(e.target.value)}
                        placeholder="Ej. 987654321"
                        required
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent font-mono transition-colors"
                        style={{
                          borderColor: errorCelular ? '#DC2626' : '#E2E8F0',
                          color: '#1E293B',
                          backgroundColor: errorCelular ? '#FFF5F5' : '#FFFFFF',
                        }}
                      />
                      {errorCelular ? (
                        <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                          <span>✕ {errorCelular}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">
                          9 dígitos peruanos para contacto y alertas de aportes. No use números de prueba.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sección 2: Filiación y Estado Civil */}
                <div className="pt-4 border-t" style={{ borderColor: '#E2E8F0' }}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    2. Filiación y Estado Civil
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {/* Fecha de Nacimiento */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#1E293B' }}>
                          Fecha de Nacimiento <span className="text-red-500">*</span>
                        </label>
                        {fechaNacimiento && !errorFechas && (
                          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Válida
                          </span>
                        )}
                      </div>
                      <input
                        type="date"
                        value={fechaNacimiento}
                        onChange={(e) => handleFechaNacimientoChange(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                        style={{
                          borderColor: errorFechas ? '#DC2626' : '#E2E8F0',
                          color: '#1E293B',
                          backgroundColor: errorFechas ? '#FFF5F5' : '#FFFFFF',
                        }}
                      />
                      {errorFechas ? (
                        <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                          <span>✕ {errorFechas}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">
                          {colegiado?.fechaIngreso
                            ? `Fecha de incorporación CIP: ${formatearFechaDisplay(colegiado.fechaIngreso)}. Debe ser anterior.`
                            : 'Fondo de previsión y edad jubilatoria.'}
                        </p>
                      )}
                    </div>

                    {/* Sexo */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#1E293B' }}>
                          Sexo <span className="text-red-500">*</span>
                        </label>
                        {sexo && (
                          <span className="text-xs font-semibold text-slate-600">
                            {sexo === 'M' ? '♂ Masculino' : '♀ Femenino'}
                          </span>
                        )}
                      </div>
                      <select
                        value={sexo}
                        onChange={(e) => {
                          setSexo(e.target.value);
                          setInfoSexo('Modificado manualmente según su preferencia.');
                        }}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                        style={{
                          borderColor: !sexo && erroresValidacionCentral.length > 0 ? '#DC2626' : '#E2E8F0',
                          color: '#1E293B',
                        }}
                      >
                        <option value="">-- Seleccionar Sexo --</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        {infoSexo || 'Según DNI registrado (puede modificarlo si lo requiere).'}
                      </p>
                    </div>

                    {/* Estado Civil */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#1E293B' }}>
                        Estado Civil
                      </label>
                      <select
                        value={normalizarEstadoCivil(estadoCivil) || estadoCivil}
                        onChange={(e) => setEstadoCivil(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                        style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                      >
                        <option value="">-- Seleccionar --</option>
                        {estadosCiviles.length > 0 ? (
                          estadosCiviles.map((ec) => (
                            <option key={ec.codigo} value={ec.nombre}>
                              {ec.nombre}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="Soltero(a)">Soltero(a)</option>
                            <option value="Casado(a)">Casado(a)</option>
                            <option value="Viudo(a)">Viudo(a)</option>
                            <option value="Divorciado(a)">Divorciado(a)</option>
                            <option value="Conviviente">Conviviente</option>
                          </>
                        )}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        Requerido para beneficios de Fondo de Ayuda Mutua.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sección 3: Residencia y Ubicación */}
                <div className="pt-4 border-t" style={{ borderColor: '#E2E8F0' }}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    3. Residencia Domiciliaria y Ubigeo
                  </h4>

                  {/* Fila Departamento, Provincia, Distrito */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
                    {/* Departamento */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#1E293B' }}>
                        Departamento
                      </label>
                      <select
                        value={departamentos.find((d) => d.toUpperCase() === departamento.toUpperCase()) || departamento}
                        onChange={(e) => {
                          setDepartamento(e.target.value);
                          setProvincia('');
                          setDistrito('');
                        }}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                        style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                      >
                        <option value="">-- Seleccionar Departamento --</option>
                        {departamentos.map((dep) => (
                          <option key={dep} value={dep}>
                            {dep}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Provincia */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#1E293B' }}>
                        Provincia
                      </label>
                      <select
                        value={provincias.find((p) => p.toUpperCase() === provincia.toUpperCase()) || provincia}
                        disabled={!departamento}
                        onChange={(e) => {
                          setProvincia(e.target.value);
                          setDistrito('');
                        }}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent bg-white disabled:bg-slate-100 disabled:text-slate-400"
                        style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                      >
                        <option value="">-- Seleccionar Provincia --</option>
                        {provincias.map((prov) => (
                          <option key={prov} value={prov}>
                            {prov}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Distrito */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#1E293B' }}>
                        Distrito
                      </label>
                      <select
                        value={distritos.find((d) => d.toUpperCase() === distrito.toUpperCase()) || distrito}
                        disabled={!provincia}
                        onChange={(e) => setDistrito(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent bg-white disabled:bg-slate-100 disabled:text-slate-400"
                        style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                      >
                        <option value="">-- Seleccionar Distrito --</option>
                        {distritos.map((dist) => (
                          <option key={dist} value={dist}>
                            {dist}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dirección y Referencia */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Dirección */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#1E293B' }}>
                        Dirección Domiciliaria
                      </label>
                      <input
                        type="text"
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                        placeholder="Ej. Av. De la Cultura 750, Urb. Magisterio"
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Avenida, jirón, calle, urbanización, manzana o lote.
                      </p>
                    </div>

                    {/* Referencia */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#1E293B' }}>
                        Referencia de Dirección
                      </label>
                      <input
                        type="text"
                        value={referencia}
                        onChange={(e) => setReferencia(e.target.value)}
                        placeholder="Ej. Frente al parque, al lado de la botica, portón blanco"
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Punto de referencia para correspondencia física.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-end gap-3" style={{ borderColor: '#E2E8F0' }}>
                  <button
                    type="button"
                    onClick={handleReiniciar}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg border text-sm font-medium transition-colors duration-150 hover:bg-slate-50 text-slate-700"
                    style={{ borderColor: '#E2E8F0' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors duration-200 shadow-sm flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#3258CA' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2848A8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3258CA'; }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar Actualización
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* POPUP DE TÉRMINOS Y CONDICIONES / DECLARACIÓN JURADA           */}
      {/* Se muestra tras verificar CIP y DNI antes de editar los datos  */}
      {/* ============================================================== */}
      {showTerminosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div
            className="rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border my-8 bg-white animate-in fade-in zoom-in-95 duration-200"
            style={{ borderColor: '#E2E8F0' }}
          >
            {/* Encabezado del Modal con Branding Institucional */}
            <div
              className="px-6 py-5 border-b flex items-center justify-between"
              style={{ backgroundColor: '#3258CA' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-bold text-sm border border-white/20 shadow-inner">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white tracking-wide">
                    TÉRMINOS Y CONDICIONES — DECLARACIÓN JURADA
                  </h3>
                  <p className="text-xs text-blue-100">
                    Actualización Oficial de Datos • Colegio de Ingenieros del Perú
                  </p>
                </div>
              </div>
            </div>

            {/* Contenido en Letras Grandes y Claras */}
            <div className="p-6 space-y-4">
              {/* Bienvenida personalizada al colegiado */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                <p className="text-sm font-semibold text-blue-900">
                  Estimado(a) Colegiado(a):{' '}
                  <strong className="text-blue-950 font-bold">
                    {colegiado?.nombreCompleto || 'Ingeniero(a)'}
                  </strong>
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800">
                    CIP: {colegiado?.cip || cip}
                  </span>
                  {colegiado?.dni && (
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-slate-700">
                      DNI: {colegiado.dni}
                    </span>
                  )}
                  {colegiado?.fechaIngreso && (
                    <span className="bg-white px-2 py-0.5 rounded border border-blue-200 text-slate-700">
                      Fecha Colegiatura: <strong>{formatearFechaDisplay(colegiado.fechaIngreso)}</strong>
                    </span>
                  )}
                  {colegiado?.fechaUltimoPago && (
                    <span className="bg-white px-2 py-0.5 rounded border border-blue-200 text-slate-700">
                      Fecha Último Pago: <strong>{formatearFechaDisplay(colegiado.fechaUltimoPago)}</strong>
                    </span>
                  )}
                  {colegiado?.estadoColegiatura && (
                    <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-emerald-800 font-semibold">
                      {colegiado.estadoColegiatura}
                    </span>
                  )}
                </div>
                <p className="text-xs text-blue-800 mt-2.5 leading-relaxed">
                  Para proceder con la edición y actualización de sus datos personales en el padrón colegial, es <strong>obligatorio</strong> leer y aceptar los siguientes términos y declaración jurada de veracidad:
                </p>
              </div>

              {/* Cláusulas Estipuladas en Letras Grandes y Legibles */}
              <div
                className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-slate-800 space-y-4 max-h-[50vh] overflow-y-auto text-xs sm:text-sm leading-relaxed"
                style={{ borderColor: '#E2E8F0' }}
              >
                <div>
                  <h5 className="font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 text-xs sm:text-sm mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                      1
                    </span>
                    Declaración Jurada y Responsabilidad Total del Colegiado
                  </h5>
                  <p className="text-slate-700 pl-7 text-xs sm:text-sm">
                    El colegiado declara bajo juramento que toda la información consignada y actualizada (correo electrónico, número celular, fecha de nacimiento, sexo, estado civil, dirección y referencia domiciliaria) es <strong>verídica, legítima, personal y vigente</strong>. El colegiado asume la <strong>responsabilidad total y exclusiva</strong> de consignar datos válidos en este sistema.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <h5 className="font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 text-xs sm:text-sm mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                      2
                    </span>
                    Emisión y Despacho Automático de Constancia por Correo
                  </h5>
                  <p className="text-slate-700 pl-7 text-xs sm:text-sm">
                    Al confirmar y guardar su actualización, el sistema remitirá de forma automática una constancia oficial con <strong>todos los datos registrados</strong> a la dirección de correo electrónico consignada, con el propósito de corroborar y respaldar la información ingresada.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <h5 className="font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 text-xs sm:text-sm mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                      3
                    </span>
                    Exoneración de Responsabilidad Institucional del CIP
                  </h5>
                  <p className="text-slate-700 pl-7 text-xs sm:text-sm">
                    <strong>El Colegio de Ingenieros del Perú NO se hace responsable</strong> en caso de que el colegiado ingrese un correo electrónico erróneo, inactivo o perteneciente a terceras personas, o si proporciona un teléfono o información incorrecta. Toda notificación, alerta o constancia enviada a los medios registrados por el colegiado se considerará <strong>válidamente efectuada</strong> y bajo su total y entera responsabilidad.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <h5 className="font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 text-xs sm:text-sm mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                      4
                    </span>
                    Medida de Seguridad y Alcance Local
                  </h5>
                  <p className="text-slate-700 pl-7 text-xs sm:text-sm">
                    Como medida estricta de seguridad institucional del Colegio de Ingenieros del Perú, esta actualización de datos se procesa de <strong>manera local</strong> y controlada, registrando trazabilidad mediante bitácora de auditoría inmutable para garantizar la integridad y confidencialidad del padrón.
                  </p>
                </div>
              </div>

              {/* Casilla de Aceptación Obligatoria */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aceptoTerminos}
                    onChange={(e) => setAceptoTerminos(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                    He leído, comprendo y acepto en su totalidad los Términos y Condiciones y la Declaración Jurada de Veracidad, responsabilizándome de los datos consignados.
                  </span>
                </label>
              </div>
            </div>

            {/* Footer con Botones de Acción */}
            <div
              className="px-6 py-4 border-t bg-slate-50 flex flex-col sm:flex-row items-center justify-end gap-3"
              style={{ borderColor: '#E2E8F0' }}
            >
              <button
                type="button"
                onClick={handleReiniciar}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-slate-100 text-slate-700"
                style={{ borderColor: '#E2E8F0' }}
              >
                Cancelar y Salir
              </button>
              <button
                type="button"
                disabled={!aceptoTerminos}
                onClick={() => setShowTerminosModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: aceptoTerminos ? '#3258CA' : '#94A3B8' }}
                onMouseEnter={(e) => {
                  if (aceptoTerminos) e.currentTarget.style.backgroundColor = '#2848A8';
                }}
                onMouseLeave={(e) => {
                  if (aceptoTerminos) e.currentTarget.style.backgroundColor = '#3258CA';
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Aceptar y Continuar a la Actualización
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* POPUP DE CONFIRMACIÓN CON TODOS LOS DATOS REGISTRADOS */}
      {/* ============================================================== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div
            className="rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border my-8 bg-white animate-in fade-in zoom-in-95 duration-200"
            style={{ borderColor: '#E2E8F0' }}
          >
            {/* Encabezado del Popup */}
            <div
              className="px-6 py-4 border-b flex items-center justify-between"
              style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm"
                  style={{ backgroundColor: '#3258CA' }}
                >
                  CIP
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 leading-tight">
                    Confirmar Datos Registrados
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Revise toda la información antes del registro oficial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 text-sm font-semibold transition-colors"
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Popup con Todos los Datos */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Tarjeta del Colegiado */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">Colegiado Titular:</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {colegiado?.nombreCompleto}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    CIP: {colegiado?.cip}
                  </span>
                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    DNI: {colegiado?.dni}
                  </span>
                  {colegiado?.fechaIngreso && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      Fecha Colegiatura: <strong className="text-slate-900">{formatearFechaDisplay(colegiado.fechaIngreso)}</strong>
                    </span>
                  )}
                  {colegiado?.fechaUltimoPago && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      Fecha Último Pago: <strong className="text-slate-900">{formatearFechaDisplay(colegiado.fechaUltimoPago)}</strong>
                    </span>
                  )}
                  {colegiado?.especialidad && (
                    <span className="text-slate-600 text-[11px]">
                      • {colegiado.especialidad}
                    </span>
                  )}
                </div>
              </div>

              {/* Lista Detallada de Todos los Datos Registrados */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Datos que se Registrarán en el Padrón:
                </h4>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden text-xs bg-white">
                  <div className="p-2.5 flex justify-between items-center bg-blue-50/40">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Correo Electrónico:
                    </span>
                    <span className="font-bold text-blue-700">{email}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Número Celular:
                    </span>
                    <span className="font-mono font-bold text-green-700">{celular}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">Fecha de Nacimiento:</span>
                    <span className="font-medium text-slate-800">{fechaNacimiento || 'No especificada'}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center bg-slate-50/70">
                    <span className="text-slate-600 font-semibold">Fecha de Colegiatura:</span>
                    <span className="font-medium text-slate-800">{formatearFechaDisplay(colegiado?.fechaIngreso)}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center bg-slate-50/70">
                    <span className="text-slate-600 font-semibold">Fecha Último Pago:</span>
                    <span className="font-medium text-slate-800">{formatearFechaDisplay(colegiado?.fechaUltimoPago)}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">Sexo:</span>
                    <span className="font-medium text-slate-800">
                      {sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : 'No especificado'}
                    </span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">Estado Civil:</span>
                    <span className="font-medium text-slate-800">{estadoCivil || 'No especificado'}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">Departamento:</span>
                    <span className="font-medium text-slate-800">{departamento || 'No especificado'}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">Provincia:</span>
                    <span className="font-medium text-slate-800">{provincia || 'No especificada'}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-center">
                    <span className="text-slate-600 font-semibold">Distrito:</span>
                    <span className="font-medium text-slate-800 font-semibold">{distrito || 'No especificado'}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-start gap-4">
                    <span className="text-slate-600 font-semibold shrink-0">Dirección:</span>
                    <span className="font-medium text-slate-800 text-right">{direccion || 'No especificada'}</span>
                  </div>

                  <div className="p-2.5 flex justify-between items-start gap-4">
                    <span className="text-slate-600 font-semibold shrink-0">Referencia:</span>
                    <span className="font-medium text-slate-800 text-right">{referencia || 'No especificada'}</span>
                  </div>
                </div>
              </div>

              {/* Aviso Informativo del Envío al Correo Registrado */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start gap-3 shadow-sm">
                <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div className="leading-relaxed">
                  <strong className="block text-blue-950 font-bold mb-0.5">
                    Envío automático al correo registrado:
                  </strong>
                  Al presionar <span className="font-bold text-slate-900">"Confirmar y Guardar"</span>, se guardará toda la información en el sistema oficial del CIP y <strong className="underline text-blue-800">le llegará de inmediato una constancia con todos estos datos</strong> al correo registrado: <strong className="text-blue-900 font-bold">{email}</strong>.
                </div>
              </div>

              {/* Mensaje de Error en caso ocurra */}
              {errorGuardar && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errorGuardar}</span>
                </div>
              )}
            </div>

            {/* Footer con Botones de Acción */}
            <div className="px-6 py-4 border-t bg-slate-50 flex flex-col sm:flex-row items-center justify-end gap-2.5" style={{ borderColor: '#E2E8F0' }}>
              <button
                type="button"
                disabled={guardando}
                onClick={() => setShowConfirmModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-semibold border bg-white hover:bg-slate-100 text-slate-700 transition-colors shadow-sm"
                style={{ borderColor: '#E2E8F0' }}
              >
                Modificar Datos
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={handleConfirmarGuardar}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: '#16A34A' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#15803D'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#16A34A'; }}
              >
                {guardando ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Guardando y enviando correo...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Confirmar y Guardar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE ÉXITO: CONFIRMACIÓN Y RETORNO AL INICIO (PASO 1) */}
      {/* ============================================================== */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div
            className="rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border bg-white my-8 animate-in fade-in zoom-in-95 duration-200"
            style={{ borderColor: '#E2E8F0' }}
          >
            {/* Header del Modal con Verde Éxito */}
            <div className="p-6 text-center border-b" style={{ backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }}>
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                ¡Actualización Registrada con Éxito!
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Los datos han sido guardados en el sistema oficial del Colegio de Ingenieros del Perú.
              </p>
            </div>

            {/* Resumen de Datos Actualizados y Notificación de Envío */}
            <div className="p-6 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
              {/* Notificación de Correo Enviado */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-xs text-green-900 flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div className="leading-relaxed">
                  <span className="font-bold block text-green-950">Constancia enviada por correo:</span>
                  Se ha enviado una constancia oficial con <strong className="text-green-950">toda la información registrada</strong> a su correo: <strong className="font-bold underline text-green-800">{resumenExito?.email || email}</strong>.
                </div>
              </div>

              {/* Resumen de la información registrada */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Colegiado:</span>
                  <span className="font-bold text-slate-900">{resumenExito?.nombres || colegiado?.nombreCompleto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">N° CIP / DNI:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {resumenExito?.cip || colegiado?.cip} • {resumenExito?.dni || colegiado?.dni}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Correo Electrónico:</span>
                  <span className="font-medium text-blue-700">{resumenExito?.email || email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Número Celular:</span>
                  <span className="font-mono font-bold text-green-700">{resumenExito?.celular || celular}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha Nacimiento:</span>
                  <span className="font-medium text-slate-800">{resumenExito?.fechaNacimiento || fechaNacimiento || 'No especificada'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sexo:</span>
                  <span className="font-medium text-slate-800">
                    {sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : 'No especificado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estado Civil:</span>
                  <span className="font-medium text-slate-800">{resumenExito?.estadoCivil || estadoCivil || 'No especificado'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ubicación (Dep / Prov / Dist):</span>
                  <span className="font-medium text-slate-800">
                    {[departamento, provincia, distrito].filter(Boolean).join(' / ') || 'No especificada'}
                  </span>
                </div>
                {direccion && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dirección:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[220px]">{direccion}</span>
                  </div>
                )}
                {referencia && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Referencia:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[220px]">{referencia}</span>
                  </div>
                )}
              </div>

              <p className="text-center text-slate-500 text-xs">
                Al hacer clic en aceptar, regresará al inicio para ingresar un nuevo CIP y DNI si desea realizar otra consulta.
              </p>
            </div>

            {/* Footer con Botón para Volver al Inicio */}
            <div className="p-4 border-t bg-slate-50 flex justify-center" style={{ borderColor: '#E2E8F0' }}>
              <button
                type="button"
                onClick={handleCerrarExitoYVolverAlInicio}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: '#3258CA' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2848A8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3258CA'; }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Aceptar y Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Institucional */}
      <footer className="border-t py-6 mt-auto" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
          Colegio de Ingenieros del Perú — Consejo Departamental. Actualización de Datos.
        </div>
      </footer>
    </div>
  );
}
