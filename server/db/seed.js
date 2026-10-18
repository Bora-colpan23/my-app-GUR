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
import { DEMO_ROLLER } from "../../shared/demo.js";

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
  const username = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASSWORD || "gur2026";

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

async function seedCampaigns(db) {
  // DEMO: üç kampanya. Kayıtlar gerçek işletmeler (Bakırköy listesi), kampanya
  // ve işletme unvanı UYDURMA — unvanda "(demo)" yazıyor (bkz. shared/demo.js).
  // `claimed_by_org` bu üç kayıtta doğrulama yıldızı çıkarır: gerçek bir
  // müşteriden önce bu fonksiyon ve tohumu silinmeli.
  const K = DEMO_ROLLER.kampanyalar;
  const wanted = [
    { anahtar: K.turk,    org: "Abdülkadir Restaurant (demo)", label: "Öne Çıkan", pricing: "cpe", bid: 240, daily: 180000, offer: "%10 ikram" },
    { anahtar: K.balik,   org: "Meşhur Balıkçınız Bayram (demo)", label: "Öne Çıkan", pricing: "cpc", bid: 180, daily: 90000,  offer: "%15 indirim" },
    { anahtar: K.italyan, org: "Gusto Napoletano (demo)",      label: "Öne Çıkan", pricing: "cpe", bid: 310, daily: 42000,  offer: "ikram tatlı" },
  ];
  let n = 0;
  for (const w of wanted) {
    const { rows: [r] } = await db.query(
      `SELECT restaurant_id AS id FROM restaurant_sources
        WHERE provider = 'manual' AND external_id = $1`, [`bakirkoy:${w.anahtar}`]);
    if (!r) continue;
    // Tekrar çalıştırmada kampanya çoğaltma: aynı mekân için zaten bir
    // kampanya varsa atla.
    const { rows: [dupe] } = await db.query(
      `SELECT 1 FROM campaigns WHERE restaurant_id = $1 LIMIT 1`, [r.id]);
    if (dupe) continue;
    const { rows: [org] } = await db.query(
      `INSERT INTO organizations (legal_name, plan) VALUES ($1,'pro') RETURNING id`, [w.org]);
    await db.query(`UPDATE restaurants SET claimed_by_org = $2 WHERE id = $1`, [r.id, org.id]);
    await db.query(
      `INSERT INTO campaigns (org_id, restaurant_id, label, status, pricing, bid_minor, daily_budget_minor, target)
       VALUES ($1,$2,$3,'active',$4::pricing_model,$5,$6,$7)`,
      [org.id, r.id, w.label, w.pricing, w.bid, w.daily, JSON.stringify({ offer: w.offer })]);
    n++;
  }
  return n;
}

async function seedDemoUser(db) {
  const email = "demo@gur.app";
  // Kimlik satırı yoksa kullanıcı satırı da yarım kalmış olabilir (önceki
  // koşu ortada patlarsa): e-postadan da bakıp varsa onu kullanıyoruz.
  const { rows: [existing] } = await db.query(
    `SELECT ai.user_id FROM auth_identities ai
      WHERE ai.provider='password' AND ai.subject=$1`, [email]);
  if (existing) return { userId: existing.user_id, created: false };

  const { rows: [orphan] } = await db.query(
    `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]);
  const { rows: [u] } = orphan
    ? { rows: [orphan] }
    : await db.query(
        `INSERT INTO users (email, display_name, analytics_optin, marketing_optin)
         VALUES ($1,'Bora Çolpan',true,true) RETURNING id`, [email]);
  await db.query(
    // subject text, email_at_login citext: aynı parametreyi iki farklı tipe
    // bağlamak Postgres'te "inconsistent types" veriyor, açıkça cast ediyoruz.
    `INSERT INTO auth_identities (user_id, provider, subject, email_at_login, password_hash)
     VALUES ($1,'password',$2::text,$2::citext,$3)
     ON CONFLICT (provider, subject) DO NOTHING`, [u.id, email, await hashPassword("gur1234")]);
  await db.query(
    `INSERT INTO user_devices (user_id, platform, push_token) VALUES ($1,'web','demo-token')
     ON CONFLICT DO NOTHING`, [u.id]);
  return { userId: u.id, created: true };
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

  // Sıra önemli: kampanyalar mekânların yazılmış olmasını bekler.
  const bakirkoy = await seedBakirkoy(db);
  const admin = await seedPlatformAdmin(db);
  const campaigns = await seedCampaigns(db);
  const demo = await seedDemoUser(db);

  return { fromApi, bakirkoy, campaigns, adminCreated: admin.created, demoCreated: demo.created };
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
