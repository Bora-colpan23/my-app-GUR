-- ═══════════════════════════════════════════════════════════════════════
-- GUR — Storage kovaları
--
--   restaurant-media  herkese açık okuma, yazma yalnızca yönetici (işletme
--                     paneli bağlanınca işletme üyelerine de açılacak)
--   review-photos     herkese açık okuma, kullanıcı yalnızca KENDİ klasörüne
--                     (<kullanıcı-id>/dosya) yazar/siler
--
-- Kovanın `public` olması dosya adresini bilen herkesin okuyabileceği
-- demektir; yorum fotoğrafı adresi tahmin edilemez (uuid yolu) ama gizli
-- değildir — kişisel belge yüklenmemeli, arayüz bunu söyler.
-- ═══════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('restaurant-media', 'restaurant-media', true, 8388608,
   array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('review-photos', 'review-photos', true, 4194304,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy gur_media_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'restaurant-media' and public.is_admin())
  with check (bucket_id = 'restaurant-media' and public.is_admin());

create policy gur_review_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy gur_review_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
