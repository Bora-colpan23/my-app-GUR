// ═══════════════════════════════════════════════════════════════════════
// Google ve Apple ile giriş — istemci tarafı.
//
// Gerçek akış: SDK bir id_token döndürür, o belirteç sunucuya gönderilir,
// imza sunucuda doğrulanır (server/src/auth/social.js). İstemci belirteci
// asla kendi başına "doğrulanmış" saymaz.
//
// İstemci kimlikleri tanımlı değilken uygulama demo modunda çalışır:
// düğmeler görünür, akış sahte bir profille tamamlanır ve bunu söyler.
// ═══════════════════════════════════════════════════════════════════════

export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "";
export const APPLE_CLIENT_ID  = import.meta.env?.VITE_APPLE_SERVICE_ID || "";

export const isConfigured = { google: !!GOOGLE_CLIENT_ID, apple: !!APPLE_CLIENT_ID };

/**
 * Apple ile giriş düğmesi yalnızca Apple cihazlarda gösterilir.
 * Kullanıcının sahip olmadığı bir hesap türünü sunmak, giriş ekranını
 * gereksiz kalabalıklaştırıyor. (App Store kuralı da tersini istemiyor:
 * başka sosyal giriş varsa iOS'ta Apple ile giriş SUNULMAK zorunda —
 * bu yüzden iOS'ta her koşulda görünür.)
 */
export function isAppleDevice(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /iPhone|iPad|iPod|Macintosh/i.test(ua);
}

function loadScript(src, globalCheck) {
  return new Promise((resolve, reject) => {
    if (globalCheck()) return resolve();
    const s = document.createElement("script");
    s.src = src; s.async = true; s.defer = true;
    s.onload = () => (globalCheck() ? resolve() : reject(new Error("SDK yüklendi ama global yok")));
    s.onerror = () => reject(new Error("SDK yüklenemedi: " + src));
    document.head.appendChild(s);
  });
}

/** Google Identity Services — id_token döndürür. */
async function googleToken() {
  await loadScript("https://accounts.google.com/gsi/client", () => window.google?.accounts?.id);
  return new Promise((resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (res) => (res?.credential ? resolve(res.credential) : reject(new Error("Belirteç gelmedi"))),
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.prompt((n) => {
      if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) {
        reject(new Error("Google giriş penceresi açılamadı"));
      }
    });
  });
}

/** Sign in with Apple JS — id_token ve ilk girişte ad döndürür. */
async function appleToken() {
  await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/tr_TR/appleid.auth.js",
    () => window.AppleID?.auth);
  window.AppleID.auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: "name email",
    redirectURI: window.location.origin,
    usePopup: true,
  });
  const res = await window.AppleID.auth.signIn();
  return {
    idToken: res.authorization?.id_token,
    // Ad YALNIZCA ilk girişte gelir. Kaçırılırsa bir daha alınamaz,
    // bu yüzden hemen sunucuya iletilir.
    displayName: res.user ? [res.user.name?.firstName, res.user.name?.lastName].filter(Boolean).join(" ") : null,
  };
}

/**
 * Giriş. Yapılandırılmışsa gerçek SDK, değilse demo profili döner.
 * exchange: (provider, { idToken, displayName }) => sunucu oturumu.
 */
export async function signIn(provider, { exchange } = {}) {
  if (provider === "google") {
    if (!isConfigured.google) return demoProfile("google");
    const idToken = await googleToken();
    return exchange ? exchange("google", { idToken }) : { provider, idToken };
  }
  if (provider === "apple") {
    if (!isConfigured.apple) return demoProfile("apple");
    const { idToken, displayName } = await appleToken();
    return exchange ? exchange("apple", { idToken, displayName }) : { provider, idToken, displayName };
  }
  throw new Error("Bilinmeyen sağlayıcı: " + provider);
}

function demoProfile(provider) {
  return {
    provider,
    demo: true,
    profile: {
      name: provider === "apple" ? "Apple Kullanıcısı" : "Google Kullanıcısı",
      email: provider === "apple" ? null : "kullanici@gmail.com",
      // Apple "e-postamı gizle" seçeneği: pazarlama e-postası bu adrese ulaşmaz
      privateRelay: provider === "apple",
    },
  };
}
