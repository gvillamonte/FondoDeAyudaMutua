-- ============================================================
-- MIGRACIÓN 002: Stored Procedures en APP_DB
-- Sistema de Beneficios Colegiales
-- ============================================================

-- ============================================================
-- SP: Registrar un pago completo con validaciones
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_registrar_pago(
    p_solicitud_id UUID,
    p_monto_pagado DECIMAL(12,2),
    p_medio_pago VARCHAR(30),
    p_referencia_pago VARCHAR(100),
    p_registrado_por UUID,
    p_notas TEXT DEFAULT NULL,
    p_comprobante_url VARCHAR(500) DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_solicitud RECORD;
    v_colegiado_id VARCHAR(50);
    v_estado_solicitud VARCHAR(30);
BEGIN
    -- Validar que la solicitud existe y está aprobada
    SELECT id, colegiado_id, estado, monto_solicitado
    INTO v_solicitud
    FROM solicitudes_beneficio
    WHERE id = p_solicitud_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada: %', p_solicitud_id;
    END IF;

    v_estado_solicitud := v_solicitud.estado;
    v_colegiado_id := v_solicitud.colegiado_id;

    IF v_estado_solicitud != 'APROBADA' THEN
        RAISE EXCEPTION 'La solicitud % no está en estado APROBADA. Estado actual: %',
            p_solicitud_id, v_estado_solicitud;
    END IF;

    -- Validar monto no exceda el aprobado
    IF p_monto_pagado > v_solicitud.monto_solicitado THEN
        RAISE EXCEPTION 'El monto pagado (%.2f) excede el monto aprobado (%.2f)',
            p_monto_pagado, v_solicitud.monto_solicitado;
    END IF;

    -- Insertar el pago
    INSERT INTO pagos (solicitud_id, colegiado_id, monto_pagado, medio_pago,
                       referencia_pago, fecha_pago, estado, registrado_por,
                       comprobante_url, notas)
    VALUES (p_solicitud_id, v_colegiado_id, p_monto_pagado, p_medio_pago,
            p_referencia_pago, NOW(), 'COMPLETADO', p_registrado_por,
            p_comprobante_url, p_notas);

    -- Actualizar estado de la solicitud a PAGADA
    UPDATE solicitudes_beneficio
    SET estado = 'PAGADA',
        updated_at = NOW()
    WHERE id = p_solicitud_id;

    RAISE NOTICE 'Pago registrado exitosamente para solicitud %', p_solicitud_id;
END;
$$;

-- ============================================================
-- SP: Aprobar o rechazar una solicitud de beneficio
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_resolver_solicitud(
    p_solicitud_id UUID,
    p_estado VARCHAR(30),
    p_resuelto_por UUID,
    p_monto_aprobado DECIMAL(12,2) DEFAULT NULL,
    p_observaciones TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_solicitud RECORD;
BEGIN
    -- Validar estado destino
    IF p_estado NOT IN ('APROBADA', 'RECHAZADA', 'EN_REVISION') THEN
        RAISE EXCEPTION 'Estado no válido: %. Use APROBADA, RECHAZADA o EN_REVISION', p_estado;
    END IF;

    -- Buscar solicitud
    SELECT * INTO v_solicitud
    FROM solicitudes_beneficio
    WHERE id = p_solicitud_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada: %', p_solicitud_id;
    END IF;

    IF v_solicitud.estado NOT IN ('PENDIENTE', 'EN_REVISION') THEN
        RAISE EXCEPTION 'La solicitud % no puede ser resuelta. Estado actual: %',
            p_solicitud_id, v_solicitud.estado;
    END IF;

    -- Actualizar solicitud
    UPDATE solicitudes_beneficio
    SET estado = p_estado,
        fecha_resolucion = NOW(),
        resuelto_por = p_resuelto_por,
        monto_solicitado = COALESCE(p_monto_aprobado, monto_solicitado),
        observaciones = COALESCE(p_observaciones, observaciones),
        updated_at = NOW()
    WHERE id = p_solicitud_id;

    RAISE NOTICE 'Solicitud % resuelta como %', p_solicitud_id, p_estado;
END;
$$;

-- ============================================================
-- SP: Revertir un pago registrado
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_revertir_pago(
    p_pago_id UUID,
    p_usuario_id UUID,
    p_motivo TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_pago RECORD;
BEGIN
    SELECT * INTO v_pago
    FROM pagos
    WHERE id = p_pago_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado: %', p_pago_id;
    END IF;

    IF v_pago.estado != 'COMPLETADO' THEN
        RAISE EXCEPTION 'El pago % no puede ser revertido. Estado: %', p_pago_id, v_pago.estado;
    END IF;

    -- Cambiar estado del pago
    UPDATE pagos
    SET estado = 'REVERTIDO',
        notas = COALESCE(notas || E'\n', '') || 'Revertido: ' || p_motivo,
        updated_at = NOW()
    WHERE id = p_pago_id;

    -- Reactivar la solicitud asociada
    UPDATE solicitudes_beneficio
    SET estado = 'APROBADA',
        updated_at = NOW()
    WHERE id = v_pago.solicitud_id;

    RAISE NOTICE 'Pago % revertido. Solicitud % reactivada.', p_pago_id, v_pago.solicitud_id;
END;
$$;

-- ============================================================
-- SP: Obtener resumen de pagos por colegiado
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_resumen_colegiado(
    p_colegiado_id VARCHAR(50),
    OUT p_total_solicitudes BIGINT,
    OUT p_total_aprobadas BIGINT,
    OUT p_total_pagadas BIGINT,
    OUT p_monto_total_pagado DECIMAL(12,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT COUNT(*)
    INTO p_total_solicitudes
    FROM solicitudes_beneficio
    WHERE colegiado_id = p_colegiado_id;

    SELECT COUNT(*)
    INTO p_total_aprobadas
    FROM solicitudes_beneficio
    WHERE colegiado_id = p_colegiado_id AND estado = 'APROBADA';

    SELECT COUNT(*)
    INTO p_total_pagadas
    FROM solicitudes_beneficio
    WHERE colegiado_id = p_colegiado_id AND estado = 'PAGADA';

    SELECT COALESCE(SUM(monto_pagado), 0)
    INTO p_monto_total_pagado
    FROM pagos
    WHERE colegiado_id = p_colegiado_id AND estado = 'COMPLETADO';
END;
$$;
