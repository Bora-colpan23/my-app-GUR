// ═══════════════════════════════════════════════════════════════════════
// TEMA — açık / koyu / sistem
//
// Üç seçenek var çünkü iki seçenek yetmiyor: "koyu" diyen kullanıcı her
// zaman koyu ister, "sistem" diyen ise telefonun gece moduyla birlikte
// değişmesini bekler. Varsayılan "sistem" — kullanıcının cihazına verdiği
// karar, uygulamanın varsayımından önce gelir.
//
// Renkler CSS değişkeni olarak veriliyor (bkz. src/ui/kit.jsx → GurStyles).
// Uygulama satır içi stille yazıldığı için tek yoldan tema değiştirmenin
// başka yolu yok: satır içi stil sınıf kuralını yener, ama var() okur.
//
// Yönetici paneli bunun dışında: o zaten koyu bir masaüstü aracı.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

const KEY = "gur.theme";
export const MODES = ["system", "light", "dark"];

const listeners = new Set();
function emit() {
  for (const l of listeners) l();
  try { window.dispatchEvent(new Event("gur:theme")); } catch { /* SSR */ }
}

function subscribe(fn) {
  listeners.add(fn);
  const onExternal = () => fn();
  window.addEventListener("storage", onExternal);
  window.addEventListener("gur:theme", onExternal);
  // Sistem tercihi değişince "system" modundakiler de yeniden çizilmeli
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", onExternal);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onExternal);
    window.removeEventListener("gur:theme", onExternal);
    mq?.removeEventListener?.("change", onExternal);
  };
}

let snap = { raw: null, value: "system" };
export function getMode() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return "system"; }
  if (snap.raw === raw) return snap.value;
  snap = { raw, value: MODES.includes(raw) ? raw : "system" };
  return snap.value;
}

export function setMode(mode) {
  if (!MODES.includes(mode)) return;
  try { localStorage.setItem(KEY, mode); } catch { /* depolama kapalı */ }
  emit();
}

function systemPrefersDark() {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; }
  catch { return false; }
}

/** Ekranda gerçekten hangi tema var: "light" | "dark". */
export function resolvedTheme(mode = getMode()) {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return systemPrefersDark() ? "dark" : "light";
}

export function useTheme() {
  const mode = useSyncExternalStore(subscribe, getMode, () => "system");
  return { mode, theme: resolvedTheme(mode), setMode };
}

/**
 * Seçilen temayı belgeye uygular. Kök öğedeki data-theme özniteliği
 * CSS değişkenlerini değiştiriyor (bkz. GurStyles); satır içi stiller de
 * var() üzerinden bu değerleri okuduğu için tüm uygulama tek anda dönüyor.
 */
export function useApplyTheme() {
  const { mode, theme } = useTheme();
  if (typeof document !== "undefined") {
    // Render sırasında yazmak güvenli: DOM özniteliği React ağacının
    // dışında ve idempotent. Efekte bırakılsaydı ilk kare yanlış temada
    // çizilir, göz alıcı bir "beyaz çakma" olurdu.
    const root = document.documentElement;
    if (root.dataset.theme !== theme) root.dataset.theme = theme;
  }
  return { mode, theme };
}
