// SRP: Modal de confirmación de reserva con dos opciones de pago.
// - "Pagar con MercadoPago": invoca Edge Function → redirige a Checkout Pro (requiere VITE_MP_ENABLED=true)
// - "Pagar en el lugar": inserta reserva directamente (siempre disponible)
// La lógica de persistencia se delega a reservaService.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import {
  crearReservaEnLugar,
  crearPreferenciaMercadoPago,
} from '@/services/reservaService'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { CreditCard, MapPin, CheckCircle2 } from 'lucide-react'
import type { Cancha, Slot } from '@/types'

// MP se habilita cuando la variable de entorno está activa
const MP_HABILITADO = import.meta.env.VITE_MP_ENABLED === 'true'

interface Props {
  cancha: Cancha
  fecha: string // YYYY-MM-DD
  slot: Slot
  onClose: () => void
}

export default function ConfirmacionReservaModal({
  cancha,
  fecha,
  slot,
  onClose,
}: Props) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [procesando, setProcesando] = useState<'mp' | 'lugar' | null>(null)
  const [confirmada, setConfirmada] = useState(false)

  const horaFin = slot.horaFin

  async function handlePagarEnLugar() {
    if (!user || !profile) {
      toast.error('Debes iniciar sesión')
      return
    }
    setProcesando('lugar')
    try {
      await crearReservaEnLugar({
        canchaId: cancha.id,
        clienteId: profile.id,
        fecha,
        horaInicio: slot.horaInicio,
        horaFin,
        metodoPago: 'en_lugar',
      })
      await queryClient.invalidateQueries({ queryKey: ['slots', cancha.id, fecha] })
      setConfirmada(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reservar'
      toast.error(msg)
      setProcesando(null)
    }
  }

  async function handlePagarMP() {
    if (!user || !profile) {
      toast.error('Debes iniciar sesión')
      return
    }
    setProcesando('mp')
    try {
      const { url } = await crearPreferenciaMercadoPago({
        canchaId: cancha.id,
        clienteId: profile.id,
        fecha,
        horaInicio: slot.horaInicio,
        horaFin,
        metodoPago: 'mercadopago',
      })
      window.location.href = url
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar pago'
      toast.error(msg)
      setProcesando(null)
    }
  }

  function handleClose() {
    if (procesando) return
    onClose()
  }

  if (confirmada) {
    return (
      <Dialog open onOpenChange={handleClose}>
        <DialogContent onClose={handleClose}>
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <DialogHeader className="mt-3">
              <DialogTitle>¡Reserva confirmada!</DialogTitle>
              <DialogDescription>
                Te esperamos el {fecha} a las {slot.horaInicio}hs. Recordá pagar
                al llegar al complejo.
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={() => navigate('/mis-reservas')}>
              Ver mis reservas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Confirmar reserva</DialogTitle>
          <DialogDescription>
            Revisá los detalles y elegí cómo pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Cancha</span>
            <span className="font-medium text-neutral-900">{cancha.nombre}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Fecha</span>
            <span className="font-medium text-neutral-900">{fecha}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Horario</span>
            <span className="font-medium text-neutral-900">
              {slot.horaInicio} — {horaFin}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Duración</span>
            <span className="font-medium text-neutral-900">
              {cancha.duracion_min} min
            </span>
          </div>
          <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2">
            <span className="text-neutral-500">Total</span>
            <span className="text-base font-bold text-neutral-900">
              ${cancha.precio.toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {MP_HABILITADO && (
            <Button
              type="button"
              className="w-full"
              onClick={handlePagarMP}
              disabled={procesando !== null}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {procesando === 'mp' ? 'Redirigiendo…' : 'Pagar con MercadoPago'}
            </Button>
          )}
          <Button
            type="button"
            variant={MP_HABILITADO ? 'outline' : 'default'}
            className="w-full"
            onClick={handlePagarEnLugar}
            disabled={procesando !== null}
          >
            <MapPin className="mr-2 h-4 w-4" />
            {procesando === 'lugar' ? 'Reservando…' : 'Reservar (pagar en el lugar)'}
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-neutral-500">
          {MP_HABILITADO
            ? 'Si pagás en el lugar, la reserva queda confirmada al instante.'
            : 'La reserva queda registrada. Abonás al llegar al complejo.'}
        </p>
      </DialogContent>
    </Dialog>
  )
}
