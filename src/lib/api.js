// ═══════════════════════════════════════════════════════════════════════
// API istemcisi.
//
// İki mod var ve bu bilinçli:
//
//   canlı  — sunucu ayakta. Kimlik, deste, kaydırma, ziyaret, yorum ve
//            sahiplenme veritabanına gider; kalıcıdır.
//   yerel  — sunucu yok (artifact önizlemesi, çevrimdışı). Uygulama aynı
//            akışları localStorage üzerinde yürütür.
//
// Mod açılışta bir kez ölçülür. Uygulamanın hiçbir ekranı "sunucu yok" diye
// kilitlenmez; yalnızca kalıcılık ve sunucu tarafı kurallar devre dışı kalır.
// ═══════════════════════════════════════════════════════════════════════

const BASE = import.meta.env?.VITE_API_URL || "/api";
const TOKEN_KEY = "gur.token";

let mode = "unknown";           // "unknown" | "live" | "local"
let probe = null;
let probeInfo = null;
const listeners = new Set();

function emit() { for (const l of listeners) l(); }
export function subscribeApi(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function apiMode() { return mode; }
export function isLive() { return mode === "live"; }

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* yok */ }
}

/**
 * Sunucu var mı? Sonuç önbelleklenir; her çağrı yeni istek atmaz.
 * Zaman aşımı kısa: sunucu yoksa açılış gecikmesin.
 */
function yokla() {
  return fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2500) })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
}

// Sunucu geç açılırsa arkadan tekrar yokluyoruz. Sınırlı ve artan aralık:
// gerçekten sunucusuz bir ortamda (artifact önizlemesi) üç denemeden sonra
// susuyor, boşuna istek atmıyor.
const TEKRAR_MS = [3000, 8000, 20000];

function arkadanTekrarla(i = 0) {
  if (i >= TEKRAR_MS.length) return;
  setTimeout(() => {
    if (mode === "live") return;             // arada bağlandıysa iş bitti
    yokla()
      .then(info => {
        mode = "live"; probeInfo = info;
        // ÖNBELLEĞİ DE TAZELE. Yalnızca `mode`u güncellemek yetmiyordu:
        // `ensureMode()` hâlâ başarısızlığa çözülmüş ESKİ sözü döndürüyor
        // ve onu çağıran `boot()` yine "yerel" diyordu. Ölçüldü — rozet
        // YEREL'de kaldı. Söz de yerine konmalı.
        probe = Promise.resolve({ mode, info });
        emit();
      })
      .catch(() => arkadanTekrarla(i + 1));
  }, TEKRAR_MS[i]);
}

/**
 * Mod ölçümü. BAŞARI önbelleğe alınır, BAŞARISIZLIK alınmaz.
 *
 * Önceden tek `probe` sözü hem başarıyı hem başarısızlığı önbelleğe
 * alıyordu (`if (probe) return probe`) ve `boot()` tek bir `useEffect`ten
 * bir kez çağrılıyordu. Sonuç: sunucu o 2.5 saniyede henüz cevap
 * vermiyorsa (dağıtımın ilk açılışı, yeniden başlatma, konteynerin
 * `npm install`i) uygulama OTURUM BOYUNCA yerel modda kalıyordu —
 * üç panel açılıyor, çalışıyor gibi görünüyor ama veriyi paylaşmıyordu.
 * Sayfa yenilenmeden düzelmiyordu ve kullanıcı sebebini göremiyordu.
 */
export function ensureMode() {
  if (probe) return probe;
  probe = yokla()
    .then(info => { mode = "live"; probeInfo = info; emit(); return { mode, info }; })
    .catch(() => {
      mode = "local"; emit();
      arkadanTekrarla();                     // sunucu sonradan gelirse yakala
      return { mode, info: null };
    });
  return probe;
}

/** Son sağlık yanıtı — arkadan bağlanınca ekranın güncelleyebilmesi için. */
export function modeInfo() { return probeInfo; }

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export { ApiError };

async function call(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  let payload = null;
  try { payload = await res.json(); } catch { /* gövdesiz yanıt */ }

  if (!res.ok) {
    // 401: belirteç geçersiz ya da süresi dolmuş — sessizce düşür,
    // kullanıcı bir sonraki işlemde tekrar giriş yapar.
    if (res.status === 401) setToken(null);
    throw new ApiError(payload?.error || `İstek başarısız (${res.status})`, res.status);
  }
  return payload;
}

// ─── Kimlik ───────────────────────────────────────────────────────────

export async function loginWithPassword(email, password, name) {
  const out = await call("/auth/password", { method: "POST", auth: false, body: { email, password, name } });
  setToken(out.token);
  return out.user;
}

export async function loginWithSocial(provider, { idToken, displayName }) {
  const out = await call("/auth/social", { method: "POST", auth: false, body: { provider, idToken, displayName } });
  setToken(out.token);
  return out.user;
}

export async function loginAdmin(username, password) {
  const out = await call("/auth/admin", { method: "POST", auth: false, body: { username, password } });
  setToken(out.token);
  return out;
}

export const me = () => call("/me");
export const setConsentRemote = (analytics, marketing) =>
  call("/me/consent", { method: "PATCH", body: { analytics, marketing } });
export const deleteAccount = () => call("/me", { method: "DELETE" });
export function logout() { setToken(null); }

// ─── Keşif ────────────────────────────────────────────────────────────

export function getDeck({ lat, lng, category, radiusM = 12000 } = {}) {
  const q = new URLSearchParams();
  if (lat != null && lng != null) { q.set("lat", lat); q.set("lng", lng); }
  if (category) q.set("category", category);
  q.set("radiusM", String(radiusM));
  return call(`/deck?${q}`);
}

export const postSwipe = (payload) => call("/swipes", { method: "POST", body: payload });
export const completeRewardedAd = (revenueMinor = 0) =>
  call("/rewarded-ad/complete", { method: "POST", body: { revenueMinor } });
export const getSaved = () => call("/saved");
export const getRestaurant = (id) => call(`/restaurants/${id}`, { auth: false });
export function searchRestaurants(q, { lat, lng, limit = 40 } = {}) {
  const p = new URLSearchParams({ limit: String(limit) });
  if (q) p.set("q", q);
  if (lat != null && lng != null) { p.set("lat", lat); p.set("lng", lng); }
  return call(`/restaurants?${p}`, { auth: false });
}

// ─── Ziyaret ve yorum ─────────────────────────────────────────────────

export const postLocationSample = (sample) => call("/visits/sample", { method: "POST", body: sample });
export const getReviewPermission = (restaurantId) => call(`/visits/permission/${restaurantId}`);
export const getVisitPrompts = () => call("/visits/prompts");
export const postReview = (payload) => call("/reviews", { method: "POST", body: payload });

// ─── Olay ve gelir ────────────────────────────────────────────────────

export const postEvents = (events) => call("/events", { method: "POST", body: { events } });
export const postDirections = (restaurantId, provider) =>
  call("/directions", { method: "POST", body: { restaurantId, provider } });

// ─── B2B ──────────────────────────────────────────────────────────────

export const postClaim = (payload) => call("/claims", { method: "POST", body: payload });
export const getClaims = () => call("/claims");
export const decideClaimRemote = (id, status, reason) =>
  call(`/claims/${id}/decision`, { method: "POST", body: { status, reason } });
export const patchOwnerProfile = (id, patch) =>
  call(`/restaurants/${id}/owner`, { method: "PATCH", body: patch });

// ─── Yönetici ─────────────────────────────────────────────────────────

export const getGrowth = (weeks = 12) => call(`/admin/growth?weeks=${weeks}`);
export const getCampaigns = () => call("/admin/campaigns");
export const patchCampaign = (id, patch) => call(`/admin/campaigns/${id}`, { method: "PATCH", body: patch });
export const getEngagement = (id, days = 30) => call(`/admin/restaurants/${id}/engagement?days=${days}`);
export const runJob = (name) => call(`/admin/jobs/${name}`, { method: "POST" });
