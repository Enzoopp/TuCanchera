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
import { CreditCard, MapPin, CheckCircle2, Calendar, Clock, DollarSign } from 'lucide-react'
import type { Cancha, Slot } from '@/types'

const MP_HABILITADO = import.meta.env.VITE_MP_ENABLED === 'true'

interface Props {
  cancha: Cancha
  fecha: string
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
          <div className="flex flex-col items-center py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </div>
            <DialogHeader className="mt-4">
              <DialogTitle className="text-xl font-black">¡Reserva confirmada!</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm text-neutral-500">
                Te esperamos el <strong className="text-neutral-800">{fecha}</strong> a las{' '}
                <strong className="text-neutral-800">{slot.horaInicio}hs</strong>.
                Recordá pagar al llegar al complejo.
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cerrar
            </Button>
            <Button onClick={() => navigate('/mis-reservas')} className="flex-1">
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
          <DialogTitle className="font-black">Confirmar reserva</DialogTitle>
          <DialogDescription>
            Revisá los detalles y elegí cómo pagar.
          </DialogDescription>
        </DialogHeader>

        {/* Resumen */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <MapPin className="h-3.5 w-3.5" /> Cancha
              </span>
              <span className="font-semibold text-neutral-900">{cancha.nombre}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <Calendar className="h-3.5 w-3.5" /> Fecha
              </span>
              <span className="font-semibold text-neutral-900">{fecha}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <Clock className="h-3.5 w-3.5" /> Horario
              </span>
              <span className="font-semibold text-neutral-900">
                {slot.horaInicio} — {horaFin}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <Clock className="h-3.5 w-3.5" /> Duración
              </span>
              <span className="font-semibold text-neutral-900">{cancha.duracion_min} min</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
              <DollarSign className="h-4 w-4" /> Total
            </span>
            <span className="text-lg font-black text-neutral-900">
              ${cancha.precio.toLocaleString('es-AR')}
            </span>
          </div>
        </div>

        {/* Opciones de pago */}
        <div className="mt-2 space-y-2">
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
            {procesando === 'lugar' ? 'Reservando…' : 'Reservar y pagar en el lugar'}
          </Button>
        </div>

        <p className="text-center text-xs text-neutral-400">
          {MP_HABILITADO
            ? 'Al pagar en el lugar la reserva queda confirmada de inmediato.'
            : 'La reserva queda registrada. Abonás cuando llegués al complejo.'}
        </p>
      </DialogContent>
    </Dialog>
  )
}
