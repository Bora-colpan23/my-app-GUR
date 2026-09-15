// ═══════════════════════════════════════════════════════════════════════
// REKLAM MATERYALLERİ — yöneticinin yüklediği görsel ve videolar
//
// Reklam envanterinin İÇERİĞİ platformda duruyor, işletmede değil:
// banner slaytı, ödüllü video dosyası, push bildirim görseli. İşletme
// materyali gönderiyor ama yayına giren dosyayı yönetici yüklüyor —
// böylece ölçü, süre ve içerik denetimi tek elde kalıyor.
//
// ÖDÜLLÜ VİDEO HAKKINDA: bu bir KULLANICI özelliği. Kullanıcı videoyu
// izleyip kaydırma hakkı kazanıyor; restoranla zorunlu bir ilişkisi yok.
// Restoran isterse kendi videosunu o envantere koydurabilir — o zaman
// reklam olarak yayınlanır. İkisi ayrı şey ve arayüz bunu söylüyor.
//
// Dosyalar data URL olarak tutuluyor: YEREL modda sunucu yok ve önizleme
// çalışmalı. Gerçek dağıtımda buranın yerine bir nesne deposu (S3/R2)
// gelir; arayüz `url` alanını okuduğu için değişmesi gerekmiyor.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

const KEY = "gur.creatives";
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
  try { localStorage.setItem(KEY, JSON.stringify(next)); }
  catch {
    // localStorage kotası video ile kolayca dolabiliyor. Sessizce
    // yutmuyoruz: çağıran taraf kullanıcıya söyleyebilsin diye atıyoruz.
    throw new Error("Dosya tarayıcı deposuna sığmadı. Daha küçük bir dosya deneyin.");
  }
  for (const l of listeners) l();
}
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function useCreatives() {
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * Her yuvanın ne kabul ettiği tek yerde. Boyut sınırı gerçek: data URL
 * olarak localStorage'a yazılıyor ve 5 MB'lık kota bir videoyla dolar.
 */
export const SLOTS = {
  bannerAds: {
    label: "Keşfet banner'ı", accept: "image/*", maxMB: 1.5,
    hint: "1200×600 px yatay görsel. Keşfet ekranının üstündeki karusele girer.",
  },
  rewardedAds: {
    label: "Ödüllü video", accept: "video/*,image/*", maxMB: 4,
    hint: "Dikey 9:16, en fazla 30 sn. Kullanıcı izleyip kaydırma hakkı kazanır.",
  },
  pushAds: {
    label: "Push bildirim görseli", accept: "image/*", maxMB: 0.8,
    hint: "Kare görsel (1:1). Bildirimin yanında küçük gösterilir.",
  },
  instantDeals: {
    label: "Anlık fırsat görseli", accept: "image/*", maxMB: 1,
    hint: "Yatay görsel. Fırsat kartının arkasında kullanılır.",
  },
  gastroPackage: {
    label: "Gastro şef videosu", accept: "video/*", maxMB: 5,
    hint: "Dikey 15 sn şef videosu. Mekânın galerisinde ayrı bir kare olarak çıkar.",
  },
  secondChance: {
    label: "İkinci Şans görseli", accept: "image/*", maxMB: 1,
    hint: "İsteğe bağlı. Boş bırakılırsa mekânın kendi fotoğrafı kullanılır.",
  },
};

export function listFor(streamKey, state = read()) {
  return state[streamKey] || [];
}

/** Dosyayı data URL'e çevirip yuvaya ekler. Boyut kontrolü BURADA: her
 *  çağrı yerinde tekrar yazılsa biri er geç unutulur. */
export async function addCreative(streamKey, file, { restaurantId = null, restaurantName = null } = {}) {
  const slot = SLOTS[streamKey];
  if (!slot) throw new Error("Bilinmeyen reklam yuvası: " + streamKey);
  const mb = file.size / (1024 * 1024);
  if (mb > slot.maxMB) {
    throw new Error(`Dosya ${mb.toFixed(1)} MB — bu yuvanın sınırı ${slot.maxMB} MB.`);
  }
  const url = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error("Dosya okunamadı."));
    fr.readAsDataURL(file);
  });
  const kayit = {
    id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name, type: file.type, sizeMB: +mb.toFixed(2),
    url, restaurantId, restaurantName,
    live: false,                       // yayında mı — yönetici açar
    at: new Date().toISOString(),
  };
  const state = read();
  write({ ...state, [streamKey]: [kayit, ...(state[streamKey] || [])] });
  return kayit;
}

export function removeCreative(streamKey, id) {
  const state = read();
  const kalan = (state[streamKey] || []).filter(x => x.id !== id);
  const next = { ...state };
  if (kalan.length) next[streamKey] = kalan; else delete next[streamKey];
  write(next);
}

/** Yayına al / yayından kaldır. Yüklemek yayınlamak değil — yönetici
 *  materyali önce yükleyip sonra kontrol edip açabilsin. */
export function toggleLive(streamKey, id) {
  const state = read();
  write({
    ...state,
    [streamKey]: (state[streamKey] || []).map(x =>
      x.id === id ? { ...x, live: !x.live } : x),
  });
}

export function liveCount(streamKey, state = read()) {
  return listFor(streamKey, state).filter(x => x.live).length;
}
