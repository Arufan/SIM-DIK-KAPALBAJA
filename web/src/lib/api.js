// Thin API client with token refresh. Network failures surface as
// { offline: true } so the UI can stay calm while offline instead of logging out.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const AUTH_KEY = "simdik_auth";

export const getAuth = () => {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
};
export const setAuth = (auth) => localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
export const clearAuth = () => localStorage.removeItem(AUTH_KEY);

async function raw(path, { method = "GET", token, body } = {}) {
  const res = await fetch(API_URL + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export async function login(username, password) {
  const { status, json } = await raw("/auth/login", { method: "POST", body: { username, password } });
  if (status !== 200) throw new Error(json.error || "Login gagal");
  setAuth({ accessToken: json.accessToken, refreshToken: json.refreshToken, profile: json.profile });
  return json.profile;
}

export async function apiFetch(path, opts = {}) {
  const auth = getAuth();
  let res = await raw(path, { ...opts, token: auth?.accessToken }).catch((e) => {
    throw Object.assign(new Error("network"), { offline: true, cause: e });
  });

  if (res.status === 401 && auth?.refreshToken) {
    const refresh = await raw("/auth/refresh", { method: "POST", body: { refreshToken: auth.refreshToken } }).catch((e) => {
      throw Object.assign(new Error("network"), { offline: true, cause: e });
    });
    if (refresh.status === 200) {
      setAuth({ ...auth, accessToken: refresh.json.accessToken });
      res = await raw(path, { ...opts, token: refresh.json.accessToken });
    } else if (refresh.status === 401) {
      clearAuth(); // token revoked server-side: re-login required (online)
      throw Object.assign(new Error("session expired"), { sessionExpired: true });
    }
  }
  if (res.status === 401) throw Object.assign(new Error("unauthorized"), { sessionExpired: true });
  if (res.status >= 400) throw new Error(res.json.error || `API error ${res.status}`);
  return res.json;
}
