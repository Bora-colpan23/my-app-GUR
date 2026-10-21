// ═══════════════════════════════════════════════════════════════════════
// API istemcisi + mod ölçümü — web'deki src/lib/api.js'in mobil eşi
//
// İKİ MOD, AYNI KURAL:
//   CANLI — sunucu ayakta. Kimlik, deste, kaydırma ve yorum PostgreSQL'e
//           yazılır; uygulama, Doyurucu ve yönetici paneli aynı veriyi
//           görür.
//   YEREL — sunucu yok (uçuş modu, henüz dağıtılmamış ortam). Aynı
//           akışlar AsyncStorage üzerinde yürür, hiçbir ekran kilitlenmez.
//
// Başarısız yoklama KALICI DEĞİL: sunucu geç açılırsa arkadan 3/8/20
// saniyede üç kez tekrar yoklanır ve başarınca önbellek de tazelenir.
// Web tarafında yalnızca `mode`u güncellemek yetmemişti (ölçüldü: rozet
// YEREL'de kalıyordu) — aynı hatayı burada da yapmıyoruz.
// ═══════════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Adres sırası: derleme ortamı değişkeni → app.json/extra → yok.
// Mobil uygulamada göreli "/api" diye bir şey YOK; mutlak adres şart.
export const TABAN = (
  process.env.EXPO_PUBLIC_API_URL ||
  Constants?.expoConfig?.extra?.apiUrl ||
  ''
).replace(/\/+$/, '');

const JETON_ANAHTARI = 'gur.token';

let mod = 'bilinmiyor';            // "bilinmiyor" | "canli" | "yerel"
let bilgi = null;
let yoklama = null;
let jeton = null;
const dinleyiciler = new Set();

const duyur = () => { for (const d of dinleyiciler) d(); };
export function modaAbone(fn) { dinleyiciler.add(fn); return () => dinleyiciler.delete(fn); }
export function apiModu() { return mod; }
export function canliMi() { return mod === 'canli'; }
export function sunucuBilgisi() { return bilgi; }

export async function jetonuYukle() {
  try { jeton = await AsyncStorage.getItem(JETON_ANAHTARI); } catch { jeton = null; }
  return jeton;
}
export function jetonuAl() { return jeton; }
async function jetonuYaz(t) {
  jeton = t || null;
  try {
    if (t) await AsyncStorage.setItem(JETON_ANAHTARI, t);
    else await AsyncStorage.removeItem(JETON_ANAHTARI);
  } catch { /* depo yoksa oturum yalnızca bellekte kalır */ }
}

function zamanAsimli(ms) {
  // AbortSignal.timeout Hermes'te var; yine de elle kuruyoruz ki eski
  // çalışma zamanlarında da çalışsın.
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, bitir: () => clearTimeout(t) };
}

async function yokla() {
  if (!TABAN) throw new Error('adres yok');
  const z = zamanAsimli(2500);
  try {
    const r = await fetch(`${TABAN}/api/health`, { signal: z.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { z.bitir(); }
}

const TEKRAR_MS = [3000, 8000, 20000];
function arkadanTekrarla(i = 0) {
  if (i >= TEKRAR_MS.length) return;
  setTimeout(() => {
    if (mod === 'canli') return;
    yokla()
      .then(b => {
        mod = 'canli'; bilgi = b;
        yoklama = Promise.resolve({ mod, bilgi });   // ÖNBELLEĞİ DE TAZELE
        duyur();
      })
      .catch(() => arkadanTekrarla(i + 1));
  }, TEKRAR_MS[i]);
}

export function modaKarar() {
  if (yoklama) return yoklama;
  yoklama = yokla()
    .then(b => { mod = 'canli'; bilgi = b; duyur(); return { mod, bilgi }; })
    .catch(() => {
      mod = 'yerel'; duyur();
      arkadanTekrarla(0);
      // BAŞARISIZLIK ÖNBELLEĞE ALINMIYOR: tekrar yoklama başarırsa
      // yukarıdaki satır sözü yerine koyuyor.
      yoklama = null;
      return { mod, bilgi: null };
    });
  return yoklama;
}

/** Sunucuya istek. Yerel moddaysa ya da istek düşerse null döner —
 *  çağıran yer kendi yerel yolunu kullanır, ekran kilitlenmez. */
export async function istek(yol, { method = 'GET', body, timeout = 8000 } = {}) {
  if (!TABAN || mod === 'yerel') return null;
  const z = zamanAsimli(timeout);
  try {
    const r = await fetch(`${TABAN}${yol}`, {
      method,
      signal: z.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(jeton ? { Authorization: `Bearer ${jeton}` } : null),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally { z.bitir(); }
}

// ─── Kimlik ──────────────────────────────────────────────────────────
export async function girisYap({ email, password, name }) {
  const c = await istek('/api/auth/password', { method: 'POST', body: { email, password, name } });
  if (c?.token) await jetonuYaz(c.token);
  return c;
}
export async function cikisYap() { await jetonuYaz(null); }
