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

export const DEFAULTS = {
  matchEnabled: true,       // GUR Match: arkadaşla yan yana kaydırma
  gastroPublic: true,       // Gastro Onaylı rozeti uygulamada görünür
  autoApprove: false,       // başvuruların otomatik onayı
  newReviews: true,         // şikayet edilen yorum bildirimi
  maintenance: false,       // bakım modu
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
