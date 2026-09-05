// ═══════════════════════════════════════════════════════════════════════
// B2B: işletme sahiplenme (claim) ve işletmenin girdiği bilgiler.
//
// Tüketici uygulaması ile yönetici paneli ayrı rotalarda çalışıyor; ortak
// durum localStorage üzerinden paylaşılır. Sunucu tarafında bunun karşılığı
// restaurant_claims ve restaurants tablolarıdır.
//
// Kural: işletmenin girdiği alan dış kaynağı EZER; girmediği alan dış
// kaynaktan (Google Places / Foursquare / OSM) olduğu gibi gelir.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

const CLAIMS_KEY = "gur.claims";
const PROFILE_KEY = "gur.ownerProfiles";

const listeners = new Set();
function emit() {
  for (const l of listeners) l();
  try { window.dispatchEvent(new Event("gur:b2b")); } catch { /* SSR */ }
}
function subscribe(fn) {
  listeners.add(fn);
  const onStorage = () => fn();
  window.addEventListener("storage", onStorage);
  window.addEventListener("gur:b2b", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("gur:b2b", onStorage);
  };
}

// useSyncExternalStore anlık görüntünün referansını sabit ister: her
// çağrıda yeni bir nesne döndürmek sonsuz yeniden çizime yol açıyor.
// Ham metin değişmediği sürece aynı nesneyi veriyoruz.
const snapshots = new Map();   // key → { raw, value }

function read(key, fallback) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { return fallback; }
  const hit = snapshots.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value = fallback;
  try { value = JSON.parse(raw || "null") ?? fallback; } catch { value = fallback; }
  snapshots.set(key, { raw, value });
  return value;
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* depolama kapalı */ }
  emit();
}

// ─── Sahiplenme başvuruları ───────────────────────────────────────────

export function getClaims() { return read(CLAIMS_KEY, []); }

/** Yeni başvuru. Aynı mekan için bekleyen başvuru varsa ikincisi açılmaz. */
export function submitClaim({ restaurantId, restaurantName, legalName, taxId, contactName, phone, email, evidence }) {
  const claims = getClaims();
  if (claims.some(c => String(c.restaurantId) === String(restaurantId) && c.status === "pending")) {
    return { ok: false, reason: "already_pending" };
  }
  const claim = {
    id: `clm-${Date.now()}`,
    restaurantId, restaurantName,
    legalName, taxId, contactName, phone, email,
    evidence: evidence || [],
    status: "pending",
    createdAt: Date.now(),
  };
  write(CLAIMS_KEY, [claim, ...claims]);
  return { ok: true, claim };
}

export function decideClaim(id, status, reason = null) {
  const claims = getClaims().map(c =>
    c.id === id ? { ...c, status, reviewedAt: Date.now(), rejectReason: reason } : c);
  write(CLAIMS_KEY, claims);
}

/** Bu mekan onaylanmış bir sahiplenmeye sahip mi? */
export function claimFor(restaurantId) {
  return getClaims().find(c => String(c.restaurantId) === String(restaurantId)) || null;
}

export function useClaims() {
  return useSyncExternalStore(subscribe, getClaims, () => []);
}

// ─── İşletmenin girdiği bilgiler ──────────────────────────────────────

/** { [restaurantId]: { name, desc, hours, price, phone, addr, popular, menu, photos } } */
export function getOwnerProfiles() { return read(PROFILE_KEY, {}); }

export function saveOwnerProfile(restaurantId, patch) {
  const all = getOwnerProfiles();
  const key = String(restaurantId);
  // Boş dize "silme" değil "girilmedi" demek: dış kaynağa geri düşülür.
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== "" && v != null));
  all[key] = { ...(all[key] || {}), ...clean };
  write(PROFILE_KEY, all);
  return all[key];
}

export function clearOwnerField(restaurantId, field) {
  const all = getOwnerProfiles();
  const key = String(restaurantId);
  if (all[key]) { delete all[key][field]; write(PROFILE_KEY, all); }
}

export function useOwnerProfiles() {
  return useSyncExternalStore(subscribe, getOwnerProfiles, () => ({}));
}

// Dış kaynaktan gelen ve işletmenin ezebileceği alanlar.
export const OVERRIDABLE = ["name", "desc", "hours", "price", "phone", "addr"];

/**
 * Bir restoran kaydını işletmenin girdikleriyle birleştirir.
 * Dönen nesnede `fieldSource` her alanın nereden geldiğini söyler; panel
 * "API'den" rozetini buradan çizer.
 */
export function applyOwnerProfile(restaurant, profiles = getOwnerProfiles()) {
  const own = profiles[String(restaurant.id)];
  const fieldSource = {};
  for (const f of OVERRIDABLE) fieldSource[f] = own?.[f] ? "owner" : "api";
  if (!own) return { ...restaurant, fieldSource, ownerClaimed: false };

  return {
    ...restaurant,
    ...Object.fromEntries(OVERRIDABLE.filter(f => own[f]).map(f => [f, own[f]])),
    popular: own.popular?.length ? own.popular : restaurant.popular,
    fieldSource,
    ownerClaimed: true,
  };
}
