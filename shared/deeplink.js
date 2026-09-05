// ═══════════════════════════════════════════════════════════════════════
// Harita derin bağlantıları — istemci ve sunucu aynı modülü kullanır.
//
// Sunucu tarafı bildirim gövdesine bağlantı gömerken, istemci "Yol tarifi"
// düğmesinde aynı üreticiyi çağırır; iki yerde ayrı format tutmak, birinin
// sessizce bozulması demek.
//
// Saf fonksiyonlar: DOM veya Node API'si kullanmaz.
// ═══════════════════════════════════════════════════════════════════════

/** Koordinat geçerli mi — 0,0 (Null Island) da hata sayılır. */
export function hasCoords(place) {
  const { lat, lng } = place || {};
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function coordPair(place) {
  // 6 basamak ≈ 11 cm; daha fazlası URL'i şişirir, daha azı kapıyı kaçırır.
  return `${Number(place.lat).toFixed(6)},${Number(place.lng).toFixed(6)}`;
}

function label(place) {
  return encodeURIComponent([place.name, place.address].filter(Boolean).join(", "));
}

/**
 * Sağlayıcıya göre yol tarifi bağlantısı.
 * mode: "driving" | "walking" | "transit"
 */
export function directionsUrl(place, provider = "google", mode = "driving") {
  if (!hasCoords(place)) {
    // Koordinat yoksa isimle arama — yanlış pin açmaktansa arama sonucu.
    const q = label(place);
    if (provider === "apple") return `https://maps.apple.com/?q=${q}`;
    if (provider === "yandex") return `https://yandex.com.tr/harita/?text=${q}`;
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  const dest = coordPair(place);

  if (provider === "apple") {
    // dirflg: d=araç, w=yürüyüş, r=toplu taşıma
    const flag = mode === "walking" ? "w" : mode === "transit" ? "r" : "d";
    return `https://maps.apple.com/?daddr=${dest}&q=${label(place)}&dirflg=${flag}`;
  }

  if (provider === "yandex") {
    // rtext=başlangıç~hedef; başlangıç boş bırakılınca cihaz konumu kullanılır
    const rtt = mode === "walking" ? "pd" : mode === "transit" ? "mt" : "auto";
    return `https://yandex.com.tr/harita/?rtext=~${dest}&rtt=${rtt}&z=16`;
  }

  const travel = mode === "transit" ? "transit" : mode === "walking" ? "walking" : "driving";
  const placeId = place.googlePlaceId ? `&destination_place_id=${encodeURIComponent(place.googlePlaceId)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${placeId}&travelmode=${travel}`;
}

/** Yol tarifi değil, mekânı haritada gösteren bağlantı. */
export function placeUrl(place, provider = "google") {
  if (!hasCoords(place)) return directionsUrl(place, provider);
  const at = coordPair(place);
  if (provider === "apple")  return `https://maps.apple.com/?ll=${at}&q=${label(place)}`;
  if (provider === "yandex") return `https://yandex.com.tr/harita/?ll=${place.lng},${place.lat}&z=17&text=${label(place)}`;
  return `https://www.google.com/maps/search/?api=1&query=${at}`;
}

/**
 * Cihaza göre varsayılan sağlayıcı.
 * iOS/macOS'ta Apple Haritalar, Rusya/Türkiye Yandex tercihi ayardan gelir;
 * kalan her yerde Google. userAgent yoksa (sunucu) güvenli varsayılan Google:
 * maps.apple.com bağlantısı Android'de tarayıcıda açılıp çıkmaza girer.
 */
export function defaultMapProvider(ua = "", preference = null) {
  if (preference) return preference;
  if (/iPhone|iPad|iPod|Macintosh/i.test(ua)) return "apple";
  return "google";
}

export const MAP_PROVIDERS = [
  { id: "google", label: "Google Haritalar" },
  { id: "apple",  label: "Apple Haritalar" },
  { id: "yandex", label: "Yandex Harita" },
];

/**
 * İki koordinat arası mesafe (metre) — Haversine.
 * Ziyaret doğrulaması ve "yakınımdaki" sıralaması bunu kullanır.
 */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
