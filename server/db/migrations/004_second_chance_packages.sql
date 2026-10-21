-- ═══════════════════════════════════════════════════════════════════════
-- 004 — İkinci Şans: haftalık yeniden gösterim paketi
--
-- "İkinci Şans" iki ayrı şeye dönüştü ve karıştırılmamalı:
--
--   • Oturum içi tekrar (ÜCRETSİZ, eskisi gibi): deste bitti, kullanıcı
--     geçtiklerine bir kez daha bakıyor. Veritabanında karşılığı yok,
--     tamamen istemci tarafı.
--   • SATIN ALINAN PAKET (burası): restoran ödeme yapıyor ve kendisini
--     SOLA KAYDIRMIŞ kullanıcıların destesine geri giriyor. Başka gün,
--     başka oturum, başka kullanıcı.
--
-- KOTAYLA BİTER, SÜREYLE DEĞİL. Paket 200 FARKLI kullanıcıya gösterimle
-- kapanır; hafta dolsa da kota bitmediyse sürer, kota bitince hafta
-- dolmasa da kapanır. `reach` sabit değil sütun: satışta pazarlık
-- edilebilsin.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TYPE second_chance_status AS ENUM ('active', 'completed', 'cancelled', 'expired');

CREATE TABLE IF NOT EXISTS second_chance_packages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  org_id         uuid REFERENCES organizations(id) ON DELETE SET NULL,
  status         second_chance_status NOT NULL DEFAULT 'active',
  -- Hedef: kaç FARKLI kullanıcıya gösterilecek (gösterim sayısı değil).
  reach_target   integer NOT NULL DEFAULT 200 CHECK (reach_target > 0),
  reach_used     integer NOT NULL DEFAULT 0,
  price_minor    integer NOT NULL DEFAULT 0,
  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz NOT NULL DEFAULT now() + interval '7 days',
  ended_at       timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- RESTORAN BAŞINA AYNI ANDA TEK AKTİF PAKET. Kısmi tekil indeks bunu
-- veritabanı seviyesinde zorluyor: iki paket üst üste alıp aynı
-- kullanıcıya iki kat gösterim satın alınamasın. Uygulama katmanında
-- kontrol etmek yarış koşulunda yetmezdi.
CREATE UNIQUE INDEX IF NOT EXISTS second_chance_one_active_idx
  ON second_chance_packages (restaurant_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS second_chance_active_idx
  ON second_chance_packages (status, ends_at) WHERE status = 'active';

-- Kim, hangi paketten, hangi GÜN gördü.
--
-- `shown_on` tarih (timestamp değil): kural "aynı kullanıcıya günde en
-- fazla bir kez" ve bunu saat hassasiyetinde tutmak, gece yarısını
-- geçince aynı kullanıcıyı iki kez saymaya yol açardı.
CREATE TABLE IF NOT EXISTS second_chance_impressions (
  package_id   uuid NOT NULL REFERENCES second_chance_packages(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shown_on     date NOT NULL DEFAULT current_date,
  shown_count  integer NOT NULL DEFAULT 1,
  PRIMARY KEY (package_id, user_id, shown_on)
);

-- "Bu paket kaç farklı kullanıcıya ulaştı" sorgusu bu indeksten geçiyor.
CREATE INDEX IF NOT EXISTS second_chance_reach_idx
  ON second_chance_impressions (package_id, user_id);

COMMIT;
