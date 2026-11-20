// ═══════════════════════════════════════════════════════════════════════
// Bildirim üreten iki job:
//   1. visitReviewPrompts — konumla doğrulanmış ziyaretten sonra
//      "deneyim nasıldı?" sorusu; yorum kilidini açan bağlantıyı taşır.
//   2. reengagement30d — Pro planlı işletmelerin kaydedilip 30 gündür
//      gidilmemiş mekânları için kişiselleştirilmiş hatırlatma.
// ═══════════════════════════════════════════════════════════════════════

import { enqueue } from "./queue.js";
import { closeStaleVisits } from "../visits/tracker.js";

/** 1) Ziyaret sonrası yorum daveti. */
export async function visitReviewPrompts(db) {
  await closeStaleVisits(db);          // vakti geçmiş açık ziyaretleri kapat

  const { rows } = await db.query(
    `SELECT v.id, v.user_id, v.restaurant_id, v.dwell_seconds, r.name
       FROM visits v
       JOIN restaurants r ON r.id = v.restaurant_id
      WHERE v.status = 'confirmed'
        AND v.prompted_at IS NULL
        AND v.prompt_due_at <= now()
      LIMIT 500`);

  let queued = 0;
  for (const v of rows) {
    const minutes = Math.round(v.dwell_seconds / 60);
    const id = await enqueue(db, {
      userId: v.user_id,
      kind: "visit_review_prompt",
      restaurantId: v.restaurant_id,
      visitId: v.id,
      title: `${v.name} nasıldı?`,
      body: minutes >= 60
        ? `Bugün ${v.name}'da bir saatten fazla vakit geçirdin. Deneyimini birkaç satırla anlatır mısın?`
        : `Bugün ${v.name}'daydın. Deneyimini birkaç satırla anlatır mısın?`,
      deepLink: `gur://review/${v.restaurant_id}?visit=${v.id}`,
      payload: { visitId: v.id, unlocksReview: true },
      dedupeKey: `visit_review:${v.id}`,
    });
    await db.query(
      `UPDATE visits SET status = 'prompted', prompted_at = now() WHERE id = $1`, [v.id]);
    if (id) queued++;
  }
  return { queued, candidates: rows.length };
}

// Pro plan ayrıcalığı: yalnızca bu planın mekânları hatırlatma gönderebilir.
const REENGAGEMENT_DAYS = 30;

/** 2) 30 gündür dokunulmamış kayıtlar için akıllı hatırlatma. */
export async function reengagement30d(db) {
  const { rows } = await db.query(
    `SELECT sp.user_id, sp.restaurant_id, sp.saved_at, r.name, r.district,
            o.plan AS org_plan,
            -- Aktif bir kampanya varsa teklifi bildirime koyarız.
            (SELECT c.id FROM campaigns c
              WHERE c.restaurant_id = r.id AND c.status = 'active'
              ORDER BY c.bid_minor DESC LIMIT 1) AS campaign_id,
            (SELECT (c.target->>'offer') FROM campaigns c
              WHERE c.restaurant_id = r.id AND c.status = 'active'
              ORDER BY c.bid_minor DESC LIMIT 1) AS offer
       FROM saved_places sp
       JOIN restaurants r    ON r.id = sp.restaurant_id AND r.is_active
       JOIN organizations o  ON o.id = r.claimed_by_org
       JOIN users u          ON u.id = sp.user_id AND u.deleted_at IS NULL
      WHERE o.plan = 'pro'
        AND sp.visited_at IS NULL
        AND sp.last_touch_at < now() - ($1 || ' days')::interval
        -- Bu çiftte hiç bildirim gitmemiş olmalı
        AND NOT EXISTS (
          SELECT 1 FROM notification_queue q
           WHERE q.user_id = sp.user_id AND q.restaurant_id = sp.restaurant_id
             AND q.kind = 'reengagement_30d')
      LIMIT 1000`,
    [REENGAGEMENT_DAYS]
  );

  let queued = 0;
  for (const row of rows) {
    const days = REENGAGEMENT_DAYS;
    const offer = row.offer || "%10 ikram";
    const id = await enqueue(db, {
      userId: row.user_id,
      kind: "reengagement_30d",
      restaurantId: row.restaurant_id,
      campaignId: row.campaign_id,
      title: `${row.name} seni bekliyor`,
      body: `${days} gün önce ${row.name}'nı kaydetmiştin; bu hafta sonuna özel ${offer} seni bekliyor, gitmeye ne dersin?`,
      deepLink: `gur://restaurant/${row.restaurant_id}?from=reengagement`,
      payload: { savedAt: row.saved_at, offer },
      dedupeKey: `reengage:${row.user_id}:${row.restaurant_id}`,
    });
    if (id) queued++;
  }
  return { queued, candidates: rows.length };
}
