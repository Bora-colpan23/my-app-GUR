// ═══════════════════════════════════════════════════════════════════════
// İŞLETME DOSYALARI — menü, fotoğraf, reklam materyali (ONAY KUYRUKLU)
//
// Önceden işletme panelindeki menü ve fotoğraf yüklemeleri React state'te
// duruyordu (`ownerMedia`, blob URL): sayfa yenilenince kayboluyor,
// yönetici panelinden görünmüyor, tüketiciye hiç ulaşmıyordu. Yönetici
// panelindeki menü listesi de tohumlanmış sahte veriydi — tıklanacak
// gerçek bir dosya yoktu.
//
// Artık tek depo var ve üç uygulama da buradan okuyor:
//
//   işletme yükler (pending) → yönetici ÖNİZLER ve karar verir
//        → approved: tüketici uygulamasında görünür
//        → rejected: yalnızca işletme görür, sebebiyle
//
// NEDEN moderation.js'e KOYMADIK. Orası ALAN değişikliği kuyruğu: bir
// mekanın tek bekleyen talebi olur ve talep bütün olarak onaylanır.
// Dosya öyle değil — beş menü sayfasının üçü geçip ikisi kalabilmeli.
// Tek kayıtta tutmak "menü bekliyor" ile "menünün 2. sayfası bekliyor"
// durumlarını birbirine karıştırırdı. Aynı ayrımın dosya tarafı burası.
//
// DOSYALAR data URL. Sunucu yok; blob URL yalnızca onu üreten belgede
// geçerli ve yenilemede ölüyor — yönetici paneli ayrı bir rota olduğu
// için oradan hiç okunamazdı. Görseller yazılmadan önce küçültülüyor
// (bkz. src/lib/image.js → fileToFittedDataUrl), yoksa üç telefon
// fotoğrafı tarayıcı kotasını dolduruyor.
//
// Gerçek dağıtımda buranın yerine bir nesne deposu (S3/R2) + sunucuda
// bir onay tablosu gelir. Arayüz `url` ve `status` okuduğu için
// değişmesi gerekmiyor.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { fileToFittedDataUrl } from "./image.js";

const KEY = "gur.media";
const listeners = new Set();

// Anlık görüntü HAM METNE göre önbellekleniyor (b2b.js / pricing.js ile
// aynı kalıp). Önceden `if (cache) return cache` vardı ve önbellek yalnızca
// kendi `write()`imizle tazeleniyordu: yönetici BAŞKA BİR SEKMEDE dosyayı
// onayladığında işletme sekmesi bunu hiç görmüyor, sayfa yenilenene kadar
// "İncelemede" yazmaya devam ediyordu. Projedeki diğer depolar bunu zaten
// doğru yapıyordu; burası tek istisnaydı.
//
// Referansın ham metin değişmediği sürece SABİT kalması şart:
// useSyncExternalStore her çağrıda yeni nesne görürse sonsuz döner.
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
  try { metin = JSON.stringify(next); } catch { metin = null; }
  try { localStorage.setItem(KEY, metin); }
  catch {
    // Kota taştı. SESSİZCE YUTMUYORUZ: çağıran yer kullanıcıya
    // söyleyebilsin. Yüklediğini sanıp kaybetmek en kötü sonuç.
    // Önbelleği GÜNCELLEMEDEN atıyoruz: yazılamayan veriyi yazılmış
    // göstermek, kaybı bir de gizlemek olurdu.
    throw new Error("Dosya tarayıcı deposuna sığmadı. Daha küçük bir dosya deneyin ya da eski dosyaları silin.");
  }
  snap = { raw: metin, value: next };
  for (const l of listeners) l();
  try { window.dispatchEvent(new Event("gur:media")); } catch { /* SSR */ }
}
function subscribe(fn) {
  listeners.add(fn);
  const disaridan = () => fn();
  window.addEventListener("storage", disaridan);     // başka sekme
  window.addEventListener("gur:media", disaridan);   // aynı sekme, diğer rota
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", disaridan);
    window.removeEventListener("gur:media", disaridan);
  };
}

export function useMedia() {
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * Dört tür, dört ayrı kural. `shrink` görselin uzun kenarı: menü sayfası
 * okunabilir kalmalı (1600), mekan fotoğrafı kart boyunda yeter (1280).
 *
 * REKLAM MATERYALİ YERLEŞİME GÖRE AYRI. Önceden tek bir `ads` havuzu vardı
 * ve iki tüketici de oradan besleniyordu; ayrımı yalnızca MIME tipi
 * yapıyordu — banner ilk GÖRSEL'i, ödüllü video ilk VİDEO'yu alıyordu.
 * İki sorun doğuruyordu:
 *
 *   1. Ödüllü videoda `|| liste[0]` yedeği vardı: restoran yalnızca banner
 *      görseli yüklediyse ödüllü video yuvasında hareketsiz bir JPEG
 *      "oynuyordu". Kullanıcı süresi olmayan bir reklamı izlemiş sayılıp
 *      hak kazanıyordu.
 *   2. İşletme hangi dosyanın nereye gittiğini göremiyordu: tek kutuya bir
 *      dosya bırakıp ikisini birden doldurduğunu sanıyordu.
 *
 * Artık her yerleşimin kendi kutusu, kendi `accept`i ve kendi ölçü tarifi
 * var. Yanlış türü yüklemek dosya seçicide zaten mümkün değil.
 */
export const KINDS = {
  menu: {
    label: "Menü", tekil: "Menü sayfası", accept: "image/*", maxMB: 8, shrink: 1600,
    hint: "Menü sayfalarının fotoğrafı ya da taraması. Yazılar okunabilir olmalı.",
  },
  photos: {
    label: "Fotoğraflar", tekil: "Mekan fotoğrafı", accept: "image/*", maxMB: 8, shrink: 1280,
    hint: "Mekan ve yemek fotoğrafları. Keşif kartınızda ilk sırada gösterilir.",
  },
  bannerAds: {
    label: "Keşfet banner'ı", tekil: "Banner görseli", accept: "image/*", maxMB: 4, shrink: 1600,
    slot: "Keşfet ekranının üstündeki dönen banner",
    hint: "Keşfet ekranının üstündeki dönen banner'da çıkacak görsel. Yatay kullanılır; yazıyı ortaya yakın tutun, kenarlar kırpılabilir.",
  },
  rewardedAds: {
    label: "Ödüllü video", tekil: "Ödüllü video dosyası", accept: "video/*", maxMB: 4,
    slot: "Kaydırma hakkı kazandıran ödüllü reklam",
    hint: "Kullanıcının kaydırma hakkı kazanmak için sonuna kadar izlediği video. Dikey ve kısa tutun; ses olmadan da anlaşılmalı.",
  },
};

export const KIND_LIST = Object.keys(KINDS);

/** Reklam yerleşimleri — işletme paneli ve yönetici bu listeden geçiyor. */
export const AD_KINDS = ["bannerAds", "rewardedAds"];

const bosMekan = () => ({ menu: [], photos: [], bannerAds: [], rewardedAds: [] });

/**
 * Eski tek havuzlu kayıtları yerleşimlere dağıtır.
 *
 * OKUMA ANINDA yapılıyor, depoyu yeniden yazmadan: taşıma betiği yazmak
 * için tarayıcıda bir "ilk açılış" kancası gerekirdi ve o kanca
 * çalışmadan okuyan bir ekran boş liste görürdü. Dosya videoysa ödüllü
 * video, değilse banner — eski ayrımın aynısı, ama bir kez ve tek yerde.
 */
function tasi(kayit) {
  const eski = kayit.ads;
  if (!Array.isArray(eski) || !eski.length) return kayit;
  const video = [], gorsel = [];
  for (const f of eski) (String(f.type || "").startsWith("video/") ? video : gorsel).push(f);
  const { ads, ...kalan } = kayit;   // eslint-disable-line no-unused-vars
  return {
    ...kalan,
    bannerAds: [...(kayit.bannerAds || []), ...gorsel],
    rewardedAds: [...(kayit.rewardedAds || []), ...video],
  };
}

function mekan(state, restaurantId) {
  return tasi({ ...bosMekan(), ...(state[String(restaurantId)] || {}) });
}

// ─── Okuma ───────────────────────────────────────────────────────────────

export function listMedia(restaurantId, kind, state = read()) {
  if (restaurantId == null) return [];
  return mekan(state, restaurantId)[kind] || [];
}

/** Tüketiciye YALNIZCA onaylanmış dosya çıkar. Tek kapı burası. */
export function approvedMedia(restaurantId, kind, state = read()) {
  return listMedia(restaurantId, kind, state).filter(f => f.status === "approved");
}

/**
 * `withOwnerMedia`nın beklediği biçim. Tüketici uygulaması onaylanmamış
 * hiçbir dosyayı görmüyor — süzgeç burada, çağrı yerlerinde değil:
 * iki ekran ayrı ayrı süzseydi biri er geç unutulurdu.
 */
export function ownerMediaFor(restaurantId, state = read()) {
  return {
    photos: approvedMedia(restaurantId, "photos", state),
    menu: approvedMedia(restaurantId, "menu", state),
  };
}

/** Yöneticinin önündeki bütün bekleyen dosyalar, eskiden yeniye. */
export function pendingAll(state = read()) {
  const cikti = [];
  for (const [rid, ham] of Object.entries(state)) {
    // Eski `ads` kayıtları burada da yerleşimlere dağılmalı; yoksa yönetici
    // kuyruğunda görünmez ama işletme panelinde "beklemede" yazardı.
    const kinds = tasi(ham);
    for (const kind of KIND_LIST) {
      for (const f of kinds[kind] || []) {
        if (f.status === "pending") cikti.push({ ...f, restaurantId: rid, kind });
      }
    }
  }
  return cikti.sort((a, b) => (a.at < b.at ? -1 : 1));
}

export function pendingCount(state = read()) {
  return pendingAll(state).length;
}

/** İşletme panelindeki rozet: bu türde kaç dosya incelemede. */
export function pendingCountFor(restaurantId, kind, state = read()) {
  return listMedia(restaurantId, kind, state).filter(f => f.status === "pending").length;
}

/**
 * İşletmenin "onay durumu" şeridi. Türü olmayan (hiç dosya yüklenmemiş)
 * satırlar dışarıda kalır: boş bir "0 bekliyor" satırı bilgi taşımıyor.
 */
export function statusSummary(restaurantId, state = read()) {
  return KIND_LIST.map(kind => {
    const hepsi = listMedia(restaurantId, kind, state);
    return {
      kind, label: KINDS[kind].label,
      pending: hepsi.filter(f => f.status === "pending").length,
      approved: hepsi.filter(f => f.status === "approved").length,
      rejected: hepsi.filter(f => f.status === "rejected").length,
      total: hepsi.length,
    };
  }).filter(x => x.total > 0);
}

// ─── Yazma ───────────────────────────────────────────────────────────────

function dataUrlOku(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error("Dosya okunamadı."));
    fr.readAsDataURL(file);
  });
}

/**
 * Yükleme. Kayıt her zaman `pending` doğar — "yükledim, yayında" diye bir
 * yol YOK; onay kapısı burada, arayüzde değil. Arayüzde olsaydı ikinci bir
 * yükleme noktası eklendiğinde kapı atlanabilirdi.
 *
 * Boyut kontrolü de burada ve küçültmeden ÖNCE: 40 MB'lık bir dosyayı
 * önce tuvale çizip sonra reddetmek sekmeyi kilitliyor.
 */
export async function addMedia(restaurantId, kind, file, { note = "", streamKey = null } = {}) {
  const k = KINDS[kind];
  if (!k) throw new Error("Bilinmeyen dosya türü: " + kind);
  if (restaurantId == null) throw new Error("Restoran belirtilmedi.");

  const mb = file.size / (1024 * 1024);
  if (mb > k.maxMB) {
    throw new Error(`Dosya ${mb.toFixed(1)} MB — bu alanın sınırı ${k.maxMB} MB.`);
  }

  const gorsel = (file.type || "").startsWith("image/");
  // Video küçültülemiyor (tuval yalnızca kareyi alır, sesi ve süreyi
  // kaybederdik). Sınır o yüzden videoda gerçek sınır.
  const url = gorsel ? await fileToFittedDataUrl(file, k.shrink) : await dataUrlOku(file);

  const kayit = {
    id: `md-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name,
    type: file.type || (gorsel ? "image/jpeg" : "application/octet-stream"),
    sizeMB: +mb.toFixed(2),
    url, note, streamKey,
    status: "pending",
    reason: null,
    at: new Date().toISOString(),
    decidedAt: null,
  };

  const state = read();
  const key = String(restaurantId);
  const cur = mekan(state, key);
  write({ ...state, [key]: { ...cur, [kind]: [kayit, ...cur[kind]] } });
  return kayit;
}

/** Yönetici kararı. `status`: "approved" | "rejected". */
export function decideMedia(restaurantId, kind, id, status, reason = null) {
  const state = read();
  const key = String(restaurantId);
  const cur = mekan(state, key);
  write({ ...state, [key]: { ...cur, [kind]: cur[kind].map(f =>
    f.id === id ? { ...f, status, reason, decidedAt: new Date().toISOString() } : f) } });
}

export function removeMedia(restaurantId, kind, id) {
  const state = read();
  const key = String(restaurantId);
  const cur = mekan(state, key);
  write({ ...state, [key]: { ...cur, [kind]: cur[kind].filter(f => f.id !== id) } });
}

/**
 * Okunur boyut. 163 baytlık bir dosya için "0 MB" yazmak yanlış değil ama
 * bilgi de taşımıyor — küçük dosyalarda KB'ye iniyoruz.
 */
export function sizeLabel(mb) {
  const n = Number(mb) || 0;
  if (n < 0.1) return `${Math.max(1, Math.round(n * 1024))} KB`;
  return `${n.toFixed(n < 10 ? 1 : 0)} MB`;
}

/** Önizlemede `<video>` mı `<img>` mi çizileceği tek yerden sorulsun. */
export function isVideo(f) {
  return !!f && String(f.type || "").startsWith("video/");
}
