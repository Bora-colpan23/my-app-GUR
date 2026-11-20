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
import { buildDeck, rankCampaigns, orderByProximity } from '../../shared/deck.js';
import { restoranlariGetir } from './api.js';

export { CATEGORIES, RESTAURANTS as TOHUM };

// Sunucu kartı (gur_card) ile yerel tohum kartı AYNI şekilde olmalı: ekranlar
// ayırt etmiyor. Sunucuda fotoğraf/menü yoksa tohumdakiyle aynı yer tutucu.
const yerTutucu = (id) => [0, 1, 2].map(i => `https://picsum.photos/seed/${id}-${i}/600/400`);
export function kartiHazirla(c) {
  return {
    menu: [], popular: [], source: 'api',
    ...c,
    imgs: c.imgs?.length ? c.imgs : yerTutucu(c.id),
    // Koordinatı olmayan (ilçe merkezli) kartta mesafe yerine ilçe adı yazılır.
    dist: c.dist || (c.area ? (c.district || '') : ''),
  };
}

/** Sunucudaki havuz (Supabase); yoksa tohum liste. Hiçbir ekran boş kalmıyor. */
export async function havuzuGetir() {
  const liste = await restoranlariGetir();
  return liste?.length ? liste.map(kartiHazirla) : RESTAURANTS;
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
export function desteKur(restoranlar, { kampanyalar = [], gecilen = [], gorulenKampanya = [], tohum = 1 } = {}) {
  // Aktif kampanyası olan mekân organik akışta ÇIKMAZ: aynı kartı hem bedava hem
  // ücretli göstermek reklamvereni bedavaya ödetmek olur (sunucudaki deste ile
  // aynı kural) — ve buildDeck, organikte zaten olan mekânın sponsorlu
  // kartını hiç yerleştirmez.
  const reklamli = new Set(kampanyalar.map(k => String(k.restaurant?.id)));
  const kalan = restoranlar.filter(r => !gecilen.includes(String(r.id)) && !reklamli.has(String(r.id)));
  try {
    // Sponsorlu kartın restoranı da aynı kart şekline getirilir; açık artırma
    // sıralaması (teklif × kalite) ve kullanıcı başına bir kez kuralı ortak koddan.
    const sirali = rankCampaigns(kampanyalar.map(k => ({ ...k, restaurant: kartiHazirla(k.restaurant) })));
    return buildDeck(kalan, sirali, { seed: tohum, seenCampaigns: gorulenKampanya });
  } catch { return kalan; }
}
