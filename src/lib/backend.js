// ═══════════════════════════════════════════════════════════════════════
// Arka uç cephesi.
//
// Ekranlar "sunucu var mı" sorusunu sormaz; bu modülü çağırır. Sunucu
// ayaktaysa istek oraya gider ve kalıcı olur, değilse aynı iş localStorage
// üzerinde yürür. Böylece dallanma tek yerde kalıyor — her ekrana yayılmış
// bir "if (online)" kontrolü, ikisinden birinin sessizce bozulması demek.
// ═══════════════════════════════════════════════════════════════════════

import * as api from "./api.js";
import * as visits from "./visits.js";
import * as b2b from "./b2b.js";

export const { subscribeApi, apiMode, isLive } = api;

/** Açılışta bir kez: mod ölçülür, belirteç varsa oturum tazelenir. */
export async function boot() {
  const { mode, info } = await api.ensureMode();
  if (mode !== "live") return { mode, user: null, info: null };
  if (!api.getToken()) return { mode, user: null, info };
  try {
    const { user } = await api.me();
    return { mode, user, info };
  } catch {
    // Belirteç eskimiş; oturumsuz devam, ekranlar giriş isteyecek.
    api.logout();
    return { mode, user: null, info };
  }
}

// ─── Kimlik ───────────────────────────────────────────────────────────

export async function signIn({ email, password, name }) {
  if (!isLive()) return { id: "local", name: name || "Misafir", local: true };
  return api.loginWithPassword(email, password, name);
}

export async function signInSocial(provider, payload) {
  if (!isLive()) return { id: "local", name: payload?.profile?.name || "Misafir", local: true };
  return api.loginWithSocial(provider, payload);
}

export function signOut() { api.logout(); }

export async function removeAccount() {
  if (isLive()) { try { await api.deleteAccount(); } catch { /* yerel temizlik yine yapılır */ } }
  try {
    localStorage.removeItem("gur.visits");
    localStorage.removeItem("gur.claims");
    localStorage.removeItem("gur.ownerProfiles");
  } catch { /* depolama kapalı */ }
  api.logout();
}

export async function syncConsent(analytics, marketing) {
  if (!isLive() || !api.getToken()) return;
  try { await api.setConsentRemote(analytics, marketing); } catch { /* rıza yerelde zaten kayıtlı */ }
}

// ─── Keşif ────────────────────────────────────────────────────────────

/**
 * Canlı modda deste sunucudan gelir: sponsorlu enjeksiyon, kota ve
 * "30 gündür görülmemiş" filtresi orada uygulanır. Yerel modda null döner,
 * çağıran mock listeyi kullanır.
 */
export async function loadDeck({ lat, lng, category } = {}) {
  if (!isLive() || !api.getToken()) return null;
  try {
    const { cards, quota } = await api.getDeck({ lat, lng, category });
    return { cards: cards.map(hydrate), quota };
  } catch { return null; }
}

export async function loadRestaurants({ q, lat, lng } = {}) {
  if (!isLive()) return null;
  try {
    const { restaurants } = await api.searchRestaurants(q, { lat, lng });
    return restaurants.map(hydrate);
  } catch { return null; }
}

// Sunucu kaydı ile arayüzün beklediği kart arasındaki son fark: görseller.
// Sunucu fotoğrafları ayrı tabloda tutuyor, kart tek dizide bekliyor.
function hydrate(r) {
  const seed = String(r.id).slice(0, 8);
  return {
    ...r,
    imgs: r.imgs?.length ? r.imgs : [0, 1, 2].map(i => `https://picsum.photos/seed/${seed}-${i}/900/600`),
    menu: r.menu?.length ? r.menu : [`https://picsum.photos/seed/${seed}-menu/600/900`],
    tags: r.tags?.length ? r.tags : [r.cat].filter(Boolean),
    price: r.price || "₺₺",
    dist: r.dist || "—",
    hours: r.hours || "11:00 - 23:00",
    desc: r.desc || `${r.cat} kategorisinde hizmet veren mekan.`,
  };
}

export async function recordSwipe({ restaurantId, direction, campaignId, deckPosition, dwellMs }) {
  if (!isLive() || !api.getToken()) return;
  try { await api.postSwipe({ restaurantId, direction, campaignId, deckPosition, dwellMs }); }
  catch { /* kaydırma akışı sunucu hatasında durmamalı */ }
}

export async function rewardedAdDone() {
  if (!isLive() || !api.getToken()) return;
  try { await api.completeRewardedAd(0); } catch { /* yoksay */ }
}

export async function trackDirections(restaurantId, provider) {
  if (!isLive() || !api.getToken()) return;
  try { await api.postDirections(restaurantId, provider); } catch { /* yoksay */ }
}

// ─── Ziyaret ve yorum ─────────────────────────────────────────────────

/**
 * Konum örneği. Canlı modda karar sunucuda verilir (otorite orası),
 * yerel kopya arayüzün anında tepki vermesi için yine güncellenir.
 */
export async function pushLocationSample(restaurants, sample, opts) {
  const local = visits.ingestSample(restaurants, sample, opts);
  if (isLive() && api.getToken()) {
    try { await api.postLocationSample(sample); } catch { /* yerel karar geçerli kalır */ }
  }
  return local;
}

export async function reviewAllowed(restaurantId) {
  if (isLive() && api.getToken()) {
    try { return (await api.getReviewPermission(restaurantId)).allowed; } catch { /* yerele düş */ }
  }
  return visits.reviewPermission(restaurantId).allowed;
}

export async function submitReview(restaurantId, review) {
  if (isLive() && api.getToken()) {
    await api.postReview({ restaurantId, stars: review.stars, body: review.text, photos: review.photoUrls || [] });
  }
  visits.markReviewed(restaurantId);
}

export async function duePrompts() {
  if (isLive() && api.getToken()) {
    try {
      const { prompts } = await api.getVisitPrompts();
      return prompts.map(p => ({
        id: p.id, restaurantId: p.restaurant_id,
        restaurantName: p.restaurant_name, dwellSeconds: p.dwell_seconds,
      }));
    } catch { /* yerele düş */ }
  }
  const due = visits.duePrompt();
  return due ? [due] : [];
}

// ─── B2B ──────────────────────────────────────────────────────────────

export async function submitClaim(payload) {
  if (isLive() && api.getToken()) {
    try {
      await api.postClaim(payload);
      return { ok: true, remote: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }
  return b2b.submitClaim(payload);
}

export async function saveOwnerFields(restaurantId, patch) {
  b2b.saveOwnerProfile(restaurantId, patch);
  if (isLive() && api.getToken()) {
    // Sunucu alan adları veritabanı sütunları; istemci kısaltmaları eşlenir.
    const map = { name: "name", desc: "description", hours: "hours", phone: "phone", addr: "address" };
    const remote = Object.fromEntries(
      Object.entries(patch).filter(([k]) => map[k]).map(([k, v]) => [map[k], v]));
    if (Object.keys(remote).length) {
      try { await api.patchOwnerProfile(restaurantId, remote); }
      catch { /* sahiplenme onaylanmadıysa 403 — yerel kopya yine geçerli */ }
    }
  }
}
