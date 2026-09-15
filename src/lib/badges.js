// ═══════════════════════════════════════════════════════════════════════
// ROZETLER — bir mekana birden fazla nişan takılabilir
//
// Önceden tek bir rozet vardı ve o da kaydın kendi alanıydı (`r.gastro`).
// Gastro Onaylı bağımsız şef değerlendirmesine dayanıyor ve satın
// alınamıyor (bkz. yasal metin), o yüzden kaydın alanı olarak KALIYOR.
// Yönetici panelinden verilen "Günün Restoranı" gibi editoryal rozetler
// ise ayrı bir depoda: veri kaynağı değişince (OSM/Places beslemesi
// kaydı tazeleyince) editoryal kararlar silinmesin.
//
// Yazan yönetici paneli, okuyan tüketici uygulaması — platform.js ve
// b2b.js ile aynı kalıp.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

/**
 * Rozet kataloğu. Renkler paletin durum ailesinden okunuyor: yeni bir
 * yeşil/amber/kırmızı tanımlamıyoruz (bkz. CLAUDE.md → Tutarlı renk seçimi).
 *
 * `fill`  — fotoğraf üstündeki çipin zemini
 * `ink`   — açık kâğıt üstünde yazı/simge rengi
 * `soft`  — açık kâğıt üstünde çip zemini
 * `hex` / `hexInk` — yönetici paneli için ham karşılıkları. Panel kendi
 *   stil bloğunu taşıyor ve GurStyles'ı render etmiyor, orada `var()`
 *   çözülmez.
 */
export const BADGES = [
  {
    id: "gastro", label: "Gastro Onaylı", short: "Gastro", icon: "star",
    fill: "#FF6600", ink: "var(--c-brand-ink)", soft: "var(--c-brand-soft)",
    hex: "#FF6600", hexInk: "#B4530A",
    desc: "Bağımsız şef değerlendirmesiyle onaylandı.",
    derived: true,   // kaydın kendi alanından gelir, panelden elle verilmez
  },
  {
    id: "daily", label: "Günün Restoranı", short: "Günün", icon: "flame",
    fill: "var(--c-warn)", ink: "var(--c-warn-ink)", soft: "var(--c-warn-soft)",
    hex: "#F59E0B", hexInk: "#8A5200",
    desc: "Editör ekibinin bugün öne çıkardığı mekan.",
  },
  {
    id: "weekly", label: "Haftanın Keşfi", short: "Keşif", icon: "sparkle",
    fill: "var(--c-ok)", ink: "var(--c-ok-ink)", soft: "var(--c-ok-soft)",
    hex: "#13B364", hexInk: "#0A7C46",
    desc: "Bu hafta keşfedilmeye değer bulundu.",
  },
  {
    id: "editor", label: "Editör Seçimi", short: "Editör", icon: "bulb",
    fill: "#17130F", ink: "var(--c-ink)", soft: "var(--c-subtle)",
    hex: "#17130F", hexInk: "#12141A",
    desc: "GUR editörlerinin kalıcı seçkisi.",
  },
  {
    id: "new", label: "Yeni Açıldı", short: "Yeni", icon: "plate",
    fill: "var(--c-ok)", ink: "var(--c-ok-ink)", soft: "var(--c-ok-soft)",
    hex: "#13B364", hexInk: "#0A7C46",
    desc: "Yakın zamanda açıldı, henüz keşfediliyor.",
  },
  {
    id: "local", label: "Semtin Favorisi", short: "Semt", icon: "heart",
    fill: "var(--c-bad)", ink: "var(--c-bad-ink)", soft: "var(--c-bad-soft)",
    hex: "#E5484D", hexInk: "#C2282D",
    desc: "Kendi semtinde en çok kaydedilen mekanlardan.",
  },
];

/** Panelden elle verilebilen rozetler — Gastro dışındakiler. */
export const ASSIGNABLE = BADGES.filter(b => !b.derived);

export const BY_ID = Object.fromEntries(BADGES.map(b => [b.id, b]));

// ─── Depo ────────────────────────────────────────────────────────────────
const KEY = "gur.badges";
const listeners = new Set();
let cache = null;

function read() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
  catch { cache = {}; }
  return cache;
}
function write(next) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* yoksay */ }
  for (const l of listeners) l();
}
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Tüm atamalar: { [mekanId]: ["daily", "editor"] } */
export function allBadges() { return read(); }

export function useBadgeMap() {
  return useSyncExternalStore(subscribe, read, read);
}

/** Bir mekanın rozetleri — Gastro kaydın alanından, gerisi depodan. */
export function badgesOf(restaurant, map = read()) {
  if (!restaurant) return [];
  const elle = map[String(restaurant.id)] || [];
  const ids = [...(restaurant.gastro ? ["gastro"] : []), ...elle];
  // Katalog sırası korunur: rozetler her ekranda aynı sırada görünsün.
  return BADGES.filter(b => ids.includes(b.id));
}

export function hasBadge(restaurant, badgeId, map = read()) {
  return badgesOf(restaurant, map).some(b => b.id === badgeId);
}

/** Panelden aç/kapat. Gastro burada değişmez — kaydın kendi alanı. */
export function toggleBadge(restaurantId, badgeId) {
  if (BY_ID[badgeId]?.derived) return;
  const key = String(restaurantId);
  const cur = read();
  const list = cur[key] || [];
  const next = list.includes(badgeId) ? list.filter(x => x !== badgeId) : [...list, badgeId];
  const kopya = { ...cur };
  if (next.length) kopya[key] = next; else delete kopya[key];
  write(kopya);
}

/** Bir rozeti taşıyan mekan sayısı — panelde "kaç mekanda" göstergesi. */
export function countWith(badgeId, restaurants = []) {
  const map = read();
  return restaurants.filter(r => hasBadge(r, badgeId, map)).length;
}
