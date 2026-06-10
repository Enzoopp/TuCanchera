const BFF_URL = import.meta.env.VITE_BFF_URL ?? 'http://localhost:3001'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // FIX: el throw va FUERA del try — si no, el catch atrapaba nuestro propio
    // Error y pisaba el mensaje del servidor con el genérico.
    let message = `Error ${res.status}: ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // el body no era JSON: usamos el mensaje genérico
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export async function bffGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  return handleResponse<T>(res)
}

export async function bffPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}
