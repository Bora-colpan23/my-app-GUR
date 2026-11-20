// ═══════════════════════════════════════════════════════════════════════
// YÖNETİCİ KARARLARI: yerel depo ↔ Supabase
//
// Panelin görünürlük / moderasyon / ilçe kararları yerel depolarda duruyor
// (lib/platform.js, lib/moderation.js) ve ekranlar onları okuyor. Supabase
// modunda SUNUCU gerçeğin kaynağıdır; bu modül iki iş yapıyor:
//
//   hydrate()  — girişte sunucudaki durumu yerel depolara yazar, ekranlar
//                bir şey değiştirmeden doğru değeri gösterir
//   push*()    — kararı ÖNCE yerele (anında tepki), sonra sunucuya yazar;
//                sunucu reddederse yereli GERİ ALIR ve yöneticiye söyler
//
// Geri alma şart: sunucuya yazılamayan bir "gizle" yerelde gizli görünse
// yönetici mekânın uygulamadan kalktığını sanırdı, oysa kalkmadı.
// ═══════════════════════════════════════════════════════════════════════

import * as sb from "./admin-supabase.js";
import { setRestaurantHidden, isRestaurantHidden, setDistrictOpen, isDistrictOpen, districtDefaultOpen } from "./platform.js";
import { decideVenue, venueStatus } from "./moderation.js";

let bildir = () => {};
/** Kök bileşen hata mesajlarını nasıl göstereceğini buradan bağlar. */
export function onSyncError(fn) { bildir = fn || (() => {}); }

function hataMesaji(e) { return `Sunucuya kaydedilemedi: ${e?.message || "bilinmeyen hata"}`; }

/** Girişte: sunucu durumunu yerel depolara uygula. Gastro durumunu döndürür. */
export async function hydrate() {
  const [rows, ilceler] = await Promise.all([sb.listRestaurants(), sb.getDistricts()]);
  const gastro = new Map();
  for (const r of rows) {
    gastro.set(r.id, { gastro: !!r.gastro, chef: r.gastroChef || null });
    if (isRestaurantHidden(r.id) === !!r.active) setRestaurantHidden(r.id, !r.active);
    if (venueStatus(r.id) !== r.review) decideVenue(r.id, r.review);
  }
  for (const d of ilceler || []) {
    if (isDistrictOpen(d.name) !== !!d.open) setDistrictOpen(d.name, !!d.open);
  }
  return { gastro, count: rows.length };
}

async function yaz(yerelUygula, yerelGeriAl, sunucuyaYaz) {
  yerelUygula();
  try { await sunucuyaYaz(); return true; }
  catch (e) { yerelGeriAl(); bildir(hataMesaji(e)); return false; }
}

export const pushHidden = (id, hidden) => yaz(
  () => setRestaurantHidden(id, hidden),
  () => setRestaurantHidden(id, !hidden),
  () => sb.setRestaurant(id, { active: !hidden }));

export function pushVenueDecision(id, status) {
  const onceki = venueStatus(id);
  return yaz(
    () => decideVenue(id, status),
    () => decideVenue(id, onceki),
    () => sb.setRestaurant(id, { review: status }));
}

export function pushDistrict(name, open) {
  const onceki = isDistrictOpen(name);
  // Varsayılana dönülünce sunucudaki karar SİLİNİR (yalnızca varsayılandan
  // AYRILAN kararlar saklanır — platform.js ile aynı kural).
  const sunucuDegeri = open === districtDefaultOpen(name) ? null : open;
  return yaz(
    () => setDistrictOpen(name, open),
    () => setDistrictOpen(name, onceki),
    () => sb.setDistrict(name, sunucuDegeri));
}

/** Gastro yerel state'te tutuluyor; yazma başarısızsa çağıran geri alır. */
export async function pushGastro(id, on) {
  try { await sb.setRestaurant(id, { gastro: on }); return true; }
  catch (e) { bildir(hataMesaji(e)); return false; }
}
