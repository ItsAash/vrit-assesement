const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

async function request(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?', 0, {})
  }

  if (response.status === 204) return null

  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { detail: text }
    }
  }

  if (!response.ok) {
    throw new ApiError(payload?.detail ?? 'Request failed', response.status, payload ?? {})
  }
  return payload
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }

  /** Field-level errors returned by DRF serializers. */
  get fieldErrors() {
    const fields = {}
    for (const [key, value] of Object.entries(this.body ?? {})) {
      if (key === 'detail') continue
      fields[key] = Array.isArray(value) ? value.join(' ') : String(value)
    }
    return fields
  }
}

function toQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const servicesApi = {
  list: () => request('/services'),
  create: (payload) => request('/services', { method: 'POST', body: payload }),
  update: (id, payload) => request(`/services/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => request(`/services/${id}`, { method: 'DELETE' }),
}

export const appointmentsApi = {
  list: (params) => request(`/appointments${toQuery(params)}`),
  create: (payload) => request('/appointments', { method: 'POST', body: payload }),
  updateStatus: (id, status) =>
    request(`/appointments/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),
}

export const summaryApi = {
  get: () => request('/summary'),
}