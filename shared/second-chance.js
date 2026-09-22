// ═══════════════════════════════════════════════════════════════════════
// İKİNCİ ŞANS — paket kuralları (istemci ve sunucu ortak)
//
// Kotanın ne zaman bittiği, aynı kullanıcıya günde kaç kez gösterileceği
// ve bir restoranın ikinci paket alıp alamayacağı iki tarafta da AYNI
// olmalı. İki yerde ayrı yazılırsa biri sessizce kayar: sunucu paketi
// bitmiş sayarken istemci göstermeye devam eder.
// ═══════════════════════════════════════════════════════════════════════

export const PACKAGE = {
  /** Kaç FARKLI kullanıcının destesine geri eklenecek. */
  reach: 200,
  /** Haftalık paket; kota bitmezse süre sonunda kapanır. */
  weekMs: 7 * 24 * 3600 * 1000,
  /** Aynı kullanıcıya günde en fazla bir kez. */
  perUserPerDay: 1,
  /** Liste fiyatı (kuruş). Gerçek tutar yöneticinin teklifinden gelir. */
  priceMinor: 145000,
};

/** Restoranın aktif paketi varsa ikincisi alınamaz. */
export function canActivate(packages = [], restaurantId) {
  return !packages.some(p =>
    String(p.restaurantId) === String(restaurantId) && p.status === "active");
}

export function isExhausted(p) {
  if (!p) return true;
  if (p.used >= p.quota) return true;
  return p.endsAt ? Date.parse(p.endsAt) <= Date.now() : false;
}

/** Aynı kullanıcı + aynı gün → bir daha gösterme. */
export function alreadyShownToday(impressions = {}, packageId, userKey, day) {
  return impressions[`${packageId}|${userKey}`]?.gun === day;
}
