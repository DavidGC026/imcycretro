import { assetPath } from './paths'

type Session = { csrf: string; authenticated: boolean; username: string | null }
let csrfToken: string | undefined

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(action: string, options: { body?: unknown; query?: URLSearchParams; signal?: AbortSignal } = {}): Promise<T> {
  const query = new URLSearchParams(options.query)
  query.set('action', action)
  const isWrite = options.body !== undefined
  if (isWrite && !csrfToken) await getSession()
  const response = await fetch(`${assetPath('/api/index.php')}?${query}`, {
    method: isWrite ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: isWrite ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken! } : undefined,
    body: isWrite ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result === null) {
    if (response.status === 403) csrfToken = undefined
    throw new ApiError(result?.error || 'No pudimos conectar con el servidor. Intenta nuevamente.', response.status)
  }
  if (result.csrf) csrfToken = result.csrf
  return result as T
}

export function getSession() {
  return api<Session>('session')
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error. Intenta nuevamente.'
}
