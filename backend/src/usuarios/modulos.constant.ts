export interface SubmoduloSistema {
  id: string;
  nombre: string;
  descripcion?: string;
  ruta: string;
}

export interface ModuloSistema {
  id: string;
  nombre: string;
  descripcion: string;
  ruta: string;
  categoria: 'PRINCIPAL' | 'OPERATIVO' | 'SISTEMA';
  submodulos?: SubmoduloSistema[];
}

export const MODULOS_SISTEMA: ModuloSistema[] = [
  {
    id: 'dashboard',
    nombre: 'Dashboard',
    descripcion: 'Métricas generales, accesos directos y estadísticas iniciales',
    ruta: '/dashboard',
    categoria: 'PRINCIPAL',
  },
  {
    id: 'colegiados',
    nombre: 'Colegiados',
    descripcion: 'Padrón maestro de ingenieros colegiados y búsqueda de datos',
    ruta: '/dashboard/colegiados',
    categoria: 'PRINCIPAL',
  },
  {
    id: 'actualizacion-datos',
    nombre: 'Act. de Datos',
    descripcion: 'Bandeja de solicitudes de actualización y plantilla de correo',
    ruta: '/dashboard/actualizacion-datos',
    categoria: 'OPERATIVO',
    submodulos: [
      { id: 'actualizacion-datos', nombre: 'Bandeja de Actualizaciones', ruta: '/dashboard/actualizacion-datos', descripcion: 'Listado y aprobación de solicitudes' },
      { id: 'actualizacion-datos/correo', nombre: 'Plantilla de Correo', ruta: '/dashboard/actualizacion-datos/correo', descripcion: 'Editor de mensajes institucionales' },
    ],
  },
  {
    id: 'beneficios',
    nombre: 'Beneficios',
    descripcion: 'Catálogo institucional de beneficios colegiales',
    ruta: '/dashboard/beneficios',
    categoria: 'OPERATIVO',
  },
  {
    id: 'pagos',
    nombre: 'Pagos',
    descripcion: 'Registro, seguimiento y comprobantes de pagos realizados',
    ruta: '/dashboard/pagos',
    categoria: 'OPERATIVO',
  },
  {
    id: 'caja',
    nombre: 'Caja y Cobranzas',
    descripcion: 'Cobro de aportaciones, ordinarios, IEPI y consulta de cobranzas',
    ruta: '/dashboard/caja',
    categoria: 'OPERATIVO',
    submodulos: [
      { id: 'caja/consulta-cobros', nombre: 'Consulta Cobros', ruta: '/dashboard/caja/consulta-cobros', descripcion: 'Búsqueda histórica de operaciones de caja' },
      { id: 'caja/cobrar-aportaciones', nombre: 'Cobrar Aportaciones', ruta: '/dashboard/caja/cobrar-aportaciones', descripcion: 'Emisión de recibos de aportaciones' },
      { id: 'caja/cobrar-ordinarios', nombre: 'Cobrar Ordinarios', ruta: '/dashboard/caja/cobrar-ordinarios', descripcion: 'Cobros ordinarios a colegiados' },
      { id: 'caja/cobrar-iepi', nombre: 'Cobrar IEPI', ruta: '/dashboard/caja/cobrar-iepi', descripcion: 'Cobro de aranceles y conceptos IEPI' },
    ],
  },
  {
    id: 'tesoreria',
    nombre: 'Tesorería',
    descripcion: 'Fraccionamiento de deuda y convenios de pago',
    ruta: '/dashboard/tesoreria',
    categoria: 'OPERATIVO',
    submodulos: [
      { id: 'tesoreria/fraccionamiento-deuda', nombre: 'Fraccionamiento Deuda', ruta: '/dashboard/tesoreria/fraccionamiento-deuda', descripcion: 'Gestión de convenios y cronogramas de pago' },
    ],
  },
  {
    id: 'fam',
    nombre: 'FAM (Fondo Asistencia Mutua)',
    descripcion: 'Beneficiarios, expedientes de auxilio, COVID y liquidaciones',
    ruta: '/dashboard/fam',
    categoria: 'OPERATIVO',
    submodulos: [
      { id: 'fam', nombre: 'Beneficiarios', ruta: '/dashboard/fam', descripcion: 'Padrón y búsqueda de beneficiarios FAM' },
      { id: 'fam/registro', nombre: 'Registro de Auxilio', ruta: '/dashboard/fam/registro', descripcion: 'Asistente de registro rápido de beneficios' },
      { id: 'fam/carga-masiva', nombre: 'Carga Masiva', ruta: '/dashboard/fam/carga-masiva', descripcion: 'Importación por lote de beneficiarios' },
      { id: 'fam/expedientes', nombre: 'Expedientes de Beneficio', ruta: '/dashboard/fam/expedientes', descripcion: 'Gestión completa de solicitudes y expedientes' },
      { id: 'fam/config-sla', nombre: 'Configuración SLA', ruta: '/dashboard/fam/config-sla', descripcion: 'Parámetros de tiempos de atención y alertas' },
      { id: 'fam/covid', nombre: 'Ayuda COVID', ruta: '/dashboard/fam/covid', descripcion: 'Registro y seguimiento de asignaciones COVID' },
      { id: 'fam/pagos-estimados', nombre: 'Pagos Estimados', ruta: '/dashboard/fam/pagos-estimados', descripcion: 'Proyecciones y programación de desembolsos' },
    ],
  },
  {
    id: 'reportes',
    nombre: 'Reportes',
    descripcion: 'Estados de habilidad y exportación de reportes institucionales',
    ruta: '/dashboard/reportes',
    categoria: 'PRINCIPAL',
    submodulos: [
      { id: 'reportes/estados-habilidad', nombre: 'Estados de Habilidad', ruta: '/dashboard/reportes/estados-habilidad', descripcion: 'Certificados y reportes de habilidad colegial' },
    ],
  },
  {
    id: 'configuraciones',
    nombre: 'Configuraciones',
    descripcion: 'Montos FAM, métodos de pago, monedas, memorandos y cartas',
    ruta: '/dashboard/configuraciones',
    categoria: 'SISTEMA',
    submodulos: [
      { id: 'configuraciones/montos-fam', nombre: 'Montos FAM', ruta: '/dashboard/configuraciones/montos-fam', descripcion: 'Valores base por concepto de beneficio' },
      { id: 'configuraciones/metodos-pago', nombre: 'Métodos de Pago', ruta: '/dashboard/configuraciones/metodos-pago', descripcion: 'Catálogo de modalidades de desembolso' },
      { id: 'configuraciones/estados-solicitud', nombre: 'Estados Solicitud', ruta: '/dashboard/configuraciones/estados-solicitud', descripcion: 'Etapas del flujo de aprobación' },
      { id: 'configuraciones/tipos-beneficio', nombre: 'Tipos Beneficio', ruta: '/dashboard/configuraciones/tipos-beneficio', descripcion: 'Modalidades de ayuda mutua' },
      { id: 'configuraciones/monedas', nombre: 'Monedas', ruta: '/dashboard/configuraciones/monedas', descripcion: 'Monedas operativas del sistema' },
      { id: 'configuraciones/memorandos', nombre: 'Memorándums', ruta: '/dashboard/configuraciones/memorandos', descripcion: 'Catálogo correlativo de memorandos' },
      { id: 'configuraciones/cartas', nombre: 'Cartas', ruta: '/dashboard/configuraciones/cartas', descripcion: 'Catálogo correlativo de cartas institucionales' },
    ],
  },
  {
    id: 'auditoria',
    nombre: 'Auditoría',
    descripcion: 'Historial inmutable de trazabilidad y logs de auditoría',
    ruta: '/dashboard/auditoria',
    categoria: 'SISTEMA',
  },
  {
    id: 'usuarios',
    nombre: 'Usuarios y Roles',
    descripcion: 'Administración de cuentas de usuarios, roles y permisos de acceso',
    ruta: '/dashboard/usuarios',
    categoria: 'SISTEMA',
    submodulos: [
      { id: 'usuarios', nombre: 'Usuarios', ruta: '/dashboard/usuarios', descripcion: 'Gestión y cuentas de acceso de usuarios' },
      { id: 'roles', nombre: 'Roles y Permisos', ruta: '/dashboard/roles', descripcion: 'Creación y asignación modular de roles' },
    ],
  },
];
