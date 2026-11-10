const AUTH_KEY = 'shopflow.auth';

export function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch {
    return null;
  }
}

export function saveAuth(auth) {
  try {
    if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    // storage unavailable (private mode): session just won't persist
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const auth = loadAuth();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth?.token && { Authorization: `Bearer ${auth.token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);

  if (res.status === 401 && auth) {
    saveAuth(null);
    window.location.assign('/login');
  }
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}
