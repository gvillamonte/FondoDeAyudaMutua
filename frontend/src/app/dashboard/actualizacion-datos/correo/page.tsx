'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface EmailConfig {
  asunto: string;
  nombreRemitente: string;
  correoRemitente?: string;
  colorPrimario: string;
  colorSecundario: string;
  colorFondo: string;
  colorTexto: string;
  colorBorde: string;
  colorAlertaBg: string;
  colorAlertaTexto: string;
  tituloInstitucional: string;
  subtituloInstitucional: string;
  mensajeBienvenida: string;
  avisoSeguridad: string;
  piePagina: string;
  logoTipo: 'default' | 'custom' | 'none';
  logoBase64?: string | null;
  logoMime?: string | null;
  logoFilename?: string | null;
  logoUrl?: string | null;
  logoAncho?: number;
  logoAlto?: number;
  usarCodigoPersonalizado: boolean;
  codigoHtmlPersonalizado?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

const CONFIG_INICIAL: EmailConfig = {
  asunto: 'Constancia de Actualización de Datos - CIP {{cip}} ({{nombres}})',
  nombreRemitente: 'Colegio de Ingenieros del Perú - CD Cusco',
  correoRemitente: '',
  colorPrimario: '#781622',
  colorSecundario: '#1E293B',
  colorFondo: '#F8FAFC',
  colorTexto: '#1E293B',
  colorBorde: '#E2E8F0',
  colorAlertaBg: '#FEF2F2',
  colorAlertaTexto: '#991B1B',
  tituloInstitucional: 'COLEGIO DE INGENIEROS DEL PERÚ',
  subtituloInstitucional: 'Consejo Departamental Cusco',
  mensajeBienvenida:
    'Le confirmamos que sus datos de contacto, residencia y filiación han sido actualizados satisfactoriamente en el padrón del Colegio de Ingenieros del Perú. A continuación, se detalla el resumen de la información registrada:',
  avisoSeguridad:
    'Aviso de Seguridad: Si usted no reconoció esta operación o detecta alguna inconsistencia, por favor comuníquese de inmediato con las oficinas del Colegio de Ingenieros del Perú.',
  piePagina:
    'Colegio de Ingenieros del Perú — Consejo Departamental Cusco\nSistema de Gestión y Actualización de Datos de Colegiados\nEste mensaje ha sido generado automáticamente, por favor no responda a esta dirección de correo.',
  logoTipo: 'default',
  logoBase64: null,
  logoMime: 'image/jpeg',
  logoFilename: 'logo-cip.jpeg',
  logoUrl: null,
  logoAncho: 180,
  logoAlto: 75,
  usarCodigoPersonalizado: false,
  codigoHtmlPersonalizado: '',
};

const PALETAS_PRESET = [
  {
    nombre: 'Granate Oficial CIP',
    primario: '#781622',
    secundario: '#1E293B',
    fondo: '#F8FAFC',
    texto: '#1E293B',
    borde: '#E2E8F0',
    alertaBg: '#FEF2F2',
    alertaTexto: '#991B1B',
  },
  {
    nombre: 'Azul Institucional CIP',
    primario: '#8f0404',
    secundario: '#1E293B',
    fondo: '#F8FAFC',
    texto: '#1E293B',
    borde: '#E2E8F0',
    alertaBg: '#EFF6FF',
    alertaTexto: '#1E40AF',
  },
  {
    nombre: 'Azul Marino Ejecutivo',
    primario: '#1E3A8A',
    secundario: '#0F172A',
    fondo: '#F8FAFC',
    texto: '#0F172A',
    borde: '#CBD5E1',
    alertaBg: '#F1F5F9',
    alertaTexto: '#1E293B',
  },
  {
    nombre: 'Verde Esmeralda',
    primario: '#0F766E',
    secundario: '#134E4A',
    fondo: '#F8FAFC',
    texto: '#134E4A',
    borde: '#CCFBF1',
    alertaBg: '#ECFDF5',
    alertaTexto: '#065F46',
  },
  {
    nombre: 'Gris Grafito Sobrio',
    primario: '#334155',
    secundario: '#0F172A',
    fondo: '#F8FAFC',
    texto: '#1E293B',
    borde: '#E2E8F0',
    alertaBg: '#F8FAFC',
    alertaTexto: '#475569',
  },
];

const VARIABLES_DISPONIBLES = [
  { tag: '{{cip}}', desc: 'N° CIP' },
  { tag: '{{nombres}}', desc: 'Nombre Colegiado' },
  { tag: '{{dni}}', desc: 'DNI / Doc' },
  { tag: '{{email}}', desc: 'Correo Electrónico' },
  { tag: '{{celular}}', desc: 'Número Celular' },
  { tag: '{{fechaIngreso}}', desc: 'Fecha Colegiatura' },
  { tag: '{{fechaUltimoPago}}', desc: 'Fecha Último Pago' },
  { tag: '{{fechaNacimiento}}', desc: 'Fecha Nacimiento' },
  { tag: '{{sexo}}', desc: 'Sexo' },
  { tag: '{{estadoCivil}}', desc: 'Estado Civil' },
  { tag: '{{departamento}}', desc: 'Departamento' },
  { tag: '{{provincia}}', desc: 'Provincia' },
  { tag: '{{distrito}}', desc: 'Distrito' },
  { tag: '{{direccion}}', desc: 'Dirección' },
  { tag: '{{referencia}}', desc: 'Referencia' },
  { tag: '{{fechaRegistro}}', desc: 'Fecha y Hora Registro' },
  { tag: '{{idOperacion}}', desc: 'Código Operación' },
  { tag: '{{logoHtml}}', desc: 'Bloque Logo HTML' },
  { tag: '{{colorPrimario}}', desc: 'Color Primario HEX' },
];

export default function ConfiguracionCorreoPage() {
  const [config, setConfig] = useState<EmailConfig>(CONFIG_INICIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'colores' | 'textos' | 'codigo'>('colores');
  const [vistaDispositivo, setVistaDispositivo] = useState<'desktop' | 'mobile'>('desktop');

  // Preview
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Alertas
  const [mensajeExito, setMensajeExito] = useState<string>('');
  const [mensajeError, setMensajeError] = useState<string>('');

  // Modales
  const [modalPruebaAbierto, setModalPruebaAbierto] = useState(false);
  const [emailPrueba, setEmailPrueba] = useState('');
  const [enviandoPrueba, setEnviandoPrueba] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<{
    success: boolean;
    message: string;
    simulado?: boolean;
  } | null>(null);

  const [modalRestaurarAbierto, setModalRestaurarAbierto] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  // Ref para textarea de código
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar configuración desde el backend
  const cargarConfiguracion = useCallback(async () => {
    setLoading(true);
    setMensajeError('');
    try {
      const res = await api.get('/actualizacion-datos/email-config');
      if (res.data) {
        setConfig({
          ...CONFIG_INICIAL,
          ...res.data,
        });
      }
    } catch (err: any) {
      setMensajeError(
        err.response?.data?.message || err.message || 'Error al cargar la configuración de correo.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarConfiguracion();
  }, [cargarConfiguracion]);

  // Actualizar Preview en Vivo con debounce
  const actualizarVistaPrevia = useCallback(
    async (configActual: EmailConfig) => {
      setLoadingPreview(true);
      try {
        const res = await api.post('/actualizacion-datos/email-config/previsualizar', {
          config: configActual,
        });
        if (res.data) {
          setPreviewHtml(res.data.html || '');
          setPreviewSubject(res.data.subject || '');
        }
      } catch (err: any) {
        console.error('Error al generar vista previa:', err);
      } finally {
        setLoadingPreview(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      actualizarVistaPrevia(config);
    }, 350);
    return () => clearTimeout(timer);
  }, [config, actualizarVistaPrevia]);

  // Guardar configuración
  const handleGuardar = async () => {
    setSaving(true);
    setMensajeExito('');
    setMensajeError('');
    try {
      const res = await api.post('/actualizacion-datos/email-config', config);
      setMensajeExito(res.data?.message || 'Configuración y diseño guardados correctamente.');
      if (res.data?.data) {
        setConfig((prev) => ({
          ...prev,
          ...res.data.data,
        }));
      }
    } catch (err: any) {
      setMensajeError(
        err.response?.data?.message || err.message || 'Error al guardar la configuración.',
      );
    } finally {
      setSaving(false);
    }
  };

  // Restaurar a valores de fábrica
  const handleConfirmarRestaurar = async () => {
    setRestaurando(true);
    setMensajeExito('');
    setMensajeError('');
    try {
      const res = await api.post('/actualizacion-datos/email-config/restaurar');
      setMensajeExito(res.data?.message || 'Plantilla restaurada a los valores predeterminados.');
      if (res.data?.data) {
        setConfig(res.data.data);
      } else {
        setConfig(CONFIG_INICIAL);
      }
      setModalRestaurarAbierto(false);
    } catch (err: any) {
      setMensajeError(
        err.response?.data?.message || err.message || 'Error al restaurar los valores por defecto.',
      );
    } finally {
      setRestaurando(false);
    }
  };

  // Enviar correo de prueba
  const handleEnviarPrueba = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPrueba || !emailPrueba.includes('@')) {
      alert('Por favor ingrese un correo válido para la prueba.');
      return;
    }
    setEnviandoPrueba(true);
    setResultadoPrueba(null);
    try {
      const res = await api.post('/actualizacion-datos/email-config/probar-envio', {
        destinatario: emailPrueba,
        config,
      });
      setResultadoPrueba({
        success: res.data?.success !== false,
        message: res.data?.message || 'Correo de prueba enviado.',
        simulado: res.data?.simulado,
      });
    } catch (err: any) {
      setResultadoPrueba({
        success: false,
        message:
          err.response?.data?.message ||
          err.message ||
          'Error al conectar con el servidor para enviar la prueba.',
      });
    } finally {
      setEnviandoPrueba(false);
    }
  };

  // Subir Logo
  const handleSubirLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen (PNG, JPG, WEBP, SVG)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no debe superar los 2 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = (uploadEvent.target?.result as string) || '';
      const parts = base64Data.split(',');
      const rawBase64 = parts[1] || parts[0];

      setConfig((prev) => ({
        ...prev,
        logoTipo: 'custom',
        logoBase64: rawBase64,
        logoMime: file.type,
        logoFilename: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Eliminar logo personalizado
  const handleRemoverLogo = () => {
    setConfig((prev) => ({
      ...prev,
      logoTipo: 'default',
      logoBase64: null,
      logoFilename: null,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Aplicar paleta preestablecida
  const aplicarPreset = (p: (typeof PALETAS_PRESET)[0]) => {
    setConfig((prev) => ({
      ...prev,
      colorPrimario: p.primario,
      colorSecundario: p.secundario,
      colorFondo: p.fondo,
      colorTexto: p.texto,
      colorBorde: p.borde,
      colorAlertaBg: p.alertaBg,
      colorAlertaTexto: p.alertaTexto,
    }));
  };

  // Insertar variable dinámica en textarea
  const insertarVariable = (tag: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const text = config.codigoHtmlPersonalizado || '';
    const newText = text.substring(0, start) + tag + text.substring(end);
    setConfig((prev) => ({ ...prev, codigoHtmlPersonalizado: newText }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Copiar plantilla visual actual al editor de código
  const copiarPlantillaACodigo = () => {
    if (!previewHtml) return;
    if (
      config.codigoHtmlPersonalizado?.trim() &&
      !window.confirm(
        '¿Desea reemplazar el código HTML actual con el generado por los controles visuales?',
      )
    ) {
      return;
    }
    setConfig((prev) => ({
      ...prev,
      usarCodigoPersonalizado: true,
      codigoHtmlPersonalizado: previewHtml,
    }));
    setActiveTab('codigo');
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard" className="hover:text-[#8f0404] transition-colors">
              Inicio
            </Link>
            <span>/</span>
            <Link
              href="/dashboard/actualizacion-datos"
              className="hover:text-[#8f0404] transition-colors"
            >
              Actualización de Datos
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Plantilla y Configuración de Correo</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Diseño y Plantilla de Correo de Actualización
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Personalice los colores institucionales, el logotipo, los textos y edite el código HTML
            del correo oficial de confirmación.
          </p>
        </div>

        {/* Acciones Globales */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModalRestaurarAbierto(true)}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Restaurar Valores</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setResultadoPrueba(null);
              setModalPruebaAbierto(true);
            }}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#730202] bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-[#8f0404]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span>Enviar Correo de Prueba</span>
          </button>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#8f0404] hover:bg-[#730202] disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Guardando cambios...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Guardar Configuración</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Submódulos de Navegación */}
      <div className="flex border-b border-slate-200 gap-4 sm:gap-6 text-xs sm:text-sm overflow-x-auto">
        <Link
          href="/dashboard/actualizacion-datos"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Quiénes Actualizaron Datos
        </Link>
        <Link
          href="/dashboard/actualizacion-datos/correo"
          className="pb-3 border-b-2 border-[#8f0404] font-semibold text-[#8f0404] flex items-center gap-2 whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Plantilla de Correo & Colores
        </Link>
        <Link
          href="/actualizar-datos"
          target="_blank"
          className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium transition-colors flex items-center gap-1.5 ml-auto whitespace-nowrap"
        >
          <span>Portal Colegiado</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>

      {/* Alertas */}
      {mensajeExito && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{mensajeExito}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensajeExito('')}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {mensajeError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{mensajeError}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensajeError('')}
            className="text-red-600 hover:text-red-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid Principal: Izquierda (Controles) / Derecha (Preview en Vivo) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL IZQUIERDO: CONTROLES DE ADMINISTRACIÓN (7 cols) */}
        <div className="lg:col-span-6 xl:col-span-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Tabs Internos */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('colores')}
              className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'colores'
                  ? 'bg-white text-[#8f0404] border-t-2 border-[#8f0404] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full border border-slate-300"
                style={{ backgroundColor: config.colorPrimario }}
              />
              <span>Colores & Logo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('textos')}
              className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'textos'
                  ? 'bg-white text-[#8f0404] border-t-2 border-[#8f0404] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span>Textos & Asunto</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('codigo')}
              className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === 'codigo'
                  ? 'bg-white text-[#8f0404] border-t-2 border-[#8f0404] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>Código HTML</span>
              {config.usarCodigoPersonalizado && (
                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                  Activo
                </span>
              )}
            </button>
          </div>

          <div className="p-5 space-y-6 flex-1">
            {/* ========================================================= */}
            {/* TAB 1: COLORES & LOGOTIPO */}
            {/* ========================================================= */}
            {activeTab === 'colores' && (
              <div className="space-y-6">
                {/* Presets Rápidos */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Paletas Preestablecidas Institucionales
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PALETAS_PRESET.map((p) => (
                      <button
                        key={p.nombre}
                        type="button"
                        onClick={() => aplicarPreset(p)}
                        className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center gap-2 ${
                          config.colorPrimario.toLowerCase() === p.primario.toLowerCase()
                            ? 'border-[#8f0404] bg-red-50/50 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-md shadow-inner flex-shrink-0"
                          style={{ backgroundColor: p.primario }}
                        />
                        <span className="font-medium text-slate-800 truncate">{p.nombre}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pickers de Color Individuales */}
                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Configuración de Colores Personalizados
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Color Primario */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Color Primario (Encabezado y Acentos)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.colorPrimario}
                          onChange={(e) => setConfig({ ...config, colorPrimario: e.target.value })}
                          className="w-9 h-9 p-0.5 border border-slate-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.colorPrimario}
                          onChange={(e) => setConfig({ ...config, colorPrimario: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                        />
                      </div>
                    </div>

                    {/* Color de Fondo */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Color de Fondo del Correo
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.colorFondo}
                          onChange={(e) => setConfig({ ...config, colorFondo: e.target.value })}
                          className="w-9 h-9 p-0.5 border border-slate-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.colorFondo}
                          onChange={(e) => setConfig({ ...config, colorFondo: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                        />
                      </div>
                    </div>

                    {/* Color de Texto */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Color de Texto Principal
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.colorTexto}
                          onChange={(e) => setConfig({ ...config, colorTexto: e.target.value })}
                          className="w-9 h-9 p-0.5 border border-slate-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.colorTexto}
                          onChange={(e) => setConfig({ ...config, colorTexto: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                        />
                      </div>
                    </div>

                    {/* Color de Bordes */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Color de Bordes y Líneas
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.colorBorde}
                          onChange={(e) => setConfig({ ...config, colorBorde: e.target.value })}
                          className="w-9 h-9 p-0.5 border border-slate-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.colorBorde}
                          onChange={(e) => setConfig({ ...config, colorBorde: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                        />
                      </div>
                    </div>

                    {/* Alerta Fondo */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Fondo del Cuadro de Seguridad
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.colorAlertaBg}
                          onChange={(e) => setConfig({ ...config, colorAlertaBg: e.target.value })}
                          className="w-9 h-9 p-0.5 border border-slate-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.colorAlertaBg}
                          onChange={(e) => setConfig({ ...config, colorAlertaBg: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                        />
                      </div>
                    </div>

                    {/* Alerta Texto */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Texto del Cuadro de Seguridad
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.colorAlertaTexto}
                          onChange={(e) => setConfig({ ...config, colorAlertaTexto: e.target.value })}
                          className="w-9 h-9 p-0.5 border border-slate-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.colorAlertaTexto}
                          onChange={(e) => setConfig({ ...config, colorAlertaTexto: e.target.value })}
                          className="flex-1 px-3 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gestión del Logotipo */}
                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Logotipo Institucional en el Encabezado
                  </label>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, logoTipo: 'default' })}
                      className={`p-2.5 rounded-lg border text-xs font-medium text-center transition-all ${
                        config.logoTipo === 'default'
                          ? 'border-[#8f0404] bg-red-50/60 text-[#8f0404] font-semibold shadow-sm'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Logo Oficial CIP (Sistema)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, logoTipo: 'custom' })}
                      className={`p-2.5 rounded-lg border text-xs font-medium text-center transition-all ${
                        config.logoTipo === 'custom'
                          ? 'border-[#8f0404] bg-red-50/60 text-[#8f0404] font-semibold shadow-sm'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Subir Logo Propio
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, logoTipo: 'none' })}
                      className={`p-2.5 rounded-lg border text-xs font-medium text-center transition-all ${
                        config.logoTipo === 'none'
                          ? 'border-[#8f0404] bg-red-50/60 text-[#8f0404] font-semibold shadow-sm'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Sin Logo (Texto)
                    </button>
                  </div>

                  {/* Detalle si es Custom */}
                  {config.logoTipo === 'custom' && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                      <div>
                        <span className="block text-xs font-medium text-slate-700 mb-1.5">
                          Seleccionar archivo de imagen (PNG con fondo transparente o JPG):
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleSubirLogo}
                          className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-red-100 file:text-[#730202] hover:file:bg-red-200 cursor-pointer"
                        />
                      </div>

                      {config.logoBase64 && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 bg-slate-100 rounded-md p-1 border border-slate-200 flex items-center justify-center overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`data:${config.logoMime || 'image/png'};base64,${config.logoBase64}`}
                                alt="Logo subido"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-800">
                                {config.logoFilename || 'logo-personalizado.png'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Logo personalizado cargado y listo para el envío
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoverLogo}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}

                      {/* Dimensiones */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Ancho máximo (px)
                          </label>
                          <input
                            type="number"
                            min="50"
                            max="300"
                            value={config.logoAncho || 180}
                            onChange={(e) =>
                              setConfig({ ...config, logoAncho: parseInt(e.target.value) || 180 })
                            }
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Alto máximo (px)
                          </label>
                          <input
                            type="number"
                            min="30"
                            max="150"
                            value={config.logoAlto || 75}
                            onChange={(e) =>
                              setConfig({ ...config, logoAlto: parseInt(e.target.value) || 75 })
                            }
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: TEXTOS & ASUNTO */}
            {/* ========================================================= */}
            {activeTab === 'textos' && (
              <div className="space-y-4">
                {/* Asunto */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Asunto del Correo Electrónico
                    </label>
                    <span className="text-[11px] text-slate-400">Soporta {'{{cip}}'} y {'{{nombres}}'}</span>
                  </div>
                  <input
                    type="text"
                    value={config.asunto}
                    onChange={(e) => setConfig({ ...config, asunto: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                  />
                </div>

                {/* Nombre de Remitente */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre del Remitente Oficial (De:)
                  </label>
                  <input
                    type="text"
                    value={config.nombreRemitente}
                    onChange={(e) => setConfig({ ...config, nombreRemitente: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                  />
                </div>

                {/* Título Institucional */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Título Institucional en Encabezado
                  </label>
                  <input
                    type="text"
                    value={config.tituloInstitucional}
                    onChange={(e) => setConfig({ ...config, tituloInstitucional: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                  />
                </div>

                {/* Subtítulo Institucional */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Subtítulo Institucional
                  </label>
                  <input
                    type="text"
                    value={config.subtituloInstitucional}
                    onChange={(e) => setConfig({ ...config, subtituloInstitucional: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                  />
                </div>

                {/* Mensaje de Bienvenida */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mensaje Introductorio de Confirmación
                  </label>
                  <textarea
                    rows={3}
                    value={config.mensajeBienvenida}
                    onChange={(e) => setConfig({ ...config, mensajeBienvenida: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                  />
                </div>

                {/* Aviso de Seguridad */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Texto del Aviso de Seguridad
                  </label>
                  <textarea
                    rows={2}
                    value={config.avisoSeguridad}
                    onChange={(e) => setConfig({ ...config, avisoSeguridad: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                  />
                </div>

                {/* Pie de Página */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pie de Página Institucional (Footer)
                  </label>
                  <textarea
                    rows={3}
                    value={config.piePagina}
                    onChange={(e) => setConfig({ ...config, piePagina: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                  />
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 3: EDITOR DE CÓDIGO HTML (TOTAL ADMINISTRACIÓN) */}
            {/* ========================================================= */}
            {activeTab === 'codigo' && (
              <div className="space-y-4">
                {/* Switch de activación */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">
                      Activar Plantilla de Código HTML Libre
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Permite escribir o editar código HTML/CSS personalizado para control absoluto
                      del correo.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.usarCodigoPersonalizado}
                      onChange={(e) =>
                        setConfig({ ...config, usarCodigoPersonalizado: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8f0404]"></div>
                  </label>
                </div>

                {/* Botón para volcar la plantilla visual a código */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">
                    Variables Dinámicas Disponibles:
                  </span>
                  <button
                    type="button"
                    onClick={copiarPlantillaACodigo}
                    className="text-xs text-[#8f0404] hover:text-[#730202] font-medium inline-flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                    <span>Cargar HTML base actual</span>
                  </button>
                </div>

                {/* Chips de Variables */}
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
                  {VARIABLES_DISPONIBLES.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertarVariable(v.tag)}
                      title={`Insertar ${v.desc}`}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-white border border-slate-300 hover:bg-red-50 hover:border-red-300 hover:text-[#8f0404] transition-colors"
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>

                {/* Editor Monospace */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Editor de Código HTML del Correo
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {(config.codigoHtmlPersonalizado || '').length} caracteres
                    </span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    rows={16}
                    value={config.codigoHtmlPersonalizado || ''}
                    onChange={(e) =>
                      setConfig({ ...config, codigoHtmlPersonalizado: e.target.value })
                    }
                    placeholder="Escriba o pegue aquí su código HTML personalizado con las variables {{...}}"
                    spellCheck={false}
                    className="w-full p-3 font-mono text-xs leading-relaxed text-slate-800 bg-slate-900 !text-slate-100 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#8f0404] shadow-inner"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* PANEL DERECHO: VISTA PREVIA EN TIEMPO REAL (5 cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-3 sticky top-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            {/* Header de la Vista Previa */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Vista Previa en Vivo
                </span>
                {loadingPreview && (
                  <span className="text-[11px] text-[#8f0404] font-medium">Actualizando...</span>
                )}
              </div>

              {/* Selector de Dispositivo */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setVistaDispositivo('desktop')}
                  className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors ${
                    vistaDispositivo === 'desktop'
                      ? 'bg-[#8f0404] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Escritorio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVistaDispositivo('mobile')}
                  className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors ${
                    vistaDispositivo === 'mobile'
                      ? 'bg-[#8f0404] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Móvil</span>
                </button>
              </div>
            </div>

            {/* Simulación de Bandeja de Entrada */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-slate-600 truncate">
                <span className="font-semibold text-slate-800">De:</span>
                <span className="truncate">
                  {config.nombreRemitente || 'Colegio de Ingenieros del Perú'}{' '}
                  &lt;notificaciones@cipcusco.org.pe&gt;
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 truncate">
                <span className="font-semibold text-slate-800">Para:</span>
                <span className="text-slate-700">jperez.cip@ejemplo.org.pe (Colegiado Simulado)</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-900 pt-0.5">
                <span className="font-semibold text-slate-800 flex-shrink-0">Asunto:</span>
                <span className="font-medium text-[#730202] line-clamp-1">{previewSubject || config.asunto}</span>
              </div>
            </div>

            {/* Contenedor Iframe */}
            <div
              className={`p-4 bg-slate-200/70 overflow-auto flex justify-center items-start min-h-[550px] max-h-[720px] transition-all`}
            >
              <div
                className={`bg-white shadow-md transition-all duration-300 overflow-hidden ${
                  vistaDispositivo === 'desktop'
                    ? 'w-full max-w-[650px] rounded-lg'
                    : 'w-[375px] rounded-[24px] border-[6px] border-slate-800 shadow-xl'
                }`}
              >
                <iframe
                  title="Vista Previa de Correo"
                  srcDoc={previewHtml}
                  className="w-full min-h-[580px] h-[660px] border-0 bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            {/* Footer de Preview */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Vista previa con datos simulados del padrón
              </span>
              <button
                type="button"
                onClick={() => setModalPruebaAbierto(true)}
                className="text-[#8f0404] hover:text-[#730202] font-semibold"
              >
                Enviar prueba a mi correo →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: ENVIAR CORREO DE PRUEBA */}
      {/* ========================================================= */}
      {modalPruebaAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-[#8f0404] flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3>Enviar Correo de Prueba</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalPruebaAbierto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Se enviará una copia exacta del correo con la configuración visual actual y datos
              simulados para que compruebe la renderización real en su cliente de correo (Gmail,
              Outlook, etc.).
            </p>

            <form onSubmit={handleEnviarPrueba} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Correo Electrónico Destinatario:
                </label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@cipcusco.org.pe"
                  value={emailPrueba}
                  onChange={(e) => setEmailPrueba(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f0404]"
                />
              </div>

              {resultadoPrueba && (
                <div
                  className={`p-3 rounded-lg text-xs ${
                    resultadoPrueba.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  <p className="font-semibold">
                    {resultadoPrueba.success ? '✓ Resultado de Envío' : '✕ Error al enviar'}
                  </p>
                  <p className="mt-0.5">{resultadoPrueba.message}</p>
                  {resultadoPrueba.simulado && (
                    <p className="mt-1 text-[11px] text-amber-700 font-medium">
                      Nota: Como el servidor no tiene credenciales SMTP configuradas en el .env, el
                      sistema registró el envío en modo simulación.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalPruebaAbierto(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={enviandoPrueba}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#8f0404] hover:bg-[#730202] rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {enviandoPrueba ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>Enviar Prueba</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRMAR RESTAURAR */}
      {/* ========================================================= */}
      {modalRestaurarAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ¿Restaurar configuración de correo a los valores por defecto?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Esta acción restablecerá los colores originales, el logo oficial y los textos
                  predeterminados del Colegio de Ingenieros del Perú.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalRestaurarAbierto(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarRestaurar}
                disabled={restaurando}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {restaurando ? 'Restaurando...' : 'Sí, restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
