// ═══════════════════════════════════════════════════════════════════════
// API uçları.
//
// Yetkilendirme kuralı: kullanıcıya ait her uç `auth: true`, yönetici uçları
// ayrıca `role: 'admin'`. İstemciden gelen user_id'ye asla güvenilmez —
// kimlik daima imzalı belirteçten okunur.
// ═══════════════════════════════════════════════════════════════════════

import { Router, reply } from "./server.js";
import { issueToken } from "../auth/session.js";
import { verifyPassword } from "../auth/password.js";
import { signInWithProvider } from "../auth/social.js";
import { getDeck, recordSwipe, grantRewardBonus } from "../swipe/deck.js";
import { ingestLocationSample, reviewPermission, submitVerifiedReview, closeStaleVisits } from "../visits/tracker.js";
import { logBatch, trackDirections, trackReservation } from "../analytics/events.js";
import { cohortTable, platformArpu } from "../analytics/rollup.js";
import { visitReviewPrompts } from "../notifications/jobs.js";

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

// İstemciden gelen kimlikler doğrudan uuid sütunlarına gidiyor; biçimi
// burada süzmezsek Postgres 500 ile patlıyor, oysa bu 400'lük bir girdi hatası.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v, field) => {
  if (v == null || v === "" || v === "null" || v === "None" || v === "undefined") return null;
  if (!UUID.test(String(v))) throw bad(`${field} geçerli bir kimlik değil`);
  return String(v);
};

// İstanbul merkezi — konum gönderilmediğinde destenin çıpası.
const DEFAULT_ORIGIN = { lat: 41.0082, lng: 28.9784 };

function coords(query) {
  const lat = Number(query.lat), lng = Number(query.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : DEFAULT_ORIGIN;
}

export function buildRouter() {
  const r = new Router();

  // ─── Sağlık ────────────────────────────────────────────────────────
  r.get("/api/health", async ({ db }) => {
    const { rows: [x] } = await db.query(
      `SELECT (SELECT count(*) FROM restaurants)::int AS restaurants,
              (SELECT count(*) FROM users)::int       AS users,
              (SELECT count(*) FROM campaigns WHERE status='active')::int AS active_campaigns`);
    return { ok: true, ...x };
  });

  // ─── Kimlik ────────────────────────────────────────────────────────

  // Parolayla giriş / kayıt. Aynı uç: hesap yoksa açılır.
  r.post("/api/auth/password", async ({ db, body }) => {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email.includes("@") || password.length < 6) throw bad("Geçerli e-posta ve en az 6 karakter parola gerekli");

    const { rows: [ident] } = await db.query(
      `SELECT ai.password_hash, ai.user_id, u.display_name, u.plan
         FROM auth_identities ai JOIN users u ON u.id = ai.user_id
        WHERE ai.provider = 'password' AND ai.subject = $1 AND u.deleted_at IS NULL`, [email]);

    if (ident) {
      if (!await verifyPassword(password, ident.password_hash)) throw bad("E-posta veya parola hatalı", 401);
      await db.query(`UPDATE users SET last_seen_at = now() WHERE id = $1`, [ident.user_id]);
      return { token: issueToken(ident.user_id), user: { id: ident.user_id, name: ident.display_name, plan: ident.plan } };
    }

    // Kayıt
    const { hashPassword } = await import("../auth/password.js");
    const { rows: [user] } = await db.query(
      `INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id, display_name, plan`,
      [email, String(body.name || email.split("@")[0]).slice(0, 60)]);
    await db.query(
      // subject text, email_at_login citext — açık cast olmadan Postgres
      // aynı parametre için iki tip deduce edemiyor.
      `INSERT INTO auth_identities (user_id, provider, subject, email_at_login, password_hash)
       VALUES ($1,'password',$2::text,$2::citext,$3)`, [user.id, email, await hashPassword(password)]);
    return reply(201, { token: issueToken(user.id), user: { id: user.id, name: user.display_name, plan: user.plan }, created: true });
  });

  // Google / Apple. İstemcinin gönderdiği id_token burada doğrulanır.
  r.post("/api/auth/social", async ({ db, body }) => {
    const provider = body.provider;
    if (!["google", "apple"].includes(provider)) throw bad("Bilinmeyen sağlayıcı");
    const audience = provider === "google"
      ? process.env.GOOGLE_OAUTH_CLIENT_ID
      : process.env.APPLE_SERVICE_ID;
    if (!audience) throw bad(`${provider} için istemci kimliği tanımlı değil`, 501);
    if (!body.idToken) throw bad("idToken gerekli");

    const out = await signInWithProvider(db, provider, body, {
      audience,
      issueSession: async (userId) => ({ token: issueToken(userId) }),
    });
    const { rows: [u] } = await db.query(`SELECT display_name, plan FROM users WHERE id = $1`, [out.userId]);
    return { token: out.token, user: { id: out.userId, name: u.display_name, plan: u.plan }, created: out.created };
  });

  // Yönetici girişi — artık gerçek bir sınır: parola özeti veritabanında.
  r.post("/api/auth/admin", async ({ db, body }) => {
    const username = String(body.username || "").trim().toLowerCase();
    const { rows: [ident] } = await db.query(
      `SELECT ai.password_hash, ai.user_id FROM auth_identities ai
         JOIN org_members om ON om.user_id = ai.user_id AND om.role = 'owner'
         JOIN organizations o ON o.id = om.org_id AND o.legal_name = 'GUR Platform'
        WHERE ai.provider = 'password' AND ai.subject = $1`, [username]);
    if (!ident || !await verifyPassword(String(body.password || ""), ident.password_hash)) {
      throw bad("Kullanıcı adı veya parola hatalı", 401);
    }
    return { token: issueToken(ident.user_id, { role: "admin" }) };
  });

  r.get("/api/me", async ({ db, user }) => {
    const { rows: [u] } = await db.query(
      `SELECT id, display_name, email, plan, analytics_optin, marketing_optin FROM users WHERE id = $1`, [user.sub]);
    if (!u) throw bad("Kullanıcı yok", 404);
    return { user: u, role: user.role };
  }, { auth: true });

  r.patch("/api/me/consent", async ({ db, body, user }) => {
    await db.query(
      `UPDATE users SET analytics_optin = coalesce($2, analytics_optin),
                        marketing_optin = coalesce($3, marketing_optin)
        WHERE id = $1`,
      [user.sub, body.analytics ?? null, body.marketing ?? null]);
    return { ok: true };
  }, { auth: true });

  r.del("/api/me", async ({ db, user }) => {
    // Yumuşak silme: yasal saklama süresi dolunca gecelik iş kalıcı siler.
    await db.query(`UPDATE users SET deleted_at = now(), email = NULL WHERE id = $1`, [user.sub]);
    await db.query(`DELETE FROM auth_identities WHERE user_id = $1`, [user.sub]);
    return { ok: true };
  }, { auth: true });

  // ─── Keşif ─────────────────────────────────────────────────────────

  r.get("/api/deck", async ({ db, query, user }) => {
    const { cards, quota } = await getDeck(db, user.sub, {
      ...coords(query), category: query.category || null,
      radiusM: Number(query.radiusM) || 12000,
    });
    // Kota SAYISI istemciye gitmiyor — yalnızca niteliksel baskı.
    return { cards: cards.map(shapeCard), quota: { allowed: quota.allowed, pressure: quota.pressure } };
  }, { auth: true });

  r.post("/api/swipes", async ({ db, body, user }) => {
    if (!["left", "right", "up"].includes(body.direction)) throw bad("Geçerli yön gerekli");
    const restaurantId = asUuid(body.restaurantId, "restaurantId");
    if (!restaurantId) throw bad("restaurantId gerekli");
    await recordSwipe(db, user.sub, {
      restaurantId, direction: body.direction,
      campaignId: asUuid(body.campaignId, "campaignId"), deckPosition: body.deckPosition ?? null,
      dwellMs: body.dwellMs ?? null,
    });
    return { ok: true };
  }, { auth: true });

  r.post("/api/rewarded-ad/complete", async ({ db, body, user }) => {
    await grantRewardBonus(db, user.sub, { bonus: 5, revenueMinor: Number(body.revenueMinor) || 0 });
    return { ok: true };
  }, { auth: true });

  r.get("/api/saved", async ({ db, user }) => {
    const { rows } = await db.query(
      `SELECT r.*, sp.is_super, sp.saved_at, sp.visited_at
         FROM saved_places sp JOIN restaurants r ON r.id = sp.restaurant_id
        WHERE sp.user_id = $1 ORDER BY sp.saved_at DESC`, [user.sub]);
    return { saved: rows.map(shapeCard) };
  }, { auth: true });

  r.get("/api/restaurants", async ({ db, query }) => {
    const { rows } = await db.query(
      `SELECT r.*, earth_distance(ll_to_earth($1,$2), ll_to_earth(r.lat, r.lng)) AS distance_m
         FROM restaurants r
        WHERE r.is_active AND ($3::text IS NULL OR r.name ILIKE '%' || $3 || '%')
        ORDER BY distance_m LIMIT $4`,
      [coords(query).lat, coords(query).lng, query.q || null, Math.min(Number(query.limit) || 40, 100)]);
    return { restaurants: rows.map(shapeCard) };
  });

  r.get("/api/restaurants/:id", async ({ db, params }) => {
    const { rows: [r] } = await db.query(`SELECT * FROM restaurants WHERE id = $1`, [params.id]);
    if (!r) throw bad("Restoran yok", 404);
    const [{ rows: photos }, { rows: menu }, { rows: reviews }] = await Promise.all([
      db.query(`SELECT url, is_owner FROM restaurant_photos WHERE restaurant_id = $1
                 ORDER BY is_owner DESC, position`, [params.id]),
      db.query(`SELECT name, description, price_minor, photo_url, is_popular
                  FROM restaurant_menu_items WHERE restaurant_id = $1 AND is_available`, [params.id]),
      db.query(`SELECT rv.stars, rv.body, rv.photos, rv.is_verified, rv.created_at, u.display_name
                  FROM reviews rv JOIN users u ON u.id = rv.user_id
                 WHERE rv.restaurant_id = $1 AND rv.hidden_at IS NULL
                 ORDER BY rv.is_verified DESC, rv.created_at DESC LIMIT 20`, [params.id]),
    ]);
    return {
      restaurant: shapeCard(r),
      photos, menu, reviews,
      ownerPhotoCount: photos.filter(p => p.is_owner).length,
    };
  });

  // ─── Konum doğrulamalı ziyaret ─────────────────────────────────────

  r.post("/api/visits/sample", async ({ db, body, user }) => {
    const out = await ingestLocationSample(db, user.sub, {
      lat: Number(body.lat), lng: Number(body.lng),
      accuracyM: body.accuracyM == null ? null : Number(body.accuracyM),
      at: body.at ? new Date(body.at) : new Date(),
    });
    return out;
  }, { auth: true });

  r.get("/api/visits/permission/:restaurantId", async ({ db, params, user }) =>
    reviewPermission(db, user.sub, params.restaurantId), { auth: true });

  // Vakti gelen "deneyim nasıldı" davetleri — uygulama içi bant bunu okur.
  r.get("/api/visits/prompts", async ({ db, user }) => {
    await closeStaleVisits(db, user.sub);
    const { rows } = await db.query(
      `SELECT v.id, v.restaurant_id, v.dwell_seconds, r.name AS restaurant_name
         FROM visits v JOIN restaurants r ON r.id = v.restaurant_id
        WHERE v.user_id = $1 AND v.status = 'confirmed'
          AND v.prompt_due_at <= now() AND v.review_id IS NULL
        ORDER BY v.confirmed_at DESC LIMIT 5`, [user.sub]);
    return { prompts: rows };
  }, { auth: true });

  r.post("/api/reviews", async ({ db, body, user }) => {
    const stars = Number(body.stars);
    if (!(stars >= 1 && stars <= 5)) throw bad("Puan 1-5 arası olmalı");
    if (String(body.body || "").trim().length < 10) throw bad("Yorum en az 10 karakter olmalı");
    try {
      const id = await submitVerifiedReview(db, user.sub, asUuid(body.restaurantId, "restaurantId"), {
        stars, body: String(body.body).slice(0, 2000),
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 4) : [],
      });
      return reply(201, { id, verified: true });
    } catch (err) {
      if (err.code === "NO_VISIT") throw bad("Bu mekân için doğrulanmış ziyaretin yok", 403);
      throw err;
    }
  }, { auth: true });

  // ─── Analitik ve gelir olayları ────────────────────────────────────

  r.post("/api/events", async ({ db, body, user }) => {
    if (!Array.isArray(body.events)) throw bad("events dizisi gerekli");
    await logBatch(db, user.sub, body.events);
    return { ok: true, accepted: Math.min(body.events.length, 200) };
  }, { auth: true });

  r.post("/api/directions", async ({ db, body, user }) => {
    await trackDirections(db, user.sub, asUuid(body.restaurantId, "restaurantId"), {
      provider: body.provider, affiliateMinor: Number(body.affiliateMinor) || 0,
    });
    return { ok: true };
  }, { auth: true });

  r.post("/api/reservations", async ({ db, body, user }) => {
    const commission = await trackReservation(db, user.sub, asUuid(body.restaurantId, "restaurantId"), {
      gmvMinor: Number(body.gmvMinor) || 0,
    });
    return { ok: true, commissionMinor: commission };
  }, { auth: true });

  // ─── B2B: sahiplenme ───────────────────────────────────────────────

  r.post("/api/claims", async ({ db, body, user }) => {
    if (!body.restaurantId || !body.legalName) throw bad("restaurantId ve legalName gerekli");
    const { rows: [dupe] } = await db.query(
      `SELECT 1 FROM restaurant_claims WHERE restaurant_id = $1 AND status = 'pending'`, [body.restaurantId]);
    if (dupe) throw bad("Bu işletme için zaten bekleyen bir başvuru var", 409);

    const { rows: [org] } = await db.query(
      `INSERT INTO organizations (legal_name, tax_id) VALUES ($1,$2) RETURNING id`,
      [body.legalName, body.taxId || null]);
    await db.query(
      `INSERT INTO org_members (org_id, user_id, role) VALUES ($1,$2,'owner')
       ON CONFLICT DO NOTHING`, [org.id, user.sub]);
    const { rows: [claim] } = await db.query(
      `INSERT INTO restaurant_claims (restaurant_id, org_id, requested_by, evidence)
       VALUES ($1,$2,$3,$4) RETURNING id, status`,
      [body.restaurantId, org.id, user.sub,
       { contactName: body.contactName, phone: body.phone, email: body.email }]);
    return reply(201, claim);
  }, { auth: true });

  r.get("/api/claims", async ({ db }) => {
    const { rows } = await db.query(
      `SELECT c.id, c.status, c.created_at, c.evidence, c.reject_reason,
              r.id AS restaurant_id, r.name AS restaurant_name,
              o.legal_name, o.tax_id
         FROM restaurant_claims c
         JOIN restaurants r ON r.id = c.restaurant_id
         JOIN organizations o ON o.id = c.org_id
        ORDER BY c.created_at DESC LIMIT 100`);
    return { claims: rows };
  }, { auth: true, role: "admin" });

  r.post("/api/claims/:id/decision", async ({ db, params, body, user }) => {
    const status = body.status === "approved" ? "approved" : "rejected";
    const { rows: [claim] } = await db.query(
      `UPDATE restaurant_claims
          SET status = $2::claim_status, reviewer_id = $3, reviewed_at = now(), reject_reason = $4
        WHERE id = $1 AND status = 'pending'
        RETURNING restaurant_id, org_id`,
      [params.id, status, user.sub, status === "rejected" ? (body.reason || "Belge doğrulanamadı") : null]);
    if (!claim) throw bad("Bekleyen başvuru bulunamadı", 404);
    if (status === "approved") {
      // Sahiplik burada bağlanır: besleme artık bu kaydın adını ezmez.
      await db.query(`UPDATE restaurants SET claimed_by_org = $2 WHERE id = $1`,
        [claim.restaurant_id, claim.org_id]);
    }
    return { ok: true, status };
  }, { auth: true, role: "admin" });

  // İşletmenin girdiği alanlar. Boş gönderilen alan dış kaynağa geri düşer.
  r.patch("/api/restaurants/:id/owner", async ({ db, params, body, user }) => {
    const { rows: [ok] } = await db.query(
      `SELECT 1 FROM restaurants r
         JOIN org_members m ON m.org_id = r.claimed_by_org AND m.user_id = $2
        WHERE r.id = $1`, [params.id, user.sub]);
    if (!ok) throw bad("Bu işletmeyi yönetme yetkin yok", 403);

    const allowed = ["name", "description", "hours", "phone", "address", "price_level"];
    const patch = Object.entries(body).filter(([k]) => allowed.includes(k));
    if (!patch.length) throw bad("Güncellenecek alan yok");

    const sets = patch.map(([k], i) => `${k} = $${i + 2}`).join(", ");
    await db.query(
      `UPDATE restaurants SET ${sets}, updated_at = now() WHERE id = $1`,
      [params.id, ...patch.map(([, v]) => (v === "" ? null : v))]);
    return { ok: true, updated: patch.map(([k]) => k) };
  }, { auth: true });

  // ─── Yönetici ──────────────────────────────────────────────────────

  r.get("/api/admin/growth", async ({ db, query }) => ({
    cohorts: await cohortTable(db, { weeks: Number(query.weeks) || 12 }),
    platform: await platformArpu(db),
  }), { auth: true, role: "admin" });

  r.get("/api/admin/campaigns", async ({ db }) => {
    const { rows } = await db.query(
      `SELECT c.id, c.label, c.status, c.pricing, c.bid_minor, c.daily_budget_minor,
              c.total_budget_minor, c.spent_minor,
              r.name AS restaurant, o.legal_name AS org,
              coalesce(d.impressions,0) AS impressions, coalesce(d.clicks,0) AS clicks,
              coalesce(d.engagements,0) AS engagements, coalesce(d.spent_minor,0) AS today_spent
         FROM campaigns c
         JOIN restaurants r ON r.id = c.restaurant_id
         JOIN organizations o ON o.id = c.org_id
         LEFT JOIN campaign_daily_spend d ON d.campaign_id = c.id AND d.day = current_date
        ORDER BY c.bid_minor DESC`);
    return { campaigns: rows };
  }, { auth: true, role: "admin" });

  r.patch("/api/admin/campaigns/:id", async ({ db, params, body }) => {
    const sets = [], vals = [params.id];
    if (body.status) { sets.push(`status = $${vals.length + 1}::campaign_status`); vals.push(body.status); }
    if (body.bidMinor != null) { sets.push(`bid_minor = $${vals.length + 1}`); vals.push(Math.max(20, Number(body.bidMinor))); }
    if (!sets.length) throw bad("Güncellenecek alan yok");
    const { rows: [c] } = await db.query(
      `UPDATE campaigns SET ${sets.join(", ")} WHERE id = $1 RETURNING id, status, bid_minor`, vals);
    if (!c) throw bad("Kampanya yok", 404);
    return c;
  }, { auth: true, role: "admin" });

  r.get("/api/admin/restaurants/:id/engagement", async ({ db, params, query }) => {
    const days = Math.min(Number(query.days) || 30, 365);
    const { rows: [x] } = await db.query(
      `SELECT
         (SELECT count(*) FROM swipes s WHERE s.restaurant_id = $1 AND s.direction = 'right'
            AND s.created_at > now() - ($2 || ' days')::interval)::int AS saves,
         (SELECT count(*) FROM swipes s WHERE s.restaurant_id = $1 AND s.direction = 'up'
            AND s.created_at > now() - ($2 || ' days')::interval)::int AS super_likes,
         (SELECT count(*) FROM swipes s WHERE s.restaurant_id = $1 AND s.direction = 'left'
            AND s.created_at > now() - ($2 || ' days')::interval)::int AS passes,
         (SELECT count(*) FROM analytics_events e WHERE e.restaurant_id = $1 AND e.name = 'detail_open'
            AND e.occurred_at > now() - ($2 || ' days')::interval)::int AS detail_views,
         (SELECT count(*) FROM analytics_events e WHERE e.restaurant_id = $1 AND e.name = 'directions_open'
            AND e.occurred_at > now() - ($2 || ' days')::interval)::int AS directions,
         (SELECT count(*) FROM visits v WHERE v.restaurant_id = $1
            AND v.status IN ('confirmed','prompted','reviewed')
            AND v.first_seen_at > now() - ($2 || ' days')::interval)::int AS confirmed_visits`,
      [params.id, days]);
    return { days, ...x };
  }, { auth: true, role: "admin" });

  // Cron'u elle tetikleme — geliştirme ve doğrulama için.
  r.post("/api/admin/jobs/:name", async ({ db, params }) => {
    if (params.name === "visit-prompts") return visitReviewPrompts(db);
    if (params.name === "rollups") {
      const { runRollups } = await import("../analytics/rollup.js");
      return { blocks: await runRollups(db) };
    }
    if (params.name === "reengagement") {
      const { reengagement30d } = await import("../notifications/jobs.js");
      return reengagement30d(db);
    }
    throw bad("Bilinmeyen iş", 404);
  }, { auth: true, role: "admin" });

  return r;
}

// Bugünün çalışma aralığı. hours jsonb gün bazlı saklanıyor; istemciye
// "11:00 - 22:00" gibi tek satır gidiyor, kapalıysa null.
const WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function todayHours(hours) {
  if (!hours || typeof hours !== "object") return null;
  const slots = hours[WEEK[new Date().getDay()]];
  if (!Array.isArray(slots) || !slots.length) return null;
  return slots.map(([a, b]) => `${a} - ${b}`).join(", ");
}

// Veritabanı satırını istemcinin beklediği kart şekline çevirir.
// snake_case → camelCase dönüşümü tek yerde olsun diye burada.
function shapeCard(r) {
  return {
    id: r.id,
    name: r.name,
    cat: r.category,
    desc: r.description,
    addr: r.address,
    district: r.district,
    lat: r.lat, lng: r.lng,
    rating: r.rating == null ? null : Number(r.rating),
    ratingCount: r.rating_count,
    price: r.price_level ? "₺".repeat(r.price_level) : null,
    priceLevel: r.price_level,
    hours: todayHours(r.hours),
    hoursByDay: r.hours,
    tags: r.tags || [],
    gastro: r.gastro_approved,
    gastroChef: r.gastro_chef,
    dist: r.distance_m == null ? null : `${(Number(r.distance_m) / 1000).toFixed(1)} km`,
    isSuper: r.is_super ?? undefined,
    sponsored: r.sponsored ?? null,
    deckPosition: r.deckPosition,
  };
}
