-- ═══════════════════════════════════════════════════════════════════════
-- GUR — sunucu tarafı iş kuralları (RPC)
--
-- server/src/**'nin Supabase karşılığı. Mobil uygulama bu fonksiyonları
-- supabase.rpc(...) ile çağırır; tabloya doğrudan yazmaz (yazma yolları
-- RLS ile kapalı, bkz. 20261114000300_gur_guvenlik.sql).
--
-- KURALLAR
--  • İstemciden gelen user_id'ye asla güvenilmez: kimlik daima auth.uid().
--  • Ücret/gelir alanları istemciden GELMEZ (eski `affiliateMinor`,
--    `revenueMinor` parametreleri bilerek yok): istemci uydurma gelir
--    kaydı yazabilirdi.
--  • Dış API'ye açık fonksiyonlar `gur_*`, yalnızca içeriden çağrılanlar
--    `_gur_*` (hiçbir role execute verilmez).
--  • SECURITY DEFINER fonksiyonlar search_path'i sabitler.
--
-- Kota/eşik sabitleri shared/deck.js ile AYNI (40 günlük hak, +5 ödül) —
-- biri değişirse ikisi de değişmeli.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── İç yardımcılar ───────────────────────────────────────────────────

create or replace function public._gur_uid() returns uuid
language plpgsql stable as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Oturum gerekli' using errcode = '28000'; end if;
  return v;
end $$;

-- Ölçümlemeye asla girmemesi gereken alanlar sessizce düşer; iç içe değerler
-- 500 karaktere kesilmiş metne çevrilir (server/src/analytics/events.js).
create or replace function public._gur_scrub(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(k, case when jsonb_typeof(v) in ('object', 'array')
                                           then to_jsonb(left(v::text, 500)) else v end),
                  '{}'::jsonb)
    from jsonb_each(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) as t(k, v)
   where k <> all (array['email', 'phone', 'name', 'displayName', 'address', 'token', 'ip'])
$$;

-- Kullanıcı analitik rızası vermediyse olay user_id OLMADAN, yalnızca
-- toplulaştırma için saklanır: rıza reddi ürün metriklerini tamamen kör
-- etmemeli ama kimseyi de izlememeli.
create or replace function public._gur_log_event(
  p_user uuid, p_name text, p_restaurant text default null,
  p_campaign uuid default null, p_props jsonb default '{}', p_session uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_subject uuid := p_user;
begin
  if v_subject is not null
     and not coalesce((select analytics_optin from public.profiles where id = v_subject), false) then
    v_subject := null;
  end if;
  insert into public.analytics_events (user_id, session_id, name, restaurant_id, campaign_id, props)
  values (v_subject, p_session, p_name, p_restaurant, p_campaign, public._gur_scrub(p_props));
end $$;

-- Günün kota satırı; gün döndüyse pencere sıfırlanır (ayrı cron gerekmez).
create or replace function public._gur_read_quota(p_user uuid)
returns table (used int, bonus_granted int, rewarded_count int, plan public.user_plan)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  insert into public.swipe_quota as q (user_id) values (p_user)
  on conflict (user_id) do update set
    used           = case when q.window_start < public.gur_today_start() then 0 else q.used end,
    bonus_granted  = case when q.window_start < public.gur_today_start() then 0 else q.bonus_granted end,
    rewarded_count = case when q.window_start < public.gur_today_start() then 0 else q.rewarded_count end,
    window_start   = case when q.window_start < public.gur_today_start() then public.gur_today_start() else q.window_start end;
  return query
    select q.used, q.bonus_granted, q.rewarded_count, p.plan
      from public.swipe_quota q join public.profiles p on p.id = q.user_id
     where q.user_id = p_user;
end $$;

-- shared/deck.js → quotaState. Ham sayı HİÇ dönmez, yalnızca niteliksel baskı.
create or replace function public.gur_quota_state(p_plan public.user_plan, p_used int, p_bonus int)
returns jsonb language sql immutable as $$
  with s as (select case when p_plan = 'free' then 40 + coalesce(p_bonus, 0) - coalesce(p_used, 0)
                         else 1000000 end as kalan)
  select jsonb_build_object(
    'allowed',  kalan > 0,
    'pressure', case when kalan <= 0 then 'exhausted' when kalan <= 5 then 'near' else 'free' end)
  from s
$$;

create or replace function public._gur_bump_spend(
  p_campaign uuid, p_impressions int default 0, p_clicks int default 0,
  p_engagements int default 0, p_spent int default 0)
returns void language sql security definer set search_path = public as $$
  insert into public.campaign_daily_spend as d (campaign_id, day, impressions, clicks, engagements, spent_minor)
  values (p_campaign, (now() at time zone 'Europe/Istanbul')::date, p_impressions, p_clicks, p_engagements, p_spent)
  on conflict (campaign_id, day) do update set
    impressions = d.impressions + excluded.impressions,
    clicks      = d.clicks      + excluded.clicks,
    engagements = d.engagements + excluded.engagements,
    spent_minor = d.spent_minor + excluded.spent_minor
$$;

-- Örnek gelmeyi kesen açık ziyaretleri kapatır (kalış yeterliyse doğrular).
create or replace function public._gur_close_stale_visits(p_user uuid default null)
returns void language sql security definer set search_path = public as $$
  update public.visits set
    status        = case when dwell_seconds >= 900 then 'confirmed'::public.visit_status
                         else 'abandoned'::public.visit_status end,
    confirmed_at  = case when dwell_seconds >= 900 and confirmed_at is null then now() else confirmed_at end,
    prompt_due_at = case when dwell_seconds >= 900 and prompt_due_at is null
                         then now() + interval '90 minutes' else prompt_due_at end
   where status = 'open'
     and last_seen_at < now() - interval '20 minutes'
     and (p_user is null or user_id = p_user)
$$;

-- ─── Mekan kartı (server/src/http/routes.js → shapeCard) ──────────────

create or replace function public.gur_today_hours(h jsonb) returns text
language sql stable as $$
  select string_agg((s ->> 0) || ' - ' || (s ->> 1), ', ')
    from jsonb_array_elements(
      case when jsonb_typeof(h) = 'object'
            and jsonb_typeof(h -> (array['sun','mon','tue','wed','thu','fri','sat'])
                  [extract(dow from (now() at time zone 'Europe/Istanbul'))::int + 1]) = 'array'
           then h -> (array['sun','mon','tue','wed','thu','fri','sat'])
                  [extract(dow from (now() at time zone 'Europe/Istanbul'))::int + 1]
           else '[]'::jsonb end) s
$$;

-- Veritabanı satırını istemcinin beklediği kart şekline çevirir.
-- location_exact=false: lat/lng DIŞARI VERİLMEZ (ilçe merkezi mekân konumu
-- sanılmasın); yalnızca sıralama için `area` gider. İlçe merkezine uzaklık
-- mekâna uzaklık değil: `dist` de yazılmaz.
create or replace function public.gur_card(
  r public.restaurants, p_distance_m float8 default null, p_is_super boolean default null)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', r.id, 'name', r.name, 'cat', r.category, 'desc', r.description,
    'addr', r.address, 'district', r.district,
    'lat', case when r.location_exact then r.lat end,
    'lng', case when r.location_exact then r.lng end,
    'rating', r.rating, 'ratingCount', r.rating_count,
    'price', case when r.price_level is not null then repeat('₺', r.price_level) end,
    'priceLevel', r.price_level,
    'hours', public.gur_today_hours(r.hours),
    'hoursByDay', r.hours,
    'tags', to_jsonb(r.tags),
    'gastro', r.gastro_approved, 'gastroChef', r.gastro_chef, 'gastroVideo', r.gastro_video_url,
    'claimed', r.claimed_by_org is not null,
    'dist', case when p_distance_m is not null and r.location_exact
                 then to_char(p_distance_m / 1000, 'FM990.0') || ' km' end,
    'imgs', coalesce((select jsonb_agg(p.url order by p.is_owner desc, p.position)
                        from public.restaurant_photos p where p.restaurant_id = r.id), '[]'::jsonb))
  || case when not r.location_exact
          then jsonb_build_object('area', jsonb_build_object('lat', r.lat, 'lng', r.lng))
          else '{}'::jsonb end
  || case when p_is_super is not null then jsonb_build_object('isSuper', p_is_super)
          else '{}'::jsonb end
$$;

-- ─── Okuma ────────────────────────────────────────────────────────────

create or replace function public.gur_health() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('ok', true,
    'restaurants', (select count(*) from public.restaurants where is_active and review_status = 'approved'))
$$;

create or replace function public.gur_restaurants(
  p_lat float8 default null, p_lng float8 default null,
  p_q text default null, p_limit int default 300)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(t.card order by t.sira), '[]'::jsonb)
    from (
      select public.gur_card(r, d.m) as card,
             row_number() over (order by d.m nulls last, r.name) as sira
        from public.restaurants r
        cross join lateral (
          select case when p_lat is not null and p_lng is not null
                      then public.gur_distance_m(p_lat, p_lng, r.lat, r.lng) end as m) d
       where r.is_active and r.review_status = 'approved'
         and (p_q is null or r.name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
       order by d.m nulls last, r.name
       limit least(greatest(coalesce(p_limit, 300), 1), 500)
    ) t
$$;

-- Detay: yorumcu adı kısaltılır ("Elif K."): profiller tablosu başkasına
-- kapalı, bu yüzden fonksiyon SECURITY DEFINER ve yayın kapısını kendisi uygular.
create or replace function public.gur_restaurant_detail(p_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.restaurants;
begin
  select * into r from public.restaurants
   where id = p_id and ((is_active and review_status = 'approved') or public.is_admin());
  if not found then return null; end if;

  return jsonb_build_object(
    'restaurant', public.gur_card(r),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('url', p.url, 'is_owner', p.is_owner)
                                         order by p.is_owner desc, p.position)
                          from public.restaurant_photos p where p.restaurant_id = r.id), '[]'::jsonb),
    'menu', coalesce((select jsonb_agg(jsonb_build_object(
                'name', m.name, 'description', m.description, 'price_minor', m.price_minor,
                'photo_url', m.photo_url, 'is_popular', m.is_popular))
                        from public.restaurant_menu_items m
                       where m.restaurant_id = r.id and m.is_available), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(x.j order by x.is_verified desc, x.created_at desc)
                           from (select rv.is_verified, rv.created_at, jsonb_build_object(
                                   'stars', rv.stars, 'body', rv.body, 'photos', to_jsonb(rv.photos),
                                   'is_verified', rv.is_verified, 'created_at', rv.created_at,
                                   'display_name', regexp_replace(pr.display_name, '^(\S+)\s+(\S).*$', '\1 \2.')) as j
                                   from public.reviews rv join public.profiles pr on pr.id = rv.user_id
                                  where rv.restaurant_id = r.id and rv.hidden_at is null
                                  order by rv.is_verified desc, rv.created_at desc limit 20) x), '[]'::jsonb),
    'externalReviews', coalesce((select jsonb_agg(jsonb_build_object(
                'provider', e.provider, 'author_name', e.author_name, 'author_photo', e.author_photo,
                'author_url', e.author_url, 'rating', e.rating, 'body', e.body,
                'relative_time', e.relative_time, 'published_at', e.published_at, 'source_url', e.source_url)
                order by e.published_at desc nulls last)
                        from (select * from public.restaurant_external_reviews
                               where restaurant_id = r.id
                               order by published_at desc nulls last limit 8) e), '[]'::jsonb),
    'services', jsonb_build_object(
      'claimed', r.claimed_by_org is not null,
      'plan', null,
      'orgName', (select legal_name from public.organizations where id = r.claimed_by_org),
      'campaigns', coalesce((select jsonb_agg(jsonb_build_object('label', c.label, 'pricing', c.pricing))
                               from public.campaigns c
                              where c.restaurant_id = r.id and c.status = 'active'), '[]'::jsonb)),
    'ownerPhotoCount', (select count(*) from public.restaurant_photos p
                         where p.restaurant_id = r.id and p.is_owner));
end $$;

-- Servis edilebilir kampanyalar (shared/deck.js → rankCampaigns girdisi).
-- `restaurant` alanı organik kartla AYNI şekil: kart bileşeni ayırt etmez.
create or replace function public.gur_campaigns(p_radius_m float8 default 12000,
  p_lat float8 default null, p_lng float8 default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'label', c.label, 'pricing', c.pricing, 'bidMinor', c.bid_minor,
      'remainingBudgetMinor', c.daily_budget_minor - coalesce(d.spent_minor, 0),
      'status', c.status, 'category', r.category,
      'engagementRate', coalesce(d.engagements::numeric / nullif(d.impressions, 0), 0.5),
      'restaurant', public.gur_card(r))), '[]'::jsonb)
    from public.campaigns c
    join public.restaurants r on r.id = c.restaurant_id and r.is_active and r.review_status = 'approved'
    left join public.campaign_daily_spend d
           on d.campaign_id = c.id and d.day = (now() at time zone 'Europe/Istanbul')::date
   where c.status = 'active' and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())
     and (c.total_budget_minor is null or c.spent_minor < c.total_budget_minor)
     and coalesce(d.spent_minor, 0) < c.daily_budget_minor
     and (p_lat is null or p_lng is null or not r.location_exact
          or public.gur_distance_m(p_lat, p_lng, r.lat, r.lng) <= p_radius_m)
$$;

-- ─── Kullanıcı ────────────────────────────────────────────────────────

create or replace function public.gur_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid(); p public.profiles;
begin
  select * into p from public.profiles where id = v_uid;
  if not found then raise exception 'Kullanıcı yok' using errcode = 'P0002'; end if;
  return jsonb_build_object('user', jsonb_build_object(
      'id', p.id, 'display_name', p.display_name, 'email', p.email, 'plan', p.plan,
      'analytics_optin', p.analytics_optin, 'marketing_optin', p.marketing_optin),
    'role', case when public.is_admin() then 'admin' else 'user' end);
end $$;

create or replace function public.gur_set_consent(p_analytics boolean default null, p_marketing boolean default null)
returns void language sql security definer set search_path = public as $$
  update public.profiles set
    analytics_optin = coalesce(p_analytics, analytics_optin),
    marketing_optin = coalesce(p_marketing, marketing_optin)
   where id = public._gur_uid()
$$;

-- Hesap silme: auth.users satırı silinir, profil ve kullanıcıya ait her şey
-- ON DELETE CASCADE ile gider (swipe, kayıt, ziyaret, yorum). Gelir ve reklam
-- kayıtlarında kullanıcı bağı SET NULL: muhasebe satırı kalır, kişi kalmaz.
-- Tek onayla ulaşılabilir (roach motel yok).
create or replace function public.gur_delete_me() returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid();
begin
  delete from auth.users where id = v_uid;
end $$;

create or replace function public.gur_saved() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.gur_card(r, null, sp.is_super)
                            || jsonb_build_object('savedAt', sp.saved_at, 'visitedAt', sp.visited_at)
                            order by sp.saved_at desc), '[]'::jsonb)
    from public.saved_places sp
    join public.restaurants r on r.id = sp.restaurant_id and r.is_active and r.review_status = 'approved'
   where sp.user_id = public._gur_uid()
$$;

-- ─── Kota ve kaydırma ─────────────────────────────────────────────────

create or replace function public.gur_quota() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid(); q record;
begin
  select * into q from public._gur_read_quota(v_uid);
  return public.gur_quota_state(q.plan, q.used, q.bonus_granted);
end $$;

-- Kaydırmayı kaydeder, kotayı düşer, sponsorluysa ücretlendirir.
--
-- Kota burada ENGELLEMEZ, yalnızca durumu döndürür: mobil pakette ödüllü
-- reklam akışı henüz yok (bkz. CLAUDE.md "22 bileşen"), kapıyı sunucuda
-- kapatmak kullanıcıyı 40. kaydırmada çıkışsız bırakırdı. Ödüllü reklam
-- taşınınca burada `raise exception` açılacak.
--
-- Kampanya ücretlendirmesi İSTEMCİYE GÜVENMEZ: kampanya o mekâna ait,
-- aktif ve bütçesi kalmış olmalı; aynı kullanıcı aynı kampanyaya ömür
-- boyu en fazla BİR kez ücretlendirilir (deste kuralıyla aynı — yoksa
-- bir istemci rakibin bütçesini döngüyle eritebilirdi).
create or replace function public.gur_record_swipe(
  p_restaurant_id text, p_direction public.swipe_direction,
  p_campaign_id uuid default null, p_deck_position int default null, p_dwell_ms int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := public._gur_uid();
  v_saved boolean := p_direction in ('right', 'up');
  c       record;
  q       record;
  v_camp  uuid := null;
begin
  if not exists (select 1 from public.restaurants
                  where id = p_restaurant_id and is_active and review_status = 'approved') then
    raise exception 'Restoran bulunamadı' using errcode = 'P0002';
  end if;

  select * into q from public._gur_read_quota(v_uid);

  if p_campaign_id is not null then
    select cp.id, cp.pricing, cp.bid_minor, cp.org_id into c
      from public.campaigns cp
      left join public.campaign_daily_spend d
             on d.campaign_id = cp.id and d.day = (now() at time zone 'Europe/Istanbul')::date
     where cp.id = p_campaign_id and cp.restaurant_id = p_restaurant_id
       and cp.status = 'active' and cp.starts_at <= now() and (cp.ends_at is null or cp.ends_at > now())
       and (cp.total_budget_minor is null or cp.spent_minor < cp.total_budget_minor)
       and coalesce(d.spent_minor, 0) < cp.daily_budget_minor;
    if found then v_camp := c.id; end if;
  end if;

  insert into public.swipes (user_id, restaurant_id, direction, campaign_id, deck_position, dwell_ms)
  values (v_uid, p_restaurant_id, p_direction, v_camp, p_deck_position, p_dwell_ms);
  update public.swipe_quota set used = used + 1 where user_id = v_uid;

  if v_saved then
    insert into public.saved_places (user_id, restaurant_id, is_super)
    values (v_uid, p_restaurant_id, p_direction = 'up')
    on conflict (user_id, restaurant_id) do update
      set is_super = public.saved_places.is_super or excluded.is_super, last_touch_at = now();
  else
    delete from public.saved_places where user_id = v_uid and restaurant_id = p_restaurant_id;
  end if;

  -- CPE: sağa/yukarı kaydırma ücretlendirilir (kullanıcı başına bir kez).
  if v_camp is not null and v_saved then
    if c.pricing = 'cpe'
       and not exists (select 1 from public.ad_events
                        where campaign_id = v_camp and user_id = v_uid and charged_minor > 0) then
      insert into public.ad_events (campaign_id, user_id, restaurant_id, kind, charged_minor, deck_position)
      values (v_camp, v_uid, p_restaurant_id, 'save', c.bid_minor, p_deck_position);
      update public.campaigns set
        spent_minor = spent_minor + c.bid_minor,
        status = case when total_budget_minor is not null and spent_minor + c.bid_minor >= total_budget_minor
                      then 'exhausted'::public.campaign_status else status end
       where id = v_camp;
      perform public._gur_bump_spend(v_camp, 0, 0, 1, c.bid_minor);
      insert into public.revenue_events (user_id, org_id, restaurant_id, campaign_id, source, amount_minor)
      values (v_uid, c.org_id, p_restaurant_id, v_camp, 'sponsored_card', c.bid_minor);
    else
      perform public._gur_bump_spend(v_camp, 0, 0, 1, 0);
    end if;
  end if;

  perform public._gur_log_event(v_uid, 'swipe_' || p_direction::text, p_restaurant_id, v_camp,
    jsonb_build_object('deckPosition', p_deck_position, 'dwellMs', p_dwell_ms));

  select * into q from public._gur_read_quota(v_uid);
  return public.gur_quota_state(q.plan, q.used, q.bonus_granted);
end $$;

-- Cihazdaki favorileri hesaba katar (yeni cihazda giriş / çevrimdışı birikenler).
-- Kota ve ücretlendirmeye DOKUNMAZ: bu bir kaydırma değil, durum eşitleme.
-- Yalnızca yayındaki mekânlar; en fazla 500 kayıt.
create or replace function public.gur_sync_saved(p_ids text[], p_super_ids text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid();
begin
  insert into public.saved_places (user_id, restaurant_id, is_super)
  select v_uid, r.id, r.id = any (coalesce(p_super_ids, '{}'))
    from public.restaurants r
   where r.id = any (coalesce(p_ids, '{}') || coalesce(p_super_ids, '{}'))
     and r.is_active and r.review_status = 'approved'
   limit 500
  on conflict (user_id, restaurant_id) do update
    set is_super = public.saved_places.is_super or excluded.is_super;
end $$;

-- Sponsorlu kart EKRANDA görüldü. Kampanya o mekâna ait ve aktif olmalı.
create or replace function public.gur_log_impression(
  p_campaign_id uuid, p_restaurant_id text, p_deck_position int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid();
begin
  if not exists (select 1 from public.campaigns
                  where id = p_campaign_id and restaurant_id = p_restaurant_id and status = 'active') then
    return;
  end if;
  insert into public.ad_events (campaign_id, user_id, restaurant_id, kind, deck_position)
  values (p_campaign_id, v_uid, p_restaurant_id, 'impression', p_deck_position);
  perform public._gur_bump_spend(p_campaign_id, 1, 0, 0, 0);
end $$;

-- Ödüllü reklam tamamlandı: kota bonusu. Gelir alanı İSTEMCİDEN gelmez
-- (reklam ağı doğrulaması bağlanınca sunucu tarafında yazılacak). Günde en
-- fazla 10 bonus: doğrulama olmadan sonsuz hak kazanılmasın.
create or replace function public.gur_rewarded_ad_done() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid(); q record;
begin
  select * into q from public._gur_read_quota(v_uid);
  if q.rewarded_count < 10 then
    update public.swipe_quota set bonus_granted = bonus_granted + 5, rewarded_count = rewarded_count + 1
     where user_id = v_uid;
  end if;
  select * into q from public._gur_read_quota(v_uid);
  return public.gur_quota_state(q.plan, q.used, q.bonus_granted);
end $$;

-- ─── Konum doğrulamalı ziyaret (server/src/visits/tracker.js) ─────────
-- Eşikler: 120 m yarıçap, 100 m'den iyi hassasiyet, 15 dk kalış, 20 dk
-- boşlukta ziyaret kapanır, 90 dk sonra "nasıldı" sorulur, aynı mekân 20 saat
-- içinde ikinci kez sorulmaz. Ham konum saklanmaz.

create or replace function public.gur_visit_sample(
  p_lat float8, p_lng float8, p_accuracy_m float8 default null, p_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := public._gur_uid();
  v_at   timestamptz := least(coalesce(p_at, now()), now());
  near   record;
  o      record;
  v_dwell int;
  v_confirmed boolean;
  v_id   uuid;
  v_status public.visit_status;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return jsonb_build_object('matched', null);
  end if;
  if p_accuracy_m is not null and p_accuracy_m > 100 then
    return jsonb_build_object('matched', null, 'reason', 'low_accuracy');
  end if;
  -- Çevrimdışı birikmiş örnek kabul, ama 6 saatten eskisi değil: kalış
  -- süresi geriye dönük uydurulamasın.
  if v_at < now() - interval '6 hours' then
    return jsonb_build_object('matched', null, 'reason', 'stale_sample');
  end if;

  -- En yakın aktif mekân. location_exact=false kayıtlar HİÇ eşleşmez: ilçe
  -- merkezinin yakınındaki biri rastgele bir mekâna "doğrulandı" rozeti alırdı.
  select r.id, r.name, public.gur_distance_m(p_lat, p_lng, r.lat, r.lng) as distance_m into near
    from public.restaurants r
   where r.is_active and r.review_status = 'approved' and r.location_exact
     and r.lat between p_lat - 0.002 and p_lat + 0.002
     and r.lng between p_lng - 0.003 and p_lng + 0.003
     and public.gur_distance_m(p_lat, p_lng, r.lat, r.lng) <= 120
   order by distance_m limit 1;

  if not found then
    perform public._gur_close_stale_visits(v_uid);
    return jsonb_build_object('matched', null);
  end if;

  select id, first_seen_at, confirmed_at into o
    from public.visits
   where user_id = v_uid and restaurant_id = near.id and status = 'open'
   order by first_seen_at desc limit 1;

  if not found then
    if exists (select 1 from public.visits
                where user_id = v_uid and restaurant_id = near.id
                  and first_seen_at > now() - interval '20 hours' and status <> 'abandoned') then
      return jsonb_build_object('matched', near.id, 'reason', 'cooldown');
    end if;
    insert into public.visits (user_id, restaurant_id, min_distance_m, best_accuracy_m,
                               sample_count, first_seen_at, last_seen_at)
    values (v_uid, near.id, near.distance_m, p_accuracy_m, 1, v_at, v_at)
    returning id into v_id;
    return jsonb_build_object('matched', near.id, 'visitId', v_id, 'status', 'open');
  end if;

  v_dwell := greatest(0, round(extract(epoch from (v_at - o.first_seen_at)))::int);
  v_confirmed := v_dwell >= 900;

  update public.visits set
      last_seen_at    = v_at,
      dwell_seconds   = v_dwell,
      sample_count    = sample_count + 1,
      min_distance_m  = least(min_distance_m, near.distance_m),
      best_accuracy_m = least(coalesce(best_accuracy_m, 9999), coalesce(p_accuracy_m, 9999)),
      status          = case when v_confirmed and status = 'open' then 'confirmed'::public.visit_status else status end,
      confirmed_at    = case when v_confirmed and confirmed_at is null then now() else confirmed_at end,
      prompt_due_at   = case when v_confirmed and prompt_due_at is null then now() + interval '90 minutes' else prompt_due_at end
   where id = o.id
   returning id, status into v_id, v_status;

  if v_confirmed and o.confirmed_at is null then
    perform public._gur_log_event(v_uid, 'visit_confirmed', near.id, null,
      jsonb_build_object('dwellSeconds', v_dwell, 'distanceM', round(near.distance_m)));
    -- Kaydedilmiş yer artık "gidilmiş": 30 günlük hatırlatma onu atlar.
    update public.saved_places set visited_at = now(), last_touch_at = now()
     where user_id = v_uid and restaurant_id = near.id;
  end if;

  return jsonb_build_object('matched', near.id, 'visitId', v_id, 'status', v_status);
end $$;

-- Yorum kilidi yalnızca doğrulanmış ziyaretle açılır; ziyaret başına tek yorum.
create or replace function public.gur_review_permission(p_restaurant_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid(); v record;
begin
  select id into v from public.visits
   where user_id = v_uid and restaurant_id = p_restaurant_id
     and status in ('confirmed', 'prompted') and review_id is null
     and confirmed_at > now() - interval '14 days'
   order by confirmed_at desc limit 1;
  if found then
    return jsonb_build_object('allowed', true, 'visitId', v.id, 'reason', 'verified_visit');
  end if;
  return jsonb_build_object('allowed', false, 'reason', 'no_verified_visit');
end $$;

-- Vakti gelen "deneyim nasıldı" davetleri (uygulama içi bant bunu okur).
create or replace function public.gur_visit_prompts() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid();
begin
  perform public._gur_close_stale_visits(v_uid);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', x.id, 'restaurant_id', x.restaurant_id, 'dwell_seconds', x.dwell_seconds,
      'restaurant_name', x.name) order by x.confirmed_at desc)
    from (select v.id, v.restaurant_id, v.dwell_seconds, v.confirmed_at, r.name
            from public.visits v join public.restaurants r on r.id = v.restaurant_id
           where v.user_id = v_uid and v.status = 'confirmed'
             and v.prompt_due_at <= now() and v.review_id is null
           order by v.confirmed_at desc limit 5) x), '[]'::jsonb);
end $$;

-- Doğrulanmış ziyaretten yorum; "Konumla doğrulandı" rozeti yalnızca bu yolla.
create or replace function public.gur_submit_review(
  p_restaurant_id text, p_stars int, p_body text, p_photos text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._gur_uid();
  perm  jsonb;
  v_review uuid;
begin
  if p_stars is null or p_stars not between 1 and 5 then raise exception 'Puan 1-5 arası olmalı'; end if;
  if length(trim(coalesce(p_body, ''))) < 10 then raise exception 'Yorum en az 10 karakter olmalı'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 4 then raise exception 'En fazla 4 fotoğraf eklenebilir'; end if;

  perm := public.gur_review_permission(p_restaurant_id);
  if not (perm ->> 'allowed')::boolean then
    raise exception 'Bu mekân için doğrulanmış ziyaretin yok' using errcode = '42501';
  end if;

  insert into public.reviews (user_id, restaurant_id, visit_id, stars, body, photos, is_verified)
  values (v_uid, p_restaurant_id, (perm ->> 'visitId')::uuid, p_stars, left(trim(p_body), 2000),
          coalesce(p_photos, '{}'), true)
  returning id into v_review;

  update public.visits set status = 'reviewed', review_id = v_review where id = (perm ->> 'visitId')::uuid;
  perform public._gur_log_event(v_uid, 'review_submit', p_restaurant_id, null,
    jsonb_build_object('stars', p_stars, 'verified', true));
  return v_review;
end $$;

-- ─── Analitik ─────────────────────────────────────────────────────────

create or replace function public.gur_log_events(p_events jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._gur_uid();
  e jsonb; n int := 0;
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if jsonb_typeof(p_events) <> 'array' then raise exception 'events dizisi gerekli'; end if;
  for e in select * from jsonb_array_elements(p_events) limit 200 loop
    continue when jsonb_typeof(e) <> 'object' or coalesce(e ->> 'name', '') !~ '^[a-z0-9_]{1,64}$';
    perform public._gur_log_event(
      v_uid, e ->> 'name', left(e ->> 'restaurantId', 80),
      case when (e ->> 'campaignId') ~* c_uuid then (e ->> 'campaignId')::uuid end,
      e -> 'props',
      case when (e ->> 'sessionId') ~* c_uuid then (e ->> 'sessionId')::uuid end);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Yol tarifi açıldı: olay + kaydedilmiş yerin "soğuma" saati tazelenir.
-- Iştirak geliri İSTEMCİDEN gelmez.
create or replace function public.gur_track_directions(p_restaurant_id text, p_provider text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid();
begin
  perform public._gur_log_event(v_uid, 'directions_open', p_restaurant_id, null,
    jsonb_build_object('provider', left(p_provider, 40)));
  update public.saved_places set last_touch_at = now()
   where user_id = v_uid and restaurant_id = p_restaurant_id;
end $$;

-- ─── Masa talebi ──────────────────────────────────────────────────────
-- ÜCRETSİZ ve yalnızca kaydını SAHİPLENMİŞ işletmelerde açık: sahipsiz bir
-- mekân adına söz veremeyiz. Kapı arayüzde değil BURADA. Aynı kullanıcı aynı
-- mekâna bekleyen talebini tekrar gönderirse yeni satır açılmaz.

create or replace function public.gur_reserve(
  p_restaurant_id text, p_party_size int default 2,
  p_reserved_for timestamptz default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid(); v_org uuid; v_id uuid;
begin
  select claimed_by_org into v_org from public.restaurants
   where id = p_restaurant_id and is_active and review_status = 'approved';
  if not found then raise exception 'Restoran bulunamadı' using errcode = 'P0002'; end if;
  if v_org is null then
    raise exception 'Bu mekan kaydını henüz sahiplenmedi; masa ayırtma yalnızca üye işletmelerde açık.'
      using errcode = 'P0001';
  end if;
  if p_party_size is null or p_party_size not between 1 and 20 then
    raise exception 'Kişi sayısı 1-20 arası olmalı';
  end if;

  select id into v_id from public.reservations
   where user_id = v_uid and restaurant_id = p_restaurant_id and status = 'pending'
     and created_at > now() - interval '24 hours';
  if found then return v_id; end if;

  insert into public.reservations (user_id, restaurant_id, party_size, reserved_for, note)
  values (v_uid, p_restaurant_id, p_party_size, p_reserved_for, left(p_note, 500))
  returning id into v_id;

  perform public._gur_log_event(v_uid, 'reservation_complete', p_restaurant_id, null,
    jsonb_build_object('partySize', p_party_size));
  return v_id;
end $$;

-- ─── B2B: sahiplenme başvurusu ────────────────────────────────────────
create or replace function public.gur_submit_claim(
  p_restaurant_id text, p_legal_name text, p_tax_id text default null,
  p_contact_name text default null, p_phone text default null, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._gur_uid(); v_org uuid; v_claim public.restaurant_claims;
begin
  if coalesce(trim(p_legal_name), '') = '' then raise exception 'legalName gerekli'; end if;
  if not exists (select 1 from public.restaurants where id = p_restaurant_id and is_active) then
    raise exception 'Restoran bulunamadı' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.restaurants where id = p_restaurant_id and claimed_by_org is not null) then
    raise exception 'Bu mekân zaten sahiplenilmiş' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.restaurant_claims where restaurant_id = p_restaurant_id and status = 'pending') then
    raise exception 'Bu işletme için zaten bekleyen bir başvuru var' using errcode = 'P0001';
  end if;

  insert into public.organizations (legal_name, tax_id) values (trim(p_legal_name), p_tax_id)
  returning id into v_org;
  insert into public.org_members (org_id, user_id, role) values (v_org, v_uid, 'owner');
  insert into public.restaurant_claims (restaurant_id, org_id, requested_by, evidence)
  values (p_restaurant_id, v_org, v_uid,
          jsonb_build_object('contactName', p_contact_name, 'phone', p_phone, 'email', p_email))
  returning * into v_claim;
  return jsonb_build_object('id', v_claim.id, 'status', v_claim.status);
end $$;
