// ═══════════════════════════════════════════════════════════════════════
// İKİNCİ ŞANS — haftalık yeniden gösterim paketi
//
// Önceden bu ücretsiz bir mekanikti: deste bitince geçilen mekanlar aynı
// oturumda tekrar önerilirdi. Artık iki ayrı şey var ve karıştırılmamalı:
//
//   • Oturum içi tekrar (ücretsiz, eskisi gibi) — deste bitti, geçtiklerine
//     bir daha bak. Kimseye para kazandırmıyor, kaldırılmadı.
//   • SATIN ALINAN PAKET (burası) — restoran parasını ödüyor ve kendisini
//     SOLA KAYDIRMIŞ kullanıcıların destesine geri giriyor. Farklı
//     kullanıcı, farklı gün, farklı oturum.
//
// KURALLAR (hepsi ürün kararı, kodda tek yerde):
//   • Restoran başına AYNI ANDA EN FAZLA 1 aktif paket. İki paket üst üste
//     alıp aynı kullanıcıya iki kat gösterim satın alınamaz.
//   • Paket 200 FARKLI kullanıcıya gösterimle biter — süreyle değil,
//     kotayla. Hafta dolsa da kota bitmediyse paket sürer; kota bitince
//     hafta dolmasa da biter.
//   • AYNI KULLANICIYA GÜNDE EN FAZLA 1 kez. Aynı kart aynı gün iki kez
//     çıkarsa kullanıcı bunu reklam olarak okur ve deste güvenilirliğini
//     kaybeder.
//   • Yalnızca o restoranı SOLA KAYDIRMIŞ kullanıcı hedeflenir. Hiç
//     görmemiş kullanıcıya "ikinci şans" diye bir şey yok — o zaten
//     organik akışta görecek.
//
// Sunucudaki karşılığı: `second_chance_packages` + `second_chance_impressions`
// (bkz. migration 004). Buradaki depo YEREL modun karşılığı; kurallar iki
// tarafta da aynı olsun diye saf fonksiyonlar `shared/second-chance.js`de.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { PACKAGE, canActivate, isExhausted, alreadyShownToday } from "../../shared/second-chance.js";

export { PACKAGE };

const KEY = "gur.secondChance";
const listeners = new Set();
let cache = null;

const bos = () => ({ packages: [], impressions: {} });

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

export function useSecondChance() {
  return useSyncExternalStore(subscribe, read, read);
}

export function packages(state = read()) { return state.packages; }

export function activeFor(restaurantId, state = read()) {
  return state.packages.find(p =>
    String(p.restaurantId) === String(restaurantId) && p.status === "active") || null;
}

/**
 * Paket satın alma. Aktif paketi olan restoran ikincisini alamaz —
 * çağıran taraf `canActivate` ile sorup düğmeyi kapatıyor ama kural
 * burada da var: arayüzde engellemek kapı sayılmaz.
 */
export function activate({ restaurantId, restaurantName, priceMinor = PACKAGE.priceMinor }) {
  const s = read();
  if (!canActivate(s.packages, restaurantId)) return null;
  const p = {
    id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    restaurantId, restaurantName,
    status: "active",
    priceMinor,
    quota: PACKAGE.reach,
    used: 0,
    startedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + PACKAGE.weekMs).toISOString(),
  };
  write({ ...s, packages: [p, ...s.packages] });
  return p;
}

export function cancel(packageId) {
  const s = read();
  write({ ...s, packages: s.packages.map(p =>
    p.id === packageId ? { ...p, status: "cancelled", endedAt: new Date().toISOString() } : p) });
}

/**
 * Bu kullanıcının destesine geri eklenecek mekan kimlikleri.
 *
 * `passedIds` kullanıcının SOLA kaydırdıkları. Kesişim alınıyor: paket
 * aktif olsa bile kullanıcı o mekanı hiç geçmemişse hedefte değil.
 */
export function candidatesFor(passedIds = [], userKey = "demo", state = read()) {
  const bugun = new Date().toISOString().slice(0, 10);
  const gecti = new Set(passedIds.map(String));
  return state.packages
    .filter(p => p.status === "active"
      && gecti.has(String(p.restaurantId))
      && !isExhausted(p)
      && !alreadyShownToday(state.impressions, p.id, userKey, bugun))
    .map(p => String(p.restaurantId));
}

/**
 * Gösterim sayacı. Aynı kullanıcı aynı gün ikinci kez sayılmaz; kota
 * "200 FARKLI kullanıcı" demek, "200 gösterim" değil.
 */
export function recordImpression(restaurantId, userKey = "demo") {
  const s = read();
  const p = activeFor(restaurantId, s);
  if (!p) return null;
  const bugun = new Date().toISOString().slice(0, 10);
  const anahtar = `${p.id}|${userKey}`;
  const gecmis = s.impressions[anahtar];
  if (gecmis?.gun === bugun) return p;             // aynı gün, tekrar sayma

  const yeniKullanici = !gecmis;                    // ilk kez bu kullanıcı
  const used = p.used + (yeniKullanici ? 1 : 0);
  const bitti = used >= p.quota;
  write({
    ...s,
    impressions: { ...s.impressions, [anahtar]: { gun: bugun, kez: (gecmis?.kez || 0) + 1 } },
    packages: s.packages.map(x => x.id === p.id
      ? { ...x, used, status: bitti ? "completed" : "active", endedAt: bitti ? new Date().toISOString() : x.endedAt }
      : x),
  });
  return { ...p, used };
}

// ─── Kullanıcının geçtikleri ────────────────────────────────────────────
//
// Oturum state'i yetmez: paket başka bir GÜN, başka bir oturumda
// gösterilecek. "Bu kullanıcı bu mekanı geçmiş miydi" sorusunun cevabı
// oturumlar arasında yaşamalı.
//
// Yalnızca kimlikler tutuluyor, kaydın kendisi değil: mekan verisi
// beslemeden tazeleniyor, burada kopyasını tutmak eskimiş isim/adres
// gösterirdi.
const PASSED_KEY = "gur.passed";

export function passedIds() {
  try { return JSON.parse(localStorage.getItem(PASSED_KEY) || "[]"); }
  catch { return []; }
}

export function recordPass(restaurantId) {
  const cur = passedIds();
  const id = String(restaurantId);
  if (cur.includes(id)) return cur;
  const next = [...cur, id].slice(-500);   // sınırsız büyümesin
  try { localStorage.setItem(PASSED_KEY, JSON.stringify(next)); } catch { /* yoksay */ }
  return next;
}

/** Panelde ilerleme çubuğu: kaç kullanıcıya ulaşıldı. */
export function progress(p) {
  if (!p) return 0;
  return Math.min(1, p.used / (p.quota || PACKAGE.reach));
}
