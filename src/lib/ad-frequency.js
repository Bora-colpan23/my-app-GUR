// ═══════════════════════════════════════════════════════════════════════
// REKLAM SIKLIK SINIRI (frequency cap)
//
// Kural: bir kampanya aynı kullanıcıya bir kez gösterilir. Deste her
// açılışta yeniden kurulduğu için deste içi sınır yetmez — gösterilen
// kampanyalar kalıcı olarak işaretlenir ve bir daha havuza girmez.
//
// Gösterim, kart DESTEYE GİRDİĞİNDE değil EKRANDA ÜSTTE göründüğünde
// sayılır: kurulup da hiç görülmeyen bir kart, reklamverenin hakkını
// yemek olurdu.
//
// Sunucudaki karşılığı campaign_impressions tablosudur; oradaki tekillik
// (user_id, campaign_id) kısıtıyla korunur.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

const KEY = "gur.adImpressions";

const listeners = new Set();
function emit() {
  for (const l of listeners) l();
  try { window.dispatchEvent(new Event("gur:ads")); } catch { /* SSR */ }
}
function subscribe(fn) {
  listeners.add(fn);
  const onExternal = () => fn();
  window.addEventListener("storage", onExternal);
  window.addEventListener("gur:ads", onExternal);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onExternal);
    window.removeEventListener("gur:ads", onExternal);
  };
}

// useSyncExternalStore anlık görüntünün referansını sabit ister.
let snap = { raw: null, value: [] };
export function seenCampaigns() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return snap.value; }
  if (snap.raw === raw) return snap.value;
  let list = [];
  try { list = JSON.parse(raw || "[]"); } catch { list = []; }
  snap = { raw, value: Array.isArray(list) ? list : [] };
  return snap.value;
}

/** Kampanya bu kullanıcıya gösterildi. Aynı kimlik ikinci kez eklenmez. */
export function markShown(campaignId) {
  if (!campaignId) return;
  const list = seenCampaigns();
  if (list.includes(String(campaignId))) return;
  try { localStorage.setItem(KEY, JSON.stringify([...list, String(campaignId)])); } catch { /* depolama kapalı */ }
  emit();
}

/** Yalnız geliştirme/önizleme için: sınırı sıfırla. */
export function resetImpressions() {
  try { localStorage.removeItem(KEY); } catch { /* yok say */ }
  emit();
}

export function useSeenCampaigns() {
  return useSyncExternalStore(subscribe, seenCampaigns, () => []);
}
