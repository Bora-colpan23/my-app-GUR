// ═══════════════════════════════════════════════════════════════════════
// İKİNCİ ŞANS — sunucu tarafı
//
// Kurallar istemciyle ORTAK modülden okunuyor (shared/second-chance.js):
// kota, günlük tekrar engeli ve "tek aktif paket" iki tarafta ayrı
// yazılsaydı biri sessizce kayardı — sunucu paketi bitmiş sayarken
// istemci göstermeye devam ederdi.
//
// Hedef kitle seçimi buradaki tek zor iş: paketi alan restoranı SOLA
// KAYDIRMIŞ ve bu paketten BUGÜN henüz görmemiş kullanıcılar. Kesişim
// sorguda alınıyor; istemciye "kim hedefte" diye bir liste gitmiyor.
// ═══════════════════════════════════════════════════════════════════════

import { PACKAGE } from "../../../shared/second-chance.js";

/**
 * Paket satın alma.
 *
 * Tek aktif paket kuralı veritabanında kısmi tekil indeksle zorlanıyor
 * (migration 004); burada ayrıca kontrol etmek yarış koşulunu kapatmaz,
 * o yüzden çakışmayı YAKALAYIP anlamlı hataya çeviriyoruz.
 */
export async function purchasePackage(db, { restaurantId, orgId = null, priceMinor = PACKAGE.priceMinor, reach = PACKAGE.reach }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO second_chance_packages (restaurant_id, org_id, price_minor, reach_target, ends_at)
       VALUES ($1, $2, $3, $4, now() + interval '7 days')
       RETURNING *`,
      [restaurantId, orgId, priceMinor, reach]
    );
    return rows[0];
  } catch (e) {
    if (e.code === "23505") {                       // unique_violation
      const err = new Error("Bu restoranın zaten aktif bir İkinci Şans paketi var.");
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

export async function cancelPackage(db, packageId) {
  const { rows } = await db.query(
    `UPDATE second_chance_packages
        SET status = 'cancelled', ended_at = now()
      WHERE id = $1 AND status = 'active'
      RETURNING *`, [packageId]);
  return rows[0] || null;
}

/**
 * Bu kullanıcının destesine geri girecek restoranlar.
 *
 * Üç koşul birden:
 *   1. Paket aktif ve kotası dolmamış.
 *   2. Kullanıcı o restoranı SOLA kaydırmış (hiç görmemişse hedefte değil —
 *      ona zaten organik akışta çıkacak).
 *   3. Bu paketten bugün henüz görmemiş.
 */
export async function secondChanceFor(db, userId, { limit = 5 } = {}) {
  const { rows } = await db.query(
    `SELECT p.id AS package_id, r.*
       FROM second_chance_packages p
       JOIN restaurants r ON r.id = p.restaurant_id
      WHERE p.status = 'active'
        AND p.ends_at > now()
        AND p.reach_used < p.reach_target
        AND r.is_active
        AND r.review_status = 'approved'
        AND EXISTS (
          SELECT 1 FROM swipes s
           WHERE s.user_id = $1 AND s.restaurant_id = r.id AND s.direction = 'left')
        AND NOT EXISTS (
          SELECT 1 FROM second_chance_impressions i
           WHERE i.package_id = p.id AND i.user_id = $1 AND i.shown_on = current_date)
      ORDER BY p.created_at
      LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

/**
 * Gösterim kaydı ve kota ilerlemesi.
 *
 * `reach_used` yalnızca kullanıcı BU PAKETTEN İLK KEZ gördüğünde artıyor:
 * kota "200 farklı kullanıcı", "200 gösterim" değil. Aynı kullanıcının
 * ertesi gün tekrar görmesi sayacı ilerletmez, yalnızca `shown_count`u.
 *
 * Tek deyimde: iki ayrı sorgu arasında paket bitebilirdi.
 */
export async function recordImpression(db, packageId, userId) {
  const { rows } = await db.query(
    `WITH ins AS (
       INSERT INTO second_chance_impressions (package_id, user_id, shown_on)
       VALUES ($1, $2, current_date)
       ON CONFLICT (package_id, user_id, shown_on)
         DO UPDATE SET shown_count = second_chance_impressions.shown_count + 1
       RETURNING (xmax = 0) AS ilk_bugun
     ),
     -- Bu kullanıcı bu paketten daha önce (başka bir gün) görmüş müydü?
     onceki AS (
       SELECT count(*) > 1 AS vardi
         FROM second_chance_impressions
        WHERE package_id = $1 AND user_id = $2
     )
     UPDATE second_chance_packages p
        SET reach_used = p.reach_used + 1,
            status = CASE WHEN p.reach_used + 1 >= p.reach_target THEN 'completed'::second_chance_status ELSE p.status END,
            ended_at = CASE WHEN p.reach_used + 1 >= p.reach_target THEN now() ELSE p.ended_at END
      WHERE p.id = $1
        AND p.status = 'active'
        AND (SELECT NOT vardi FROM onceki)
      RETURNING p.reach_used, p.reach_target, p.status`,
    [packageId, userId]
  );
  return rows[0] || null;
}

/** Süresi dolan paketleri kapatır — cron. */
export async function expirePackages(db) {
  const { rowCount } = await db.query(
    `UPDATE second_chance_packages
        SET status = 'expired', ended_at = now()
      WHERE status = 'active' AND ends_at <= now()`);
  return rowCount;
}
