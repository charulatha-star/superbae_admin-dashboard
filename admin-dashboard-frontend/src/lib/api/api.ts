const getApiBaseUrl = () => {
  // In the browser, resolve the API host dynamically from the current page's
  // hostname so both localhost (http://localhost:3000) and LAN/IP access
  // (http://192.168.0.145:3000) hit the correct backend at <host>:3001.
  // if (typeof window !== 'undefined') {
  //   return `${window.location.protocol}//${window.location.hostname}:3001`;
  // }
  if (typeof window !== 'undefined') {
    return 'http://localhost:3001';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

const TOKEN_KEY = 'admin';

export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}, preserveEnvelope = false): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });

  // A 401 means the token is missing/expired — clear the session and send
  // the admin back to the login page.
  if (response.status === 401 && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
    clearAuthToken();
    sessionStorage.removeItem('admin');
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    let message = `API error: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // ignore JSON parse errors
    }

    throw new Error(message);
  }

  // DELETE may return empty body in some cases
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();
  return preserveEnvelope ? data as T : normalizeResponse<T>(data);
}

/**
 * Detects a paginated API response ({ data, total, pages }) and extracts
 * the underlying `data` array so callers that expect a plain array keep
 * working. Object responses (single records, singletons) and arrays are
 * returned untouched.
 */
function normalizeResponse<T>(data: unknown): T {
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data) && typeof obj.total === 'number' && typeof obj.pages === 'number') {
      return obj.data as T;
    }
  }
  return data as T;
}
