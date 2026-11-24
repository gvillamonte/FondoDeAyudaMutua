export interface ModuloSistema {
  id: string;
  nombre: string;
  descripcion: string;
  ruta: string;
  categoria: 'PRINCIPAL' | 'OPERATIVO' | 'SISTEMA';
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
  },
  {
    id: 'tesoreria',
    nombre: 'Tesorería',
    descripcion: 'Fraccionamiento de deuda y convenios de pago',
    ruta: '/dashboard/tesoreria',
    categoria: 'OPERATIVO',
  },
  {
    id: 'fam',
    nombre: 'FAM (Fondo Asistencia Mutua)',
    descripcion: 'Beneficiarios, expedientes de auxilio, COVID y liquidaciones',
    ruta: '/dashboard/fam',
    categoria: 'OPERATIVO',
  },
  {
    id: 'reportes',
    nombre: 'Reportes',
    descripcion: 'Estados de habilidad y exportación de reportes institucionales',
    ruta: '/dashboard/reportes',
    categoria: 'PRINCIPAL',
  },
  {
    id: 'configuraciones',
    nombre: 'Configuraciones',
    descripcion: 'Montos FAM, métodos de pago, monedas, memorandos y cartas',
    ruta: '/dashboard/configuraciones',
    categoria: 'SISTEMA',
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
  },
];
