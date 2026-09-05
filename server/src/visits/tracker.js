// ═══════════════════════════════════════════════════════════════════════
// Konum doğrulamalı ziyaret.
//
// İstemci arka planda periyodik konum örneği gönderir. Sunucu:
//   1. Örneği yakındaki mekanla eşler, açık ziyareti tazeler.
//   2. Yeterli süre + yeterli hassasiyet birikince ziyareti "confirmed" yapar.
//   3. Ziyaretten bir süre sonra "deneyim nasıldı" bildirimini kuyruğa alır.
//   4. Yorum yazma kilidi yalnızca doğrulanmış ziyaretle açılır.
//
// Ham konum sunucuda saklanmaz: yalnızca mesafe ve hassasiyet özeti tutulur.
// ═══════════════════════════════════════════════════════════════════════

import { logEvent } from "../analytics/events.js";

export const VISIT_RULES = {
  // Mekânın kabul yarıçapı. Şehir içinde GPS hatası 20-40 m; 120 m
  // bitişikteki mekânı yanlışlıkla saymayacak kadar dar, kapalı mekânda
  // sinyal kaybını affedecek kadar geniş.
  radiusM: 120,
  // Bu değerden kötü hassasiyetteki örnek karar için sayılmaz.
  maxAccuracyM: 100,
  // Ziyaret sayılması için gereken en az kalış süresi.
  minDwellSeconds: 15 * 60,
  // Örnekler arası bu kadar boşluk olursa ziyaret kapanmış sayılır.
  gapSeconds: 20 * 60,
  // Ziyaret kapandıktan ne kadar sonra "nasıldı" diye sorulur.
  promptDelayMinutes: 90,
  // Aynı mekan için bu süre içinde ikinci kez sorulmaz.
  cooldownHours: 20,
};

/**
 * Tek konum örneğini işler.
 * sample: { lat, lng, accuracyM, at }
 */
export async function ingestLocationSample(db, userId, sample) {
  const { lat, lng, accuracyM, at = new Date() } = sample;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { matched: null };
  if (accuracyM != null && accuracyM > VISIT_RULES.maxAccuracyM) return { matched: null, reason: "low_accuracy" };

  // En yakın aktif mekan — yarıçap içinde birden çoksa en yakını kazanır.
  const { rows: [near] } = await db.query(
    `SELECT r.id, r.name,
            earth_distance(ll_to_earth($1,$2), ll_to_earth(r.lat, r.lng)) AS distance_m
       FROM restaurants r
      WHERE r.is_active
        AND earth_box(ll_to_earth($1,$2), $3) @> ll_to_earth(r.lat, r.lng)
      ORDER BY distance_m ASC
      LIMIT 1`,
    [lat, lng, VISIT_RULES.radiusM]
  );

  if (!near) {
    await closeStaleVisits(db, userId);
    return { matched: null };
  }

  const { rows: [open] } = await db.query(
    `SELECT id, first_seen_at, last_seen_at, dwell_seconds, confirmed_at, sample_count
       FROM visits
      WHERE user_id = $1 AND restaurant_id = $2 AND status = 'open'
      ORDER BY first_seen_at DESC LIMIT 1`,
    [userId, near.id]
  );

  if (!open) {
    // Yakın geçmişte bu mekan için zaten sorulduysa yeni ziyaret açma.
    const { rows: [recent] } = await db.query(
      `SELECT 1 FROM visits
        WHERE user_id = $1 AND restaurant_id = $2
          AND first_seen_at > now() - ($3 || ' hours')::interval
          AND status <> 'abandoned' LIMIT 1`,
      [userId, near.id, VISIT_RULES.cooldownHours]
    );
    if (recent) return { matched: near.id, reason: "cooldown" };

    const { rows: [created] } = await db.query(
      `INSERT INTO visits (user_id, restaurant_id, min_distance_m, best_accuracy_m, sample_count)
       VALUES ($1,$2,$3,$4,1) RETURNING id`,
      [userId, near.id, near.distance_m, accuracyM ?? null]
    );
    return { matched: near.id, visitId: created.id, status: "open" };
  }

  // Kalış süresi = ilk örnekten şimdiye. Aradaki boşluk gapSeconds'ı
  // aşmışsa closeStaleVisits o ziyareti zaten kapatmış olur.
  const dwell = Math.round((new Date(at) - new Date(open.first_seen_at)) / 1000);
  const confirmed = dwell >= VISIT_RULES.minDwellSeconds;

  const { rows: [updated] } = await db.query(
    `UPDATE visits SET
        last_seen_at    = $2,
        dwell_seconds   = $3,
        sample_count    = sample_count + 1,
        min_distance_m  = least(min_distance_m, $4),
        best_accuracy_m = least(coalesce(best_accuracy_m, 9999), coalesce($5, 9999)),
        status          = CASE WHEN $6 AND status = 'open' THEN 'confirmed'::visit_status ELSE status END,
        confirmed_at    = CASE WHEN $6 AND confirmed_at IS NULL THEN now() ELSE confirmed_at END,
        prompt_due_at   = CASE WHEN $6 AND prompt_due_at IS NULL
                               THEN now() + ($7 || ' minutes')::interval ELSE prompt_due_at END
      WHERE id = $1
      RETURNING id, status, dwell_seconds`,
    [open.id, at, dwell, near.distance_m, accuracyM ?? null, confirmed, VISIT_RULES.promptDelayMinutes]
  );

  if (confirmed && !open.confirmed_at) {
    await logEvent(db, { userId, name: "visit_confirmed", restaurantId: near.id,
                         props: { dwellSeconds: dwell, distanceM: Math.round(near.distance_m) } });
    // Kaydedilmiş yer artık "gidilmiş" — 30 günlük bildirim onu atlar.
    await db.query(
      `UPDATE saved_places SET visited_at = now(), last_touch_at = now()
        WHERE user_id = $1 AND restaurant_id = $2`,
      [userId, near.id]
    );
  }

  return { matched: near.id, visitId: updated.id, status: updated.status };
}

/** Örnek gelmeyi kesen açık ziyaretleri kapatır. */
export async function closeStaleVisits(db, userId = null) {
  const { rows } = await db.query(
    `UPDATE visits SET status = CASE
          WHEN dwell_seconds >= $1 THEN 'confirmed'::visit_status
          ELSE 'abandoned'::visit_status END,
        confirmed_at  = CASE WHEN dwell_seconds >= $1 AND confirmed_at IS NULL THEN now() ELSE confirmed_at END,
        prompt_due_at = CASE WHEN dwell_seconds >= $1 AND prompt_due_at IS NULL
                             THEN now() + ($2 || ' minutes')::interval ELSE prompt_due_at END
      WHERE status = 'open'
        AND last_seen_at < now() - ($3 || ' seconds')::interval
        AND ($4::uuid IS NULL OR user_id = $4)
      RETURNING id, status`,
    [VISIT_RULES.minDwellSeconds, VISIT_RULES.promptDelayMinutes, VISIT_RULES.gapSeconds, userId]
  );
  return rows;
}

/**
 * Yorum yazma izni. Kilit yalnızca doğrulanmış ziyaretle açılır ve
 * ziyaret başına tek yorum yazılabilir.
 */
export async function reviewPermission(db, userId, restaurantId) {
  const { rows: [v] } = await db.query(
    `SELECT id, status, confirmed_at
       FROM visits
      WHERE user_id = $1 AND restaurant_id = $2
        AND status IN ('confirmed','prompted')
        AND review_id IS NULL
        AND confirmed_at > now() - interval '14 days'
      ORDER BY confirmed_at DESC LIMIT 1`,
    [userId, restaurantId]
  );
  return v
    ? { allowed: true, visitId: v.id, reason: "verified_visit" }
    : { allowed: false, reason: "no_verified_visit" };
}

/** Doğrulanmış ziyaretten yorum yazar; rozet bu yolla verilir. */
export async function submitVerifiedReview(db, userId, restaurantId, { stars, body, photos = [] }) {
  const perm = await reviewPermission(db, userId, restaurantId);
  if (!perm.allowed) throw Object.assign(new Error("Doğrulanmış ziyaret yok"), { code: "NO_VISIT" });

  const { rows: [review] } = await db.query(
    `INSERT INTO reviews (user_id, restaurant_id, visit_id, stars, body, photos, is_verified)
     VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`,
    [userId, restaurantId, perm.visitId, stars, body, photos]
  );
  await db.query(
    `UPDATE visits SET status = 'reviewed', review_id = $2 WHERE id = $1`,
    [perm.visitId, review.id]
  );
  await logEvent(db, { userId, name: "review_submit", restaurantId, props: { stars, verified: true } });
  return review.id;
}
