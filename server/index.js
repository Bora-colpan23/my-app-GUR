// ═══════════════════════════════════════════════════════════════════════
// Sunucu giriş noktası.
//
//   DATABASE_URL=postgres://... node server/index.js
//
// Üç şey başlatır: HTTP API, zamanlanmış işler ve gerekirse ilk besleme.
// ═══════════════════════════════════════════════════════════════════════

import pg from "pg";
import { createServer } from "./src/http/server.js";
import { buildRouter } from "./src/http/routes.js";
import { registerJobs, bootstrap } from "./src/cron.js";

const PORT = Number(process.env.PORT) || 8787;
const ORIGIN = process.env.CORS_ORIGIN || "*";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil. Kurulum: ./server/db/setup.sh");
  process.exit(1);
}

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  // Sorgu asılı kalırsa havuzu tüketmesin
  statement_timeout: 15000,
});

db.on("error", err => console.error("[db] havuz hatası:", err.message));

// Bağlantı en baştan doğrulanır: yanlış DATABASE_URL ile "ayakta ama hiçbir
// şey çalışmıyor" durumundansa hemen düşmek daha iyi.
try {
  const { rows: [{ now }] } = await db.query("SELECT now()");
  console.log(`[db] bağlandı — ${now.toISOString()}`);
} catch (err) {
  console.error(`[db] bağlanamadı: ${err.message}`);
  process.exit(1);
}

const server = createServer(buildRouter(), { db, origin: ORIGIN });

server.listen(PORT, () => {
  console.log(`[http] http://localhost:${PORT} dinleniyor (CORS: ${ORIGIN})`);
});

// Push sağlayıcısı bağlanana kadar kuyruk konsola boşalır: bildirimler
// üretilir, zamanlanır ve tavan/sessiz saat kuralları çalışır — yalnızca
// taşıma katmanı yok.
const push = async ({ devices, title, body }) => {
  console.log(`[push] ${devices.length} cihaz · ${title} — ${body}`);
};

if (process.env.DISABLE_CRON !== "1") {
  registerJobs(db, { push });
  bootstrap(db).catch(err => console.error("[boot] besleme hatası:", err.message));
} else {
  console.log("[cron] devre dışı (DISABLE_CRON=1)");
}

async function shutdown(signal) {
  console.log(`\n[http] ${signal} — kapanıyor`);
  server.close();
  await db.end().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
