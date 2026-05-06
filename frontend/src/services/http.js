const API_BASE = '/api/v1';

const extractMessage = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  return fallback;
};

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? 0;
    this.code = code ?? null;
    this.details = details ?? null;
  }
}

export const apiRequest = async (path, { method = 'GET', body, headers } = {}) => {
  const requestHeaders = {
    ...(headers || {}),
  };

  const init = {
    method,
    headers: requestHeaders,
    credentials: 'include',
  };

  if (body !== undefined) {
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, init);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ApiError(extractMessage(payload, `HTTP ${response.status}`), {
      status: response.status,
      code: payload?.code,
      details: payload?.details ?? (typeof payload === 'object' ? payload : null),
    });
  }

  return payload;
};
