-- ============================================================================
-- MIGRACIÓN: get_disponibilidad_semana
-- Fecha: 2026-05-22
--
-- Agrega RPC get_disponibilidad_semana(p_cancha_id, p_desde, p_hasta) que
-- devuelve los slots ocupados/pendientes de una semana completa en una sola
-- consulta, reemplazando las 7 llamadas paralelas a get_disponibilidad_slots
-- que se hacían desde el WeekGrid del frontend.
--
-- Sin PII: solo devuelve cancha_id, fecha, hora_inicio, hora_fin, estado.
-- Accesible por anon (igual que get_disponibilidad_slots).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_disponibilidad_semana(
  p_cancha_id UUID,
  p_desde     DATE,
  p_hasta     DATE
)
RETURNS TABLE (
  cancha_id   UUID,
  fecha       DATE,
  hora_inicio TIME,
  hora_fin    TIME,
  estado      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.cancha_id,
    r.fecha,
    r.hora_inicio,
    r.hora_fin,
    r.estado
  FROM public.reservas r
  WHERE r.cancha_id = p_cancha_id
    AND r.fecha    >= p_desde
    AND r.fecha    <= p_hasta
    AND r.estado   IN ('confirmada', 'pendiente_pago');
$$;

-- Mismo acceso que get_disponibilidad_slots: público sin login
REVOKE EXECUTE ON FUNCTION public.get_disponibilidad_semana(UUID, DATE, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_disponibilidad_semana(UUID, DATE, DATE) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_disponibilidad_semana(UUID, DATE, DATE) TO authenticated;
