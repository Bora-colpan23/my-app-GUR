// ═══════════════════════════════════════════════════════════════════════
// SAHİPLENME DAVETLERİ — havuzdaki mekana "kaydını sahiplen" çağrısı
//
// Havuz dış beslemeden doluyor; oradaki mekanların çoğunun bizde hesabı
// yok. Yönetici onları sahiplenmeye davet ediyor.
//
// TAŞIMA HAKKINDA DÜRÜST OLMAK GEREKİYOR:
//   • Google Places API e-posta adresi DÖNDÜRMEZ — böyle bir alanı yok.
//     Havuzdaki e-postalar mekanın kendi bildirdiği OSM `email` /
//     `contact:email` etiketinden geliyor; çoğu kayıtta yok.
//   • Projede sunucu tarafı posta taşıması da yok (SMTP/nodemailer
//     kurulu değil). Bu yüzden davet, yöneticinin kendi posta
//     istemcisinde hazır bir taslak olarak açılıyor (mailto:) —
//     gönderildi numarası yapmıyoruz.
//
// Gerçek dağıtımda buranın yerine sunucuda bir kuyruk gelir: bu depo
// zaten "kime, ne zaman, hangi adrese" kaydını tuttuğu için arayüz
// değişmeden sunucuya taşınabilir.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

const KEY = "gur.invites";
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

export function useInvites() {
  return useSyncExternalStore(subscribe, read, read);
}

export function inviteOf(restaurantId, map = read()) {
  return map[String(restaurantId)] || null;
}

/** Mekanın davet edilebilir bir kanalı var mı — yoksa arayüz bunu söyler. */
export function channelOf(r) {
  if (r?.email) return { kind: "email", value: r.email };
  if (r?.website) return { kind: "website", value: r.website };
  if (r?.phone) return { kind: "phone", value: r.phone };
  return null;
}

/** Davet metni. Konu ve gövde tek yerde: iki farklı yerden iki farklı
 *  davet gitmesin. */
export function draft(r) {
  const konu = `GUR'da ${r.name} kaydını sahiplenin`;
  const govde = [
    `Merhaba ${r.name} ekibi,`,
    ``,
    `GUR, İstanbul'da restoran keşif platformu. ${r.district} bölgesindeki`,
    `kaydınız şu anda açık kaynaklardan derlenmiş bilgilerle listeleniyor.`,
    ``,
    `Kaydınızı sahiplenirseniz menünüzü, fotoğraflarınızı ve çalışma`,
    `saatlerinizi kendiniz yönetebilir, gelen rezervasyon taleplerini`,
    `görebilirsiniz. Sahiplenme ücretsiz.`,
    ``,
    `Sahiplenmek için: https://gur.app/isletme`,
    ``,
    `İyi çalışmalar,`,
    `GUR Ekibi`,
  ].join("\n");
  return { konu, govde };
}

/** Posta istemcisinde hazır taslak açar ve daveti kaydeder. */
export function sendInvite(r) {
  const kanal = channelOf(r);
  if (!kanal || kanal.kind !== "email") return false;
  const { konu, govde } = draft(r);
  const url = `mailto:${encodeURIComponent(kanal.value)}`
    + `?subject=${encodeURIComponent(konu)}&body=${encodeURIComponent(govde)}`;
  try { window.open(url, "_self"); } catch { /* istemci yoksa yoksay */ }
  mark(r, kanal);
  return true;
}

/** Kanalı olmayan mekan için: davet denendi diye işaretlemeden kayıt
 *  tutmak yanlış olurdu; yalnızca elle "not düş" için. */
export function mark(r, kanal = channelOf(r)) {
  const cur = read();
  write({
    ...cur,
    [String(r.id)]: { at: new Date().toISOString(), kanal: kanal?.kind || null, adres: kanal?.value || null },
  });
}

export function clearInvite(restaurantId) {
  const cur = { ...read() };
  delete cur[String(restaurantId)];
  write(cur);
}
