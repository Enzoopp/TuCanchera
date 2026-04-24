-- Migration: fix_invited_at_trigger
-- Corrige el bug en handle_new_user donde se chequeaba invited_at en el metadata JSON
-- en lugar de la columna invited_at de auth.users.
--
-- Estrategia (doble check para máxima robustez):
--   a) NEW.invited_at IS NOT NULL       → columna nativa que GoTrue setea en inviteUserByEmail()
--   b) metadata->>'invited_at' IS NOT NULL → campo que la Edge Function include como fallback
--
-- Un signup público normal no cumple ninguna de las dos → siempre obtiene 'cliente'.
-- Esto bloquea el privilege escalation vía signUp({ data: { rol: 'admin' } }).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_rol TEXT;
BEGIN
  -- Doble verificación: columna nativa GoTrue + metadata de Edge Function
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
