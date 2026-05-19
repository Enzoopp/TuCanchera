// Hook para setear dinámicamente title + meta tags de SEO y Open Graph.
// No requiere librerías externas: manipula el DOM directamente.
// Se usa en Landing, Complejo y Reservar para que cada página tenga
// su propio título y descripción en resultados de búsqueda y previews.

import { useEffect } from 'react'

interface DocumentMetaOptions {
  title: string
  description?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogUrl?: string
  canonical?: string
}

function setOrCreateMeta(
  selector: string,
  attribute: string,
  content: string
) {
  let el = document.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    const [attr, value] = selector.match(/\[([^\]]+)="([^"]+)"\]/)?.slice(1) ?? []
    if (attr && value) el.setAttribute(attr, value)
    document.head.appendChild(el)
  }
  el.setAttribute(attribute, content)
}

function setOrCreateLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function useDocumentMeta({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  ogUrl,
  canonical,
}: DocumentMetaOptions) {
  useEffect(() => {
    // Title
    document.title = title

    if (description) {
      setOrCreateMeta('meta[name="description"]', 'content', description)
    }

    // Open Graph
    setOrCreateMeta('meta[property="og:title"]', 'content', ogTitle ?? title)

    if (ogDescription ?? description) {
      setOrCreateMeta(
        'meta[property="og:description"]',
        'content',
        (ogDescription ?? description)!
      )
    }

    if (ogImage) {
      setOrCreateMeta('meta[property="og:image"]', 'content', ogImage)
    }

    if (ogUrl ?? canonical) {
      setOrCreateMeta(
        'meta[property="og:url"]',
        'content',
        (ogUrl ?? canonical)!
      )
    }

    setOrCreateMeta('meta[property="og:type"]', 'content', 'website')

    // Twitter Card
    setOrCreateMeta('meta[name="twitter:card"]', 'content', 'summary_large_image')
    setOrCreateMeta('meta[name="twitter:title"]', 'content', ogTitle ?? title)
    if (ogDescription ?? description) {
      setOrCreateMeta(
        'meta[name="twitter:description"]',
        'content',
        (ogDescription ?? description)!
      )
    }
    if (ogImage) {
      setOrCreateMeta('meta[name="twitter:image"]', 'content', ogImage)
    }

    // Canonical
    if (canonical) {
      setOrCreateLink('canonical', canonical)
    }
  }, [title, description, ogTitle, ogDescription, ogImage, ogUrl, canonical])
}
