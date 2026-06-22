// ============================================================
// LIB/UTILS.TS — Helper "cn" para clases de Tailwind
// Lo usan los componentes de shadcn/ui para combinar clases CSS
// sin que choquen entre sí (clsx las une, twMerge resuelve conflictos
// de Tailwind quedándose con la última). Ej: cn('p-4', cond && 'p-2').
// ============================================================

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
