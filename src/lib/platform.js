// ═══════════════════════════════════════════════════════════════════════
// PLATFORM AYARLARI — yönetici panelinin açıp kapattığı özellik kapıları.
//
// Yönetici paneli (/admin) ile tüketici uygulaması (/) ayrı rotalarda
// çalışıyor; ortak durum localStorage üzerinden paylaşılır. Sunucu tarafında
// bunun karşılığı platform_settings tablosudur — bir bayrak kapatıldığında
// istemcinin girişi gizlemesi yetmez, uç de reddetmelidir.
//
// b2b.js ile aynı depo kalıbı: anlık görüntü referansı ham metin
// değişmediği sürece sabit kalır, yoksa useSyncExternalStore sonsuz döner.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

const KEY = "gur.platform";

// ─── Özellik kataloğu ────────────────────────────────────────────────
// Tek liste, iki yerde kullanılıyor: yönetici panelindeki anahtarlar ve
// uygulamadaki kapılar. Katalogda olmayan bir kapı kapatılamaz; katalogda
// olup uygulamada kontrol edilmeyen bir anahtar da yalan söyler — bu yüzden
// ikisi aynı listeden besleniyor.
//
// perStore: bu özellik restoran bazında da kapatılabilir mi. Genel anahtar
// kapalıysa restoran bazlı açıklık bir şey ifade etmez (genel her zaman
// üstün gelir) — "platformda yok" ile "bu mekanda yok" farklı şeylerdir.
export const FEATURES = [
  { key: 'matchEnabled', label: 'GUR Match', perStore: false,
    desc: 'İki kişinin aynı desteyi kaydırıp ortak kararda buluştuğu arkadaş sistemi. Kapatıldığında Keşfet ekranındaki Match kartı gizlenir, süren oturumlar Keşfet’e döner; kayıtlı eşleşmeler silinmez.' },
  { key: 'reservationsEnabled', label: 'Masa ayırtma', perStore: true,
    desc: 'Kullanıcı uygulamadan masa ayırtır, talep işletmenin paneline bildirim olarak düşer. Kapatıldığında restoran sayfasındaki "Masa Ayırt" düğmesi çıkmaz.' },
  { key: 'menuEnabled', label: 'Menü görüntüleme', perStore: true,
    desc: 'Sahiplenilmiş işletmelerin menü galerisi. Kapatıldığında menüye basılınca "çok yakında" sayfası açılır.' },
  { key: 'gastroVideoEnabled', label: 'Şef tanıtım videosu', perStore: true,
    desc: 'Gastro Onaylı mekânların galerisindeki şef videosu karesi.' },
  { key: 'instantDealsEnabled', label: 'Anlık fırsat', perStore: true,
    desc: 'Ölü saatleri dolduran süreli indirimler; restoran sayfasında ve keşif akışında görünür.' },
  { key: 'gastroPublic', label: 'Gastro Onaylı rozeti', perStore: false,
    desc: 'Onaylı restoranlar uygulamada rozetle öne çıkar.' },
];

export const PER_STORE_FEATURES = FEATURES.filter(f => f.perStore);

// ═══════════════════════════════════════════════════════════════════════
// SATIŞ KAPILARI — bir hizmet şu an satın alınabilir mi
//
// Yukarıdaki FEATURES ile KARIŞTIRMAYIN, ikisi ayrı soru soruyor:
//   FEATURES        → özellik TÜKETİCİDE çalışıyor mu ("menü görüntüleme açık mı")
//   SERVICE_GATES   → işletme bu hizmeti ALABİLİR mi ("banner satışta mı")
//
// Bir hizmet kapatıldığında işletme panelinde kart kayboLMUYOR: yerinde
// "Pek yakında" yazıyor. Kaldırmak, işletmeye ürünün hiç var olmadığını
// söylemek olurdu; oysa yakında açılacak.
//
// `needs` — o hizmetin dayandığı özellik kapısı. Platformda KAPALI bir
// özelliği satmak olmaz: teslim edemeyeceğimiz şeyin parasını alamayız.
// Bu yüzden özellik kapalıysa hizmet de otomatik kapalı sayılıyor ve
// yönetici ayrı ayrı iki yeri kapatmak zorunda kalmıyor.
export const SERVICE_GATES = [
  { key: 'bannerAds',    label: "Keşfet Banner'ı" },
  { key: 'pushAds',      label: 'Push Bildirim Reklamı' },
  { key: 'rewardedAds',  label: 'Ödüllü Video Reklam' },
  { key: 'secondChance', label: 'İkinci Şans paketi' },
  { key: 'instantDeals', label: 'Anlık fırsat', needs: 'instantDealsEnabled' },
  { key: 'gastroPackage', label: 'Gastro şef videosu paketi', needs: 'gastroVideoEnabled' },
];

const GATE_BY_KEY = Object.fromEntries(SERVICE_GATES.map(g => [g.key, g]));

export const DEFAULTS = {
  matchEnabled: true,          // GUR Match: arkadaşla yan yana kaydırma
  reservationsEnabled: true,   // masa ayırtma ve işletmeye giden bildirim
  menuEnabled: true,           // menü galerisi
  gastroVideoEnabled: true,    // şef tanıtım videosu
  instantDealsEnabled: true,   // anlık fırsatlar
  gastroPublic: true,          // Gastro Onaylı rozeti uygulamada görünür
  autoApprove: false,          // başvuruların otomatik onayı
  newReviews: true,            // şikayet edilen yorum bildirimi
  maintenance: false,          // bakım modu
  // Restoran bazlı kapatmalar: { "<restoranId>": { reservationsEnabled: false } }
  storeOverrides: {},
  // Satışa KAPALI hizmetler: { bannerAds: true } → banner satılmıyor.
  // Yalnızca kapalı olanlar yazılıyor; listede olmayan hizmet AÇIK sayılır.
  // Tersi olsaydı katalogda yeni bir hizmet açıldığında eski kurulumlarda
  // kapalı doğar ve kimse fark etmezdi.
  servicesOff: {},
  // MÜŞTERİ bazlı kapatmalar: { "<restoranId>": { gastroPackage: true } }.
  // Aynı mantık, tek fark kapsam: burası "bu müşteriye satmıyoruz" der.
  // `storeOverrides`a koymadık — orası FEATURES kuyruğu ve ayrı bir soru
  // soruyor ("bu mekanda menü çalışıyor mu"); ikisini tek haritada tutmak
  // "özellik yok" ile "satmıyoruz" durumlarını karıştırırdı.
  servicesOffFor: {},
};

const listeners = new Set();
function emit() {
  for (const l of listeners) l();
  try { window.dispatchEvent(new Event("gur:platform")); } catch { /* SSR */ }
}

function subscribe(fn) {
  listeners.add(fn);
  const onExternal = () => fn();
  window.addEventListener("storage", onExternal);       // başka sekme
  window.addEventListener("gur:platform", onExternal);  // aynı sekme, diğer rota
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onExternal);
    window.removeEventListener("gur:platform", onExternal);
  };
}

let snapshot = { raw: null, value: DEFAULTS };

/** Tüm ayarlar; eksik anahtarlar varsayılandan tamamlanır. */
export function getSettings() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return DEFAULTS; }
  if (snapshot.raw === raw) return snapshot.value;
  let stored = null;
  try { stored = JSON.parse(raw || "null"); } catch { stored = null; }
  snapshot = { raw, value: { ...DEFAULTS, ...(stored || {}) } };
  return snapshot.value;
}

/** Tek bir bayrağı okur. */
export function isEnabled(key) {
  return !!getSettings()[key];
}

/** Ayarları günceller; her iki rota da anında haberdar olur. */
export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* depolama kapalı */ }
  emit();
  return next;
}

export function toggleSetting(key) {
  return setSettings({ [key]: !isEnabled(key) });
}

export function usePlatformSettings() {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
}

// ─── Restoran bazlı kapatmalar ───────────────────────────────────────

/** Bir restoranın kapatılmış özellikleri (yalnızca override'lar). */
export function storeOverrides(storeId) {
  return getSettings().storeOverrides?.[String(storeId)] || {};
}

// ─── RESTORAN GÖRÜNÜRLÜĞÜ ────────────────────────────────────────────
//
// Tek bir mekanı tüketici uygulamasından TAMAMEN gizler. Özellik
// kapılarından ayrı tutuluyor çünkü farklı bir şey söylüyor: kapılar
// "bu mekanda şu özellik yok" der, bu ise "bu mekan yok" der.
//
// Ayarlar sayfasında DEĞİL, restoranın kendi detay ekranında: genel bir
// listede yanlış satıra basmak bir mekanı sessizce uygulamadan
// düşürürdü.
//
// Gizli mekan destede, aramada, listede ve kategori sayımlarında yok;
// kaydı silinmiyor, işletme paneli çalışmaya devam ediyor.
const HIDDEN = "hiddenFromApp";

export function isRestaurantHidden(storeId, settings = getSettings()) {
  return (settings.storeOverrides?.[String(storeId)] || {})[HIDDEN] === true;
}

export function setRestaurantHidden(storeId, hidden) {
  const all = { ...(getSettings().storeOverrides || {}) };
  const forStore = { ...(all[String(storeId)] || {}) };
  if (hidden) forStore[HIDDEN] = true;
  else delete forStore[HIDDEN];
  if (Object.keys(forStore).length) all[String(storeId)] = forStore;
  else delete all[String(storeId)];
  return setSettings({ storeOverrides: all });
}

/** Listeyi süz: gizlenen mekanlar tüketici tarafında hiç görünmez. */
export function visibleRestaurants(list = [], settings = getSettings()) {
  const ov = settings.storeOverrides || {};
  return list.filter(r => (ov[String(r.id)] || {})[HIDDEN] !== true);
}

export function setStoreFeature(storeId, key, enabled) {
  const all = { ...(getSettings().storeOverrides || {}) };
  const forStore = { ...(all[String(storeId)] || {}) };
  if (enabled) delete forStore[key];      // açık = override yok, genel kural geçerli
  else forStore[key] = false;
  if (Object.keys(forStore).length) all[String(storeId)] = forStore;
  else delete all[String(storeId)];
  return setSettings({ storeOverrides: all });
}

/**
 * Bir özellik şu an açık mı. storeId verilirse restoran bazlı kapatma da
 * hesaba katılır. Genel anahtar her zaman üstün gelir: platformda kapalı
 * bir özelliği tek bir restoran için açmanın anlamı yok.
 */
// ─── Satış kapıları ───────────────────────────────────────────────────

/**
 * Bu hizmet şu an satın alınabilir mi.
 *
 * `restaurantId` verilirse o müşterinin kapısı da hesaba katılır. Sıra
 * ÖNEMLİ ve tek yönlü: özellik → platform → müşteri. Üsttekinden kapalı
 * bir şeyi alttan açmak bir işe yaramaz, o yüzden genel kapı her zaman
 * üstün geliyor — "platformda satmıyoruz" ile "bu müşteriye satmıyoruz"
 * aynı cümle değil, ama ilki ikincisini kapsıyor.
 */
export function isServiceOpen(streamKey, settings = getSettings(), restaurantId = null) {
  const g = GATE_BY_KEY[streamKey];
  if (!g) return true;                       // katalog dışı: kapı yok
  if (g.needs && settings[g.needs] === false) return false;   // özellik kapalı
  if ((settings.servicesOff || {})[streamKey]) return false;  // platformda kapalı
  if (restaurantId == null) return true;
  return !(settings.servicesOffFor?.[String(restaurantId)] || {})[streamKey];
}

export function setServiceOpen(streamKey, open) {
  const off = { ...(getSettings().servicesOff || {}) };
  if (open) delete off[streamKey]; else off[streamKey] = true;
  setSettings({ servicesOff: off });
}

/** Tek bir müşteriye satışı aç/kapat. */
export function setServiceOpenFor(restaurantId, streamKey, open) {
  if (!GATE_BY_KEY[streamKey]) return;
  const all = { ...(getSettings().servicesOffFor || {}) };
  const forStore = { ...(all[String(restaurantId)] || {}) };
  if (open) delete forStore[streamKey]; else forStore[streamKey] = true;
  // Boş kalan kaydı silelim: müşteri başına boş bir nesne bırakmak depoyu
  // "kapalı bir şeyi var" gibi gösterirdi.
  if (Object.keys(forStore).length) all[String(restaurantId)] = forStore;
  else delete all[String(restaurantId)];
  setSettings({ servicesOffFor: all });
}

/**
 * Kapı neden kapalı — arayüz üçünü ayrı yazsın, sebebi bilmeden
 * yönetici yanlış anahtarı arar.
 *   'feature' → dayandığı özellik kapalı (Ayarlar)
 *   'manual'  → platformda satışa kapalı (Hizmetler)
 *   'store'   → bu müşteriye kapalı (müşterinin kendi kartı)
 */
export function serviceGateReason(streamKey, settings = getSettings(), restaurantId = null) {
  const g = GATE_BY_KEY[streamKey];
  if (!g) return null;
  if (g.needs && settings[g.needs] === false) return 'feature';
  if ((settings.servicesOff || {})[streamKey]) return 'manual';
  if (restaurantId != null
      && (settings.servicesOffFor?.[String(restaurantId)] || {})[streamKey]) return 'store';
  return null;
}

/** Bir müşteriye kapatılmış hizmet sayısı — panelde rozet olarak yazıyor. */
export function closedServiceCount(restaurantId, settings = getSettings()) {
  const forStore = settings.servicesOffFor?.[String(restaurantId)] || {};
  return SERVICE_GATES.filter(g => forStore[g.key]).length;
}

export function useServiceOpen(streamKey, restaurantId = null) {
  const settings = usePlatformSettings();
  return isServiceOpen(streamKey, settings, restaurantId);
}

export function featureOn(key, storeId = null) {
  if (!isEnabled(key)) return false;
  if (storeId == null) return true;
  return storeOverrides(storeId)[key] !== false;
}

/** React tarafı: ayarlar değişince yeniden çizilsin. */
export function useFeature(key, storeId = null) {
  const settings = usePlatformSettings();
  if (!settings[key]) return false;
  if (storeId == null) return true;
  return (settings.storeOverrides?.[String(storeId)] || {})[key] !== false;
}
