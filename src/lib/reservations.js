// ═══════════════════════════════════════════════════════════════════════
// MASA TALEPLERİ — kullanıcıdan işletmeye giden bildirim.
//
// Kullanıcı masa ayırttığında talep işletmenin panelinde (Doyurucu →
// "Masa talepleri") bekleyen bildirim olarak belirir; işletme onaylar ya
// da reddeder. Rezervasyon "ayrıldı" değil "talep edildi" olarak başlar:
// masayı verecek olan taraf işletme, uygulama değil.
//
// Sunucudaki karşılığı reservations tablosu + notifications kuyruğudur
// (server/src/notifications). Push taşıması henüz yok; orada bildirim
// konsola yazılıyor, burada panele düşüyor.
// ═══════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";

const KEY = "gur.reservations";

const listeners = new Set();
function emit() {
  for (const l of listeners) l();
  try { window.dispatchEvent(new Event("gur:reservations")); } catch { /* SSR */ }
}
function subscribe(fn) {
  listeners.add(fn);
  const onExternal = () => fn();
  window.addEventListener("storage", onExternal);
  window.addEventListener("gur:reservations", onExternal);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onExternal);
    window.removeEventListener("gur:reservations", onExternal);
  };
}

// Anlık görüntü referansı sabit kalmalı (bkz. b2b.js).
let snap = { raw: null, value: [] };
export function getReservations() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return snap.value; }
  if (snap.raw === raw) return snap.value;
  let list = [];
  try { list = JSON.parse(raw || "[]"); } catch { list = []; }
  snap = { raw, value: Array.isArray(list) ? list : [] };
  return snap.value;
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* depolama kapalı */ }
  emit();
}

/**
 * Yeni masa talebi. İşletmeye giden bildirim budur.
 * Dönen kayıt onay ekranında gösterilir.
 */
export function requestTable({ restaurantId, restaurantName, day, time, people, guestName, dealPct = null }) {
  const record = {
    id: `rsv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    restaurantId: String(restaurantId),
    restaurantName,
    day, time, people,
    guestName: guestName || "GUR kullanıcısı",
    dealPct,
    status: "pending",          // pending | confirmed | declined
    createdAt: Date.now(),
    seenByOwner: false,
  };
  write([record, ...getReservations()]);
  return record;
}

/**
 * İşletmenin kararı. Karar anında misafire bildirim borcu doğar:
 * guestNotified false kalır, uygulama bunu görüp haber verir ve
 * işaretler. Bayrağı burada true yapmak, uygulama kapalıyken verilen
 * kararın hiç duyulmaması demek olurdu.
 */
export function decideReservation(id, status) {
  write(getReservations().map(r => (
    r.id === id
      ? { ...r, status, decidedAt: Date.now(), seenByOwner: true, guestNotified: false }
      : r)));
}

/** Misafire henüz iletilmemiş kararlar — en yenisi başta. */
export function pendingGuestNotices() {
  return getReservations()
    .filter(r => r.status !== "pending" && !r.guestNotified)
    .sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0));
}

/** Karar misafire iletildi. */
export function markGuestNotified(id) {
  const list = getReservations();
  if (!list.some(r => r.id === id && !r.guestNotified)) return;
  write(list.map(r => (r.id === id ? { ...r, guestNotified: true } : r)));
}

/** Panel açıldığında bekleyen talepler "görüldü" işaretlenir; rozet söner. */
export function markSeen(restaurantId) {
  const list = getReservations();
  if (!list.some(r => r.restaurantId === String(restaurantId) && !r.seenByOwner)) return;
  write(list.map(r => (r.restaurantId === String(restaurantId) ? { ...r, seenByOwner: true } : r)));
}

export function forRestaurant(restaurantId) {
  return getReservations().filter(r => r.restaurantId === String(restaurantId));
}

export function useReservations() {
  return useSyncExternalStore(subscribe, getReservations, () => []);
}
