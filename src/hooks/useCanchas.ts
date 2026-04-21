// PATRÓN: Custom Hook (separación de lógica y presentación)
// SRP: Este hook encapsula la obtención de canchas de un complejo.
// Los componentes que lo usan son "dumb" y solo renderizan datos.

import { useQuery } from '@tanstack/react-query'
import { fetchCanchasByComplejo } from '@/services/complejoService'

export function useCanchas(complejoId: string | undefined) {
  return useQuery({
    queryKey: ['canchas', complejoId],
    queryFn: () => fetchCanchasByComplejo(complejoId!),
    enabled: !!complejoId,
  })
}
