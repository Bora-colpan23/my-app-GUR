// ═══════════════════════════════════════════════════════════════════════
// UYGULAMA İÇİ REKLAM GÖRSELLERİ — yönetici değiştirir, tüketici okur
//
// Tüketici uygulamasında GUR'un KENDİ yerleştirdiği reklam alanları var:
// Keşfet'in üstündeki dönen banner (marka slaytı + iki ev reklamı) ve
// ödüllü videonun ev havuzu. Görselleri koda gömülü adreslerdi; değiştirmek
// için yayın gerekiyordu. Şimdi yönetici panelinden (Reklam Görselleri)
// yükleniyor ve uygulama anında yeni görseli çiziyor.
//
// BUNLAR İŞLETMENİN SATIN ALDIĞI YERLEŞİM DEĞİL. Satın alınan banner'ın
// görseli işletmenin yükleyip yöneticinin onayladığı dosyadır
// (lib/media.js); burası onun yokluğunda dönen GUR'un kendi içeriği.
//
// Depo kalıbı platform.js / media.js ile aynı: localStorage, anlık görüntü
// HAM METNE göre önbellekleniyor (yoksa useSyncExternalStore sonsuz döner),
// `storage` + `gur:adcontent` olaylarını dinliyor.
//
// Yalnızca DEĞİŞTİRİLENLER saklanıyor: katalog varsayılanı güncellenince
// dokunulmamış yerleşimler kendiliğinden yenisini alır; "varsayılana dön"
// kaydı siliyor.
//
// Görseller data URL; tarayıcı kotası ~5 MB, bu yüzden yazmadan önce
// küçültülüyor ve kota taşarsa `set` HATA FIRLATIYOR (yüklediğini sanıp
// kaybetmek en kötü sonuç). Sunucu modunda karşılığı nesne deposu + tablo
// olur; arayüz yalnızca `url` okuduğu için değişmez.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { I } from "../data/restaurants.js";
import { fileToFittedDataUrl } from "./image.js";

const KEY = "gur.adcontent";

/**
 * Yerleşim kataloğu. `id` uygulamadaki reklam kaydının kimliğiyle AYNI
 * (BANNER_ADS / REWARD_ADS): uygulama görseli bu kimlikle arıyor.
 *
 * `ratio` yalnızca yöneticiye ölçü tarifi için: kırpma uygulamada
 * `object-fit: cover` ile yapılıyor.
 */
export const PLACEMENTS = [
  {
    id: "brand", group: "banner", label: "Marka slaytı",
    where: "Keşfet ekranının üstündeki dönen banner'ın ilk slaytı — her zaman gösterilir",
    hint: "Yatay, 2:1 civarı (örn. 1600×800). Yazı uygulama tarafından görselin üstüne basılır; görselin alt yarısını sade bırakın.",
    ratio: "2 / 1", def: I.hero,
  },
  {
    id: "ad-1", group: "banner", label: "Ev reklamı 1 · Öz Değirmen",
    where: "Banner'da satın alınmış slayt yokken dönen birinci GUR reklamı",
    hint: "Yatay, 2:1 (örn. 1600×800). Satın alınmış bir banner yayındaysa bu slayt çıkmaz.",
    ratio: "2 / 1", def: "https://picsum.photos/seed/gur-ad-flour/800/400",
  },
  {
    id: "ad-2", group: "banner", label: "Ev reklamı 2 · Kalamış Zeytinyağı",
    where: "Banner'da satın alınmış slayt yokken dönen ikinci GUR reklamı",
    hint: "Yatay, 2:1 (örn. 1600×800). Satın alınmış bir banner yayındaysa bu slayt çıkmaz.",
    ratio: "2 / 1", def: "https://picsum.photos/seed/gur-ad-oil/800/400",
  },
  {
    id: "rw-1", group: "rewarded", label: "Ödüllü reklam 1 · Öz Değirmen",
    where: "Kaydırma hakkı kazandıran ödüllü reklamın ev havuzu — restoran videosu yokken oynar",
    hint: "Dikey, 2:3 (örn. 1080×1620). Görsel koyulaştırılıp üstüne metin basılır.",
    ratio: "2 / 3", def: "https://picsum.photos/seed/gur-sp-bread/600/900",
  },
  {
    id: "rw-2", group: "rewarded", label: "Ödüllü reklam 2 · Kalamış Zeytinyağı",
    where: "Ödüllü reklamın ev havuzu",
    hint: "Dikey, 2:3 (örn. 1080×1620).",
    ratio: "2 / 3", def: "https://picsum.photos/seed/gur-sp-oil/600/900",
  },
  {
    id: "rw-3", group: "rewarded", label: "Ödüllü reklam 3 · Bereket Baharat",
    where: "Ödüllü reklamın ev havuzu",
    hint: "Dikey, 2:3 (örn. 1080×1620).",
    ratio: "2 / 3", def: "https://picsum.photos/seed/gur-sp-spice/600/900",
  },
];

export const GROUPS = [
  { id: "banner", label: "Keşfet banner'ı", desc: "Ana ekranın üstündeki dönen şerit" },
  { id: "rewarded", label: "Ödüllü reklam", desc: "Kaydırma hakkı biten kullanıcının izlediği tam ekran reklam" },
];

const BY_ID = Object.fromEntries(PLACEMENTS.map(p => [p.id, p]));

// Uzun kenar sınırı yerleşime göre: banner yatay ve geniş, ödüllü dikey.
const SHRINK = { banner: 1600, rewarded: 1280 };
export const MAX_MB = 6;

const listeners = new Set();
let snap = { raw: null, value: {} };

function read() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return snap.value; }
  if (snap.raw === raw) return snap.value;
  let stored = null;
  try { stored = JSON.parse(raw || "{}"); } catch { stored = null; }
  snap = { raw, value: stored && typeof stored === "object" ? stored : {} };
  return snap.value;
}

function write(next) {
  let metin;
  try { metin = JSON.stringify(next); } catch { metin = "{}"; }
  try { localStorage.setItem(KEY, metin); }
  catch {
    // Önbelleği güncellemeden atıyoruz: yazılamayan veriyi yazılmış
    // göstermek, kaybı bir de gizlemek olurdu.
    throw new Error("Görsel tarayıcı deposuna sığmadı. Daha küçük bir görsel deneyin ya da diğer yerleşimlerin görsellerini varsayılana döndürün.");
  }
  snap = { raw: metin, value: next };
  for (const l of listeners) l();
  try { window.dispatchEvent(new Event("gur:adcontent")); } catch { /* SSR */ }
}

function subscribe(fn) {
  listeners.add(fn);
  const disaridan = () => fn();
  window.addEventListener("storage", disaridan);        // başka sekme
  window.addEventListener("gur:adcontent", disaridan);  // aynı sekme, diğer rota
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", disaridan);
    window.removeEventListener("gur:adcontent", disaridan);
  };
}

export function useAdContent() {
  return useSyncExternalStore(subscribe, read, read);
}

/** Katalogdaki varsayılan görsel. */
export function defaultImage(id) {
  return BY_ID[id]?.def || null;
}

/** Yerleşimin gösterilecek görseli: yönetici yüklediyse o, yoksa varsayılan. */
export function adImage(id, state = read()) {
  return state[id]?.url || BY_ID[id]?.def || null;
}

/** Yönetici bu yerleşimi değiştirmiş mi. */
export function isCustom(id, state = read()) {
  return !!state[id]?.url;
}

/**
 * Yönetici görseli yükler. Görsel olmayan dosya ve büyük dosya depoya
 * girmeden reddedilir; kota taşarsa `write` hata fırlatır.
 */
export async function setAdImage(id, file) {
  const p = BY_ID[id];
  if (!p) throw new Error("Bilinmeyen reklam yerleşimi.");
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Yalnızca görsel yüklenebilir (JPG, PNG, WebP).");
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`Dosya ${MAX_MB} MB'tan büyük olamaz.`);
  }
  const url = await fileToFittedDataUrl(file, SHRINK[p.group] || 1280);
  write({ ...read(), [id]: { url, name: file.name || "görsel", at: new Date().toISOString() } });
}

/** Varsayılan görsele dön: kaydı siler. */
export function resetAdImage(id) {
  const state = read();
  if (!(id in state)) return;
  const { [id]: _silinen, ...kalan } = state;   // eslint-disable-line no-unused-vars
  write(kalan);
}

export function customCount(state = read()) {
  return PLACEMENTS.filter(p => state[p.id]?.url).length;
}
