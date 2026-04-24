-- Migration: fix_invited_at_trigger
-- Corrige el bug en handle_new_user donde se chequeaba invited_at en el metadata JSON
-- en lugar de la columna invited_at de auth.users.
--
-- Comportamiento correcto:
--   - inviteUserByEmail() → setea auth.users.invited_at (columna nativa de Supabase)
--   - signUp() normal     → invited_at = NULL
--
-- El trigger anterior chequeaba raw_user_meta_data->>'invited_at' (siempre NULL
-- para invitados, porque Supabase no lo pone en el JSON), por lo que todos los
-- admins invitados terminaban con rol='cliente'. Este fix lo corrige.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_rol TEXT;
BEGIN
  -- Solo respetar el rol del metadata si el usuario fue invitado formalmente.
  -- inviteUserByEmail() setea NEW.invited_at (columna de auth.users), no el metadata.
  IF NEW.invited_at IS NOT NULL THEN
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
  -- Si el perfil ya existe (p.ej. re-invite del mismo email) lo actualizamos
  ON CONFLICT (user_id) DO UPDATE
    SET
      nombre    = EXCLUDED.nombre,
      telefono  = EXCLUDED.telefono,
      email     = EXCLUDED.email,
      rol       = EXCLUDED.rol;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
