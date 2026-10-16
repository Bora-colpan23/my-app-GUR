// ═══════════════════════════════════════════════════════════════════════
// YEREL DEPO — AsyncStorage üstünde tek durum
//
// Web tarafında her konu kendi localStorage anahtarında duruyor; mobilde
// AsyncStorage ASENKRON olduğu için hepsi TEK kayıtta ve BELLEKTE bir
// anlık görüntü üzerinden okunuyor. Ekranlar `useDepo()` ile abone
// oluyor; hiçbir ekran "yüklendi mi" diye beklemiyor — açılışta
// varsayılan durum geçerli, hidrasyon bitince yeniden çiziliyor.
//
// ANLIK GÖRÜNTÜ REFERANSI SABİT KALMALI: `useSyncExternalStore` her
// çağrıda yeni nesne dönen bir getSnapshot ile sonsuz döner. Bu yüzden
// `durum` yalnızca gerçekten değiştiğinde yeni nesneye dönüşüyor.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANAHTAR = 'gur.mobil.v1';

const VARSAYILAN = {
  riza: null,              // null = sorulmadı | "kabul" | "ret"
  kullanici: null,         // { ad, email }
  favoriler: [],           // restoran id listesi
  gecilen: [],             // sola kaydırılanlar — İkinci Şans'ın hedefi
  superBegeni: [],         // yukarı kaydırılanlar
  yorumlar: {},            // { [restoranId]: [{ puan, metin, tarih, dogrulandi }] }
  konum: null,             // { kaynak: "cihaz"|"elle", lat, lon, ilce }
  acilisGoruldu: false,    // ikinci açılışta kısa splash
};

let durum = VARSAYILAN;
let hidrasyon = null;
const dinleyiciler = new Set();

const duyur = () => { for (const d of dinleyiciler) d(); };

export function abone(fn) { dinleyiciler.add(fn); return () => dinleyiciler.delete(fn); }
export function oku() { return durum; }

export function hidrateEt() {
  if (hidrasyon) return hidrasyon;
  hidrasyon = AsyncStorage.getItem(ANAHTAR)
    .then(ham => {
      if (!ham) return durum;
      try {
        const o = JSON.parse(ham);
        durum = { ...VARSAYILAN, ...(o && typeof o === 'object' ? o : null) };
      } catch { /* bozuk kayıt: varsayılanla devam, kullanıcı kilitlenmesin */ }
      duyur();
      return durum;
    })
    .catch(() => durum);
  return hidrasyon;
}

/** Durumu günceller ve diske yazar. Yazma hatası YUTULMUYOR değil —
 *  konsola düşüyor; sessizce kaybetmek en kötü sonuç. */
export function yaz(parca) {
  const yeni = typeof parca === 'function' ? parca(durum) : parca;
  durum = { ...durum, ...yeni };
  duyur();
  AsyncStorage.setItem(ANAHTAR, JSON.stringify(durum)).catch(e => {
    console.warn('GUR: yerel depoya yazılamadı', e?.message);
  });
  return durum;
}

export function useDepo() {
  return useSyncExternalStore(abone, oku, oku);
}

// ─── Kısayollar ──────────────────────────────────────────────────────
export const favoriMi = (id) => durum.favoriler.includes(String(id));

export function favoriCevir(id) {
  const k = String(id);
  const v = durum.favoriler.includes(k)
    ? durum.favoriler.filter(x => x !== k)
    : [...durum.favoriler, k];
  return yaz({ favoriler: v });
}

export function gecildi(id) {
  const k = String(id);
  if (durum.gecilen.includes(k)) return durum;
  return yaz({ gecilen: [...durum.gecilen, k] });
}

export function superBegenildi(id) {
  const k = String(id);
  const fav = durum.favoriler.includes(k) ? durum.favoriler : [...durum.favoriler, k];
  if (durum.superBegeni.includes(k)) return yaz({ favoriler: fav });
  return yaz({ superBegeni: [...durum.superBegeni, k], favoriler: fav });
}

export function yorumEkle(id, yorum) {
  const k = String(id);
  const mevcut = durum.yorumlar[k] || [];
  return yaz({ yorumlar: { ...durum.yorumlar, [k]: [yorum, ...mevcut] } });
}

export function hepsiniSil() {
  durum = VARSAYILAN;
  duyur();
  return AsyncStorage.removeItem(ANAHTAR).catch(() => {});
}
