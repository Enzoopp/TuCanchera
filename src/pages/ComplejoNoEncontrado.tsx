// Página 404 personalizada para cuando el slug del complejo no existe.
// Diseño cuidado con mensaje claro en español (no un 404 genérico del browser).

import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { MapPinOff } from 'lucide-react'

export default function ComplejoNoEncontrado() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-100">
          <MapPinOff className="h-10 w-10 text-primary-600" />
        </div>
        <h1 className="text-3xl font-bold text-neutral-900">
          Complejo no encontrado
        </h1>
        <p className="mt-3 text-lg text-neutral-500">
          No pudimos encontrar el complejo deportivo que buscás.
          <br />
          Verificá que la dirección sea correcta.
        </p>
        <div className="mt-8">
          <Link to="/login">
            <Button size="lg">Ir al inicio</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
