// ═══════════════════════════════════════════════════════════════════════
// TEKLİF TALEPLERİ — işletme ister, yönetici fiyatlar
//
// Önceden işletme panelden "Satın Al"a basıp kendi kendine bir hizmeti
// açıyordu. Artık **hiçbir şey kendiliğinden satın alınamıyor**: işletme
// yalnızca TEKLİF İSTER, talep yöneticiye düşer, yönetici fiyatı
// belirleyip teklif gönderir (lib/pricing.js), işletme kabul ya da ret
// eder. Satış kararı tek elde.
//
// Akış:
//   işletme            yönetici                işletme
//   "Teklif iste"  →   talep kuyruğu       →   gelen teklif
//   (requests.js)      (bildirim + rozet)      (pricing.js)
//                      teklif gönder       →   kabul / ret
//
// Talep ile TEKLİF ayrı iki kayıt ve bu bilinçli: bir talebe birden fazla
// teklif gidebilir (ilki reddedilir, ikincisi kabul edilir) ve talebin
// kendisi "bu müşteri bu hizmeti istedi" bilgisini taşımaya devam eder.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { isServiceOpen } from "./platform.js";

const KEY = "gur.serviceRequests";
const listeners = new Set();
let cache = null;

function read() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "[]") || []; }
  catch { cache = []; }
  return cache;
}
function write(next) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* yoksay */ }
  for (const l of listeners) l();
}
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function useRequests() {
  return useSyncExternalStore(subscribe, read, read);
}

export function allRequests(state = read()) { return state; }

/** Bu mekanın bu hizmet için bekleyen talebi — düğmenin durumu buradan. */
export function requestFor(restaurantId, streamKey, state = read()) {
  return state.find(r =>
    String(r.restaurantId) === String(restaurantId)
    && r.streamKey === streamKey
    && r.status === "open") || null;
}

/**
 * Talep oluştur.
 *
 * Aynı hizmet için açık talep varsa İKİNCİSİ AÇILMAZ: işletme düğmeye üç
 * kez basarsa yöneticinin önüne üç aynı iş çıkmamalı. Düğme zaten durumu
 * yansıtıyor ama kural burada da var — arayüzde engellemek kapı sayılmaz.
 */
export function requestQuote({ restaurantId, restaurantName, streamKey, streamName, note = "" }) {
  const state = read();
  if (requestFor(restaurantId, streamKey, state)) return null;
  // Satışa kapalı bir kalem için talep açılmıyor. Arayüzde kart zaten
  // "Pek yakında" yazıyor ama kapı BURADA: kapatıldıktan sonra açık kalmış
  // bir sekmeden gelen istek de reddedilmeli.
  if (!isServiceOpen(streamKey, undefined, restaurantId)) return null;
  const kayit = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    restaurantId, restaurantName, streamKey, streamName,
    note: String(note).slice(0, 400),
    status: "open",          // open | quoted | closed | withdrawn
    at: new Date().toISOString(),
    seen: false,             // yönetici gördü mü (bildirim rozeti)
  };
  write([kayit, ...state]);
  return kayit;
}

/** İşletme talebini geri çekebilir — yanlışlıkla istemiş olabilir. */
export function withdraw(id) {
  write(read().map(r => r.id === id
    ? { ...r, status: "withdrawn", closedAt: new Date().toISOString() } : r));
}

/** Yönetici teklif gönderdi: talep "fiyatlandı" durumuna geçer, kapanmaz. */
export function markQuoted(id) {
  write(read().map(r => r.id === id
    ? { ...r, status: "quoted", quotedAt: new Date().toISOString() } : r));
}

/** Teklif kabul/ret edildi ya da yönetici talebi kapattı. */
export function close(id, reason = null) {
  write(read().map(r => r.id === id
    ? { ...r, status: "closed", reason, closedAt: new Date().toISOString() } : r));
}

export function openRequests(state = read()) {
  return state.filter(r => r.status === "open" || r.status === "quoted");
}

/** Bildirim rozeti: yöneticinin HENÜZ GÖRMEDİĞİ talepler. */
export function unseenCount(state = read()) {
  return state.filter(r => !r.seen && (r.status === "open" || r.status === "quoted")).length;
}

/** Bildirim listesi açıldığında hepsi görüldü sayılır — görmek cevap
 *  vermek değil, talep kuyrukta kalmaya devam eder. */
export function markAllSeen() {
  const state = read();
  if (!state.some(r => !r.seen)) return;
  write(state.map(r => (r.seen ? r : { ...r, seen: true })));
}

export function requestsFor(restaurantId, state = read()) {
  return state.filter(r => String(r.restaurantId) === String(restaurantId));
}
