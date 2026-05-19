-- Migración: soporte Google OAuth en trigger de creación de perfil
--
-- Problema: el trigger original usaba raw_user_meta_data->>'nombre' pero
-- Google OAuth envía raw_user_meta_data->>'full_name'.
-- Solución: COALESCE para manejar ambos casos + fallback al email.
-- También se agrega ON CONFLICT DO NOTHING para evitar duplicados.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre, telefono, rol)
  VALUES (
    NEW.id,
    -- Email/password: usa 'nombre'. Google OAuth: usa 'full_name'. Fallback: parte local del email.
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'nombre'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'telefono',
    -- Google OAuth no envía 'rol', así que por defecto es 'cliente'.
    -- Admins siempre se registran vía email+password con código de invitación.
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'rol', ''), 'cliente')
  )
  ON CONFLICT (user_id) DO NOTHING;  -- Prevenir duplicados en reinicios de sesión
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
