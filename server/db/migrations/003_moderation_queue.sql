-- ═══════════════════════════════════════════════════════════════════════
-- 003 — Moderasyon kuyruğu
--
-- Önceden iki yol da denetimsiz biçimde tüketiciye açılıyordu: beslemenin
-- getirdiği yeni mekan anında listeye giriyordu, işletmenin panelden
-- girdiği alan anında karta yansıyordu. Yanlış adres, uygunsuz açıklama
-- ya da rakip adına açılmış bir kayıt hiçbir kapıdan geçmiyordu.
--
-- İKİ AYRI ŞEY, İKİ AYRI YER:
--   • restaurants.review_status — KAYIT yayında mı.
--   • restaurant_change_requests — yayındaki kaydın NESİ değişecek.
-- Tek tabloda tutmak "mekan bekliyor" ile "mekanın telefonu bekliyor"
-- durumlarını birbirine karıştırırdı; ikisi farklı ekranlarda ve farklı
-- kararlarla yönetiliyor.
--
-- MEVCUT KAYITLAR ONAYLI SAYILIR. Varsayılanı 'pending' yapmak yayındaki
-- bütün havuzu bir gecede boşaltırdı; yalnızca bundan sonra GELEN kayıt
-- beklemeye düşer (ingestion 'pending' yazar).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS review_status review_status NOT NULL DEFAULT 'approved';

-- Yayında olmayan kayıt destede, aramada ve listelerde görünmez. Kısmi
-- indeks: sorguların tamamı 'approved' üzerinden geçiyor.
CREATE INDEX IF NOT EXISTS restaurants_published_idx
  ON restaurants (id) WHERE is_active AND review_status = 'approved';

CREATE TABLE IF NOT EXISTS restaurant_change_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- Kimin gönderdiği: işletme paneli mi, besleme mi.
  submitted_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  origin         text NOT NULL DEFAULT 'owner' CHECK (origin IN ('owner', 'ingest')),
  -- Gelen hâl. Yayınlanan hâl ayrı sütunda: yönetici düzenleyebiliyor ve
  -- "neyi değiştirdi" sorusu sonradan cevaplanabilmeli.
  fields         jsonb NOT NULL,
  published      jsonb,
  status         review_status NOT NULL DEFAULT 'pending',
  reason         text,
  decided_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  decided_at     timestamptz
);

-- Bir mekanın aynı anda tek bir bekleyen talebi olur: işletme formu üç kez
-- kaydederse yöneticinin önüne üç iş değil, son hâl çıkmalı.
CREATE UNIQUE INDEX IF NOT EXISTS change_requests_one_pending_idx
  ON restaurant_change_requests (restaurant_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS change_requests_queue_idx
  ON restaurant_change_requests (created_at DESC) WHERE status = 'pending';

COMMIT;
