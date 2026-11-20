// ═══════════════════════════════════════════════════════════════════════
// YEREL DURUM ↔ SUNUCU — ekranların çağırdığı tek yer
//
// KURAL: YEREL DEPO HER ZAMAN ÖNCE YAZILIR, sunucu en iyi çabayla izler.
// Kullanıcı kalbe bastığında ağın cevap vermesini beklemez; sunucu "hayır"
// derse ya da ağ yoksa ekran değişmez. Tersi (önce sunucu) uçuş modunda
// uygulamayı kullanılamaz yapardı.
//
// Çevrimdışı BİRİKME KUYRUĞU YOK: düşen çağrı kaybolur, ama bir sonraki
// açılışta `senkronla()` cihazdaki favorileri hesaba tamamlar (kota ve
// ücretlendirmeye dokunmadan). Bu yüzden eşitleme BİRLEŞİM: iki yandaki
// favoriler birleşir. Bedeli: çevrimdışıyken kaldırılan bir favori, sunucuda
// duruyorsa bir sonraki eşitlemede geri gelir (silme izi tutmuyoruz).
// ═══════════════════════════════════════════════════════════════════════

import * as depo from './depo.js';
import * as api from './api.js';

/** Kaydırma kararı: yerel + sunucu. Sponsorluysa kampanya kimliği SUNUCUYA gider (ücretlendirme orada). */
export function karar(yon, r) {
  // Sağa kaydırma KAYDEDER, geçiş yapmaz (sunucudaki anlamla aynı): kart zaten
  // favoriyse sağa kaydırmak onu favoriden ÇIKARMAMALI.
  if (yon === 'sag') depo.favoriEkle(r.id);
  else if (yon === 'sol') depo.gecildi(r.id);
  else if (yon === 'yukari') depo.superBegenildi(r.id);
  api.kaydirmayiGonder({
    restaurantId: r.id, yon,
    kampanyaId: r.sponsored?.campaignId ?? null,
    sira: Number.isFinite(r.deckPosition) ? r.deckPosition : null,
  });
}

/** Sponsorlu kart ekranda göründü: gösterim kaydı + bu kullanıcıya bir daha gösterme. */
export function gosterildi(r) {
  const id = r?.sponsored?.campaignId;
  if (!id) return;
  depo.kampanyaGorulduIsaretle(id);
  api.gosterimYaz({ kampanyaId: id, restaurantId: r.id, sira: Number.isFinite(r.deckPosition) ? r.deckPosition : null });
}

/** Kalp düğmesi (Keşfet / Detay / Favoriler). */
export function favoriDegistir(id) {
  const oncekiFavori = depo.favoriMi(id);
  depo.favoriCevir(id);
  // Ekleme kaydırma değil: kotadan düşmez, `gur_sync_saved` ile yazılır.
  if (oncekiFavori) api.favoriKaldir(id);
  else api.kayitlilariEsitle([id], []);
}

export function rizaKarari(k) {
  depo.yaz({ riza: k });
  api.rizaGonder(k === 'kabul');
}

/**
 * Oturum açık + CANLI ise: hesaptaki kayıtlılarla cihazdakileri birleştirir
 * ve hesapta olmayanları hesaba yazar; cihazdaki rıza kararını hesaba işler.
 * Giriş sonrası ve her açılışta çağrılır; idempotent.
 */
export async function senkronla() {
  if (!api.canliMi() || !api.oturumVar()) return;
  const sunucu = await api.kayitlilariGetir();
  if (!sunucu) return;                                   // ağ yok: dokunma

  const yerel = depo.oku();
  const sunucuId = new Set(sunucu.map(k => k.id));
  const sunucuSuper = new Set(sunucu.filter(k => k.super).map(k => k.id));

  depo.yaz({
    favoriler: [...new Set([...yerel.favoriler, ...sunucu.map(k => k.id)])],
    superBegeni: [...new Set([...yerel.superBegeni, ...sunucuSuper])],
  });

  const eksik = yerel.favoriler.filter(id => !sunucuId.has(id));
  const eksikSuper = yerel.superBegeni.filter(id => !sunucuSuper.has(id));
  if (eksik.length || eksikSuper.length) await api.kayitlilariEsitle(eksik, eksikSuper);

  if (yerel.riza) await api.rizaGonder(yerel.riza === 'kabul');
}
/** Hesabı siler. Sunucu silemezse yerel veri de SİLİNMEZ (yarım silme yok). */
export async function hesabiSil() {
  const s = await api.hesabiSil();
  if (s.hata) return s;
  await depo.hepsiniSil();
  return { ok: true };
}
