// ═══════════════════════════════════════════════════════════════════════
// Oturum belirteci.
//
// Sunucu durumu tutmadan doğrulanabilsin diye HMAC imzalı: yeniden
// başlatma oturumları düşürmüyor, ölçekte paylaşılan bir oturum deposu
// gerekmiyor. Gizli anahtar ortamdan gelir; tanımlı değilse süreç başına
// rastgele üretilir ve bu durumda belirteçler yeniden başlatmada geçersiz
// olur — geliştirmede istenen davranış, üretimde anahtar zorunlu.
// ═══════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) {
  console.warn("[auth] SESSION_SECRET tanımlı değil — belirteçler yeniden başlatmada geçersiz olacak");
}

const TTL_SECONDS = 30 * 24 * 3600;

const b64 = (buf) => Buffer.from(buf).toString("base64url");

function sign(payload) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function issueToken(userId, { role = "user" } = {}) {
  const body = b64(JSON.stringify({
    sub: userId, role, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  }));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = sign(body);
  // Sabit süreli karşılaştırma: uzunluk farkı da zamanlama sızıntısı olmasın
  const a = Buffer.from(mac || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}

/** Authorization başlığından kullanıcı. Yoksa null — 401 kararı çağırana ait. */
export function userFromRequest(req) {
  const raw = req.headers.authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : null;
  return token ? verifyToken(token) : null;
}
