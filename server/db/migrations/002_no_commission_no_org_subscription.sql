-- ═══════════════════════════════════════════════════════════════════════
-- 002 — Rezervasyon komisyonu ve işletme aboneliği kaldırıldı
--
-- İki gelir kalemi ürün kararıyla kapatıldı:
--
--   1. REZERVASYON KOMİSYONU. Rezervasyon artık tamamen ücretsiz; ne
--      kullanıcıdan ne restorandan pay alınıyor. Olayın kendisi
--      loglanmaya devam ediyor (`reservation_complete` + `gmv_minor`)
--      çünkü yönlendirilen ciro hem işletmeye gösterilen bir etki ölçüsü
--      hem de kohort girdisi — ama bu bir GELİR satırı değil.
--
--   2. İŞLETME ABONELİĞİ (Premium / Pro / Ücretsiz). Platform paket
--      satmıyor; bir işletmenin ödediği tutarın tamamı tek tek satın
--      aldığı ücretli özelliklerden geliyor.
--
-- Tüketici aboneliği (GUR Plus) DURUYOR: `user_subscription` kalıyor.
--
-- Enum'dan değer düşürmenin tek yolu tipi yeniden kurmak. Sıra önemli:
-- önce artık geçersiz olan satırlar temizlenir, sonra sütun yeni tipe
-- çevrilir, en sonda eski tip düşer.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- Kaldırılan iki kaynağın geçmiş satırları. gmv_minor'ı korumak isteyen
-- bir raporlama varsa bu silme öncesi arşivlenmeli — burada gelir kaydı
-- olarak tutmanın anlamı yok, çünkü o para hiç alınmadı.
DELETE FROM revenue_events
 WHERE source IN ('reservation_commission', 'org_subscription');

CREATE TYPE revenue_source_v2 AS ENUM
  ('sponsored_card', 'directions_affiliate', 'rewarded_ad', 'user_subscription');

ALTER TABLE revenue_events
  ALTER COLUMN source TYPE revenue_source_v2
  USING source::text::revenue_source_v2;

DROP TYPE revenue_source;
ALTER TYPE revenue_source_v2 RENAME TO revenue_source;

-- Bu kovada komisyon kalmadı; içinde kalan tek kaynak harita iştirak
-- geliri (directions_affiliate). Sütunu düşürmek o geliri de kaybettirirdi,
-- o yüzden adı gerçekte tuttuğu şeye çevriliyor.
ALTER TABLE user_ltv RENAME COLUMN commission_revenue_minor TO affiliate_revenue_minor;

COMMIT;
