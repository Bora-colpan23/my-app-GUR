// ═══════════════════════════════════════════════════════════════════════
// KONUM — üç yol, üçü de eşit ağırlıkta
//
// Web tarafındaki `src/lib/geo.js` ile aynı ürün kararı:
//   cihaz  — Geolocation izni verildi
//   elle   — ilçe listeden seçildi (izin yok ya da reddedildi)
//   yok    — "şimdi değil"; akış TIKANMIYOR, sıralama yapılmıyor
//
// HAM KOORDİNAT HİÇBİR YERE GÖNDERİLMİYOR. Mesafe cihazda hesaplanıyor
// (shared/deck.js → orderByProximity); sunucuya giden tek şey, ziyaret
// doğrulamasında mesafe/süre özeti.
// ═══════════════════════════════════════════════════════════════════════

import * as Location from 'expo-location';

// İlçe merkezleri — izni reddeden kullanıcı da sıralamadan faydalansın.
export const ILCELER = [
  { ad: 'Kadıköy', lat: 40.9903, lng: 29.0264 },
  { ad: 'Beşiktaş', lat: 41.0430, lng: 29.0094 },
  { ad: 'Beyoğlu', lat: 41.0336, lng: 28.9770 },
  { ad: 'Şişli', lat: 41.0602, lng: 28.9877 },
  { ad: 'Üsküdar', lat: 41.0226, lng: 29.0133 },
  { ad: 'Bakırköy', lat: 40.9819, lng: 28.8772 },
  { ad: 'Sarıyer', lat: 41.1670, lng: 29.0570 },
  { ad: 'Ataşehir', lat: 40.9923, lng: 29.1244 },
  { ad: 'Fatih', lat: 41.0186, lng: 28.9397 },
  { ad: 'Maltepe', lat: 40.9351, lng: 29.1310 },
];

/** Cihaz izni iste ve konumu al. Reddedilirse `null` — çağıran yer
 *  kullanıcıyı elle seçime yönlendiriyor, hata ekranı göstermiyoruz. */
export async function cihazKonumu() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const k = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { kaynak: 'cihaz', lat: k.coords.latitude, lng: k.coords.longitude, ilce: null };
  } catch {
    return null;
  }
}

export function ilceSec(ad) {
  const i = ILCELER.find(x => x.ad === ad);
  return i ? { kaynak: 'elle', lat: i.lat, lng: i.lng, ilce: i.ad } : null;
}

/** Çipin üst satırı: durumu söyler. */
export function konumEtiketi(konum) {
  if (!konum) return { ust: 'Konum kapalı', alt: 'Seçmek için dokun' };
  if (konum.kaynak === 'cihaz') return { ust: 'Konumun', alt: 'Yakındakiler önce' };
  return { ust: 'Seçtiğin ilçe', alt: konum.ilce || 'İstanbul' };
}
