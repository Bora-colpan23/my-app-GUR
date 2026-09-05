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

let state = { lat: null, lng: null, accuracyM: null, source: "none", error: null };
const listeners = new Set();
function emit() { for (const l of listeners) l(); }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function snapshot() { return state; }

function set(patch) {
  state = { ...state, ...patch };
  emit();
}

/** Sıralamada kullanılacak nokta: cihaz konumu varsa o, yoksa varsayılan. */
export function origin() {
  return state.source === "device"
    ? { lat: state.lat, lng: state.lng }
    : { lat: DEFAULT_ORIGIN.lat, lng: DEFAULT_ORIGIN.lng };
}

/** Konum gerçekten cihazdan mı geliyor — arayüz bunu dürüstçe söylemeli. */
export function isPrecise() { return state.source === "device"; }

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
          accuracyM: pos.coords.accuracy, source: "device", error: null,
        });
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
