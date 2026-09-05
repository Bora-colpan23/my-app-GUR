-- ═══════════════════════════════════════════════════════════════════════
-- GUR — veri şeması (PostgreSQL 15+)
--
-- Tek migration olarak yazıldı: faz ayrımı yok, sistemin tamamı burada.
-- Bölümler:
--   1. Kimlik ve kullanıcılar        6. Reklam / kampanya (CPC-CPE)
--   2. Mekan havuzu ve besleme       7. Bildirim kuyruğu
--   3. B2B sahiplik ve üyelik        8. Analitik olay akışı
--   4. Kaydırma etkileşimleri        9. Gelir, ARPU ve LTV
--   5. Konum doğrulamalı ziyaret    10. Kohort tabloları
-- ═══════════════════════════════════════════════════════════════════════

-- Eklentiler süper kullanıcı ister; setup.sh bunları uygulama rolünden
-- ÖNCE, postgres olarak kurar. Buradaki IF NOT EXISTS kurulmuşsa sessiz geçer.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- büyük/küçük harf duyarsız e-posta
CREATE EXTENSION IF NOT EXISTS "cube";
CREATE EXTENSION IF NOT EXISTS "earthdistance";  -- ll_to_earth / earth_box yakınlık sorguları

-- ─── 1. Kimlik ve kullanıcılar ────────────────────────────────────────

CREATE TYPE auth_provider AS ENUM ('password', 'google', 'apple');
CREATE TYPE user_plan     AS ENUM ('free', 'plus', 'pro');

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext UNIQUE,
  display_name    text        NOT NULL,
  avatar_url      text,
  birth_year      smallint,
  plan            user_plan   NOT NULL DEFAULT 'free',
  plan_renews_at  timestamptz,
  -- Kayıt haftası kohort sorgularının çıpası; sonradan değişmez.
  cohort_week     date        NOT NULL DEFAULT date_trunc('week', now())::date,
  locale          text        NOT NULL DEFAULT 'tr-TR',
  marketing_optin boolean     NOT NULL DEFAULT false,
  analytics_optin boolean     NOT NULL DEFAULT false,   -- KVKK: açık rıza
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX users_cohort_week_idx ON users (cohort_week);
CREATE INDEX users_last_seen_idx   ON users (last_seen_at DESC);

-- Bir kullanıcı hem parolayla hem Google hem Apple ile bağlanabilir.
-- Apple e-posta gizleme (private relay) kullandığında email null gelebilir;
-- bu yüzden benzersizlik (provider, subject) üzerinde.
CREATE TABLE auth_identities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       auth_provider NOT NULL,
  subject        text NOT NULL,          -- Google "sub", Apple "sub", parola için e-posta
  email_at_login citext,
  password_hash  text,                   -- yalnızca provider='password'
  is_private_relay boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject),
  CHECK (provider <> 'password' OR password_hash IS NOT NULL)
);
CREATE INDEX auth_identities_user_idx ON auth_identities (user_id);

CREATE TABLE user_devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform     text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  push_token   text NOT NULL,
  push_enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, push_token)
);
CREATE INDEX user_devices_user_idx ON user_devices (user_id) WHERE push_enabled;

-- ─── 2. Mekan havuzu ve dış kaynak beslemesi ──────────────────────────

CREATE TYPE ingest_provider AS ENUM ('google_places', 'foursquare', 'tripadvisor', 'osm', 'manual');

CREATE TABLE restaurants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  category       text NOT NULL,
  description    text,
  address        text,
  district       text,
  city           text NOT NULL DEFAULT 'İstanbul',
  lat            double precision NOT NULL,
  lng            double precision NOT NULL,
  phone          text,
  website        text,
  price_level    smallint CHECK (price_level BETWEEN 1 AND 4),
  rating         numeric(2,1),
  rating_count   integer NOT NULL DEFAULT 0,
  hours          jsonb,                 -- {"mon":[["11:00","23:00"]], ...}
  tags           text[] NOT NULL DEFAULT '{}',
  gastro_approved boolean NOT NULL DEFAULT false,
  gastro_chef    text,
  -- Sahiplenilmiş kayıtta işletmenin girdiği alanlar dış kaynağı ezer.
  claimed_by_org uuid,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurants_geo_idx      ON restaurants USING gist (ll_to_earth(lat, lng));
CREATE INDEX restaurants_category_idx ON restaurants (category) WHERE is_active;
CREATE INDEX restaurants_district_idx ON restaurants (district) WHERE is_active;

-- Aynı mekan birden çok sağlayıcıdan gelebilir; ham yanıt saklanır ki
-- normalizasyon kuralı değişince yeniden çekmeden yeniden işlenebilsin.
CREATE TABLE restaurant_sources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  provider       ingest_provider NOT NULL,
  external_id    text NOT NULL,
  payload        jsonb NOT NULL,
  confidence     numeric(3,2) NOT NULL DEFAULT 1.0,   -- eşleştirme güveni
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);
CREATE INDEX restaurant_sources_restaurant_idx ON restaurant_sources (restaurant_id);
CREATE INDEX restaurant_sources_stale_idx      ON restaurant_sources (fetched_at);

CREATE TABLE restaurant_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  url           text NOT NULL,
  width         integer,
  height        integer,
  -- 'owner' fotoğrafları sıralamada dış kaynağın önüne geçer.
  origin        ingest_provider NOT NULL DEFAULT 'manual',
  is_owner      boolean NOT NULL DEFAULT false,
  attribution   text,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurant_photos_order_idx ON restaurant_photos (restaurant_id, is_owner DESC, position);

CREATE TABLE restaurant_menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  section       text,
  name          text NOT NULL,
  description   text,
  price_minor   integer,               -- kuruş
  currency      char(3) NOT NULL DEFAULT 'TRY',
  photo_url     text,
  is_popular    boolean NOT NULL DEFAULT false,
  is_available  boolean NOT NULL DEFAULT true,
  source        ingest_provider NOT NULL DEFAULT 'manual',
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurant_menu_items_idx ON restaurant_menu_items (restaurant_id, is_available);

-- ─── 3. B2B: işletme sahipliği ve panel erişimi ───────────────────────

CREATE TYPE claim_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE org_plan     AS ENUM ('free', 'premium', 'pro');
CREATE TYPE org_role     AS ENUM ('owner', 'manager', 'staff');

CREATE TABLE organizations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name     text NOT NULL,
  tax_id         text,
  plan           org_plan NOT NULL DEFAULT 'free',
  plan_renews_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_claimed_by_org_fkey
  FOREIGN KEY (claimed_by_org) REFERENCES organizations(id) ON DELETE SET NULL;

CREATE TABLE org_members (
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       org_role NOT NULL DEFAULT 'manager',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- Sahiplenme başvurusu: işletme dış kaynaktan gelen kaydı talep eder,
-- yönetici onaylayınca panel erişimi açılır.
CREATE TABLE restaurant_claims (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by   uuid NOT NULL REFERENCES users(id),
  status         claim_status NOT NULL DEFAULT 'pending',
  evidence       jsonb NOT NULL DEFAULT '{}',  -- vergi levhası, telefon doğrulaması vb.
  reviewer_id    uuid REFERENCES users(id),
  reviewed_at    timestamptz,
  reject_reason  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- Bir mekan için aynı anda yalnızca tek bekleyen başvuru olabilir.
CREATE UNIQUE INDEX restaurant_claims_one_pending
  ON restaurant_claims (restaurant_id) WHERE status = 'pending';

-- ─── 4. Kaydırma etkileşimleri ────────────────────────────────────────

CREATE TYPE swipe_direction AS ENUM ('left', 'right', 'up');   -- geç / kaydet / süper

CREATE TABLE swipes (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  direction     swipe_direction NOT NULL,
  -- Sponsorlu kart olarak gösterildiyse hangi kampanyaydı
  campaign_id   uuid,
  deck_position smallint,
  dwell_ms      integer,          -- karta bakma süresi; ilgi sinyali
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX swipes_user_idx       ON swipes (user_id, created_at DESC);
CREATE INDEX swipes_restaurant_idx ON swipes (restaurant_id, direction);
-- Re-engagement cron'unun ana sorgusu: 30 gündür dokunulmamış kayıtlar
CREATE INDEX swipes_saved_idx      ON swipes (created_at) WHERE direction IN ('right', 'up');

CREATE TABLE saved_places (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  saved_at      timestamptz NOT NULL DEFAULT now(),
  is_super      boolean NOT NULL DEFAULT false,
  -- Bu kaydın "soğuduğu" an; ziyaret/yol tarifi/detay her dokunuşta tazelenir
  last_touch_at timestamptz NOT NULL DEFAULT now(),
  visited_at    timestamptz,
  PRIMARY KEY (user_id, restaurant_id)
);
CREATE INDEX saved_places_cold_idx ON saved_places (last_touch_at) WHERE visited_at IS NULL;

-- Kota: sayaç sunucuda tutulur, istemciye asla ham sayı olarak gösterilmez.
CREATE TABLE swipe_quota (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  window_start  timestamptz NOT NULL DEFAULT date_trunc('day', now()),
  used          integer NOT NULL DEFAULT 0,
  bonus_granted integer NOT NULL DEFAULT 0   -- ödüllü reklamdan kazanılan
);

-- ─── 5. Konum doğrulamalı ziyaret ─────────────────────────────────────

CREATE TYPE visit_status AS ENUM ('open', 'confirmed', 'abandoned', 'prompted', 'reviewed');

-- Kullanıcı mekânın yakınında yeterince kaldıysa ziyaret "confirmed" olur;
-- bir süre sonra "deneyim nasıldı" bildirimi gider ve yorum kilidi açılır.
CREATE TABLE visits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status         visit_status NOT NULL DEFAULT 'open',
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  confirmed_at   timestamptz,
  dwell_seconds  integer NOT NULL DEFAULT 0,
  -- Doğrulama kalitesi: en yakın ölçüm ve konum hassasiyeti
  min_distance_m numeric(7,1),
  best_accuracy_m numeric(7,1),
  sample_count   integer NOT NULL DEFAULT 0,
  prompt_due_at  timestamptz,        -- bildirimin planlandığı an
  prompted_at    timestamptz,
  review_id      uuid,
  UNIQUE (user_id, restaurant_id, first_seen_at)
);
CREATE INDEX visits_user_idx     ON visits (user_id, first_seen_at DESC);
CREATE INDEX visits_due_idx      ON visits (prompt_due_at) WHERE status = 'confirmed' AND prompted_at IS NULL;
CREATE INDEX visits_open_idx     ON visits (last_seen_at) WHERE status = 'open';

CREATE TABLE reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  visit_id      uuid REFERENCES visits(id) ON DELETE SET NULL,
  stars         smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body          text NOT NULL,
  photos        text[] NOT NULL DEFAULT '{}',
  -- Konumla doğrulanmış ziyaretten gelen yorum rozet alır ve sıralamada önde
  is_verified   boolean NOT NULL DEFAULT false,
  is_gourmet    boolean NOT NULL DEFAULT false,
  hidden_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_restaurant_idx ON reviews (restaurant_id, created_at DESC) WHERE hidden_at IS NULL;
CREATE INDEX reviews_low_star_idx   ON reviews (created_at DESC) WHERE stars <= 2 AND hidden_at IS NULL;
ALTER TABLE visits ADD CONSTRAINT visits_review_fkey
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL;

-- ─── 6. Kampanyalar ve reklam yerleşimi (CPC / CPE) ───────────────────

CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'exhausted', 'ended');
CREATE TYPE pricing_model   AS ENUM ('cpc', 'cpe');   -- tıklama / etkileşim (sağa kaydırma)

CREATE TABLE campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label           text NOT NULL,                       -- kartta görünen mikro rozet
  status          campaign_status NOT NULL DEFAULT 'draft',
  pricing         pricing_model NOT NULL DEFAULT 'cpe',
  bid_minor       integer NOT NULL CHECK (bid_minor > 0),   -- açık artırma teklifi, kuruş
  daily_budget_minor  integer NOT NULL CHECK (daily_budget_minor > 0),
  total_budget_minor  integer,
  spent_minor     integer NOT NULL DEFAULT 0,
  -- Hedefleme: ilçe, kategori, mesafe, saat aralığı
  target          jsonb NOT NULL DEFAULT '{}',
  starts_at       timestamptz NOT NULL DEFAULT now(),
  ends_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaigns_servable_idx ON campaigns (status, starts_at, ends_at) WHERE status = 'active';

ALTER TABLE swipes ADD CONSTRAINT swipes_campaign_fkey
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE TYPE ad_event_kind AS ENUM ('impression', 'click', 'save', 'directions', 'reservation');

CREATE TABLE ad_events (
  id            bigserial PRIMARY KEY,
  campaign_id   uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  kind          ad_event_kind NOT NULL,
  -- Ücretlendirilen olayda tahsil edilen tutar; gösterim genelde 0
  charged_minor integer NOT NULL DEFAULT 0,
  deck_position smallint,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ad_events_campaign_idx ON ad_events (campaign_id, created_at DESC);
CREATE INDEX ad_events_user_idx     ON ad_events (user_id, created_at DESC);

CREATE TABLE campaign_daily_spend (
  campaign_id  uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  day          date NOT NULL,
  impressions  integer NOT NULL DEFAULT 0,
  clicks       integer NOT NULL DEFAULT 0,
  engagements  integer NOT NULL DEFAULT 0,
  spent_minor  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, day)
);

-- ─── 7. Bildirim kuyruğu ──────────────────────────────────────────────

CREATE TYPE notification_kind   AS ENUM ('visit_review_prompt', 'reengagement_30d', 'campaign_offer', 'system');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'failed', 'suppressed', 'clicked');

CREATE TABLE notification_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          notification_kind NOT NULL,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  campaign_id   uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  visit_id      uuid REFERENCES visits(id) ON DELETE CASCADE,
  title         text NOT NULL,
  body          text NOT NULL,
  deep_link     text,
  payload       jsonb NOT NULL DEFAULT '{}',
  scheduled_at  timestamptz NOT NULL DEFAULT now(),
  status        notification_status NOT NULL DEFAULT 'queued',
  sent_at       timestamptz,
  clicked_at    timestamptz,
  fail_reason   text,
  attempts      smallint NOT NULL DEFAULT 0,
  -- Aynı kullanıcıya aynı mekan için aynı türden bildirimi tekrar kuyruğa
  -- almayı engelleyen çakışma anahtarı.
  dedupe_key    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedupe_key)
);
CREATE INDEX notification_queue_due_idx ON notification_queue (scheduled_at) WHERE status = 'queued';

-- Günlük bildirim tavanı: kullanıcıyı boğmamak için sayaç
CREATE TABLE notification_budget (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     date NOT NULL,
  sent    smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- ─── 8. Analitik olay akışı ───────────────────────────────────────────

-- Tek geniş tablo + jsonb: olay tipleri ürünle birlikte hızlı değişiyor.
-- Aylık partition, saklama politikasını ve silmeyi ucuzlatır.
CREATE TABLE analytics_events (
  id            bigserial,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id    uuid,
  name          text NOT NULL,          -- card_view, swipe_right, directions_open ...
  restaurant_id uuid,
  campaign_id   uuid,
  props         jsonb NOT NULL DEFAULT '{}',
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE analytics_events_default PARTITION OF analytics_events DEFAULT;
CREATE INDEX analytics_events_user_idx ON analytics_events (user_id, occurred_at DESC);
CREATE INDEX analytics_events_name_idx ON analytics_events (name, occurred_at DESC);

-- ─── 9. Gelir, ARPU ve LTV ────────────────────────────────────────────

CREATE TYPE revenue_source AS ENUM
  ('sponsored_card', 'directions_affiliate', 'reservation_commission',
   'rewarded_ad', 'user_subscription', 'org_subscription');

-- Her gelir satırı bir kullanıcıya bağlanır; ARPU doğrudan buradan çıkar.
CREATE TABLE revenue_events (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  org_id        uuid REFERENCES organizations(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  campaign_id   uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  source        revenue_source NOT NULL,
  amount_minor  integer NOT NULL,
  currency      char(3) NOT NULL DEFAULT 'TRY',
  -- Aracılık edilen ciro (komisyon değil, yönlendirilen toplam) — LTV girdisi
  gmv_minor     integer NOT NULL DEFAULT 0,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX revenue_events_user_idx   ON revenue_events (user_id, occurred_at DESC);
CREATE INDEX revenue_events_source_idx ON revenue_events (source, occurred_at DESC);

-- Nightly job'un yazdığı anlık görüntü; panel bunu okur, canlı toplama yapmaz.
CREATE TABLE user_ltv (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  days_since_signup integer NOT NULL,
  ad_revenue_minor          integer NOT NULL DEFAULT 0,
  subscription_revenue_minor integer NOT NULL DEFAULT 0,
  commission_revenue_minor  integer NOT NULL DEFAULT 0,
  referred_gmv_minor        integer NOT NULL DEFAULT 0,
  ltv_minor         integer NOT NULL DEFAULT 0,
  arpu_minor        integer NOT NULL DEFAULT 0,   -- ltv / aktif ay
  sponsored_views   integer NOT NULL DEFAULT 0,
  total_swipes      integer NOT NULL DEFAULT 0,
  directions_taken  integer NOT NULL DEFAULT 0,
  visits_confirmed  integer NOT NULL DEFAULT 0
);
CREATE INDEX user_ltv_value_idx ON user_ltv (ltv_minor DESC);

-- ─── 10. Kohort tabloları ─────────────────────────────────────────────

-- Kayıt haftası × gün ofseti kesişimi; retention eğrisi bundan çizilir.
CREATE TABLE cohort_retention (
  cohort_week   date NOT NULL,
  day_offset    smallint NOT NULL,      -- 0, 1, 7, 30 ...
  cohort_size   integer NOT NULL,
  active_users  integer NOT NULL,
  retention_pct numeric(5,2) GENERATED ALWAYS AS
    (CASE WHEN cohort_size = 0 THEN 0 ELSE active_users::numeric * 100 / cohort_size END) STORED,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_week, day_offset)
);

CREATE TABLE cohort_engagement (
  cohort_week        date PRIMARY KEY,
  cohort_size        integer NOT NULL,
  swipes_per_user    numeric(8,2) NOT NULL DEFAULT 0,
  saves_per_user     numeric(8,2) NOT NULL DEFAULT 0,
  -- Sağa kaydırdığı mekana fiziksel gitme dönüşümü
  save_to_directions_pct numeric(5,2) NOT NULL DEFAULT 0,
  save_to_visit_pct      numeric(5,2) NOT NULL DEFAULT 0,
  ltv_minor_avg      integer NOT NULL DEFAULT 0,
  computed_at        timestamptz NOT NULL DEFAULT now()
);
