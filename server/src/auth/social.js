// ═══════════════════════════════════════════════════════════════════════
// Google ve Apple ile giriş — kimlik belirtecinin sunucuda doğrulanması.
//
// İstemcinin gönderdiği id_token'a asla olduğu gibi güvenilmez: imza,
// issuer, audience ve süre burada doğrulanır. Doğrulama olmadan herkes
// kendi ürettiği bir JWT ile başkasının hesabına girebilir.
// ═══════════════════════════════════════════════════════════════════════

import { createPublicKey, createVerify } from "node:crypto";

const JWKS = {
  google: "https://www.googleapis.com/oauth2/v3/certs",
  apple:  "https://appleid.apple.com/auth/keys",
};
const ISSUERS = {
  google: ["https://accounts.google.com", "accounts.google.com"],
  apple:  ["https://appleid.apple.com"],
};

// Anahtarlar nadiren döner; her istekte JWKS çekmek hem yavaş hem gereksiz.
const keyCache = new Map();   // provider → { at, keys }
const KEY_TTL_MS = 60 * 60 * 1000;

async function jwks(provider) {
  const hit = keyCache.get(provider);
  if (hit && Date.now() - hit.at < KEY_TTL_MS) return hit.keys;
  const res = await fetch(JWKS[provider], { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`JWKS alınamadı (${provider}): ${res.status}`);
  const { keys } = await res.json();
  keyCache.set(provider, { at: Date.now(), keys });
  return keys;
}

const b64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/**
 * id_token'ı doğrular ve talepleri döndürür.
 * audience: Google istemci kimliği ya da Apple servis/bundle kimliği.
 */
export async function verifyIdToken(provider, idToken, { audience }) {
  const parts = String(idToken).split(".");
  if (parts.length !== 3) throw new Error("Bozuk belirteç");

  const header = JSON.parse(b64url(parts[0]).toString("utf8"));
  const claims = JSON.parse(b64url(parts[1]).toString("utf8"));

  if (header.alg !== "RS256") throw new Error(`Desteklenmeyen algoritma: ${header.alg}`);

  const key = (await jwks(provider)).find(k => k.kid === header.kid);
  if (!key) throw new Error("Belirtecin anahtarı JWKS'te yok");

  const ok = createVerify("RSA-SHA256")
    .update(`${parts[0]}.${parts[1]}`)
    .verify(createPublicKey({ key, format: "jwk" }), b64url(parts[2]));
  if (!ok) throw new Error("İmza doğrulanamadı");

  if (!ISSUERS[provider].includes(claims.iss)) throw new Error(`Beklenmeyen issuer: ${claims.iss}`);

  // aud dizi de olabilir (Apple çoklu istemci).
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const allowed = Array.isArray(audience) ? audience : [audience];
  if (!auds.some(a => allowed.includes(a))) throw new Error("Beklenmeyen audience");

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now - 60) throw new Error("Belirtecin süresi dolmuş");
  if (claims.iat && claims.iat > now + 300) throw new Error("Belirteç gelecekten geliyor");

  return claims;
}

/**
 * Doğrulanmış taleplerden kullanıcıyı bulur ya da açar.
 *
 * Apple özel durumları:
 *  - Ad yalnızca İLK girişte gelir; sonraki girişlerde yok. İstemci ilk
 *    yanıttaki adı gönderirse burada kullanılır, sonra bir daha sorulmaz.
 *  - "E-postamı gizle" seçilirse adres privaterelay.appleid.com'dur.
 *    Bu adrese pazarlama e-postası göndermek sessizce başarısız olur,
 *    bu yüzden işaretliyoruz.
 */
export async function upsertSocialUser(db, provider, claims, { displayName } = {}) {
  const subject = claims.sub;
  const email = claims.email ? String(claims.email).toLowerCase() : null;
  const isPrivateRelay = !!email && email.endsWith("@privaterelay.appleid.com");

  const { rows: [identity] } = await db.query(
    `SELECT user_id FROM auth_identities WHERE provider = $1 AND subject = $2`,
    [provider, subject]
  );
  if (identity) {
    await db.query(`UPDATE users SET last_seen_at = now() WHERE id = $1`, [identity.user_id]);
    return { userId: identity.user_id, created: false };
  }

  // Aynı e-postayla parola hesabı varsa yeni hesap açmak yerine bağla.
  let userId = null;
  if (email && !isPrivateRelay) {
    const { rows: [existing] } = await db.query(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]);
    userId = existing?.id ?? null;
  }

  if (!userId) {
    const name = displayName || claims.name ||
      (claims.given_name ? `${claims.given_name} ${claims.family_name || ""}`.trim() : null) ||
      (email ? email.split("@")[0] : "GUR kullanıcısı");
    const { rows: [created] } = await db.query(
      `INSERT INTO users (email, display_name, avatar_url)
       VALUES ($1,$2,$3) RETURNING id`,
      [isPrivateRelay ? null : email, name, claims.picture ?? null]
    );
    userId = created.id;
  }

  await db.query(
    `INSERT INTO auth_identities (user_id, provider, subject, email_at_login, is_private_relay)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (provider, subject) DO NOTHING`,
    [userId, provider, subject, email, isPrivateRelay]
  );

  return { userId, created: true };
}

/**
 * Uçtan uca giriş: belirteci doğrula → kullanıcıyı aç/bul → oturum ver.
 * issueSession dışarıdan gelir (JWT, cookie, ne kullanılıyorsa).
 */
export async function signInWithProvider(db, provider, { idToken, displayName }, { audience, issueSession }) {
  const claims = await verifyIdToken(provider, idToken, { audience });
  const { userId, created } = await upsertSocialUser(db, provider, claims, { displayName });
  return { ...(await issueSession(userId)), userId, created, provider };
}
