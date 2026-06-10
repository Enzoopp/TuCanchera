// Servicio de autenticación vía BFF.
//
// FLUJO: Front → BFF (POST /api/auth/login | /signup) → Supabase Auth
// El BFF valida las credenciales contra Supabase y devuelve los tokens.
// Después restauramos la sesión en el cliente Supabase local con setSession(),
// así todo lo que ya depende de la sesión (onAuthStateChange, RLS, ProtectedRoute)
// sigue funcionando exactamente igual.

import type { User } from '@supabase/supabase-js'
import { bffPost } from '@/lib/bffClient'
import { supabase } from '@/lib/supabase'
import type { Rol } from '@/types'

interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
}

interface SignupResponse {
  user: User | null
}

/** Login contra el BFF + restauración de la sesión en el cliente local */
export async function loginViaBff(email: string, password: string): Promise<void> {
  const data = await bffPost<LoginResponse>('/api/auth/login', { email, password })

  if (!data.access_token || !data.refresh_token) {
    throw new Error('El servidor no devolvió una sesión válida')
  }

  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (error) throw new Error(error.message)
}

/** Registro contra el BFF (cliente o admin según metadata.rol) */
export async function signupViaBff(
  email: string,
  password: string,
  metadata: { nombre: string; telefono?: string; rol: Rol },
  emailRedirectTo?: string
): Promise<void> {
  await bffPost<SignupResponse>('/api/auth/signup', {
    email,
    password,
    nombre: metadata.nombre,
    telefono: metadata.telefono,
    rol: metadata.rol,
    emailRedirectTo,
  })
}
