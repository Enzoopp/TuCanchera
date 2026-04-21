// SRP: Obtiene el complejo del admin autenticado (único complejo por admin).

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Complejo } from '@/types'

export function useMiComplejo() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['mi-complejo', profile?.id],
    queryFn: async (): Promise<Complejo | null> => {
      if (!profile) return null
      const { data, error } = await supabase
        .from('complejos')
        .select('*')
        .eq('admin_id', profile.id)
        .maybeSingle()
      if (error) throw error
      return data as Complejo | null
    },
    enabled: !!profile && profile.rol === 'admin',
  })
}
