// PATRÓN: Context + Provider (Singleton en React)
// TenantContext actúa como un Singleton para los datos del complejo activo.
// Evita prop drilling y centraliza la resolución del slug en un solo lugar.
//
// SRP: Este contexto solo resuelve y expone los datos del complejo actual.
// No gestiona autenticación ni lógica de reservas.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Complejo } from '@/types'

interface TenantContextValue {
  complejo: Complejo | null
  loading: boolean
  error: string | null
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>()
  const [complejo, setComplejo] = useState<Complejo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      setError('No se proporcionó un slug de complejo.')
      return
    }

    async function fetchComplejo() {
      setLoading(true)
      setError(null)

      const { data, error: dbError } = await supabase
        .from('complejos')
        .select('*')
        .eq('slug', slug)
        .eq('activo', true)
        .single()

      if (dbError || !data) {
        setError('El complejo no fue encontrado.')
        setComplejo(null)
      } else {
        setComplejo(data as Complejo)
      }

      setLoading(false)
    }

    fetchComplejo()
  }, [slug])

  return (
    <TenantContext.Provider value={{ complejo, loading, error }}>
      {children}
    </TenantContext.Provider>
  )
}

// Hook para consumir el contexto del tenant de forma segura
export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant debe usarse dentro de un <TenantProvider>')
  }
  return context
}
