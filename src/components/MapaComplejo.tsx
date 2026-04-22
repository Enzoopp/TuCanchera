// MapaComplejo: muestra el mapa de ubicación del complejo.
// Usa el embed legacy de Google Maps (no requiere API key ni billing).
// Siempre muestra el mapa si hay dirección cargada.

import { ExternalLink, MapPin } from 'lucide-react'

interface Props {
  direccion: string
  nombre?: string
}

export default function MapaComplejo({ direccion, nombre }: Props) {
  // URL para abrir en Google Maps en nueva pestaña
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(direccion)}`

  // Embed legacy — funciona sin API key ni billing
  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed&hl=es&z=15`

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4 text-neutral-500" />
          <h2 className="text-sm font-semibold text-neutral-800">Cómo llegar</h2>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir en Google Maps
        </a>
      </div>

      {/* Dirección */}
      <div className="flex items-start gap-2.5 px-5 py-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
        <p className="text-sm text-neutral-700">{direccion}</p>
      </div>

      {/* Mapa embed */}
      <div className="px-5 pb-5">
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <iframe
            title={`Mapa de ${nombre ?? 'complejo'}`}
            src={embedUrl}
            width="100%"
            height="300"
            style={{ border: 0, display: 'block' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  )
}
