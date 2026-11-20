// ═══════════════════════════════════════════════════════════════════════
// Barındırma ortamı için açılış hazırlığı (Railway, Render…).
//
//   node server/db/init.js        # npm start bunu sunucudan ÖNCE çalıştırır
//
// setup.sh `su postgres` ister; yönetilen veritabanında öyle bir kullanıcı
// yok. Burada aynı iş DATABASE_URL ile yapılıyor ve HER AÇILIŞTA güvenle
// tekrarlanabiliyor:
//   • şema yoksa schema.sql uygulanır (eklentiler dahil — yönetilen
//     PostgreSQL'de bağlanan rol eklenti kurabilmeli; Railway'de kurabilir);
//   • Bakırköy listesi yoksa tohumlanır;
//   • ADMIN_PASSWORD verilmiş ama yönetici hesabı yoksa o da kurulur.
// Var olan veriye dokunulmaz.
// ═══════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { seed } from "./seed.js";

if (!process.env.DATABASE_URL) {
  console.error("[init] DATABASE_URL tanımlı değil");
  process.exit(1);
}

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows: [{ var: tablo }] } = await db.query(`SELECT to_regclass('public.restaurants') AS var`);
  if (!tablo) {
    console.log("[init] şema uygulanıyor");
    const sql = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "schema.sql"), "utf8");
    await db.query(sql);
  }

  const { rows: [{ n }] } = await db.query(`SELECT count(*)::int AS n FROM restaurants`);
  let adminYok = false;
  if ((process.env.ADMIN_PASSWORD || "").length >= 8) {
    const { rows } = await db.query(
      `SELECT 1 FROM auth_identities WHERE provider='password' AND subject=$1`, [process.env.ADMIN_USER || "admin"]);
    adminYok = rows.length === 0;
  }
  if (n === 0 || adminYok) {
    console.log("[init] tohumlanıyor", { restoran: n, adminKurulacak: adminYok });
    console.log("[init] ✓", await seed(db));
  } else {
    console.log(`[init] veri hazır (${n} restoran)`);
  }
} catch (err) {
  console.error("[init] başarısız:", err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
