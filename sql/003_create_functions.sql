-- ============================================================
-- MIGRACIÓN 003: Funciones en APP_DB
-- Sistema de Beneficios Colegiales
-- ============================================================

-- ============================================================
-- FUNCIÓN: Calcular monto con recargo por mora (días de retraso)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_calcular_mora(
    p_monto_base DECIMAL(12,2),
    p_dias_retraso INTEGER,
    p_tasa_mora_diaria DECIMAL(5,4) DEFAULT 0.0005
)
RETURNS DECIMAL(12,2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_recargo DECIMAL(12,2);
    v_monto_total DECIMAL(12,2);
BEGIN
    IF p_dias_retraso <= 0 THEN
        RETURN p_monto_base;
    END IF;

    v_recargo := p_monto_base * p_tasa_mora_diaria * p_dias_retraso;
    v_monto_total := p_monto_base + v_recargo;

    -- Limitar recargo al 30% del monto base (tope legal)
    IF v_recargo > (p_monto_base * 0.30) THEN
        v_monto_total := p_monto_base * 1.30;
    END IF;

    RETURN ROUND(v_monto_total, 2);
END;
$$;

-- ============================================================
-- FUNCIÓN: Obtener historial de beneficios de un colegiado
-- ============================================================
CREATE OR REPLACE FUNCTION fn_historial_beneficios(
    p_colegiado_id VARCHAR(50),
    p_limite INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    solicitud_id UUID,
    beneficio_nombre VARCHAR(200),
    beneficio_tipo VARCHAR(50),
    monto_solicitado DECIMAL(12,2),
    monto_pagado DECIMAL(12,2),
    estado VARCHAR(30),
    fecha_solicitud TIMESTAMP WITH TIME ZONE,
    fecha_pago TIMESTAMP WITH TIME ZONE,
    medio_pago VARCHAR(30)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sb.id AS solicitud_id,
        b.nombre AS beneficio_nombre,
        b.tipo AS beneficio_tipo,
        sb.monto_solicitado,
        p.monto_pagado,
        sb.estado,
        sb.fecha_solicitud,
        p.fecha_pago,
        p.medio_pago
    FROM solicitudes_beneficio sb
    INNER JOIN beneficios b ON sb.beneficio_id = b.id
    LEFT JOIN pagos p ON sb.id = p.solicitud_id AND p.estado = 'COMPLETADO'
    WHERE sb.colegiado_id = p_colegiado_id
    ORDER BY sb.fecha_solicitud DESC
    LIMIT p_limite OFFSET p_offset;
END;
$$;

-- ============================================================
-- FUNCIÓN: Estadísticas generales del sistema
-- ============================================================
CREATE OR REPLACE FUNCTION fn_estadisticas_sistema()
RETURNS TABLE (
    total_colegiados_beneficiados BIGINT,
    total_solicitudes BIGINT,
    solicitudes_pendientes BIGINT,
    solicitudes_aprobadas BIGINT,
    solicitudes_rechazadas BIGINT,
    total_pagos DECIMAL(12,2),
    monto_total_pagado DECIMAL(12,2),
    promedio_pago DECIMAL(12,2)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(DISTINCT colegiado_id) FROM solicitudes_beneficio) AS total_colegiados_beneficiados,
        (SELECT COUNT(*) FROM solicitudes_beneficio) AS total_solicitudes,
        (SELECT COUNT(*) FROM solicitudes_beneficio WHERE estado = 'PENDIENTE') AS solicitudes_pendientes,
        (SELECT COUNT(*) FROM solicitudes_beneficio WHERE estado = 'APROBADA') AS solicitudes_aprobadas,
        (SELECT COUNT(*) FROM solicitudes_beneficio WHERE estado = 'RECHAZADA') AS solicitudes_rechazadas,
        (SELECT COUNT(*) FROM pagos WHERE estado = 'COMPLETADO') AS total_pagos,
        (SELECT COALESCE(SUM(monto_pagado), 0) FROM pagos WHERE estado = 'COMPLETADO') AS monto_total_pagado,
        (SELECT COALESCE(AVG(monto_pagado), 0) FROM pagos WHERE estado = 'COMPLETADO') AS promedio_pago;
END;
$$;

-- ============================================================
-- FUNCIÓN: Buscar colegiado con datos de beneficios (APP_DB side)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_buscar_colegiado_beneficios(
    p_colegiado_id VARCHAR(50)
)
RETURNS TABLE (
    colegiado_id VARCHAR(50),
    total_solicitudes BIGINT,
    solicitudes_pendientes BIGINT,
    monto_total_aprobado DECIMAL(12,2),
    monto_total_pagado DECIMAL(12,2),
    ultimo_beneficio_fecha TIMESTAMP WITH TIME ZONE,
    ultimo_beneficio_nombre VARCHAR(200)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sb.colegiado_id,
        COUNT(*) AS total_solicitudes,
        COUNT(*) FILTER (WHERE sb.estado = 'PENDIENTE') AS solicitudes_pendientes,
        COALESCE(SUM(sb.monto_solicitado) FILTER (WHERE sb.estado IN ('APROBADA', 'PAGADA')), 0) AS monto_total_aprobado,
        COALESCE((SELECT SUM(p.monto_pagado) FROM pagos p WHERE p.colegiado_id = sb.colegiado_id AND p.estado = 'COMPLETADO'), 0) AS monto_total_pagado,
        MAX(sb.fecha_solicitud) AS ultimo_beneficio_fecha,
        (SELECT b.nombre FROM beneficios b WHERE b.id = sb.beneficio_id ORDER BY sb.fecha_solicitud DESC LIMIT 1) AS ultimo_beneficio_nombre
    FROM solicitudes_beneficio sb
    WHERE sb.colegiado_id = p_colegiado_id
    GROUP BY sb.colegiado_id, sb.beneficio_id;
END;
$$;

-- ============================================================
-- FUNCIÓN: Validar elegibilidad de colegiado
-- ============================================================
CREATE OR REPLACE FUNCTION fn_validar_elegibilidad(
    p_colegiado_id VARCHAR(50),
    p_beneficio_id UUID
)
RETURNS TABLE (
    elegible BOOLEAN,
    motivo TEXT,
    solicitudes_activas BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_solicitudes_activas BIGINT;
    v_beneficio RECORD;
BEGIN
    -- Contar solicitudes activas (pendientes o en revisión)
    SELECT COUNT(*)
    INTO v_solicitudes_activas
    FROM solicitudes_beneficio
    WHERE colegiado_id = p_colegiado_id
      AND estado IN ('PENDIENTE', 'EN_REVISION');

    -- Verificar beneficio
    SELECT * INTO v_beneficio
    FROM beneficios
    WHERE id = p_beneficio_id AND activo = TRUE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Beneficio no encontrado o inactivo', v_solicitudes_activas;
        RETURN;
    END IF;

    -- Regla: Máximo 3 solicitudes activas simultáneas
    IF v_solicitudes_activas >= 3 THEN
        RETURN QUERY SELECT FALSE,
            'El colegiado tiene 3 o más solicitudes activas. Debe esperar a que se resuelvan.',
            v_solicitudes_activas;
        RETURN;
    END IF;

    -- Regla: Si requiere aprobación de junta, marcar
    IF v_beneficio.requiere_junta THEN
        RETURN QUERY SELECT TRUE,
            'Este beneficio requiere aprobación de junta directiva.',
            v_solicitudes_activas;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Colegiado elegible para este beneficio.', v_solicitudes_activas;
END;
$$;
