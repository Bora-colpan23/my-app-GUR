// ═══════════════════════════════════════════════════════════════════════
// Konum doğrulamalı ziyaret — istemci tarafı.
//
// Kurallar sunucudaki server/src/visits/tracker.js ile birebir aynı;
// istemci yalnızca örnek toplar ve kararı yerel olarak da hesaplar ki
// çevrimdışıyken bile yorum kilidi doğru açılsın.
//
// Ham konum HİÇBİR yere gönderilmez ve saklanmaz: yalnızca hangi mekâna
// ne kadar yakın kalındığının özeti tutulur.
// ═══════════════════════════════════════════════════════════════════════

import { distanceMeters } from "../../shared/deeplink.js";

export const VISIT_RULES = {
  radiusM: 120,
  maxAccuracyM: 100,
  minDwellSeconds: 15 * 60,
  gapSeconds: 20 * 60,
  promptDelayMinutes: 90,
  cooldownHours: 20,
  sampleIntervalMs: 60 * 1000,
};

// Demo/önizleme: gerçek 15 dakikayı beklemek test edilemez kılıyor.
// Hızlandırıcı yalnızca kullanıcı "buradayım" düğmesine bastığında devreye
// girer, arka planda kendiliğinden çalışmaz.
export const DEMO_DWELL_SECONDS = 8;

const KEY = "gur.visits";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-50))); } catch { /* depolama kapalı */ }
}

const listeners = new Set();
function emit() { for (const l of listeners) l(); }
export function subscribeVisits(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function getVisits() { return read(); }

/** Bu mekan için yorum kilidi açık mı? */
export function reviewPermission(restaurantId) {
  const now = Date.now();
  const v = read().find(v =>
    String(v.restaurantId) === String(restaurantId) &&
    (v.status === "confirmed" || v.status === "prompted") &&
    !v.reviewed &&
    now - v.confirmedAt < 14 * 24 * 3600 * 1000);
  return v ? { allowed: true, visit: v } : { allowed: false, reason: "no_verified_visit" };
}

export function markReviewed(restaurantId) {
  const list = read();
  const v = [...list].reverse().find(v => String(v.restaurantId) === String(restaurantId) && !v.reviewed);
  if (v) { v.reviewed = true; v.status = "reviewed"; write(list); emit(); }
}

/** Bildirimi gösterilmiş say. */
export function markPrompted(visitId) {
  const list = read();
  const v = list.find(v => v.id === visitId);
  if (v) { v.status = "prompted"; v.promptedAt = Date.now(); write(list); emit(); }
}

/** Vakti gelmiş "deneyim nasıldı" bildirimi var mı? */
export function duePrompt() {
  const now = Date.now();
  return read().find(v => v.status === "confirmed" && !v.promptedAt && v.promptDueAt <= now) || null;
}

/**
 * Tek konum örneğini işler; sunucudaki mantığın aynısı.
 * restaurants: [{ id, name, lat, lng }]
 */
export function ingestSample(restaurants, sample, { accelerate = false } = {}) {
  const { lat, lng, accuracyM, at = Date.now() } = sample;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (accuracyM != null && accuracyM > VISIT_RULES.maxAccuracyM && !accelerate) return null;

  const near = restaurants
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({ r, d: distanceMeters({ lat, lng }, { lat: r.lat, lng: r.lng }) }))
    .filter(x => x.d <= VISIT_RULES.radiusM)
    .sort((a, b) => a.d - b.d)[0];

  const list = read();
  closeStale(list, at);

  if (!near) { write(list); emit(); return null; }

  const minDwell = accelerate ? DEMO_DWELL_SECONDS : VISIT_RULES.minDwellSeconds;
  let visit = list.find(v => String(v.restaurantId) === String(near.r.id) && v.status === "open");

  if (!visit) {
    const cooled = list.find(v =>
      String(v.restaurantId) === String(near.r.id) &&
      v.status !== "abandoned" &&
      at - v.firstSeenAt < VISIT_RULES.cooldownHours * 3600 * 1000);
    if (cooled) { write(list); return cooled; }

    visit = {
      id: `v-${at}-${near.r.id}`,
      restaurantId: near.r.id,
      restaurantName: near.r.name,
      status: "open",
      firstSeenAt: at,
      lastSeenAt: at,
      dwellSeconds: 0,
      minDistanceM: Math.round(near.d),
      samples: 1,
    };
    list.push(visit);
  } else {
    visit.lastSeenAt = at;
    visit.samples += 1;
    visit.minDistanceM = Math.min(visit.minDistanceM, Math.round(near.d));
    visit.dwellSeconds = Math.round((at - visit.firstSeenAt) / 1000);
  }

  if (visit.status === "open" && visit.dwellSeconds >= minDwell) {
    visit.status = "confirmed";
    visit.confirmedAt = at;
    // Hızlandırılmış demoda bildirim hemen gelsin; gerçekte 90 dakika sonra.
    visit.promptDueAt = at + (accelerate ? 1500 : VISIT_RULES.promptDelayMinutes * 60 * 1000);
  }

  write(list);
  emit();
  return visit;
}

function closeStale(list, now) {
  for (const v of list) {
    if (v.status !== "open") continue;
    if (now - v.lastSeenAt < VISIT_RULES.gapSeconds * 1000) continue;
    if (v.dwellSeconds >= VISIT_RULES.minDwellSeconds) {
      v.status = "confirmed";
      v.confirmedAt = v.lastSeenAt;
      v.promptDueAt = v.lastSeenAt + VISIT_RULES.promptDelayMinutes * 60 * 1000;
    } else {
      v.status = "abandoned";
    }
  }
}

/**
 * Konum izni ister ve izleme başlatır.
 * onSample her örnekte çağrılır. Dönen fonksiyon izlemeyi durdurur.
 *
 * İzin gerekçesi ÇAĞIRAN tarafından gösterilir (bkz. LocationRationale):
 * tarayıcı istemini gerekçesiz açmak, reddedilme oranını yükseltiyor ve
 * reddedildikten sonra geri dönüşü zor.
 */
export function watchLocation(onSample, onError) {
  if (!("geolocation" in navigator)) {
    onError?.(new Error("Bu cihaz konum desteklemiyor"));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    pos => onSample({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyM: pos.coords.accuracy,
      at: pos.timestamp || Date.now(),
    }),
    err => onError?.(err),
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Tarayıcı bildirimi — izin verilmişse. Sessizce başarısız olur. */
export async function pushLocalNotification(title, body, tag) {
  try {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") return false;
    new Notification(title, { body, tag, icon: "/apple-touch-icon.png" });
    return true;
  } catch { return false; }
}
