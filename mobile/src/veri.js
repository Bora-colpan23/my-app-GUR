// ═══════════════════════════════════════════════════════════════════════
// MEKAN HAVUZU — mobil tarafın okuma yolu
//
// TEK DOĞRULUK KAYNAĞI KORUNUYOR: tohum liste depo kökündeki
// `src/data/restaurants.js`ten, deste kurgusu ve yakınlık sıralaması
// `shared/deck.js`ten geliyor. Metro bu dosyaları watchFolders sayesinde
// görüyor (metro.config.js); mobil uygulama İKİNCİ BİR KOPYA çıkarmıyor —
// kopyalasaydık sponsorlu kart aralığı webde 5-7, mobilde başka bir şey
// olurdu ve kimse fark etmezdi.
// ═══════════════════════════════════════════════════════════════════════

import { RESTAURANTS, CATEGORIES } from '../../src/data/restaurants.js';
import { buildDeck, orderByProximity } from '../../shared/deck.js';
import { istek } from './api.js';

export { CATEGORIES, RESTAURANTS as TOHUM };

/** Sunucudaki havuz; yoksa tohum liste. Hiçbir ekran boş kalmıyor. */
export async function havuzuGetir() {
  const c = await istek('/api/restaurants');
  const liste = Array.isArray(c) ? c : Array.isArray(c?.restaurants) ? c.restaurants : null;
  return liste?.length ? liste : RESTAURANTS;
}

/** Yakınlık sıralaması — sunucunun kullandığı fonksiyonun aynısı.
 *  Başlangıç noktası yoksa liste olduğu gibi döner (akış tıkanmaz). */
export function yakinaGore(liste, baslangic) {
  if (!baslangic || !Number.isFinite(baslangic.lat) || !Number.isFinite(baslangic.lng)) return liste;
  try { return orderByProximity(liste, baslangic); } catch { return liste; }
}

/** Mesafe metni: hesaplanmış `distanceKm` varsa ondan, yoksa kayıttaki
 *  hazır metinden. Seçim TEK yerde yapılsın ki ekranlar ayrışmasın
 *  (web tarafındaki `distText` ile aynı kural). */
export function mesafeMetni(r) {
  if (Number.isFinite(r?.distanceKm)) {
    return r.distanceKm < 1 ? `${Math.round(r.distanceKm * 1000)} m` : `${r.distanceKm.toFixed(1)} km`;
  }
  return r?.dist || '';
}

/** Deste: sponsorlu kartlar organik akışa harmanlanmış hâlde.
 *  `buildDeck` sunucuyla ORTAK — yerleşim hissi iki yerde ayrı yazılsaydı
 *  biri sessizce bozulurdu. */
export function desteKur(restoranlar, { kampanyalar = [], gecilen = [], tohum = 1 } = {}) {
  const kalan = restoranlar.filter(r => !gecilen.includes(String(r.id)));
  try { return buildDeck(kalan, kampanyalar, { seed: tohum }); } catch { return kalan; }
}
