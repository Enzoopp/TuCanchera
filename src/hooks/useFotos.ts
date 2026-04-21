// SRP: Este hook encapsula la obtención de fotos de un complejo.

import { useQuery } from '@tanstack/react-query'
import { fetchFotosByComplejo } from '@/services/complejoService'

export function useFotos(complejoId: string | undefined) {
  return useQuery({
    queryKey: ['fotos', complejoId],
    queryFn: () => fetchFotosByComplejo(complejoId!),
    enabled: !!complejoId,
  })
}
