export interface User {
  id: string;
  username: string;
  email: string;
  nombreCompleto: string;
  rol: 'ADMINISTRADOR' | 'OPERADOR_PAGOS' | 'AUDITOR';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Beneficio {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  montoBase: number;
  moneda: string;
  activo: boolean;
  requiereJunta: boolean;
  createdAt: string;
}

export interface SolicitudBeneficio {
  id: string;
  colegiadoId: string;
  beneficioId: string;
  beneficio?: Beneficio;
  montoSolicitado: number;
  motivo: string;
  estado: 'PENDIENTE' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA' | 'PAGADA';
  fechaSolicitud: string;
  fechaResolucion?: string;
}

export interface Pago {
  id: string;
  solicitudId: string;
  colegiadoId: string;
  montoPagado: number;
  moneda: string;
  medioPago: string;
  referenciaPago?: string;
  fechaPago: string;
  estado: 'PENDIENTE' | 'COMPLETADO' | 'REVERTIDO' | 'ANULADO';
}

export interface Estadisticas {
  solicitudes: {
    total: number;
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
    pagadas: number;
  };
  pagos: {
    total: number;
    montoTotal: number;
    promedio: number;
  };
}
