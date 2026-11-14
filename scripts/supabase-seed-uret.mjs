// ═══════════════════════════════════════════════════════════════════════
// shared/bakirkoy.js → supabase/seed.sql
//
//   npm run supabase:seed-uret
//
// Liste (218 kayıt) değişince önce `npm run leads:import`, sonra bunu
// çalıştırın; supabase/seed.sql üretilmiş dosyadır, elle düzenlemeyin.
//
// Kimlik `bkr-<anahtar>`: web, mobil ve sunucu aynı kimliği kullanıyor.
// Tekrar çalıştırmak KOPYA ÜRETMEZ; yalnızca sahiplenilmemiş kayıtların
// besleme alanları tazelenir (sahiplenen işletmenin girdiği değerler ve
// yöneticinin kararları — Gastro, gizleme, onay — ezilmez).
//
// TABLODA OLMAYAN HİÇBİR ŞEY UYDURULMAZ: koordinat yok → kayıt ilçe
// merkeziyle yazılır ve `location_exact = false` işaretlenir.
// ═══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAKIRKOY, BAKIRKOY_ILCE } from '../shared/bakirkoy.js';

const kok = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const q = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? String(Number(v)) : 'null');
const dizi = (a) => `array[${a.map(q).join(', ')}]::text[]`;

const satirlar = BAKIRKOY.map(k => {
  const aciklama = `${k.tur}${k.mahalle ? ` · ${k.mahalle}` : ''}, ${BAKIRKOY_ILCE.ad}.`;
  return `  (${[
    q(`bkr-${k.anahtar}`), q(k.ad), q(k.kategori), q(aciklama), q(k.adres), q(BAKIRKOY_ILCE.ad),
    n(BAKIRKOY_ILCE.lat), n(BAKIRKOY_ILCE.lng), 'false',
    q(k.telefon), q(k.web), n(k.puan), n(k.yorum || 0), dizi([k.tur, k.mahalle].filter(Boolean)),
  ].join(', ')})`;
});

const kaynaklar = BAKIRKOY.map(k =>
  `  (${q(`bkr-${k.anahtar}`)}, 'manual', ${q(`bakirkoy:${k.anahtar}`)}, ${q(JSON.stringify(k))}::jsonb)`);

// Her `-- @@gur-parca` satırı bir İSTEK sınırıdır: kurulum betiği (supabase-kur)
// dosyayı bu işarette bölüp parça parça gönderir (Yönetim API'sine 150 KB'lık
// tek istek yerine küçük istekler). psql / Supabase CLI işareti yorum satırı
// olarak görür ve dosyayı olduğu gibi çalıştırır.
const PARCA = '-- @@gur-parca';
const BOY = 40;
const parcala = (dizi) => {
  const out = [];
  for (let i = 0; i < dizi.length; i += BOY) out.push(dizi.slice(i, i + BOY));
  return out;
};

const restoranSql = parcala(satirlar).map(grup => `insert into public.restaurants
  (id, name, category, description, address, district, lat, lng, location_exact,
   phone, website, rating, rating_count, tags)
values
${grup.join(',\n')}
on conflict (id) do update set
  name = excluded.name, category = excluded.category, description = excluded.description,
  address = excluded.address, phone = excluded.phone, website = excluded.website,
  rating = excluded.rating, rating_count = excluded.rating_count, tags = excluded.tags
  where public.restaurants.claimed_by_org is null;`);

const kaynakSql = parcala(kaynaklar).map(grup => `insert into public.restaurant_sources (restaurant_id, provider, external_id, payload)
values
${grup.join(',\n')}
on conflict (provider, external_id) do update set payload = excluded.payload, fetched_at = now();`);

const baslik = `-- ═══════════════════════════════════════════════════════════════════════
-- GUR — Bakırköy mekân listesi (ÜRETİLMİŞ DOSYA, ELLE DÜZENLEMEYİN)
--
--   npm run supabase:seed-uret        (scripts/supabase-seed-uret.mjs)
--
-- ${BAKIRKOY.length} kayıt. İdempotent: tekrar çalıştırmak kopya üretmez.
-- Koordinat tabloda yok → ilçe merkezi + location_exact=false.
-- Gastro Onaylı, yorum, saat, fiyat, fotoğraf ve menü YOK (uydurulmaz).
--
-- Kaynak koşulları: liste bir Google Maps taramasından geliyor; puan ve yorum
-- sayısının kalıcı saklanması Google'ın koşullarında kısıtlı olabilir.
-- Yayına almadan önce teyit edin (bkz. CLAUDE.md).
-- ═══════════════════════════════════════════════════════════════════════
`;

const sql = baslik + '\n' + [...restoranSql, ...kaynakSql].join(`\n\n${PARCA}\n\n`) + '\n';

fs.writeFileSync(path.join(kok, 'supabase', 'seed.sql'), sql);
console.log(`✓ ${BAKIRKOY.length} kayıt → supabase/seed.sql (${Math.round(sql.length / 1024)} KB)`);
