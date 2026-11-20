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
import { isServiceOpen } from "./platform.js";

const KEY = "gur.adslots";
const listeners = new Set();
let cache = null;
let cacheRaw = null;

/**
 * Üç ürün, tek fiyat birimi: GÜN.
 *
 * Fiyat günlük, süreyi işletme seçiyor (1–`maxDays`). Önceden her ürünün
 * süresi sabitti (banner 7 gün / hafta fiyatı, video 30 gün / ay fiyatı,
 * push tek gönderim) ve üç ayrı birim üç ayrı kafa karışıklığı demekti:
 * "ayda 1 kez alınır ama 30 gün kalır" cümlesi kotayla süreyi aynı yere
 * yazıyordu. Tek birim, tek çarpma: `günlük fiyat × seçilen gün`.
 *
 * `dailyPrice` — bir günün listedeki bedeli (yönetici günceller).
 * `maxDays`    — en fazla kaç gün seçilebilir. Üçünde de 7.
 * `limit`      — AYNI RESTORANIN ne sıklıkla alabileceği.
 * `exclusive`  — o gün aralığında yalnızca tek restoran olabilir mi.
 *
 * YALNIZCA BANNER exclusive. Keşfet karuselindeki slayt tek bir yerleşim;
 * aynı günü iki restorana satmak satılan şeyi ikiye bölerdi. Takvimin
 * doluluk göstermesi de buradan anlam kazanıyor.
 *
 * Ödüllü video ve push exclusive DEĞİL — ikisi de HAVUZ:
 *   • Ödüllü videoda aynı anda birden çok restoranın videosu yayında
 *     olabilir; hangisinin oynayacağına yakınlık ve "bu kullanıcı izledi mi"
 *     karar veriyor (bkz. lib/rewarded.js). Exclusive yapılsaydı uygulanacak
 *     ikinci bir aday hiç olmazdı.
 *   • Push bildirimi kişiye gidiyor, bir ekran yerleşimi değil.
 *
 * PUSH'TA BİR GÜN = BİR GÖNDERİM. Üç günlük bir push rezervasyonu üç
 * gönderim demek, o yüzden haftalık sınır GÜN sayısı üzerinden işliyor
 * (`weekDays: 3`): 7 gün seçilebilir ama haftada en fazla 3 gün dolar.
 */
export const AD_PRODUCTS = {
  bannerAds: {
    name: "Keşfet Banner'ı",
    unit: "gün",
    // ₺2.400/hafta idi → 2400/7 ≈ 343, yuvarlandı.
    dailyPrice: 350,
    maxDays: 7,
    exclusive: true,
    limit: { month: 1 },
    rule: "Ayda 1 kez, en fazla 7 gün.",
  },
  rewardedAds: {
    name: "Ödüllü Video Reklam",
    unit: "gün",
    // ₺3.100/ay idi → 3100/30 ≈ 103, yuvarlandı.
    dailyPrice: 105,
    maxDays: 7,
    exclusive: false,
    limit: { month: 1 },
    rule: "Ayda 1 kez, en fazla 7 gün. Yakındaki kullanıcılara gösterilir; videoyu izleyen aynı videoyu bir daha görmez.",
  },
  pushAds: {
    name: "Push Bildirim Reklamı",
    unit: "gün",
    // ₺1.800/gönderim idi; bir gün = bir gönderim, yani aynı rakam.
    dailyPrice: 1800,
    maxDays: 7,
    exclusive: false,
    limit: { weekDays: 3 },
    rule: "Bir gün = bir gönderim. Haftada en fazla 3 gün.",
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

/** Seçilen gün sayısını ürünün sınırına kelepçeler. */
export function clampDays(streamKey, days) {
  const p = AD_PRODUCTS[streamKey];
  const n = Math.round(Number(days) || 1);
  if (!p) return Math.max(1, n);
  return Math.min(p.maxDays, Math.max(1, n));
}

/** Başlangıçtan itibaren kaplanan gün listesi. */
export function rangeOf(streamKey, startISO, days) {
  const n = clampDays(streamKey, days);
  return Array.from({ length: n }, (_, i) => addDays(startISO, i));
}

/** Kapanış günü (dahil) — arayüzde "3 Eki – 9 Eki" yazmak için. */
export function endOf(streamKey, startISO, days) {
  return addDays(startISO, clampDays(streamKey, days) - 1);
}

/** Toplam bedel: günlük fiyat × gün. Tek çarpma, tek yerde. */
export function totalPrice(streamKey, days, state) {
  return priceOf(streamKey, state) * clampDays(streamKey, days);
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

/** İki gün arasındaki fark (gün). Eski kayıtların süresini türetmek için. */
export function gunFarki(aISO, bISO) {
  const [y1, m1, d1] = aISO.split("-").map(Number);
  const [y2, m2, d2] = bISO.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}

/** İki aralık kesişiyor mu (ikisi de kapanış günü DAHİL). */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

// ─── Depo ────────────────────────────────────────────────────────────────

// Depo sürümü. Fiyat birimi HAFTA/AY/GÖNDERİM iken GÜN'e çevrildi; eski
// `prices` kaydındaki 2400 artık "günlük 2400" diye okunurdu ve haftalık
// bir banner yedi katına çıkardı. Sürüm uyuşmazsa kaydedilmiş fiyatlar
// atılıyor, rezervasyonlar korunuyor (bedelleri zaten donmuş durumda).
const SURUM = 2;

const bos = () => ({ v: SURUM, prices: {}, bookings: [] });

// Anlık görüntü HAM METNE göre önbellekleniyor. Önceden `if (cache) return
// cache` vardı ve önbellek yalnızca kendi write()'imizle tazeleniyordu:
// yönetici BAŞKA BİR SEKMEDE tarihi onayladığında işletme sekmesi bunu hiç
// görmüyordu. Görsel yükleme alanı tam da bu onaya bakıyor — bayat önbellek
// akışın kapısını kapalı bırakıyordu.
//
// Referans ham metin değişmediği sürece SABİT kalmalı, yoksa
// useSyncExternalStore sonsuz döner.
function read() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return cache || (cache = bos()); }
  if (cache && cacheRaw === raw) return cache;
  let v = null;
  try { v = JSON.parse(raw || "null"); } catch { v = null; }
  if (v && typeof v === "object") {
    cache = v.v === SURUM
      ? { ...bos(), ...v }
      : { ...bos(), bookings: Array.isArray(v.bookings) ? v.bookings : [] };
  } else cache = bos();
  cacheRaw = raw;
  return cache;
}
function write(next) {
  const sonraki = { ...next, v: SURUM };
  let metin = null;
  try { metin = JSON.stringify(sonraki); } catch { metin = null; }
  try { localStorage.setItem(KEY, metin); } catch { /* yoksay */ }
  cache = sonraki; cacheRaw = metin;
  for (const l of listeners) l();
  try { window.dispatchEvent(new Event("gur:adslots")); } catch { /* SSR */ }
}
function subscribe(fn) {
  listeners.add(fn);
  const disaridan = () => fn();
  window.addEventListener("storage", disaridan);      // başka sekme
  window.addEventListener("gur:adslots", disaridan);  // aynı sekme, diğer rota
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", disaridan);
    window.removeEventListener("gur:adslots", disaridan);
  };
}

export function useAdSlots() {
  return useSyncExternalStore(subscribe, read, read);
}

// ─── Fiyat ───────────────────────────────────────────────────────────────

/** Yürürlükteki GÜNLÜK fiyat: yönetici değiştirdiyse o, yoksa katalog. */
export function priceOf(streamKey, state = read()) {
  const ozel = state.prices?.[streamKey];
  return Number.isFinite(ozel) ? ozel : (AD_PRODUCTS[streamKey]?.dailyPrice ?? 0);
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

/**
 * Bir restoranın bu yerleşimdeki YAYINLARI, duruma göre.
 *
 * Reklam materyali yükleme alanı buna bakıyor: tarih onaylanmadan görsel
 * istemek, teslim edilecek bir yeri olmayan dosyayı onay kuyruğuna
 * sokmak olurdu. Akış tek yönlü — tarih seç → yönetici onaylasın →
 * görseli yükle → görsel onaylansın → yayına gir.
 *
 * GEÇMİŞ YAYINLAR SAYILMIYOR (`end >= bugün`): geçen ayki bir rezervasyon
 * yükleme alanını sonsuza kadar açık tutardı ve işletme hiçbir yere
 * gitmeyecek dosya yüklerdi.
 */
export function slotsOf(restaurantId, streamKey, state = read()) {
  const bugun = today();
  const hepsi = allBookings(state).filter(b =>
    String(b.restaurantId) === String(restaurantId) &&
    b.streamKey === streamKey &&
    b.end >= bugun);
  const sirala = (a, b) => (a.start < b.start ? -1 : 1);
  return {
    approved: hepsi.filter(b => b.status === "approved").sort(sirala),
    pending: hepsi.filter(b => b.status === "pending").sort(sirala),
  };
}

/** Görsel yükleme kapısı: onaylanmış, süresi geçmemiş bir yayın var mı. */
export function hasApprovedSlot(restaurantId, streamKey, state = read()) {
  return slotsOf(restaurantId, streamKey, state).approved.length > 0;
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
export function canBook(streamKey, restaurantId, startISO, days = 1, state = read()) {
  const p = AD_PRODUCTS[streamKey];
  if (!p) return { ok: false, reason: "Bilinmeyen reklam kalemi." };
  // Satış kapısı en başta: kapalı bir kalemde tarih, kota ve doluluk
  // kontrolü yapmanın anlamı yok. Kapı arayüzde de var ama tek karar
  // noktası burası (bkz. "Kota ve doluluk tek karar noktasında").
  if (!isServiceOpen(streamKey, undefined, restaurantId)) {
    return { ok: false, reason: "Bu kalem şu an satışa kapalı." };
  }
  if (!startISO) return { ok: false, reason: "Başlangıç tarihi seçilmedi." };
  if (startISO < today()) return { ok: false, reason: "Geçmiş bir tarih seçilemez." };

  const n = clampDays(streamKey, days);
  if (Number(days) > p.maxDays) {
    return { ok: false, reason: `En fazla ${p.maxDays} gün seçilebilir.` };
  }

  const start = startISO;
  const end = endOf(streamKey, startISO, n);
  const gunler = rangeOf(streamKey, startISO, n);
  const kendi = bookingsFor(streamKey, state)
    .filter(b => TUTAN.has(b.status) && String(b.restaurantId) === String(restaurantId));

  // ── Aynı restoran kendi aralığıyla çakışamaz ──
  // Ürün havuz olsa bile bir restoranın aynı günü iki kez alması anlamsız:
  // ikinci kayıt aynı yayını ikinci kez faturalardı.
  const kendiCakisan = kendi.find(b => overlaps(start, end, b.start, b.end));
  if (kendiCakisan) {
    return { ok: false, reason: `${prettyDay(kendiCakisan.start)} – ${prettyDay(kendiCakisan.end)} aralığında zaten kaydınız var.` };
  }

  // ── Aylık sıklık (banner, ödüllü video) ──
  if (p.limit.month != null) {
    const ay = monthKey(startISO);
    const adet = kendi.filter(b => monthKey(b.start) === ay).length;
    if (adet >= p.limit.month) {
      return { ok: false, reason: `Bu kalem ayda ${p.limit.month} kez alınabilir. ${ay} için zaten bir kaydınız var.` };
    }
  }

  // ── Haftalık GÜN sınırı (push) ──
  // Gün sayısı üzerinden çünkü push'ta bir gün bir gönderim: üç günlük bir
  // rezervasyon üç gönderim demek. Rezervasyon SAYISINI saymak, tek kayıtla
  // yedi gönderim almanın önünü açardı.
  if (p.limit.weekDays != null) {
    const haftaya = {};
    for (const g of gunler) haftaya[weekKey(g)] = (haftaya[weekKey(g)] || 0) + 1;
    for (const b of kendi) {
      for (const g of rangeOf(streamKey, b.start, gunFarki(b.start, b.end) + 1)) {
        const h = weekKey(g);
        if (h in haftaya) haftaya[h] += 1;
      }
    }
    for (const [h, adet] of Object.entries(haftaya)) {
      if (adet > p.limit.weekDays) {
        return { ok: false, reason: `Haftada en fazla ${p.limit.weekDays} gün alınabilir (${prettyDay(h)} haftası doldu).` };
      }
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
          ? `${prettyDay(cakisan.start)} – ${prettyDay(cakisan.end)} aralığı dolu.`
          : `${prettyDay(cakisan.start)} – ${prettyDay(cakisan.end)} aralığı başka bir talep için tutuluyor.`,
      };
    }
  }

  return { ok: true, start, end, days: n };
}

/** İşletmenin talebi. Her zaman `pending` doğar — onay kapısı burada. */
export function requestBooking({ streamKey, restaurantId, restaurantName, start, days = 1, note = "" }) {
  const state = read();
  const kontrol = canBook(streamKey, restaurantId, start, days, state);
  if (!kontrol.ok) throw new Error(kontrol.reason);
  const gunluk = priceOf(streamKey, state);
  const kayit = {
    id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    streamKey, restaurantId, restaurantName,
    start: kontrol.start, end: kontrol.end, days: kontrol.days,
    // Fiyat REZERVASYON ANINDA donuyor; sonradan liste fiyatı değişse de
    // bu yayının bedeli değişmez. Günlüğü de saklıyoruz ki "kaç günden
    // kaça" sorusu sonradan cevaplanabilsin.
    dailyMinor: gunluk,
    priceMinor: gunluk * kontrol.days,
    status: "pending", reason: null, note,
    by: "owner",
    at: new Date().toISOString(), decidedAt: null,
  };
  write({ ...state, bookings: [kayit, ...allBookings(state)] });
  return kayit;
}

/** Yöneticinin doğrudan yerleştirmesi — talep turu olmadan onaylı doğar. */
export function adminBook({ streamKey, restaurantId, restaurantName, start, days = 1, note = "" }) {
  const state = read();
  const kontrol = canBook(streamKey, restaurantId, start, days, state);
  if (!kontrol.ok) throw new Error(kontrol.reason);
  const gunluk = priceOf(streamKey, state);
  const kayit = {
    id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    streamKey, restaurantId, restaurantName,
    start: kontrol.start, end: kontrol.end, days: kontrol.days,
    dailyMinor: gunluk,
    priceMinor: gunluk * kontrol.days,
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
