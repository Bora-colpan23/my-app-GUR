-- ═══════════════════════════════════════════════════════════════════════
-- Kohort, retention, ARPU ve LTV toplama sorguları
-- Her biri nightly job tarafından çalıştırılıp sonuç tablosuna yazılır;
-- panel canlı toplama yapmaz, hazır satırı okur.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Retention: kayıt haftası × gün ofseti ─────────────────────────
-- $1 = gün ofsetleri, örn. ARRAY[1,7,30]
INSERT INTO cohort_retention (cohort_week, day_offset, cohort_size, active_users, computed_at)
WITH cohort AS (
  SELECT cohort_week, count(*) AS size
  FROM users
  WHERE deleted_at IS NULL
  GROUP BY cohort_week
),
offsets AS (SELECT unnest($1::smallint[]) AS day_offset),
-- Aktiflik = o gün en az bir analitik olayı. Sadece "açtı" değil,
-- gerçekten bir şey yaptı demek için event akışına bakıyoruz.
activity AS (
  SELECT u.cohort_week,
         o.day_offset,
         count(DISTINCT e.user_id) AS active_users
  FROM users u
  CROSS JOIN offsets o
  JOIN analytics_events e
    ON e.user_id = u.id
   AND e.occurred_at >= u.created_at + (o.day_offset * interval '1 day')
   AND e.occurred_at <  u.created_at + ((o.day_offset + 1) * interval '1 day')
  WHERE u.deleted_at IS NULL
  GROUP BY u.cohort_week, o.day_offset
)
SELECT c.cohort_week,
       o.day_offset,
       c.size,
       coalesce(a.active_users, 0),
       now()
FROM cohort c
CROSS JOIN offsets o
LEFT JOIN activity a ON a.cohort_week = c.cohort_week AND a.day_offset = o.day_offset
ON CONFLICT (cohort_week, day_offset) DO UPDATE
   SET cohort_size  = EXCLUDED.cohort_size,
       active_users = EXCLUDED.active_users,
       computed_at  = now();

-- ─── 2. Kohort etkileşimi ve kaydetme → gitme dönüşümü ────────────────
INSERT INTO cohort_engagement
  (cohort_week, cohort_size, swipes_per_user, saves_per_user,
   save_to_directions_pct, save_to_visit_pct, ltv_minor_avg, computed_at)
WITH base AS (
  SELECT id, cohort_week FROM users WHERE deleted_at IS NULL
),
sw AS (
  SELECT b.cohort_week,
         count(*)                                        AS swipes,
         count(*) FILTER (WHERE s.direction IN ('right','up')) AS saves
  FROM base b JOIN swipes s ON s.user_id = b.id
  GROUP BY b.cohort_week
),
-- Kaydedilen mekan için yol tarifi alındı mı: aynı (user, restaurant) çifti
conv AS (
  SELECT b.cohort_week,
         count(*)                                          AS saved_pairs,
         count(*) FILTER (WHERE d.user_id IS NOT NULL)      AS with_directions,
         count(*) FILTER (WHERE v.user_id IS NOT NULL)      AS with_visit
  FROM base b
  JOIN saved_places sp ON sp.user_id = b.id
  LEFT JOIN LATERAL (
    SELECT 1 AS user_id FROM analytics_events e
    WHERE e.user_id = sp.user_id
      AND e.restaurant_id = sp.restaurant_id
      AND e.name = 'directions_open'
      AND e.occurred_at >= sp.saved_at
    LIMIT 1
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT 1 AS user_id FROM visits vi
    WHERE vi.user_id = sp.user_id
      AND vi.restaurant_id = sp.restaurant_id
      AND vi.status IN ('confirmed','prompted','reviewed')
      AND vi.first_seen_at >= sp.saved_at
    LIMIT 1
  ) v ON true
  GROUP BY b.cohort_week
),
ltv AS (
  SELECT b.cohort_week, avg(l.ltv_minor)::integer AS ltv_avg
  FROM base b JOIN user_ltv l ON l.user_id = b.id
  GROUP BY b.cohort_week
),
sizes AS (SELECT cohort_week, count(*) AS size FROM base GROUP BY cohort_week)
SELECT s.cohort_week,
       s.size,
       coalesce(sw.swipes, 0)::numeric / greatest(s.size, 1),
       coalesce(sw.saves,  0)::numeric / greatest(s.size, 1),
       CASE WHEN coalesce(conv.saved_pairs,0) = 0 THEN 0
            ELSE conv.with_directions::numeric * 100 / conv.saved_pairs END,
       CASE WHEN coalesce(conv.saved_pairs,0) = 0 THEN 0
            ELSE conv.with_visit::numeric * 100 / conv.saved_pairs END,
       coalesce(ltv.ltv_avg, 0),
       now()
FROM sizes s
LEFT JOIN sw   ON sw.cohort_week   = s.cohort_week
LEFT JOIN conv ON conv.cohort_week = s.cohort_week
LEFT JOIN ltv  ON ltv.cohort_week  = s.cohort_week
ON CONFLICT (cohort_week) DO UPDATE
   SET cohort_size            = EXCLUDED.cohort_size,
       swipes_per_user        = EXCLUDED.swipes_per_user,
       saves_per_user         = EXCLUDED.saves_per_user,
       save_to_directions_pct = EXCLUDED.save_to_directions_pct,
       save_to_visit_pct      = EXCLUDED.save_to_visit_pct,
       ltv_minor_avg          = EXCLUDED.ltv_minor_avg,
       computed_at            = now();

-- ─── 3. Kullanıcı başına LTV ve ARPU anlık görüntüsü ──────────────────
-- ARPU burada "aktif ay başına gelir": toplam gelir / üyelik ayı sayısı.
-- Böylece yeni kullanıcı, uzun süredir üye olanla aynı ölçekte karşılaştırılır.
INSERT INTO user_ltv (
  user_id, computed_at, days_since_signup,
  ad_revenue_minor, subscription_revenue_minor, commission_revenue_minor,
  referred_gmv_minor, ltv_minor, arpu_minor,
  sponsored_views, total_swipes, directions_taken, visits_confirmed)
WITH rev AS (
  SELECT user_id,
         sum(amount_minor) FILTER (WHERE source IN ('sponsored_card','rewarded_ad'))            AS ad_rev,
         sum(amount_minor) FILTER (WHERE source = 'user_subscription')                          AS sub_rev,
         sum(amount_minor) FILTER (WHERE source IN ('reservation_commission','directions_affiliate')) AS com_rev,
         sum(gmv_minor)                                                                          AS gmv,
         sum(amount_minor)                                                                       AS total
  FROM revenue_events
  WHERE user_id IS NOT NULL
  GROUP BY user_id
),
eng AS (
  SELECT u.id AS user_id,
         count(s.*)                                                   AS swipes,
         count(ae.*) FILTER (WHERE ae.kind = 'impression')            AS sponsored_views,
         count(av.*)                                                  AS directions,
         count(vi.*) FILTER (WHERE vi.status IN ('confirmed','prompted','reviewed')) AS visits
  FROM users u
  LEFT JOIN swipes s     ON s.user_id  = u.id
  LEFT JOIN ad_events ae ON ae.user_id = u.id
  LEFT JOIN analytics_events av ON av.user_id = u.id AND av.name = 'directions_open'
  LEFT JOIN visits vi    ON vi.user_id = u.id
  WHERE u.deleted_at IS NULL
  GROUP BY u.id
)
SELECT u.id,
       now(),
       greatest(extract(day FROM now() - u.created_at)::integer, 0),
       coalesce(r.ad_rev, 0),
       coalesce(r.sub_rev, 0),
       coalesce(r.com_rev, 0),
       coalesce(r.gmv, 0),
       coalesce(r.total, 0),
       (coalesce(r.total, 0)::numeric
         / greatest(ceil(extract(epoch FROM now() - u.created_at) / 2592000.0), 1))::integer,
       coalesce(e.sponsored_views, 0),
       coalesce(e.swipes, 0),
       coalesce(e.directions, 0),
       coalesce(e.visits, 0)
FROM users u
LEFT JOIN rev r ON r.user_id = u.id
LEFT JOIN eng e ON e.user_id = u.id
WHERE u.deleted_at IS NULL
ON CONFLICT (user_id) DO UPDATE SET
  computed_at = now(),
  days_since_signup          = EXCLUDED.days_since_signup,
  ad_revenue_minor           = EXCLUDED.ad_revenue_minor,
  subscription_revenue_minor = EXCLUDED.subscription_revenue_minor,
  commission_revenue_minor   = EXCLUDED.commission_revenue_minor,
  referred_gmv_minor         = EXCLUDED.referred_gmv_minor,
  ltv_minor                  = EXCLUDED.ltv_minor,
  arpu_minor                 = EXCLUDED.arpu_minor,
  sponsored_views            = EXCLUDED.sponsored_views,
  total_swipes               = EXCLUDED.total_swipes,
  directions_taken           = EXCLUDED.directions_taken,
  visits_confirmed           = EXCLUDED.visits_confirmed;

-- ─── 4. Mekan bazlı etkileşim paneli (B2B "işletmem nasıl gidiyor") ───
-- $1 = restaurant_id, $2 = kaç gün geriye
SELECT
  count(*) FILTER (WHERE s.direction = 'right')                       AS saves,
  count(*) FILTER (WHERE s.direction = 'up')                          AS super_likes,
  count(*) FILTER (WHERE s.direction = 'left')                        AS passes,
  (SELECT count(*) FROM analytics_events e
     WHERE e.restaurant_id = $1 AND e.name = 'detail_open'
       AND e.occurred_at > now() - ($2 || ' days')::interval)          AS detail_views,
  (SELECT count(*) FROM analytics_events e
     WHERE e.restaurant_id = $1 AND e.name = 'directions_open'
       AND e.occurred_at > now() - ($2 || ' days')::interval)          AS directions,
  (SELECT count(*) FROM visits v
     WHERE v.restaurant_id = $1 AND v.status IN ('confirmed','prompted','reviewed')
       AND v.first_seen_at > now() - ($2 || ' days')::interval)        AS confirmed_visits
FROM swipes s
WHERE s.restaurant_id = $1
  AND s.created_at > now() - ($2 || ' days')::interval;
