// ═══════════════════════════════════════════════════════════════════════
// Bildirim kuyruğu ve gönderim.
//
// Hiçbir üretici doğrudan push göndermez; hepsi kuyruğa yazar. Tavan,
// tekrar engelleme ve sessiz saat kontrolü tek yerde olsun diye.
// ═══════════════════════════════════════════════════════════════════════

export const NOTIFICATION_RULES = {
  dailyCap: 2,                 // kullanıcı başına günlük tavan
  quietHours: [23, 9],         // TSİ 23:00 – 09:00 arası gönderilmez
  maxAttempts: 3,
};

function inQuietHours(date = new Date()) {
  // Sunucu UTC; Türkiye UTC+3.
  const h = (date.getUTCHours() + 3) % 24;
  const [from, to] = NOTIFICATION_RULES.quietHours;
  return from > to ? h >= from || h < to : h >= from && h < to;
}

/** Sessiz saatteyse gönderimi sabah 9'a öteler. */
function nextSendableAt(date = new Date()) {
  if (!inQuietHours(date)) return date;
  const d = new Date(date);
  d.setUTCHours(6, 0, 0, 0);                 // TSİ 09:00
  if (d <= date) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Kuyruğa alır. dedupeKey aynı olan ikinci kayıt sessizce yok sayılır —
 * cron iki kez çalışsa da kullanıcı aynı bildirimi iki kez almaz.
 */
export async function enqueue(db, n) {
  const scheduled = nextSendableAt(n.scheduledAt ? new Date(n.scheduledAt) : new Date());
  const { rows } = await db.query(
    `INSERT INTO notification_queue
       (user_id, kind, restaurant_id, campaign_id, visit_id, title, body,
        deep_link, payload, scheduled_at, dedupe_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [n.userId, n.kind, n.restaurantId ?? null, n.campaignId ?? null, n.visitId ?? null,
     n.title, n.body, n.deepLink ?? null, n.payload ?? {}, scheduled, n.dedupeKey]
  );
  return rows[0]?.id ?? null;
}

/**
 * Kuyruğu boşaltır. Gerçek push sağlayıcısı (APNs / FCM) `send` ile
 * dışarıdan verilir; burası taşımayı bilmez, kuralları bilir.
 */
export async function drainQueue(db, send, { batch = 200 } = {}) {
  const { rows } = await db.query(
    `SELECT q.*, u.marketing_optin
       FROM notification_queue q
       JOIN users u ON u.id = q.user_id AND u.deleted_at IS NULL
      WHERE q.status = 'queued' AND q.scheduled_at <= now()
      ORDER BY q.scheduled_at
      LIMIT $1`,
    [batch]
  );

  const stats = { sent: 0, suppressed: 0, failed: 0 };

  for (const n of rows) {
    // Pazarlama izni yoksa yalnızca işlem bildirimleri geçer.
    const isMarketing = n.kind === "reengagement_30d" || n.kind === "campaign_offer";
    if (isMarketing && !n.marketing_optin) {
      await mark(db, n.id, "suppressed", "no_marketing_optin");
      stats.suppressed++;
      continue;
    }

    const { rows: [budget] } = await db.query(
      `INSERT INTO notification_budget (user_id, day, sent) VALUES ($1, current_date, 0)
       ON CONFLICT (user_id, day) DO UPDATE SET sent = notification_budget.sent
       RETURNING sent`,
      [n.user_id]
    );
    if (budget.sent >= NOTIFICATION_RULES.dailyCap) {
      // Tavan doldu: düşürme, yarına ötele.
      await db.query(
        `UPDATE notification_queue SET scheduled_at = date_trunc('day', now()) + interval '1 day 6 hours'
          WHERE id = $1`, [n.id]);
      stats.suppressed++;
      continue;
    }

    const { rows: devices } = await db.query(
      `SELECT platform, push_token FROM user_devices
        WHERE user_id = $1 AND push_enabled`, [n.user_id]);
    if (!devices.length) {
      await mark(db, n.id, "suppressed", "no_device");
      stats.suppressed++;
      continue;
    }

    try {
      await send({
        devices,
        title: n.title,
        body: n.body,
        deepLink: n.deep_link,
        payload: { ...n.payload, notificationId: n.id, kind: n.kind },
      });
      await mark(db, n.id, "sent");
      await db.query(
        `UPDATE notification_budget SET sent = sent + 1 WHERE user_id = $1 AND day = current_date`,
        [n.user_id]);
      stats.sent++;
    } catch (err) {
      const attempts = n.attempts + 1;
      await db.query(
        `UPDATE notification_queue SET attempts = $2,
                status = CASE WHEN $2 >= $3 THEN 'failed'::notification_status ELSE 'queued'::notification_status END,
                fail_reason = $4,
                scheduled_at = now() + ($2 * interval '10 minutes')
          WHERE id = $1`,
        [n.id, attempts, NOTIFICATION_RULES.maxAttempts, err.message.slice(0, 300)]);
      stats.failed++;
    }
  }

  return stats;
}

async function mark(db, id, status, reason = null) {
  await db.query(
    `UPDATE notification_queue
        SET status = $2::notification_status,
            sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END,
            fail_reason = coalesce($3, fail_reason)
      WHERE id = $1`,
    [id, status, reason]
  );
}

/** Bildirime tıklandı — dönüşüm ölçümü. */
export async function markClicked(db, notificationId) {
  await db.query(
    `UPDATE notification_queue SET status = 'clicked', clicked_at = now() WHERE id = $1`,
    [notificationId]
  );
}
