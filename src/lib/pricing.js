// ═══════════════════════════════════════════════════════════════════════
// FİYATLANDIRMA VE TEKLİFLER
//
// Yönetici, hesabı olan bir müşteriye aldığı hizmetler için tek tek fiyat
// teklifi gönderir. Her işletmenin ÖDEDİĞİ tutar kendi pazarlığının
// sonucudur; ama pazarlık artık boş sayfadan başlamıyor — her pazarlıklı
// kalemin yöneticinin belirlediği bir LİSTE FİYATI var (aşağıda) ve teklif
// alanı oradan doluyor. Liste fiyatı bir taahhüt değil, başlangıç noktası:
// işletme panelinde de "liste:" önekiyle geçiyor.
//
// Teklif işletmenin panelinde görünür; kabul ederse o kalemin aylık bedeli
// teklif edilen tutara döner ve gelir tabloları bunu okur.
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

// ─── PAZARLIKLI KALEMLERİN LİSTE FİYATI ──────────────────────────────
//
// Sabit fiyatlı reklam envanteri `lib/adslots.js`de ve birimi GÜN. Burası
// onun karşılığı: pazarlığa açık üç kalemin başlangıç fiyatı. İkisi ayrı
// dosyada çünkü ayrı şeyler — sabit fiyatta işletme tarihi seçip talep
// açıyor, burada fiyatın kendisi konuşuluyor.
//
// `unit` yalnızca etiket: bedelin neyin karşılığı olduğunu söylüyor
// ("/ ay" ile "/ yayın" aynı sayı değil). Yönetici fiyatı panelden
// değiştiriyor; birim katalogda sabit, çünkü birimi değiştirmek satılan
// şeyi değiştirmek olurdu.
export const NEGOTIATED = [
  { key: 'gastroPackage', name: 'Gastro şef videosu paketi', unit: '/ ay',     price: 13200 },
  { key: 'secondChance',  name: 'İkinci Şans paketi',        unit: '/ paket',  price: 1450 },
  { key: 'instantDeals',  name: 'Anlık fırsat',              unit: '/ yayın',  price: 450 },
];

const NEG_BY_KEY = Object.fromEntries(NEGOTIATED.map(x => [x.key, x]));

/** Katalog varsayılanları; depoda yalnızca DEĞİŞTİRİLENLER duruyor. */
const DEFAULT_LIST = Object.fromEntries(NEGOTIATED.map(x => [x.key, x.price]));

const EMPTY = { offers: [], list: {} };

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
  snap = { raw, value: {
    offers: Array.isArray(stored?.offers) ? stored.offers : [],
    // Yalnızca yöneticinin elle değiştirdiği kalemler yazılıyor; gerisi
    // katalogdan geliyor. Tersi olsaydı katalog fiyatını güncellemek
    // hiçbir kurulumu etkilemezdi.
    list: (stored && typeof stored.list === 'object' && stored.list) ? stored.list : {},
  } };
  return snap.value;
}

function write(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* depolama kapalı */ }
  emit();
}

// ─── Liste fiyatları ─────────────────────────────────────────────────

/** Pazarlıklı bir kalemin yürürlükteki liste fiyatı. */
export function listPriceOf(streamKey, state = getPricing()) {
  const ozel = Number((state.list || {})[streamKey]);
  return Number.isFinite(ozel) && ozel > 0 ? ozel : (DEFAULT_LIST[streamKey] ?? 0);
}

/** Kalemin birim etiketi ("/ ay", "/ paket", "/ yayın"). */
export function listUnitOf(streamKey) {
  return NEG_BY_KEY[streamKey]?.unit || '';
}

/** Bu kalem pazarlıklı mı (liste fiyatı olan üçlüden mi). */
export function isNegotiated(streamKey) {
  return !!NEG_BY_KEY[streamKey];
}

/**
 * Liste fiyatını günceller.
 *
 * GÖNDERİLMİŞ TEKLİFLERE DOKUNMUYOR. Teklifteki tutar o an donmuş bir
 * sayı: liste fiyatını yükseltmek, işletmenin önünde duran teklifi
 * habersiz değiştirmek olurdu — kabul edeceği tutarla kabul ettiği tutar
 * farklı çıkardı. Yeni liste yalnızca bundan sonraki tekliflerin
 * başlangıç değeri.
 */
export function setListPrice(streamKey, value) {
  if (!NEG_BY_KEY[streamKey]) return;
  const n = Math.round(Number(value));
  const cur = getPricing();
  const list = { ...(cur.list || {}) };
  // Katalog değerine dönüldüyse kaydı silelim: "değiştirilmedi" ile
  // "aynı sayı yazıldı" aynı şey, iki hâl tutmaya gerek yok.
  if (!Number.isFinite(n) || n <= 0 || n === DEFAULT_LIST[streamKey]) delete list[streamKey];
  else list[streamKey] = n;
  write({ ...cur, list });
}

/** Liste fiyatı katalogdan sapmış kalem sayısı — panelde yazıyor. */
export function customListCount(state = getPricing()) {
  return Object.keys(state.list || {}).length;
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
