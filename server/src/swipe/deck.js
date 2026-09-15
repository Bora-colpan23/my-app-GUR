// ═══════════════════════════════════════════════════════════════════════
// Swipe motoru — deste üretimi, kota ve sponsorlu kart ücretlendirmesi.
// ═══════════════════════════════════════════════════════════════════════

import { buildDeck, rankCampaigns, quotaState } from "../../../shared/deck.js";
import { logEvent } from "../analytics/events.js";

const DECK_SIZE = 30;

/** Kullanıcının bugünkü kota satırını okur/oluşturur. */
async function readQuota(db, userId) {
  const { rows } = await db.query(
    `INSERT INTO swipe_quota (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET
       -- Gün döndüyse pencere sıfırlanır; ayrı bir cron'a gerek yok.
       window_start  = CASE WHEN swipe_quota.window_start < date_trunc('day', now())
                            THEN date_trunc('day', now()) ELSE swipe_quota.window_start END,
       used          = CASE WHEN swipe_quota.window_start < date_trunc('day', now())
                            THEN 0 ELSE swipe_quota.used END,
       bonus_granted = CASE WHEN swipe_quota.window_start < date_trunc('day', now())
                            THEN 0 ELSE swipe_quota.bonus_granted END
     RETURNING used, bonus_granted`,
    [userId]
  );
  return rows[0];
}

/** Aday organik kartlar: görülmemiş, aktif, yakın. */
async function organicCandidates(db, userId, { lat, lng, category, radiusM = 8000 }) {
  const { rows } = await db.query(
    `SELECT r.id, r.name, r.category, r.description, r.address, r.district,
            r.lat, r.lng, r.rating, r.rating_count, r.price_level, r.hours,
            r.tags, r.gastro_approved, r.gastro_chef,
            earth_distance(ll_to_earth($2, $3), ll_to_earth(r.lat, r.lng)) AS distance_m
       FROM restaurants r
      WHERE r.is_active
        AND ($4::text IS NULL OR r.category = $4)
        AND earth_box(ll_to_earth($2, $3), $5) @> ll_to_earth(r.lat, r.lng)
        AND NOT EXISTS (SELECT 1 FROM swipes s
                         WHERE s.user_id = $1 AND s.restaurant_id = r.id
                           AND s.created_at > now() - interval '30 days')
        -- Aktif kampanyası olan mekan organik akışta çıkmaz: aynı kartı hem
        -- bedava hem ücretli göstermek reklamvereni bedavaya ödetmek olur.
        AND NOT EXISTS (SELECT 1 FROM campaigns c
                         WHERE c.restaurant_id = r.id AND c.status = 'active'
                           AND c.starts_at <= now()
                           AND (c.ends_at IS NULL OR c.ends_at > now()))
      ORDER BY r.gastro_approved DESC, distance_m ASC
      LIMIT $6`,
    [userId, lat, lng, category ?? null, radiusM, DECK_SIZE]
  );
  return rows;
}

/** Servis edilebilir kampanyalar + son 7 günün etkileşim oranı. */
async function servableCampaigns(db, { lat, lng, radiusM = 8000 }) {
  const { rows } = await db.query(
    `SELECT c.id, c.label, c.pricing, c.bid_minor,
            (c.daily_budget_minor - coalesce(d.spent_minor, 0)) AS remaining_budget_minor,
            c.status,
            r.id AS restaurant_id, r.name, r.category, r.description, r.address,
            r.district, r.lat, r.lng, r.rating, r.rating_count, r.price_level,
            r.hours, r.tags, r.gastro_approved, r.gastro_chef,
            coalesce(d.engagements::numeric / nullif(d.impressions, 0), 0.5) AS engagement_rate
       FROM campaigns c
       JOIN restaurants r ON r.id = c.restaurant_id AND r.is_active
       LEFT JOIN campaign_daily_spend d
              ON d.campaign_id = c.id AND d.day = current_date
      WHERE c.status = 'active'
        AND c.starts_at <= now()
        AND (c.ends_at IS NULL OR c.ends_at > now())
        AND (c.total_budget_minor IS NULL OR c.spent_minor < c.total_budget_minor)
        AND coalesce(d.spent_minor, 0) < c.daily_budget_minor
        AND earth_box(ll_to_earth($1, $2), $3) @> ll_to_earth(r.lat, r.lng)`,
    [lat, lng, radiusM]
  );

  return rows.map(r => ({
    id: r.id,
    label: r.label,
    pricing: r.pricing,
    bidMinor: r.bid_minor,
    remainingBudgetMinor: r.remaining_budget_minor,
    status: r.status,
    category: r.category,
    engagementRate: Number(r.engagement_rate),
    restaurant: {
      id: r.restaurant_id, name: r.name, category: r.category,
      description: r.description, address: r.address, district: r.district,
      lat: r.lat, lng: r.lng, rating: r.rating, ratingCount: r.rating_count,
      priceLevel: r.price_level, hours: r.hours, tags: r.tags,
      gastroApproved: r.gastro_approved, gastroChef: r.gastro_chef,
    },
  }));
}

/**
 * Bir kullanıcı için deste üretir.
 * Dönen nesnede kota SAYISI yoktur — yalnızca niteliksel `pressure`.
 */
export async function getDeck(db, userId, opts) {
  const [{ used, bonus_granted }, organic] = await Promise.all([
    readQuota(db, userId),
    organicCandidates(db, userId, opts),
  ]);

  const { rows: [user] } = await db.query(`SELECT plan FROM users WHERE id = $1`, [userId]);
  const quota = quotaState({ plan: user.plan, used, bonus: bonus_granted });

  if (!quota.allowed) return { cards: [], quota };

  const campaigns = rankCampaigns(await servableCampaigns(db, opts), { category: opts.category });
  const cards = buildDeck(organic, campaigns, {
    seed: `${userId}:${new Date().toISOString().slice(0, 10)}`,
  });

  // Sponsorlu kartların gösterimi hemen loglanır; ücret CPC/CPE'de değil,
  // gösterimde tahsil edilmez — ama envanter raporu gösterimi ister.
  for (const c of cards.filter(c => c.sponsored)) {
    await db.query(
      `INSERT INTO ad_events (campaign_id, user_id, restaurant_id, kind, deck_position)
       VALUES ($1,$2,$3,'impression',$4)`,
      [c.sponsored.campaignId, userId, c.id, c.deckPosition]
    );
    await bumpDailySpend(db, c.sponsored.campaignId, { impressions: 1 });
  }

  return { cards, quota };
}

async function bumpDailySpend(db, campaignId, { impressions = 0, clicks = 0, engagements = 0, spent = 0 }) {
  await db.query(
    `INSERT INTO campaign_daily_spend (campaign_id, day, impressions, clicks, engagements, spent_minor)
     VALUES ($1, current_date, $2, $3, $4, $5)
     ON CONFLICT (campaign_id, day) DO UPDATE SET
       impressions = campaign_daily_spend.impressions + EXCLUDED.impressions,
       clicks      = campaign_daily_spend.clicks      + EXCLUDED.clicks,
       engagements = campaign_daily_spend.engagements + EXCLUDED.engagements,
       spent_minor = campaign_daily_spend.spent_minor + EXCLUDED.spent_minor`,
    [campaignId, impressions, clicks, engagements, spent]
  );
}

/**
 * Kaydırmayı kaydeder, kotayı düşer, sponsorluysa ücretlendirir.
 * direction: 'left' | 'right' | 'up'
 */
export async function recordSwipe(db, userId, { restaurantId, direction, campaignId, deckPosition, dwellMs }) {
  await db.query(
    `INSERT INTO swipes (user_id, restaurant_id, direction, campaign_id, deck_position, dwell_ms)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, restaurantId, direction, campaignId ?? null, deckPosition ?? null, dwellMs ?? null]
  );
  await db.query(`UPDATE swipe_quota SET used = used + 1 WHERE user_id = $1`, [userId]);

  const saved = direction === "right" || direction === "up";
  if (saved) {
    await db.query(
      `INSERT INTO saved_places (user_id, restaurant_id, is_super, saved_at, last_touch_at)
       VALUES ($1,$2,$3,now(),now())
       ON CONFLICT (user_id, restaurant_id)
       DO UPDATE SET is_super = saved_places.is_super OR EXCLUDED.is_super,
                     last_touch_at = now()`,
      [userId, restaurantId, direction === "up"]
    );
  } else {
    await db.query(`DELETE FROM saved_places WHERE user_id = $1 AND restaurant_id = $2`, [userId, restaurantId]);
  }

  // CPE: sağa/yukarı kaydırma ücretlendirilir. CPC ayrıca detay açılışında.
  if (campaignId && saved) {
    const { rows: [c] } = await db.query(
      `SELECT pricing, bid_minor FROM campaigns WHERE id = $1`, [campaignId]);
    if (c?.pricing === "cpe") await chargeCampaign(db, campaignId, userId, restaurantId, "save", c.bid_minor);
    else await bumpDailySpend(db, campaignId, { engagements: 1 });
  }

  await logEvent(db, {
    userId, name: `swipe_${direction}`, restaurantId, campaignId,
    props: { deckPosition, dwellMs },
  });
}

/** Kampanyayı ücretlendirir ve geliri kullanıcıya bağlar (ARPU girdisi). */
export async function chargeCampaign(db, campaignId, userId, restaurantId, kind, amountMinor) {
  await db.query(
    `INSERT INTO ad_events (campaign_id, user_id, restaurant_id, kind, charged_minor)
     VALUES ($1,$2,$3,$4,$5)`,
    [campaignId, userId, restaurantId, kind, amountMinor]
  );
  await db.query(
    `UPDATE campaigns SET spent_minor = spent_minor + $2,
            status = CASE WHEN total_budget_minor IS NOT NULL
                           AND spent_minor + $2 >= total_budget_minor
                          THEN 'exhausted'::campaign_status ELSE status END
      WHERE id = $1`,
    [campaignId, amountMinor]
  );
  await bumpDailySpend(db, campaignId, {
    clicks: kind === "click" ? 1 : 0,
    engagements: kind === "save" ? 1 : 0,
    spent: amountMinor,
  });
  await db.query(
    `INSERT INTO revenue_events (user_id, restaurant_id, campaign_id, source, amount_minor)
     VALUES ($1,$2,$3,'sponsored_card',$4)`,
    [userId, restaurantId, campaignId, amountMinor]
  );
}

/** Ödüllü reklam tamamlandı: kota bonusu ver, geliri logla. */
export async function grantRewardBonus(db, userId, { bonus = 5, revenueMinor = 0 }) {
  await db.query(
    `UPDATE swipe_quota SET bonus_granted = bonus_granted + $2 WHERE user_id = $1`,
    [userId, bonus]
  );
  if (revenueMinor > 0) {
    await db.query(
      `INSERT INTO revenue_events (user_id, source, amount_minor) VALUES ($1,'rewarded_ad',$2)`,
      [userId, revenueMinor]
    );
  }
}
