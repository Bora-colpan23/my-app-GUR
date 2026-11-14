-- ═══════════════════════════════════════════════════════════════════════
-- GUR — yönetici paneli arka ucu (Supabase)
--
-- Panel artık Node sunucusuna değil buraya bakabiliyor. Kurallar mobildekiyle
-- AYNI: yetki veritabanında (platform_admins → is_admin()), yazma yolu RPC,
-- JWT metadata'ya güvenilmez, her yönetici işlemi admin_audit'e düşer.
--
-- Bu migration'da:
--   • platform_settings  — platform ayarları (şimdilik: açık/kapalı ilçeler)
--   • admin_audit        — kim, ne zaman, neyi değiştirdi
--   • gur_admin_*        — panelin okuduğu/yazdığı RPC'ler
--   • gur_districts()    — herkese açık ilçe durumu (mobil okuyabilsin)
--   • gur_restaurants / gur_campaigns — KAPALI ilçenin mekânlarını artık
--     tüketiciye vermiyor (panelde "Çok yakında" ilçeler)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Tablolar (RLS açık doğar) ─────────────────────────────────────

create table public.platform_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
-- Ayarlar herkese okunur (mobil hangi ilçenin açık olduğunu bilmeli);
-- yazma politikası YOK: yalnızca gur_admin_* RPC'leri yazar.
create policy platform_settings_read on public.platform_settings
  for select to anon, authenticated using (true);

create table public.admin_audit (
  id         bigserial primary key,
  admin_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  target     text,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_time_idx on public.admin_audit (created_at desc);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;
revoke all on sequence public.admin_audit_id_seq from anon, authenticated;
grant select on public.admin_audit to authenticated;
create policy admin_audit_read on public.admin_audit
  for select to authenticated using (public.is_admin());

-- ─── 2. İç yardımcılar ────────────────────────────────────────────────

create or replace function public._gur_admin() returns uuid
language plpgsql stable set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Yönetici yetkisi gerekli' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create or replace function public._gur_audit(p_action text, p_target text, p_detail jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit (admin_id, action, target, detail)
  values (auth.uid(), p_action, p_target, coalesce(p_detail, '{}'::jsonb))
$$;

-- İlçe açık mı? Kayıtlı bir karar varsa o; yoksa varsayılan: yayında mekânı
-- olan ilçe AÇIK (platform.js → districtDefaultOpen ile aynı kural).
create or replace function public._gur_district_open(p_district text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_district is null then true
    else coalesce(
      (select (s.value ->> p_district)::boolean
         from public.platform_settings s
        where s.key = 'districts_open' and s.value ? p_district),
      exists (select 1 from public.restaurants r
               where r.district = p_district and r.is_active and r.review_status = 'approved'))
  end
$$;

-- ─── 3. Tüketiciye giden listeler: kapalı ilçe düşer ──────────────────

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
         and public._gur_district_open(r.district)
         and (p_q is null or r.name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
       order by d.m nulls last, r.name
       limit least(greatest(coalesce(p_limit, 300), 1), 500)
    ) t
$$;

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
         and public._gur_district_open(r.district)
    left join public.campaign_daily_spend d
           on d.campaign_id = c.id and d.day = (now() at time zone 'Europe/Istanbul')::date
   where c.status = 'active' and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())
     and (c.total_budget_minor is null or c.spent_minor < c.total_budget_minor)
     and coalesce(d.spent_minor, 0) < c.daily_budget_minor
     and (p_lat is null or p_lng is null or not r.location_exact
          or public.gur_distance_m(p_lat, p_lng, r.lat, r.lng) <= p_radius_m)
$$;

-- İlçe durumu (herkese açık): ad, açık mı, yayındaki mekân sayısı.
create or replace function public.gur_districts() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', d.name, 'open', public._gur_district_open(d.name), 'venues', d.venues)
         order by d.name), '[]'::jsonb)
    from (
      select r.district as name, count(*) as venues
        from public.restaurants r
       where r.district is not null and r.is_active and r.review_status = 'approved'
       group by r.district
      union
      select k, 0 from public.platform_settings s, jsonb_object_keys(s.value) k
       where s.key = 'districts_open'
         and not exists (select 1 from public.restaurants r2 where r2.district = k
                          and r2.is_active and r2.review_status = 'approved')
    ) d
$$;

-- ─── 4. Yönetici RPC'leri ─────────────────────────────────────────────

create or replace function public.gur_admin_me() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('admin', public.is_admin(), 'email', (select email from public.profiles where id = auth.uid()))
$$;

-- Mekân havuzu: gizlilik / yayın / Gastro durumuyla birlikte.
create or replace function public.gur_admin_restaurants(p_q text default null, p_limit int default 500)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._gur_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', r.id, 'name', r.name, 'category', r.category, 'district', r.district,
             'active', r.is_active, 'review', r.review_status,
             'gastro', r.gastro_approved, 'gastroChef', r.gastro_chef, 'gastroVideo', r.gastro_video_url,
             'claimed', r.claimed_by_org is not null, 'updatedAt', r.updated_at)
           order by r.name), '[]'::jsonb)
      from (select * from public.restaurants x
             where p_q is null or x.name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%'
             order by x.name
             limit least(greatest(coalesce(p_limit, 500), 1), 1000)) r);
end $$;

-- Tek mekânın yönetici alanları. Yalnızca bilinen anahtarlar; başkası HATA
-- (sessizce yutulursa yöneticinin bastığı anahtarın işe yaradığını sanırdı).
--   active (bool)    → is_active       (görünürlük anahtarı)
--   review (text)    → review_status   (pending/approved/rejected)
--   gastro (bool)    → gastro_approved (puanla verilmez, yalnızca yönetici)
--   gastro_chef, gastro_video (text)
create or replace function public.gur_admin_set_restaurant(p_id text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bad text; v_row public.restaurants;
begin
  perform public._gur_admin();
  if jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb then
    raise exception 'Güncellenecek alan yok' using errcode = '22023';
  end if;
  select string_agg(k, ', ') into v_bad
    from jsonb_object_keys(p_patch) k
   where k <> all (array['active', 'review', 'gastro', 'gastro_chef', 'gastro_video']);
  if v_bad is not null then
    raise exception 'Bilinmeyen alan: %', v_bad using errcode = '22023';
  end if;

  update public.restaurants set
      is_active       = case when p_patch ? 'active' then (p_patch ->> 'active')::boolean else is_active end,
      review_status   = case when p_patch ? 'review' then (p_patch ->> 'review')::public.review_status else review_status end,
      gastro_approved = case when p_patch ? 'gastro' then (p_patch ->> 'gastro')::boolean else gastro_approved end,
      gastro_chef     = case when p_patch ? 'gastro_chef' then nullif(trim(p_patch ->> 'gastro_chef'), '') else gastro_chef end,
      gastro_video_url = case when p_patch ? 'gastro_video' then nullif(trim(p_patch ->> 'gastro_video'), '') else gastro_video_url end
    where id = p_id
    returning * into v_row;
  if not found then raise exception 'Mekân bulunamadı' using errcode = 'P0002'; end if;

  perform public._gur_audit('restaurant.update', p_id, p_patch);
  return jsonb_build_object('id', v_row.id, 'active', v_row.is_active, 'review', v_row.review_status,
    'gastro', v_row.gastro_approved, 'gastroChef', v_row.gastro_chef, 'gastroVideo', v_row.gastro_video_url);
end $$;

create or replace function public.gur_admin_claims(p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._gur_admin();
  return (
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb)
      from (
        select c.id, c.status, c.created_at, c.evidence, c.reject_reason,
               r.id as restaurant_id, r.name as restaurant_name,
               o.legal_name, o.tax_id
          from public.restaurant_claims c
          join public.restaurants r on r.id = c.restaurant_id
          join public.organizations o on o.id = c.org_id
         order by c.created_at desc
         limit least(greatest(coalesce(p_limit, 100), 1), 500)) x);
end $$;

-- Karar: onay sahipliği gur_claim_decided tetikleyicisi bağlar (kapı veritabanında).
create or replace function public.gur_admin_decide_claim(p_id uuid, p_status text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_claim public.restaurant_claims; v_owner uuid;
begin
  perform public._gur_admin();
  if p_status not in ('approved', 'rejected') then
    raise exception 'Geçersiz karar: %', p_status using errcode = '22023';
  end if;
  select * into v_claim from public.restaurant_claims where id = p_id and status = 'pending' for update;
  if not found then raise exception 'Bekleyen başvuru bulunamadı' using errcode = 'P0002'; end if;
  if p_status = 'approved' then
    select claimed_by_org into v_owner from public.restaurants where id = v_claim.restaurant_id;
    if v_owner is not null and v_owner <> v_claim.org_id then
      raise exception 'Mekân başka bir işletmeye ait' using errcode = 'P0001';
    end if;
  end if;
  update public.restaurant_claims
     set status = p_status::public.claim_status,
         reject_reason = case when p_status = 'rejected' then coalesce(nullif(trim(p_reason), ''), 'Belge doğrulanamadı') end
   where id = p_id;
  perform public._gur_audit('claim.' || p_status, v_claim.restaurant_id,
    jsonb_build_object('claim', p_id, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

create or replace function public.gur_admin_campaigns() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._gur_admin();
  return jsonb_build_object('campaigns', (
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.bid_minor desc), '[]'::jsonb)
      from (
        select c.id, c.label, c.status, c.pricing, c.bid_minor, c.daily_budget_minor,
               c.total_budget_minor, c.spent_minor,
               r.name as restaurant, o.legal_name as org,
               coalesce(d.impressions, 0) as impressions, coalesce(d.clicks, 0) as clicks,
               coalesce(d.engagements, 0) as engagements, coalesce(d.spent_minor, 0) as today_spent
          from public.campaigns c
          join public.restaurants r on r.id = c.restaurant_id
          join public.organizations o on o.id = c.org_id
          left join public.campaign_daily_spend d
                 on d.campaign_id = c.id and d.day = (now() at time zone 'Europe/Istanbul')::date) x));
end $$;

-- 'exhausted' sistemin kararı (bütçe bitti); yönetici elle koyamaz.
create or replace function public.gur_admin_patch_campaign(
  p_id uuid, p_status text default null, p_bid_minor int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.campaigns;
begin
  perform public._gur_admin();
  if p_status is null and p_bid_minor is null then
    raise exception 'Güncellenecek alan yok' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('draft', 'active', 'paused', 'ended') then
    raise exception 'Geçersiz durum: %', p_status using errcode = '22023';
  end if;
  update public.campaigns set
      status    = coalesce(p_status::public.campaign_status, status),
      bid_minor = coalesce(greatest(p_bid_minor, 20), bid_minor)
    where id = p_id returning * into v;
  if not found then raise exception 'Kampanya bulunamadı' using errcode = 'P0002'; end if;
  perform public._gur_audit('campaign.update', p_id::text,
    jsonb_strip_nulls(jsonb_build_object('status', p_status, 'bidMinor', p_bid_minor)));
  return jsonb_build_object('id', v.id, 'status', v.status, 'bid_minor', v.bid_minor);
end $$;

-- Büyüme: kohortlar CANLI hesaplanır (Node'daki gecelik toplama tablosu
-- burada beslenmiyor). Tanımlar:
--   dN  = kayıt gününden N gün sonra en az bir kaydırma yapan kullanıcı %'si;
--         kohortun N. günü henüz dolmadıysa null (olgunlaşmamış veri 0 sayılmaz)
--   save_to_directions_pct = kaydeden kullanıcılardan yol tarifi açanlar;
--         YALNIZCA analitik rızası verenler (rızasız olay kullanıcıya bağlanmaz)
create or replace function public.gur_admin_growth(p_weeks int default 12) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_weeks int := least(greatest(coalesce(p_weeks, 12), 1), 52);
        v_today date := (now() at time zone 'Europe/Istanbul')::date;
begin
  perform public._gur_admin();
  return jsonb_build_object(
    'cohorts', (
      select coalesce(jsonb_agg(row_to_json(k)::jsonb order by k.cohort_week desc), '[]'::jsonb)
      from (
        select p.cohort_week,
               count(*)::int as cohort_size,
               case when v_today >= p.cohort_week + 6 + 1
                    then round(100.0 * count(*) filter (where exists (
                           select 1 from public.swipes s where s.user_id = p.id
                              and (s.created_at at time zone 'Europe/Istanbul')::date
                                  = (p.created_at at time zone 'Europe/Istanbul')::date + 1)) / count(*), 2) end as d1,
               case when v_today >= p.cohort_week + 6 + 7
                    then round(100.0 * count(*) filter (where exists (
                           select 1 from public.swipes s where s.user_id = p.id
                              and (s.created_at at time zone 'Europe/Istanbul')::date
                                  = (p.created_at at time zone 'Europe/Istanbul')::date + 7)) / count(*), 2) end as d7,
               case when v_today >= p.cohort_week + 6 + 30
                    then round(100.0 * count(*) filter (where exists (
                           select 1 from public.swipes s where s.user_id = p.id
                              and (s.created_at at time zone 'Europe/Istanbul')::date
                                  = (p.created_at at time zone 'Europe/Istanbul')::date + 30)) / count(*), 2) end as d30,
               round(coalesce(sum((select count(*) from public.swipes s where s.user_id = p.id)), 0)::numeric / count(*), 2) as swipes_per_user,
               round(coalesce(sum((select count(*) from public.swipes s
                                    where s.user_id = p.id and s.direction in ('right', 'up'))), 0)::numeric / count(*), 2) as saves_per_user,
               coalesce(round(100.0 * count(*) filter (where exists (
                                  select 1 from public.analytics_events a
                                   where a.user_id = p.id and a.name = 'directions_open')
                                and exists (select 1 from public.swipes s
                                             where s.user_id = p.id and s.direction in ('right', 'up')))
                      / nullif(count(*) filter (where exists (
                                  select 1 from public.swipes s
                                   where s.user_id = p.id and s.direction in ('right', 'up'))), 0), 2), 0) as save_to_directions_pct,
               coalesce(round(100.0 * count(*) filter (where exists (
                                  select 1 from public.saved_places sp where sp.user_id = p.id and sp.visited_at is not null))
                      / nullif(count(*) filter (where exists (
                                  select 1 from public.saved_places sp where sp.user_id = p.id)), 0), 2), 0) as save_to_visit_pct,
               coalesce(round(sum((select coalesce(sum(e.amount_minor), 0)
                                     from public.revenue_events e where e.user_id = p.id))::numeric / count(*)), 0)::int as ltv_minor_avg
          from public.profiles p
         where p.cohort_week > v_today - v_weeks * 7
         group by p.cohort_week) k),
    'platform', (
      select jsonb_build_object(
        'users', (select count(*) from public.profiles)::int,
        'ltv_minor', coalesce(round((select coalesce(sum(amount_minor), 0) from public.revenue_events)::numeric
                          / nullif((select count(*) from public.profiles), 0)), 0)::int,
        'arpu_minor', coalesce(round((select coalesce(sum(amount_minor), 0) from public.revenue_events
                                        where occurred_at > now() - interval '30 days')::numeric
                          / nullif((select count(*) from public.profiles), 0)), 0)::int,
        'ad_revenue_minor', (select coalesce(sum(amount_minor), 0) from public.revenue_events
                              where source in ('sponsored_card', 'rewarded_ad'))::int)));
end $$;

-- İlçeyi aç/kapat. p_open = null → kayıtlı kararı sil (varsayılana dön).
create or replace function public.gur_admin_set_district(p_name text, p_open boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  perform public._gur_admin();
  if coalesce(trim(p_name), '') = '' then raise exception 'İlçe adı gerekli' using errcode = '22023'; end if;
  insert into public.platform_settings (key, value, updated_by)
  values ('districts_open', '{}'::jsonb, auth.uid())
  on conflict (key) do nothing;
  update public.platform_settings
     set value = case when p_open is null then value - p_name
                      else value || jsonb_build_object(p_name, p_open) end,
         updated_at = now(), updated_by = auth.uid()
   where key = 'districts_open'
   returning value into v;
  perform public._gur_audit('district.set', p_name, jsonb_build_object('open', p_open));
  return v;
end $$;

-- ─── 5. Erişim ────────────────────────────────────────────────────────
-- Yeni fonksiyonlar varsayılan olarak herkese açık doğar: önce kapat.
revoke all on function
  public._gur_admin(), public._gur_audit(text, text, jsonb), public._gur_district_open(text),
  public.gur_districts(), public.gur_admin_me(),
  public.gur_admin_restaurants(text, int), public.gur_admin_set_restaurant(text, jsonb),
  public.gur_admin_claims(int), public.gur_admin_decide_claim(uuid, text, text),
  public.gur_admin_campaigns(), public.gur_admin_patch_campaign(uuid, text, int),
  public.gur_admin_growth(int), public.gur_admin_set_district(text, boolean)
  from public, anon, authenticated;

-- RLS/yayın süzgeci çağıranın yetkisiyle çalıştığı için anon da çağırabilmeli.
grant execute on function public._gur_district_open(text), public.gur_districts()
  to anon, authenticated;

-- Yönetici RPC'leri oturum açmış herkese açık AMA her biri kendi içinde
-- is_admin() ister; yönetici olmayan 42501 alır.
grant execute on function
  public.gur_admin_me(),
  public.gur_admin_restaurants(text, int), public.gur_admin_set_restaurant(text, jsonb),
  public.gur_admin_claims(int), public.gur_admin_decide_claim(uuid, text, text),
  public.gur_admin_campaigns(), public.gur_admin_patch_campaign(uuid, text, int),
  public.gur_admin_growth(int), public.gur_admin_set_district(text, boolean)
  to authenticated;
-- (_gur_admin / _gur_audit: hiçbir role execute verilmez — RPC'ler SECURITY DEFINER.)
