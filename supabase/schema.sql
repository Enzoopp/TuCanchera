-- ============================================================================
-- TuCanchera — Esquema de Base de Datos
-- Plataforma multi-tenant SaaS de reservas de canchas deportivas
-- ============================================================================

-- ============================================================================
-- TABLA: codigos_invitacion
-- Propósito: Controlar el registro de administradores mediante códigos únicos.
-- Solo usuarios con un código válido pueden registrarse como admin.
-- ============================================================================
CREATE TABLE codigos_invitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA: profiles
-- Propósito: Extender la información del usuario de auth.users de Supabase.
-- Almacena nombre, teléfono y rol (cliente/admin).
-- Se crea automáticamente via trigger al confirmar el email.
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT,
  rol TEXT NOT NULL CHECK (rol IN ('cliente', 'admin')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA: complejos
-- Propósito: Entidad principal del negocio. Representa un complejo deportivo.
-- Cada admin posee un complejo con un slug único para URLs públicas.
-- ============================================================================
CREATE TABLE complejos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  direccion TEXT,
  logo_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA: fotos_complejo
-- Propósito: Galería de fotos del complejo (relación 1:N).
-- Las URLs apuntan a Supabase Storage (bucket público fotos-complejos).
-- ============================================================================
CREATE TABLE fotos_complejo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complejo_id UUID REFERENCES complejos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  orden INTEGER DEFAULT 0
);

-- ============================================================================
-- TABLA: canchas
-- Propósito: Canchas individuales dentro de un complejo.
-- Cada cancha tiene tipo (fútbol5/fútbol7/pádel), precio y duración de turno.
-- ============================================================================
CREATE TABLE canchas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complejo_id UUID REFERENCES complejos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('futbol5', 'futbol7', 'padel')),
  nombre TEXT NOT NULL,
  duracion_min INTEGER NOT NULL CHECK (duracion_min IN (60, 90)),
  precio NUMERIC(10,2) NOT NULL,
  activa BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- TABLA: horarios_cancha
-- Propósito: Horarios de funcionamiento de cada cancha por día de la semana.
-- Permite configurar rangos horarios diferentes para cada día.
-- dia_semana: 0=domingo, 1=lunes, ..., 6=sábado
-- ============================================================================
CREATE TABLE horarios_cancha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id UUID REFERENCES canchas(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL
);

-- ============================================================================
-- TABLA: bloqueos
-- Propósito: Bloqueos puntuales de turnos creados por el admin.
-- Permite al admin inhabilitar slots específicos (mantenimiento, eventos, etc).
-- ============================================================================
CREATE TABLE bloqueos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id UUID REFERENCES canchas(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  motivo TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA: reservas
-- Propósito: Registro de turnos reservados por los clientes.
-- Estados: pendiente_pago (esperando MP), confirmada, cancelada_admin.
-- ============================================================================
CREATE TABLE reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id UUID REFERENCES canchas(id),
  cliente_id UUID REFERENCES profiles(id),
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('mercadopago', 'en_lugar')),
  estado TEXT NOT NULL DEFAULT 'pendiente_pago'
    CHECK (estado IN ('pendiente_pago', 'confirmada', 'cancelada_admin')),
  mp_payment_id TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRIGGER: Crear profile automáticamente al registrarse un usuario
-- Propósito: Cuando un usuario confirma su email en Supabase Auth,
-- se crea su perfil en la tabla profiles con los datos de raw_user_meta_data.
-- El rol se toma del metadata que el frontend envía al registrar.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre, telefono, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    NEW.raw_user_meta_data->>'telefono',
    COALESCE(NEW.raw_user_meta_data->>'rol', 'cliente')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Principio: mínimo privilegio. Cada rol solo accede a lo que necesita.
-- ============================================================================

-- --------------------------------------------------------------------------
-- RLS: profiles
-- Regla: el usuario solo puede leer y editar su propio perfil.
-- --------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver su propio perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden editar su propio perfil"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Permitir inserción desde el trigger (SECURITY DEFINER)
CREATE POLICY "El sistema puede crear perfiles via trigger"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- RLS: codigos_invitacion
-- Regla: solo lectura pública para validar códigos durante el registro.
-- La escritura se maneja desde funciones SECURITY DEFINER o el dashboard.
-- --------------------------------------------------------------------------
ALTER TABLE codigos_invitacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede verificar un código de invitación"
  ON codigos_invitacion FOR SELECT
  USING (true);

-- --------------------------------------------------------------------------
-- RLS: complejos
-- Regla: lectura pública (cualquiera puede ver un complejo por su slug).
-- Escritura solo para el admin dueño del complejo.
-- --------------------------------------------------------------------------
ALTER TABLE complejos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de complejos"
  ON complejos FOR SELECT
  USING (true);

CREATE POLICY "El admin puede crear su complejo"
  ON complejos FOR INSERT
  WITH CHECK (
    admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
  );

CREATE POLICY "El admin puede editar su complejo"
  ON complejos FOR UPDATE
  USING (
    admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
  );

-- --------------------------------------------------------------------------
-- RLS: fotos_complejo
-- Regla: lectura pública. Escritura solo para el admin del complejo.
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
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

CREATE POLICY "El admin puede eliminar fotos de su complejo"
  ON fotos_complejo FOR DELETE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

CREATE POLICY "El admin puede actualizar fotos de su complejo"
  ON fotos_complejo FOR UPDATE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

-- --------------------------------------------------------------------------
-- RLS: canchas
-- Regla: lectura pública. Escritura solo para el admin del complejo.
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
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

CREATE POLICY "El admin puede editar canchas de su complejo"
  ON canchas FOR UPDATE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

CREATE POLICY "El admin puede eliminar canchas de su complejo"
  ON canchas FOR DELETE
  USING (
    complejo_id IN (
      SELECT id FROM complejos
      WHERE admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

-- --------------------------------------------------------------------------
-- RLS: horarios_cancha
-- Regla: lectura pública. Escritura solo para el admin del complejo.
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
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

CREATE POLICY "El admin puede editar horarios de sus canchas"
  ON horarios_cancha FOR UPDATE
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

CREATE POLICY "El admin puede eliminar horarios de sus canchas"
  ON horarios_cancha FOR DELETE
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

-- --------------------------------------------------------------------------
-- RLS: bloqueos
-- Regla: solo el admin del complejo puede crear, ver y borrar bloqueos.
-- --------------------------------------------------------------------------
ALTER TABLE bloqueos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "El admin puede ver bloqueos de sus canchas"
  ON bloqueos FOR SELECT
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

CREATE POLICY "El admin puede crear bloqueos en sus canchas"
  ON bloqueos FOR INSERT
  WITH CHECK (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

CREATE POLICY "El admin puede eliminar bloqueos de sus canchas"
  ON bloqueos FOR DELETE
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

-- --------------------------------------------------------------------------
-- RLS: reservas
-- Regla: el cliente solo ve sus propias reservas.
-- El admin ve todas las reservas de las canchas de su complejo.
-- --------------------------------------------------------------------------
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "El cliente puede ver sus propias reservas"
  ON reservas FOR SELECT
  USING (
    cliente_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "El admin puede ver reservas de su complejo"
  ON reservas FOR SELECT
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

CREATE POLICY "Los clientes pueden crear reservas"
  ON reservas FOR INSERT
  WITH CHECK (
    cliente_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "El admin puede actualizar reservas de su complejo"
  ON reservas FOR UPDATE
  USING (
    cancha_id IN (
      SELECT c.id FROM canchas c
      JOIN complejos co ON c.complejo_id = co.id
      WHERE co.admin_id = (SELECT id FROM profiles WHERE user_id = auth.uid() AND rol = 'admin')
    )
  );

-- =====================================================================
-- STORAGE: buckets públicos para logos y galería de complejos
-- =====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-complejos', 'fotos-complejos', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública, escritura restringida a admins autenticados
CREATE POLICY "Lectura pública de logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Admin sube su logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND rol = 'admin'
    )
  );

CREATE POLICY "Admin actualiza su logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND rol = 'admin'
    )
  );

CREATE POLICY "Lectura pública de fotos de complejos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos-complejos');

CREATE POLICY "Admin sube fotos de su complejo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-complejos'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND rol = 'admin'
    )
  );

CREATE POLICY "Admin elimina fotos de su complejo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fotos-complejos'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND rol = 'admin'
    )
  );
