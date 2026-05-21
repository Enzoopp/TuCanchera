-- ============================================================================
-- TuCanchera — Esquema de Base de Datos
-- Plataforma multi-tenant SaaS de reservas de canchas deportivas
--
-- Este archivo refleja el estado ACTUAL de la base de datos en producción,
-- incluyendo todas las migraciones aplicadas. Úsalo para reproducir el
-- esquema completo en un proyecto Supabase nuevo.
--
-- Última sincronización: 2026-05-21 (migración audit_comprehensive_fixes)
-- ============================================================================

-- ============================================================================
-- EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;          -- limpieza automática programada
CREATE EXTENSION IF NOT EXISTS pgcrypto;         -- gen_random_uuid()

-- ============================================================================
-- FUNCIÓN: get_my_rol()
-- Propósito: Devuelve el rol del usuario autenticado desde profiles.
-- SECURITY DEFINER para evitar recursión en políticas RLS que necesitan
-- consultar profiles (de lo contrario la policy haría un SELECT en una tabla
-- que a su vez tiene RLS activo → bucle infinito).
-- SET search_path previene ataques de search_path manipulation.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_rol()
RETURNS TEXT AS $$
  SELECT rol FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
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
  ciudad      TEXT,                                -- agregado en migración add_ciudad_complejo
  logo_url    TEXT,
  activo      BOOLEAN DEFAULT TRUE,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_complejos_admin_id ON complejos (admin_id);

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

CREATE INDEX idx_fotos_complejo_id ON fotos_complejo (complejo_id);

-- ============================================================================
-- TABLA: canchas
-- Propósito: Canchas individuales dentro de un complejo.
-- Tipo: futbol5 | futbol7 | padel
-- Duración: 60 o 90 minutos por turno.
-- franjas_precio: JSONB con array de FranjaPrecio[] para precios diferenciados
--   por horario. Si es NULL, se usa el precio base de la columna precio.
--   Estructura de cada franja: { desde: "HH:MM", hasta: "HH:MM", precio: number }
-- ============================================================================
CREATE TABLE canchas (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  complejo_id    UUID    REFERENCES complejos(id) ON DELETE CASCADE,
  tipo           TEXT    NOT NULL CHECK (tipo IN ('futbol5', 'futbol7', 'padel')),
  nombre         TEXT    NOT NULL,
  duracion_min   INTEGER NOT NULL CHECK (duracion_min IN (60, 90)),
  precio         NUMERIC(10,2) NOT NULL,
  activa         BOOLEAN DEFAULT TRUE,
  franjas_precio JSONB                             -- FranjaPrecio[] | null
);

CREATE INDEX idx_canchas_complejo_id ON canchas (complejo_id);

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

CREATE INDEX idx_horarios_cancha_id ON horarios_cancha (cancha_id);

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

CREATE INDEX idx_bloqueos_cancha_id ON bloqueos (cancha_id);

-- ============================================================================
-- TABLA: reservas
-- Propósito: Registro de turnos reservados por los clientes.
-- Estados: confirmada | cancelada_admin | pendiente_pago
-- precio: precio efectivo al momento de reservar (puede diferir del base
--   si la cancha tiene franjas_precio configuradas).
-- asistio: registra si el cliente efectivamente se presentó (lo marca el admin).
-- archivada: flag de soft-delete para reservas procesadas por cerrar_mes_complejo().
-- ============================================================================
CREATE TABLE reservas (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id       UUID    REFERENCES canchas(id),
  cliente_id      UUID    REFERENCES profiles(id),
  fecha           DATE    NOT NULL,
  hora_inicio     TIME    NOT NULL,
  hora_fin        TIME    NOT NULL,
  metodo_pago     TEXT    NOT NULL CHECK (metodo_pago IN ('en_lugar', 'mercadopago')),
  estado          TEXT    NOT NULL DEFAULT 'pendiente_pago'
                          CHECK (estado IN ('confirmada', 'cancelada_admin', 'cancelada_cliente', 'pendiente_pago')),
  mp_payment_id   TEXT,                            -- reservado para futura integración MP
  asistio         BOOLEAN,                         -- NULL=sin registrar, true=asistió, false=no asistió
  archivada       BOOLEAN NOT NULL DEFAULT false,  -- true cuando fue copiada a reservas_archivadas
  precio          NUMERIC(10,2) NOT NULL DEFAULT 0, -- precio efectivo al reservar
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único parcial: previene doble-booking de un slot.
-- Solo aplica a reservas activas (excluye ambos tipos de cancelación).
CREATE UNIQUE INDEX reservas_slot_unico
  ON reservas (cancha_id, fecha, hora_inicio)
  WHERE estado NOT IN ('cancelada_admin', 'cancelada_cliente');

CREATE INDEX idx_reservas_cliente_id ON reservas (cliente_id);

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
-- TABLA: codigos_invitacion
-- Propósito: Códigos de un solo uso para el flujo de registro de admins
-- (RegisterAdmin.tsx). Un admin invitado ingresa un código para completar
-- su perfil. RLS permite lectura pública (verificación de código) y
-- actualización por cualquier usuario autenticado.
-- ============================================================================
CREATE TABLE codigos_invitacion (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo    TEXT    UNIQUE NOT NULL,
  usado     BOOLEAN DEFAULT false,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA: reservas_archivadas
-- Propósito: Historial de reservas archivadas al cerrar un mes.
-- Las reservas se copian aquí desde reservas (operativa), luego se eliminan
-- de la tabla principal para mantenerla liviana.
-- Sin FK constraints: los datos deben persistir aunque se borren canchas/perfiles.
-- complejo_id denormalizado para queries de historial por complejo.
-- precio: precio efectivo al momento de la reserva (copiado de reservas.precio).
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
  precio             NUMERIC(10,2) NOT NULL DEFAULT 0,  -- precio efectivo archivado
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
-- LIMPIEZA AUTOMÁTICA con pg_cron
-- Archiva reservas confirmadas con más de 60 días de antigüedad.
-- Se ejecuta todos los lunes a las 03:00 UTC.
-- ============================================================================
SELECT cron.schedule(
  'limpiar-reservas-antiguas',
  '0 3 * * 1',
  $$
    INSERT INTO public.reservas_archivadas (
      id, cancha_id, cliente_id,
      fecha, hora_inicio, hora_fin,
      metodo_pago, estado, mp_payment_id,
      asistio, creado_en, precio,
      complejo_id, archivado_en,
      archivado_por_mes, archivado_por_anio
    )
    SELECT
      r.id, r.cancha_id, r.cliente_id,
      r.fecha, r.hora_inicio, r.hora_fin,
      r.metodo_pago, r.estado, r.mp_payment_id,
      r.asistio, r.creado_en, r.precio,
      ca.complejo_id, NOW(),
      EXTRACT(MONTH FROM r.fecha)::INTEGER,
      EXTRACT(YEAR  FROM r.fecha)::INTEGER
    FROM   public.reservas r
    JOIN   public.canchas ca ON ca.id = r.cancha_id
    WHERE  r.estado   = 'confirmada'
      AND  r.creado_en < NOW() - INTERVAL '60 days'
    ON CONFLICT (id) DO NOTHING;

    DELETE FROM public.reservas
    WHERE  estado    = 'confirmada'
      AND  creado_en < NOW() - INTERVAL '60 days'
      AND  id IN (SELECT id FROM public.reservas_archivadas);
  $$
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Principio: mínimo privilegio. Cada rol solo accede a lo que necesita.
-- NOTA: auth.uid() se envuelve en (SELECT auth.uid()) para que PG lo evalúe
-- una vez por query (cacheable) en lugar de una vez por fila — mejora
-- el rendimiento significativamente en tablas con muchas filas.
-- ============================================================================

-- --------------------------------------------------------------------------
-- RLS: profiles
-- --------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- El usuario ve su propio perfil.
-- El admin ve solo clientes que reservaron en su complejo (+ su propio perfil admin).
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR
    (
      get_my_rol() = 'admin'
      AND (
        rol = 'admin'
        OR id IN (
          SELECT DISTINCT r.cliente_id
          FROM reservas r
          JOIN canchas ca ON ca.id = r.cancha_id
          JOIN complejos co ON co.id = ca.complejo_id
          JOIN profiles p_admin ON p_admin.id = co.admin_id
          WHERE p_admin.user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- Cada usuario solo puede actualizar su propio perfil
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Inserción solo via trigger SECURITY DEFINER (handle_new_user)
CREATE POLICY "El sistema puede crear perfiles via trigger"
  ON profiles FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- --------------------------------------------------------------------------
-- RLS: complejos
-- Lectura pública. Escritura solo para el admin dueño.
-- --------------------------------------------------------------------------
ALTER TABLE complejos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de complejos"
  ON complejos FOR SELECT
  USING (true);

CREATE POLICY "El admin puede crear su complejo"
  ON complejos FOR INSERT
  WITH CHECK (
    admin_id = (
      SELECT id FROM profiles
      WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
    )
  );

CREATE POLICY "El admin puede editar su complejo"
  ON complejos FOR UPDATE
  USING (
    admin_id = (
      SELECT id FROM profiles
      WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
    )
  );

-- --------------------------------------------------------------------------
-- RLS: fotos_complejo
-- Lectura pública. Escritura/eliminación para el admin del complejo.
-- --------------------------------------------------------------------------
ALTER TABLE fotos_complejo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de fotos"
  ON fotos_complejo FOR SELECT
  USING (true);

CREATE POLICY "El admin puede gestionar fotos de su complejo"
  ON fotos_complejo FOR INSERT
  WITH CHECK (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

CREATE POLICY "El admin puede actualizar fotos de su complejo"
  ON fotos_complejo FOR UPDATE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

CREATE POLICY "El admin puede eliminar fotos de su complejo"
  ON fotos_complejo FOR DELETE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

-- --------------------------------------------------------------------------
-- RLS: canchas
-- Lectura pública. Escritura solo para el admin del complejo.
-- --------------------------------------------------------------------------
ALTER TABLE canchas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de canchas"
  ON canchas FOR SELECT
  USING (true);

CREATE POLICY "El admin puede crear canchas en su complejo"
  ON canchas FOR INSERT
  WITH CHECK (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

CREATE POLICY "El admin puede editar canchas de su complejo"
  ON canchas FOR UPDATE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

CREATE POLICY "El admin puede eliminar canchas de su complejo"
  ON canchas FOR DELETE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

-- --------------------------------------------------------------------------
-- RLS: horarios_cancha
-- Lectura pública. Escritura solo para el admin del complejo.
-- --------------------------------------------------------------------------
ALTER TABLE horarios_cancha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de horarios"
  ON horarios_cancha FOR SELECT
  USING (true);

CREATE POLICY "El admin puede crear horarios de sus canchas"
  ON horarios_cancha FOR INSERT
  WITH CHECK (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

CREATE POLICY "El admin puede editar horarios de sus canchas"
  ON horarios_cancha FOR UPDATE
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

CREATE POLICY "El admin puede eliminar horarios de sus canchas"
  ON horarios_cancha FOR DELETE
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

-- --------------------------------------------------------------------------
-- RLS: bloqueos
-- Lectura pública (necesaria para mostrar slots bloqueados a clientes).
-- Escritura/eliminación solo para el admin del complejo.
-- --------------------------------------------------------------------------
ALTER TABLE bloqueos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de bloqueos"
  ON bloqueos FOR SELECT
  USING (true);

CREATE POLICY "El admin puede crear bloqueos en sus canchas"
  ON bloqueos FOR INSERT
  WITH CHECK (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

CREATE POLICY "El admin puede eliminar bloqueos de sus canchas"
  ON bloqueos FOR DELETE
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

-- --------------------------------------------------------------------------
-- RLS: reservas
--
-- Lectura pública de slots ocupados: permite que usuarios no autenticados
-- vean qué horarios están tomados sin exponer datos del cliente.
-- El cliente ve sus propias reservas completas. El admin ve las de su complejo.
-- --------------------------------------------------------------------------
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- La disponibilidad pública se sirve vía RPC get_disponibilidad_slots()
-- (sin exponer PII). No hay política SELECT pública en esta tabla.

-- El cliente ve sus propias reservas completas
CREATE POLICY "El cliente puede ver sus propias reservas"
  ON reservas FOR SELECT
  USING (
    cliente_id = (
      SELECT id FROM profiles
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- El admin ve todas las reservas de sus canchas
CREATE POLICY "El admin puede ver reservas de su complejo"
  ON reservas FOR SELECT
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

-- Los clientes autenticados pueden crear reservas
CREATE POLICY "Los clientes pueden crear reservas"
  ON reservas FOR INSERT
  WITH CHECK (
    cliente_id = (
      SELECT id FROM profiles
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- El admin puede actualizar reservas de sus canchas (cancelar, registrar asistencia)
CREATE POLICY "El admin puede actualizar reservas de su complejo"
  ON reservas FOR UPDATE
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (
        SELECT id FROM profiles
        WHERE user_id = (SELECT auth.uid()) AND rol = 'admin'
      )
    )
  );

-- --------------------------------------------------------------------------
-- RLS: resumen_meses
-- El admin del complejo puede ver y gestionar su historial de meses cerrados.
-- --------------------------------------------------------------------------
ALTER TABLE resumen_meses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestiona sus resúmenes"
  ON resumen_meses FOR ALL
  USING (
    complejo_id IN (
      SELECT c.id FROM complejos c
      JOIN profiles p ON p.id = c.admin_id
      WHERE p.user_id = (SELECT auth.uid()) AND p.rol = 'admin'
    )
  )
  WITH CHECK (
    complejo_id IN (
      SELECT c.id FROM complejos c
      JOIN profiles p ON p.id = c.admin_id
      WHERE p.user_id = (SELECT auth.uid()) AND p.rol = 'admin'
    )
  );

-- --------------------------------------------------------------------------
-- RLS: reservas_archivadas
-- Solo el admin del complejo puede leer su historial archivado.
-- Escritura solo via cerrar_mes_complejo() (SECURITY DEFINER).
-- --------------------------------------------------------------------------
ALTER TABLE reservas_archivadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archivadas_select_admin"
  ON reservas_archivadas FOR SELECT
  USING (
    complejo_id IN (
      SELECT c.id FROM complejos c
      JOIN profiles p ON p.id = c.admin_id
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- RLS: codigos_invitacion
-- El onboarding de admins es solo por invitación via Edge Function (superadmin).
-- Sin políticas públicas: solo service_role puede leer/escribir.
-- --------------------------------------------------------------------------
ALTER TABLE codigos_invitacion ENABLE ROW LEVEL SECURITY;

-- Sin políticas SELECT/UPDATE para anon o authenticated.
-- Las Edge Functions de invitación usan el service_role key del servidor.

-- ============================================================================
-- FUNCIÓN: cerrar_mes_complejo(complejo_id, anio, mes)
-- Cierra un mes atómicamente:
--   1. Verifica que el complejo pertenece al admin autenticado.
--   2. Calcula KPIs desde reservas (usando r.precio — precio efectivo).
--   3. Guarda KPIs en resumen_meses (upsert).
--   4. Copia reservas del mes a reservas_archivadas incluyendo r.precio.
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
  SELECT p.id INTO v_profile_id
  FROM public.profiles p WHERE p.user_id = (SELECT auth.uid());

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.complejos
    WHERE id = p_complejo_id AND admin_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: complejo no pertenece a este admin';
  END IF;

  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'INVALID_MES';
  END IF;

  -- Idempotencia: ya cerrado → devolver KPIs guardados
  IF EXISTS (
    SELECT 1 FROM public.resumen_meses
    WHERE complejo_id = p_complejo_id AND anio = p_anio AND mes = p_mes
  ) THEN
    RETURN (
      SELECT jsonb_build_object(
        'ok', true, 'ya_cerrado', true,
        'totalReservas', rm.total_reservas,
        'confirmadas',   rm.confirmadas,
        'canceladas',    rm.canceladas,
        'asistieron',    rm.asistieron,
        'noAsistieron',  rm.no_asistieron,
        'ingresos',      rm.ingresos
      )
      FROM public.resumen_meses rm
      WHERE rm.complejo_id = p_complejo_id
        AND rm.anio = p_anio AND rm.mes = p_mes
    );
  END IF;

  v_desde := make_date(p_anio, p_mes, 1);
  v_hasta := (make_date(p_anio, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

  -- Usar r.precio (efectivo al reservar) en lugar de ca.precio (precio base)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE r.estado = 'confirmada'),
    COUNT(*) FILTER (WHERE r.estado IN ('cancelada_admin', 'cancelada_cliente')),
    COUNT(*) FILTER (WHERE r.asistio = true),
    COUNT(*) FILTER (WHERE r.asistio = false),
    COALESCE(SUM(r.precio) FILTER (WHERE r.estado = 'confirmada'), 0)
  INTO v_total, v_confirmadas, v_canceladas, v_asistieron, v_no_asist, v_ingresos
  FROM public.reservas r
  JOIN public.canchas ca ON ca.id = r.cancha_id
  WHERE ca.complejo_id = p_complejo_id
    AND r.fecha BETWEEN v_desde AND v_hasta;

  INSERT INTO public.resumen_meses (
    complejo_id, anio, mes,
    total_reservas, confirmadas, canceladas,
    asistieron, no_asistieron, ingresos, cerrado_en
  ) VALUES (
    p_complejo_id, p_anio, p_mes,
    v_total, v_confirmadas, v_canceladas,
    v_asistieron, v_no_asist, v_ingresos, NOW()
  )
  ON CONFLICT (complejo_id, anio, mes) DO UPDATE
    SET total_reservas = EXCLUDED.total_reservas,
        confirmadas    = EXCLUDED.confirmadas,
        canceladas     = EXCLUDED.canceladas,
        asistieron     = EXCLUDED.asistieron,
        no_asistieron  = EXCLUDED.no_asistieron,
        ingresos       = EXCLUDED.ingresos,
        cerrado_en     = EXCLUDED.cerrado_en;

  -- Archivar incluyendo precio efectivo
  INSERT INTO public.reservas_archivadas (
    id, cancha_id, cliente_id,
    fecha, hora_inicio, hora_fin,
    metodo_pago, estado, mp_payment_id,
    asistio, creado_en, precio,
    complejo_id, archivado_en,
    archivado_por_mes, archivado_por_anio
  )
  SELECT
    r.id, r.cancha_id, r.cliente_id,
    r.fecha, r.hora_inicio, r.hora_fin,
    r.metodo_pago, r.estado, r.mp_payment_id,
    r.asistio, r.creado_en, r.precio,
    ca.complejo_id, NOW(), p_mes, p_anio
  FROM public.reservas r
  JOIN public.canchas ca ON ca.id = r.cancha_id
  WHERE ca.complejo_id = p_complejo_id
    AND r.fecha BETWEEN v_desde AND v_hasta
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.reservas
  WHERE id IN (
    SELECT r.id FROM public.reservas r
    JOIN public.canchas ca ON ca.id = r.cancha_id
    WHERE ca.complejo_id = p_complejo_id
      AND r.fecha BETWEEN v_desde AND v_hasta
  );

  RETURN jsonb_build_object(
    'ok', true, 'ya_cerrado', false,
    'totalReservas', v_total,
    'confirmadas',   v_confirmadas,
    'canceladas',    v_canceladas,
    'asistieron',    v_asistieron,
    'noAsistieron',  v_no_asist,
    'ingresos',      v_ingresos
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cerrar_mes_complejo(UUID,INTEGER,INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cerrar_mes_complejo(UUID,INTEGER,INTEGER) TO authenticated;

-- ============================================================================
-- FUNCIÓN: marcar_asistencia(reserva_id, asistio)
-- Registra la asistencia de forma segura ante accesos concurrentes.
-- Usa SELECT FOR UPDATE para bloquear la fila antes de leer/escribir.
-- Retorna JSONB con código: UPDATED | ALREADY_MARKED | CONFLICT | NOT_FOUND | UNAUTHORIZED
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
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = (SELECT auth.uid());
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  END IF;

  SELECT r.* INTO v_reserva
  FROM public.reservas r
  JOIN public.canchas ca  ON ca.id  = r.cancha_id
  JOIN public.complejos co ON co.id = ca.complejo_id
  WHERE r.id = p_reserva_id AND co.admin_id = v_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  IF v_reserva.asistio IS NOT DISTINCT FROM p_asistio THEN
    RETURN jsonb_build_object('ok', true, 'code', 'ALREADY_MARKED', 'asistio', v_reserva.asistio);
  END IF;

  IF v_reserva.asistio IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'code', 'CONFLICT',
      'actual', v_reserva.asistio,
      'msg', format(
        'La asistencia ya fue marcada como %s por otra sesión.',
        CASE WHEN v_reserva.asistio THEN 'presente' ELSE 'ausente' END
      )
    );
  END IF;

  UPDATE public.reservas SET asistio = p_asistio WHERE id = p_reserva_id;
  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'asistio', p_asistio);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_asistencia(UUID,BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.marcar_asistencia(UUID,BOOLEAN) TO authenticated;

-- ============================================================================
-- FUNCIÓN: cancelar_reserva_admin(reserva_id)
-- Cancela una reserva verificando que pertenece al complejo del admin.
-- Centraliza la lógica de negocio para facilitar futuras extensiones
-- (notificaciones, validaciones de tiempo, etc.).
-- Retorna JSONB con ok/code: CANCELLED | NOT_FOUND | UNAUTHORIZED
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancelar_reserva_admin(
  p_reserva_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles WHERE user_id = (SELECT auth.uid());

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.reservas r
    JOIN public.canchas ca  ON ca.id  = r.cancha_id
    JOIN public.complejos co ON co.id = ca.complejo_id
    WHERE r.id = p_reserva_id AND co.admin_id = v_profile_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  UPDATE public.reservas SET estado = 'cancelada_admin' WHERE id = p_reserva_id;
  RETURN jsonb_build_object('ok', true, 'code', 'CANCELLED');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancelar_reserva_admin(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cancelar_reserva_admin(UUID) TO authenticated;

-- ============================================================================
-- FUNCIÓN: cancelar_reserva_cliente(reserva_id)
-- Permite al cliente cancelar su propia reserva.
-- Valida: ownership, estado cancelable, ventana mínima de 24 hs.
-- Retorna: { ok, code } — codes: CANCELLED | UNAUTHORIZED | NOT_FOUND |
--          WRONG_STATUS | TOO_LATE (+ horas_restantes)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancelar_reserva_cliente(
  p_reserva_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id  UUID;
  v_reserva     RECORD;
  v_inicio      TIMESTAMPTZ;
  v_horas_rest  NUMERIC;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles WHERE user_id = (SELECT auth.uid());

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  END IF;

  SELECT * INTO v_reserva
  FROM public.reservas
  WHERE id = p_reserva_id AND cliente_id = v_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  IF v_reserva.estado NOT IN ('confirmada', 'pendiente_pago') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WRONG_STATUS');
  END IF;

  v_inicio := (v_reserva.fecha || ' ' || v_reserva.hora_inicio)::TIMESTAMPTZ;
  v_horas_rest := EXTRACT(EPOCH FROM (v_inicio - NOW())) / 3600.0;

  IF v_horas_rest < 24 THEN
    RETURN jsonb_build_object(
      'ok',              false,
      'code',            'TOO_LATE',
      'horas_restantes', GREATEST(v_horas_rest, 0)
    );
  END IF;

  UPDATE public.reservas SET estado = 'cancelada_cliente' WHERE id = p_reserva_id;
  RETURN jsonb_build_object('ok', true, 'code', 'CANCELLED');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancelar_reserva_cliente(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cancelar_reserva_cliente(UUID) TO authenticated;

-- ============================================================================
-- FUNCIÓN: get_disponibilidad_slots(cancha_id, fecha)
-- Devuelve los slots ocupados para una cancha en una fecha, SIN PII.
-- Solo expone: cancha_id, fecha, hora_inicio, hora_fin, estado.
-- Accesible por anon y authenticated (disponibilidad pública).
-- Reemplaza la política SELECT pública de la tabla reservas.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_disponibilidad_slots(
  p_cancha_id UUID,
  p_fecha     DATE
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
    AND r.fecha     = p_fecha
    AND r.estado    IN ('confirmada', 'pendiente_pago');
$$;

REVOKE EXECUTE ON FUNCTION public.get_disponibilidad_slots(UUID, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_disponibilidad_slots(UUID, DATE) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_disponibilidad_slots(UUID, DATE) TO authenticated;

-- ============================================================================
-- STORAGE: buckets públicos para logos y galería de complejos
--
-- Tenant isolation: el path de cada archivo debe comenzar con el UUID del
-- complejo que le pertenece al admin. Se verifica con split_part(name,'/',1).
-- Esto impide que un admin pueda sobrescribir archivos de otro complejo.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-complejos', 'fotos-complejos', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública de logos (solo por path conocido, no permite listing vacío)
CREATE POLICY "logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos' AND name IS NOT NULL AND length(name) > 0);

-- El admin sube logo solo al path de su propio complejo
CREATE POLICY "Admin sube logo de su complejo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()))
    )
  );

-- El admin actualiza logo solo de su propio complejo
CREATE POLICY "Admin actualiza logo de su complejo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()))
    )
  );

-- El admin borra logo solo de su propio complejo
CREATE POLICY "Admin borra logo de su complejo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()))
    )
  );

-- Lectura pública de fotos (solo por path conocido, no permite listing vacío)
CREATE POLICY "fotos_complejos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos-complejos' AND name IS NOT NULL AND length(name) > 0);

-- El admin sube fotos solo al path de su propio complejo
CREATE POLICY "Admin sube fotos de su complejo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-complejos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()))
    )
  );

-- El admin borra fotos solo de su propio complejo
CREATE POLICY "Admin borra fotos de su complejo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fotos-complejos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid()))
    )
  );
