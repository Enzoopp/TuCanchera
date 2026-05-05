// ============================================================
// COMPLEJNOENCONTRADO.TSX
// Página 404 personalizada que se muestra cuando el slug del
// complejo en la URL no existe en la base de datos.
// Por ejemplo: si alguien entra a /un-complejo-que-no-existe
// En vez de mostrar un error genérico del browser, mostramos
// este mensaje en español centrado en pantalla.
// ============================================================

import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

// MapPinOff: ícono de ubicación tachada — representa "no encontrado"
import { MapPinOff } from 'lucide-react'

export default function ComplejoNoEncontrado() {
  return (
    // Contenedor: fondo gris, pantalla completa, centra el contenido
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="text-center">

        {/* Círculo con ícono de pin tachado */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-100">
          <MapPinOff className="h-10 w-10 text-primary-600" />
        </div>

        {/* Título del error */}
        <h1 className="text-3xl font-bold text-neutral-900">
          Complejo no encontrado
        </h1>

        {/* Descripción */}
        <p className="mt-3 text-lg text-neutral-500">
          No pudimos encontrar el complejo deportivo que buscás.
          <br />
          Verificá que la dirección sea correcta.
        </p>

        {/* Botón para volver al inicio */}
        <div className="mt-8">
          <Link to="/login">
            <Button size="lg">Ir al inicio</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
