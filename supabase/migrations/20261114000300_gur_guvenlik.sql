-- ═══════════════════════════════════════════════════════════════════════
-- GUR — satır düzeyi güvenlik (RLS), yetkiler ve fonksiyon erişimi
--
-- İLKE: her tablo KAPALI doğar. İstemci (anon / authenticated) yalnızca
-- burada açıkça verilen satırlara dokunabilir; yazma yolları RPC'lerdir
-- (20261114000200_gur_rpc.sql). service_role RLS'i zaten aşar.
--
-- YENİ TABLO EKLERKEN: `enable row level security` yazmayı unutmayın.
-- supabase:kur sonunda RLS'siz tablo varsa uyarır ve hata verir.
-- ═══════════════════════════════════════════════════════════════════════

-- Varsayılan geniş yetkileri geri al, aşağıda tek tek ver.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- ─── RLS'i aç ─────────────────────────────────────────────────────────
alter table public.profiles                   enable row level security;
alter table public.platform_admins            enable row level security;
alter table public.user_devices               enable row level security;
alter table public.organizations              enable row level security;
alter table public.org_members                enable row level security;
alter table public.restaurants                enable row level security;
alter table public.restaurant_sources         enable row level security;
alter table public.restaurant_photos          enable row level security;
alter table public.restaurant_menu_items      enable row level security;
alter table public.restaurant_external_reviews enable row level security;
alter table public.restaurant_claims          enable row level security;
alter table public.swipes                     enable row level security;
alter table public.saved_places               enable row level security;
alter table public.swipe_quota                enable row level security;
alter table public.visits                     enable row level security;
alter table public.reviews                    enable row level security;
alter table public.campaigns                  enable row level security;
alter table public.ad_events                  enable row level security;
alter table public.campaign_daily_spend       enable row level security;
alter table public.reservations               enable row level security;
alter table public.notification_queue         enable row level security;
alter table public.notification_budget        enable row level security;
alter table public.analytics_events           enable row level security;
alter table public.analytics_events_default   enable row level security;
alter table public.revenue_events             enable row level security;
alter table public.user_ltv                   enable row level security;
alter table public.cohort_retention           enable row level security;
alter table public.cohort_engagement          enable row level security;

-- Yardımcı: kullanıcı bu işletmenin üyesi mi? (RLS özyinelemesi olmasın diye
-- SECURITY DEFINER.)
create or replace function public.gur_is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is not null and exists (
    select 1 from public.org_members where org_id = p_org and user_id = auth.uid())
$$;

-- ─── Profiller ────────────────────────────────────────────────────────
grant select on public.profiles to authenticated;
-- Yalnızca bu sütunlar kullanıcı tarafından değişir; plan/kohort asla.
grant update (display_name, avatar_url, birth_year, locale, marketing_optin, analytics_optin)
  on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ─── Yönetici listesi ─────────────────────────────────────────────────
-- İstemciye kapalı (rol bilgisi gur_me() ile gelir); yazma yalnızca
-- service_role / postgres.

-- ─── Cihazlar ─────────────────────────────────────────────────────────
grant select, insert, update, delete on public.user_devices to authenticated;
create policy devices_own on public.user_devices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Mekan havuzu: yayındakini herkes görür ───────────────────────────
grant select on public.restaurants, public.restaurant_photos,
                public.restaurant_menu_items, public.restaurant_external_reviews
  to anon, authenticated;
grant insert, update, delete on public.restaurants, public.restaurant_photos,
                public.restaurant_menu_items, public.restaurant_external_reviews
  to authenticated;      -- politikalar yalnızca yöneticiye açar

create policy restaurants_public_read on public.restaurants for select to anon, authenticated
  using ((is_active and review_status = 'approved')
         or public.is_admin() or public.gur_is_org_member(claimed_by_org));
create policy restaurants_admin_write on public.restaurants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Alt tablolar: üst kayıt görünüyorsa görünür (üstün RLS'i aynen uygulanır).
create policy photos_read on public.restaurant_photos for select to anon, authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id));
create policy photos_admin_write on public.restaurant_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy menu_read on public.restaurant_menu_items for select to anon, authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id));
create policy menu_admin_write on public.restaurant_menu_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy ext_reviews_read on public.restaurant_external_reviews for select to anon, authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id));
create policy ext_reviews_admin_write on public.restaurant_external_reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Ham kaynak yanıtı (sağlayıcı koşulları): yalnızca yönetici.
grant select, insert, update, delete on public.restaurant_sources to authenticated;
create policy sources_admin on public.restaurant_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── B2B ──────────────────────────────────────────────────────────────
grant select on public.organizations, public.org_members to authenticated;
grant update on public.organizations to authenticated;
create policy orgs_read on public.organizations for select to authenticated
  using (public.is_admin() or public.gur_is_org_member(id));
create policy orgs_admin_update on public.organizations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy members_read on public.org_members for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select, update on public.restaurant_claims to authenticated;
create policy claims_read on public.restaurant_claims for select to authenticated
  using (requested_by = auth.uid() or public.is_admin());
create policy claims_admin_decide on public.restaurant_claims for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Kullanıcı etkileşimleri ──────────────────────────────────────────
grant select on public.swipes, public.visits to authenticated;
create policy swipes_own_read on public.swipes for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy visits_own_read on public.visits for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select, delete on public.saved_places to authenticated;
create policy saved_own_read on public.saved_places for select to authenticated
  using (user_id = auth.uid());
create policy saved_own_delete on public.saved_places for delete to authenticated
  using (user_id = auth.uid());

-- swipe_quota: istemciye TAMAMEN kapalı (ham sayı sızmaz). Politika yok.

-- Yorumlar: yayındaki mekânın gizlenmemiş yorumları herkese açık okunur
-- (yazar adı için gur_restaurant_detail kullanılır); yazma yalnızca RPC.
grant select, delete on public.reviews to anon, authenticated;
create policy reviews_public_read on public.reviews for select to anon, authenticated
  using ((hidden_at is null and exists (select 1 from public.restaurants r where r.id = restaurant_id))
         or user_id = auth.uid() or public.is_admin());
create policy reviews_own_delete on public.reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant update (hidden_at) on public.reviews to authenticated;
create policy reviews_admin_hide on public.reviews for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Kampanyalar: işletme üyesi ve yönetici. Servis edilebilir olanlar
-- gur_campaigns() ile (bütçe bilgisi sızmasın diye tabloya doğrudan açık değil).
grant select, insert, update, delete on public.campaigns to authenticated;
create policy campaigns_member_read on public.campaigns for select to authenticated
  using (public.is_admin() or public.gur_is_org_member(org_id));
create policy campaigns_admin_write on public.campaigns for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Masa talebi: talep eden, işletmenin üyeleri ve yönetici görür; durumu
-- yalnızca işletme/yönetici değiştirir.
grant select on public.reservations to authenticated;
grant update (status, decided_at) on public.reservations to authenticated;
create policy reservations_read on public.reservations for select to authenticated
  using (user_id = auth.uid() or public.is_admin()
         or public.gur_is_org_member((select r.claimed_by_org from public.restaurants r where r.id = restaurant_id)));
create policy reservations_decide on public.reservations for update to authenticated
  using (public.is_admin()
         or public.gur_is_org_member((select r.claimed_by_org from public.restaurants r where r.id = restaurant_id)))
  with check (public.is_admin()
         or public.gur_is_org_member((select r.claimed_by_org from public.restaurants r where r.id = restaurant_id)));

-- Bildirim: kullanıcı kendi kuyruğunu okur; yazan sunucu (service_role).
grant select on public.notification_queue to authenticated;
create policy notif_own_read on public.notification_queue for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ─── Yalnızca yönetici okur: raporlama tabloları ──────────────────────
grant select on public.ad_events, public.campaign_daily_spend, public.notification_budget,
                public.analytics_events, public.analytics_events_default, public.revenue_events,
                public.user_ltv, public.cohort_retention, public.cohort_engagement
  to authenticated;
create policy ad_events_admin       on public.ad_events             for select to authenticated using (public.is_admin());
create policy daily_spend_admin     on public.campaign_daily_spend  for select to authenticated using (public.is_admin() or public.gur_is_org_member((select c.org_id from public.campaigns c where c.id = campaign_id)));
create policy notif_budget_admin    on public.notification_budget   for select to authenticated using (public.is_admin());
create policy analytics_admin       on public.analytics_events      for select to authenticated using (public.is_admin());
create policy analytics_def_admin   on public.analytics_events_default for select to authenticated using (public.is_admin());
create policy revenue_admin         on public.revenue_events        for select to authenticated using (public.is_admin());
create policy ltv_admin             on public.user_ltv              for select to authenticated using (public.is_admin());
create policy cohort_ret_admin      on public.cohort_retention      for select to authenticated using (public.is_admin());
create policy cohort_eng_admin      on public.cohort_engagement     for select to authenticated using (public.is_admin());

-- ─── Fonksiyon erişimi ────────────────────────────────────────────────
-- Herkese açık okuma (giriş gerekmez)
grant execute on function
  public.gur_health(), public.gur_restaurants(float8, float8, text, int),
  public.gur_restaurant_detail(text), public.gur_campaigns(float8, float8, float8),
  public.gur_card(public.restaurants, float8, boolean), public.gur_today_hours(jsonb),
  public.gur_distance_m(float8, float8, float8, float8), public.gur_today_start(),
  public.gur_quota_state(public.user_plan, int, int),
  -- RLS politikaları çağıran rolün yetkisiyle çalışır: anon da bunlara
  -- execute izni olmadan yayındaki mekânları okuyamaz.
  public.is_admin(), public.gur_is_org_member(uuid)
  to anon, authenticated;

-- Yalnızca oturum açmış kullanıcı
grant execute on function
  public.gur_me(), public.gur_set_consent(boolean, boolean), public.gur_delete_me(),
  public.gur_saved(), public.gur_sync_saved(text[], text[]), public.gur_quota(),
  public.gur_record_swipe(text, public.swipe_direction, uuid, int, int),
  public.gur_log_impression(uuid, text, int), public.gur_rewarded_ad_done(),
  public.gur_visit_sample(float8, float8, float8, timestamptz),
  public.gur_review_permission(text), public.gur_visit_prompts(),
  public.gur_submit_review(text, int, text, text[]),
  public.gur_log_events(jsonb), public.gur_track_directions(text, text),
  public.gur_reserve(text, int, timestamptz, text),
  public.gur_submit_claim(text, text, text, text, text, text)
  to authenticated;
-- (`_gur_*` iç yardımcılar: hiçbir role execute verilmez.)
