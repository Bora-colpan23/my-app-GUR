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
import { DEMO_CAMPAIGNS } from "./campaigns.js";

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

// Yerel modda dış kaynak yorumları örnek: sunucu yokken bölüm boş kalmasın.
// Arayüz bunları "ÖRNEK" etiketiyle gösteriyor, Google yorumu gibi sunmuyor.
const SAMPLE_EXTERNAL = [
  { provider: "manual", author_name: "Ahmet Y.", rating: 5, relative_time: "2 hafta önce",
    body: "Porsiyonlar bol, fiyat performans çok iyi. Garsonlar ilgili." },
  { provider: "manual", author_name: "Selin K.", rating: 4, relative_time: "1 ay önce",
    body: "Lezzet güzel ama akşamüstü kalabalık oluyor, rezervasyon şart." },
  { provider: "manual", author_name: "Murat D.", rating: 5, relative_time: "1 ay önce",
    body: "Yıllardır geliyoruz, kalite hiç düşmedi. Tatlıları ayrı güzel." },
  { provider: "manual", author_name: "Elif A.", rating: 3, relative_time: "2 ay önce",
    body: "Yemek iyiydi fakat servis biraz yavaştı. Yine de tavsiye ederim." },
];

/**
 * Restoran detayının kart verisinde olmayan kısmı: işletmenin aldığı
 * hizmetler ve dış kaynak yorumları. Canlı modda sunucudan, yerel modda
 * demo kampanya envanterinden türetilir.
 */
export async function loadRestaurantDetail(restaurant) {
  if (isLive()) {
    try {
      const d = await api.getRestaurant(restaurant.id);
      return { services: d.services, externalReviews: d.externalReviews || [] };
    } catch { /* yerele düş */ }
  }
  const claimed = !!(restaurant.claimed || restaurant.ownerClaimed);
  const campaigns = DEMO_CAMPAIGNS
    .filter(c => String(c.restaurantId) === String(restaurant.id))
    .map(c => ({ label: c.label, pricing: c.pricing }));
  return {
    services: { claimed, plan: claimed ? (campaigns.length ? "pro" : "premium") : null, campaigns },
    externalReviews: claimed || restaurant.gastro ? SAMPLE_EXTERNAL : [],
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

/**
 * Demo doğrulaması: "buradayım" düğmesi.
 *
 * İki taraf farklı zaman ölçeğinde çalışıyor ve bunu birleştirmek hatalıydı:
 * sunucu gerçek kuralı (15 dk kalış) uyguluyor, bu yüzden ona aralarında
 * 30 dakika olan iki örnek gidiyor. Yerel kopyada ise aynı boşluk ziyareti
 * "kullanıcı ayrılmış" sayıp kapatıyordu — orada örnekler bitişik gönderilip
 * hızlandırılmış eşik kullanılıyor.
 */
export async function demoVerifyVisit(restaurant) {
  if (!restaurant || !Number.isFinite(restaurant.lat)) return null;
  const at = Date.now();
  const point = { lat: restaurant.lat, lng: restaurant.lng, accuracyM: 12 };

  // Yerel: aradaki boşluk hızlandırılmış eşiği (DEMO_DWELL_SECONDS) aşmalı
  // ama ziyareti "kullanıcı ayrıldı" saydıracak gapSeconds'ın altında kalmalı.
  const LOCAL_SPREAD_MS = (visits.DEMO_DWELL_SECONDS + 12) * 1000;
  visits.ingestSample([restaurant], { ...point, at: at - LOCAL_SPREAD_MS }, { accelerate: true });
  const local = visits.ingestSample([restaurant], { ...point, at }, { accelerate: true });

  // Sunucu: gerçek kural, gerçek aralık
  if (isLive() && api.getToken()) {
    try {
      await api.postLocationSample({ ...point, at: new Date(at - 30 * 60 * 1000).toISOString() });
      await api.postLocationSample({ ...point, at: new Date(at).toISOString() });
    } catch { /* yerel doğrulama yine geçerli */ }
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
