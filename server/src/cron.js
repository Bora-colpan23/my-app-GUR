// ═══════════════════════════════════════════════════════════════════════
// Zamanlanmış işler.
//
// Her iş kilitli çalışır: birden çok sunucu örneği aynı anda ayaktayken
// aynı işi iki kez koşturmak, aynı bildirimi iki kez göndermek demektir.
// pg_advisory_lock bunu tek satırda çözer, ayrı bir kuyruk altyapısı
// gerektirmeden.
// ═══════════════════════════════════════════════════════════════════════

import cron from "node-cron";
import { runIngestion } from "./ingestion/worker.js";
import { visitReviewPrompts, reengagement30d } from "./notifications/jobs.js";
import { drainQueue } from "./notifications/queue.js";
import { runRollups } from "./analytics/rollup.js";
import { closeStaleVisits } from "./visits/tracker.js";

// Sabit anahtarlar: aynı iş her sunucuda aynı kilidi ister.
const LOCKS = {
  ingestion: 1001, visitPrompts: 1002, reengagement: 1003,
  drain: 1004, rollups: 1005, closeVisits: 1006,
};

async function withLock(db, key, name, fn) {
  const { rows: [{ pg_try_advisory_lock: got }] } =
    await db.query(`SELECT pg_try_advisory_lock($1)`, [key]);
  if (!got) {
    console.log(`[cron] ${name} atlandı: başka bir örnek çalıştırıyor`);
    return null;
  }
  const started = Date.now();
  try {
    const out = await fn();
    console.log(`[cron] ${name} bitti (${Date.now() - started} ms)`, out ?? "");
    return out;
  } catch (err) {
    console.error(`[cron] ${name} hata: ${err.stack}`);
    return null;
  } finally {
    await db.query(`SELECT pg_advisory_unlock($1)`, [key]);
  }
}

/**
 * Tüm zamanlanmış işleri kaydeder.
 * push: gerçek APNs/FCM göndericisi — test ortamında sahte fonksiyon verilir.
 */
export function registerJobs(db, { push, timezone = "Europe/Istanbul" } = {}) {
  const at = (expr, name, key, fn) =>
    cron.schedule(expr, () => withLock(db, key, name, fn), { timezone });

  // Mekan havuzu: gece 03:15, trafiğin en düşük olduğu saat.
  at("15 3 * * *", "ingestion", LOCKS.ingestion, () => runIngestion(db));

  // Ziyaret döngüsü: 10 dakikada bir açık ziyaretleri kapat, vakti gelen
  // "deneyim nasıldı" bildirimlerini kuyruğa al.
  at("*/10 * * * *", "closeVisits",  LOCKS.closeVisits,  async () => ({ closed: (await closeStaleVisits(db)).length }));
  at("*/10 * * * *", "visitPrompts", LOCKS.visitPrompts, () => visitReviewPrompts(db));

  // 30 günlük re-engagement: günde bir kez, öğleden sonra — akşam yemeği
  // kararının verildiği saate yakın.
  at("0 16 * * *", "reengagement", LOCKS.reengagement, () => reengagement30d(db));

  // Kuyruk boşaltma: 2 dakikada bir.
  at("*/2 * * * *", "drainQueue", LOCKS.drain, () => drainQueue(db, push));

  // Analitik toplama: gece 04:00, besleme bittikten sonra.
  at("0 4 * * *", "rollups", LOCKS.rollups, () => runRollups(db));

  console.log("[cron] işler kaydedildi");
}

/** Açılışta bir kez: havuz boşsa ilk beslemeyi hemen yap. */
export async function bootstrap(db) {
  const { rows: [{ count }] } = await db.query(`SELECT count(*)::int FROM restaurants`);
  if (count === 0) {
    console.log("[boot] mekan havuzu boş, ilk besleme başlıyor");
    await runIngestion(db);
  }
}
