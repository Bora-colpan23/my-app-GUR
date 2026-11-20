// ═══════════════════════════════════════════════════════════════════════
// YÖNETİCİ PANELİ → SUPABASE
//
// Panelin ŞU AN tek canlı arka ucu Node sunucusu (lib/api.js). Bu modül
// aynı işleri Supabase'e yapıyor: kimlik Supabase Auth, yetki veritabanında
// (platform_admins → is_admin()), yazma yolu gur_admin_* RPC'leri. Kural
// mobildekiyle aynı: istemciden kimlik/yetki GELMEZ, yönetici olmayan
// hesap her RPC'de 42501 alır.
//
// Açılış koşulu iki build değişkeni: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
// (yalnızca anon anahtar — servis anahtarı hiçbir pakete girmez). Yoksa
// panel eskisi gibi Node/yerel modda çalışır.
//
// Artifact önizlemesinde HİÇ devrede değil (`__GUR_ARTIFACT__`): tek dosyalık
// önizleme sunucusuzdur ve supabase-js'i pakete katmak dosyayı boşuna şişirir.
// ═══════════════════════════════════════════════════════════════════════

const URL = import.meta.env?.VITE_SUPABASE_URL;
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const enabled = !__GUR_ARTIFACT__ && Boolean(URL && KEY);

// Artifact derlemesinde `__GUR_ARTIFACT__` true'ya katlanır ve dinamik içe
// aktarma ağaçtan silinir.
const yukle = __GUR_ARTIFACT__ ? null : () => import("@supabase/supabase-js");

let istemci = null;
function client() {
  if (!enabled || !yukle) return Promise.reject(new Error("Supabase bağlantısı tanımlı değil."));
  istemci ??= yukle().then(({ createClient }) => createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
            storageKey: "gur.admin.supabase" },
  }));
  return istemci;
}

function hata(e) {
  const err = new Error(e?.message || "İstek başarısız");
  err.code = e?.code;
  return err;
}

async function rpc(ad, args) {
  const c = await client();
  const { data, error } = await c.rpc(ad, args);
  if (error) throw hata(error);
  return data;
}

// ─── Oturum ───────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const c = await client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(/invalid login credentials/i.test(error.message)
      ? "E-posta ya da parola hatalı." : error.message);
  }
  // Giriş yapabilmek yönetici olmak değildir: yetkiyi veritabanı söyler.
  const me = await rpc("gur_admin_me");
  if (!me?.admin) {
    await c.auth.signOut();
    throw new Error("Bu hesap yönetici değil.");
  }
  return me;
}

/** Sayfa yenilenince oturum açık kalsın: kayıtlı oturum hâlâ yönetici mi? */
export async function resume() {
  if (!enabled) return null;
  try {
    const c = await client();
    const { data } = await c.auth.getSession();
    if (!data?.session) return null;
    const me = await rpc("gur_admin_me");
    return me?.admin ? me : null;
  } catch { return null; }
}

export async function signOut() {
  try { const c = await client(); await c.auth.signOut(); } catch { /* zaten yok */ }
}

// ─── api.js ile AYNI adlar ve şekiller ────────────────────────────────
// Panel iki arka ucu `const be = sb.enabled ? sb : api` ile seçiyor.

export const getCampaigns = () => rpc("gur_admin_campaigns");
export const patchCampaign = (id, { status, bidMinor } = {}) =>
  rpc("gur_admin_patch_campaign", { p_id: id, p_status: status ?? null, p_bid_minor: bidMinor ?? null });
export const getGrowth = (weeks = 12) => rpc("gur_admin_growth", { p_weeks: weeks });
export const getClaims = async () => ({ claims: (await rpc("gur_admin_claims")) || [] });
export const decideClaimRemote = (id, status, reason) =>
  rpc("gur_admin_decide_claim", { p_id: id, p_status: status, p_reason: reason ?? null });

// ─── Yalnızca Supabase tarafında olanlar ──────────────────────────────

export const listRestaurants = () => rpc("gur_admin_restaurants", { p_limit: 1000 });
/** patch: { active, review, gastro, gastro_chef, gastro_video } */
export const setRestaurant = (id, patch) => rpc("gur_admin_set_restaurant", { p_id: id, p_patch: patch });
export const getDistricts = () => rpc("gur_districts");
/** open = null → kayıtlı kararı sil (varsayılana dön). */
export const setDistrict = (name, open) => rpc("gur_admin_set_district", { p_name: name, p_open: open });
