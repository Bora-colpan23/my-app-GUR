-- ═══════════════════════════════════════════════════════════════════════
-- 005 — Yaklaşık konum (koordinatı olmayan dış kaynaklı kayıtlar)
--
-- Bakırköy listesi (shared/bakirkoy.js) tablodan geldi ve tabloda mekânın
-- koordinatı yok. `lat`/`lng` NOT NULL ve deste sorgusu, arama ve ziyaret
-- eşleştirmesi hep bu iki sütuna dayanıyor; sütunları boşaltmak üç sorguyu
-- birden yeniden yazmak demekti.
--
-- Bunun yerine bu kayıtlar İLÇE MERKEZİYLE yazılıyor ve `location_exact =
-- false` işaretleniyor. Bayrağın taşıdığı kural:
--
--   • deste ve arama kaydı ilçe merkezinden sıralar (ilçesindeki kullanıcıya
--     yakın görünür) — gerçek uzaklığı iddia ETMEZ: API kartta `lat`/`lng`
--     ve `dist` boş gider, yalnızca `area` (ilçe merkezi) gider;
--   • ziyaret doğrulaması bu kayıtları HİÇ eşleştirmez: ilçe merkezinin
--     120 m'sinde duran biri rastgele bir mekâna "konumla doğrulandı"
--     rozeti kazandırırdı;
--   • işletme sahiplenip gerçek koordinatı girdiğinde bayrak true olur.
--
-- Mevcut kayıtlar koordinatlarını kendileri verdi: varsayılan true.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS location_exact boolean NOT NULL DEFAULT true;

COMMIT;
