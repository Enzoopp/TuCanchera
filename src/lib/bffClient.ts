const BFF_URL = import.meta.env.VITE_BFF_URL ?? 'http://localhost:3001'

export async function bffGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
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
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}
