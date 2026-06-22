// ============================================================
// BFFCLIENT.TS — El "teléfono" del Front al BFF
// Centraliza TODAS las llamadas HTTP al BFF en dos funciones:
//   - bffGet(path, token?)        → peticiones GET
//   - bffPost(path, body, token?) → peticiones POST
// Si se pasa un token, lo manda en el header Authorization (para
// los endpoints privados como reservas). handleResponse traduce los
// errores del servidor a un Error con mensaje claro.
//
// Los services del front (reservaService, complejoService, authService)
// usan estas funciones en vez de escribir fetch a mano cada vez.
// ============================================================

// URL del BFF: sale del .env.local (VITE_BFF_URL); si no, usa localhost:3001
const BFF_URL = import.meta.env.VITE_BFF_URL ?? 'http://localhost:3001'

// Procesa la respuesta del BFF: si salió mal, arma un Error legible;
// si salió bien, devuelve el JSON ya tipado.
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
