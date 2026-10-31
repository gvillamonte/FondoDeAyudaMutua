-- ============================================================
-- 021: Correccion de textos corruptos del expediente 347
-- El valor fue grabado con codificacion incorrecta
-- ("OCLUSI+ON" en lugar de "OCLUSIÓN").
-- ============================================================

UPDATE fam_solicitud_beneficio
SET causa_fallecimiento = N'OCLUSIÓN INTESTINAL'
WHERE expediente_numero = '347'
  AND causa_fallecimiento LIKE N'OCLUSI%ON INTESTINAL';
GO

SELECT expediente_numero, causa_fallecimiento, observaciones
FROM fam_solicitud_beneficio
WHERE expediente_numero = '347';
GO
