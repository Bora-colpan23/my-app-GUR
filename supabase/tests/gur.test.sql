-- ═══════════════════════════════════════════════════════════════════════
-- GUR Supabase şeması — davranış testleri (scripts/supabase-test.sh)
--
-- Her `t.ok` bir doğrulama; ilk başarısızlık betiği durdurur. Roller
-- gerçek Supabase gibi taklit edilir: set_config(request.jwt.claims) +
-- SET LOCAL ROLE, yani RLS ve execute izinleri GERÇEKTEN devrede.
-- ═══════════════════════════════════════════════════════════════════════

create schema t;
grant usage on schema t to anon, authenticated;

create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'BAŞARISIZ: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create function t.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;
create function t.as_super() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- sql çalışır ve BEKLENEN hatayla düşmeli (beklenen: mesaj parçası).
create function t.throws(p_sql text, p_expect text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_expect || '%' then
      raise notice 'ok - % (hata: %)', p_msg, sqlerrm;
      return;
    end if;
    raise exception 'BAŞARISIZ: % — beklenen "%" ama gelen "%"', p_msg, p_expect, sqlerrm;
  end;
  raise exception 'BAŞARISIZ: % — hata bekleniyordu, olmadı', p_msg;
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ─── Kurulum ──────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'ayse@example.com',
   '{"name":"Ayşe Yılmaz","analytics_optin":true}'),
  ('00000000-0000-0000-0000-0000000000a2', 'can@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'yonetici@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', null, '{}');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a3');

-- ═══ A. Seed ═════════════════════════════════════════════════════════
do $$ begin
  perform t.ok((select count(*) from public.restaurants) = 218, 'seed: 218 mekân');
  perform t.ok((select count(*) from public.restaurant_sources) = 218, 'seed: 218 kaynak kaydı');
  perform t.ok((select count(*) from public.restaurants where location_exact) = 0,
    'seed: koordinat uydurulmadı (hepsi ilçe merkezi, location_exact=false)');
  perform t.ok((select count(*) from public.restaurants where gastro_approved) = 0, 'seed: Gastro Onaylı YOK');
  perform t.ok((select count(*) from public.reviews) = 0 and (select count(*) from public.restaurant_external_reviews) = 0,
    'seed: uydurma yorum YOK');
  perform t.ok((select count(*) from public.restaurants where id !~ '^bkr-') = 0, 'seed: kimlikler bkr-<anahtar>');
end $$;

-- Seed idempotent + sahiplenilmiş kaydı ezmez
do $$
declare v_id text := (select id from public.restaurants order by id limit 1); v_org uuid;
begin
  insert into public.organizations (legal_name) values ('Test İşletmesi') returning id into v_org;
  update public.restaurants set claimed_by_org = v_org, name = 'İşletmenin Girdiği Ad' where id = v_id;
  raise notice 'seed tekrar çalıştırılacak, sahiplenilen kayıt: %', v_id;
  perform set_config('t.claimed_id', v_id, false);
end $$;
\i supabase/seed.sql
do $$ begin
  perform t.ok((select count(*) from public.restaurants) = 218, 'seed tekrar: kopya üretmedi');
  perform t.ok((select name from public.restaurants where id = current_setting('t.claimed_id')) = 'İşletmenin Girdiği Ad',
    'seed tekrar: sahiplenen işletmenin değeri EZİLMEDİ');
end $$;

-- ═══ B. Profil tetikleyicisi ═════════════════════════════════════════
do $$ begin
  perform t.ok((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'Ayşe Yılmaz', 'profil: ad metadata''dan');
  perform t.ok((select analytics_optin from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'profil: rıza kayıtta gelen bayraktan');
  perform t.ok((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a2') = 'can', 'profil: ad yoksa e-postanın başı');
  perform t.ok((select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a4') = 'GUR kullanıcısı', 'profil: e-posta da yoksa varsayılan ad');
  perform t.ok((select plan from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'free', 'profil: plan free');
  perform t.ok(not (select analytics_optin from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'), 'profil: rıza varsayılan KAPALI');
end $$;

-- ═══ C. Anon erişimi ═════════════════════════════════════════════════
do $$
declare j jsonb; c jsonb;
begin
  perform t.as_anon();
  perform t.ok((public.gur_health() ->> 'restaurants')::int = 218, 'anon: gur_health 218 mekân');
  perform t.ok((select count(*) from public.restaurants) = 218, 'anon: yayındaki mekânları RLS ile okur');
  j := public.gur_restaurants(null, null, null, 300);
  perform t.ok(jsonb_array_length(j) = 218, 'anon: gur_restaurants 218 kart');
  c := j -> 0;
  perform t.ok(c ? 'name' and c ? 'cat' and c ? 'imgs', 'kart şekli: name/cat/imgs');
  perform t.ok(c -> 'lat' = 'null'::jsonb and c -> 'lng' = 'null'::jsonb, 'kart: ilçe merkezi mekân koordinatı gibi DIŞARI VERİLMEDİ');
  perform t.ok((c -> 'area' ->> 'lat')::float8 between 40.9 and 41.1, 'kart: yalnızca sıralama için area var');
  perform t.ok(c -> 'dist' = 'null'::jsonb, 'kart: ilçe merkezine uzaklık "dist" olarak yazılmadı');
  perform t.ok(jsonb_array_length(public.gur_restaurants(null, null, 'pizza', 300)) between 1 and 217, 'anon: ad araması çalışır');
  perform t.ok(jsonb_array_length(public.gur_restaurants(null, null, '%', 300)) = 218, 'anon: arama joker karakteri sızdırmaz');
  perform t.throws('select count(*) from public.profiles', 'permission denied', 'anon: profillere erişemez');
  perform t.throws('select count(*) from public.swipe_quota', 'permission denied', 'anon: kota tablosuna erişemez');
  perform t.throws('select count(*) from public.restaurant_sources', 'permission denied', 'anon: ham kaynak yanıtına erişemez');
  perform t.throws('insert into public.restaurants (id,name,category,lat,lng) values (''x'',''x'',''x'',1,1)', 'permission denied', 'anon: mekân ekleyemez');
  perform t.throws('select public.gur_me()', 'permission denied', 'anon: gur_me execute izni yok');
  perform t.throws('select public.gur_record_swipe(''x'', ''left'')', 'permission denied', 'anon: kaydıramaz');
  perform t.as_super();
end $$;

-- ═══ D. Gizli / yayında olmayan mekân ════════════════════════════════
do $$
declare v_id text := (select id from public.restaurants where claimed_by_org is null order by id limit 1);
begin
  update public.restaurants set is_active = false where id = v_id;
  perform t.as_anon();
  perform t.ok(jsonb_array_length(public.gur_restaurants()) = 217, 'gizli mekân listeden düştü');
  perform t.ok(public.gur_restaurant_detail(v_id) = 'null'::jsonb or public.gur_restaurant_detail(v_id) is null, 'gizli mekânın detayı anon''a kapalı');
  perform t.as_user('00000000-0000-0000-0000-0000000000a3');
  perform t.ok(public.gur_restaurant_detail(v_id) is not null, 'yönetici gizli mekânın detayını görür');
  perform t.as_super();
  update public.restaurants set is_active = true where id = v_id;
  update public.restaurants set review_status = 'pending' where id = v_id;
  perform t.as_anon();
  perform t.ok(jsonb_array_length(public.gur_restaurants()) = 217, 'onay bekleyen mekân listede YOK');
  perform t.as_super();
  update public.restaurants set review_status = 'approved' where id = v_id;
end $$;

-- ═══ E. Kaydırma, kayıt, kota ════════════════════════════════════════
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000a1';
  u2 uuid := '00000000-0000-0000-0000-0000000000a2';
  r1 text := (select id from public.restaurants where claimed_by_org is null order by id limit 1 offset 1);
  r2 text := (select id from public.restaurants where claimed_by_org is null order by id limit 1 offset 2);
  s jsonb; n int;
begin
  perform t.as_user(u1);
  s := public.gur_record_swipe(r1, 'right');
  perform t.ok(s ->> 'pressure' = 'free' and (s ->> 'allowed')::boolean, 'sağa kaydırma: kota serbest');
  perform t.ok(not (s ? 'used') and not (s ? 'left'), 'kota: ham sayı istemciye SIZMAZ');
  perform t.ok(jsonb_array_length(public.gur_saved()) = 1, 'sağa kaydırma: kaydedilenlere düştü');
  perform t.ok(((public.gur_saved() -> 0) ->> 'isSuper')::boolean = false, 'kayıt: süper değil');
  perform public.gur_record_swipe(r1, 'up');
  perform t.ok(((public.gur_saved() -> 0) ->> 'isSuper')::boolean, 'yukarı kaydırma: süper beğeni');
  perform public.gur_record_swipe(r2, 'right');
  perform t.ok(jsonb_array_length(public.gur_saved()) = 2, 'iki mekân kayıtlı');
  perform public.gur_record_swipe(r1, 'left');
  perform t.ok(jsonb_array_length(public.gur_saved()) = 1, 'sola kaydırma: kayıttan çıkardı');

  perform t.as_user(u2);
  perform t.ok(jsonb_array_length(public.gur_saved()) = 0, 'başka kullanıcının kayıtları görünmez');
  perform t.ok((select count(*) from public.saved_places) = 0, 'RLS: başkasının saved_places satırı yok');
  perform t.throws('insert into public.swipes (user_id, restaurant_id, direction) values (''' || u2 || ''', ''' || r1 || ''', ''left'')',
    'permission denied', 'swipes tablosuna doğrudan yazılamaz (yalnızca RPC)');
  perform t.throws('select * from public.swipe_quota', 'permission denied', 'kota tablosu istemciye kapalı');
  perform t.throws('select public.gur_record_swipe(''yok-boyle-mekan'', ''left'')', 'Restoran bulunamadı', 'olmayan mekân reddedilir');

  -- Kota: 40 hak, sonra "exhausted"; ödüllü reklam +5; günde 10 tavanı
  perform t.as_user(u1);
  for i in 1..30 loop perform public.gur_record_swipe(r2, 'left'); end loop;  -- 4 + 30 = 34 kullanıldı
  s := public.gur_quota();
  perform t.ok(s ->> 'pressure' = 'free', '34/40: serbest (kalan 6)');
  perform public.gur_record_swipe(r2, 'left');  -- 35
  perform t.ok(public.gur_quota() ->> 'pressure' = 'near', '35/40: sınıra yaklaşıyor (kalan 5)');
  for i in 1..5 loop perform public.gur_record_swipe(r2, 'left'); end loop;  -- 40
  s := public.gur_quota();
  perform t.ok(s ->> 'pressure' = 'exhausted' and not (s ->> 'allowed')::boolean, '40/40: kota doldu');
  s := public.gur_rewarded_ad_done();
  perform t.ok((s ->> 'allowed')::boolean, 'ödüllü reklam: hak geri geldi');
  for i in 1..12 loop perform public.gur_rewarded_ad_done(); end loop;
  perform t.as_super();
  select bonus_granted into n from public.swipe_quota where user_id = u1;
  perform t.ok(n = 50, 'ödüllü reklam: günlük tavan 10 (bonus 50)');
  perform t.as_super();
  -- Gün döndü: pencere sıfırlanır
  update public.swipe_quota set window_start = window_start - interval '1 day' where user_id = u1;
  perform t.as_user(u1);
  perform t.ok(public.gur_quota() ->> 'pressure' = 'free', 'ertesi gün: kota sıfırlandı');
  perform t.as_super();
  select used into n from public.swipe_quota where user_id = u1;
  perform t.ok(n = 0, 'ertesi gün: sayaç 0');
end $$;

-- ═══ E2. Cihaz favorilerini eşitleme ════════════════════════════════
do $$
declare
  u2 uuid := '00000000-0000-0000-0000-0000000000a2';
  ids text[] := array(select id from public.restaurants where claimed_by_org is null order by id limit 3 offset 30);
  n_before int; used_before int;
begin
  select coalesce((select used from public.swipe_quota where user_id = u2), 0) into used_before;
  perform t.as_user(u2);
  perform public.gur_sync_saved(ids || array['yok-boyle-mekan'], array[ids[1]]);
  perform t.ok(jsonb_array_length(public.gur_saved()) = 3, 'eşitleme: 3 mekân kaydedildi, olmayan mekân yok sayıldı');
  perform t.ok((select count(*) from jsonb_array_elements(public.gur_saved()) x where (x ->> 'isSuper')::boolean) = 1, 'eşitleme: süper işareti taşındı');
  perform public.gur_sync_saved(ids, '{}');
  perform t.ok((select count(*) from jsonb_array_elements(public.gur_saved()) x where (x ->> 'isSuper')::boolean) = 1, 'eşitleme: mevcut süper beğeni SİLİNMEZ, tekrar çalıştırmak kopya üretmez');
  perform t.ok(jsonb_array_length(public.gur_saved()) = 3, 'eşitleme: tekrar çalıştırma idempotent');
  perform t.as_super();
  perform t.ok(coalesce((select used from public.swipe_quota where user_id = u2), 0) = used_before, 'eşitleme KOTAYI harcamaz');
  perform t.ok((select count(*) from public.swipes where user_id = u2 and restaurant_id = any(ids)) = 0, 'eşitleme swipe/reklam kaydı yazmaz');
end $$;

-- ═══ F. Sponsorlu kart ücretlendirmesi ═══════════════════════════════
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000a1';
  u2 uuid := '00000000-0000-0000-0000-0000000000a2';
  org uuid; camp uuid; camp2 uuid;
  rs text := (select id from public.restaurants where claimed_by_org is null order by id limit 1 offset 5);
  rx text := (select id from public.restaurants where claimed_by_org is null order by id limit 1 offset 6);
  j jsonb;
begin
  insert into public.organizations (legal_name) values ('Reklamveren') returning id into org;
  insert into public.campaigns (org_id, restaurant_id, label, status, pricing, bid_minor, daily_budget_minor, total_budget_minor)
    values (org, rs, 'Öne Çıkan', 'active', 'cpe', 500, 100000, 1000) returning id into camp;
  insert into public.campaigns (org_id, restaurant_id, label, status, pricing, bid_minor, daily_budget_minor)
    values (org, rx, 'Taslak', 'draft', 'cpe', 500, 100000) returning id into camp2;

  perform t.as_anon();
  j := public.gur_campaigns();
  perform t.ok(jsonb_array_length(j) = 1, 'gur_campaigns: yalnızca aktif kampanya (taslak gizli)');
  perform t.ok((j -> 0 ->> 'bidMinor')::int = 500 and j -> 0 -> 'restaurant' ? 'name', 'kampanya: shared/deck.js girdi şekli (bidMinor + restaurant kartı)');
  perform t.ok(j -> 0 ->> 'status' = 'active' and (j -> 0 ->> 'remainingBudgetMinor')::int = 100000, 'kampanya: kalan günlük bütçe');
  perform t.throws('select * from public.campaigns', 'permission denied', 'anon: kampanya tablosunu (bütçe) okuyamaz');

  perform t.as_user(u1);
  perform public.gur_log_impression(camp, rs, 6);
  perform public.gur_log_impression(camp, rx, 6);                 -- yanlış mekân: yok sayılır
  perform public.gur_record_swipe(rs, 'right', camp, 6, 1200);
  perform t.as_super();
  perform t.ok((select count(*) from public.ad_events where campaign_id = camp and kind = 'impression') = 1, 'gösterim: yalnızca doğru mekân sayıldı');
  perform t.ok((select charged_minor from public.ad_events where campaign_id = camp and kind = 'save') = 500, 'CPE: sağa kaydırma 500 kuruş ücretlendirdi');
  perform t.ok((select spent_minor from public.campaigns where id = camp) = 500, 'kampanya harcaması işlendi');
  perform t.ok((select amount_minor from public.revenue_events where campaign_id = camp) = 500, 'gelir kaydı kullanıcıya bağlı yazıldı');
  perform t.ok((select impressions from public.campaign_daily_spend where campaign_id = camp) = 1, 'günlük gösterim sayacı');

  -- aynı kullanıcı aynı kampanyada ikinci kez ücretlenmez
  perform t.as_user(u1);
  perform public.gur_record_swipe(rs, 'up', camp, 6, null);
  perform t.as_super();
  perform t.ok((select count(*) from public.ad_events where campaign_id = camp and charged_minor > 0) = 1, 'aynı kullanıcı aynı kampanyada İKİNCİ kez ücretlenmez');

  -- istemci başka mekânın kampanyasını uyduramaz
  perform t.as_user(u2);
  perform public.gur_record_swipe(rx, 'right', camp, 1, null);
  perform t.as_super();
  perform t.ok((select spent_minor from public.campaigns where id = camp) = 500, 'sahte kampanya/mekân eşleşmesi ücret yazmadı');
  perform t.ok((select campaign_id from public.swipes where user_id = u2 and restaurant_id = rx) is null, 'sahte kampanya kimliği swipe kaydına geçmedi');

  -- toplam bütçe: 500 + 500 = 1000 → tükendi
  perform t.as_user(u2);
  perform public.gur_record_swipe(rs, 'right', camp, 2, null);
  perform t.as_super();
  perform t.ok((select status from public.campaigns where id = camp) = 'exhausted', 'toplam bütçe dolunca kampanya "exhausted"');
  perform t.as_anon();
  perform t.ok(jsonb_array_length(public.gur_campaigns()) = 0, 'tükenen kampanya servis edilmez');
  perform t.as_super();
end $$;

-- ═══ G. Masa talebi ══════════════════════════════════════════════════
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000a1';
  u2 uuid := '00000000-0000-0000-0000-0000000000a2';
  owner uuid := '00000000-0000-0000-0000-0000000000a2';
  free_r text := (select id from public.restaurants where claimed_by_org is null order by id limit 1 offset 10);
  cl_r text := current_setting('t.claimed_id');
  org uuid; res uuid; res2 uuid;
begin
  perform t.as_user(u1);
  perform t.throws('select public.gur_reserve(''' || free_r || ''', 2)', 'sahiplenmedi', 'sahipsiz mekânda masa ayırtma KAPALI (sunucuda)');
  res := public.gur_reserve(cl_r, 3, null, 'pencere kenarı');
  perform t.ok(res is not null, 'sahiplenmiş mekânda talep açıldı');
  res2 := public.gur_reserve(cl_r, 3);
  perform t.ok(res2 = res, 'aynı kullanıcı aynı mekâna ikinci bekleyen talep açamaz');
  perform t.throws('select public.gur_reserve(''' || cl_r || ''', 99)', '1-20', 'kişi sayısı sınırı');
  perform t.ok((select count(*) from public.reservations) = 1, 'talep eden kendi talebini görür');

  perform t.as_user(u2);
  perform t.ok((select count(*) from public.reservations) = 0, 'ilgisiz kullanıcı talebi göremez');
  perform t.as_super();
  org := (select claimed_by_org from public.restaurants where id = cl_r);
  insert into public.org_members (org_id, user_id, role) values (org, owner, 'owner');
  perform t.as_user(owner);
  perform t.ok((select count(*) from public.reservations) = 1, 'işletme üyesi kendi mekânının talebini görür');
  update public.reservations set status = 'confirmed', decided_at = now() where id = res;
  perform t.ok((select status from public.reservations where id = res) = 'confirmed', 'işletme üyesi talebi onaylar');
  perform t.as_user(u1);
  update public.reservations set status = 'declined' where id = res;
  perform t.ok((select status from public.reservations where id = res) = 'confirmed', 'talep eden kendi talebinin durumunu DEĞİŞTİREMEZ');
  perform t.as_super();
end $$;

-- ═══ H. Sahiplenme başvurusu ═════════════════════════════════════════
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000a1';
  adm uuid := '00000000-0000-0000-0000-0000000000a3';
  r text := (select id from public.restaurants where claimed_by_org is null order by id limit 1 offset 20);
  j jsonb; cid uuid; n int;
begin
  perform t.as_user(u1);
  j := public.gur_submit_claim(r, 'Lezzet Ltd. Şti.', '1234567890', 'Ayşe', '+90 555', 'a@b.com');
  cid := (j ->> 'id')::uuid;
  perform t.ok(j ->> 'status' = 'pending', 'başvuru: bekliyor');
  perform t.throws('select public.gur_submit_claim(''' || r || ''', ''Başka'')', 'bekleyen', 'aynı mekâna ikinci bekleyen başvuru reddedilir');
  perform t.ok((select count(*) from public.restaurant_claims) = 1, 'başvuran kendi başvurusunu görür');
  update public.restaurant_claims set status = 'approved' where id = cid;
  get diagnostics n = row_count;
  perform t.ok(n = 0, 'başvuran kendi başvurusunu ONAYLAYAMAZ');
  perform t.ok((select claimed_by_org from public.restaurants where id = r) is null, 'onaysız: sahiplik bağlanmadı');

  perform t.as_user(adm);
  update public.restaurant_claims set status = 'approved' where id = cid;
  perform t.as_super();
  perform t.ok((select claimed_by_org from public.restaurants where id = r) = (select org_id from public.restaurant_claims where id = cid),
    'yönetici onayı sahipliği (tetikleyiciyle) bağladı');
  perform t.ok((select reviewer_id from public.restaurant_claims where id = cid) = adm, 'karar veren yönetici kaydedildi');
  perform t.as_user(u1);
  perform t.throws('select public.gur_submit_claim(''' || r || ''', ''Üçüncü'')', 'sahiplenilmiş', 'sahiplenilmiş mekâna başvuru reddedilir');
  perform t.as_super();
end $$;

-- ═══ I. Konum doğrulamalı ziyaret ════════════════════════════════════
insert into public.restaurants (id, name, category, lat, lng, location_exact)
values ('test-tam-konum', 'Tam Konumlu Lokanta', 'Türk Mutfağı', 41.0082, 28.9784, true);

do $$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000a1';
  u2 uuid := '00000000-0000-0000-0000-0000000000a2';
  j jsonb; vid uuid; rid uuid;
begin
  perform t.as_user(u1);
  j := public.gur_visit_sample(40.9819, 28.8772, 20);   -- Bakırköy merkezi: location_exact=false kayıtlar eşleşmez
  perform t.ok(j -> 'matched' = 'null'::jsonb, 'ilçe merkezindeki kullanıcı rastgele mekâna EŞLEŞMEZ');
  j := public.gur_visit_sample(41.0182, 28.9784, 20);   -- ~1 km uzak
  perform t.ok(j -> 'matched' = 'null'::jsonb, 'uzaktaki örnek eşleşmedi');
  j := public.gur_visit_sample(41.0082, 28.9784, 500);
  perform t.ok(j ->> 'reason' = 'low_accuracy', 'kötü hassasiyet reddedildi');
  j := public.gur_visit_sample(41.0082, 28.9784, 20, now() - interval '7 hours');
  perform t.ok(j ->> 'reason' = 'stale_sample', '6 saatten eski örnek reddedildi');
  j := public.gur_visit_sample(41.0082, 28.9784, 20, now() - interval '20 minutes');
  perform t.ok(j ->> 'matched' = 'test-tam-konum' and j ->> 'status' = 'open', 'yakın örnek: ziyaret açıldı');
  vid := (j ->> 'visitId')::uuid;
  perform t.ok((public.gur_review_permission('test-tam-konum') ->> 'allowed')::boolean = false, 'henüz doğrulanmadı: yorum kilitli');
  perform t.throws('select public.gur_submit_review(''test-tam-konum'', 5, ''harika bir akşam yemeğiydi'')', 'doğrulanmış ziyaret', 'doğrulamasız yorum REDDEDİLİR');
  j := public.gur_visit_sample(41.0083, 28.9785, 25, now());
  perform t.ok(j ->> 'status' = 'confirmed' and (j ->> 'visitId')::uuid = vid, '20 dk kalış: ziyaret doğrulandı');
  perform t.ok((public.gur_review_permission('test-tam-konum') ->> 'allowed')::boolean, 'doğrulanınca yorum kilidi açıldı');
  perform t.ok(jsonb_array_length(public.gur_visit_prompts()) = 0, 'davet henüz vakti gelmedi (90 dk)');

  perform t.as_super();
  update public.visits set prompt_due_at = now() - interval '1 minute' where id = vid;
  perform t.as_user(u1);
  perform t.ok(jsonb_array_length(public.gur_visit_prompts()) = 1, 'vakti gelen "deneyim nasıldı" daveti listelendi');

  perform t.throws('select public.gur_submit_review(''test-tam-konum'', 9, ''harika bir akşam yemeğiydi'')', '1-5', 'puan sınırı');
  perform t.throws('select public.gur_submit_review(''test-tam-konum'', 5, ''kısa'')', '10 karakter', 'çok kısa yorum');
  rid := public.gur_submit_review('test-tam-konum', 5, 'Harika bir akşam yemeğiydi, servis çok iyiydi.');
  perform t.ok(rid is not null, 'doğrulanmış ziyaretten yorum yazıldı');
  perform t.ok((select is_verified from public.reviews where id = rid), '"Konumla doğrulandı" rozeti verildi');
  perform t.ok((public.gur_review_permission('test-tam-konum') ->> 'allowed')::boolean = false, 'ziyaret başına TEK yorum');
  perform t.ok(jsonb_array_length(public.gur_visit_prompts()) = 0, 'yorum yazılınca davet düştü');

  -- ikinci kullanıcı: ziyareti yok → yorum yok
  perform t.as_user(u2);
  perform t.throws('select public.gur_submit_review(''test-tam-konum'', 4, ''hiç gitmedim ama yorum yazıyorum'')', 'doğrulanmış ziyaret', 'ziyaret etmeyen yorum YAZAMAZ');
  perform t.throws('insert into public.reviews (user_id, restaurant_id, stars, body, is_verified) values (''' || u2 || ''', ''test-tam-konum'', 5, ''uydurma rozet denemesi'', true)',
    'permission denied', 'reviews tablosuna doğrudan yazılamaz (rozet uydurulamaz)');
  perform t.as_super();
end $$;

-- ═══ J. Detay ════════════════════════════════════════════════════════
do $$
declare d jsonb;
begin
  perform t.as_anon();
  d := public.gur_restaurant_detail('test-tam-konum');
  perform t.ok(d -> 'restaurant' ->> 'name' = 'Tam Konumlu Lokanta', 'detay: anon açabilir');
  perform t.ok(jsonb_array_length(d -> 'reviews') = 1, 'detay: doğrulanmış yorum görünür');
  perform t.ok(d -> 'reviews' -> 0 ->> 'display_name' = 'Ayşe Y.', 'detay: yorumcu adı kısaltıldı (Ayşe Y.)');
  perform t.ok((d -> 'reviews' -> 0 ->> 'is_verified')::boolean, 'detay: "Konumla doğrulandı" bilgisi');
  perform t.ok(d -> 'restaurant' ->> 'lat' is not null, 'detay: gerçek koordinat (location_exact=true) verildi');
  perform t.ok(d ? 'photos' and d ? 'menu' and d ? 'externalReviews' and d ? 'services', 'detay: Node API ile aynı anahtarlar');
  perform t.as_super();
  update public.reviews set hidden_at = now() where restaurant_id = 'test-tam-konum';
  perform t.as_anon();
  d := public.gur_restaurant_detail('test-tam-konum');
  perform t.ok(jsonb_array_length(d -> 'reviews') = 0, 'gizlenen yorum detayda yok');
  perform t.ok((select count(*) from public.reviews) = 0, 'gizlenen yorum anon''a RLS ile kapalı');
  perform t.as_super();
end $$;

-- ═══ K. Rıza, olaylar, ham veri sızıntısı ════════════════════════════
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-0000000000a1';   -- rıza VERMİŞ
  u2 uuid := '00000000-0000-0000-0000-0000000000a2';   -- rıza yok
  n int; e jsonb;
begin
  perform t.as_user(u2);
  n := public.gur_log_events('[{"name":"card_view","restaurantId":"x","props":{"email":"a@b.com","k":1,"nested":{"a":1}}},
                                {"name":"BAD NAME"}, 42, {"name":"ok_event"}]'::jsonb);
  perform t.ok(n = 2, 'olaylar: geçersiz ad ve geçersiz öğe atlandı (2 kabul)');
  perform t.as_super();
  select props into e from public.analytics_events where name = 'card_view';
  perform t.ok(not (e ? 'email') and e ->> 'k' = '1', 'olaylar: e-posta alanı sessizce düştü (PII temizliği)');
  perform t.ok(jsonb_typeof(e -> 'nested') = 'string', 'olaylar: iç içe değer metne çevrildi');
  perform t.ok((select user_id from public.analytics_events where name = 'card_view') is null, 'rızasız kullanıcının olayı KİMLİKSİZ saklandı');

  perform t.as_user(u1);
  perform public.gur_log_events('[{"name":"card_view"}]'::jsonb);
  perform t.as_super();
  perform t.ok((select count(*) from public.analytics_events where name = 'card_view' and user_id = u1) = 1, 'rızası olanın olayı kullanıcıya bağlı');

  perform t.as_user(u2);
  perform public.gur_set_consent(true, null);
  perform t.ok((select analytics_optin from public.profiles where id = u2), 'rıza güncellendi');
  perform public.gur_set_consent(null, true);
  perform t.ok((select analytics_optin and marketing_optin from public.profiles where id = u2), 'kısmi güncelleme diğer bayrağı bozmadı');
  perform t.ok(public.gur_me() -> 'user' ->> 'plan' = 'free' and public.gur_me() ->> 'role' = 'user', 'gur_me: plan + rol');

  update public.profiles set display_name = 'Can Yeni' where id = u2;
  perform t.ok((select display_name from public.profiles where id = u2) = 'Can Yeni', 'kullanıcı kendi adını değiştirir');
  perform t.throws('update public.profiles set plan = ''plus'' where id = ''' || u2 || '''', 'permission denied', 'kullanıcı kendi planını YÜKSELTEMEZ');
  perform t.throws('insert into public.platform_admins (user_id) values (''' || u2 || ''')', 'permission denied', 'kullanıcı kendini yönetici YAPAMAZ');
  perform t.ok((select count(*) from public.profiles) = 1, 'kullanıcı yalnızca kendi profilini görür');

  perform t.as_user('00000000-0000-0000-0000-0000000000a3');
  perform t.ok(public.gur_me() ->> 'role' = 'admin', 'yönetici rolü platform_admins tablosundan');
  perform t.ok((select count(*) from public.profiles) = 4, 'yönetici tüm profilleri görür');
  perform t.ok((select count(*) from public.revenue_events) >= 1, 'yönetici gelir kayıtlarını okur');
  perform t.as_user(u2);
  perform t.ok((select count(*) from public.revenue_events) = 0, 'kullanıcı gelir kayıtlarını OKUYAMAZ');
  perform t.as_super();
end $$;

-- ═══ K2. Yönetici paneli (migration 000500) ═════════════════════════
do $$
declare
  u1  uuid := '00000000-0000-0000-0000-0000000000a1';
  u2  uuid := '00000000-0000-0000-0000-0000000000a2';
  adm uuid := '00000000-0000-0000-0000-0000000000a3';
  rid text; rid_ok text; rid_no text; cid uuid; n int; r jsonb; camp uuid; camp_status text; n_pub int; n_all int;
begin
  perform t.as_anon();
  n_pub := jsonb_array_length(public.gur_restaurants());
  perform t.as_super();
  select count(*) into n_all from public.restaurants;
  select id into rid from public.restaurants where is_active and review_status = 'approved' order by id limit 1;
  select id into rid_ok from public.restaurants where claimed_by_org is null
     and not exists (select 1 from public.restaurant_claims c where c.restaurant_id = restaurants.id)
   order by id offset 20 limit 1;
  select id into rid_no from public.restaurants where claimed_by_org is null
     and not exists (select 1 from public.restaurant_claims c where c.restaurant_id = restaurants.id)
   order by id offset 21 limit 1;

  -- Yönetici OLMAYAN her yolda reddedilir
  perform t.as_user(u2);
  perform t.throws('select public.gur_admin_restaurants()', 'Yönetici yetkisi', 'kullanıcı: mekân havuzu yönetici ister');
  perform t.throws(format('select public.gur_admin_set_restaurant(%L, ''{"gastro":true}'')', rid), 'Yönetici yetkisi', 'kullanıcı: Gastro VEREMEZ');
  perform t.throws('select public.gur_admin_growth(12)', 'Yönetici yetkisi', 'kullanıcı: büyüme verisi yönetici ister');
  perform t.throws('select public.gur_admin_set_district(''Bakırköy'', false)', 'Yönetici yetkisi', 'kullanıcı: ilçe kapatamaz');
  perform t.throws('select public.gur_admin_campaigns()', 'Yönetici yetkisi', 'kullanıcı: kampanya listesi yönetici ister');
  perform t.throws('insert into public.platform_settings (key, value) values (''x'', ''{}'')', 'permission denied', 'ayar tablosuna doğrudan yazma YOK');
  perform t.ok(not (public.gur_admin_me() ->> 'admin')::boolean, 'gur_admin_me: kullanıcı yönetici değil');
  perform t.ok((select count(*) from public.admin_audit) = 0, 'denetim kaydı kullanıcıya görünmez');
  perform t.as_anon();
  perform t.throws('select public.gur_admin_me()', 'permission denied', 'anon: gur_admin_me kapalı');
  perform t.throws('select public.gur_admin_claims()', 'permission denied', 'anon: yönetici RPC''leri kapalı');

  -- Yönetici: mekân alanları
  perform t.as_user(adm);
  perform t.ok((public.gur_admin_me() ->> 'admin')::boolean, 'gur_admin_me: yönetici');
  perform t.ok(jsonb_array_length(public.gur_admin_restaurants()) = n_all, 'yönetici: yayında olmayanlar dahil TÜM mekânlar listelenir');
  perform t.ok(jsonb_array_length(public.gur_admin_restaurants('pizza')) < n_all, 'yönetici: ada göre arama');
  r := public.gur_admin_set_restaurant(rid, '{"gastro":true,"gastro_chef":"Şef Deneme"}');
  perform t.ok((r ->> 'gastro')::boolean and r ->> 'gastroChef' = 'Şef Deneme', 'Gastro yönetici RPC''siyle verildi');
  perform t.throws(format('select public.gur_admin_set_restaurant(%L, ''{"lat":1}'')', rid), 'Bilinmeyen alan', 'beyaz liste dışı alan HATA verir');
  perform t.throws(format('select public.gur_admin_set_restaurant(%L, ''{"review":"yayinda"}'')', rid), 'enum', 'geçersiz yayın durumu reddedilir');
  perform t.throws(format('select public.gur_admin_set_restaurant(%L, ''{}'')', rid), 'Güncellenecek alan yok', 'boş yama reddedilir');
  perform t.throws('select public.gur_admin_set_restaurant(''yok-boyle'', ''{"active":false}'')', 'Mekân bulunamadı', 'olmayan mekân');
  perform t.as_anon();
  perform t.ok(exists (select 1 from jsonb_array_elements(public.gur_restaurants()) e
                        where e ->> 'id' = rid and (e ->> 'gastro')::boolean), 'tüketici listesinde Gastro rozeti görünür');
  perform t.as_user(adm);
  perform public.gur_admin_set_restaurant(rid, '{"active":false}');
  perform t.as_anon();
  perform t.ok(not exists (select 1 from jsonb_array_elements(public.gur_restaurants()) e where e ->> 'id' = rid),
    'gizlenen (is_active=false) mekân tüketici listesinden DÜŞTÜ');
  perform t.as_user(adm);
  perform public.gur_admin_set_restaurant(rid, '{"active":true,"gastro":false}');
  perform t.as_anon();
  perform t.ok(exists (select 1 from jsonb_array_elements(public.gur_restaurants()) e where e ->> 'id' = rid), 'geri açılan mekân listede');
  perform t.as_user(adm);
  perform public.gur_admin_set_restaurant(rid, '{"review":"pending"}');
  perform t.as_anon();
  perform t.ok(not exists (select 1 from jsonb_array_elements(public.gur_restaurants()) e where e ->> 'id' = rid),
    'moderasyonda bekleyen mekân yayında DEĞİL');
  perform t.as_user(adm);
  perform public.gur_admin_set_restaurant(rid, '{"review":"approved"}');

  -- İlçe aç/kapat
  perform t.as_anon();
  perform t.ok((select (e ->> 'open')::boolean from jsonb_array_elements(public.gur_districts()) e where e ->> 'name' = 'Bakırköy'),
    'Bakırköy varsayılan AÇIK (mekânı var)');
  perform t.as_user(adm);
  perform public.gur_admin_set_district('Bakırköy', false);
  perform public.gur_admin_set_district('Kadıköy', true);
  perform t.as_anon();
  perform t.ok(not exists (select 1 from jsonb_array_elements(public.gur_restaurants()) e where e ->> 'district' = 'Bakırköy'),
    'kapalı ilçenin mekânları tüketiciye gitmiyor (ilçesiz kayıt kapatılamaz, kalır)');
  perform t.ok(not exists (select 1 from jsonb_array_elements(public.gur_campaigns()) e where e -> 'restaurant' ->> 'district' = 'Bakırköy'),
    'kapalı ilçenin kampanyası da gitmiyor');
  perform t.ok(not (select (e ->> 'open')::boolean from jsonb_array_elements(public.gur_districts()) e where e ->> 'name' = 'Bakırköy'),
    'gur_districts: Bakırköy KAPALI');
  perform t.ok((select (e ->> 'open')::boolean from jsonb_array_elements(public.gur_districts()) e where e ->> 'name' = 'Kadıköy'),
    'gur_districts: mekânsız ama açılmış ilçe de listelenir');
  perform t.as_user(adm);
  perform public.gur_admin_set_district('Bakırköy', null);
  perform public.gur_admin_set_district('Kadıköy', null);
  perform t.as_anon();
  perform t.ok(jsonb_array_length(public.gur_restaurants()) = n_pub, 'karar silinince varsayılana döner');

  -- Sahiplenme başvurusu kararı
  perform t.as_user(u1);
  perform public.gur_submit_claim(rid_ok, 'Onay Lokantası Ltd.', null, 'Ayşe', '5550000000', null);
  perform public.gur_submit_claim(rid_no, 'Red Lokantası Ltd.', null, 'Ayşe', '5550000001', null);
  perform t.as_user(u2);
  perform t.throws('select public.gur_admin_claims()', 'Yönetici yetkisi', 'kullanıcı başvuru listesini göremez');
  perform t.as_user(adm);
  r := public.gur_admin_claims();
  perform t.ok(exists (select 1 from jsonb_array_elements(r) e where e ->> 'restaurant_id' = rid_ok and e ->> 'status' = 'pending'
                          and e ->> 'legal_name' = 'Onay Lokantası Ltd.'), 'yönetici başvuruyu listede görür');
  select (e ->> 'id')::uuid into cid from jsonb_array_elements(r) e where e ->> 'restaurant_id' = rid_ok;
  perform public.gur_admin_decide_claim(cid, 'approved');
  perform t.as_super();
  perform t.ok((select claimed_by_org from public.restaurants where id = rid_ok) is not null, 'onay sahipliği BAĞLADI (tetikleyici)');
  perform t.ok((select reviewer_id from public.restaurant_claims where id = cid) = adm, 'karar veren yönetici kayda yazıldı');
  perform t.as_user(adm);
  perform t.throws(format('select public.gur_admin_decide_claim(%L, ''rejected'')', cid), 'Bekleyen başvuru', 'karar verilmiş başvuru tekrar kararlanmaz');
  select (e ->> 'id')::uuid into cid from jsonb_array_elements(public.gur_admin_claims()) e where e ->> 'restaurant_id' = rid_no;
  perform t.throws(format('select public.gur_admin_decide_claim(%L, ''belki'')', cid), 'Geçersiz karar', 'geçersiz karar reddedilir');
  perform public.gur_admin_decide_claim(cid, 'rejected', 'Vergi levhası okunmuyor');
  perform t.as_super();
  perform t.ok((select status::text || '/' || reject_reason from public.restaurant_claims where id = cid) = 'rejected/Vergi levhası okunmuyor',
    'ret sebebi kayda yazıldı');
  perform t.ok((select claimed_by_org from public.restaurants where id = rid_no) is null, 'ret sahiplik BAĞLAMADI');

  -- Kampanyalar
  select id into camp from public.campaigns order by created_at limit 1;
  perform t.as_user(adm);
  perform t.ok(jsonb_array_length(public.gur_admin_campaigns() -> 'campaigns') >= 1, 'yönetici kampanyaları listeler');
  select status::text into camp_status from public.campaigns where id = camp;
  r := public.gur_admin_patch_campaign(camp, 'paused', 5);
  perform t.ok(r ->> 'status' = 'paused' and (r ->> 'bid_minor')::int = 20, 'kampanya duraklatıldı, teklif tabana (20) çekildi');
  perform t.throws(format('select public.gur_admin_patch_campaign(%L, ''exhausted'')', camp), 'Geçersiz durum', 'exhausted elle konamaz (sistem kararı)');
  perform t.throws(format('select public.gur_admin_patch_campaign(%L)', camp), 'Güncellenecek alan yok', 'boş kampanya yaması reddedilir');
  perform public.gur_admin_patch_campaign(camp, camp_status, null);

  -- Büyüme
  r := public.gur_admin_growth(12);
  perform t.ok((r -> 'platform' ->> 'users')::int >= 4, 'büyüme: platform kullanıcı sayısı');
  perform t.ok(jsonb_array_length(r -> 'cohorts') >= 1 and (r -> 'cohorts' -> 0 ->> 'cohort_size')::int >= 4, 'büyüme: bu haftanın kohortu');
  perform t.ok((r -> 'cohorts' -> 0 -> 'd30') = 'null'::jsonb, 'büyüme: olgunlaşmamış D30 null (0 sayılmaz)');

  -- Denetim kaydı
  select count(*) into n from public.admin_audit;
  perform t.ok(n >= 12, 'her yönetici işlemi denetim kaydına düştü (' || n || ')');
  perform t.ok(exists (select 1 from public.admin_audit where action = 'claim.rejected' and detail ->> 'reason' = 'Vergi levhası okunmuyor'),
    'denetim: ret sebebiyle birlikte');
  perform t.throws('delete from public.admin_audit', 'permission denied', 'denetim kaydı SİLİNEMEZ');
  perform t.as_super();
end $$;

-- ═══ L. Hesap silme ══════════════════════════════════════════════════
do $$
declare u1 uuid := '00000000-0000-0000-0000-0000000000a1'; rev_before int; rev_after int;
begin
  select count(*) into rev_before from public.revenue_events;
  perform t.as_user(u1);
  perform public.gur_delete_me();
  perform t.as_super();
  perform t.ok(not exists (select 1 from auth.users where id = u1), 'hesap silindi: auth.users');
  perform t.ok(not exists (select 1 from public.profiles where id = u1), 'hesap silindi: profil');
  perform t.ok((select count(*) from public.swipes where user_id = u1) = 0, 'hesap silindi: kaydırmalar');
  perform t.ok((select count(*) from public.saved_places where user_id = u1) = 0, 'hesap silindi: kayıtlı yerler');
  perform t.ok((select count(*) from public.reviews where user_id = u1) = 0, 'hesap silindi: yorumlar');
  select count(*) into rev_after from public.revenue_events;
  perform t.ok(rev_after = rev_before and (select count(*) from public.revenue_events where user_id = u1) = 0,
    'muhasebe satırı KALDI, kişi bağı koptu (SET NULL)');
end $$;

-- ═══ M. Genel güvenlik denetimi ══════════════════════════════════════
do $$
declare bad text;
begin
  select string_agg(c.relname, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
     and not c.relispartition;
  perform t.ok(bad is null, 'public şemasında RLS''siz tablo YOK' || coalesce(' (bulundu: ' || bad || ')', ''));

  perform t.ok(not has_function_privilege('anon', 'public._gur_log_event(uuid,text,text,uuid,jsonb,uuid)', 'execute'),
    'iç yardımcı _gur_log_event anon''a kapalı');
  perform t.ok(not has_function_privilege('authenticated', 'public._gur_read_quota(uuid)', 'execute'),
    'iç yardımcı _gur_read_quota istemciye kapalı');
  perform t.ok(not has_function_privilege('authenticated', 'public.gur_handle_new_user()', 'execute'),
    'tetikleyici fonksiyonu istemciye kapalı');
  perform t.ok(has_function_privilege('anon', 'public.gur_restaurants(float8,float8,text,int)', 'execute'),
    'gur_restaurants anon''a açık');
  perform t.ok((select count(*) from pg_policies where schemaname = 'storage') >= 3, 'storage politikaları kuruldu');
  perform t.ok((select count(*) from storage.buckets where id in ('restaurant-media', 'review-photos')) = 2, 'storage kovaları kuruldu');
end $$;
