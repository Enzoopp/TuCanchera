-- ============================================================================
-- TuCanchera — Esquema de Base de Datos
-- Plataforma multi-tenant SaaS de reservas de canchas deportivas
--
-- Este archivo refleja el estado ACTUAL de la base de datos en producción,
-- incluyendo todas las migraciones aplicadas. Úsalo para reproducir el
-- esquema completo en un proyecto Supabase nuevo.
-- ============================================================================

-- ============================================================================
-- EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;          -- limpieza automática programada
CREATE EXTENSION IF NOT EXISTS pgcrypto;         -- gen_random_uuid() (ya disponible en Supabase)

-- ============================================================================
-- FUNCIÓN: get_my_rol()
-- Propósito: Devuelve el rol del usuario autenticado desde profiles.
-- SECURITY DEFINER para evitar recursión en políticas RLS que necesitan
-- consultar profiles (de lo contrario la policy haría un SELECT en una tabla
-- que a su vez tiene RLS activo → bucle infinito).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_rol()
RETURNS TEXT AS $$
  SELECT rol FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- TABLA: profiles
-- Propósito: Extiende auth.users con nombre, teléfono, email y rol.
-- Se crea automáticamente via trigger al confirmar el email o registrarse.
-- Roles disponibles: 'cliente' | 'admin' | 'superadmin'
-- ============================================================================
CREATE TABLE profiles (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT    NOT NULL,
  telefono    TEXT,
  email       TEXT,                                -- email espejo de auth.users para queries rápidas
  rol         TEXT    NOT NULL DEFAULT 'cliente'
                      CHECK (rol IN ('cliente', 'admin', 'superadmin')),
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA: complejos
-- Propósito: Entidad principal del negocio. Representa un complejo deportivo.
-- Cada admin posee un complejo con un slug único para URLs públicas.
-- ============================================================================
CREATE TABLE complejos (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID    REFERENCES profiles(id),
  nombre      TEXT    NOT NULL,
  slug        TEXT    UNIQUE NOT NULL,
  descripcion TEXT,
  direccion   TEXT,
  logo_url    TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA: fotos_complejo
-- Propósito: Galería de fotos del complejo (relación 1:N).
-- Las URLs apuntan a Supabase Storage (bucket público fotos-complejos).
-- ============================================================================
CREATE TABLE fotos_complejo (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  complejo_id UUID    REFERENCES complejos(id) ON DELETE CASCADE,
  url         TEXT    NOT NULL,
  orden       INTEGER DEFAULT 0
);

-- ============================================================================
-- TABLA: canchas
-- Propósito: Canchas individuales dentro de un complejo.
-- Tipo: futbol5 | futbol7 | padel
-- Duración: 60 o 90 minutos por turno.
-- ============================================================================
CREATE TABLE canchas (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  complejo_id  UUID    REFERENCES complejos(id) ON DELETE CASCADE,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('futbol5', 'futbol7', 'padel')),
  nombre       TEXT    NOT NULL,
  duracion_min INTEGER NOT NULL CHECK (duracion_min IN (60, 90)),
  precio       NUMERIC(10,2) NOT NULL,
  activa       BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- TABLA: horarios_cancha
-- Propósito: Horarios de funcionamiento de cada cancha por día de la semana.
-- dia_semana: 0=domingo, 1=lunes, …, 6=sábado
-- ============================================================================
CREATE TABLE horarios_cancha (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id   UUID    REFERENCES canchas(id) ON DELETE CASCADE,
  dia_semana  INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME    NOT NULL,
  hora_fin    TIME    NOT NULL
);

-- ============================================================================
-- TABLA: bloqueos
-- Propósito: Bloqueos puntuales de turnos creados por el admin.
-- Inhabilita slots específicos (mantenimiento, eventos, etc).
-- ============================================================================
CREATE TABLE bloqueos (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id   UUID    REFERENCES canchas(id) ON DELETE CASCADE,
  fecha       DATE    NOT NULL,
  hora_inicio TIME    NOT NULL,
  motivo      TEXT,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA: reservas
-- Propósito: Registro de turnos reservados por los clientes.
-- Estados: confirmada | cancelada_admin
-- Método de pago: en_lugar (pago presencial)
-- mp_payment_id reservado para futura integración con MercadoPago.
-- asistio: registra si el cliente efectivamente se presentó (lo marca el admin).
-- ============================================================================
CREATE TABLE reservas (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id       UUID    REFERENCES canchas(id),
  cliente_id      UUID    REFERENCES profiles(id),
  fecha           DATE    NOT NULL,
  hora_inicio     TIME    NOT NULL,
  hora_fin        TIME    NOT NULL,
  metodo_pago     TEXT    NOT NULL CHECK (metodo_pago IN ('en_lugar', 'mercadopago')),
  estado          TEXT    NOT NULL DEFAULT 'confirmada'
                          CHECK (estado IN ('confirmada', 'cancelada_admin', 'pendiente_pago')),
  mp_payment_id   TEXT,                            -- reservado para futura integración MP
  asistio         BOOLEAN,                         -- NULL=sin registrar, true=asistió, false=no asistió
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único parcial: previene doble-booking de un slot.
-- Solo aplica a reservas activas (no canceladas).
CREATE UNIQUE INDEX reservas_slot_unico
  ON reservas (cancha_id, fecha, hora_inicio)
  WHERE estado NOT IN ('cancelada_admin');

-- ============================================================================
-- TABLA: resumen_meses
-- Propósito: Almacena KPIs agregados de cada mes DESPUÉS de que el admin
-- cierra el mes y borra permanentemente las reservas de ese período.
-- Permite mantener histórico sin conservar registros individuales.
-- ============================================================================
CREATE TABLE resumen_meses (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  complejo_id     UUID    REFERENCES complejos(id) ON DELETE CASCADE,
  anio            INTEGER NOT NULL,
  mes             INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  total_reservas  INTEGER NOT NULL DEFAULT 0,
  confirmadas     INTEGER NOT NULL DEFAULT 0,
  canceladas      INTEGER NOT NULL DEFAULT 0,
  asistieron      INTEGER NOT NULL DEFAULT 0,
  no_asistieron   INTEGER NOT NULL DEFAULT 0,
  ingresos        NUMERIC(12,2) NOT NULL DEFAULT 0,
  cerrado_en      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (complejo_id, anio, mes)
);

-- ============================================================================
-- TRIGGER: Crear profile automáticamente al registrarse un usuario
--
-- Seguridad:
--   - Clientes normales (signup público): siempre crean perfil con rol='cliente'.
--     No importa lo que vengan en raw_user_meta_data.rol — se ignora.
--   - Admins invitados via Edge Function invite-admin: el trigger detecta la invitación
--     chequeando DOS señales (cualquiera basta):
--       a) NEW.invited_at IS NOT NULL  → columna nativa que GoTrue setea en inviteUserByEmail
--       b) raw_user_meta_data->>'invited_at' IS NOT NULL → campo que la Edge Function
--          incluye explícitamente como fallback de seguridad
--   - Esto previene privilege escalation: un signUp normal no pasa ninguna de las dos
--     verificaciones, por lo que siempre obtiene 'cliente'.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_rol TEXT;
BEGIN
  -- Doble verificación para máxima robustez:
  --   a) columna nativa auth.users.invited_at (seteada por GoTrue en inviteUserByEmail)
  --   b) metadata->>'invited_at' (incluido por invite-admin Edge Function como fallback)
  -- Un signup público normal no cumple ninguna de las dos condiciones → siempre 'cliente'.
  IF NEW.invited_at IS NOT NULL
     OR NEW.raw_user_meta_data->>'invited_at' IS NOT NULL THEN
    v_rol := COALESCE(NEW.raw_user_meta_data->>'rol', 'cliente');
  ELSE
    v_rol := 'cliente';
  END IF;

  INSERT INTO public.profiles (user_id, nombre, telefono, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1), ''),
    NEW.raw_user_meta_data->>'telefono',
    NEW.email,
    v_rol
  )
  -- Re-invite del mismo email: actualizar perfil en lugar de fallar
  ON CONFLICT (user_id) DO UPDATE
    SET
      nombre   = EXCLUDED.nombre,
      telefono = EXCLUDED.telefono,
      email    = EXCLUDED.email,
      rol      = EXCLUDED.rol;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- TABLA: reservas_archivadas
-- Propósito: Historial de reservas archivadas al cerrar un mes.
-- Las reservas se copian aquí desde reservas (operativa), luego se eliminan
-- de la tabla principal para mantenerla liviana.
-- Sin FK constraints: los datos deben persistir aunque se borren canchas/perfiles.
-- complejo_id denormalizado para queries de historial por complejo.
-- ============================================================================
CREATE TABLE reservas_archivadas (
  id                 UUID        NOT NULL PRIMARY KEY,
  cancha_id          UUID,                      -- sin FK (datos de archivo)
  cliente_id         UUID,                      -- sin FK (datos de archivo)
  fecha              DATE        NOT NULL,
  hora_inicio        TIME        NOT NULL,
  hora_fin           TIME        NOT NULL,
  metodo_pago        TEXT        NOT NULL,
  estado             TEXT        NOT NULL,
  mp_payment_id      TEXT,
  asistio            BOOLEAN,
  creado_en          TIMESTAMPTZ,
  complejo_id        UUID        NOT NULL,
  archivado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archivado_por_mes  INTEGER     NOT NULL,
  archivado_por_anio INTEGER     NOT NULL
);

CREATE INDEX idx_reservas_archivadas_complejo_fecha
  ON reservas_archivadas (complejo_id, fecha);
CREATE INDEX idx_reservas_archivadas_cierre
  ON reservas_archivadas (complejo_id, archivado_por_anio, archivado_por_mes);

-- ============================================================================
-- LIMPIEZA AUTOMÁTICA con pg_cron
-- Archiva reservas en 'confirmada' con más de 60 días de antigüedad
-- y las borra de la tabla operativa.
-- Se ejecuta todos los lunes a las 03:00 UTC.
-- ============================================================================
SELECT cron.schedule(
  'limpiar-reservas-antiguas',
  '0 3 * * 1',  -- lunes 03:00 UTC
  $$
    -- Paso 1: Archivar
    INSERT INTO public.reservas_archivadas (
      id, cancha_id, cliente_id,
      fecha, hora_inicio, hora_fin,
      metodo_pago, estado, mp_payment_id,
      asistio, creado_en,
      complejo_id, archivado_en,
      archivado_por_mes, archivado_por_anio
    )
    SELECT
      r.id, r.cancha_id, r.cliente_id,
      r.fecha, r.hora_inicio, r.hora_fin,
      r.metodo_pago, r.estado, r.mp_payment_id,
      r.asistio, r.creado_en,
      ca.complejo_id, NOW(),
      EXTRACT(MONTH FROM r.fecha)::INTEGER,
      EXTRACT(YEAR  FROM r.fecha)::INTEGER
    FROM   public.reservas r
    JOIN   public.canchas ca ON ca.id = r.cancha_id
    WHERE  r.estado   = 'confirmada'
      AND  r.creado_en < NOW() - INTERVAL '60 days'
    ON CONFLICT (id) DO NOTHING;

    -- Paso 2: Borrar archivadas de la tabla operativa
    DELETE FROM public.reservas
    WHERE  estado    = 'confirmada'
      AND  creado_en < NOW() - INTERVAL '60 days'
      AND  id IN (SELECT id FROM public.reservas_archivadas);
  $$
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Principio: mínimo privilegio. Cada rol solo accede a lo que necesita.
-- Se usa get_my_rol() para evitar recursión en subqueries sobre profiles.
-- ============================================================================

-- --------------------------------------------------------------------------
-- RLS: profiles
-- --------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- El usuario ve y edita su propio perfil
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- El superadmin puede ver todos los perfiles (para panel de administración)
CREATE POLICY "profiles_select_superadmin"
  ON profiles FOR SELECT
  USING (get_my_rol() = 'superadmin');

-- Inserción solo via trigger (SECURITY DEFINER)
CREATE POLICY "profiles_insert_trigger"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- RLS: complejos
-- Lectura pública. Escritura solo para el admin dueño.
-- --------------------------------------------------------------------------
ALTER TABLE complejos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complejos_select_public"
  ON complejos FOR SELECT
  USING (true);

CREATE POLICY "complejos_insert_admin"
  ON complejos FOR INSERT
  WITH CHECK (
    admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND get_my_rol() = 'admin'
  );

CREATE POLICY "complejos_update_admin"
  ON complejos FOR UPDATE
  USING (
    admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "complejos_select_superadmin"
  ON complejos FOR SELECT
  USING (get_my_rol() = 'superadmin');

-- --------------------------------------------------------------------------
-- RLS: fotos_complejo
-- Lectura pública. Escritura/eliminación para el admin del complejo.
-- --------------------------------------------------------------------------
ALTER TABLE fotos_complejo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fotos_select_public"
  ON fotos_complejo FOR SELECT
  USING (true);

CREATE POLICY "fotos_insert_admin"
  ON fotos_complejo FOR INSERT
  WITH CHECK (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "fotos_update_admin"
  ON fotos_complejo FOR UPDATE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "fotos_delete_admin"
  ON fotos_complejo FOR DELETE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- RLS: canchas
-- Lectura pública. Escritura solo para el admin del complejo.
-- --------------------------------------------------------------------------
ALTER TABLE canchas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canchas_select_public"
  ON canchas FOR SELECT
  USING (true);

CREATE POLICY "canchas_insert_admin"
  ON canchas FOR INSERT
  WITH CHECK (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "canchas_update_admin"
  ON canchas FOR UPDATE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "canchas_delete_admin"
  ON canchas FOR DELETE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- RLS: horarios_cancha
-- Lectura pública. Escritura solo para el admin del complejo.
-- --------------------------------------------------------------------------
ALTER TABLE horarios_cancha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horarios_select_public"
  ON horarios_cancha FOR SELECT
  USING (true);

CREATE POLICY "horarios_insert_admin"
  ON horarios_cancha FOR INSERT
  WITH CHECK (
    cancha_id IN (
      SELECT ca.id FROM canchas ca
      JOIN complejos co ON ca.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "horarios_update_admin"
  ON horarios_cancha FOR UPDATE
  USING (
    cancha_id IN (
      SELECT ca.id FROM canchas ca
      JOIN complejos co ON ca.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "horarios_delete_admin"
  ON horarios_cancha FOR DELETE
  USING (
    cancha_id IN (
      SELECT ca.id FROM canchas ca
      JOIN complejos co ON ca.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- RLS: bloqueos
-- Solo el admin del complejo puede ver, crear y borrar bloqueos.
-- --------------------------------------------------------------------------
ALTER TABLE bloqueos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bloqueos_select_admin"
  ON bloqueos FOR SELECT
  USING (
    cancha_id IN (
      SELECT ca.id FROM canchas ca
      JOIN complejos co ON ca.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "bloqueos_insert_admin"
  ON bloqueos FOR INSERT
  WITH CHECK (
    cancha_id IN (
      SELECT ca.id FROM canchas ca
      JOIN complejos co ON ca.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "bloqueos_delete_admin"
  ON bloqueos FOR DELETE
  USING (
    cancha_id IN (
      SELECT ca.id FROM canchas ca
      JOIN complejos co ON ca.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- RLS: reservas
--
-- Lectura pública de slots ocupados: permite que usuarios no autenticados
-- vean qué horarios están tomados sin exponer datos del cliente.
-- El cliente ve sus propias reservas. El admin ve las de su complejo.
-- --------------------------------------------------------------------------
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver qué slots están ocupados (sin datos del cliente)
-- Esto es necesario para mostrar disponibilidad en el frontend público.
CREATE POLICY "reservas_select_public_slots"
  ON reservas FOR SELECT
  USING (estado IN ('confirmada', 'pendiente_pago'));

-- El cliente ve sus propias reservas completas
CREATE POLICY "reservas_select_cliente"
  ON reservas FOR SELECT
  USING (
    cliente_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- El admin ve todas las reservas de sus canchas
CREATE POLICY "reservas_select_admin"
  ON reservas FOR SELECT
  USING (
    cancha_id IN (
      SELECT ca.id FROM canchas ca
      JOIN complejos co ON ca.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Los clientes autenticados pueden crear reservas
CREATE POLICY "reservas_insert_cliente"
  ON reservas FOR INSERT
  WITH CHECK (
    cliente_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- El admin puede actualizar reservas de sus canchas (cancelar, registrar asistencia)
CREATE POLICY "reservas_update_admin"
  ON reservas FOR UPDATE
  USING (
    cancha_id IN (
      SELECT ca.id FROM canchas ca
      JOIN complejos co ON ca.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- El admin puede borrar reservas de sus canchas (cierre de mes)
CREATE POLICY "reservas_delete_admin"
  ON reservas FOR DELETE
  USING (
    cancha_id IN (
      SELECT ca.id FROM canchas ca
      JOIN complejos co ON ca.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- RLS: resumen_meses
-- El admin del complejo puede ver y crear su historial de meses cerrados.
-- --------------------------------------------------------------------------
ALTER TABLE resumen_meses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resumen_meses_select_admin"
  ON resumen_meses FOR SELECT
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "resumen_meses_insert_admin"
  ON resumen_meses FOR INSERT
  WITH CHECK (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "resumen_meses_update_admin"
  ON resumen_meses FOR UPDATE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "resumen_meses_select_superadmin"
  ON resumen_meses FOR SELECT
  USING (get_my_rol() = 'superadmin');

-- ============================================================================
-- RLS: reservas_archivadas
-- Solo el admin del complejo puede leer su historial archivado.
-- Escritura solo via cerrar_mes_complejo() (SECURITY DEFINER).
-- ============================================================================
ALTER TABLE reservas_archivadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archivadas_select_admin"
  ON reservas_archivadas FOR SELECT
  USING (
    complejo_id IN (
      SELECT c.id FROM complejos c
      JOIN profiles p ON p.id = c.admin_id
      WHERE p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- FUNCIÓN: cerrar_mes_complejo(complejo_id, anio, mes)
-- Cierra un mes atómicamente:
--   1. Verifica que el complejo pertenece al admin autenticado.
--   2. Calcula KPIs desde reservas + canchas.
--   3. Guarda KPIs en resumen_meses (upsert).
--   4. Copia reservas del mes a reservas_archivadas (INSERT ... ON CONFLICT DO NOTHING).
--   5. Borra reservas del mes de la tabla operativa.
-- Retorna JSONB con los KPIs para generar el PDF en el frontend.
-- SECURITY DEFINER para escribir en reservas_archivadas sin grant a authenticated.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cerrar_mes_complejo(
  p_complejo_id UUID,
  p_anio        INTEGER,
  p_mes         INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id  UUID;
  v_desde       DATE;
  v_hasta       DATE;
  v_total       INTEGER;
  v_confirmadas INTEGER;
  v_canceladas  INTEGER;
  v_asistieron  INTEGER;
  v_no_asist    INTEGER;
  v_ingresos    NUMERIC(12,2);
BEGIN
  SELECT p.id INTO v_profile_id FROM public.profiles p WHERE p.user_id = auth.uid();
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.complejos WHERE id = p_complejo_id AND admin_id = v_profile_id)
    THEN RAISE EXCEPTION 'UNAUTHORIZED: complejo no pertenece a este admin'; END IF;
  IF p_mes < 1 OR p_mes > 12 THEN RAISE EXCEPTION 'INVALID_MES'; END IF;

  -- Idempotencia: si ya está cerrado, devolver los KPIs guardados
  IF EXISTS (SELECT 1 FROM public.resumen_meses WHERE complejo_id = p_complejo_id AND anio = p_anio AND mes = p_mes) THEN
    RETURN (SELECT jsonb_build_object('ok',true,'ya_cerrado',true,'totalReservas',total_reservas,'confirmadas',confirmadas,'canceladas',canceladas,'asistieron',asistieron,'noAsistieron',no_asistieron,'ingresos',ingresos)
            FROM public.resumen_meses WHERE complejo_id = p_complejo_id AND anio = p_anio AND mes = p_mes);
  END IF;

  v_desde := make_date(p_anio, p_mes, 1);
  v_hasta := (make_date(p_anio, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE r.estado='confirmada'), COUNT(*) FILTER (WHERE r.estado='cancelada_admin'),
    COUNT(*) FILTER (WHERE r.asistio=true), COUNT(*) FILTER (WHERE r.asistio=false),
    COALESCE(SUM(ca.precio) FILTER (WHERE r.estado='confirmada'),0)
  INTO v_total, v_confirmadas, v_canceladas, v_asistieron, v_no_asist, v_ingresos
  FROM public.reservas r JOIN public.canchas ca ON ca.id=r.cancha_id
  WHERE ca.complejo_id=p_complejo_id AND r.fecha BETWEEN v_desde AND v_hasta;

  INSERT INTO public.resumen_meses(complejo_id,anio,mes,total_reservas,confirmadas,canceladas,asistieron,no_asistieron,ingresos,cerrado_en)
  VALUES(p_complejo_id,p_anio,p_mes,v_total,v_confirmadas,v_canceladas,v_asistieron,v_no_asist,v_ingresos,NOW())
  ON CONFLICT (complejo_id,anio,mes) DO UPDATE SET total_reservas=EXCLUDED.total_reservas,confirmadas=EXCLUDED.confirmadas,canceladas=EXCLUDED.canceladas,asistieron=EXCLUDED.asistieron,no_asistieron=EXCLUDED.no_asistieron,ingresos=EXCLUDED.ingresos,cerrado_en=EXCLUDED.cerrado_en;

  INSERT INTO public.reservas_archivadas(id,cancha_id,cliente_id,fecha,hora_inicio,hora_fin,metodo_pago,estado,mp_payment_id,asistio,creado_en,complejo_id,archivado_en,archivado_por_mes,archivado_por_anio)
  SELECT r.id,r.cancha_id,r.cliente_id,r.fecha,r.hora_inicio,r.hora_fin,r.metodo_pago,r.estado,r.mp_payment_id,r.asistio,r.creado_en,ca.complejo_id,NOW(),p_mes,p_anio
  FROM public.reservas r JOIN public.canchas ca ON ca.id=r.cancha_id
  WHERE ca.complejo_id=p_complejo_id AND r.fecha BETWEEN v_desde AND v_hasta
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.reservas WHERE id IN (
    SELECT r.id FROM public.reservas r JOIN public.canchas ca ON ca.id=r.cancha_id
    WHERE ca.complejo_id=p_complejo_id AND r.fecha BETWEEN v_desde AND v_hasta
  );

  RETURN jsonb_build_object('ok',true,'ya_cerrado',false,'totalReservas',v_total,'confirmadas',v_confirmadas,'canceladas',v_canceladas,'asistieron',v_asistieron,'noAsistieron',v_no_asist,'ingresos',v_ingresos);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cerrar_mes_complejo(UUID,INTEGER,INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cerrar_mes_complejo(UUID,INTEGER,INTEGER) TO authenticated;

-- ============================================================================
-- FUNCIÓN: marcar_asistencia(reserva_id, asistio)
-- Registra la asistencia de forma segura ante accesos concurrentes.
-- Usa SELECT FOR UPDATE para bloquear la fila antes de leer/escribir.
-- Retorna JSONB con código: UPDATED | ALREADY_MARKED | CONFLICT | NOT_FOUND | UNAUTHORIZED
-- SECURITY DEFINER para poder hacer FOR UPDATE con el lock a nivel de fila.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.marcar_asistencia(
  p_reserva_id UUID,
  p_asistio    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_reserva    public.reservas%ROWTYPE;
BEGIN
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL THEN RETURN jsonb_build_object('ok',false,'code','UNAUTHORIZED'); END IF;

  SELECT r.* INTO v_reserva
  FROM public.reservas r JOIN public.canchas ca ON ca.id=r.cancha_id JOIN public.complejos co ON co.id=ca.complejo_id
  WHERE r.id=p_reserva_id AND co.admin_id=v_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','NOT_FOUND'); END IF;

  IF v_reserva.asistio IS NOT DISTINCT FROM p_asistio THEN
    RETURN jsonb_build_object('ok',true,'code','ALREADY_MARKED','asistio',v_reserva.asistio);
  END IF;

  IF v_reserva.asistio IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'code','CONFLICT','actual',v_reserva.asistio,'msg',format('La asistencia ya fue marcada como %s por otra sesión.',CASE WHEN v_reserva.asistio THEN 'presente' ELSE 'ausente' END));
  END IF;

  UPDATE public.reservas SET asistio=p_asistio WHERE id=p_reserva_id;
  RETURN jsonb_build_object('ok',true,'code','UPDATED','asistio',p_asistio);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_asistencia(UUID,BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.marcar_asistencia(UUID,BOOLEAN) TO authenticated;

-- ============================================================================
-- STORAGE: buckets públicos para logos y galería de complejos
--
-- Tenant isolation: el path de cada archivo debe comenzar con el UUID del
-- complejo que le pertenece al admin. Se verifica con split_part(name,'/,1).
-- Esto impide que un admin pueda sobrescribir archivos de otro complejo.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-complejos', 'fotos-complejos', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública de logos
CREATE POLICY "logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

-- El admin sube logo solo al path de su propio complejo (logos/<complejo_id>/...)
CREATE POLICY "logos_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- El admin actualiza logo solo de su propio complejo
CREATE POLICY "logos_update_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- El admin borra logo solo de su propio complejo
CREATE POLICY "logos_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Lectura pública de fotos
CREATE POLICY "fotos_complejos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos-complejos');

-- El admin sube fotos solo al path de su propio complejo
CREATE POLICY "fotos_complejos_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-complejos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- El admin borra fotos solo de su propio complejo
CREATE POLICY "fotos_complejos_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fotos-complejos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );
