const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

function url(path) {
  if (path.startsWith("http")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

function authHeaders() {
  const t = localStorage.getItem("accessToken");
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function tryRefresh() {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) return false;
  const res = await fetch(url("/api/auth/token/refresh/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (data.access) {
    localStorage.setItem("accessToken", data.access);
    return true;
  }
  return false;
}

export async function fetchJson(path, options = {}, retried = false) {
  const res = await fetch(url(path), {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401 && !retried && (await tryRefresh())) {
    return fetchJson(path, options, true);
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      (data && (data.detail || data.error || data.message)) ||
      (typeof data === "string" ? data : res.statusText);
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return data;
}

/** Keys for habits/tasks cached per logged-in user (avoid cross-account leakage). */
export function habitStorageKey(base) {
  const uid = localStorage.getItem("userId");
  return uid ? `${base}_u_${uid}` : base;
}

function removeLegacyHabitKeys() {
  localStorage.removeItem("createdHabits");
  localStorage.removeItem("tasksByHabitDate");
  localStorage.removeItem("activeHabitId");
}

export function clearAuth() {
  const uid = localStorage.getItem("userId");
  if (uid) {
    localStorage.removeItem(`createdHabits_u_${uid}`);
    localStorage.removeItem(`tasksByHabitDate_u_${uid}`);
    localStorage.removeItem(`activeHabitId_u_${uid}`);
  }
  removeLegacyHabitKeys();
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userId");
  localStorage.removeItem("userName");
}

/** Call after login when user id changes so old unscoped cache is not reused. */
export function clearHabitKeysIfUserSwitched(newUserId) {
  const prev = localStorage.getItem("userId");
  if (prev && newUserId != null && String(newUserId) !== prev) {
    removeLegacyHabitKeys();
  }
}

export function mapServerHabitToLocal(h) {
  return {
    id: String(h.id),
    habitName: h.habitName || h.name,
    description: h.description || "",
    category: h.category_label || h.category_display || h.category,
    startDate: h.start_date || "",
    endDate: h.end_date || "",
    xp: h.xp ?? 0,
    xpMax: h.xp_max ?? 1000,
    level: h.level ?? 1,
    status: h.status || "Active",
    createdAt: h.created_at,
  };
}

async function postPublic(path, body) {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      (data && (data.detail || data.error || data.message)) ||
      (typeof data === "object" && data.username?.[0]) ||
      (typeof data === "object" && data.email?.[0]) ||
      (typeof data === "object" && data.password?.[0]) ||
      (typeof data === "string" ? data : res.statusText);
    throw new Error(
      Array.isArray(msg) ? msg.join(" ") : String(msg || `Request failed: ${res.status}`)
    );
  }
  return data;
}

export async function loginRequest(email, password) {
  return postPublic("/api/auth/login/", { email, password });
}

export async function registerRequest(payload) {
  return postPublic("/api/auth/register/", payload);
}

export async function googleLoginRequest(idToken, creds = {}) {
  return postPublic("/api/auth/google/", {
    id_token: idToken,
    ...(creds.username ? { username: creds.username } : {}),
    ...(creds.password ? { password: creds.password } : {}),
  });
}

export async function fetchMe() {
  return fetchJson("/api/auth/me/");
}

export async function patchMe(body) {
  return fetchJson("/api/auth/me/", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function setPasswordRequest(password) {
  return fetchJson("/api/auth/set-password/", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function fetchHabits() {
  const data = await fetchJson("/habits/api/habits/");
  const list = data.habits || [];
  return list.map(mapServerHabitToLocal);
}

export async function createHabitOnServer(body) {
  return fetchJson("/habits/api/habits/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchHabitOnServer(habitId, body) {
  return fetchJson(`/habits/api/habits/${habitId}/`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** POST /api/ai/chat/ — JWT; Gemini на бэкенде; 401 обрабатывается в fetchJson */
export async function sendAiMessage(message, context = null) {
  const body = { message };
  if (context && typeof context === "object") body.context = context;
  return fetchJson("/api/ai/chat/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* --- Community (друзья по взаимной подписке, посты только у друзей + свои) --- */

export async function communitySearchByEmail(email) {
  const q = encodeURIComponent(email.trim());
  return fetchJson(`/api/community/search/?email=${q}`);
}

export async function communitySubscribe(userId) {
  return fetchJson("/api/community/subscribe/", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function communityUnsubscribe(userId) {
  return fetchJson(`/api/community/subscribe/${userId}/`, {
    method: "DELETE",
  });
}

export async function communityFetchFriends() {
  return fetchJson("/api/community/friends/");
}

export async function communityUnfriend(userId) {
  return fetchJson(`/api/community/friends/${userId}/`, {
    method: "DELETE",
  });
}

export async function communityFetchProfile(userId) {
  return fetchJson(`/api/community/profile/${userId}/`);
}

export async function communityFetchPosts(scope = "friends") {
  const q = encodeURIComponent(scope);
  return fetchJson(`/api/community/posts/?scope=${q}`);
}

export async function communityCreatePost(text) {
  return fetchJson("/api/community/posts/", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
