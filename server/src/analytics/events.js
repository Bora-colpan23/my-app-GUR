// ═══════════════════════════════════════════════════════════════════════
// Olay kaydı ve gelir bağlama.
//
// Tek giriş noktası: her ürün olayı buradan geçer. Böylece KVKK rızası
// kontrolü, PII temizliği ve gelir bağlama tek yerde yapılır.
// ═══════════════════════════════════════════════════════════════════════

// Ölçümlemeye asla girmemesi gereken alanlar — props'tan sessizce düşer.
const PII_KEYS = new Set(["email", "phone", "name", "displayName", "address", "token", "ip"]);

function scrub(props = {}) {
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (PII_KEYS.has(k)) continue;
    out[k] = typeof v === "object" && v !== null ? JSON.stringify(v).slice(0, 500) : v;
  }
  return out;
}

/**
 * Olayı yazar. Kullanıcı analitik rızası vermediyse olay user_id olmadan,
 * yalnızca toplulaştırma için saklanır — rıza reddi ürün metriklerini
 * tamamen kör etmemeli ama kimseyi de izlememeli.
 */
export async function logEvent(db, { userId, sessionId, name, restaurantId, campaignId, props }) {
  let subject = userId ?? null;
  if (subject) {
    const { rows } = await db.query(`SELECT analytics_optin FROM users WHERE id = $1`, [subject]);
    if (!rows[0]?.analytics_optin) subject = null;
  }
  await db.query(
    `INSERT INTO analytics_events (user_id, session_id, name, restaurant_id, campaign_id, props)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [subject, sessionId ?? null, name, restaurantId ?? null, campaignId ?? null, scrub(props)]
  );
}

/** Toplu yazım — istemci olay tamponunu boşalttığında. */
export async function logBatch(db, userId, events) {
  for (const e of events.slice(0, 200)) {
    await logEvent(db, { ...e, userId });
  }
}

/**
 * Yol tarifi açıldı: hem olay, hem kaydedilmiş yerin "soğuma" saati
 * tazelenir (30 günlük bildirim bunu okur), hem varsa affiliate geliri.
 */
export async function trackDirections(db, userId, restaurantId, { provider, affiliateMinor = 0 }) {
  await logEvent(db, { userId, name: "directions_open", restaurantId, props: { provider } });
  await db.query(
    `UPDATE saved_places SET last_touch_at = now() WHERE user_id = $1 AND restaurant_id = $2`,
    [userId, restaurantId]
  );
  if (affiliateMinor > 0) {
    await db.query(
      `INSERT INTO revenue_events (user_id, restaurant_id, source, amount_minor)
       VALUES ($1,$2,'directions_affiliate',$3)`,
      [userId, restaurantId, affiliateMinor]
    );
  }
}

/**
 * Rezervasyon tamamlandı.
 *
 * KOMİSYON KALDIRILDI. Eskiden burada aracılık edilen cironun %8'i
 * `revenue_events`'e `reservation_commission` olarak yazılıyordu; artık
 * rezervasyon tamamen ücretsiz ve platform ondan gelir elde etmiyor.
 *
 * Olayın kendisi loglanmaya devam ediyor: yönlendirilen ciro (`gmvMinor`)
 * hem işletmeye "GUR sana ne getirdi" diye göstermek hem de kohort/LTV
 * girdisi olarak lazım. Gelir kaydı değil, ETKİ kaydı.
 */
export async function trackReservation(db, userId, restaurantId, { gmvMinor }) {
  await logEvent(db, { userId, name: "reservation_complete", restaurantId, props: { gmvMinor } });
  return 0;
}
