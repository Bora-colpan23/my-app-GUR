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
