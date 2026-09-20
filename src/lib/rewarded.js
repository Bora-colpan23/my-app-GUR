// ═══════════════════════════════════════════════════════════════════════
// ÖDÜLLÜ VİDEO — hangi reklam gösterilecek
//
// Kaydırma hakkı biten kullanıcı bir video izleyip hak kazanıyor. Hangi
// videonun oynayacağına üç kural karar veriyor:
//
//   1. YAKINLIK — restoranın videosu yalnızca mekâna yakın kullanıcılara
//      gösterilir. Kadıköy'deki bir mekânın videosunu Beylikdüzü'ndeki
//      kullanıcıya izletmek iki tarafa da bir şey kazandırmıyor.
//   2. TEKRAR YOK — bir kullanıcı bir videoyu bir kez izler. İkinci kez
//      aynı videoyu açmak hem kullanıcıyı sıkıyor hem de restoranın
//      erişimini şişiriyordu: aynı kişi "iki kişi" gibi sayılırdı.
//   3. YEDEK — gösterilecek restoran videosu kalmadıysa Google reklamı
//      oynar. Kullanıcı hakkını kazanmaya devam eder; akış hiç tıkanmaz.
//
// İzlenenler KULLANICININ tarayıcısında (localStorage). Sunucu tarafında
// karşılığı kullanıcı×reklam gösterim tablosudur; kural aynı kalır.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { distanceMeters } from "../../shared/deeplink.js";
import { activeBookings } from "./adslots.js";
import { approvedMedia } from "./media.js";

const KEY = "gur.rewardedSeen";
const listeners = new Set();
let cache = null;

/**
 * "Yakın" sınırı. 15 km İstanbul'da bir yakayı kabaca kapsıyor: daha dar
 * bir sınır (5 km) demo havuzunda çoğu oturumda hiç aday bırakmıyordu,
 * daha genişi "yakınındakiler" demeyi anlamsız kılıyor.
 */
export const NEAR_METERS = 15000;

function read() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "[]") || []; }
  catch { cache = []; }
  return Array.isArray(cache) ? cache : (cache = []);
}
function write(next) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* yoksay */ }
  for (const l of listeners) l();
}
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function useRewardedSeen() {
  return useSyncExternalStore(subscribe, read, read);
}

export function hasWatched(adId, seen = read()) { return seen.includes(adId); }

/** İzlendi işareti. Aynı id iki kez yazılmıyor. */
export function markWatched(adId) {
  const seen = read();
  if (!adId || seen.includes(adId)) return;
  write([...seen, adId]);
}

/** Google reklamı — gösterilecek restoran videosu kalmadığında. */
export const GOOGLE_FALLBACK = {
  id: "google-adsense",
  source: "google",
  brand: "Google reklamı",
  tagline: "Sponsorlu içerik",
  headline: "Reklam alanı",
  cta: "Devam et",
  accent: "#4285F4",
};

/**
 * Bu oturumda oynatılacak reklamı seç.
 *
 * `restaurants` uygulamanın SÜZÜLMÜŞ listesi olmalı (gizlenenler çıkmış):
 * burada ikinci bir görünürlük kuralı yazmıyoruz.
 *
 * Dönen nesnede `source` alanı ne olduğunu söylüyor:
 *   "restaurant" → satın alınmış, o mekâna ait video
 *   "house"      → GUR'un kendi demo reklam havuzu
 *   "google"     → yedek
 */
export function pickRewardedAd({
  restaurants = [], origin = null, houseAds = [], houseIndex = 0,
  seen = read(), slots, media, day,
} = {}) {
  // ── 1. Yayındaki ödüllü video rezervasyonları ──
  const aktif = activeBookings("rewardedAds", day, slots);

  const adaylar = [];
  for (const b of aktif) {
    const r = restaurants.find(x => String(x.id) === String(b.restaurantId));
    if (!r) continue;                              // gizlenmiş ya da yayında değil

    // Videonun kendisi onaylı olmalı: rezervasyon yayını satın alır,
    // oynatılacak dosyayı onay kuyruğu belirler (bkz. lib/media.js).
    const video = approvedMedia(r.id, "ads", media)
      .find(f => String(f.type || "").startsWith("video/"))
      || approvedMedia(r.id, "ads", media)[0];
    if (!video) continue;

    // ── Yakınlık ──
    if (origin && r.lat != null && r.lng != null) {
      const m = distanceMeters(origin, { lat: r.lat, lng: r.lng });
      if (Number.isFinite(m) && m > NEAR_METERS) continue;
    }

    const id = `rw-${b.id}`;
    // ── Tekrar yok ──
    if (seen.includes(id)) continue;

    adaylar.push({
      id, source: "restaurant",
      bookingId: b.id, restaurantId: r.id,
      brand: r.name, tagline: r.cat,
      headline: r.desc || "Bu mekânı keşfet",
      cta: "Mekânı Gör", accent: "#FF6600",
      video: video.url, videoType: video.type,
      img: r.imgs?.[0] || null,
    });
  }
  if (adaylar.length) return adaylar[0];

  // ── 2. GUR'un kendi demo havuzu (izlenmemiş olanlar) ──
  const evde = houseAds.filter(a => !seen.includes(a.id));
  if (evde.length) return { ...evde[houseIndex % evde.length], source: "house" };

  // ── 3. Yedek ──
  // TODO(entegrasyon): gerçek AdSense/AdMob birimi buraya bağlanacak.
  // Yayın kimliği (publisher ID) tanımlanana kadar yer tutucu oynuyor;
  // akış bozulmuyor, kullanıcı hakkını yine kazanıyor.
  return GOOGLE_FALLBACK;
}
