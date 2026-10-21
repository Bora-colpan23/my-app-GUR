// ═══════════════════════════════════════════════════════════════════════
// MODERASYON KUYRUĞU — yayına çıkmadan önce yönetici görür
//
// Önceden iki yol da doğrudan tüketiciye açılıyordu: dış beslemeden gelen
// yeni mekan anında listede beliriyordu, işletmenin panelden girdiği alan
// anında kartta görünüyordu. İkisi de denetimsizdi — yanlış adres, uygunsuz
// açıklama ya da rakip mekanın adına açılmış bir kayıt hiçbir kapıdan
// geçmiyordu.
//
// Artık ikisi de kuyruğa düşüyor:
//
//   kaynak            → kuyruk kaydı            → yönetici → tüketici
//   dış besleme (API)   yeni mekan (pending)      onay       listede
//   işletme paneli      alan değişikliği          onay       kartta
//   yönetici (elle)     —  (zaten yetkili)        —          listede
//
// İKİ AYRI ŞEY olduğu için iki ayrı depo var:
//   • Mekanın kendi durumu (`reviewStatus`) — kayıt yayında mı.
//   • Alan değişikliği kuyruğu — yayındaki kaydın neyi değişecek.
// Bunları tek tabloda tutmak "mekan bekliyor" ile "mekanın telefonu
// bekliyor" durumlarını birbirine karıştırırdı.
//
// Yönetici onaylarken DÜZENLEYEBİLİR: gelen değeri olduğu gibi kabul
// etmek zorunda değil, düzelttiği hâli yayınlanır (`approve(id, edits)`).
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { saveOwnerProfile } from "./b2b.js";

const KEY = "gur.moderation";
const listeners = new Set();
let cache = null;

const bos = () => ({ changes: [], venues: {} });

function read() {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    cache = v && typeof v === "object" ? { ...bos(), ...v } : bos();
  } catch { cache = bos(); }
  return cache;
}
function write(next) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* yoksay */ }
  for (const l of listeners) l();
}
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function useModeration() {
  return useSyncExternalStore(subscribe, read, read);
}

// ─── Mekan durumu ────────────────────────────────────────────────────────
//
// Tohum ve mock veri ONAYLI sayılır: bunlar zaten elle hazırlanmış kayıtlar.
// Yalnızca beslemenin GETİRDİĞİ yeni mekan beklemeye düşer, o da
// `markVenuePending` ile işaretlenir. Varsayılanı "bekliyor" yapmak
// mevcut havuzu bir gecede boşaltırdı.
export function venueStatus(restaurantId, state = read()) {
  return state.venues[String(restaurantId)]?.status || "approved";
}

export function isVenuePublished(restaurantId, state = read()) {
  return venueStatus(restaurantId, state) === "approved";
}

/** Beslemeden gelen yeni mekan: yönetici görene kadar yayında değil. */
export function markVenuePending(restaurant) {
  const key = String(restaurant.id);
  const s = read();
  if (s.venues[key]) return;                     // kararı verilmiş, dokunma
  write({ ...s, venues: { ...s.venues, [key]: {
    status: "pending",
    name: restaurant.name,
    source: restaurant.source || "api",
    at: new Date().toISOString(),
  } } });
}

export function decideVenue(restaurantId, status) {
  const key = String(restaurantId);
  const s = read();
  const cur = s.venues[key] || {};
  write({ ...s, venues: { ...s.venues, [key]: { ...cur, status, decidedAt: new Date().toISOString() } } });
}

/** Yayında olmayan mekanları listeden düşürür. */
export function publishedOnly(list = [], state = read()) {
  return list.filter(r => venueStatus(r.id, state) === "approved");
}

export function pendingVenues(list = [], state = read()) {
  return list.filter(r => venueStatus(r.id, state) === "pending");
}

// ─── Alan değişikliği kuyruğu ────────────────────────────────────────────

/**
 * İşletmenin girdiği alanlar doğrudan yayınlanmıyor, kuyruğa giriyor.
 *
 * Aynı mekanın bekleyen kaydı varsa ÜSTÜNE yazılır: işletme formu üç kez
 * kaydederse yöneticinin önüne üç ayrı iş çıkmamalı, son hâli çıkmalı.
 */
export function submitChange({ restaurantId, restaurantName, fields, by = "owner" }) {
  const temiz = Object.fromEntries(
    Object.entries(fields || {}).filter(([, v]) => v !== "" && v != null));
  if (!Object.keys(temiz).length) return null;

  const s = read();
  const key = String(restaurantId);
  const kalan = s.changes.filter(c => !(String(c.restaurantId) === key && c.status === "pending"));
  const kayit = {
    id: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    restaurantId, restaurantName, by,
    fields: temiz,
    status: "pending",
    at: new Date().toISOString(),
  };
  write({ ...s, changes: [kayit, ...kalan] });
  return kayit;
}

export function pendingChanges(state = read()) {
  return state.changes.filter(c => c.status === "pending");
}

export function pendingChangeFor(restaurantId, state = read()) {
  return pendingChanges(state).find(c => String(c.restaurantId) === String(restaurantId)) || null;
}

/**
 * Onay. `edits` verilirse yayınlanan değer odur — yönetici gelen metni
 * düzeltebilsin diye. Kuyruk kaydında hem gelen hem yayınlanan tutuluyor:
 * "yönetici neyi değiştirdi" sorusu sonradan cevaplanabilsin.
 */
export function approveChange(id, edits = null) {
  const s = read();
  const c = s.changes.find(x => x.id === id);
  if (!c || c.status !== "pending") return null;
  const yayin = edits ? { ...c.fields, ...edits } : c.fields;
  saveOwnerProfile(c.restaurantId, yayin);
  write({ ...s, changes: s.changes.map(x => x.id === id
    ? { ...x, status: "approved", published: yayin, edited: !!edits, decidedAt: new Date().toISOString() }
    : x) });
  return yayin;
}

export function rejectChange(id, reason = null) {
  const s = read();
  write({ ...s, changes: s.changes.map(x => x.id === id
    ? { ...x, status: "rejected", reason, decidedAt: new Date().toISOString() }
    : x) });
}

/** Panelde rozet: bu alan şu an incelemede mi. */
export function fieldPending(restaurantId, field, state = read()) {
  const c = pendingChangeFor(restaurantId, state);
  return !!c && Object.prototype.hasOwnProperty.call(c.fields, field);
}

/** Yöneticinin önündeki toplam iş — kenar çubuğundaki sayaç. */
export function queueCount(list = [], state = read()) {
  return pendingChanges(state).length + pendingVenues(list, state).length;
}
