// ═══════════════════════════════════════════════════════════════════════
// Tohum verisi.
//
//   node server/db/seed.js            # boşsa doldurur
//   node server/db/seed.js --reset    # veriyi silip yeniden yazar
//
// Önce gerçek besleme denenir (server/src/ingestion). Ağ politikası dış
// servisleri engelliyorsa veya anahtar yoksa aşağıdaki İstanbul listesi
// kullanılır — sistem her koşulda ayağa kalksın diye.
// ═══════════════════════════════════════════════════════════════════════

import pg from "pg";
import { runIngestion } from "../src/ingestion/worker.js";
import { upsertPlace } from "../src/ingestion/worker.js";
import { hashPassword } from "../src/auth/password.js";

const SEED_PLACES = [
  { name: "Nusr-Et Steakhouse", category: "Türk Mutfağı", lat: 41.0810, lng: 29.0330, district: "Beşiktaş", address: "Etiler, Nispetiye Cd. No:87", rating: 4.8, ratingCount: 4210, priceLevel: 4, hours: "12:00 - 00:00", tags: ["Fine Dining", "Et"], description: "Dünyaca ünlü et restoranı. Özel kesim etler ve eşsiz sunum.", popular: ["Tomahawk", "Ottoman Steak", "Baklava"] },
  { name: "Mikla Restaurant", category: "Fine Dining", lat: 41.0315, lng: 28.9760, district: "Beyoğlu", address: "Meşrutiyet Cd. No:15", rating: 4.9, ratingCount: 2880, priceLevel: 4, hours: "18:00 - 01:00", tags: ["Manzara", "Romantik"], description: "Skandinav-Türk mutfağı füzyonu. İstanbul manzarası eşliğinde.", popular: ["Kuzu Sırtı", "Deniz Börülcesi", "Sakız Dondurması"] },
  { name: "La Sagrata Famila", category: "Uzak Doğu", lat: 40.9870, lng: 29.0270, district: "Kadıköy", address: "Moda Cd. No:42", rating: 4.5, ratingCount: 1120, priceLevel: 3, hours: "11:00 - 23:00", tags: ["Sushi", "Japon"], description: "Geleneksel Japon lezzetini taze malzemelerle modern bir dokunuşla sunuyoruz.", popular: ["Omakase", "Uramaki", "Miso Çorbası"] },
  { name: "Green Bowl", category: "Sağlıklı", lat: 41.0555, lng: 28.9880, district: "Şişli", address: "Halaskargazi Cd. No:12", rating: 4.5, ratingCount: 640, priceLevel: 2, hours: "08:00 - 22:00", tags: ["Vegan", "Organik"], description: "Organik ve sağlıklı tarifler. Vegan seçenekler.", popular: ["Acai Bowl", "Falafel Tabağı", "Yeşil Detoks"] },
  { name: "Ateş Mangal", category: "Mangal", lat: 41.0270, lng: 29.0180, district: "Üsküdar", address: "Bağlarbaşı Cd. No:88", rating: 4.7, ratingCount: 1980, priceLevel: 3, hours: "11:00 - 00:00", tags: ["Mangal", "Aile"], description: "Geleneksel odun ateşinde pişen lezzetler.", popular: ["Adana Kebap", "Kuzu Şiş", "Künefe"] },
  { name: "Klein Bistro", category: "Kafe", lat: 41.0345, lng: 28.9780, district: "Beyoğlu", address: "İstiklal Cd. No:156", rating: 4.4, ratingCount: 890, priceLevel: 2, hours: "07:30 - 23:00", tags: ["Kahve", "Brunch"], description: "Butik kahve ve ev yapımı pastalar.", popular: ["Flat White", "Cheesecake", "Avokadolu Tost"] },
  { name: "Lucca Lounge", category: "Gece Hayatı", lat: 41.0770, lng: 29.0430, district: "Beşiktaş", address: "Bebek, Cevdetpaşa Cd. No:51", rating: 4.3, ratingCount: 1450, priceLevel: 4, hours: "17:00 - 04:00", tags: ["Lounge", "Kokteyl"], description: "Boğaz manzaralı lounge. Canlı DJ.", popular: ["Espresso Martini", "Tuna Tartar", "Trüf Patates"] },
  { name: "Nonna's Trattoria", category: "İtalyan", lat: 41.0245, lng: 28.9760, district: "Beyoğlu", address: "Karaköy, Kemankeş Cd. No:29", rating: 4.6, ratingCount: 1670, priceLevel: 3, hours: "12:00 - 23:30", tags: ["Pizza", "Makarna"], description: "Napoli usulü pizza ve makarna.", popular: ["Margherita", "Cacio e Pepe", "Tiramisu"] },
  { name: "Çiya Sofrası", category: "Türk Mutfağı", lat: 40.9903, lng: 29.0264, district: "Kadıköy", address: "Güneşlibahçe Sk. No:43", rating: 4.7, ratingCount: 5340, priceLevel: 2, hours: "11:00 - 22:00", tags: ["Geleneksel", "Anadolu"], description: "Anadolu'nun dört köşesinden geleneksel tarifler.", popular: ["Kuzu Kapama", "Zeytinyağlılar", "İrmik Helvası"] },
  { name: "Mandarin Oriental", category: "Uzak Doğu", lat: 41.0570, lng: 29.0330, district: "Beşiktaş", address: "Kuruçeşme, Muallim Naci Cd.", rating: 4.8, ratingCount: 980, priceLevel: 4, hours: "12:00 - 23:00", tags: ["Dim Sum", "Ramen"], description: "Uzak Doğu'nun en rafine lezzetleri.", popular: ["Peking Ördeği", "Dim Sum Tabağı", "Tonkotsu Ramen"] },
  { name: "The Burger Joint", category: "Fast Food", lat: 41.0480, lng: 28.9940, district: "Şişli", address: "Nişantaşı, Abdi İpekçi Cd. No:22", rating: 4.2, ratingCount: 2210, priceLevel: 2, hours: "11:00 - 01:00", tags: ["Burger", "Casual"], description: "El yapımı burgerler ve özel soslar.", popular: ["Klasik Cheeseburger", "Trüflü Patates", "Milkshake"] },
  { name: "Karaköy Güllüoğlu", category: "Tatlıcı", lat: 41.0250, lng: 28.9770, district: "Beyoğlu", address: "Kemankeş, Mumhane Cd. No:171", rating: 4.9, ratingCount: 8900, priceLevel: 2, hours: "06:00 - 01:00", tags: ["Baklava", "Tatlı"], description: "1820'den beri efsanevi baklava.", popular: ["Fıstıklı Baklava", "Şöbiyet", "Kaymaklı Kadayıf"] },
  { name: "Balıkçı Sabahattin", category: "Deniz Ürünleri", lat: 41.0055, lng: 28.9770, district: "Fatih", address: "Sultanahmet, Seyit Hasan Kuyu Sk.", rating: 4.6, ratingCount: 3120, priceLevel: 4, hours: "12:00 - 23:00", tags: ["Balık", "Tarihi"], description: "1927'den beri taze deniz lezzetleri.", popular: ["Levrek Buğulama", "Ahtapot Izgara", "Midye Dolma"] },
  { name: "Spice Market", category: "Hint", lat: 41.0330, lng: 28.9830, district: "Beyoğlu", address: "Cihangir, Akarsu Cd. No:15", rating: 4.4, ratingCount: 760, priceLevel: 3, hours: "12:00 - 23:00", tags: ["Hint", "Curry"], description: "Otantik Hint baharat dünyası.", popular: ["Butter Chicken", "Lamb Vindaloo", "Garlic Naan"] },
  { name: "Mövenpick Bosphorus", category: "Fine Dining", lat: 41.0480, lng: 29.0110, district: "Beşiktaş", address: "Büyükdere Cd. No:4", rating: 4.5, ratingCount: 1340, priceLevel: 4, hours: "07:00 - 23:00", tags: ["Otel", "Kahvaltı"], description: "Boğaz manzaralı otel restoranı.", popular: ["Boğaz Kahvaltısı", "Levrek Fileto", "Çikolatalı Sufle"] },
];

// "11:00 - 22:00" → {"mon":[["11:00","22:00"]], ...}. Şemadaki hours jsonb;
// gün bazlı saklamak "bugün açık mı" sorusunu tek satırda cevaplatıyor.
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function toHours(range) {
  const [open, close] = String(range).split("-").map(x => x.trim());
  return Object.fromEntries(DAYS.map(d => [d, [[open, close]]]));
}

const photo = (seed, i) => `https://picsum.photos/seed/${seed}-${i}/900/600`;
const slug = (n) => n.toLocaleLowerCase("tr").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function seedRestaurants(db) {
  let written = 0;
  for (const p of SEED_PLACES) {
    const id = await upsertPlace(db, {
      ...p,
      hours: toHours(p.hours),
      provider: "manual",
      sources: [{ provider: "manual", externalId: `seed:${slug(p.name)}` }],
      photos: [0, 1, 2].map(i => ({ url: photo(slug(p.name), i), width: 900, height: 600 })),
      raw: { seed: true },
    });
    // Popüler yemekler menü kalemi olarak; detay sayfası bunları okuyor.
    await db.query(`DELETE FROM restaurant_menu_items WHERE restaurant_id = $1 AND source = 'manual'`, [id]);
    for (const dish of p.popular) {
      await db.query(
        `INSERT INTO restaurant_menu_items (restaurant_id, name, is_popular, source)
         VALUES ($1,$2,true,'manual')`, [id, dish]);
    }
    written++;
  }
  return written;
}

async function seedGastro(db) {
  // Gastro rozeti: yüksek puanlı ve çok yorumlu üç mekan.
  const { rows } = await db.query(
    `SELECT id, name FROM restaurants WHERE rating >= 4.6 ORDER BY rating_count DESC LIMIT 3`);
  for (const [i, r] of rows.entries()) {
    await db.query(
      `UPDATE restaurants SET gastro_approved = true, gastro_chef = $2 WHERE id = $1`,
      [r.id, ["Şef Mehmet Gürs", "Şef Didem Şenol", "Şef Maksut Aşkar"][i]]);
  }
  return rows.length;
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
  // Üç Pro işletme + birer kampanya. Re-engagement cron'u yalnızca Pro
  // planlı mekânlar için çalıştığı için plan burada 'pro'.
  const wanted = [
    { restaurant: "Çiya Sofrası",         org: "Çiya Gıda San. Tic. Ltd. Şti.", label: "Öne Çıkan",     pricing: "cpe", bid: 240, daily: 180000, offer: "%10 ikram" },
    { restaurant: "Balıkçı Sabahattin",   org: "Sabahattin Turizm A.Ş.",        label: "Şefin Önerisi", pricing: "cpc", bid: 180, daily: 90000,  offer: "%15 indirim" },
    { restaurant: "Nonna's Trattoria",    org: "Nonna Gastro A.Ş.",             label: "Öne Çıkan",     pricing: "cpe", bid: 310, daily: 42000,  offer: "ikram tatlı" },
  ];
  let n = 0;
  for (const w of wanted) {
    const { rows: [r] } = await db.query(`SELECT id FROM restaurants WHERE name = $1`, [w.restaurant]);
    if (!r) continue;
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

export async function seed(db, { reset = false, tryIngestion = true } = {}) {
  if (reset) {
    console.log("› mevcut veri siliniyor");
    await db.query(`TRUNCATE users, restaurants, organizations RESTART IDENTITY CASCADE`);
  }

  let fromApi = 0;
  if (tryIngestion) {
    try {
      // Gerçek besleme: anahtar varsa Google/Foursquare, yoksa OSM.
      const out = await runIngestion(db, [{ name: "Kadıköy", lat: 40.9903, lng: 29.0275, radiusM: 1500 }]);
      fromApi = out.written;
    } catch (err) {
      console.warn(`[seed] besleme atlandı: ${err.message}`);
    }
  }

  const seeded = await seedRestaurants(db);
  const gastro = await seedGastro(db);
  const admin = await seedPlatformAdmin(db);
  const campaigns = await seedCampaigns(db);
  const demo = await seedDemoUser(db);

  return { fromApi, seeded, gastro, campaigns, adminCreated: admin.created, demoCreated: demo.created };
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
