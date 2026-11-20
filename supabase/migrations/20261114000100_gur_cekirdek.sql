-- ═══════════════════════════════════════════════════════════════════════
-- GUR — Supabase çekirdek şeması
--
-- server/db/schema.sql'in Supabase'e uyarlanmış hâli. Farklar ve nedenleri:
--
--  • KİMLİK Supabase Auth'ta. `users` + `auth_identities` yok; yerine
--    auth.users'a bağlı `profiles` var (parola/Google/Apple Supabase'in işi).
--  • restaurants.id METİN. Bakırköy listesinin kimliği `bkr-<anahtar>` ve
--    mobil uygulama favorilerini zaten bu kimlikle saklıyor; uuid'ye geçmek
--    YEREL moddaki favorileri sunucuya geçerken yetim bırakırdı.
--  • Eklenti YOK. Eskiden cube + earthdistance gerekiyordu; mesafe artık
--    düz haversine (gur_distance_m) — kurulacak eklenti yok, yönetilen
--    veritabanında yetki sorunu yok.
--  • İşletme planı (premium/pro) yok: işletme aboneliği ürün kararıyla
--    kaldırıldı. Kullanıcı planı yalnızca free | plus.
--  • Her tablo RLS ile kapalı doğar (bkz. 20261114000300_gur_guvenlik.sql).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Yardımcılar ──────────────────────────────────────────────────────

create or replace function public.gur_set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- İki nokta arası mesafe (metre). Haversine; cos/sin için asin(sqrt(...)).
create or replace function public.gur_distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable parallel safe as $$
  select 2 * 6371000 * asin(sqrt(least(1,
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))
$$;

-- "Bugün" İstanbul gününe göre başlar: UTC'ye göre başlasaydı kota gece
-- yarısı değil 03:00'te sıfırlanırdı.
create or replace function public.gur_today_start() returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'
$$;

-- ─── 1. Kimlik: profiller ─────────────────────────────────────────────

create type public.user_plan as enum ('free', 'plus');

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  display_name    text        not null,
  avatar_url      text,
  birth_year      smallint,
  plan            public.user_plan not null default 'free',
  plan_renews_at  timestamptz,
  -- Kayıt haftası kohort sorgularının çıpası; sonradan değişmez.
  cohort_week     date        not null default date_trunc('week', now())::date,
  locale          text        not null default 'tr-TR',
  marketing_optin boolean     not null default false,
  analytics_optin boolean     not null default false,   -- KVKK: açık rıza
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);
create index profiles_cohort_week_idx on public.profiles (cohort_week);

-- Yönetici: ayrı tablo. JWT'deki rol alanına güvenmiyoruz (kullanıcı kendi
-- user_metadata'sını yazabilir); yetki veritabanında, yalnızca service_role
-- ve postgres yazabilir.
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- Kayıt olan her auth.users satırına profil açar. Rıza bayrakları kayıt
-- sırasında (signUp options.data) gelir; yönetici/plan alanları ASLA
-- metadata'dan okunmaz.
create or replace function public.gur_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, analytics_optin, marketing_optin)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
             nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
             nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
             'GUR kullanıcısı'),
    coalesce((new.raw_user_meta_data ->> 'analytics_optin')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'marketing_optin')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger gur_on_auth_user_created
  after insert on auth.users
  for each row execute function public.gur_handle_new_user();

create table public.user_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  platform     text not null check (platform in ('ios', 'android', 'web')),
  push_token   text not null,
  push_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  unique (platform, push_token)
);
create index user_devices_user_idx on public.user_devices (user_id) where push_enabled;

-- ─── 2. Mekan havuzu ve dış kaynak beslemesi ──────────────────────────

create type public.ingest_provider as enum ('google_places', 'foursquare', 'tripadvisor', 'osm', 'manual');
create type public.review_status   as enum ('pending', 'approved', 'rejected');

-- B2B: işletme + sahiplenme (restaurants buna bağlanır)
create type public.claim_status as enum ('pending', 'approved', 'rejected');
create type public.org_role     as enum ('owner', 'manager', 'staff');

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  legal_name text not null,
  tax_id     text,
  created_at timestamptz not null default now()
);

create table public.restaurants (
  id             text primary key default gen_random_uuid()::text,
  name           text not null,
  category       text not null,
  description    text,
  address        text,
  district       text,
  city           text not null default 'İstanbul',
  -- location_exact = false iken lat/lng mekânın değil İLÇE MERKEZİNİN
  -- koordinatıdır: yalnızca sıralamada kullanılır; mesafe, yol tarifi ve
  -- ziyaret doğrulaması bu kayıtlara hiç uygulanmaz (gur_card koordinatı
  -- dışarı vermez, gur_visit_sample eşleştirmez).
  lat            double precision not null,
  lng            double precision not null,
  location_exact boolean not null default true,
  phone          text,
  website        text,
  price_level    smallint check (price_level between 1 and 4),
  rating         numeric(2,1),
  rating_count   integer not null default 0,
  hours          jsonb,                       -- {"mon":[["11:00","23:00"]], ...}
  tags           text[] not null default '{}',
  -- Gastro Onaylı şef değerlendirmesine dayanır; puanla ya da besleme ile
  -- OTOMATİK verilmez, yalnızca yönetici verir.
  gastro_approved boolean not null default false,
  gastro_chef    text,
  gastro_video_url text,
  claimed_by_org uuid references public.organizations(id) on delete set null,
  is_active      boolean not null default true,
  review_status  public.review_status not null default 'approved',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index restaurants_geo_idx      on public.restaurants (lat, lng);
create index restaurants_category_idx on public.restaurants (category) where is_active;
create index restaurants_district_idx on public.restaurants (district) where is_active;
create index restaurants_published_idx on public.restaurants (id) where is_active and review_status = 'approved';
create trigger restaurants_updated_at before update on public.restaurants
  for each row execute function public.gur_set_updated_at();

comment on column public.restaurants.lat is
  'location_exact=false ise ilçe merkezi, mekânın konumu DEĞİL. Uygulamaya gur_card() üzerinden gider.';

-- Ham yanıt saklanır ki normalizasyon kuralı değişince yeniden çekmeden
-- yeniden işlenebilsin. Sağlayıcı koşulları nedeniyle yalnızca yönetici okur.
create table public.restaurant_sources (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  provider      public.ingest_provider not null,
  external_id   text not null,
  payload       jsonb not null,
  confidence    numeric(3,2) not null default 1.0,
  fetched_at    timestamptz not null default now(),
  unique (provider, external_id)
);
create index restaurant_sources_restaurant_idx on public.restaurant_sources (restaurant_id);

create table public.restaurant_photos (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  url           text not null,
  width         integer,
  height        integer,
  origin        public.ingest_provider not null default 'manual',
  is_owner      boolean not null default false,   -- sıralamada dış kaynağın önüne geçer
  attribution   text,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index restaurant_photos_order_idx on public.restaurant_photos (restaurant_id, is_owner desc, position);

create table public.restaurant_menu_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  section       text,
  name          text not null,
  description   text,
  price_minor   integer,               -- kuruş
  currency      char(3) not null default 'TRY',
  photo_url     text,
  is_popular    boolean not null default false,
  is_available  boolean not null default true,
  source        public.ingest_provider not null default 'manual',
  updated_at    timestamptz not null default now()
);
create index restaurant_menu_items_idx on public.restaurant_menu_items (restaurant_id, is_available);

-- Dış kaynak yorumları kendi tablosunda: bize ait değiller, kaynağına atıf
-- zorunlu ve saklama süresi sağlayıcı koşullarına tabi.
create table public.restaurant_external_reviews (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  provider      public.ingest_provider not null,
  external_id   text not null,
  author_name   text,
  author_photo  text,
  author_url    text,
  rating        smallint check (rating between 1 and 5),
  body          text,
  language      text,
  relative_time text,
  published_at  timestamptz,
  source_url    text,
  fetched_at    timestamptz not null default now(),
  unique (provider, external_id)
);
create index restaurant_external_reviews_idx
  on public.restaurant_external_reviews (restaurant_id, provider, published_at desc nulls last);

-- ─── 3. B2B: üyelik ve sahiplenme ─────────────────────────────────────

create table public.org_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.org_role not null default 'manager',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.restaurant_claims (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  -- Kişi silinirse başvuru kaydı KALIR, kişi bağı kopar: aksi hâlde başvurusu
  -- olan kullanıcı hesabını silemezdi (hesap silme tek onayla ulaşılabilir olmalı).
  requested_by  uuid references public.profiles(id) on delete set null,
  status        public.claim_status not null default 'pending',
  evidence      jsonb not null default '{}',
  reviewer_id   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now()
);
-- Bir mekân için aynı anda yalnızca tek bekleyen başvuru.
create unique index restaurant_claims_one_pending
  on public.restaurant_claims (restaurant_id) where status = 'pending';

-- Onay kararı sahipliği BURADA bağlar (kapı uygulamada değil veritabanında):
-- yönetici paneli yalnızca durumu değiştirir, sahiplik kendiliğinden bağlanır.
create or replace function public.gur_claim_decided() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status then
    new.reviewer_id := coalesce(auth.uid(), new.reviewer_id);
    new.reviewed_at := now();
    if new.status = 'approved' then
      update public.restaurants set claimed_by_org = new.org_id where id = new.restaurant_id;
    end if;
  end if;
  return new;
end $$;
create trigger gur_claim_decided before update on public.restaurant_claims
  for each row execute function public.gur_claim_decided();

-- ─── 4. Kaydırma etkileşimleri ────────────────────────────────────────

create type public.swipe_direction as enum ('left', 'right', 'up');   -- geç / kaydet / süper

create table public.swipes (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  direction     public.swipe_direction not null,
  campaign_id   uuid,                 -- sponsorlu kart olarak gösterildiyse
  deck_position smallint,
  dwell_ms      integer,
  created_at    timestamptz not null default now()
);
create index swipes_user_idx       on public.swipes (user_id, created_at desc);
create index swipes_restaurant_idx on public.swipes (restaurant_id, direction);

create table public.saved_places (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  saved_at      timestamptz not null default now(),
  is_super      boolean not null default false,
  last_touch_at timestamptz not null default now(),
  visited_at    timestamptz,
  primary key (user_id, restaurant_id)
);
create index saved_places_cold_idx on public.saved_places (last_touch_at) where visited_at is null;

-- Kota: sayaç sunucuda, istemci ham sayıyı ASLA görmez (tablo istemciye
-- tamamen kapalı; yalnızca gur_quota() niteliksel baskıyı döndürür).
create table public.swipe_quota (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  window_start  timestamptz not null default public.gur_today_start(),
  used          integer not null default 0,
  bonus_granted integer not null default 0,
  rewarded_count integer not null default 0      -- günlük ödüllü reklam tavanı için
);

-- ─── 5. Konum doğrulamalı ziyaret ─────────────────────────────────────

create type public.visit_status as enum ('open', 'confirmed', 'abandoned', 'prompted', 'reviewed');

create table public.visits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  restaurant_id   text not null references public.restaurants(id) on delete cascade,
  status          public.visit_status not null default 'open',
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  confirmed_at    timestamptz,
  dwell_seconds   integer not null default 0,
  -- Ham konum saklanmaz: yalnızca en yakın ölçüm ve hassasiyet özeti.
  min_distance_m  numeric(7,1),
  best_accuracy_m numeric(7,1),
  sample_count    integer not null default 0,
  prompt_due_at   timestamptz,
  prompted_at     timestamptz,
  review_id       uuid,
  unique (user_id, restaurant_id, first_seen_at)
);
create index visits_user_idx on public.visits (user_id, first_seen_at desc);
create index visits_due_idx  on public.visits (prompt_due_at) where status = 'confirmed' and prompted_at is null;
create index visits_open_idx on public.visits (last_seen_at) where status = 'open';

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  visit_id      uuid references public.visits(id) on delete set null,
  stars         smallint not null check (stars between 1 and 5),
  body          text not null,
  photos        text[] not null default '{}',
  is_verified   boolean not null default false,     -- konumla doğrulanmış ziyaretten
  is_gourmet    boolean not null default false,
  hidden_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index reviews_restaurant_idx on public.reviews (restaurant_id, created_at desc) where hidden_at is null;
create index reviews_low_star_idx   on public.reviews (created_at desc) where stars <= 2 and hidden_at is null;
alter table public.visits add constraint visits_review_fkey
  foreign key (review_id) references public.reviews(id) on delete set null;

-- ─── 6. Kampanyalar ve reklam yerleşimi (CPC / CPE) ───────────────────

create type public.campaign_status as enum ('draft', 'active', 'paused', 'exhausted', 'ended');
create type public.pricing_model   as enum ('cpc', 'cpe');

create table public.campaigns (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  restaurant_id      text not null references public.restaurants(id) on delete cascade,
  label              text not null,
  status             public.campaign_status not null default 'draft',
  pricing            public.pricing_model not null default 'cpe',
  bid_minor          integer not null check (bid_minor > 0),
  daily_budget_minor integer not null check (daily_budget_minor > 0),
  total_budget_minor integer,
  spent_minor        integer not null default 0,
  target             jsonb not null default '{}',
  starts_at          timestamptz not null default now(),
  ends_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index campaigns_servable_idx on public.campaigns (status, starts_at, ends_at) where status = 'active';
alter table public.swipes add constraint swipes_campaign_fkey
  foreign key (campaign_id) references public.campaigns(id) on delete set null;

create type public.ad_event_kind as enum ('impression', 'click', 'save', 'directions', 'reservation');

create table public.ad_events (
  id            bigserial primary key,
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  kind          public.ad_event_kind not null,
  charged_minor integer not null default 0,
  deck_position smallint,
  created_at    timestamptz not null default now()
);
create index ad_events_campaign_idx on public.ad_events (campaign_id, created_at desc);
create index ad_events_user_idx     on public.ad_events (user_id, created_at desc);

create table public.campaign_daily_spend (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  day         date not null,
  impressions integer not null default 0,
  clicks      integer not null default 0,
  engagements integer not null default 0,
  spent_minor integer not null default 0,
  primary key (campaign_id, day)
);

-- ─── 7. Masa talebi (ücretsiz, komisyon yok) ──────────────────────────

create type public.reservation_status as enum ('pending', 'confirmed', 'declined', 'cancelled');

create table public.reservations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  party_size    smallint not null default 2 check (party_size between 1 and 20),
  reserved_for  timestamptz,
  note          text,
  status        public.reservation_status not null default 'pending',
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index reservations_restaurant_idx on public.reservations (restaurant_id, created_at desc);
create index reservations_user_idx       on public.reservations (user_id, created_at desc);

-- ─── 8. Bildirim kuyruğu ──────────────────────────────────────────────

create type public.notification_kind   as enum ('visit_review_prompt', 'reengagement_30d', 'campaign_offer', 'system');
create type public.notification_status as enum ('queued', 'sent', 'failed', 'suppressed', 'clicked');

create table public.notification_queue (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kind          public.notification_kind not null,
  restaurant_id text references public.restaurants(id) on delete cascade,
  campaign_id   uuid references public.campaigns(id) on delete set null,
  visit_id      uuid references public.visits(id) on delete cascade,
  title         text not null,
  body          text not null,
  deep_link     text,
  payload       jsonb not null default '{}',
  scheduled_at  timestamptz not null default now(),
  status        public.notification_status not null default 'queued',
  sent_at       timestamptz,
  clicked_at    timestamptz,
  fail_reason   text,
  attempts      smallint not null default 0,
  dedupe_key    text not null,
  created_at    timestamptz not null default now(),
  unique (dedupe_key)
);
create index notification_queue_due_idx on public.notification_queue (scheduled_at) where status = 'queued';

create table public.notification_budget (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  sent    smallint not null default 0,
  primary key (user_id, day)
);

-- ─── 9. Analitik olay akışı ───────────────────────────────────────────

create table public.analytics_events (
  id            bigserial,
  user_id       uuid references public.profiles(id) on delete cascade,
  session_id    uuid,
  name          text not null,
  restaurant_id text,
  campaign_id   uuid,
  props         jsonb not null default '{}',
  occurred_at   timestamptz not null default now(),
  primary key (id, occurred_at)
) partition by range (occurred_at);
create table public.analytics_events_default partition of public.analytics_events default;
create index analytics_events_user_idx on public.analytics_events (user_id, occurred_at desc);
create index analytics_events_name_idx on public.analytics_events (name, occurred_at desc);

-- ─── 10. Gelir, ARPU ve LTV ───────────────────────────────────────────

-- Rezervasyon komisyonu ve işletme aboneliği YOK. Gelir yalnızca sponsorlu
-- kart, ödüllü reklam, harita iştiraki ve GUR Plus.
create type public.revenue_source as enum
  ('sponsored_card', 'directions_affiliate', 'rewarded_ad', 'user_subscription');

create table public.revenue_events (
  id            bigserial primary key,
  user_id       uuid references public.profiles(id) on delete set null,
  org_id        uuid references public.organizations(id) on delete set null,
  restaurant_id text references public.restaurants(id) on delete set null,
  campaign_id   uuid references public.campaigns(id) on delete set null,
  source        public.revenue_source not null,
  amount_minor  integer not null,
  currency      char(3) not null default 'TRY',
  gmv_minor     integer not null default 0,
  occurred_at   timestamptz not null default now()
);
create index revenue_events_user_idx   on public.revenue_events (user_id, occurred_at desc);
create index revenue_events_source_idx on public.revenue_events (source, occurred_at desc);

create table public.user_ltv (
  user_id                    uuid primary key references public.profiles(id) on delete cascade,
  computed_at                timestamptz not null default now(),
  days_since_signup          integer not null,
  ad_revenue_minor           integer not null default 0,
  subscription_revenue_minor integer not null default 0,
  affiliate_revenue_minor    integer not null default 0,
  referred_gmv_minor         integer not null default 0,
  ltv_minor                  integer not null default 0,
  arpu_minor                 integer not null default 0,
  sponsored_views            integer not null default 0,
  total_swipes               integer not null default 0,
  directions_taken           integer not null default 0,
  visits_confirmed           integer not null default 0
);
create index user_ltv_value_idx on public.user_ltv (ltv_minor desc);

-- ─── 11. Kohort tabloları ─────────────────────────────────────────────

create table public.cohort_retention (
  cohort_week   date not null,
  day_offset    smallint not null,
  cohort_size   integer not null,
  active_users  integer not null,
  retention_pct numeric(5,2) generated always as
    (case when cohort_size = 0 then 0 else active_users::numeric * 100 / cohort_size end) stored,
  computed_at   timestamptz not null default now(),
  primary key (cohort_week, day_offset)
);

create table public.cohort_engagement (
  cohort_week            date primary key,
  cohort_size            integer not null,
  swipes_per_user        numeric(8,2) not null default 0,
  saves_per_user         numeric(8,2) not null default 0,
  save_to_directions_pct numeric(5,2) not null default 0,
  save_to_visit_pct      numeric(5,2) not null default 0,
  ltv_minor_avg          integer not null default 0,
  computed_at            timestamptz not null default now()
);
