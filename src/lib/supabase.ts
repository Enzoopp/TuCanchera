// PATRÓN: Singleton (una única instancia del cliente Supabase para toda la app)
// Centralizar la creación del cliente evita conexiones duplicadas y garantiza
// que toda la aplicación use la misma sesión de autenticación.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
    'Copiar .env.example a .env.local y completar los valores.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
