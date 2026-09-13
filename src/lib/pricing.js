// ═══════════════════════════════════════════════════════════════════════
// FİYATLANDIRMA VE TEKLİFLER
//
// Yönetici, hesabı olan bir müşteriye aldığı hizmetler için tek tek fiyat
// teklifi gönderir. Liste fiyatı yoktur: her işletmenin fiyatı kendi
// pazarlığının sonucudur. Teklif işletmenin panelinde görünür; kabul
// ederse o kalemin aylık bedeli teklif edilen tutara döner ve gelir
// tabloları bunu okur.
//
// Teklif "uygulanmış fiyat" değildir: karşı taraf kabul edene kadar hiçbir
// tutar değişmez. Kabul etmeden fiyatı düşürmek/yükseltmek, işletmeye
// sormadan sözleşme değiştirmek olurdu.
//
// Sunucudaki karşılığı price_offers tablosu ve subscription kalemlerinin
// fiyat geçmişidir.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

const KEY = "gur.pricing";

const EMPTY = { offers: [] };

const listeners = new Set();
function emit() {
  for (const l of listeners) l();
  try { window.dispatchEvent(new Event("gur:pricing")); } catch { /* SSR */ }
}
function subscribe(fn) {
  listeners.add(fn);
  const onExternal = () => fn();
  window.addEventListener("storage", onExternal);
  window.addEventListener("gur:pricing", onExternal);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onExternal);
    window.removeEventListener("gur:pricing", onExternal);
  };
}

// Anlık görüntü referansı sabit kalmalı (bkz. b2b.js).
let snap = { raw: null, value: EMPTY };
export function getPricing() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return snap.value; }
  if (snap.raw === raw) return snap.value;
  let stored = null;
  try { stored = JSON.parse(raw || "null"); } catch { stored = null; }
  snap = { raw, value: { offers: Array.isArray(stored?.offers) ? stored.offers : [] } };
  return snap.value;
}

function write(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* depolama kapalı */ }
  emit();
}

// ─── Teklifler ───────────────────────────────────────────────────────

/**
 * İşletmeye fiyat teklifi. Aynı işletme + kalem için bekleyen bir teklif
 * varsa yenisi onun yerine geçer: iki açık teklif, hangisinin geçerli
 * olduğu belirsiz bir masa demek.
 */
export function sendOffer({ streamKey, streamName, restaurantId, restaurantName, currentMonthly, offerMonthly, note }) {
  const cur = getPricing();
  const offers = cur.offers.filter(o => !(
    String(o.restaurantId) === String(restaurantId) &&
    o.streamKey === streamKey &&
    o.status === "pending"
  ));
  const offer = {
    id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    streamKey, streamName,
    restaurantId: String(restaurantId), restaurantName,
    currentMonthly: Math.round(currentMonthly || 0),
    offerMonthly: Math.max(0, Math.round(offerMonthly)),
    note: note || "",
    status: "pending",
    createdAt: Date.now(),
    seenByOwner: false,
  };
  write({ ...cur, offers: [offer, ...offers] });
  return offer;
}

/** İşletmenin kararı. */
export function decideOffer(id, status) {
  const cur = getPricing();
  write({
    ...cur,
    offers: cur.offers.map(o => (o.id === id
      ? { ...o, status, decidedAt: Date.now(), seenByOwner: true }
      : o)),
  });
}

/** İşletme panelinde görüldü işareti — rozet söner, teklif kalır. */
export function markOffersSeen(restaurantId) {
  const cur = getPricing();
  if (!cur.offers.some(o => String(o.restaurantId) === String(restaurantId) && !o.seenByOwner)) return;
  write({
    ...cur,
    offers: cur.offers.map(o => (String(o.restaurantId) === String(restaurantId)
      ? { ...o, seenByOwner: true }
      : o)),
  });
}

export function offersFor(restaurantId) {
  return getPricing().offers.filter(o => String(o.restaurantId) === String(restaurantId));
}

export function offersForStream(streamKey) {
  return getPricing().offers.filter(o => o.streamKey === streamKey);
}

/**
 * Kabul edilmiş en son teklifin fiyatı — yoksa null. Gelir tabloları
 * mağazanın aylık tutarını hesaplarken bunu uyguluyor, böylece kabul
 * edilen teklif tek noktadan yürürlüğe giriyor.
 */
export function acceptedPrice(restaurantId, streamKey) {
  const hit = getPricing().offers
    .filter(o => String(o.restaurantId) === String(restaurantId) &&
                 o.streamKey === streamKey && o.status === "accepted")
    .sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0))[0];
  return hit ? hit.offerMonthly : null;
}

export function usePricing() {
  return useSyncExternalStore(subscribe, getPricing, () => EMPTY);
}
