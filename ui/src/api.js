const TOKEN_KEY = "te_access_token";

// sessionStorage throws in some private modes; a missing token just means "not logged in".
export const token = {
  get() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  },
  set(value) {
    try {
      if (value) {
        sessionStorage.setItem(TOKEN_KEY, value);
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // Ignored, see above.
    }
  },
  clear() {
    this.set("");
  },
};

const withQuery = (path, params) => (params ? `${path}?${new URLSearchParams(params)}` : path);

export function apiFetch(path, options = {}) {
  const headers = { ...options.headers };
  const stored = token.get();

  if (stored) {
    headers.Authorization = `Bearer ${stored}`;
  }

  return fetch(path, { ...options, headers });
}

export async function apiGetJson(path) {
  const response = await apiFetch(path);

  return response.json();
}

// `ok` also covers firmware errors reported as {"ok":false} in a 200 body.
async function toResult(response) {
  const data = await response.json();

  return { ok: response.ok && data.ok !== false, data };
}

export async function apiPost(path, params) {
  return toResult(await apiFetch(withQuery(path, params), { method: "POST" }));
}

export async function apiPutJson(path, body) {
  return toResult(
    await apiFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export function postQuietly(path, params) {
  apiFetch(withQuery(path, params), { method: "POST" }).catch(() => {});
}
