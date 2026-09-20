// ═══════════════════════════════════════════════════════════════════════
// REKLAM SLOTLARI — sabit fiyat + takvimden tarih rezervasyonu
//
// Banner, ödüllü video ve push için PAZARLIK YOK: fiyat sabit ve listede
// yazıyor. Diğer kalemler (Gastro paketi, İkinci Şans, anlık fırsat) hâlâ
// teklif akışından geçiyor (src/lib/requests.js) — bu üçü reklam envanteri
// ve envanterin fiyatı müşteriye göre değişmiyor.
//
// AMA SATIN ALMA HÂLÂ SERBEST DEĞİL. İşletme takvimden müsait tarihi
// seçiyor, talep yöneticiye düşüyor, yönetici onaylayınca slot kilitleniyor
// ve yayına giriyor. "Restoran kendi kendine bir şey satın alamaz" kuralı
// duruyor; kalkan şey pazarlık, onay değil.
//
//   işletme takvimden tarih seçer (pending — slot geçici tutulur)
//        → yönetici onaylar (approved — slot kilitlenir, yayına girer)
//        → yönetici reddeder (rejected — slot serbest kalır)
//
// Yönetici takvime KENDİSİ de yerleştirebiliyor (doğrudan `approved`):
// telefonda anlaşılan bir yayını işletmeye talep açtırmak boş bir tur olurdu.
//
// KOTA KURALLARI ürün başına ve burada tek yerde. Arayüzde tekrarlansaydı
// işletme paneli "alabilirsin" derken yönetici paneli reddedebilirdi.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

const KEY = "gur.adslots";
const listeners = new Set();
let cache = null;

/**
 * Üç ürün, üç ayrı kural.
 *
 * `days`  — onaylanınca takvimde kaç gün dolduğu.
 * `limit` — AYNI RESTORANIN ne sıklıkla alabileceği.
 * `exclusive` — o gün aralığında yalnızca tek restoran olabilir mi.
 *
 * YALNIZCA BANNER exclusive. Keşfet karuselindeki slayt tek bir yerleşim;
 * aynı haftayı iki restorana satmak satılan şeyi ikiye bölerdi. Takvimin
 * doluluk göstermesi de buradan anlam kazanıyor.
 *
 * Ödüllü video ve push exclusive DEĞİL — ikisi de HAVUZ:
 *   • Ödüllü videoda aynı anda birden çok restoranın videosu yayında
 *     olabilir; hangisinin oynayacağına yakınlık ve "bu kullanıcı izledi mi"
 *     karar veriyor (bkz. lib/rewarded.js). Exclusive yapılsaydı 30 günlük
 *     süre yüzünden ayda PLATFORMDA tek restoran yayınlayabilirdi ve
 *     yakınlık/tekrar kuralları uygulanacak ikinci bir aday hiç olmazdı.
 *   • Push bildirimi kişiye gidiyor, bir ekran yerleşimi değil.
 * İkisinde de sınır restoran başına: ayda 1 / günde 1 ve haftada 3.
 */
export const AD_PRODUCTS = {
  bannerAds: {
    name: "Keşfet Banner'ı",
    unit: "hafta",
    defaultPrice: 2400,
    days: 7,
    exclusive: true,
    limit: { month: 1 },
    rule: "Ayda 1 kez alınır, 7 gün yayında kalır.",
  },
  rewardedAds: {
    name: "Ödüllü Video Reklam",
    unit: "ay",
    defaultPrice: 3100,
    days: 30,
    exclusive: false,
    limit: { month: 1 },
    rule: "Ayda 1 kez alınır, 30 gün yayında kalır. Yakındaki kullanıcılara gösterilir; videoyu izleyen aynı videoyu bir daha görmez.",
  },
  pushAds: {
    name: "Push Bildirim Reklamı",
    unit: "gönderim",
    defaultPrice: 1800,
    days: 1,
    exclusive: false,
    limit: { day: 1, week: 3 },
    rule: "Günde en fazla 1, haftada en fazla 3 gönderim.",
  },
};

export const AD_KEYS = Object.keys(AD_PRODUCTS);

/** Bu kalem sabit fiyatlı mı — teklif akışı mı takvim akışı mı. */
export function isFixedPrice(streamKey) {
  return Object.prototype.hasOwnProperty.call(AD_PRODUCTS, streamKey);
}

// ─── Tarih yardımcıları ──────────────────────────────────────────────────
// Hepsi YEREL "YYYY-MM-DD" üzerinde çalışıyor. UTC'ye çevirmek İstanbul'da
// gece yarısına yakın saatlerde günü bir kaydırıyordu: kullanıcı 1 Ekim'i
// seçip takvimde 30 Eylül'ün dolduğunu görüyordu.

export function toDay(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear(), m = String(x.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-${String(x.getDate()).padStart(2, "0")}`;
}
export function today() { return toDay(new Date()); }

export function addDays(dayISO, n) {
  const [y, m, d] = dayISO.split("-").map(Number);
  const x = new Date(y, m - 1, d);
  x.setDate(x.getDate() + n);
  return toDay(x);
}

/** Başlangıçtan itibaren ürünün kapladığı gün listesi. */
export function rangeOf(streamKey, startISO) {
  const p = AD_PRODUCTS[streamKey];
  if (!p) return [];
  return Array.from({ length: p.days }, (_, i) => addDays(startISO, i));
}

/** Kapanış günü (dahil) — arayüzde "3 Eki – 9 Eki" yazmak için. */
export function endOf(streamKey, startISO) {
  const p = AD_PRODUCTS[streamKey];
  return p ? addDays(startISO, p.days - 1) : startISO;
}

export function monthKey(dayISO) { return dayISO.slice(0, 7); }

/** ISO hafta anahtarı (pazartesi başlangıçlı). Haftalık kotanın temeli. */
export function weekKey(dayISO) {
  const [y, m, d] = dayISO.split("-").map(Number);
  const x = new Date(y, m - 1, d);
  // Pazar 0 geliyor; pazartesi başlangıcı için 7'ye çeviriyoruz.
  const gun = x.getDay() || 7;
  x.setDate(x.getDate() - gun + 1);
  return toDay(x);
}

/** İki aralık kesişiyor mu (ikisi de kapanış günü DAHİL). */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

// ─── Depo ────────────────────────────────────────────────────────────────

const bos = () => ({ prices: {}, bookings: [] });

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

export function useAdSlots() {
  return useSyncExternalStore(subscribe, read, read);
}

// ─── Fiyat ───────────────────────────────────────────────────────────────

/** Yürürlükteki fiyat: yönetici değiştirdiyse o, yoksa katalog varsayılanı. */
export function priceOf(streamKey, state = read()) {
  const ozel = state.prices?.[streamKey];
  return Number.isFinite(ozel) ? ozel : (AD_PRODUCTS[streamKey]?.defaultPrice ?? 0);
}

/**
 * Fiyatı güncelle. GEÇMİŞ REZERVASYONLARI ETKİLEMEZ: her rezervasyon
 * kendi `priceMinor` alanını taşıyor ve o an geçerli olan fiyattan
 * donduruluyor. Yoksa fiyatı yükseltmek, aylar önce onaylanmış bir yayının
 * bedelini geriye dönük değiştirirdi.
 */
export function setPrice(streamKey, value) {
  if (!AD_PRODUCTS[streamKey]) return;
  const n = Math.max(0, Math.round(Number(value) || 0));
  const s = read();
  write({ ...s, prices: { ...s.prices, [streamKey]: n } });
}

export function resetPrice(streamKey) {
  const s = read();
  const p = { ...s.prices };
  delete p[streamKey];
  write({ ...s, prices: p });
}

// ─── Rezervasyonlar ──────────────────────────────────────────────────────

/** Yer tutan kayıtlar: bekleyen de sayılır, yoksa iki işletme aynı slotu
 *  aynı anda talep eder ve biri boşuna bekler. */
const TUTAN = new Set(["pending", "approved"]);

export function allBookings(state = read()) { return state.bookings || []; }

export function bookingsFor(streamKey, state = read()) {
  return allBookings(state).filter(b => b.streamKey === streamKey);
}

export function bookingsOfRestaurant(restaurantId, state = read()) {
  return allBookings(state)
    .filter(b => String(b.restaurantId) === String(restaurantId))
    .sort((a, b) => (a.start < b.start ? 1 : -1));
}

export function pendingBookings(state = read()) {
  return allBookings(state).filter(b => b.status === "pending")
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

export function pendingBookingCount(state = read()) { return pendingBookings(state).length; }

/** Takvim hücresi: o gün bu üründe ne var. */
export function dayState(streamKey, dayISO, state = read()) {
  const tutanlar = bookingsFor(streamKey, state)
    .filter(b => TUTAN.has(b.status) && dayISO >= b.start && dayISO <= b.end);
  if (!tutanlar.length) return { status: "free", bookings: [] };
  // Onaylı varsa hücre "dolu"; yalnız bekleyen varsa "tutuluyor".
  const onayli = tutanlar.find(b => b.status === "approved");
  return { status: onayli ? "approved" : "pending", bookings: tutanlar };
}

/** Yayında mı — tüketici tarafı bunu soruyor. */
export function activeBookings(streamKey, dayISO = today(), state = read()) {
  return bookingsFor(streamKey, state)
    .filter(b => b.status === "approved" && dayISO >= b.start && dayISO <= b.end);
}

/**
 * Bu restoran bu ürünü bu tarihten başlatabilir mi.
 *
 * Tek karar noktası: hem işletme paneli hem yönetici paneli hem de yazma
 * yolu (`requestBooking`) buradan geçiyor. Kural arayüzde tekrarlansaydı
 * işletmeye "alabilirsin" deyip yönetici tarafında reddedilirdi.
 */
export function canBook(streamKey, restaurantId, startISO, state = read()) {
  const p = AD_PRODUCTS[streamKey];
  if (!p) return { ok: false, reason: "Bilinmeyen reklam kalemi." };
  if (!startISO) return { ok: false, reason: "Başlangıç tarihi seçilmedi." };
  if (startISO < today()) return { ok: false, reason: "Geçmiş bir tarih seçilemez." };

  const start = startISO;
  const end = endOf(streamKey, startISO);
  const kendi = bookingsFor(streamKey, state)
    .filter(b => TUTAN.has(b.status) && String(b.restaurantId) === String(restaurantId));

  // ── Restoran başına sıklık ──
  if (p.limit.month != null) {
    const ay = monthKey(startISO);
    const n = kendi.filter(b => monthKey(b.start) === ay).length;
    if (n >= p.limit.month) {
      return { ok: false, reason: `Bu kalem ayda ${p.limit.month} kez alınabilir. ${ay} için zaten bir kaydınız var.` };
    }
  }
  if (p.limit.day != null) {
    const n = kendi.filter(b => b.start === startISO).length;
    if (n >= p.limit.day) {
      return { ok: false, reason: `Aynı gün en fazla ${p.limit.day} gönderim alınabilir.` };
    }
  }
  if (p.limit.week != null) {
    const h = weekKey(startISO);
    const n = kendi.filter(b => weekKey(b.start) === h).length;
    if (n >= p.limit.week) {
      return { ok: false, reason: `Haftada en fazla ${p.limit.week} gönderim alınabilir. Bu hafta doldu.` };
    }
  }

  // ── Envanter doluluğu (yalnız tek yerleşimli ürünlerde) ──
  if (p.exclusive) {
    const cakisan = bookingsFor(streamKey, state)
      .find(b => TUTAN.has(b.status) && overlaps(start, end, b.start, b.end));
    if (cakisan) {
      return {
        ok: false,
        reason: cakisan.status === "approved"
          ? `${cakisan.start} – ${cakisan.end} aralığı dolu.`
          : `${cakisan.start} – ${cakisan.end} aralığı başka bir talep için tutuluyor.`,
      };
    }
  }

  return { ok: true, start, end };
}

/** İşletmenin talebi. Her zaman `pending` doğar — onay kapısı burada. */
export function requestBooking({ streamKey, restaurantId, restaurantName, start, note = "" }) {
  const state = read();
  const kontrol = canBook(streamKey, restaurantId, start, state);
  if (!kontrol.ok) throw new Error(kontrol.reason);
  const kayit = {
    id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    streamKey, restaurantId, restaurantName,
    start: kontrol.start, end: kontrol.end,
    // Fiyat REZERVASYON ANINDA donuyor; sonradan liste fiyatı değişse de
    // bu yayının bedeli değişmez.
    priceMinor: priceOf(streamKey, state),
    status: "pending", reason: null, note,
    by: "owner",
    at: new Date().toISOString(), decidedAt: null,
  };
  write({ ...state, bookings: [kayit, ...allBookings(state)] });
  return kayit;
}

/** Yöneticinin doğrudan yerleştirmesi — talep turu olmadan onaylı doğar. */
export function adminBook({ streamKey, restaurantId, restaurantName, start, note = "" }) {
  const state = read();
  const kontrol = canBook(streamKey, restaurantId, start, state);
  if (!kontrol.ok) throw new Error(kontrol.reason);
  const kayit = {
    id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    streamKey, restaurantId, restaurantName,
    start: kontrol.start, end: kontrol.end,
    priceMinor: priceOf(streamKey, state),
    status: "approved", reason: null, note,
    by: "admin",
    at: new Date().toISOString(), decidedAt: new Date().toISOString(),
  };
  write({ ...state, bookings: [kayit, ...allBookings(state)] });
  return kayit;
}

export function decideBooking(id, status, reason = null) {
  const state = read();
  write({ ...state, bookings: allBookings(state).map(b => b.id === id
    ? { ...b, status, reason, decidedAt: new Date().toISOString() }
    : b) });
}

/** İşletme kendi talebini geri çeker — slot anında serbest kalır. */
export function cancelBooking(id) {
  const state = read();
  write({ ...state, bookings: allBookings(state).map(b => b.id === id
    ? { ...b, status: "cancelled", decidedAt: new Date().toISOString() }
    : b) });
}

// ─── Takvim ızgarası ─────────────────────────────────────────────────────

/**
 * Bir ayın hücreleri, pazartesi başlangıçlı. Baştaki boşluklar `null`.
 * Hem işletme hem yönetici aynı ızgarayı çiziyor: iki ayrı takvim kodu
 * iki ayrı "hangi gün dolu" cevabı üretirdi.
 */
export function monthGrid(year, month /* 0-11 */) {
  const ilk = new Date(year, month, 1);
  const bosluk = (ilk.getDay() || 7) - 1;
  const gunSayisi = new Date(year, month + 1, 0).getDate();
  const hucreler = Array(bosluk).fill(null);
  for (let d = 1; d <= gunSayisi; d++) hucreler.push(toDay(new Date(year, month, d)));
  while (hucreler.length % 7) hucreler.push(null);
  return hucreler;
}

export const WEEKDAYS_TR = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
export const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "3 Eki 2026" — arayüzde tarih aralığı yazmak için. */
export function prettyDay(dayISO) {
  if (!dayISO) return "";
  const [y, m, d] = dayISO.split("-").map(Number);
  return `${d} ${MONTHS_TR[m - 1].slice(0, 3)} ${y}`;
}
