// Parola özeti — scrypt. Kütüphane eklemeden, Node'un kendi KDF'siyle.
// Format: scrypt$N$r$p$tuz$özet — parametreler özetin içinde saklanıyor ki
// ileride maliyet artırıldığında eski özetler doğrulanmaya devam etsin.
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = await derive(plain, salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p });
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(plain, stored) {
  if (typeof stored !== "string" || !stored.startsWith("scrypt$")) return false;
  const [, N, r, p, salt, key] = stored.split("$");
  const expected = Buffer.from(key, "base64");
  const actual = await derive(plain, Buffer.from(salt, "base64"), expected.length,
    { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
