// Utilidad para mapear tipos de cancha a etiquetas legibles en español

import type { TipoCancha } from '@/types'

export const tipoCanchaLabels: Record<TipoCancha, string> = {
  futbol5: 'Fútbol 5',
  futbol7: 'Fútbol 7',
  padel: 'Pádel',
}
