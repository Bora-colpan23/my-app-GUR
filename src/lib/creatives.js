// ═══════════════════════════════════════════════════════════════════════
// HİZMET TANITIMLARI — yöneticinin yüklediği tanıtım görseli / videosu
//
// Burası REKLAM İÇERİĞİ DEĞİL. Sattığımız her hizmetin (banner, push,
// ödüllü video, Gastro paketi…) ne olduğunu ANLATAN tanıtım dosyası:
// "banner nasıl görünüyor", "şef videosu neye benziyor". Yönetici
// yüklüyor, işletme kendi panelinde Büyüme sekmesinde görüyor.
//
// Neden bu ayrım: bir işletmenin teklif istemeden önce ne satın aldığını
// görmesi gerekiyordu. Fiyat ve iki satır açıklama yetmiyordu — "dönen
// keşfet banner'ı" okuyan kişi ekranda neye benzediğini bilmiyordu.
//
// İşletmenin KENDİ yüklediği reklam dosyası burada DEĞİL: o onay
// kuyruğundan geçiyor (src/lib/media.js → `ads`). İkisini tek depoda
// tutmak "bizim tanıtımımız" ile "müşterinin bize gönderdiği dosya"yı
// karıştırırdı; birinin onaya ihtiyacı var, diğerinin yok.
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
 * Her hizmetin tanıtım yuvası. Hepsi görsel VE video kabul ediyor: bir
 * hizmeti kimi zaman tek kare anlatıyor, kimi zaman on saniyelik bir
 * ekran kaydı gerekiyor — hangisinin doğru olduğuna yükleyen karar verir.
 *
 * Boyut sınırı gerçek: data URL olarak localStorage'a yazılıyor ve
 * 5 MB'lık tarayıcı kotası tek bir videoyla dolar.
 */
export const SLOTS = {
  bannerAds: {
    label: "Keşfet banner'ı tanıtımı", accept: "image/*,video/*", maxMB: 4,
    hint: "Banner'ın Keşfet ekranında nasıl göründüğünü gösteren örnek kare ya da kısa ekran kaydı.",
  },
  rewardedAds: {
    label: "Ödüllü video tanıtımı", accept: "image/*,video/*", maxMB: 4,
    hint: "Ödüllü video akışının örneği. Kullanıcı izleyip kaydırma hakkı kazanıyor — işletme burada ne satın aldığını görür.",
  },
  pushAds: {
    label: "Push bildirimi tanıtımı", accept: "image/*,video/*", maxMB: 4,
    hint: "Bildirimin telefonda nasıl göründüğünü gösteren örnek.",
  },
  instantDeals: {
    label: "Anlık fırsat tanıtımı", accept: "image/*,video/*", maxMB: 4,
    hint: "Fırsat kartının kullanıcı ekranındaki hâli.",
  },
  gastroPackage: {
    label: "Gastro şef videosu tanıtımı", accept: "image/*,video/*", maxMB: 5,
    hint: "Örnek şef çekimi. İşletme çekimin kalitesini görmeden bu pakete teklif istemiyor.",
  },
  secondChance: {
    label: "İkinci Şans tanıtımı", accept: "image/*,video/*", maxMB: 4,
    hint: "Paketin nasıl çalıştığını anlatan örnek kare ya da kısa video.",
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
    live: false,                       // işletmelere görünür mü — yönetici açar
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

/** İşletmelere göster / gizle. Yüklemek göstermek değil — yönetici
 *  dosyayı önce yükleyip sonra kontrol edip açabilsin. */
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

/**
 * İşletme panelinin göreceği tanıtım — yalnızca `live` olan ve EN YENİ
 * olan. Bir hizmetin birden fazla tanıtımı açık bırakılırsa panelde
 * hepsini dizmek yerine sonuncusu gösteriliyor: kart bir tanıtım için
 * yer ayırıyor, galeri için değil.
 */
export function promoFor(streamKey, state = read()) {
  return listFor(streamKey, state).find(x => x.live) || null;
}

/** Önizlemede `<video>` mi `<img>` mi — tek yerden sorulsun. */
export function isVideo(f) {
  return !!f && String(f.type || "").startsWith("video/");
}
