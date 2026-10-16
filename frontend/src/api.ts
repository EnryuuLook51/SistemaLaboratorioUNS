export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    })
  } catch {
    throw new ApiError('No se pudo conectar con la API. Inicia el backend en el puerto 8000.', 0)
  }
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('uns-session-expired'))
    const payload = await response.json().catch(() => null) as { detail?: string | { msg: string }[] } | null
    const detail = payload?.detail
    throw new ApiError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(item => item.msg).join(' · ') : `Error ${response.status}`, response.status)
  }
  return response.json() as Promise<T>
}
