// profileService: mutaciones del perfil del usuario autenticado.

import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export async function updatePerfil(
  userId: string,
  patch: Partial<Pick<Profile, 'nombre' | 'telefono'>>
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Profile
}
