// Thin fetch wrapper. Every mutating request carries X-Requested-With,
// which the Go server requires (internal/httpapi/server.go guard).

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "X-Requested-With": "zmk-editor" }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown = undefined
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = undefined
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; code?: string }
    throw new ApiError(res.status, err.error ?? (text || res.statusText), err.code)
  }
  return data as T
}

export const get = <T>(path: string) => api<T>("GET", path)
export const post = <T>(path: string, body?: unknown) => api<T>("POST", path, body ?? {})
export const put = <T>(path: string, body?: unknown) => api<T>("PUT", path, body ?? {})
export const patch = <T>(path: string, body?: unknown) => api<T>("PATCH", path, body ?? {})
export const del = <T>(path: string) => api<T>("DELETE", path)

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
