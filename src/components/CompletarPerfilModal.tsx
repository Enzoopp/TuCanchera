// CompletarPerfilModal: aparece una sola vez cuando un usuario Google
// no tiene teléfono en su perfil. Permite completarlo o descartarlo.
// La decisión se guarda en localStorage para no volver a molestar.

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { updatePerfil } from '@/services/profileService'
import { toast } from 'sonner'
import { Phone, X } from 'lucide-react'

const STORAGE_KEY = 'tc_perfil_modal_descartado'

export function useDeberiaCompletarPerfil(): boolean {
  const { user, profile, loading } = useAuth()
  if (loading || !user || !profile) return false
  // Solo para clientes sin teléfono que vinieron por OAuth Google
  if (profile.rol !== 'cliente') return false
  if (profile.telefono) return false
  if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) return false
  // Detectar si es usuario Google
  const isGoogle = user.app_metadata?.provider === 'google' ||
    user.identities?.some((id) => id.provider === 'google')
  return !!isGoogle
}

export default function CompletarPerfilModal() {
  const { user, refreshProfile } = useAuth()
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cerrado, setCerrado] = useState(false)

  if (cerrado) return null

  function descartar() {
    localStorage.setItem(STORAGE_KEY, '1')
    setCerrado(true)
  }

  async function handleGuardar() {
    if (!user) return
    const tel = telefono.trim()
    if (!tel) { descartar(); return }

    setGuardando(true)
    try {
      await updatePerfil(user.id, { telefono: tel })
      await refreshProfile()
      toast.success('¡Teléfono guardado!')
      setCerrado(true)
    } catch {
      toast.error('No se pudo guardar el teléfono. Intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0">
      {/* Overlay suave — no bloquea totalmente la pantalla */}
      <div className="absolute inset-0 bg-black/30" onClick={descartar} />

      <div className="relative w-full max-w-sm rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={descartar}
          className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {/* Icono */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
            <Phone className="h-6 w-6 text-primary-600" />
          </div>

          <h2 className="mt-4 text-lg font-black text-neutral-900">
            ¿Querés que te contacten?
          </h2>
          <p className="mt-1.5 text-sm text-neutral-500">
            Agregá tu WhatsApp para que el complejo pueda avisarte si hay
            algún cambio en tu reserva.
          </p>

          <div className="mt-5">
            <input
              type="tel"
              placeholder="Ej: 11 1234-5678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGuardar()}
              disabled={guardando}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={descartar}
              disabled={guardando}
              className="flex-1 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-60"
            >
              Ahora no
            </button>
            <button
              type="button"
              onClick={handleGuardar}
              disabled={guardando || !telefono.trim()}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
