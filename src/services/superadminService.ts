// superadminService: llama a la Edge Function invite-admin.
// Solo funciona si el usuario tiene rol superadmin.

import { supabase } from '@/lib/supabase'

export async function invitarAdmin(email: string, nombre: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  const res = await supabase.functions.invoke('invite-admin', {
    body: { email, nombre },
  })

  if (res.error) throw new Error(res.error.message)
  if (res.data?.error) throw new Error(res.data.error)
}
