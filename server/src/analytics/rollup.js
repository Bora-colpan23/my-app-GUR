// ═══════════════════════════════════════════════════════════════════════
// Gecelik toplama: LTV/ARPU anlık görüntüsü, retention ve kohort tabloları.
// Sorguların kendisi server/db/queries/cohorts.sql içinde; burada yalnızca
// çalıştırma sırası ve hata yalıtımı var.
// ═══════════════════════════════════════════════════════════════════════

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const QUERIES = path.join(
  path.dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "queries", "cohorts.sql");

// Dosya "-- ─── n. Başlık ───" ayraçlarıyla bölünür; her blok ayrı çalışır
// ki biri patlarsa diğerleri yine yazılsın.
//
// Bloğun gerçekten çalıştırılacak bir ifade içerip içermediğine bakılır:
// ilk satıra bakmak, açıklama satırıyla başlayan gerçek sorguları da
// eliyordu (retention ve LTV blokları böyle atlanmıştı).
const RUNNABLE = /^\s*(INSERT|UPDATE|DELETE|SELECT|WITH)\b/im;

async function blocks() {
  const sql = await readFile(QUERIES, "utf8");
  return sql
    .split(/^-- ─── /m).slice(1)
    .map(b => ({ title: b.split("\n")[0].replace(/─+$/, "").trim(), body: b.slice(b.indexOf("\n")) }))
    .filter(b => RUNNABLE.test(b.body.replace(/^\s*--.*$/gm, "")));
}

export async function runRollups(db, { retentionOffsets = [1, 7, 30] } = {}) {
  const results = [];
  for (const b of await blocks()) {
    // 4. blok parametreli tekil rapor sorgusu — gecelik toplamada çalışmaz.
    if (b.title.startsWith("4.")) continue;
    try {
      const params = b.body.includes("$1::smallint[]") ? [retentionOffsets] : [];
      const started = Date.now();
      await db.query(b.body, params);
      results.push({ block: b.title, ms: Date.now() - started, ok: true });
    } catch (err) {
      console.error(`[rollup] ${b.title} hata: ${err.message}`);
      results.push({ block: b.title, ok: false, error: err.message });
    }
  }
  return results;
}

/** Panel için hazır kohort tablosu. */
export async function cohortTable(db, { weeks = 12 } = {}) {
  const { rows } = await db.query(
    `SELECT e.cohort_week, e.cohort_size, e.swipes_per_user, e.saves_per_user,
            e.save_to_directions_pct, e.save_to_visit_pct, e.ltv_minor_avg,
            max(r.retention_pct) FILTER (WHERE r.day_offset = 1)  AS d1,
            max(r.retention_pct) FILTER (WHERE r.day_offset = 7)  AS d7,
            max(r.retention_pct) FILTER (WHERE r.day_offset = 30) AS d30
       FROM cohort_engagement e
       LEFT JOIN cohort_retention r ON r.cohort_week = e.cohort_week
      WHERE e.cohort_week > current_date - ($1 * 7)
      GROUP BY e.cohort_week, e.cohort_size, e.swipes_per_user, e.saves_per_user,
               e.save_to_directions_pct, e.save_to_visit_pct, e.ltv_minor_avg
      ORDER BY e.cohort_week DESC`,
    [weeks]
  );
  return rows;
}

/** Platform geneli ARPU — panel başlığındaki tek sayı. */
export async function platformArpu(db) {
  const { rows: [r] } = await db.query(
    // count/sum bigint döner ve pg bunu string yapar; panel sayı bekliyor.
    `SELECT count(*)::int                     AS users,
            coalesce(avg(arpu_minor), 0)::int AS arpu_minor,
            coalesce(avg(ltv_minor), 0)::int  AS ltv_minor,
            coalesce(sum(ad_revenue_minor), 0)::int AS ad_revenue_minor
       FROM user_ltv`);
  return r;
}
