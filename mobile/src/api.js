// ═══════════════════════════════════════════════════════════════════════
// SUNUCU KATMANI (Supabase) + mod ölçümü — web'deki src/lib/api.js'in mobil eşi
//
// İKİ MOD, AYNI KURAL:
//   CANLI — Supabase ayakta. Kimlik, kaydırma, favori, rıza, masa talebi
//           PostgreSQL'e yazılır; web, işletme ve yönetici yüzeyleri aynı
//           veriyi görür.
//   YEREL — Supabase bağlı değil ya da ulaşılamıyor (uçuş modu, henüz
//           `npm run supabase:kur` çalıştırılmamış derleme). Aynı akışlar
//           AsyncStorage üzerinde yürür, hiçbir ekran kilitlenmez.
//
// Başarısız yoklama KALICI DEĞİL: sunucu geç açılırsa arkadan 3/8/20
// saniyede üç kez tekrar yoklanır ve başarınca önbellek de tazelenir.
// (Web tarafında yalnızca `mode`u güncellemek yetmemişti: rozet YEREL'de
// kalıyordu — aynı hatayı burada da yapmıyoruz.)
//
// SORUMLULUK SINIRI: bu dosya yalnızca TAŞIMA — hangi kural nerede çalışır
// sorusunun cevabı SQL tarafında (kota, ücretlendirme, ziyaret doğrulama,
// masa talebi kapısı: supabase/migrations/…_gur_rpc.sql). Burada kural
// yok; sunucu "hayır" derse mesajı olduğu gibi (Türkçe) yüzeye çıkar.
// Yerel durumla birleştirme senkron.js'te.
// ═══════════════════════════════════════════════════════════════════════

import { supabase, supabaseHazir } from './supabase.js';

let mod = 'bilinmiyor';            // "bilinmiyor" | "canli" | "yerel"
let bilgi = null;
let yoklama = null;
let oturum = null;                 // supabase oturumu (bellekte; kalıcılığı supabase-js yapar)
const dinleyiciler = new Set();

const duyur = () => { for (const d of dinleyiciler) d(); };
export function modaAbone(fn) { dinleyiciler.add(fn); return () => dinleyiciler.delete(fn); }
export function apiModu() { return mod; }
export function canliMi() { return mod === 'canli'; }
export function sunucuBilgisi() { return bilgi; }
/** Bu derlemeye Supabase adresi/anahtarı verilmiş mi (bağlı olup olmadığından bağımsız). */
export function sunucuTanimli() { return supabaseHazir; }
export function oturumVar() { return !!oturum; }

function zamanAsimli(ms) {
  // AbortSignal.timeout Hermes'te var; yine de elle kuruyoruz ki eski
  // çalışma zamanlarında da çalışsın.
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, bitir: () => clearTimeout(t) };
}

// ─── Hata mesajları ──────────────────────────────────────────────────
// Supabase Auth İngilizce döner; kullanıcıya Türkçe ve eyleme dönük
// söyleriz. Bilinmeyen mesaj (örn. RPC'lerimizin kendi Türkçe mesajı)
// OLDUĞU GİBİ geçer — sunucu "bu mekân sahiplenmedi" diyorsa onu yazarız.
export function hataMetni(e) {
  const m = String(e?.message || e || '');
  if (/invalid login credentials/i.test(m)) return 'E-posta ya da parola hatalı.';
  if (/user already registered|already been registered/i.test(m)) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.';
  if (/email not confirmed/i.test(m)) return 'E-postanı doğrulaman gerekiyor. Gelen kutundaki bağlantıya dokun, sonra giriş yap.';
  if (/rate limit|too many requests|over_.*_rate_limit/i.test(m) || e?.status === 429) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
  if (/password should be at least|weak password/i.test(m)) return 'Parola çok zayıf. En az 6 karakter kullan.';
  if (/unable to validate email|invalid.*email/i.test(m)) return 'Geçerli bir e-posta yaz.';
  if (/network request failed|failed to fetch|aborted|fetch failed/i.test(m)) return 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.';
  return m || 'Bir şeyler ters gitti.';
}

// ─── Mod ölçümü ──────────────────────────────────────────────────────

async function yokla() {
  if (!supabase) throw new Error('adres yok');
  const z = zamanAsimli(2500);
  try {
    const { data, error } = await supabase.rpc('gur_health').abortSignal(z.signal);
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error('sağlıksız');
    return data;
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
      if (supabase) arkadanTekrarla(0);
      // BAŞARISIZLIK ÖNBELLEĞE ALINMIYOR: tekrar yoklama başarırsa
      // yukarıdaki satır sözü yerine koyuyor.
      yoklama = null;
      return { mod, bilgi: null };
    });
  return yoklama;
}

// ─── Oturum ──────────────────────────────────────────────────────────

let oturumDinleyicileri = new Set();
/** Oturum kapandığında (süre doldu / başka yerden çıkış) çağrılır. */
export function oturumKapandiAbone(fn) { oturumDinleyicileri.add(fn); return () => oturumDinleyicileri.delete(fn); }

let oturumBaglandi = false;
/** Kalıcı oturumu yükler ve değişimleri dinlemeye başlar. Birden çok çağrı güvenli. */
export async function oturumuYukle() {
  if (!supabase) return null;
  if (!oturumBaglandi) {
    oturumBaglandi = true;
    supabase.auth.onAuthStateChange((olay, o) => {
      const onceki = oturum;
      oturum = o || null;
      if (olay === 'SIGNED_OUT' && onceki) for (const f of oturumDinleyicileri) f();
    });
  }
  try { oturum = (await supabase.auth.getSession()).data.session || null; } catch { oturum = null; }
  return oturum;
}

const profilden = (u) => ({
  ad: u?.user_metadata?.name || (u?.email || '').split('@')[0] || 'GUR kullanıcısı',
  email: u?.email || '',
});

/**
 * Giriş ya da kayıt. Dönüş:
 *   null                              → YEREL mod (çağıran formaliteyle sürer)
 *   { kullanici }                     → oturum açıldı
 *   { dogrulamaBekliyor: true }       → hesap açıldı, e-posta doğrulaması bekleniyor
 *   { hata }                          → Türkçe sebep
 * `riza`: kayıttan ÖNCE verilen ölçümleme kararı ("kabul" | "ret" | null);
 * KVKK gereği kayıt anında profile yazılır, sonradan değişebilir.
 */
export async function girisYap({ email, password, name, kayit = false, riza = null }) {
  if (!supabase || mod !== 'canli') return null;
  try {
    if (kayit) {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name, analytics_optin: riza === 'kabul' } },
      });
      if (error) return { hata: hataMetni(error) };
      if (!data.session) return { dogrulamaBekliyor: true };
      oturum = data.session;
      return { kullanici: profilden(data.user) };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { hata: hataMetni(error) };
    oturum = data.session;
    return { kullanici: profilden(data.user) };
  } catch (e) {
    return { hata: hataMetni(e) };
  }
}

export async function cikisYap() {
  if (!supabase) return;
  try { await supabase.auth.signOut(); } catch { /* ağ yoksa bile yerel oturum silinir */ }
  oturum = null;
}

// ─── RPC ─────────────────────────────────────────────────────────────

/** @returns {Promise<{veri:any, hata:string|null, atlandi?:boolean}>} */
async function rpc(ad, args = {}, { timeout = 8000, oturumGerekli = false } = {}) {
  if (!supabase) return { veri: null, hata: null, atlandi: true };
  if (mod === 'bilinmiyor') await modaKarar();
  if (mod === 'yerel') return { veri: null, hata: null, atlandi: true };
  if (oturumGerekli && !oturum) return { veri: null, hata: null, atlandi: true };
  const z = zamanAsimli(timeout);
  try {
    const { data, error } = await supabase.rpc(ad, args).abortSignal(z.signal);
    if (error) return { veri: null, hata: hataMetni(error) };
    return { veri: data, hata: null };
  } catch (e) {
    return { veri: null, hata: hataMetni(e) };
  } finally { z.bitir(); }
}

const YON = { sag: 'right', sol: 'left', yukari: 'up' };

/** Yayındaki mekân havuzu (kart şekli). Sunucu yoksa null → çağıran tohum listeye düşer. */
export async function restoranlariGetir({ limit = 300 } = {}) {
  const { veri } = await rpc('gur_restaurants', { p_limit: limit });
  return Array.isArray(veri) ? veri : null;
}

/** Servis edilebilir kampanyalar (shared/deck.js → rankCampaigns girdisi). */
export async function kampanyalariGetir() {
  const { veri } = await rpc('gur_campaigns');
  return Array.isArray(veri) ? veri : [];
}

/** Kaydırma kararı: kayıt + kota + sponsorluysa ücretlendirme SUNUCUDA. En iyi çaba. */
export async function kaydirmayiGonder({ restaurantId, yon, kampanyaId = null, sira = null, bakmaMs = null }) {
  const { hata } = await rpc('gur_record_swipe', {
    p_restaurant_id: String(restaurantId), p_direction: YON[yon],
    p_campaign_id: kampanyaId, p_deck_position: sira, p_dwell_ms: bakmaMs,
  }, { oturumGerekli: true });
  return !hata;
}

export async function gosterimYaz({ kampanyaId, restaurantId, sira = null }) {
  await rpc('gur_log_impression', {
    p_campaign_id: kampanyaId, p_restaurant_id: String(restaurantId), p_deck_position: sira,
  }, { oturumGerekli: true });
}

/** Favoriden çıkarma: kayıtlı yer silinir (RLS: yalnızca kendi satırı). */
export async function favoriKaldir(restaurantId) {
  if (!supabase || mod !== 'canli' || !oturum) return false;
  try {
    const { error } = await supabase.from('saved_places').delete().eq('restaurant_id', String(restaurantId));
    return !error;
  } catch { return false; }
}

/** Hesaptaki kayıtlı yerler: { id, super }[] — yoksa null. */
export async function kayitlilariGetir() {
  const { veri } = await rpc('gur_saved', {}, { oturumGerekli: true });
  return Array.isArray(veri) ? veri.map(k => ({ id: String(k.id), super: !!k.isSuper })) : null;
}

/** Cihazdaki favorileri hesaba ekler (kotaya/ücretlendirmeye dokunmaz). */
export async function kayitlilariEsitle(ids, superIds) {
  const { hata } = await rpc('gur_sync_saved', {
    p_ids: ids.map(String), p_super_ids: superIds.map(String),
  }, { oturumGerekli: true, timeout: 15000 });
  return !hata;
}

export async function rizaGonder(kabul) {
  await rpc('gur_set_consent', { p_analytics: !!kabul }, { oturumGerekli: true });
}

/** Masa talebi. Sahiplenmemiş mekânda SUNUCU reddeder; mesaj kullanıcıya aynen gider. */
export async function masaAyirt({ restaurantId, kisi = 2 }) {
  const { veri, hata, atlandi } = await rpc('gur_reserve', {
    p_restaurant_id: String(restaurantId), p_party_size: kisi,
  }, { oturumGerekli: true });
  if (atlandi) return { atlandi: true };
  return hata ? { hata } : { id: veri };
}

/** Hesabı ve sunucudaki her şeyi siler (tek onay). Başarısızsa çağıran silmeyi DURDURUR. */
export async function hesabiSil() {
  if (!supabase || mod !== 'canli' || !oturum) return { atlandi: true };
  const { hata } = await rpc('gur_delete_me', {}, { oturumGerekli: true, timeout: 15000 });
  if (hata) return { hata };
  await cikisYap();
  return { ok: true };
}
