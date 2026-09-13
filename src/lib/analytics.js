// ═══════════════════════════════════════════════
// ÖLÇÜMLEME — rıza kapılı GA4
//
// Kurulum: MEASUREMENT_ID'ye GA4 ölçüm kimliğinizi (G-XXXXXXXXXX) yazın.
// Kimlik boş kaldığı sürece hiçbir istek yapılmaz, hiçbir script yüklenmez.
//
// KVKK sıralaması bilinçli: kullanıcı "Kabul et" demeden gtag.js sayfaya
// hiç eklenmez. Reddedince de sonradan bir daha sorulmaz.
// ═══════════════════════════════════════════════
export const MEASUREMENT_ID = "";           // örn. "G-XXXXXXXXXX"

const KEY = "gur.consent";                  // "granted" | "denied"

export function getConsent() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setConsent(value) {
  try { localStorage.setItem(KEY, value); } catch { /* depolama kapalı */ }
  if (value === "granted") init();
}

let started = false;

function init() {
  if (started || !MEASUREMENT_ID || typeof document === "undefined") return;
  started = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args) => { window.dataLayer.push(args); };
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, {
    anonymize_ip: true,          // IP maskeleme — gizlilik metninde taahhüt edildi
    allow_google_signals: false, // reklam kimliğiyle eşleştirme yok
    allow_ad_personalization_signals: false,
  });
}

// Sayfa ilk açıldığında: yalnızca daha önce rıza verilmişse başlat
export function initAnalytics() {
  if (getConsent() === "granted") init();
}

// Olay gönderimi — rıza yoksa sessizce hiçbir şey yapmaz
export function track(name, params = {}) {
  if (!started || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

// ═══════════════════════════════════════════════════════════════════════
// Ürün olay akışı.
//
// Sunucudaki analytics_events tablosuna gidecek olayların istemci tarafı.
// Rıza yoksa hiçbir şey gönderilmez; olaylar yalnızca tamponda toplanır ve
// sayfa kapanınca kaybolur — böylece rıza sonradan verilirse geçmiş veri
// sızmaz.
// ═══════════════════════════════════════════════════════════════════════

const buffer = [];
const MAX_BUFFER = 200;

/** Ürün olayı. name: swipe_right, detail_open, directions_open ... */
export function trackEvent(name, props = {}) {
  const event = { name, props, at: Date.now() };
  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  // GA4 yalnızca rıza varsa ve ölçüm kimliği tanımlıysa çalışır (track()
  // ikisini de kontrol eder), sunucuya gönderim ayrı bir uçtan yapılır.
  track(name, props);
  return event;
}

/** Tamponu okur — sunucu ucuna toplu gönderim için. */
export function drainEvents() {
  return buffer.splice(0, buffer.length);
}

export function peekEvents() {
  return buffer.slice();
}
