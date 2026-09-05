// ═══════════════════════════════════════════════════════════════════════
// Mekan besleme işçisi.
//
// Açılışta bir kez, sonra cron ile düzenli çalışır. İstanbul'u ızgaraya
// böler, her hücrede tüm sağlayıcıları sorgular, kayıtları normalize edip
// eşleştirir ve upsert eder.
//
// Sahiplenilmiş (claimed) mekânlarda işletmenin girdiği alanlar korunur:
// dış kaynak yalnızca işletmenin doldurmadığı alanı doldurur.
// ═══════════════════════════════════════════════════════════════════════

import { PROVIDERS } from "./providers.js";
import { normalize, dedupe } from "./normalize.js";

// Kadıköy'den başlayan, genişletilebilir kapsama ızgarası.
export const COVERAGE = [
  { name: "Kadıköy",    lat: 40.9903, lng: 29.0275, radiusM: 1800 },
  { name: "Beşiktaş",   lat: 41.0430, lng: 29.0060, radiusM: 1800 },
  { name: "Beyoğlu",    lat: 41.0330, lng: 28.9770, radiusM: 1800 },
  { name: "Şişli",      lat: 41.0600, lng: 28.9870, radiusM: 1800 },
  { name: "Üsküdar",    lat: 41.0250, lng: 29.0150, radiusM: 1800 },
  { name: "Bakırköy",   lat: 40.9780, lng: 28.8720, radiusM: 1800 },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Bir hücreyi tüm sağlayıcılardan çeker.
 * Bir sağlayıcı patlarsa tur durmaz — diğerlerinin verisi yine yazılır.
 */
async function fetchCell(cell) {
  const out = [];
  for (const provider of PROVIDERS) {
    try {
      const rows = await provider.fetchArea(cell);
      out.push(...rows);
      console.log(`[ingest] ${cell.name} · ${provider.id}: ${rows.length} kayıt`);
    } catch (err) {
      console.error(`[ingest] ${cell.name} · ${provider.id} hata: ${err.message}`);
    }
    await sleep(1200);   // sağlayıcı hız sınırlarına nazik davran
  }
  return out;
}

/**
 * Tek mekânı yazar.
 * db: { query(sql, params) } — pg Pool arayüzü yeter.
 */
export async function upsertPlace(db, place) {
  // 1) Bu dış kimliklerden biri zaten bir mekâna bağlıysa onu güncelle.
  const { rows: existing } = await db.query(
    `SELECT restaurant_id FROM restaurant_sources
      WHERE (provider, external_id) IN (
        ${place.sources.map((_, i) => `($${i * 2 + 1}::ingest_provider, $${i * 2 + 2})`).join(",")}
      ) LIMIT 1`,
    place.sources.flatMap(s => [s.provider, s.externalId])
  );

  let restaurantId = existing[0]?.restaurant_id;

  if (!restaurantId) {
    const { rows } = await db.query(
      `INSERT INTO restaurants
         (name, category, description, address, district, lat, lng, phone, website,
          price_level, rating, rating_count, hours, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [place.name, place.category, place.description, place.address, place.district,
       place.lat, place.lng, place.phone, place.website, place.priceLevel,
       place.rating, place.ratingCount || 0, place.hours, place.tags || []]
    );
    restaurantId = rows[0].id;
  } else {
    // COALESCE yönü kritik: mevcut değer doluysa korunur. Sahiplenilmiş
    // kayıtta işletmenin girdiği ad/adres/telefon böylece ezilmez.
    await db.query(
      `UPDATE restaurants SET
         name        = CASE WHEN claimed_by_org IS NULL THEN $2 ELSE name END,
         description = coalesce(description, $3),
         address     = coalesce(address, $4),
         district    = coalesce(district, $5),
         phone       = coalesce(phone, $6),
         website     = coalesce(website, $7),
         price_level = coalesce(price_level, $8),
         -- Puan her turda tazelenir: dış kaynak burada otoritedir.
         rating       = coalesce($9, rating),
         rating_count = greatest(rating_count, $10),
         hours        = coalesce(hours, $11),
         updated_at   = now()
       WHERE id = $1`,
      [restaurantId, place.name, place.description, place.address, place.district,
       place.phone, place.website, place.priceLevel, place.rating,
       place.ratingCount || 0, place.hours]
    );
  }

  // 2) Kaynak izleri — ham yanıt saklanır.
  for (const s of place.sources) {
    await db.query(
      `INSERT INTO restaurant_sources (restaurant_id, provider, external_id, payload, fetched_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (provider, external_id)
       DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()`,
      [restaurantId, s.provider, s.externalId, JSON.stringify(place.raw ?? {})]
    );
  }

  // 3) Fotoğraflar — işletmenin yüklediklerine dokunmadan dış kaynakları tazele.
  if (place.photos?.length) {
    await db.query(`DELETE FROM restaurant_photos WHERE restaurant_id = $1 AND is_owner = false`, [restaurantId]);
    let pos = 0;
    for (const p of place.photos) {
      if (!p.url) continue;   // Google foto referansları ayrı çözümleme ister
      await db.query(
        `INSERT INTO restaurant_photos (restaurant_id, url, width, height, origin, attribution, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [restaurantId, p.url, p.width, p.height, place.provider, p.attribution, pos++]
      );
    }
  }

  return restaurantId;
}

/** Bir tur: tüm hücreler, tüm sağlayıcılar. */
export async function runIngestion(db, cells = COVERAGE) {
  const started = Date.now();
  let written = 0;

  for (const cell of cells) {
    const raw = await fetchCell(cell);
    const places = dedupe(raw.map(normalize));
    for (const place of places) {
      try {
        await upsertPlace(db, place);
        written++;
      } catch (err) {
        console.error(`[ingest] yazma hatası (${place.name}): ${err.message}`);
      }
    }
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`[ingest] tur bitti: ${written} mekan, ${seconds} sn`);
  return { written, seconds };
}
