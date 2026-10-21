// ═══════════════════════════════════════════════════════════════════════
// Tohum verisi.
//
//   node server/db/seed.js            # boşsa doldurur
//   node server/db/seed.js --reset    # veriyi silip yeniden yazar
//
// Ana data: Bakırköy listesi (shared/bakirkoy.js, `seedBakirkoy`). Eskiden
// burada elle yazılmış 15 demo mekân vardı; kaldırıldı.
//
// Dış besleme (server/src/ingestion) VARSAYILAN KAPALI: tohum sırasında
// Overpass/Places'ten başka mekân çekmek, listedeki aynı mekânların ikinci
// kopyasını yazardı (upsertPlace yalnızca (provider, external_id) ile
// eşleştirir). Açmak için GUR_SEED_INGEST=1.
// ═══════════════════════════════════════════════════════════════════════

import pg from "pg";
import { runIngestion } from "../src/ingestion/worker.js";
import { upsertPlace } from "../src/ingestion/worker.js";
import { hashPassword } from "../src/auth/password.js";
import { BAKIRKOY, BAKIRKOY_ILCE } from "../../shared/bakirkoy.js";

/**
 * Bakırköy listesi (shared/bakirkoy.js): tablodan gelen 218 kayıt.
 *
 * Tabloda koordinat YOK. `lat`/`lng` NOT NULL olduğu için kayıtlar İLÇE
 * MERKEZİYLE yazılıyor ve `location_exact = false` işaretleniyor (migration
 * 005): deste onları ilçesindeki kullanıcıya yakın sıralıyor ama mesafe
 * iddia etmiyor ve ziyaret doğrulaması hiç eşleştirmiyor.
 *
 * Kimlik `(manual, bakirkoy:<anahtar>)`: tekrar çalıştırmak kopya üretmez,
 * aynı satırı günceller. Gastro / sahiplenme / kampanya YOK; saat, fiyat,
 * fotoğraf ve açıklama tabloda olmadığı için boş.
 */
async function seedBakirkoy(db) {
  let n = 0;
  for (const k of BAKIRKOY) {
    const id = await upsertPlace(db, {
      name: k.ad,
      category: k.kategori,
      description: `${k.tur}${k.mahalle ? ` · ${k.mahalle}` : ""}, ${BAKIRKOY_ILCE.ad}.`,
      address: k.adres,
      district: BAKIRKOY_ILCE.ad,
      lat: BAKIRKOY_ILCE.lat, lng: BAKIRKOY_ILCE.lng, locationExact: false,
      phone: k.telefon, website: k.web,
      priceLevel: null, hours: null,
      rating: k.puan, ratingCount: k.yorum,
      tags: [k.tur, k.mahalle].filter(Boolean),
      provider: "manual",
      sources: [{ provider: "manual", externalId: `bakirkoy:${k.anahtar}` }],
      photos: [],
      raw: { bakirkoy: k },
    });
    // upsertPlace var olan kaydın kategorisini ve etiketlerini güncellemez
    // (dış besleme sahiplenilmiş kaydı ezmesin diye). Liste bu kayıtlar için
    // kaynak: tablo düzeltilip yeniden içe aktarıldığında, sahiplenilmemiş
    // kayıtlar yeni hâlini almalı.
    await db.query(
      `UPDATE restaurants SET category = $2, tags = $3, rating = $4, rating_count = $5
        WHERE id = $1 AND claimed_by_org IS NULL`,
      [id, k.kategori, [k.tur, k.mahalle].filter(Boolean), k.puan, k.yorum]);
    n++;
  }
  return n;
}

async function seedPlatformAdmin(db) {
  // Yönetici hesabı YALNIZCA parola ortamdan verilirse kurulur. Eskiden
  // varsayılan "admin" / "gur2026" vardı: herkesin bildiği bir parola, her
  // kurulumda açık bir yönetici kapısı demekti.
  const username = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASSWORD || "";
  if (password.length < 8) {
    console.warn("[seed] yönetici hesabı kurulmadı: ADMIN_PASSWORD (en az 8 karakter) tanımlı değil");
    return { orgId: null, userId: null, created: false };
  }

  const { rows: [org] } = await db.query(
    `INSERT INTO organizations (legal_name, plan) VALUES ('GUR Platform','pro')
     ON CONFLICT DO NOTHING RETURNING id`);
  const orgId = org?.id ?? (await db.query(
    `SELECT id FROM organizations WHERE legal_name = 'GUR Platform' LIMIT 1`)).rows[0].id;

  const { rows: [existing] } = await db.query(
    `SELECT user_id FROM auth_identities WHERE provider='password' AND subject=$1`, [username]);
  if (existing) return { orgId, userId: existing.user_id, created: false };

  const { rows: [user] } = await db.query(
    `INSERT INTO users (display_name, analytics_optin) VALUES ('GUR Yönetici', true) RETURNING id`);
  await db.query(
    `INSERT INTO auth_identities (user_id, provider, subject, password_hash)
     VALUES ($1,'password',$2,$3)`, [user.id, username, await hashPassword(password)]);
  await db.query(
    `INSERT INTO org_members (org_id, user_id, role) VALUES ($1,$2,'owner')
     ON CONFLICT DO NOTHING`, [orgId, user.id]);
  return { orgId, userId: user.id, created: true };
}

export async function seed(db, { reset = false, tryIngestion = process.env.GUR_SEED_INGEST === "1" } = {}) {
  if (reset) {
    console.log("› mevcut veri siliniyor");
    await db.query(`TRUNCATE users, restaurants, organizations RESTART IDENTITY CASCADE`);
  }

  let fromApi = 0;
  if (tryIngestion) {
    try {
      // Dış besleme (anahtar varsa Google/Foursquare, yoksa OSM), Bakırköy
      // hücresi. Varsayılan KAPALI: listedeki aynı mekânların kopyasını yazar.
      const out = await runIngestion(db, [{ name: "Bakırköy", lat: BAKIRKOY_ILCE.lat, lng: BAKIRKOY_ILCE.lng, radiusM: 1800 }]);
      fromApi = out.written;
    } catch (err) {
      console.warn(`[seed] besleme atlandı: ${err.message}`);
    }
  }

  const bakirkoy = await seedBakirkoy(db);
  const admin = await seedPlatformAdmin(db);

  return { fromApi, bakirkoy, adminCreated: admin.created };
}

// Doğrudan çalıştırıldığında
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const out = await seed(db, { reset: process.argv.includes("--reset") });
  console.log("✓ tohumlama:", out);
  const { rows: [c] } = await db.query(
    `SELECT (SELECT count(*) FROM restaurants)::int r, (SELECT count(*) FROM campaigns)::int c,
            (SELECT count(*) FROM users)::int u, (SELECT count(*) FROM restaurant_photos)::int p`);
  console.log("✓ sayımlar:", c);
  await db.end();
}
