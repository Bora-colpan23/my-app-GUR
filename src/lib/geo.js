// ═══════════════════════════════════════════════════════════════════════
// KULLANICI KONUMU — keşif akışının başlangıç noktası.
//
// Amaç ziyaret doğrulaması DEĞİL (o src/lib/visits.js, çok daha sıkı
// kurallarla çalışır). Buradaki konum yalnızca "hangi mekan bana yakın"
// sorusunu cevaplamak için, kaba doğrulukta kullanılır.
//
// Gizlilik: ham koordinat sunucuya gönderilmez, yalnızca sıralama için
// bellekte tutulur. Kullanıcı izin vermediyse İstanbul merkezine düşeriz
// ve arayüz bunu açıkça söyler — "yakınında" derken neresi olduğunu
// bilmediğimizi saklamak, yanlış sıralamadan daha kötü.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

/** İzin yokken kullanılan varsayılan başlangıç: İstanbul merkezi. */
export const DEFAULT_ORIGIN = { lat: 41.0082, lng: 28.9784, label: "İstanbul merkezi" };

// ── İSTANBUL İLÇELERİ ────────────────────────────────────────────────────
// İzin vermeyen kullanıcı da "yakınımdakiler" görebilmeli. Ters coğrafi
// kodlama için ağa çıkmaya değmez: kaba merkez koordinatı sıralama için
// yeterli, kullanıcı zaten hangi ilçeyi seçtiğini biliyor.
export const DISTRICTS = [
  { name: "Kadıköy",     lat: 40.9906, lng: 29.0245 },
  { name: "Beşiktaş",    lat: 41.0430, lng: 29.0094 },
  { name: "Beyoğlu",     lat: 41.0361, lng: 28.9770 },
  { name: "Şişli",       lat: 41.0602, lng: 28.9877 },
  { name: "Üsküdar",     lat: 41.0227, lng: 29.0153 },
  { name: "Fatih",       lat: 41.0186, lng: 28.9396 },
  { name: "Ataşehir",    lat: 40.9923, lng: 29.1274 },
  { name: "Sarıyer",     lat: 41.1670, lng: 29.0575 },
  { name: "Bakırköy",    lat: 40.9819, lng: 28.8772 },
  { name: "Maltepe",     lat: 40.9351, lng: 29.1550 },
  { name: "Kartal",      lat: 40.8886, lng: 29.1903 },
  { name: "Beylikdüzü",  lat: 41.0016, lng: 28.6414 },
];

// Kullanıcının kararı yenilemede unutulmamalı: her açılışta yeniden izin
// sormak reddedilme oranını yükseltiyor.
const STORE = "gur.geo.choice";
function load() {
  try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch { return null; }
}
function save(v) {
  try { v ? localStorage.setItem(STORE, JSON.stringify(v)) : localStorage.removeItem(STORE); } catch { /* yoksay */ }
}

let state = { lat: null, lng: null, accuracyM: null, source: "none", error: null, label: null };
const listeners = new Set();
function emit() { for (const l of listeners) l(); }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function snapshot() { return state; }

function set(patch) {
  state = { ...state, ...patch };
  emit();
}

/** Sıralamada kullanılacak nokta: cihaz ya da elle seçilen ilçe, yoksa varsayılan. */
export function origin() {
  return state.source === "device" || state.source === "manual"
    ? { lat: state.lat, lng: state.lng }
    : { lat: DEFAULT_ORIGIN.lat, lng: DEFAULT_ORIGIN.lng };
}

/** Konum gerçekten cihazdan mı geliyor — arayüz bunu dürüstçe söylemeli. */
export function isPrecise() { return state.source === "device"; }

/** Bir başlangıç noktamız var mı (cihaz ya da elle seçim). */
export function hasOrigin() { return state.source === "device" || state.source === "manual"; }

/** Elle seçilen ilçe: izin verilmese de "yakınımdakiler" çalışsın. */
export function setManualOrigin(district) {
  const d = typeof district === "string" ? DISTRICTS.find(x => x.name === district) : district;
  if (!d) return;
  set({ lat: d.lat, lng: d.lng, accuracyM: null, source: "manual", error: null, label: d.name });
  save({ mode: "manual", name: d.name });
}

/** Kullanıcı konum sorusunu gördü mü — giriş sonrası bir kez sorulur. */
export function consentAsked() { return !!load(); }
/** "Şimdi değil" de bir karardır: tekrar tekrar sorulmaz. */
export function markConsentSkipped() { save({ mode: "skipped" }); }
export function clearChoice() { save(null); set({ source: "none", error: null, label: null }); }

/** Tarayıcının izin durumu — "reddedildi" ise arayüz ayarlara yönlendirir. */
export async function permissionState() {
  try {
    const st = await navigator.permissions?.query({ name: "geolocation" });
    return st?.state || "unknown";      // granted | denied | prompt
  } catch { return "unknown"; }
}

// Açılışta kayıtlı seçim geri yüklenir.
(function restore() {
  const c = load();
  if (c?.mode === "manual") {
    const d = DISTRICTS.find(x => x.name === c.name);
    if (d) state = { ...state, lat: d.lat, lng: d.lng, source: "manual", label: d.name };
  }
})();

let pending = null;

/**
 * Konumu ister. `silent` true iken tarayıcı istemi ancak izin ZATEN
 * verilmişse açılır: uygulama açılışında gerekçesiz izin istemi, reddedilme
 * oranını yükseltiyor ve reddedildikten sonra geri dönüşü zor.
 */
export async function requestLocation({ silent = false } = {}) {
  if (pending) return pending;
  if (!("geolocation" in navigator)) {
    set({ source: "none", error: "unsupported" });
    return null;
  }
  if (silent) {
    try {
      const st = await navigator.permissions?.query({ name: "geolocation" });
      if (st && st.state !== "granted") return null;   // sessiz mod: istem açma
    } catch { return null; }                            // permissions API yoksa sorma
  }
  pending = new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        set({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy, source: "device", error: null, label: null,
        });
        save({ mode: "device" });
        pending = null;
        resolve(origin());
      },
      err => {
        set({ source: "none", error: err?.code === 1 ? "denied" : "unavailable" });
        pending = null;
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8000 }
    );
  });
  return pending;
}

/** Önizlemede test edilebilmesi için: konumu elle ayarla. */
export function setDemoOrigin(lat, lng) {
  set({ lat, lng, accuracyM: 50, source: "device", error: null });
}

export function useUserLocation() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
