// SRP: Página pública de inicio. Lista todos los complejos activos
// para que los clientes puedan descubrirlos, y ofrece accesos a login/registro.

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { fetchComplejosActivos } from '@/services/complejoService'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, ArrowRight, LogIn, User, LandPlot, LogOut } from 'lucide-react'

export default function Landing() {
  const { user, rol, signOut } = useAuth()
  const { data: complejos, isLoading } = useQuery({
    queryKey: ['complejos-activos'],
    queryFn: fetchComplejosActivos,
  })

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top bar */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/explorar" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <LandPlot className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-neutral-900">
              TuCanchera
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {rol === 'admin' ? (
                  <Link to="/admin/dashboard">
                    <Button variant="outline" size="sm">
                      Panel admin
                    </Button>
                  </Link>
                ) : (
                  <Link to="/mis-reservas">
                    <Button variant="outline" size="sm">
                      <User className="mr-1.5 h-4 w-4" />
                      Mis reservas
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    <LogIn className="mr-1.5 h-4 w-4" />
                    Iniciar sesión
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Registrarme</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-neutral-200 bg-gradient-to-b from-primary-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Reservá tu cancha online
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600">
            Encontrá el complejo que más te guste, elegí día y horario, y reservá
            en segundos. Fútbol 5, fútbol 7 y pádel.
          </p>
        </div>
      </section>

      {/* Listado de complejos */}
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">
            Complejos disponibles
          </h2>
          {complejos && complejos.length > 0 && (
            <p className="text-sm text-neutral-500">
              {complejos.length}{' '}
              {complejos.length === 1 ? 'complejo' : 'complejos'}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : !complejos || complejos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {complejos.map((c) => (
              <Link
                key={c.id}
                to={`/${c.slug}`}
                className="group block overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md"
              >
                <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt={`Logo de ${c.nombre}`}
                      className="h-20 w-20 rounded-lg object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-white text-3xl font-bold text-primary-600 shadow-sm">
                      {c.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-neutral-900 group-hover:text-primary-600">
                    {c.nombre}
                  </h3>
                  {c.direccion && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.direccion}</span>
                    </p>
                  )}
                  {c.descripcion && (
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
                      {c.descripcion}
                    </p>
                  )}
                  <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600">
                    Ver canchas
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer con CTA admin */}
      <footer className="mt-10 border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} TuCanchera
          </p>
          <Link
            to="/register-admin"
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            ¿Tenés un complejo? Registrate como administrador →
          </Link>
        </div>
      </footer>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
        <LandPlot className="h-6 w-6 text-neutral-400" />
      </div>
      <h3 className="font-semibold text-neutral-900">
        Todavía no hay complejos cargados
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
        Volvé pronto o, si administrás un complejo, registrate como admin para
        ser de los primeros.
      </p>
      <Link to="/register-admin" className="mt-4 inline-block">
        <Button variant="outline" size="sm">
          Registrarme como admin
        </Button>
      </Link>
    </div>
  )
}
