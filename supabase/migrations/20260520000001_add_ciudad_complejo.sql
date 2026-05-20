-- Agrega columna ciudad a complejos para filtrado por ubicación en Landing.
ALTER TABLE complejos
  ADD COLUMN IF NOT EXISTS ciudad TEXT;

COMMENT ON COLUMN complejos.ciudad IS 'Ciudad donde está ubicado el complejo. Usada para filtrar en la búsqueda pública.';
