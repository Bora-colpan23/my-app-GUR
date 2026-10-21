-- ═══════════════════════════════════════════════════════════════════════
-- 001 — Gastro tanıtım videosu ve dış kaynak yorumları
--
-- İki eksik:
--   1. Şef videosu her mekânda gösteriliyordu; oysa yalnızca Gastro rozetli
--      ve videosu ÇEKİLMİŞ mekânlarda olmalı. Video adresi ayrı bir alan
--      olunca "rozet var ama video yok" durumu temsil edilebiliyor.
--   2. Google Places yorumları saklanacak yer yoktu. Kendi yorumlarımızla
--      aynı tabloya koymak yanlış olurdu: bunlar bize ait değil, kaynağına
--      atıf zorunlu ve saklama süresi sağlayıcının şartlarına tabi.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS gastro_video_url text;

CREATE TABLE IF NOT EXISTS restaurant_external_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider       ingest_provider NOT NULL,
  external_id    text NOT NULL,
  author_name    text,
  author_photo   text,
  author_url     text,
  rating         smallint CHECK (rating BETWEEN 1 AND 5),
  body           text,
  language       text,
  -- Sağlayıcı mutlak tarih yerine "3 hafta önce" verebiliyor; ikisini de
  -- saklıyoruz, gösterimde hangisi varsa o kullanılıyor.
  relative_time  text,
  published_at   timestamptz,
  source_url     text,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS restaurant_external_reviews_idx
  ON restaurant_external_reviews (restaurant_id, provider, published_at DESC NULLS LAST);

-- Google Places şartları önbelleklenen içeriğin tazelenmesini istiyor;
-- bu indeks gecelik temizlik işinin bayat satırları bulmasını sağlıyor.
CREATE INDEX IF NOT EXISTS restaurant_external_reviews_stale_idx
  ON restaurant_external_reviews (fetched_at);
