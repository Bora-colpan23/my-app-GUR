import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useClaims, decideClaim, useOwnerProfiles, ownerLogo } from '../lib/b2b.js';

import * as api from '../lib/api.js';
import { motion, AnimatePresence } from 'motion/react';
import { isServiceOpen, setServiceOpen, setServiceOpenFor, serviceGateReason, closedServiceCount, usePlatformSettings, toggleSetting, setStoreFeature, setRestaurantHidden, isRestaurantHidden, FEATURES, PER_STORE_FEATURES, SERVICE_GATES } from '../lib/platform.js';
import * as pricing from '../lib/pricing.js';
import { ASSIGNABLE, badgesOf, toggleBadge, useBadgeMap } from '../lib/badges.js';
import { channelOf, inviteOf, sendInvite, useInvites } from '../lib/invites.js';
import { useModeration, pendingChanges, pendingVenues, approveChange, rejectChange, decideVenue } from '../lib/moderation.js';
import { useRequests, openRequests, requestFor, markQuoted, close as closeRequest, unseenCount, markAllSeen } from '../lib/requests.js';
import { useCreatives, SLOTS, listFor, addCreative, removeCreative, toggleLive, liveCount } from '../lib/creatives.js';
import { TEMPLATE_COLUMNS, templateHeaderLine, downloadTemplate, parseRestaurantFile } from '../lib/import-restaurants.js';
import {
  AD_PRODUCTS, AD_KEYS, useAdSlots, priceOf, setPrice, adminBook, decideBooking,
  pendingBookings, pendingBookingCount, dayState, monthGrid, endOf, prettyDay, gunFarki,
  today as adToday, WEEKDAYS_TR as AD_WEEKDAYS, MONTHS_TR as AD_MONTHS,
} from '../lib/adslots.js';
import {
  useMedia, KINDS as MEDIA_KINDS, listMedia, pendingAll as pendingMedia,
  pendingCount as mediaPendingCount, decideMedia, removeMedia,
  isVideo as mediaIsVideo, sizeLabel as mediaSize,
} from '../lib/media.js';

// ═══════════════════════════════════════════════════════════════
// GUR YÖNETİCİ PANELİ — Platform kontrol merkezi
// Restoranlar, başvurular, kullanıcılar, Gastro Onaylı, gelir yönetimi
// ═══════════════════════════════════════════════════════════════

// "One" panosu: açık gri kâğıt üzerinde beyaz kartlar. Panel eskiden koyu
// bir masaüstü aracıydı; referans tasarım açık, o yüzden jetonlar çevrildi.
// Anlam aynı kaldığı için 498 kullanım yerine dokunmaya gerek olmadı:
// bg = sayfa zemini, panel = kart, panel2 = kart içi ikinci yüzey.
//
// Yumuşak tonlarda alfa değeri bilerek 0.12: Btn'in soft varyantı hover ve
// press için bu dizgiyi 0.2 / 0.26 ile değiştiriyor.
// ═══════════════════════════════════════════════════════════════════════
// PANELİN PALETİ — iki tema
//
// Panel kendi stil bloğunu taşıyor ve GurStyles'ın jetonlarını GÖRMÜYOR;
// renkler bu yüzden CSS değişkeni değil JS. Tema anahtarlanınca `C`nin
// alanları YERİNDE değiştiriliyor (applyAdminTheme) ve kök bir state
// bump'ı bütün ağacı yeniden çizdiriyor. Böylece 560'tan fazla `C.x`
// kullanımı olduğu gibi kalıyor — SVG öznitelikleri (fill/stopColor) ve
// `${C.red}44` gibi hex birleştirmeleri dahil, ki bunların ikisi de
// var() ile çalışmazdı.
//
// DİKKAT: modül düzeyinde `const X = { a: C.foo }` yazmayın — o değer
// modül yüklenirken DONAR ve tema değişince güncellenmez. Türev sabitler
// aşağıdaki `live()` ile getter'a çevrildi.
//
// İki tema arasındaki bölünme uygulamanınkiyle aynı kural: dolgu parlak
// tonunu korur, YAZI zemine göre ton değiştirir. Açık kâğıtta koyu
// mürekkep (`-Ink`), koyu zeminde açık tint. Koyu zemin tintleri
// uygulamanın `--c-*-light` jetonlarıyla birebir aynı hexler — iki panel
// yan yana açıldığında aynı ürüne ait görünsün.
// ═══════════════════════════════════════════════════════════════════════

const LIGHT = {
  isDark: false,
  bg: '#EEF0F3',
  panel: '#FFFFFF',
  panel2: '#F3F4F7',
  panelHover: '#FAFBFC',
  border: '#E4E7EC',
  text: '#12141A',          /* saf siyah değil */
  dim: '#5A6474',
  faint: '#646E7C',      /* 5.2:1 — eski #8B95A5 3.0:1 idi */
  orange: '#FF6600',
  orangeSoft: 'rgba(255,102,0,0.12)',
  green: '#13B364',
  greenSoft: 'rgba(19,179,100,0.12)',
  red: '#E5484D',
  redSoft: 'rgba(229,72,77,0.12)',
  yellow: '#E08700',
  yellowSoft: 'rgba(224,135,0,0.12)',
  blue: '#2563EB',
  blueSoft: 'rgba(37,99,235,0.12)',

  // ── AYNI RENGİN İKİ TONU ────────────────────────────────────────
  // Parlak turuncu/yeşil/kırmızı/sarı beyaz kâğıt üstünde YAZI olarak
  // 2.7–3.9:1'de kalıyordu. Dolgu parlak tonunu korur, yazı ve simge
  // koyu tonunu alır — yeni bir renk eklemeden vurgu kuruluyor.
  orangeInk: '#B4530A',   /* 5.0:1 */
  greenInk:  '#0A7C46',   /* 5.3:1 */
  redInk:    '#C2282D',   /* 5.8:1 */
  yellowInk: '#8A5200',   /* 6.3:1 */
  onBrand:   '#ffffff',   /* turuncu DOLGU üstünde yazı — beyaz (ürün kararı) */

  // ── DOLU HAPLARIN ZEMİNİ ────────────────────────────────────────
  // Yazının rengiyle birlikte seçilir, o yüzden ayrı jeton: koyu temada
  // yeşil/kırmızı mürekkep açılıyor ama DOLGU açılamaz, yoksa beyaz yazı
  // taşıyan düğme okunmaz olur.
  fillGreen: '#0A7C46',
  fillRed:   '#C2282D',
  fillNeutral: '#12141A',   /* nötr dolu hap: koyu zemin, beyaz yazı */
  fillNeutralInk: '#ffffff',

  // Devre dışı hap: soluklaştırma değil, kendi rengi olan gri hap.
  // `offInk` #98A0AE iken zemininde 2.17:1 idi ve denetimden
  // de kaçıyordu: taranan açık tema sayfalarında devre dışı hap yoktu.
  // Koyu paletin yanında oranı yazılıydı, açık paletin hiç ölçülmemişti.
  // Soluklaştırma DEĞİL koyultma: "devre dışı" bilgisini gri DOLGU taşıyor
  // (bkz. "Pasif durumu opacity ile kurma"), yazının okunur olması gerek.
  offBg: '#E7E9EE', offInk: '#5F6875', offBorder: '#E0E3E9',   /* 4.6:1 */
  // Gelir şeridinin sıcak yıkaması ve grafik ipucu kutusu.
  heroTint: '#FFF6EE',
  tooltipBg: '#17130F',
};

// Koyu tema. Griler soğuk eksende kalıyor (panelin kimliği bu), yüzeyler
// yükseldikçe açılıyor: koyu arayüzde yükseklik gölgeyle değil zeminin
// açılmasıyla anlatılır — siyah bir gölge zaten siyah zeminde görünmez.
const DARK = {
  isDark: true,
  bg: '#0E1116',
  panel: '#171C23',
  panel2: '#212832',
  panelHover: '#1D232B',
  border: '#2C333E',
  text: '#E9ECF1',       /* panel üstünde 14.7:1 */
  dim: '#A8B2BF',        /* 8.1:1 */
  faint: '#8E99A7',      /* 6.0:1 — açık temadaki 5.2:1'in karşılığı */
  orange: '#FF6600',
  orangeSoft: 'rgba(255,122,26,0.12)',
  green: '#4ADE80',
  greenSoft: 'rgba(74,222,128,0.12)',
  red: '#FF7A70',
  redSoft: 'rgba(255,122,112,0.12)',
  yellow: '#FFB454',
  yellowSoft: 'rgba(255,180,84,0.12)',
  blue: '#7DA6FF',
  blueSoft: 'rgba(125,166,255,0.12)',

  // Koyu zeminde mürekkep AÇILIR. Hexler uygulamanın --c-*-light
  // jetonlarının aynısı: yeni bir yeşil/amber/kırmızı tanımlanmadı.
  orangeInk: '#FF9A4D',   /* 8.3:1 */
  greenInk:  '#4ADE80',   /* 10.0:1 */
  redInk:    '#FF7A70',   /* 6.9:1 */
  yellowInk: '#FFB454',   /* 9.9:1 */
  onBrand:   '#ffffff',   /* turuncu dolgu iki temada da aynı */

  // Dolgular koyu kalır: üstlerindeki yazı beyaz.
  fillGreen: '#0A7C46',
  fillRed:   '#C2282D',
  fillNeutral: '#E9ECF1',   /* koyu temada nötr hap AÇIK olur */
  fillNeutralInk: '#12141A',

  // Devre dışı hap koyu temada da kendi rengini alır: açık gri bir blok
  // koyu zeminde en parlak nesne olurdu ve pasif olan şey öne çıkardı.
  offBg: '#252B34', offInk: '#8B95A3', offBorder: '#2C333E',   /* 4.7:1 */
  // Sıcak yıkama koyu zeminde de sıcak ama karanlık kalıyor.
  heroTint: '#241A12',
  // İpucu kutusu koyu panelden bir tık AÇIK: siyah üstünde siyah kutu
  // kaybolur, ayrımı gölge değil zemin farkı yapar.
  tooltipBg: '#2E3641',
};

// Canlı palet. Yerinde değişiyor; okuyan her yer render anındaki değeri alır.
const C = { ...LIGHT };

/**
 * Modül düzeyindeki türev sabitleri getter'a çevirir. `{ a: C.foo }`
 * değeri modül yüklenirken dondurur; `live({ a: () => C.foo })` her
 * okumada tazesini verir ve yayma (`{...CARD}`) getter'ları çağırdığı
 * için çağrı yerlerinde hiçbir şey değişmiyor.
 */
const live = spec => Object.defineProperties({}, Object.fromEntries(
  Object.entries(spec).map(([k, get]) => [k, { get, enumerable: true }])));

/**
 * Buton durumları — HER İKİ stil bloğu da bunu kullanır.
 *
 * Eskiden yalnızca panelin stil bloğunda vardı; giriş ekranı ayrı ve daha
 * kısa bir blok taşıdığı için oradaki "Giriş yap" hapı hiç
 * biçimlendirilmiyordu: tarayıcının varsayılan gri düğmesi üstünde beyaz
 * yazı, 1.15:1 — düğme neredeyse görünmezdi.
 *
 * Fonksiyon olmasının sebebi tema: sabit bir dizge açık temanın
 * renklerini donduruyordu.
 */
const btnCss = () => `
        /* Renk ve gölge değişkenlerden okunuyor; buton bunları inline
           veriyor. Böylece :hover / :active / :disabled kuralları satır içi
           stile ezilmeden çalışıyor. */
        .gur-admin-btn {
          background: var(--btn-bg, transparent);
          box-shadow: var(--btn-shadow, none);
          cursor: pointer;
          transition: background 160ms ease, box-shadow 200ms ease, opacity 160ms ease, border-color 160ms ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .gur-admin-btn:not(:disabled):hover {
            background: var(--btn-bg-hover, var(--btn-bg));
            filter: brightness(1.03);
          }
        }
        .gur-admin-btn:not(:disabled):active {
          background: var(--btn-bg-press, var(--btn-bg));
          box-shadow: var(--btn-shadow-press, var(--btn-shadow, none));
        }
        .gur-admin-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px ${C.orange}66, var(--btn-shadow, 0 0 0 0 transparent);
        }
        /* Devre dışı: soluklaştırmak yerine kendi rengi olan gri hap.
           Turuncu bir hapı %42 saydamlığa düşürmek beyaz yazıyı okunmaz
           bırakıyordu — referanstaki gri 'Comment' hapı gibi davranıyor. */
        .gur-admin-btn:disabled {
          cursor: not-allowed; box-shadow: none; filter: none; opacity: 1;
          background: ${C.offBg} !important; color: ${C.offInk} !important;
          border-color: ${C.offBorder} !important;
        }
        .gur-admin-btn[data-state="loading"] { opacity: 0.9; cursor: progress; filter: none; }

        /* Apple HIG: dokunma hedefi en az 44×44. İkon butonun görsel boyutu
           korunur, tıklama alanı görünmez bir katmanla büyür. */
        .gur-admin-icon::after {
          content: ""; position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: max(100%, 44px); height: max(100%, 44px);
        }
        @media (prefers-reduced-motion: reduce) { .gur-admin-btn { transition: none !important; } }
`;

const THEME_KEY = 'gur.admin.theme';

export function adminThemePref() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch { /* depolama kapalı */ }
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch { /* eski tarayıcı */ }
  return 'light';
}

/** Paleti ve gölge ölçeğini yerinde değiştirir. Çizimden ÖNCE çağrılır. */
export function applyAdminTheme(mode) {
  Object.assign(C, mode === 'dark' ? DARK : LIGHT);
  Object.assign(SHV, mode === 'dark' ? SH_DARK : SH_LIGHT);
}

const F = "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
// Gövde ve sayılar uygulamanın gövde yazı tipiyle aynı: iki panel yan yana
// açıldığında aynı ürüne ait olduğu okunmalı.
const FB = "'Outfit', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
// Sayı sütunları: referans panoda fiyatlar sabit genişlikli. Sistem mono'su
// kullanılıyor — ek bir font isteği getirmeden rakamlar hizalanıyor.
const FM = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

// ─── Uygulamayla ortak tasarım dili ──────────────────────────────────────
// GurApp.jsx'teki ELEV/BRAND_GRAD kalıbının koyu zemin karşılığı. Değerler
// birebir aynı olamaz (orası beyaz kâğıt, burası koyu masaüstü) ama sistem
// aynı: her yüzeyin bir duruş gölgesi, her butonun bir basılma gölgesi var.
const BRAND_GRAD = 'linear-gradient(145deg, #FF7A1A 0%, #FF6600 55%, #F04E00 100%)';
const BRAND_GRAD_HOVER = 'linear-gradient(145deg, #FF8A33 0%, #FF7311 55%, #FF5A05 100%)';
// One'ın kartları içeriden parlamıyor: geniş yayılan, çok açık tek bir
// düşüş var. Basılınca gölge kısalıyor — yüzey kâğıda yaklaşıyor.
// ── GÖLGE ÖLÇEĞİ ────────────────────────────────────────────────────────
// Uygulamadaki --sh-* ölçeğinin panel karşılığı (panel kendi stil bloğunu
// taşıyor, GurStyles jetonlarını görmüyor). Aynı kural: üç katman, yalnızca
// dikey kaydırma, kaydırmadan çok daha büyük bulanıklık, düşük opaklık ve
// zeminin tonunda renk — panelin kâğıdı soğuk gri olduğu için ton da soğuk.
const SH_LIGHT = {
  s1:      '0 1px 2px rgba(15,18,25,0.04), 0 2px 6px rgba(15,18,25,0.04), 0 5px 14px rgba(15,18,25,0.04)',
  s2:      '0 1px 2px rgba(15,18,25,0.04), 0 3px 8px rgba(15,18,25,0.05), 0 10px 24px rgba(15,18,25,0.05)',
  s3:      '0 2px 4px rgba(15,18,25,0.04), 0 7px 18px rgba(15,18,25,0.05), 0 18px 42px rgba(15,18,25,0.07)',
  s4:      '0 4px 8px rgba(15,18,25,0.05), 0 14px 30px rgba(15,18,25,0.08), 0 32px 70px rgba(15,18,25,0.10)',
  // Koyu yüzeyler (ipucu kutusu, bildirim hapı) ve turuncu haplar
  d2:      '0 2px 5px rgba(0,0,0,0.12), 0 6px 16px rgba(0,0,0,0.14), 0 14px 34px rgba(0,0,0,0.16)',
  d3:      '0 3px 8px rgba(0,0,0,0.14), 0 10px 26px rgba(0,0,0,0.18), 0 24px 56px rgba(0,0,0,0.22)',
  brand:   '0 1px 2px rgba(190,70,0,0.10), 0 4px 10px rgba(190,70,0,0.16), 0 10px 24px rgba(190,70,0,0.18)',
  brandSm: '0 1px 2px rgba(190,70,0,0.12), 0 2px 6px rgba(190,70,0,0.16)',
};

// Koyu temanın gölgeleri. Aynı üç katmanlı tarif ama iki fark var:
// siyah zeminde soluk bir siyah gölge GÖRÜNMEZ, o yüzden opaklık belirgin
// biçimde yüksek; ve yüksekliği asıl anlatan şey gölge değil, yükselen
// yüzeyin açılması (panel > bg) ile ince bir üst kenar ışığı.
const SH_DARK = {
  s1:      '0 1px 2px rgba(0,0,0,0.30), 0 2px 6px rgba(0,0,0,0.26), 0 5px 14px rgba(0,0,0,0.22)',
  s2:      '0 1px 2px rgba(0,0,0,0.32), 0 3px 8px rgba(0,0,0,0.30), 0 10px 24px rgba(0,0,0,0.26)',
  s3:      '0 2px 4px rgba(0,0,0,0.34), 0 7px 18px rgba(0,0,0,0.32), 0 18px 42px rgba(0,0,0,0.30)',
  s4:      '0 4px 8px rgba(0,0,0,0.36), 0 14px 30px rgba(0,0,0,0.36), 0 32px 70px rgba(0,0,0,0.40)',
  d2:      '0 2px 5px rgba(0,0,0,0.40), 0 6px 16px rgba(0,0,0,0.40), 0 14px 34px rgba(0,0,0,0.44)',
  d3:      '0 3px 8px rgba(0,0,0,0.44), 0 10px 26px rgba(0,0,0,0.46), 0 24px 56px rgba(0,0,0,0.50)',
  // Marka gölgesi koyu zeminde turuncu bir hâle bırakır; sıcak ton korunuyor
  // ama opaklık yükseliyor, yoksa hiç görünmüyor.
  brand:   '0 1px 2px rgba(120,44,0,0.40), 0 4px 10px rgba(160,58,0,0.34), 0 10px 24px rgba(190,70,0,0.28)',
  brandSm: '0 1px 2px rgba(120,44,0,0.44), 0 2px 6px rgba(160,58,0,0.34)',
};

// Canlı gölge ölçeği — palet gibi yerinde değişiyor.
const SHV = { ...SH_LIGHT };
const SH = live({
  s1: () => SHV.s1, s2: () => SHV.s2, s3: () => SHV.s3, s4: () => SHV.s4,
  d2: () => SHV.d2, d3: () => SHV.d3,
  brand: () => SHV.brand, brandSm: () => SHV.brandSm,
});

// Basılınca gölge bir basamak kısalır: nesne kâğıda yaklaşır.
const ELEV = live({
  card:      () => SH.s2,
  raised:    () => SH.s3,
  brand:     () => SH.brand,
  pressDark: () => SH.s1,
  pressBrand: () => SH.brandSm,
});
// Köşe yarıçapları uygulamayla aynı ölçekte: kart 18, kontrol 12, pill 999.
const R = { card: 24, control: 14, pill: 999 };
// Panellerin tamamı tek bir kart tarifinden geçiyor — 20 ayrı yerde
// tekrarlanan literal, tek yerden değişebilen bir jetona indi.
const CARD = live({
  background: () => C.panel,
  border: () => `1px solid ${C.border}`,
  borderRadius: () => R.card,
  boxShadow: () => ELEV.card,
});

// Referans panoda kart başlıkları kartın İÇİNDE, ayırıcı çizgiyle değil
// boşlukla ayrılıyor; sayılar mono. İki yardımcı bunu tek yerden verir.
const NUM = { fontFamily: FM, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2 };

// ─── Mock veri ───
const STATS = {
  totalRestaurants: 342,
  activeRestaurants: 289,
  pendingApps: 14,
  totalUsers: 18420,
  dailyActive: 4230,
  totalSwipes: 892400,
  gastroApproved: 47,
};

const SWIPE_TREND = [
  { d: 'Pzt', v: 118000 }, { d: 'Sal', v: 132000 }, { d: 'Çar', v: 141000 },
  { d: 'Per', v: 128000 }, { d: 'Cum', v: 165000 }, { d: 'Cmt', v: 190000 }, { d: 'Paz', v: 178000 },
];

// Sıralı bir büyüklük: altı ayrı renk değil, TEK rengin altı tonu.
// Turuncu-kırmızı-amber karışımı hem kategorileri eşit ağırlıkta
// gösteriyor hem de paletle çakışıyordu. "Diğer" toplama kalemi
// olduğu için rampanın dışında, nötr bir tonda.
const CAT_DIST = [
  { name: 'Türk Mutfağı', count: 89, color: '#A8420A' },
  { name: 'Kafe', count: 64, color: '#D0530A' },
  { name: 'Fast Food', count: 47, color: '#F1650F' },
  { name: 'İtalyan', count: 38, color: '#FF8A3D' },
  { name: 'Uzak Doğu', count: 31, color: '#FFB27A' },
  { name: 'Diğer', count: 73, color: '#9AA3B0' },
];

// account: işletme kaydını sahiplenmiş, panel girişi olan müşterimiz mi.
// false olanlar yalnızca dış besleme (Google Places / OSM) üzerinden gelen
// mekanlar: kullanıcı adları yok, bize ödeme yapmıyorlar — fiyatlandırma
// panelinde görünmezler, çünkü teklif gönderilecek bir muhatap yok.
const RESTAURANTS = [
  { id: 1, name: 'Nusr-Et Steakhouse', cat: 'Türk Mutfağı', district: 'Beşiktaş', rating: 4.8, reviews: 1240, status: 'active', gastro: true, plan: 'Premium', joined: '2024-03-12', account: true, source: 'owner' },
  { id: 2, name: 'Mikla Restaurant', cat: 'Fine Dining', district: 'Beyoğlu', rating: 4.9, reviews: 890, status: 'active', gastro: true, plan: 'Premium', joined: '2024-01-08', account: true, source: 'owner' },
  { id: 9, name: 'Çiya Sofrası', cat: 'Türk Mutfağı', district: 'Kadıköy', rating: 4.7, reviews: 2100, status: 'active', gastro: true, plan: 'Pro', joined: '2024-02-20', account: true, source: 'owner' },
  { id: 3, name: 'La Sagrata Famila', cat: 'Uzak Doğu', district: 'Kadıköy', rating: 4.6, reviews: 620, status: 'active', gastro: false, plan: 'Pro', joined: '2024-04-05', account: true, source: 'owner' },
  { id: 4, name: 'Green Bowl', cat: 'Sağlıklı', district: 'Şişli', rating: 4.5, reviews: 340, status: 'active', gastro: false, plan: 'Ücretsiz', joined: '2024-06-15', account: false, source: 'api', email: 'merhaba@greenbowl.com.tr', website: 'greenbowl.com.tr' },
  { id: 6, name: 'Klein Bistro', cat: 'Kafe', district: 'Beyoğlu', rating: 4.4, reviews: 560, status: 'suspended', gastro: false, plan: 'Ücretsiz', joined: '2024-05-02', account: false, source: 'api', email: null, website: 'kleinbistro.co' },
  { id: 11, name: 'The Burger Joint', cat: 'Fast Food', district: 'Nişantaşı', rating: 4.2, reviews: 780, status: 'active', gastro: false, plan: 'Pro', joined: '2024-04-18', account: true, source: 'owner' },
  { id: 12, name: 'Karaköy Güllüoğlu', cat: 'Tatlıcı', district: 'Karaköy', rating: 4.9, reviews: 3200, status: 'active', gastro: true, plan: 'Premium', joined: '2023-12-01', account: true, source: 'owner' },
  // Dış beslemeden gelen, henüz sahiplenilmemiş mekanlar
  { id: 5, name: 'Ateş Mangal', cat: 'Mangal', district: 'Beykoz', rating: 4.7, reviews: 210, status: 'active', gastro: false, plan: 'Ücretsiz', joined: '2026-02-14', account: false, source: 'api', email: 'iletisim@atesmangal.com', website: null },
  { id: 13, name: 'Balıkçı Sabahattin', cat: 'Deniz Ürünleri', district: 'Fatih', rating: 4.6, reviews: 980, status: 'active', gastro: false, plan: 'Ücretsiz', joined: '2026-01-22', account: false, source: 'api', email: 'rezervasyon@balikcisabahattin.com', website: 'balikcisabahattin.com' },
  { id: 14, name: 'Spice Market', cat: 'Uzak Doğu', district: 'Şişli', rating: 4.4, reviews: 150, status: 'active', gastro: false, plan: 'Ücretsiz', joined: '2026-03-30', account: false, source: 'api', email: null, website: null },
  { id: 7, name: 'Lucca Lounge', cat: 'Gece Hayatı', district: 'Bebek', rating: 4.3, reviews: 450, status: 'active', gastro: false, plan: 'Pro', joined: '2024-07-22', account: true, source: 'owner' },
];

// ═══════════════════════════════════════════════════════════════════════
// GELİR KALEMLERİ VE MÜŞTERİ BAZLI SATIN ALIMLAR
//
// Katalog (REVENUE_STREAMS) platformun sattığı ücretli özelliklerin
// tamamıdır; `monthly` platform genelindeki aylık toplamdır. Tek bir
// işletmenin ödediği tutar liste fiyatından değil, o işletmeyle yapılan
// pazarlıktan gelir (STORE_SERVICES + kabul edilen teklifler). STORE_SERVICES ise bunların hangi müşteride açık olduğunu
// tutar — panelin her yerinde "bu mağaza neyi satın almış" sorusunun tek
// cevabı burasıdır. Sunucudaki karşılığı subscriptions + campaign_orders
// tablolarının işletme kırılımıdır.
// ═══════════════════════════════════════════════════════════════════════
const REVENUE_STREAMS = [
  { key: 'bannerAds', short: 'Banner', name: 'Dönen keşfet banner\'ı', kind: 'Reklam', monthly: 128000, unit: '42 aktif kampanya', note: 'Keşfet ekranının üstündeki marka + sponsor karuseli.' },
  { key: 'pushAds', short: 'Push', name: 'Push bildirim reklamları', kind: 'Reklam', monthly: 74000, unit: '41 gönderim / ay', note: 'Semt bazlı tek seferlik bildirim satışı.' },
  { key: 'rewardedAds', short: 'Ödüllü video', name: 'Ödüllü video reklam (kaydırma hakkı)', kind: 'Sponsorluk', monthly: 96000, unit: '~%78 tamamlanma', note: '10 kaydırma sonrası izlenen video, +5 hak kazandırır.' },
  // Haftalık paket, süreyle değil KOTAYLA biter: 200 farklı kullanıcıya
  // gösterim. Restoran başına aynı anda tek paket (bkz. shared/second-chance.js).
  { key: 'secondChance', short: 'İkinci Şans', name: 'İkinci Şans paketi (haftalık)', kind: 'Performans', monthly: 41000, unit: '200 kullanıcı / paket', note: 'Restoranı SOLA kaydırmış 200 farklı kullanıcının destesine geri ekler. Aynı kullanıcıya günde bir kez; kota bitince paket kapanır.' },
  { key: 'instantDeals', short: 'Anlık fırsat', name: 'Anlık fırsat bildirimleri', kind: 'Performans', monthly: 63000, unit: '140 yayın / ay', note: 'Ölü saat doldurma; yayın başına ücret.' },
  // Şef videosu ile içerik lisansı tek pakettir: video çekilmeden lisanslanacak
  // içerik yok, çekildiğinde de zaten restorana devrediliyor. Bu paketi alan
  // mekan Gastro Onaylı kategorisine girer — rozetin karşılığı bu çekimdir.
  { key: 'gastroPackage', short: 'Gastro paketi', name: 'Gastro şef videosu paketi', kind: 'İçerik', monthly: 91000, unit: '8 çekim / ay', note: 'Şef çekimi + 15 sn dikey videonun süresiz kullanım hakkı. Gastro Onaylı rozetini getirir.' },
];

const KIND_TONE = live({
  'Reklam': () => C.blue, 'Sponsorluk': () => C.orange,
  'Performans': () => C.green, 'İçerik': () => C.red,
});

// İŞLETME ABONELİĞİ KALDIRILDI (Premium / Pro / Ücretsiz).
//
// Platform artık paket satmıyor: bir işletmenin ödediği tutarın tamamı
// satın aldığı ÜCRETLİ ÖZELLİKLERDEN geliyor (REVENUE_STREAMS +
// STORE_SERVICES). "Plan" diye bir kademe yok, dolayısıyla plana bağlı
// "tam görünürlük / öncelikli yerleşim" de yok — görünürlük artık tek bir
// yerden yönetiliyor: restoran bazlı görünürlük anahtarı
// (`hiddenFromApp`, bkz. RestaurantDetailPage → StoreFeatures).
//
// Kayıtlardaki `plan` alanı okunmuyor; sunucudaki subscriptions tablosu da
// bu kaldırmayla birlikte kullanım dışı.
const STREAM_BY_KEY = Object.fromEntries(REVENUE_STREAMS.map(x => [x.key, x]));

// Hangi müşteri hangi ücretli özelliği almış. monthly: o işletmenin o kalem
// için ödediği aylık tutar (kampanyalarda harcanan bütçenin aylık karşılığı).
const STORE_SERVICES = {
  1: [ // Nusr-Et Steakhouse
    { key: 'bannerAds', monthly: 14000, since: '2025-11-04' },
    { key: 'pushAds', monthly: 6500, since: '2026-02-11' },
    { key: 'gastroPackage', monthly: 13200, since: '2025-12-20' },
  ],
  2: [ // Mikla
    { key: 'bannerAds', monthly: 11000, since: '2025-09-15' },
    { key: 'gastroPackage', monthly: 13200, since: '2026-01-08' },
  ],
  9: [ // Çiya Sofrası
    { key: 'rewardedAds', monthly: 5200, since: '2026-03-02' },
    { key: 'instantDeals', monthly: 3100, since: '2026-04-19' },
    { key: 'gastroPackage', monthly: 13200, since: '2026-02-10' },
  ],
  3: [ // La Sagrata Famila — Doyurucu panelinden yönetilen işletme
    { key: 'instantDeals', monthly: 2400, since: '2026-03-08' },
    { key: 'secondChance', monthly: 1450, since: '2026-01-16' },
  ],
  4: [],  // Green Bowl — sahiplenilmemiş kayıt, satın alım yok
  6: [], // Klein Bistro — askıda, satın alım yok
  11: [ // The Burger Joint
    { key: 'rewardedAds', monthly: 4300, since: '2026-02-27' },
    { key: 'instantDeals', monthly: 2600, since: '2026-05-14' },
    { key: 'secondChance', monthly: 1450, since: '2026-02-27' },
  ],
  12: [ // Karaköy Güllüoğlu
    { key: 'bannerAds', monthly: 9800, since: '2025-08-22' },
    { key: 'pushAds', monthly: 5200, since: '2026-03-30' },
    { key: 'gastroPackage', monthly: 13200, since: '2025-12-05' },
  ],
  7: [ // Lucca Lounge
    { key: 'pushAds', monthly: 4100, since: '2026-04-06' },
    { key: 'instantDeals', monthly: 3400, since: '2026-05-02' },
    { key: 'secondChance', monthly: 1450, since: '2026-04-06' },
  ],
};

/** Bir mağazanın satın aldığı ücretli özellikler, katalog bilgisiyle birlikte. */
function storeServices(r) {
  return (STORE_SERVICES[r.id] || [])
    .map(x => {
      // Kabul edilmiş fiyat teklifi varsa yürürlükteki tutar odur.
      const accepted = pricing.acceptedPrice(r.id, x.key);
      return { ...STREAM_BY_KEY[x.key], ...x, monthly: accepted ?? x.monthly, repriced: accepted != null };
    })
    .filter(x => x.name)
    .sort((p, q) => q.monthly - p.monthly);
}
/** Hizmetlerden gelen aylık tutar (abonelik hariç). */
function storeServiceRevenue(r) {
  return storeServices(r).reduce((a, x) => a + x.monthly, 0);
}
/** Mağazanın platforma aylık katkısı — tamamı satın aldığı ücretli
 *  özelliklerden. Abonelik kaldırıldığı için ikinci bir kalem yok. */
function storeMonthly(r) {
  return storeServiceRevenue(r);
}

// Katalogdaki her kalemin platform geneli aylık toplamı; adı geçen sekiz
// müşteri bu toplamın içinden çıkar, kalanı "diğer işletmeler" satırıdır.
const STREAM_TOTAL = REVENUE_STREAMS.reduce((a, x) => a + x.monthly, 0);
// Abonelik kalemi kaldırıldı: platform cirosunun tamamı ücretli özelliklerden.
const PLATFORM_TOTAL = STREAM_TOTAL;

const APPLICATIONS = [
  { id: 101, name: 'Balıkçı Deniz', cat: 'Deniz Ürünleri', district: 'Sarıyer', owner: 'Deniz Yılmaz', taxNo: '4820193756', taxOffice: 'Sarıyer VD', submitted: '2 saat önce', docStatus: 'yüklendi' },
  { id: 102, name: 'Pizza Napoli', cat: 'İtalyan', district: 'Kadıköy', owner: 'Marco Bianchi', taxNo: '7291048365', taxOffice: 'Kadıköy VD', submitted: '5 saat önce', docStatus: 'yüklendi' },
  { id: 103, name: 'Sushi Zen', cat: 'Uzak Doğu', district: 'Beşiktaş', owner: 'Ayşe Kaya', taxNo: '1938475620', taxOffice: 'Beşiktaş VD', submitted: '1 gün önce', docStatus: 'yüklendi' },
  { id: 104, name: 'Kahve Durağı', cat: 'Kafe', district: 'Üsküdar', owner: 'Mehmet Demir', taxNo: '5647382910', taxOffice: 'Üsküdar VD', submitted: '1 gün önce', docStatus: 'inceleniyor' },
  { id: 105, name: 'Vegan Garden', cat: 'Sağlıklı', district: 'Cihangir', owner: 'Zeynep Ak', taxNo: '8273649150', taxOffice: 'Beyoğlu VD', submitted: '2 gün önce', docStatus: 'yüklendi' },
];

const USERS = [
  { id: 1, name: 'Bora Çolpan', email: 'bora@mail.com', joined: '2024-08-01', swipes: 340, favs: 28, status: 'active' },
  { id: 2, name: 'Elif Kara', email: 'elif@mail.com', joined: '2024-07-15', swipes: 890, favs: 54, status: 'active' },
  { id: 3, name: 'Mert Şen', email: 'mert@mail.com', joined: '2024-06-20', swipes: 120, favs: 9, status: 'active' },
  { id: 4, name: 'Ahmet Yıldız', email: 'ahmet@mail.com', joined: '2024-09-02', swipes: 45, favs: 3, status: 'active' },
  { id: 5, name: 'Zeynep Ateş', email: 'zeynep@mail.com', joined: '2024-05-11', swipes: 1200, favs: 87, status: 'banned' },
];

// ─── Restoran detayları (mock) ────────────────────────────────────────────
// Her restoran için menü ve yorum listesi id'den deterministik üretilir:
// veri sabit kalır, panelde gezinirken içerik zıplamaz.
function seeded(id) {
  let a = (id * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// MENU_KINDS ve restaurantMenus() KALDIRILDI: yönetici panelindeki menü
// listesini tohumlanmış sahte veriyle dolduruyorlardı. Menüler artık
// işletmenin gerçekten yüklediği dosyalar (src/lib/media.js).

const REVIEW_POOL = [
  { stars: 5, text: 'Sunum ve lezzet beklentimin üzerindeydi. Personel ilgili, servis hızlıydı. Kesinlikle tekrar geleceğim.' },
  { stars: 5, text: 'Uzun zamandır burayı takip ediyordum, hak ettiği övgüyü alıyor. Özellikle ana yemekler çok başarılı.' },
  { stars: 4, text: 'Yemekler güzeldi, ambiyans hoş. Fiyatlar biraz yüksek ama porsiyonlar doyurucu.' },
  { stars: 5, text: 'Arkadaşlarımla harika bir akşam geçirdik. Mutfak geç saate kadar açık olması büyük artı.' },
  { stars: 3, text: 'Lezzet iyiydi ama rezervasyonumuz olmasına rağmen 25 dakika bekledik. Organizasyon geliştirilebilir.' },
  { stars: 4, text: 'Menüdeki çeşitlilik güzel, vejetaryen seçenekler de var. Tatlıları ayrıca denemenizi öneririm.' },
  { stars: 5, text: 'Şefin önerisini denedik, çok memnun kaldık. Fiyat-performans olarak bölgedeki en iyilerden.' },
  { stars: 2, text: 'Yemek soğuk geldi, geri gönderdik. İkinci gelişte düzeldi ama ilk izlenim iyi olmadı.' },
  { stars: 4, text: 'Manzara ve dekorasyon çok başarılı. Müzik sesi biraz yüksekti, sohbet etmek zorlaştı.' },
  { stars: 5, text: 'Doğum günü için gittik, ekip ilgilendi ve sürpriz yaptı. Bu detaylar fark yaratıyor.' },
  { stars: 3, text: 'Ortalama bir deneyimdi. Fena değil ama bu fiyata daha iyisini bulmak mümkün.' },
  { stars: 5, text: 'Malzeme kalitesi belli oluyor. Taze ve özenli. Kahvaltı için de ayrıca gelmek istiyorum.' },
  { stars: 4, text: 'Servis nazik, mekan temiz. Otopark sıkıntısı var, toplu taşımayla gitmek daha rahat.' },
  { stars: 1, text: 'Rezervasyonumuz kaybolmuş, masa verilmedi. Telefonda ilgilenen olmadı. Hayal kırıklığı.' },
  { stars: 2, text: 'Hesap yanlış geldi, düzeltmesi 20 dakika sürdü. Yemekler ortalamaydı, bu fiyata değmez.' },
  { stars: 1, text: 'Masalar temizlenmemişti, üç kez söylememize rağmen ilgilenen olmadı. Bir daha gitmem.' },
  { stars: 2, text: 'Menüdeki üç yemeğin ikisi yokmuş. Kalanı da beklediğimiz gibi çıkmadı.' },
  { stars: 1, text: 'Garson tavrı rahatsız ediciydi. Yemeği bitirmeden kalktık, yöneticiye ulaşamadık.' },
  { stars: 2, text: 'Porsiyonlar fotoğraflardakinin yarısı kadar. Lezzet fena değil ama beklenti yönetimi kötü.' },
];

const REVIEWER_NAMES = ['Elif K.', 'Mert S.', 'Zeynep A.', 'Can B.', 'Ahmet Y.', 'Deniz Ö.', 'Selin T.', 'Burak D.', 'Ece M.', 'Kaan U.', 'Nil P.', 'Onur G.'];

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}
function daysAgoLabel(days) {
  if (days === 0) return 'bugün';
  if (days === 1) return 'dün';
  if (days < 30) return `${days} gün önce`;
  const m = Math.floor(days / 30);
  return m < 12 ? `${m} ay önce` : `${Math.floor(m / 12)} yıl önce`;
}
// Sabit referans gün — "x gün önce" etiketleri her açılışta kaymasın
const TODAY = new Date('2026-09-02T00:00:00Z');
function isoDaysAgo(days) {
  return new Date(TODAY.getTime() - days * 86400000).toISOString().slice(0, 10);
}

function restaurantReviews(r) {
  const rand = seeded(r.id * 13 + 11);
  const count = 5 + Math.floor(rand() * 4);           // 5-8 yorum
  const pool = [...REVIEW_POOL];
  const out = [];
  for (let i = 0; i < count && pool.length; i++) {
    const rv = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const days = 1 + Math.floor(rand() * 120);
    out.push({
      user: REVIEWER_NAMES[Math.floor(rand() * REVIEWER_NAMES.length)],
      stars: rv.stars,
      text: rv.text,
      days,
      date: isoDaysAgo(days),
      flagged: rv.stars === 1,
    });
  }
  return out.sort((a, b) => a.days - b.days);
}

// Gurme (şef) değerlendirmeleri: kullanıcı yorumlarından ayrı tutulur —
// 10 üzerinden mesleki puan ve gerekçeli not içerir. Gastro rozeti bu
// değerlendirmelere dayanır, atama ise Restoranlar bölümünde yapılır.
const GOURMET_NOTES = [
  'Malzeme seçimi ve pişirme disiplini tutarlı; menü kurgusu net okunuyor.',
  'Klasik tarifleri bozmadan modernize etmişler, sunum dengeli.',
  'Mutfak teknik olarak güçlü, servis akışı buna ayak uyduruyor.',
  'Yerel üretici kullanımı takdire değer. Porsiyon dengesi gözden geçirilebilir.',
  'Lezzet profili iddialı; tutarlılığın her serviste sağlanması gerekiyor.',
  'Fiyat-kalite dengesi bölgesine göre başarılı, karşılama sıcak.',
  'Soslarda derinlik var. Tatlı bölümü ana menünün gerisinde kalıyor.',
  'Sezonluk menü değişimi ciddiye alınmış, mutfak kendini tekrar etmiyor.',
];

function gourmetReviews(restaurants) {
  const out = [];
  CHEFS.forEach(chef => {
    restaurants.forEach(r => {
      const rand = seeded(chef.id * 101 + r.id * 17);
      // Her şef restoranların bir kısmını değerlendirir; onaylılar daha olası
      if (rand() > (r.gastro ? 0.62 : 0.22)) return;
      const days = 5 + Math.floor(rand() * 400);
      out.push({
        key: `${chef.id}-${r.id}`,
        chef,
        restId: r.id,
        restName: r.name,
        restCat: r.cat,
        district: r.district,
        gastro: r.gastro,
        score: (7.4 + rand() * 2.5).toFixed(1),      // 10 üzerinden mesleki puan
        note: GOURMET_NOTES[Math.floor(rand() * GOURMET_NOTES.length)],
        days,
        date: isoDaysAgo(days),
      });
    });
  });
  return out.sort((a, b) => a.days - b.days);
}

// Tüm restoranların kullanıcı yorumlarını tek akışta toplar
function allUserReviews(restaurants) {
  const out = [];
  restaurants.forEach(r => {
    restaurantReviews(r).forEach((v, i) => {
      out.push({ ...v, key: `${r.id}-${i}`, restId: r.id, restName: r.name, restCat: r.cat, district: r.district });
    });
  });
  return out.sort((a, b) => a.days - b.days);
}

const CHEFS = [
  { id: 1, name: 'Şef Mehmet Gürs', endorsements: 12, specialty: 'Modern Türk' },
  { id: 2, name: 'Şef Didem Şenol', endorsements: 8, specialty: 'Ege Mutfağı' },
  { id: 3, name: 'Şef Maksut Aşkar', endorsements: 15, specialty: 'Anadolu' },
  { id: 4, name: 'Şef Civan Er', endorsements: 6, specialty: 'Fine Dining' },
];

// ─── GUR Logo ───
function GurLogo({ size = 28 }) {
  return (
    <span style={{ fontSize: size, fontWeight: 900, fontFamily: F, letterSpacing: -size / 22, lineHeight: 1 }}>
      <span style={{ color: '#FFA500' }}>G</span>
      <span style={{ color: '#FF6600' }}>U</span>
      <span style={{ color: '#FF3B30' }}>R</span>
    </span>
  );
}

// ─── İkonlar ───
const Icon = ({ path, size = 18, color = 'currentColor', fill = 'none', sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);
const icons = {
  dash: <><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>,
  store: <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></>,
  users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  msg: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  bell: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></>,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  // Tema anahtarı: gösterilen simge GİDİLECEK temayı anlatır — koyudayken
  // güneş (aydınlığa dön), açıktayken ay.
  sun: <><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" /><line x1="4.9" y1="4.9" x2="7" y2="7" /><line x1="17" y1="17" x2="19.1" y2="19.1" /><line x1="4.9" y1="19.1" x2="7" y2="17" /><line x1="17" y1="7" x2="19.1" y2="4.9" /></>,
  moon: <><path d="M20 14.5A8.5 8.5 0 019.5 4a7 7 0 108.9 10.4c.5.1 1 .1 1.6.1z" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  play: <><polygon points="6 4 20 12 6 20 6 4" /></>,
  upload: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  sheet: <><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  doc: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
  trend: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  money: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></>,
  ban: <><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>,
};

// ─── Küçük bileşenler ───
function Badge({ text, color, soft }) {
  return (
    <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color, background: soft, border: `1px solid ${color}22`, padding: '3px 10px', borderRadius: R.pill, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: { text: 'Aktif', color: C.greenInk, soft: C.greenSoft },
    suspended: { text: 'Askıda', color: C.yellowInk, soft: C.yellowSoft },
    banned: { text: 'Yasaklı', color: C.redInk, soft: C.redSoft },
  };
  const s = map[status] || map.active;
  return <Badge {...s} />;
}

// ─── İşletme avatarı ─────────────────────────────────────────────────
// İşletme kendi panelinden logo yüklediyse burada da o görünür: aynı
// kayıt, aynı kimlik. Logo ortak depoda data URL olarak duruyor
// (src/lib/b2b.js), o yüzden iki panel arasında taşınabiliyor.
function StoreAvatar({ restaurant, size = 36, radius = 11, font = 14 }) {
  const profiles = useOwnerProfiles();
  const logo = restaurant ? ownerLogo(restaurant.id, profiles) : null;
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: 'hidden',
      background: logo ? C.panel2 : 'linear-gradient(135deg,#FF7A1A33,#F04E0033)',
      border: logo ? `1px solid ${C.border}` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: font, color: C.orangeInk,
    }}>
      {logo
        ? <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (restaurant?.name?.[0] || '?')}
    </div>
  );
}

// ─── Para biçimi — panelin her yerinde aynı ───────────────────────────
// Büyük tutarlar K/M kısaltmasıyla, küçükler tam yazılır: bir kolonda
// "₺1.2M" ile "₺1.450" yan yana durduğunda ölçek okunur kalsın.
function money(n) {
  if (n >= 1000000) return `₺${(n / 1000000).toFixed(2)}M`;
  if (n >= 10000) return `₺${Math.round(n / 1000)}K`;
  return `₺${Math.round(n).toLocaleString('tr')}`;
}

/**
 * TAM tutar — kısaltma yok.
 *
 * `money()` büyük sayıları kısaltıyor (₺13.200 → "₺13K") ve bu KPI
 * toplamlarında doğru: oradaki soru "ne mertebede". Ama yöneticinin ELLE
 * yazdığı bir fiyatta yanlış: ₺13.200 ile ₺13.400 ikisi de "₺13K" okunur,
 * yazdığın sayıyı ekrandan doğrulayamazsın. Liste fiyatı, teklif tutarı ve
 * işletmeye görünen rakamlar bu yüzden tam yazılıyor — işletme panelinde de
 * tam yazıyor, iki taraf aynı sayıyı görmek zorunda.
 */
function tamPara(n) {
  return `₺${Math.round(Number(n) || 0).toLocaleString('tr')}`;
}

// ─── Mağazanın satın aldığı ücretli özellikler, rozet dizisi ──────────
// Aynı bileşen listede (kısa) ve detayda (tam) kullanılıyor ki bir
// müşterinin neyi aldığı panelin her yerinde aynı görünsün.
function ServiceChips({ services, max = 0, size = 'sm' }) {
  if (!services?.length) {
    return <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>ücretli özellik yok</span>;
  }
  const shown = max ? services.slice(0, max) : services;
  const rest = services.length - shown.length;
  const pad = size === 'sm' ? '3px 9px' : '5px 12px';
  const fs = size === 'sm' ? 10.5 : 12;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {shown.map(x => (
        <span key={x.key} title={`${x.name} · ${money(x.monthly)}/ay`} style={{
          fontFamily: FB, fontSize: fs, fontWeight: 700, whiteSpace: 'nowrap',
          color: KIND_TONE[x.kind], background: `${KIND_TONE[x.kind]}1F`,
          border: `1px solid ${KIND_TONE[x.kind]}33`, borderRadius: R.pill, padding: pad,
        }}>{x.short || x.name}</span>
      ))}
      {rest > 0 && (
        <span style={{ fontFamily: FB, fontSize: fs, fontWeight: 700, color: C.faint, background: C.panel2, borderRadius: R.pill, padding: pad }}>+{rest}</span>
      )}
    </div>
  );
}

// ─── Bölüm başlığı — panel genelinde tek tip ─────────────────────────
function SectionHead({ title, right }) {
  return (
    <header style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: FB, fontSize: 14.5, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>{title}</span>
      {right && <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, ...NUM }}>{right}</span>}
    </header>
  );
}

// ─── Buton — Apple HIG tonlu: filled/soft/outline/ghost/plain, tutarlı hover + basılma geri bildirimi ───
// Hapın YAZI rengi: zemine göre ton değiştiren mürekkep jetonları.
const TONE_COLOR = live({
  neutral: () => C.text, orange: () => C.orangeInk, green: () => C.greenInk,
  red: () => C.redInk, blue: () => C.blue, yellow: () => C.yellowInk,
});
// Yumuşak hapın zemini. Alfa iki temada da tam olarak 0.12: aşağıdaki
// hover/press tonlaması bu dizgiyi arayıp değiştiriyor.
const TONE_SOFT = live({
  neutral: () => C.panel2, orange: () => C.orangeSoft, green: () => C.greenSoft,
  red: () => C.redSoft, blue: () => C.blueSoft, yellow: () => C.yellowSoft,
});

function Spinner({ size = 14, color = 'currentColor' }) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, flexShrink: 0, display: 'inline-block',
      border: `2px solid ${color}`, borderTopColor: 'transparent',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', opacity: 0.9,
    }} />
  );
}

// Renk ve gölge CSS değişkenlerinden okunuyor (uygulamadaki .gur-btn ile aynı
// iş bölümü): satır içi background yazsaydık :hover ve :active hiç devreye
// giremezdi. Basılma hareketi (scale) Motion'da, renk/gölge CSS'te.
function Btn({ label, onClick, icon, variant = 'outline', tone = 'neutral', size = 'md', fullWidth = false, disabled, loading, title, count }) {
  const toneColor = TONE_COLOR[tone] || C.text;
  const toneSoft = TONE_SOFT[tone] || C.panel2;
  const paddings = { sm: '7px 13px', md: '9px 15px', lg: '12px 19px' };
  const fontSizes = { sm: 12, md: 12.5, lg: 14 };
  const brand = tone === 'orange';
  // Dolu hapta zemin ile yazı birlikte seçilir: parlak yeşil/kırmızı
  // üstünde beyaz 2.7–3.9:1'de, turuncu üstünde 2.9:1'de kalıyordu.
  // Yeşil ve kırmızı dolgu koyu tonuna iner, turuncu ise yazıyı koyultur.
  const FILL_BG = { neutral: C.fillNeutral, orange: BRAND_GRAD, green: C.fillGreen, red: C.fillRed, blue: C.blue, yellow: C.yellow };
  const FILL_INK = { neutral: C.fillNeutralInk, orange: C.onBrand, yellow: '#241c00' };
  const variants = {
    filled: {
      bg: FILL_BG[tone] || toneColor,
      hover: brand ? BRAND_GRAD_HOVER : (FILL_BG[tone] || toneColor),
      press: FILL_BG[tone] || toneColor,
      color: FILL_INK[tone] || '#fff', border: '1px solid transparent',
      elev: brand ? ELEV.brand : `0 6px 16px ${toneColor}33`, pressElev: brand ? ELEV.pressBrand : ELEV.pressDark,
    },
    // Yumuşak hap: %12 tonlu zemin, renkli kalın yazı, gölge yok.
    soft:    { bg: toneSoft, hover: toneSoft.replace('0.12', '0.2'), press: toneSoft.replace('0.12', '0.26'), color: toneColor, border: `1px solid ${toneColor}29` },
    // Beyaz hap: One'ın nötr birincil-olmayan düğmesi — kâğıttan bir tık
    // yukarıda durur, o yüzden zemini panel değil kart rengi.
    // badgeBg/badgeInk: sayaç rozetinin zemini. Beyaz hapta beyaz rozet
    // görünmezdi, o yüzden varyant başına ayrı.
    outline: { badgeBg: C.panel2, badgeInk: C.dim, bg: C.panel, hover: C.panelHover, press: C.panel2, color: tone === 'neutral' ? C.text : toneColor, border: `1px solid ${C.border}`, elev: SH.s1, pressElev: ELEV.pressDark },
    ghost:   { bg: 'transparent', hover: C.panel2, press: C.border, color: toneColor, border: `1px solid ${C.border}` },
    plain:   { bg: 'transparent', hover: C.panel2, press: C.border, color: toneColor, border: '1px solid transparent' },
  };
  const p = variants[variant] || variants.outline;
  const busy = !!loading;
  const off = !!disabled || busy;
  return (
    <motion.button
      onClick={off ? undefined : onClick}
      disabled={off}
      title={title}
      aria-busy={busy || undefined}
      data-state={busy ? 'loading' : disabled ? 'disabled' : 'default'}
      whileTap={off ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      className="gur-admin-btn"
      style={{
        '--btn-bg': p.bg,
        '--btn-bg-hover': p.hover,
        '--btn-bg-press': p.press,
        '--btn-shadow': p.elev || 'none',
        '--btn-shadow-press': p.pressElev || p.elev || 'none',
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: paddings[size], borderRadius: R.pill,
        fontFamily: FB, fontSize: fontSizes[size], fontWeight: 700, letterSpacing: -0.1,
        border: p.border, color: p.color,
        whiteSpace: 'nowrap', outline: 'none', position: 'relative',
      }}>
      {busy ? <Spinner size={fontSizes[size]} color={p.color} /> : icon}
      {busy ? 'Yükleniyor…' : label}
      {/* Sayaç rozeti — uygulamadaki hap dilinin panel karşılığı ("Done ①").
          Zemin hapın kendi tonundan, yoksa turuncu hapta beyaz rozet
          beyaz yazının üstüne biniyor. */}
      {count != null && count !== '' && (
        <span style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: R.pill,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10.5, fontWeight: 800, ...NUM,
          background: p.badgeBg || 'rgba(255,255,255,0.22)',
          color: p.badgeInk || p.color,
        }}>{count}</span>
      )}
    </motion.button>
  );
}

// ─── Kenar çubuğu navigasyon öğesi — seçili durumda kalıcı vurgu, hover/press geri bildirimi ───
function NavItem({ item, active, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={active ? undefined : { backgroundColor: C.panel2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
      className="gur-admin-btn"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', marginBottom: 2, borderRadius: 12, border: 'none',
        backgroundColor: active ? C.panel : 'transparent', cursor: 'pointer',
        boxShadow: active ? SH.s1 : 'none',
        color: active ? C.text : C.dim, fontFamily: FB, fontSize: 13.5, fontWeight: active ? 700 : 500,
        textAlign: 'left', outline: 'none',
      }}>
      <Icon path={item.icon} size={18} color={active ? C.orange : C.faint} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.count !== undefined && (
        <span style={{
          fontSize: 11, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: item.alert ? C.orange : C.panel2, color: item.alert ? C.onBrand : C.dim,
        }}>{item.count}</span>
      )}
    </motion.button>
  );
}

// ─── Icon-only buton — sabit kare hedef, ince kenarlık, hover'da panel rengi ───
function IconBtn({ onClick, icon, size = 38, title, danger, disabled }) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick} title={title} aria-label={title} disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      className="gur-admin-btn gur-admin-icon"
      style={{
        '--btn-bg': C.panel,
        '--btn-bg-hover': danger ? C.redSoft : C.panel2,
        '--btn-bg-press': danger ? 'rgba(229,72,77,0.22)' : C.border,
        '--btn-shadow': SH.s1,
        '--btn-shadow-press': ELEV.pressDark,
        width: size, height: size, minWidth: size, borderRadius: R.control,
        borderWidth: 1, borderStyle: 'solid', borderColor: danger ? `${C.red}44` : C.border,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, position: 'relative', padding: 0, outline: 'none',
      }}>
      {icon}
    </motion.button>
  );
}

// ─── GİRİŞ ───────────────────────────────────────────────────────────────
// Demo seviyesi koruma: doğrulama tarayıcıda yapılır, dolayısıyla gerçek bir
// güvenlik sınırı değildir — panel verisi zaten mock. Gerçek yetkilendirme
// için sunucu tarafı oturum/rol denetimi gerekir (bkz. CLAUDE.md, backend adımı).
const DEMO_USER = 'admin';
const DEMO_PASS = 'gur2026';

function AdminField({ label, value, onChange, type = 'text', autoFocus, onEnter }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: C.dim, marginBottom: 6 }}>{label}</label>
      <input
        type={type} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onEnter?.(); }}
        style={{
          width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9,
          padding: '11px 13px', fontSize: 13.5, color: C.text, fontFamily: FB, outline: 'none',
        }}
        onFocus={e => e.currentTarget.style.borderColor = C.orange}
        onBlur={e => e.currentTarget.style.borderColor = C.border}
      />
    </div>
  );
}

function AdminLogin({ onLogin, theme, onTheme }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  useEffect(() => { api.ensureMode().then(({ mode }) => setLive(mode === 'live')); }, []);

  // Canlı modda parola sunucuda scrypt özetiyle doğrulanır ve dönen
  // belirteç 'admin' rolü taşır; yönetici uçları bu rolü arıyor.
  // Sunucu yoksa panel yalnızca demo veriyle açılır ve bunu söyler.
  const submit = async () => {
    setError('');
    if (live) {
      setBusy(true);
      try { await api.loginAdmin(user.trim(), pass); onLogin(); }
      catch (err) { setError(err.message || 'Giriş yapılamadı.'); }
      finally { setBusy(false); }
      return;
    }
    if (user.trim() === DEMO_USER && pass === DEMO_PASS) onLogin();
    else setError('Kullanıcı adı veya parola hatalı.');
  };

  return (
    <div lang="tr" style={{ minHeight: '100dvh', background: C.bg, fontFamily: FB, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, colorScheme: theme }}>
      <style>{`
        /* Yazı tipleri index.html'den yükleniyor — buraya @import yazmayın. */
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        ${btnCss()}
      `}</style>

      {/* Tema anahtarı girişte de duruyor: koyu temayı seçen kullanıcı
          önce beyaz bir ekranla karşılaşmasın. */}
      <div style={{ position: 'fixed', top: 18, right: 18 }}>
        <IconBtn
          size={32}
          title={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
          onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
          icon={<Icon path={theme === 'dark' ? icons.sun : icons.moon} size={16} color={C.faint} />}
        />
      </div>

      <div style={{ width: '100%', maxWidth: 380, animation: 'fadeIn 0.3s ease-out' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 26 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: '8px 16px', display: 'inline-flex', marginBottom: 14, boxShadow: ELEV.card }}>
            <GurLogo size={26} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>YÖNETİM PANELİ</div>
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>Devam etmek için giriş yapın</div>
        </div>

        <div style={{ ...CARD, padding: '22px 20px' }}>
          <AdminField label="Kullanıcı adı" value={user} onChange={v => { setUser(v); setError(''); }} autoFocus onEnter={submit} />
          <AdminField label="Parola" value={pass} onChange={v => { setPass(v); setError(''); }} type="password" onEnter={submit} />

          {error && (
            <div style={{ background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: 9, padding: '9px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon path={icons.ban} size={14} color={C.redInk} />
              <span style={{ fontSize: 12, color: C.redInk }}>{error}</span>
            </div>
          )}

          <Btn label={busy ? 'Bağlanıyor…' : 'Giriş yap'} onClick={submit} variant="filled" tone="orange" size="md" fullWidth />

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.yellowSoft, border: `1px solid ${C.yellow}33`, borderRadius: 6, padding: '3px 8px', marginBottom: 8 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.yellowInk, letterSpacing: 1 }}>DEMO</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.6 }}>
              Kullanıcı adı <code style={{ color: C.dim, background: C.panel2, padding: '1px 5px', borderRadius: 4 }}>{DEMO_USER}</code>
              {' · '}Parola <code style={{ color: C.dim, background: C.panel2, padding: '1px 5px', borderRadius: 4 }}>{DEMO_PASS}</code>
              <br />{live
                ? 'Sunucuya bağlı: parola scrypt özetiyle sunucuda doğrulanıyor.'
                : 'Sunucu yok — doğrulama tarayıcıda, gerçek koruma sağlamaz.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GurAdmin() {
  // Tema. applyAdminTheme render gövdesinde, JSX üretilmeden ÖNCE
  // çağrılıyor: çocuklar bundan sonra çizildiği için hepsi taze paleti
  // okuyor. Kökteki bu state değişince ağaçta React.memo sınırı olmadığı
  // için her şey yeniden çiziliyor — sayfa, filtre ve arama durumu
  // korunuyor (key ile remount edilseydi kaybolurdu).
  const [theme, setTheme] = useState(adminThemePref);
  applyAdminTheme(theme);
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* depolama kapalı */ }
  }, [theme]);

  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [apps, setApps] = useState(APPLICATIONS);
  const [restaurants, setRestaurants] = useState(RESTAURANTS);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [openRestaurantId, setOpenRestaurantId] = useState(null);
  const [restTab, setRestTab] = useState('list');
  // Fiyatlandırmada seçili hizmet sekmesi; Hizmetler sayfasından da gelinebiliyor.
  const [pricingStream, setPricingStream] = useState('all');
  const [hiddenReviews, setHiddenReviews] = useState(() => new Set());

  const toggleHideReview = (key) => setHiddenReviews(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const approveApp = (id) => {
    const app = apps.find(a => a.id === id);
    setApps(p => p.filter(a => a.id !== id));
    setReviewDoc(null);
    showToast(`${app.name} onaylandı ve yayına alındı`);
  };
  const rejectApp = (id) => {
    const app = apps.find(a => a.id === id);
    setApps(p => p.filter(a => a.id !== id));
    setReviewDoc(null);
    showToast(`${app.name} başvurusu reddedildi`, 'error');
  };
  const toggleGastro = (id) => {
    setRestaurants(p => p.map(r => r.id === id ? { ...r, gastro: !r.gastro } : r));
    const r = restaurants.find(x => x.id === id);
    showToast(r.gastro ? `${r.name} Gastro Onayı kaldırıldı` : `${r.name} Gastro Onaylı yapıldı`);
  };
  const toggleSuspend = (id) => {
    setRestaurants(p => p.map(r => r.id === id ? { ...r, status: r.status === 'active' ? 'suspended' : 'active' } : r));
  };

  // Moderasyon kuyruğundaki toplam iş — kenar çubuğu rozetinde.
  const modQueue = useModeration();
  const medyaDurum = useMedia();
  const medyaBekleyen = mediaPendingCount(medyaDurum);
  const slotDurum = useAdSlots();
  const slotBekleyen = pendingBookingCount(slotDurum);
  // Kenar çubuğundaki Moderasyon sayacı ÜÇ kuyruğu da topluyor: yeni
  // mekan, alan değişikliği ve işletmenin yüklediği dosya. Üçü de aynı
  // sayfada karara bağlanıyor — sayaç birini saymazsa o iş görünmez olur.
  const modCount = pendingChanges(modQueue).length
    + pendingVenues(restaurants, modQueue).length
    + medyaBekleyen;

  // ─── BİLDİRİMLER ───
  // Üç kaynaktan gelen bekleyen iş tek listede. Rozet YALNIZCA görülmemiş
  // teklif taleplerini sayıyor; başvuru ve moderasyon kuyruğunun kendi
  // sayaçları kenar çubuğunda duruyor ve aynı sayıyı iki yerde göstermek
  // "iki ayrı iş var" gibi okunurdu.
  const [bildirimAcik, setBildirimAcik] = useState(false);
  const talepler = useRequests();
  // "Okundu" işareti liste KAPANIRKEN düşüyor, açılırken değil: açılışta
  // işaretlenseydi yeni satırın turuncu noktası aynı karede silinir ve
  // hangisinin yeni geldiği hiç görünmezdi.
  const kapatBildirim = () => { setBildirimAcik(false); markAllSeen(); };
  // Rozet iki kaynağı topluyor: teklif talepleri ve onay bekleyen dosyalar.
  // İkisi de "bir müşteri bekliyor" demek. Başvuru ve moderasyon
  // sayaçları kenar çubuğunda zaten duruyor, onlar rozete girmiyor.
  const bildirimSayisi = unseenCount(talepler) + medyaBekleyen + slotBekleyen;
  const bildirimler = [
    ...openRequests(talepler).map(t => ({
      id: t.id, sayfa: 'pricing',
      baslik: `${t.restaurantName} teklif istedi`,
      alt: `${t.streamName}${t.status === 'quoted' ? ' · teklif gönderildi' : ''}`,
      at: t.at, yeni: !t.seen,
    })),
    ...(slotBekleyen ? [{
      id: 'slots', sayfa: 'adcal',
      baslik: `${slotBekleyen} yayın talebi onayınızı bekliyor`,
      alt: 'banner, ödüllü video ve push takvim rezervasyonları',
      at: null, yeni: true,
    }] : []),
    ...(medyaBekleyen ? [{
      id: 'media', sayfa: 'moderation',
      baslik: `${medyaBekleyen} dosya onayınızı bekliyor`,
      alt: 'işletmelerin yüklediği menü, fotoğraf ve reklam materyali',
      at: null, yeni: true,
    }] : []),
    ...(apps.length ? [{
      id: 'apps', sayfa: 'applications',
      baslik: `${apps.length} sahiplenme başvurusu`,
      alt: 'vergi levhası doğrulaması bekliyor', at: null, yeni: false,
    }] : []),
    ...(modCount ? [{
      id: 'mod', sayfa: 'moderation',
      baslik: `${modCount} kayıt onay bekliyor`,
      alt: 'yeni mekan ve bilgi değişiklikleri', at: null, yeni: false,
    }] : []),
  ];

  /**
   * Yöneticinin elle eklediği restoran. Sahiplenme akışını atlar ve
   * doğrudan yayınlanır — yönetici zaten onaylayan merci, kendi kaydını
   * kendi kuyruğuna atmak boş bir tur olurdu.
   *
   * Kimlik çakışmasın diye mevcut en büyük id'nin bir fazlası: kayıtların
   * bir kısmı canlı beslemeden string id ile geliyor, o yüzden sayıya
   * çevrilebilenlere bakılıyor.
   */
  const createRestaurant = (data) => {
    setRestaurants(prev => {
      const enBuyuk = prev.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      const yeni = {
        id: enBuyuk + 1,
        name: data.name, cat: data.cat, district: data.district,
        addr: data.addr || `${data.district}, İstanbul`,
        phone: data.phone || '', desc: data.desc || '',
        rating: 0, reviews: 0, price: '₺₺',
        status: 'active', account: false, source: 'manual',
        joined: new Date().toISOString().slice(0, 10),
        gastro: false, claimed: false,
        imgs: [], menu: [], popular: [], tags: [],
      };
      return [yeni, ...prev];
    });
    showToast(`${data.name} oluşturuldu ve yayınlandı.`);
  };

  /**
   * Excel/CSV'den gelen toplu kayıt.
   *
   * Tek tek `createRestaurant` çağırmak da çalışırdı (her biri fonksiyonel
   * güncelleme), ama yüz satır için yüz toast çıkardı ve React yüz kez
   * yeniden çizerdi. Tek `setRestaurants`, tek özet.
   */
  const createRestaurantsBulk = (list) => {
    if (!list.length) return;
    setRestaurants(prev => {
      let enBuyuk = prev.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      const yeniler = list.map(data => ({
        id: ++enBuyuk,
        name: data.name, cat: data.cat, district: data.district,
        addr: data.addr || `${data.district}, İstanbul`,
        phone: data.phone || '', desc: data.desc || '',
        rating: 0, reviews: 0, price: '₺₺',
        status: 'active', account: false, source: 'manual',
        joined: new Date().toISOString().slice(0, 10),
        gastro: false, claimed: false,
        imgs: [], menu: [], popular: [], tags: [],
      }));
      return [...yeniler, ...prev];
    });
    showToast(`${list.length} restoran içe aktarıldı ve yayınlandı.`);
  };

  const nav = [
    { id: 'dashboard', label: 'Genel Bakış', icon: icons.dash },
    { id: 'restaurants', label: 'Restoranlar', icon: icons.store, count: restaurants.filter(r => r.account).length },
    { id: 'pool', label: 'Mekan Havuzu', icon: icons.inbox, count: restaurants.filter(r => !r.account).length },
    // Moderasyon havuzun hemen ardında: ikisi de "henüz müşterimiz olmayan
    // kayıt" işi, biri onay bekleyeni biri onaylanmışı gösteriyor.
    { id: 'moderation', label: 'Moderasyon', icon: icons.check, count: modCount, alert: modCount > 0 },
    { id: 'applications', label: 'Başvurular', icon: icons.inbox, count: apps.length, alert: apps.length > 0 },
    { id: 'gastro', label: 'Gastro Onaylı', icon: icons.star },
    { id: 'users', label: 'Kullanıcılar', icon: icons.users },
    { id: 'campaigns', label: 'Kampanyalar', icon: icons.trend, count: 4 },
    { id: 'growth', label: 'Büyüme & Kohort', icon: icons.chart },
    { id: 'revenue', label: 'Gelir & Reklam', icon: icons.money },
    { id: 'services', label: 'Hizmetler', icon: icons.money },
    { id: 'adcal', label: 'Reklam Takvimi', icon: icons.trend, count: slotBekleyen, alert: slotBekleyen > 0 },
    { id: 'pricing', label: 'Fiyatlandırma', icon: icons.trend },
    { id: 'settings', label: 'Ayarlar', icon: icons.settings },
  ];

  // Açık restoran her zaman güncel kayıttan okunur; rozet/durum değişince
  // detay ekranı da anında tazelenir.
  const openRestaurant = openRestaurantId == null ? null : restaurants.find(r => r.id === openRestaurantId) || null;
  const pageTitle = openRestaurant ? openRestaurant.name : (nav.find(n => n.id === page)?.label || 'Genel Bakış');

  const goPage = (id) => { setOpenRestaurantId(null); setQuery(''); setPage(id); };
  // Gelir tablosundan müşteriye geçiş: aynı işletme kaydı, tek tıkla.
  const openStore = (id) => { setPage('restaurants'); setRestTab('list'); setOpenRestaurantId(id); };

  const logout = () => { setAuthed(false); setPage('dashboard'); setQuery(''); setReviewDoc(null); setOpenRestaurantId(null); setRestTab('list'); };

  // Giriş yapılmadan panel hiç render edilmez
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} theme={theme} onTheme={setTheme} />;

  return (
    // lang: Türkçe büyük harf kuralı (i→İ). Artifact kabuğunda <html lang>
    // bize ait değil, o yüzden kökte bildiriyoruz.
    <div lang="tr" style={{ display: 'flex', height: '100dvh', background: C.bg, fontFamily: FB, color: C.text, overflow: 'hidden', colorScheme: theme }}>
      <style>{`
        /* Yazı tipleri index.html'den yükleniyor — buraya @import yazmayın:
           @import stil sayfasında ilk sırada olmak zorunda, aşağıdaki
           kurallardan sonra gelseydi tarayıcı sessizce atardı. */
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D3D8E0; border-radius: 5px; border: 3px solid transparent; background-clip: content-box; }
        ::-webkit-scrollbar-thumb:hover { background: #B9C0CC; background-clip: content-box; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .row-hover:hover { background: ${C.panel2} !important; }
        h1, h2, h3 { font-family: ${FB}; font-weight: 800; letter-spacing: -0.02em; }

        ${btnCss()}
      `}</style>

      {/* ─── SIDEBAR ─── */}
      <aside style={{ width: 248, background: C.panel2, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '6px 12px', display: 'inline-flex' }}>
            <GurLogo size={22} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>YÖNETİM</div>
            <div style={{ fontSize: 10, color: C.faint }}>Kontrol Merkezi</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
          {nav.map(item => {
            const active = page === item.id;
            return <NavItem key={item.id} item={item} active={active} onClick={() => goPage(item.id)} />;
          })}
        </nav>

        <div style={{ padding: '12px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#FF7A1A,#F04E00)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: C.onBrand }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Admin</div>
              <div style={{ fontSize: 10.5, color: C.faint }}>admin@gur.app</div>
            </div>
            <IconBtn
              size={30}
              title={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              icon={<Icon path={theme === 'dark' ? icons.sun : icons.moon} size={16} color={C.faint} />}
            />
            <IconBtn size={30} title="Çıkış yap" danger onClick={logout} icon={<Icon path={icons.logout} size={16} color={C.faint} />} />
          </div>
        </div>
      </aside>

      {/* ─── ANA İÇERİK ─── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Üst bar */}
        <header style={{ height: 64, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 20, flexShrink: 0, background: C.panel }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{pageTitle}</h1>
          <div style={{ flex: 1 }} />
          {SEARCHABLE[page] && (
            <SearchBar value={query} onChange={setQuery} placeholder={SEARCHABLE[page]} />
          )}
          {/* Çan artık gerçekten çalışıyor: üç kaynaktan gelen bekleyen
              işi tek listede topluyor ve satıra basınca ilgili sayfaya
              gidiyor. Eskiden yalnızca bir nokta çiziyordu, tıklanınca
              hiçbir şey olmuyordu — çalışmayan bir bildirim, olmayandan
              kötüdür. */}
          <div style={{ position: 'relative' }}>
            <IconBtn
              title="Bildirimler"
              onClick={() => (bildirimAcik ? kapatBildirim() : setBildirimAcik(true))}
              icon={<>
                <Icon path={icons.bell} size={17} color={C.dim} />
                {bildirimSayisi > 0 && (
                  <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16,
                    padding: '0 4px', borderRadius: R.pill, background: C.orange, color: C.onBrand,
                    border: `2px solid ${C.panel}`, fontSize: 9.5, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {bildirimSayisi}
                  </span>
                )}
              </>}
            />
            <AnimatePresence>
              {bildirimAcik && (
                <NotificationList
                  items={bildirimler}
                  onClose={kapatBildirim}
                  onGo={(sayfa) => { kapatBildirim(); goPage(sayfa); }}
                />
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Sayfa içeriği */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {page === 'dashboard' && <DashboardPage restaurants={restaurants} />}
          {page === 'restaurants' && (openRestaurant
            ? <RestaurantDetailPage r={openRestaurant} onBack={() => setOpenRestaurantId(null)} onGastro={toggleGastro} onSuspend={toggleSuspend} />
            : <RestaurantsWorkspace
                restaurants={restaurants} query={query}
                tab={restTab} onTab={setRestTab}
                onSuspend={toggleSuspend} onOpen={setOpenRestaurantId}
                hidden={hiddenReviews} onHide={toggleHideReview} />)}
          {page === 'applications' && <ApplicationsPage apps={apps} query={query} onReview={setReviewDoc} onApprove={approveApp} onReject={rejectApp} />}
          {page === 'gastro' && <GastroPage restaurants={restaurants} onGoRestaurants={() => goPage('restaurants')} />}
          {page === 'users' && <UsersPage query={query} />}
          {page === 'campaigns' && <CampaignsPage query={query} />}
          {page === 'growth' && <GrowthPage />}
          {page === 'revenue' && <RevenuePage restaurants={restaurants} onOpenStore={openStore} />}
          {page === 'pool' && <VenuePoolPage restaurants={restaurants} query={query} onOpen={openStore} />}
          {page === 'moderation' && (
            <ModerationPage restaurants={restaurants} query={query}
              onCreate={createRestaurant} onCreateMany={createRestaurantsBulk}
              onOpen={setOpenRestaurantId} />)}
          {page === 'services' && (
            <ServicesPage restaurants={restaurants} query={query}
              onOpenStream={k => { setQuery(''); setPricingStream(k); setPage('pricing'); }} />)}
          {page === 'pricing' && (
            <PricingPage restaurants={restaurants} query={query}
              stream={pricingStream} onStream={setPricingStream} />)}
          {page === 'adcal' && <AdCalendarPage restaurants={restaurants} query={query} />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>

      {/* ─── Başvuru inceleme modalı — perde soluklaşır, kart "materialize" olur (§12) ─── */}
      <AnimatePresence>
      {reviewDoc && (
        <motion.div
          onClick={() => setReviewDoc(null)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', bounce: 0.1, duration: 0.3 }}
            style={{ width: 560, maxHeight: '88vh', overflowY: 'auto', background: C.panel, borderRadius: 16, border: `1px solid ${C.border}` }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{reviewDoc.name}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.dim }}>{reviewDoc.cat} • {reviewDoc.district}</p>
              </div>
              <IconBtn onClick={() => setReviewDoc(null)} size={32} title="Kapat" icon={<Icon path={icons.x} size={16} color={C.dim} />} />
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {[
                  ['İşletme Sahibi', reviewDoc.owner], ['Vergi No', reviewDoc.taxNo],
                  ['Vergi Dairesi', reviewDoc.taxOffice], ['Başvuru', reviewDoc.submitted],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Vergi levhası önizleme */}
              <div style={{ fontSize: 11, color: C.faint, marginBottom: 8 }}>VERGİ LEVHASI</div>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
                <Icon path={icons.doc} size={44} color={C.faint} />
                <div style={{ fontSize: 13, color: C.dim }}>vergi_levhasi_{reviewDoc.id}.pdf</div>
                <div style={{ marginTop: 4 }}>
                  <Btn label="Belgeyi Görüntüle" variant="soft" tone="blue" icon={<Icon path={icons.eye} size={14} color={C.blue} />} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Btn label="Reddet" onClick={() => rejectApp(reviewDoc.id)} variant="soft" tone="red" size="lg" fullWidth icon={<Icon path={icons.x} size={16} color={C.redInk} />} />
                </div>
                <div style={{ flex: 2 }}>
                  <Btn label="Onayla ve Yayına Al" onClick={() => approveApp(reviewDoc.id)} variant="filled" tone="green" size="lg" fullWidth icon={<Icon path={icons.check} size={16} color="#fff" />} />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ─── Toast — geldiği kenardan geri gider (§7) ─── */}
      <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
          style={{ position: 'fixed', bottom: 24, right: 24, background: toast.type === 'error' ? C.red : C.green, color: '#fff', padding: '12px 20px', borderRadius: 12, fontFamily: FB, fontSize: 13.5, fontWeight: 600, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8, boxShadow: SH.d3 }}>
          <Icon path={toast.type === 'error' ? icons.x : icons.check} size={16} color="#fff" />
          {toast.msg}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

// ═══ SAYFALAR ═══

// ─── One'ın bölmeli denetimi ─────────────────────────────────────────────
// Referans panonun imzası: gri kanal, seçili seçenek beyaz hap olarak
// yükseliyor. Zaman aralığı ve dönem seçimlerinin tamamı bundan geçiyor.
function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{
      display: 'inline-flex', gap: 3, background: C.panel2,
      border: `1px solid ${C.border}`, borderRadius: R.pill, padding: 3,
    }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <button
            key={o.id} type="button" onClick={() => onChange(o.id)}
            aria-pressed={on} className="gur-admin-btn"
            style={{
              border: on ? `1px solid ${C.border}` : '1px solid transparent',
              borderRadius: R.pill, padding: '5px 12px',
              background: on ? C.panel : 'transparent',
              boxShadow: on ? SH.s1 : 'none',
              color: on ? C.text : C.dim,
              fontFamily: FB, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
              outline: 'none',
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────
// Tablo satırındaki 24 saatlik eğilim. Tek seri olduğu için gösterge yok;
// renk tek başına bilgi taşımasın diye yanındaki sütun yüzdeyi ▲/▼ ile
// yazıyor — sparkline onu tekrar ediyor, tek kaynağı değil.
function Sparkline({ points, up, w = 78, h = 26 }) {
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((v, i) => {
    const x = (i / (points.length - 1)) * (w - 2) + 1;
    const y = h - 3 - ((v - min) / span) * (h - 6);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden focusable="false" style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={up ? C.greenInk : C.redInk} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Tek serili çizgi grafik ─────────────────────────────────────────────
// Tek seri: gösterge kutusu yok, başlık seriyi zaten adlandırıyor. Her
// noktaya sayı yazılmıyor — yalnızca tepe noktası etiketli, gerisi
// imleçle geliyor. Izgara ve eksen geri planda: veri önde.
function TrendChart({ data, height = 200, format }) {
  const wrap = useRef(null);
  const [w, setW] = useState(560);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // padX uç etiketin yarısını içeride tutar: text-anchor=middle olduğu için
  // 6px payla "Pzt" ve "Paz" kartın dışına taşıyordu.
  const padT = 18, padB = 26, padX = 26;
  const values = data.map(d => d.v);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const plotH = height - padT - padB;
  const xAt = i => padX + (i / (data.length - 1)) * (w - padX * 2);
  const yAt = v => padT + plotH - ((v - min) / span) * plotH;

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(d.v).toFixed(1)}`).join(' ');
  const area = `${line} L${xAt(data.length - 1).toFixed(1)} ${padT + plotH} L${xAt(0).toFixed(1)} ${padT + plotH} Z`;
  const peak = values.indexOf(max);
  const active = hover == null ? null : data[hover];

  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - r.left - padX) / (r.width - padX * 2);
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
  };

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={w} height={height} viewBox={`0 0 ${w} ${height}`}
        role="img" aria-label={`Günlere göre eğilim. En yüksek ${data[peak].d}: ${format(max)}.`}
        onMouseMove={pick} onMouseLeave={() => setHover(null)}
        style={{ display: 'block', touchAction: 'none' }}>
        <defs>
          <linearGradient id="gur-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.orange} stopOpacity="0.16" />
            <stop offset="100%" stopColor={C.orange} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Izgara: geri planda, dört yatay çizgi */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={padX} x2={w - padX} y1={padT + plotH * t} y2={padT + plotH * t}
            stroke={C.border} strokeWidth="1" />
        ))}

        {/* İmlecin durduğu gün: yumuşak bir sütun, kesikli tarama değil */}
        {active && (
          <rect x={xAt(hover) - (w / data.length) / 2} y={padT - 6}
            width={w / data.length} height={plotH + 12}
            fill={C.orange} opacity="0.07" rx="8" />
        )}

        <path d={area} fill="url(#gur-trend-fill)" />
        <path d={line} fill="none" stroke={C.orange} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Tepe noktası her zaman etiketli; gerisi imleçle */}
        <circle cx={xAt(peak)} cy={yAt(max)} r="4" fill={C.panel} stroke={C.orange} strokeWidth="2" />
        {active && (
          <>
            <line x1={xAt(hover)} x2={xAt(hover)} y1={padT - 6} y2={padT + plotH}
              stroke={C.orange} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={xAt(hover)} cy={yAt(active.v)} r="5.5" fill={C.orange} stroke={C.panel} strokeWidth="2" />
          </>
        )}

        {data.map((d, i) => (
          <text key={d.d} x={xAt(i)} y={height - 8}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            style={{ fontFamily: FB, fontSize: 11, fontWeight: hover === i ? 700 : 500 }}
            dx={i === 0 ? -padX + 2 : i === data.length - 1 ? padX - 2 : 0}
            fill={hover === i ? C.text : C.faint}>{d.d}</text>
        ))}
      </svg>

      {/* İpucu: referanstaki koyu kutu. Sayı mono, etiket metin jetonunda. */}
      {active && (
        <div role="status" style={{
          position: 'absolute', left: Math.min(Math.max(xAt(hover) - 62, 0), Math.max(w - 124, 0)),
          top: 0, width: 124, pointerEvents: 'none',
          background: C.tooltipBg, color: '#fff', borderRadius: 12, padding: '9px 11px',
          boxShadow: SH.d3,
        }}>
          <div style={{ fontFamily: FB, fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>{active.d}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.orange, flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, fontWeight: 700, ...NUM }}>{format(active.v)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Sayarak artan KPI değeri.
 *
 * KpiCard'a değer HAZIR BİÇİMLENMİŞ dizge olarak geliyor ("4.230", "₺939K",
 * "%58"). Her çağrı yerini ham sayıya çevirmek yerine dizgeyi ayırıyoruz:
 * baştaki ek (₺, %), sayı, sondaki ek (K, M). Yalnızca sayı sayıyor.
 *
 * Animasyon bitince EKRANDA ORİJİNAL DİZGE duruyor — biçimlendirmeyi
 * yeniden üretmeye çalışsaydık binlik ayıracı ya da ondalık sayıda
 * sessiz bir kayma olabilirdi. Ekran okuyucu da baştan sonu görüyor;
 * ara değerleri okumak işkence olurdu.
 */
// Ekrandan gizli ama ekran okuyucunun gördüğü metin. `clip` tek başına
// yetmiyordu: 1x1 kutu yerleşimde kalıyor ve bazı tarayıcılarda yazı
// sızıyordu (panoda sayının altında ikinci bir satır beliriyordu).
// clipPath + nowrap + negatif kenar boşluğu standart tarif.
const SR_ONLY = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0,
  border: 0, overflow: 'hidden', whiteSpace: 'nowrap',
  clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)',
};

function AnimatedNumber({ value, duration = 1.0 }) {
  const metin = String(value);

  // DİKKAT: `match` her çağrıda YENİ bir dizi döndürür. Bu diziyi
  // doğrudan useEffect'in bağımlılık listesine koymak animasyonu
  // öldürüyordu: effect setV yapıyor → yeniden çizim → yeni dizi →
  // bağımlılık değişti sayılıp effect iptal edilip baştan başlıyor →
  // t0 sıfırlanıyor → sayaç ilk karede (g≈0.016) donup kalıyor.
  // Panoda 342 yerine 17, ₺493K yerine ₺24K görünmesinin sebebi buydu.
  // useMemo kimliği `metin`e bağlıyor; metin değişmedikçe dizi de aynı.
  const m = React.useMemo(() => metin.match(/^(\D*)([\d.,]+)(.*)$/), [metin]);

  const reduced = React.useMemo(() => {
    try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }, []);
  const hedef = m ? Number(m[2].replace(/\./g, '').replace(',', '.')) : NaN;
  const ondalik = m && m[2].includes(',') ? m[2].split(',')[1].length : 0;
  const [bitti, setBitti] = useState(false);
  const [v, setV] = useState(0);

  useEffect(() => {
    if (!m || !Number.isFinite(hedef) || reduced) { setBitti(true); return; }
    setBitti(false);
    let raf, t0 = null;
    const adim = (t) => {
      if (t0 === null) t0 = t;
      const g = Math.min(1, (t - t0) / (duration * 1000));
      // easeOutCubic: hızlı başlar, sona doğru yavaşlar. Doğrusal sayma
      // mekanik duruyor.
      setV(hedef * (1 - Math.pow(1 - g, 3)));
      if (g < 1) raf = requestAnimationFrame(adim); else setBitti(true);
    };
    raf = requestAnimationFrame(adim);
    return () => cancelAnimationFrame(raf);
    // Aynı sayı farklı biçimde gelirse (₺939K → ₺1.02M) animasyon baştan
    // başlasın diye bağımlılık `metin` üzerinden; `m` onunla birlikte
    // değişiyor, ayrıca listelemeye gerek yok.
  }, [metin, m, hedef, duration, reduced]);

  if (!m || !Number.isFinite(hedef) || bitti) return <>{metin}</>;
  const ara = v.toLocaleString('tr', { minimumFractionDigits: ondalik, maximumFractionDigits: ondalik });
  return (
    <>
      <span aria-hidden="true">{m[1]}{ara}{m[3]}</span>
      <span style={SR_ONLY}>{metin}</span>
    </>
  );
}

function KpiCard({ label, value, delta, deltaUp, deltaNeutral, icon, accent }) {
  return (
    <div style={{ ...CARD, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon path={icon} size={20} color={accent.color} />
        </div>
        {delta && (
          // Nötr delta: artış/azalış değil, bilgi (örn. "açılmamış potansiyel").
          // Ok ve renk kodu kullanılmaz ki yanlış okunmasın.
          <span style={{
            fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '4px 9px', borderRadius: R.pill,
            color: deltaNeutral ? C.dim : (deltaUp ? C.greenInk : C.redInk),
            background: deltaNeutral ? C.panel2 : (deltaUp ? C.greenSoft : C.redSoft),
          }}>
            {deltaNeutral ? '' : (deltaUp ? '▲' : '▼')} {delta}
          </span>
        )}
      </div>
      <div style={{ fontSize: 27, fontWeight: 700, marginBottom: 3, ...NUM }}><AnimatedNumber value={value} /></div>
      <div style={{ fontSize: 12.5, color: C.dim }}>{label}</div>
    </div>
  );
}

// ─── Eğilim aralıkları ───────────────────────────────────────────────────
// Aralık düğmeleri gerçekten veri değiştiriyor: seçili aralığın kendi
// serisi ve kendi toplamı var, yalnızca etiket değişmiyor.
const TREND_RANGES = {
  '1g': { label: '1G', unit: 'saat', data: [
    { d: '00', v: 4200 }, { d: '04', v: 1830 }, { d: '08', v: 6740 }, { d: '12', v: 11260 },
    { d: '16', v: 9480 }, { d: '20', v: 14930 }, { d: '23', v: 8710 }] },
  '7g': { label: '7G', unit: 'gün', data: SWIPE_TREND },
  '1a': { label: '1A', unit: 'hafta', data: [
    { d: '1. hf', v: 842000 }, { d: '2. hf', v: 791000 }, { d: '3. hf', v: 918000 },
    { d: '4. hf', v: 1052000 }] },
  '1y': { label: '1Y', unit: 'ay', data: [
    { d: 'Oca', v: 412000 }, { d: 'Şub', v: 468000 }, { d: 'Mar', v: 523000 },
    { d: 'Nis', v: 611000 }, { d: 'May', v: 702000 }, { d: 'Haz', v: 684000 },
    { d: 'Tem', v: 759000 }, { d: 'Ağu', v: 838000 }, { d: 'Eyl', v: 892000 }] },
};
const RANGE_OPTS = Object.entries(TREND_RANGES).map(([id, r]) => ({ id, label: r.label }));

// Kaydırma sayısı kısaltması — grafikte ve ipucunda aynı biçim.
function swipes(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

// Bir mekânın panodaki hareket satırı: id'den deterministik üretilir, o
// yüzden sayfalar arasında gezerken sayılar zıplamıyor.
function movement(r) {
  const rnd = seeded(r.id * 7 + 3);
  const base = 2400 + Math.round(rnd() * 21000);
  const trend = Array.from({ length: 14 }, () => rnd());
  const ch24 = (rnd() * 74 - 29);
  const ch7 = (rnd() * 68 - 24);
  return {
    swipes: base,
    favs: Math.round(base * (0.06 + rnd() * 0.11)),
    ch24, ch7,
    points: trend.map((t, i) => base * (0.72 + t * 0.5 + (ch24 > 0 ? i * 0.012 : -i * 0.008))),
    revenue: storeMonthly(r),
  };
}

function ChangeCell({ value }) {
  const up = value >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      color: up ? C.greenInk : C.redInk, fontSize: 12.5, fontWeight: 700, ...NUM,
    }}>
      <span aria-hidden>{up ? '↗' : '↘'}</span>
      {up ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function DashboardPage({ restaurants = [] }) {
  const [range, setRange] = useState('7g');
  const [period, setPeriod] = useState('month');
  const [tableRange, setTableRange] = useState('7g');
  const [q, setQ] = useState('');

  const series = TREND_RANGES[range];
  const total = series.data.reduce((a, d) => a + d.v, 0);
  const first = series.data[0].v, last = series.data[series.data.length - 1].v;
  const delta = ((last - first) / (first || 1)) * 100;

  const totalCat = CAT_DIST.reduce((a, c) => a + c.count, 0);
  const leaders = CAT_DIST.slice(0, 3);
  const leaderMax = Math.max(...leaders.map(c => c.count));

  const rows = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    return restaurants
      // Satırda ad, kategori ve ilçe yazıyor — üçü de aranabilmeli.
      .filter(r => !needle || [r.name, r.cat, r.district]
        .some(v => v && v.toLocaleLowerCase('tr').includes(needle)))
      .map(r => ({ r, m: movement(r) }))
      .sort((a, b) => b.m.swipes - a.m.swipes)
      .slice(0, 7);
  }, [restaurants, q]);

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      {/* Dört ölçü — panonun tepesindeki özet */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Toplam Restoran" value={STATS.totalRestaurants} delta="8%" deltaUp icon={icons.store} accent={{ color: C.orangeInk, soft: C.orangeSoft }} />
        <KpiCard label="Günlük Aktif Kullanıcı" value={STATS.dailyActive.toLocaleString('tr')} delta="12%" deltaUp icon={icons.users} accent={{ color: C.blue, soft: C.blueSoft }} />
        <KpiCard label="Bekleyen Başvuru" value={STATS.pendingApps} icon={icons.inbox} accent={{ color: C.yellowInk, soft: C.yellowSoft }} />
        {/* Ciro tek yerden: Gelir sayfasıyla aynı toplam (PLATFORM_TOTAL) */}
        <KpiCard label="Aylık Ciro" value={money(PLATFORM_TOTAL)} delta="18%" deltaUp icon={icons.money} accent={{ color: C.greenInk, soft: C.greenSoft }} />
      </div>

      {/* Referans düzen: solda dar liderler kartı, sağda geniş grafik */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(360px, 1.9fr)', gap: 16, marginBottom: 16 }}>

        {/* Kategori liderleri */}
        <section style={{ ...CARD, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Kategori liderleri</h3>
            <Segmented label="Dönem" value={period} onChange={setPeriod}
              options={[{ id: 'week', label: 'Hafta' }, { id: 'month', label: 'Ay' }]} />
          </div>

          {/* İlk üç: azalan doygunlukta şeritler. Yüzde şeridin üstünde
              yazıyor — renk tek başına sıralamayı taşımıyor. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 8 }}>
            {leaders.map((c, i) => (
              <div key={c.name} style={{ borderLeft: i ? `1px solid ${C.border}` : 'none', paddingLeft: i ? 10 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 7, color: C.greenInk, fontSize: 11.5, fontWeight: 700, ...NUM }}>
                  <span aria-hidden>▲</span>{(period === 'week' ? 1.3 + i * 0.9 : 3.1 - i * 0.9).toFixed(1)}%
                </div>
                <div style={{ height: 14, borderRadius: 4, background: C.orange, opacity: 1 - i * 0.32, width: `${(c.count / leaderMax) * 100}%`, minWidth: 12 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.faint, marginBottom: 16 }}>
            <span>{period === 'week' ? '1 Eyl' : '1 Haz'}</span><span>{period === 'week' ? '7 Eyl' : '30 Eyl'}</span>
          </div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {CAT_DIST.map((c, i) => (
              <li key={c.name} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderTop: i ? `1px solid ${C.border}` : 'none',
              }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12.5, color: C.text, fontWeight: 600 }}>{c.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, ...NUM }}>{c.count}</span>
                <span style={{ fontSize: 11, color: C.faint, ...NUM, minWidth: 40, textAlign: 'right' }}>
                  %{((c.count / totalCat) * 100).toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Kaydırma hacmi */}
        <section style={{ ...CARD, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: 12.5, color: C.dim }}>Kaydırma hacmi</p>
              <div style={{ fontSize: 32, fontWeight: 700, margin: '4px 0 6px', ...NUM }}>{swipes(total)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <ChangeCell value={delta} />
                <span style={{ fontSize: 11.5, color: C.faint }}>ilk {series.unit}e göre</span>
              </div>
            </div>
            <Segmented label="Zaman aralığı" value={range} onChange={setRange} options={RANGE_OPTS} />
          </div>
          <div style={{ marginTop: 10 }}>
            <TrendChart key={range} data={series.data} format={swipes} />
          </div>
        </section>
      </div>

      {/* Mekân hareketi — referanstaki işlem tablosunun karşılığı */}
      <section style={{ ...CARD, overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', flexWrap: 'wrap' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: C.orangeSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon path={icons.trend} size={19} color={C.orangeInk} />
          </div>
          <div style={{ flex: 1, minWidth: 170 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Mekân hareketi</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: C.dim }}>En çok kaydırılan mekanlar ve eğilimleri</p>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Mekân ara" aria-label="Mekân ara"
              style={{
                width: 190, background: C.panel2, border: `1px solid ${C.border}`,
                borderRadius: R.pill, padding: '8px 14px 8px 34px',
                fontSize: 12.5, fontFamily: FB, color: C.text, outline: 'none',
              }}
              onFocus={e => e.currentTarget.style.borderColor = C.orange}
              onBlur={e => e.currentTarget.style.borderColor = C.border} />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <Icon path={icons.search} size={14} color={C.faint} />
            </span>
          </div>
          <Segmented label="Tablo aralığı" value={tableRange} onChange={setTableRange} options={RANGE_OPTS} />
        </header>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: C.panel2, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
                {['Mekân', 'Kaydırma', '24s değişim', '7g değişim', 'Favori', '24s eğilim', 'Aylık ciro'].map((h, i) => (
                  <th key={h} style={{
                    textAlign: i === 0 ? 'left' : 'right', padding: '12px 18px',
                    fontSize: 11.5, fontWeight: 700, color: C.dim, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, m }) => (
                <tr key={r.id} className="row-hover" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <StoreAvatar restaurant={r} size={34} radius={11} font={13} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap' }}>{r.cat} · {r.district}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13, fontWeight: 700, ...NUM }}>{swipes(m.swipes)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}><ChangeCell value={m.ch24} /></td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}><ChangeCell value={m.ch7} /></td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 12.5, color: C.dim, ...NUM }}>{m.favs.toLocaleString('tr')}</td>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Sparkline points={m.points} up={m.ch24 >= 0} />
                    </div>
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13, fontWeight: 700, ...NUM }}>{m.revenue ? money(m.revenue) : <span style={{ color: C.faint, fontWeight: 500 }}>—</span>}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} style={{ padding: '36px 18px', textAlign: 'center', color: C.faint, fontSize: 13 }}>
                  “{q}” için mekân bulunamadı.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/**
 * Ortak modal kabuğu. Başvuru inceleme modalıyla aynı dil: perde
 * soluklaşır, kart materyal gibi gelir (§12). İki yeni akış (moderasyon
 * incelemesi ve restoran oluşturma) aynı kabuğu kullanıyor — üçüncü bir
 * kopya çıkarmak yerine burada toplandı.
 */
function Modal({ title, subtitle, onClose, children, width = 560 }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(10,12,16,0.55)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={title}
        style={{ ...CARD, boxShadow: ELEV.raised, width: '100%', maxWidth: width,
          maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</div>
            {subtitle && <div style={{ fontFamily: FB, fontSize: 12, color: C.dim, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>}
          </div>
          <IconBtn onClick={onClose} size={32} title="Kapat" icon={<Icon path={icons.x} size={16} color={C.dim} />} />
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Hangi sayfada arama var ve orada NE aranıyor. Boş bırakılan sayfada
 * kutu hiç çizilmiyor: çalışmayan bir arama kutusu, olmayan aramadan
 * daha kötü.
 */
/**
 * REKLAM TAKVİMİ — sabit fiyatlı üç kalem: fiyat, doluluk, onay.
 *
 * Üç iş tek sayfada çünkü üçü de aynı soruyu soruyor: "bu reklam ne zaman,
 * kimde, kaça." Fiyatı Fiyatlandırma sayfasına koymak yanlış olurdu — orası
 * PAZARLIKLI kalemlerin yeri ve bu üçünde pazarlık yok.
 *
 * Kota ve doluluk kuralı burada HESAPLANMIYOR: `canBook` tek karar noktası
 * (lib/adslots.js). Yönetici yerleştirmesi de aynı kapıdan geçiyor — kendi
 * koyduğu kuralı yöneticinin delebilmesi, kuralı kural olmaktan çıkarırdı.
 */
function AdCalendarPage({ restaurants = [], query = '' }) {
  const durum = useAdSlots();
  const [urun, setUrun] = useState('bannerAds');
  const [ay, setAy] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [fiyatDuzenle, setFiyatDuzenle] = useState(null);
  const [fiyatTaslak, setFiyatTaslak] = useState('');
  const [yerlestir, setYerlestir] = useState(null);   // { start }
  const [yerGun, setYerGun] = useState(1);
  const [secilenRest, setSecilenRest] = useState('');
  const [hata, setHata] = useState('');

  const p = AD_PRODUCTS[urun];
  const q = query.trim().toLocaleLowerCase('tr');
  const bekleyen = pendingBookings(durum)
    .filter(b => !q || String(b.restaurantName || '').toLocaleLowerCase('tr').includes(q));
  const hucreler = monthGrid(ay.y, ay.m);
  const bugun = adToday();

  const adOf = (rid) => restaurants.find(r => String(r.id) === String(rid))?.name || `#${rid}`;
  const musteriler = restaurants.filter(r => r.account);

  const kaydetFiyat = () => {
    setPrice(fiyatDuzenle, fiyatTaslak);
    setFiyatDuzenle(null);
  };

  const yerlestirOnayla = () => {
    try {
      const r = musteriler.find(x => String(x.id) === String(secilenRest));
      if (!r) { setHata('Restoran seçilmedi.'); return; }
      adminBook({ streamKey: urun, restaurantId: r.id, restaurantName: r.name,
        start: yerlestir.start, days: yerGun });
      setYerlestir(null); setYerGun(1); setSecilenRest(''); setHata('');
    } catch (e) { setHata(e.message || 'Yerleştirilemedi.'); }
  };

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      {/* ─── FİYATLAR ─── */}
      <section style={{ ...CARD, overflow: 'hidden', marginBottom: 18 }}>
        <SectionHead title="Sabit fiyatlar" right="pazarlık yok — liste fiyatı" />
        {AD_KEYS.map(k => {
          const pr = AD_PRODUCTS[k];
          return (
            <div key={k} style={{ padding: '13px 18px', borderTop: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{pr.name}</div>
                <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>{pr.rule}</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 110 }}>
                <div style={{ fontSize: 15, fontWeight: 800, ...NUM }}>
                  {money(priceOf(k, durum))}
                </div>
                <div style={{ fontFamily: FB, fontSize: 11, color: C.faint }}>/ gün · en fazla {pr.maxDays} gün</div>
              </div>
              <Btn label="Fiyatı değiştir" size="sm" variant="outline"
                onClick={() => { setFiyatDuzenle(k); setFiyatTaslak(String(priceOf(k, durum))); }} />
            </div>
          );
        })}
        <div style={{ padding: '11px 18px', borderTop: `1px solid ${C.border}`,
          fontFamily: FB, fontSize: 11.5, color: C.faint, lineHeight: 1.55 }}>
          Fiyatlar <b>günlük</b>. Bedel = günlük fiyat × seçilen gün. Fiyat
          değişikliği <b>geçmişe işlemez</b>: her rezervasyon kendi günlük
          bedelini talep anında donduruyor.
        </div>
      </section>

      {/* ─── ONAY BEKLEYEN TALEPLER ─── */}
      {bekleyen.length > 0 && (
        <section style={{ ...CARD, overflow: 'hidden', marginBottom: 18, borderColor: C.orangeInk }}>
          <SectionHead title="Onay bekleyen yayın talepleri" right={`${bekleyen.length} talep`} />
          {bekleyen.map(b => (
            <div key={b.id} style={{ padding: '13px 18px', borderTop: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 230 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{b.restaurantName || adOf(b.restaurantId)}</div>
                <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                  {AD_PRODUCTS[b.streamKey]?.name || b.streamKey} · {prettyDay(b.start)}
                  {b.start !== b.end ? ` – ${prettyDay(b.end)}` : ''} · {(b.days ?? gunFarki(b.start, b.end) + 1)} gün · {money(b.priceMinor)}
                </div>
              </div>
              <Btn label="Onayla" size="sm" variant="filled" tone="green"
                onClick={() => decideBooking(b.id, 'approved')} />
              <Btn label="Reddet" size="sm" variant="soft" tone="red"
                onClick={() => decideBooking(b.id, 'rejected', 'Yönetici reddetti.')} />
            </div>
          ))}
        </section>
      )}

      {/* ─── TAKVİM ─── */}
      <section style={{ ...CARD, overflow: 'hidden' }}>
        <SectionHead title="Yayın takvimi" right={p.rule} />
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center',
          gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${C.border}` }}>
          <Segmented value={urun} onChange={setUrun} label="Reklam kalemi"
            options={AD_KEYS.map(k => ({ id: k, label: AD_PRODUCTS[k].name }))} />
          <div style={{ flex: 1 }} />
          <Btn label="◀" size="sm" variant="outline" title="Önceki ay"
            onClick={() => setAy(a => a.m === 0 ? { y: a.y - 1, m: 11 } : { y: a.y, m: a.m - 1 })} />
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 108, textAlign: 'center' }}>
            {AD_MONTHS[ay.m]} {ay.y}
          </span>
          <Btn label="▶" size="sm" variant="outline" title="Sonraki ay"
            onClick={() => setAy(a => a.m === 11 ? { y: a.y + 1, m: 0 } : { y: a.y, m: a.m + 1 })} />
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {AD_WEEKDAYS.map(g => (
              <div key={g} style={{ textAlign: 'center', fontFamily: FB, fontSize: 11,
                fontWeight: 700, color: C.faint }}>{g}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {hucreler.map((gun, i) => {
              if (!gun) return <div key={`b${i}`} />;
              const d = dayState(urun, gun, durum);
              const gecmis = gun < bugun;
              const dolu = d.status !== 'free';
              return (
                <button key={gun} type="button"
                  onClick={() => { if (!gecmis) { setYerlestir({ start: gun }); setHata(''); } }}
                  disabled={gecmis}
                  title={dolu ? d.bookings.map(b => `${b.restaurantName} (${b.status === 'approved' ? 'onaylı' : 'bekliyor'})`).join(', ') : gun}
                  style={{
                    minHeight: 62, borderRadius: 9, padding: '6px 7px', textAlign: 'left',
                    border: `1px solid ${dolu ? (d.status === 'approved' ? C.green : C.yellow) + '66' : C.border}`,
                    background: gecmis ? C.bg
                      : d.status === 'approved' ? C.greenSoft
                      : d.status === 'pending' ? C.yellowSoft : C.panel,
                    cursor: gecmis ? 'default' : 'pointer', outline: 'none',
                  }}>
                  {/* Geçmiş gün OPACITY ile soluklaştırılmıyor: bu kural
                      projede yasak (etiketi ~2:1'e düşürüyor ve denetimden
                      de kaçıyor). Fark RENKLE: geçmişte nötr mürekkep,
                      bugünde marka mürekkebi. */}
                  <div style={{ fontFamily: FM, fontSize: 11.5, fontWeight: 700,
                    color: gecmis ? C.faint : gun === bugun ? C.orangeInk : C.dim }}>{Number(gun.slice(-2))}</div>
                  {d.bookings.slice(0, 2).map(b => (
                    <div key={b.id} style={{ fontFamily: FB, fontSize: 9.5, fontWeight: 700,
                      color: b.status === 'approved' ? C.greenInk : C.yellowInk,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.restaurantName}
                    </div>
                  ))}
                  {d.bookings.length > 2 && (
                    <div style={{ fontFamily: FB, fontSize: 9.5, color: C.faint }}>+{d.bookings.length - 2}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Renk tek başına bilgi taşımasın. */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
            {[[C.panel, C.border, 'müsait'], [C.yellowSoft, C.yellow, 'onay bekliyor'], [C.greenSoft, C.green, 'yayında']]
              .map(([bg, bd, t]) => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: bg, border: `1px solid ${bd}66` }} />
                  <span style={{ fontFamily: FB, fontSize: 11.5, color: C.dim }}>{t}</span>
                </span>
              ))}
            <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, marginLeft: 'auto' }}>
              Boş bir güne tıklayarak kendiniz yerleştirebilirsiniz.
            </span>
          </div>
        </div>
      </section>

      {/* Fiyat düzenleme */}
      {fiyatDuzenle && (
        <Modal onClose={() => setFiyatDuzenle(null)}
          title={`${AD_PRODUCTS[fiyatDuzenle].name} — fiyat`}
          subtitle={`GÜNLÜK fiyat. ${AD_PRODUCTS[fiyatDuzenle].maxDays} güne kadar seçilebiliyor, bedel gün sayısıyla çarpılıyor. Yeni fiyat yalnızca bundan sonraki taleplere uygulanır.`}>
          <AdminField label="Günlük fiyat (₺)" value={fiyatTaslak} onChange={setFiyatTaslak} autoFocus onEnter={kaydetFiyat} />
          <Btn label="Kaydet" variant="filled" tone="orange" fullWidth onClick={kaydetFiyat} />
        </Modal>
      )}

      {/* Yönetici yerleştirmesi */}
      {yerlestir && (
        <Modal onClose={() => { setYerlestir(null); setYerGun(1); setHata(''); }}
          title="Takvime yerleştir"
          subtitle={`${p.name} · ${prettyDay(yerlestir.start)}${yerGun > 1 ? ` – ${prettyDay(endOf(urun, yerlestir.start, yerGun))}` : ''} · ${money(priceOf(urun, durum))} × ${yerGun} = ${money(priceOf(urun, durum) * yerGun)}`}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="ad-gun" style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: C.dim, marginBottom: 6 }}>
              Gün sayısı (en fazla {p.maxDays})
            </label>
            <select id="ad-gun" value={yerGun} onChange={e => { setYerGun(Number(e.target.value)); setHata(''); }}
              style={{ width: '100%', height: 40, background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '0 10px', color: C.text, fontFamily: FB, fontSize: 16, outline: 'none' }}>
              {Array.from({ length: p.maxDays }, (_, k) => k + 1).map(n => (
                <option key={n} value={n}>{n} gün</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="ad-rest" style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: C.dim, marginBottom: 6 }}>Restoran</label>
            <select id="ad-rest" value={secilenRest} onChange={e => { setSecilenRest(e.target.value); setHata(''); }}
              style={{ width: '100%', height: 40, background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '0 10px', color: C.text, fontFamily: FB, fontSize: 16, outline: 'none' }}>
              <option value="">Seçin…</option>
              {musteriler.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, marginBottom: 14, lineHeight: 1.55 }}>
            Yönetici yerleştirmesi <b>doğrudan onaylı</b> açılır — telefonda anlaşılan
            bir yayın için işletmeye talep açtırmak boş bir tur olurdu. Kota ve doluluk
            kuralları yine de geçerli.
          </div>
          {hata && (
            <div role="status" style={{ background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: 9,
              padding: '9px 12px', marginBottom: 14, fontSize: 12, color: C.redInk }}>{hata}</div>
          )}
          <Btn label="Yerleştir ve yayınla" variant="filled" tone="orange" fullWidth
            onClick={yerlestirOnayla} disabled={!secilenRest} />
        </Modal>
      )}
    </div>
  );
}

const SEARCHABLE = {
  restaurants: 'Restoran veya mutfak ara',
  pool:        'Havuzda mekan ara',
  moderation:  'Bekleyen kayıtlarda ara',
  applications:'Başvuru sahibi veya işletme ara',
  users:       'Kullanıcı adı veya e-posta ara',
  campaigns:   'Kampanya, restoran veya firma ara',
  pricing:     'Müşteri ara',
  services:    'Hizmet veya restoran ara',
  adcal:       'Talep eden restoranı ara',
};

/**
 * Ortak arama alanı.
 *
 * Tek bir bileşen ama HER SAYFA KENDİ ALANINDA arıyor: restoranda isim ve
 * mutfak, kullanıcıda isim ve e-posta, kampanyada restoran ve organizasyon.
 * Filtre mantığı sayfada, alan burada — tersi olsaydı her yeni sayfa için
 * arama kutusunu yeniden çizmek gerekirdi.
 *
 * Yer tutucu sayfaya göre değişiyor: "Ara..." kullanıcıya NEYİ
 * arayabileceğini söylemiyor.
 */
function SearchBar({ value, onChange, placeholder = 'Ara...', width = 280 }) {
  return (
    <div style={{ position: 'relative', width }}>
      <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <Icon path={icons.search} size={16} color={C.faint} />
      </div>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} aria-label={placeholder}
        style={{
          width: '100%', height: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: value ? '0 34px 0 36px' : '0 12px 0 36px',
          color: C.text, fontFamily: FB, fontSize: 13, outline: 'none',
        }} />
      {/* Temizleme düğmesi: arama açıkken boş sonuç görüp "sayfa bozuk"
          sanmanın önüne geçen tek şey. */}
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Aramayı temizle"
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <Icon path={icons.x} size={14} color={C.faint} />
        </button>
      )}
    </div>
  );
}

/**
 * Bir hizmetin TANITIMI: örnek görsel veya video.
 *
 * Bu alan reklam içeriği için DEĞİL. Buradaki dosya hizmetin ne olduğunu
 * ANLATAN örnek: "banner ekranda nasıl görünüyor", "şef videosu neye
 * benziyor". Gösterildiği yer işletmenin Büyüme sekmesi — teklif istemeden
 * önce ne satın aldığını görsün diye.
 *
 * İşletmenin KENDİ reklam dosyası burada değil: o onay kuyruğundan
 * geçiyor (Moderasyon → Onayımı bekleyen dosyalar). İkisini tek yerde
 * toplamak "bizim tanıtımımız" ile "müşterinin gönderdiği içerik"i
 * karıştırırdı; birinin onaya ihtiyacı var, diğerinin yok.
 *
 * YÜKLEMEK GÖSTERMEK DEĞİL: dosya geldikten sonra yönetici kontrol edip
 * "İşletmelere göster"e basıyor.
 */
function CreativeSlot({ streamKey }) {
  const state = useCreatives();
  const slot = SLOTS[streamKey];
  const liste = listFor(streamKey, state);
  const [hata, setHata] = useState('');
  const [yukluyor, setYukluyor] = useState(false);
  const [onizle, setOnizle] = useState(null);
  const girdiRef = useRef(null);

  if (!slot) return null;

  const sec = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';                       // aynı dosya tekrar seçilebilsin
    if (!f) return;
    setHata(''); setYukluyor(true);
    try { await addCreative(streamKey, f); }
    catch (err) { setHata(err.message || 'Yükleme başarısız.'); }
    finally { setYukluyor(false); }
  };

  return (
    <div style={{ marginTop: 12, padding: '13px 15px', borderRadius: 12,
      background: C.panel2, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{slot.label}</span>
        <span style={{ fontFamily: FB, fontSize: 11, color: C.faint }}>
          {liste.length} dosya · {liveCount(streamKey, state)} işletmelere açık
        </span>
        <div style={{ flex: 1 }} />
        <input ref={girdiRef} type="file" accept={slot.accept} onChange={sec}
          style={{ display: 'none' }} aria-label={`${slot.label} dosyası seç`} />
        <Btn label={yukluyor ? 'Yükleniyor…' : 'Dosya yükle'} size="sm" variant="outline"
          loading={yukluyor} onClick={() => girdiRef.current?.click()}
          icon={<Icon path={icons.plus} size={13} color={C.dim} />} />
      </div>
      <div style={{ fontFamily: FB, fontSize: 11.5, color: C.dim, lineHeight: 1.5 }}>
        {slot.hint} · en fazla {slot.maxMB} MB
      </div>
      {hata && (
        <div role="status" style={{ marginTop: 9, background: C.redSoft, border: `1px solid ${C.red}44`,
          borderRadius: 8, padding: '7px 10px', fontSize: 11.5, color: C.redInk }}>{hata}</div>
      )}
      {liste.map(cr => (
        <div key={cr.id} style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 10,
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ width: 44, height: 34, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
            background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cr.type?.startsWith('image/')
              ? <img src={cr.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon path={icons.play} size={15} color={C.faint} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cr.name}</div>
            <div style={{ fontFamily: FB, fontSize: 10.5, color: C.faint }}>
              {cr.sizeMB} MB{cr.restaurantName ? ` · ${cr.restaurantName}` : ''}
            </div>
          </div>
          {/* Durum renkle DEĞİL yazıyla. */}
          <span style={{ fontFamily: FB, fontSize: 10.5, fontWeight: 700,
            color: cr.live ? C.greenInk : C.faint,
            background: cr.live ? C.greenSoft : C.panel2,
            borderRadius: R.pill, padding: '2px 8px' }}>
            {cr.live ? 'işletmelere açık' : 'taslak'}
          </span>
          <Btn label="Görüntüle" size="sm" variant="outline" onClick={() => setOnizle(cr)} />
          <Btn label={cr.live ? 'Gizle' : 'İşletmelere göster'} size="sm"
            variant={cr.live ? 'soft' : 'filled'} tone={cr.live ? 'yellow' : 'green'}
            onClick={() => toggleLive(streamKey, cr.id)} />
          <IconBtn size={28} title="Sil" danger onClick={() => removeCreative(streamKey, cr.id)}
            icon={<Icon path={icons.trash} size={13} color={C.redInk} />} />
        </div>
      ))}
      {onizle && (
        <MediaPreview file={onizle} onClose={() => setOnizle(null)}
          title={`${slot.label} — önizleme`}
          footer={
            <div style={{ fontFamily: FB, fontSize: 12, color: C.dim, lineHeight: 1.55 }}>
              İşletme bu dosyayı Büyüme sekmesinde, ilgili hizmetin kartında görür.
              {onizle.live ? '' : ' Şu an taslak — “İşletmelere göster” demeden görünmez.'}
            </div>
          } />
      )}
    </div>
  );
}

/**
 * DOSYA ÖNİZLEME — tıklanan menü sayfası / fotoğraf / video tam boy.
 *
 * Yöneticinin bir dosyayı onaylamadan önce GÖRMESİ gerekiyor. Eskiden
 * menü listesi tohumlanmış sahte veriydi: ad ve sayfa sayısı vardı,
 * açılacak bir dosya yoktu. Karara esas olan şey dosyanın kendisi.
 *
 * Video `controls` ile ve `autoPlay` OLMADAN geliyor: onay için açılan
 * bir pencerede kendiliğinden başlayan ses kaba, üstelik sessiz moddaki
 * cihazı da yok sayardı.
 */
function MediaPreview({ file, title, onClose, footer }) {
  if (!file) return null;
  return (
    <Modal onClose={onClose} width={720}
      title={title || file.name}
      subtitle={`${mediaSize(file.sizeMB)} · ${formatDate(file.at)}${file.note ? ` · ${file.note}` : ''}`}>
      <div style={{ background: C.bg, borderRadius: 12, overflow: 'hidden', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        {mediaIsVideo(file)
          ? <video src={file.url} controls playsInline preload="metadata"
              style={{ width: '100%', maxHeight: '62vh', display: 'block', background: '#000' }} />
          : <img src={file.url} alt={file.name}
              style={{ maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block' }} />}
      </div>
      {footer}
    </Modal>
  );
}

/** Dosya durumu tek bir yerden çiziliyor — renk yalnız değil, yazı da var. */
function MediaStatusChip({ status }) {
  const map = {
    pending: { t: 'onay bekliyor', c: () => C.yellowInk, s: () => C.yellowSoft },
    approved: { t: 'onaylandı', c: () => C.greenInk, s: () => C.greenSoft },
    rejected: { t: 'reddedildi', c: () => C.redInk, s: () => C.redSoft },
  };
  const d = map[status] || map.pending;
  return (
    <span style={{ fontFamily: FB, fontSize: 10.5, fontWeight: 700, color: d.c(),
      background: d.s(), borderRadius: R.pill, padding: '2px 9px', whiteSpace: 'nowrap' }}>{d.t}</span>
  );
}

/**
 * ONAYIMI BEKLEYEN DOSYALAR — işletmelerin yüklediği menü, fotoğraf ve
 * reklam materyali.
 *
 * Moderasyon sayfasında ve EN ÜSTTE: mekan kaydı ile alan değişikliğinin
 * yanında üçüncü bir iş kuyruğu. Ayrı bir sayfaya konsaydı "onay bekleyen
 * var mı" sorusu iki yere bakmayı gerektirirdi.
 *
 * Reddetme sebep İSTİYOR: sebepsiz bir ret işletmeyi aynı dosyayı ikinci
 * kez yüklemeye iter ve aynı iş yöneticiye geri gelir.
 */
function MediaQueue({ restaurants = [] }) {
  const durum = useMedia();
  const bekleyen = pendingMedia(durum);
  const [acik, setAcik] = useState(null);      // önizlenen dosya
  const [redId, setRedId] = useState(null);    // sebep yazılan dosya
  const [sebep, setSebep] = useState('');

  if (!bekleyen.length) return null;

  const adOf = (rid) => restaurants.find(r => String(r.id) === String(rid))?.name || `#${rid}`;

  const onayla = (f) => { decideMedia(f.restaurantId, f.kind, f.id, 'approved'); setAcik(null); };
  const reddet = (f) => {
    decideMedia(f.restaurantId, f.kind, f.id, 'rejected', sebep.trim() || 'Sebep belirtilmedi.');
    setRedId(null); setSebep(''); setAcik(null);
  };

  return (
    <section style={{ ...CARD, overflow: 'hidden', marginBottom: 18, borderColor: C.orangeInk }}>
      <SectionHead title="Onayımı bekleyen dosyalar"
        right={`${bekleyen.length} dosya · işletmelerden`} />
      {bekleyen.map(f => (
        <div key={f.id} style={{ padding: '13px 18px', borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Küçük görsel de TIKLANABİLİR: karara esas olan dosyanın
              kendisi, adı değil. */}
          <button type="button" onClick={() => setAcik(f)}
            title="Büyük görüntüle" aria-label={`${f.name} dosyasını aç`}
            style={{ width: 54, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
              background: C.bg, border: `1px solid ${C.border}`, padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {mediaIsVideo(f)
              ? <Icon path={icons.play} size={16} color={C.faint} />
              : <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </button>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {adOf(f.restaurantId)}
              {/* NEREDE YAYINLANACAĞI. "Banner görseli" dosyanın türünü
                  söylüyor, ekranını değil; onaylayan kişinin kararı tam da
                  buna bağlı — dikey bir video banner'a uymaz. */}
              {MEDIA_KINDS[f.kind]?.slot && (
                <span style={{ fontFamily: FB, fontSize: 10.5, fontWeight: 700, color: C.orangeInk,
                  background: C.orangeSoft, borderRadius: R.pill, padding: '2px 9px' }}>
                  {MEDIA_KINDS[f.kind].label}
                </span>
              )}
            </div>
            <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
              {MEDIA_KINDS[f.kind]?.slot || MEDIA_KINDS[f.kind]?.tekil || f.kind} · {f.name} · {mediaSize(f.sizeMB)} · {formatDate(f.at)}
            </div>
          </div>
          <Btn label="Görüntüle" size="sm" variant="outline" onClick={() => setAcik(f)} />
          <Btn label="Onayla" size="sm" variant="filled" tone="green" onClick={() => onayla(f)} />
          <Btn label="Reddet" size="sm" variant="soft" tone="red"
            onClick={() => { setRedId(f.id); setSebep(''); }} />
        </div>
      ))}

      {/* Ret sebebi — işletme panelinde dosyanın altında yazılı çıkıyor. */}
      {redId && (() => {
        const f = bekleyen.find(x => x.id === redId);
        if (!f) return null;
        return (
          <Modal onClose={() => setRedId(null)} title="Dosyayı reddet"
            subtitle={`${adOf(f.restaurantId)} · ${f.name}`}>
            <AdminField label="Sebep (işletme bunu görecek)" value={sebep} onChange={setSebep} autoFocus />
            <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, marginBottom: 14, lineHeight: 1.55 }}>
              Sebep yazmak zorunlu değil ama yazılmazsa işletme aynı dosyayı
              yeniden yükler ve aynı iş size geri gelir.
            </div>
            <Btn label="Reddet ve bildir" variant="filled" tone="red" fullWidth onClick={() => reddet(f)} />
          </Modal>
        );
      })()}

      {acik && (
        <MediaPreview file={acik} onClose={() => setAcik(null)}
          title={`${adOf(acik.restaurantId)} · ${MEDIA_KINDS[acik.kind]?.tekil || acik.kind}`}
          footer={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn label="Onayla ve yayınla" variant="filled" tone="green" onClick={() => onayla(acik)} />
              <Btn label="Reddet" variant="soft" tone="red"
                onClick={() => { setRedId(acik.id); setSebep(''); }} />
            </div>
          } />
      )}
    </section>
  );
}

/**
 * RESTORANIN DOSYALARI — yönetici panelindeki mekan detayında.
 *
 * "İnsanların yüklediği menüleri tıklayıp izleyebilmek" buranın işi.
 * Eskiden bu bölüm `restaurantMenus()` ile TOHUMLANMIŞ sahte veriydi:
 * ad, sayfa sayısı ve tarih üretiliyordu ama açılacak dosya yoktu.
 * Artık işletmenin gerçekten yüklediği dosyalar, durumlarıyla.
 *
 * Karar burada da verilebiliyor: bir mekanın kaydına bakarken bekleyen
 * dosyasını görüp Moderasyon sayfasına gitmek gereksiz bir tur olurdu.
 */
function RestaurantMedia({ restaurant }) {
  const durum = useMedia();
  const [kind, setKind] = useState('menu');
  const [acik, setAcik] = useState(null);
  const dosyalar = listMedia(restaurant.id, kind, durum);

  const sayi = (k) => listMedia(restaurant.id, k, durum).length;

  return (
    <section style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
      <SectionHead title="İşletmenin yüklediği dosyalar"
        right={`${sayi('menu')} menü · ${sayi('photos')} fotoğraf · ${sayi('bannerAds')} banner · ${sayi('rewardedAds')} video`} />
      <div style={{ padding: '12px 18px 0' }}>
        <Segmented
          value={kind} onChange={setKind}
          label="Dosya türü"
          options={Object.keys(MEDIA_KINDS).map(k => ({
            id: k, label: `${MEDIA_KINDS[k].label} (${sayi(k)})`,
          }))} />
      </div>

      {dosyalar.length === 0 ? (
        <EmptyRow text={`Bu mekan henüz ${MEDIA_KINDS[kind].label.toLocaleLowerCase('tr')} yüklemedi`} />
      ) : (
        <div style={{ padding: 18, display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 12 }}>
          {dosyalar.map(f => (
            <div key={f.id}>
              <button type="button" onClick={() => setAcik(f)}
                title={`${f.name} — büyük görüntüle`} aria-label={`${f.name} dosyasını aç`}
                style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', padding: 0,
                  borderRadius: 10, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                  background: C.bg, border: `1px solid ${C.border}` }}>
                {mediaIsVideo(f)
                  ? <span style={{ display: 'flex', width: '100%', height: '100%',
                      alignItems: 'center', justifyContent: 'center' }}>
                      <Icon path={icons.play} size={22} color={C.faint} />
                    </span>
                  : <img src={f.url} alt={f.name} loading="lazy" decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </button>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <MediaStatusChip status={f.status} />
                <span style={{ fontFamily: FB, fontSize: 10.5, color: C.faint }}>{mediaSize(f.sizeMB)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {acik && (
        <MediaPreview file={acik} onClose={() => setAcik(null)}
          title={`${restaurant.name} · ${MEDIA_KINDS[kind].tekil}`}
          footer={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <MediaStatusChip status={acik.status} />
              {acik.status !== 'approved' && (
                <Btn label="Onayla" variant="filled" tone="green"
                  onClick={() => { decideMedia(restaurant.id, kind, acik.id, 'approved'); setAcik(null); }} />
              )}
              {acik.status !== 'rejected' && (
                <Btn label="Reddet" variant="soft" tone="red"
                  onClick={() => { decideMedia(restaurant.id, kind, acik.id, 'rejected', 'Yönetici reddetti.'); setAcik(null); }} />
              )}
              <div style={{ flex: 1 }} />
              <Btn label="Sil" variant="outline" tone="red"
                onClick={() => { removeMedia(restaurant.id, kind, acik.id); setAcik(null); }} />
            </div>
          } />
      )}
    </section>
  );
}

/**
 * Bildirim listesi. Başlıktaki çanın altından açılan panel.
 *
 * Perde YOK ama dışarı tıklayınca kapanıyor: modal değil, hızlı bir
 * bakış. Perde koymak "bu bir karar ekranı" der, oysa buradan yalnızca
 * ilgili sayfaya geçiliyor.
 */
function NotificationList({ items = [], onClose, onGo }) {
  return (
    <>
      {/* Görünmez kapatma katmanı — panelin ALTINDA (z-index) ki satırlara
          basılabilsin. */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400 }} />
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.24 }}
        role="dialog" aria-label="Bildirimler"
        style={{
          position: 'absolute', top: 46, right: 0, width: 340, zIndex: 401,
          ...CARD, boxShadow: ELEV.raised, overflow: 'hidden', maxHeight: 420, overflowY: 'auto',
        }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>Bildirimler</span>
          <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>{items.length} bekleyen iş</span>
        </div>
        {items.length === 0 ? (
          <div style={{ padding: '26px 16px', textAlign: 'center', fontFamily: FB, fontSize: 12.5, color: C.faint }}>
            Bekleyen iş yok.
          </div>
        ) : items.map(b => (
          <button key={b.id} type="button" onClick={() => onGo?.(b.sayfa)}
            className="gur-admin-btn"
            style={{
              display: 'block', width: '100%', textAlign: 'left', border: 'none',
              borderTop: `1px solid ${C.border}`, background: 'transparent',
              padding: '12px 16px', cursor: 'pointer', color: C.text,
              '--btn-bg': 'transparent', '--btn-bg-hover': C.panel2,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Yeni olan işaretli; renk tek başına bilgi taşımasın diye
                  nokta ayrı bir nesne, metnin rengi değişmiyor. */}
              {b.yeni && <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.orange, flexShrink: 0 }} />}
              <span style={{ fontSize: 13, fontWeight: 700 }}>{b.baslik}</span>
            </div>
            <div style={{ fontFamily: FB, fontSize: 11.5, color: C.dim, marginTop: 3 }}>
              {b.alt}{b.at ? ` · ${new Date(b.at).toLocaleString('tr')}` : ''}
            </div>
          </button>
        ))}
      </motion.div>
    </>
  );
}

/** Liste boşken satır yüksekliğini koruyan tek satır. */
function EmptyRow({ text }) {
  return (
    <div style={{ padding: '26px 18px', borderTop: `1px solid ${C.border}`, textAlign: 'center',
      fontFamily: FB, fontSize: 12.5, color: C.faint }}>{text}</div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODERASYON — yayına çıkmadan önceki son kapı
//
// İki ayrı iş, tek sayfada ama AYRI listelerde: yeni mekan kaydı ile
// yayındaki bir kaydın alan değişikliği farklı kararlar; birini onaylamak
// diğerini onaylamak değil.
//
// Yönetici gelen değeri DÜZENLEYEBİLİR — işletmenin yazdığını olduğu gibi
// kabul etmek zorunda değil. Düzeltilmiş hâl yayınlanır ve kayıtta
// "düzenlendi" izi kalır.
// ═══════════════════════════════════════════════════════════════════════
const MOD_ALAN = {
  name: 'Görünen ad', desc: 'Açıklama', hours: 'Çalışma saatleri',
  price: 'Fiyat aralığı', phone: 'Telefon', addr: 'Adres',
};

function ModerationPage({ restaurants = [], query = '', onCreate, onCreateMany, onOpen }) {
  const mod = useModeration();
  const changes = pendingChanges(mod);
  const venues = pendingVenues(restaurants, mod);
  const [edit, setEdit] = useState(null);
  const [draft, setDraft] = useState({});
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const q = query.trim().toLocaleLowerCase('tr');
  const esles = ad => !q || String(ad || '').toLocaleLowerCase('tr').includes(q);
  const gChanges = changes.filter(c => esles(c.restaurantName));
  const gVenues = venues.filter(r => esles(r.name));

  const ac = c => { setEdit(c); setDraft({ ...c.fields }); };
  const onayla = () => {
    // Yalnızca gerçekten değişen alan varsa "düzenlendi" say: yönetici
    // hiçbir şeye dokunmadıysa kayıt "olduğu gibi onaylandı" kalmalı.
    const degisti = Object.entries(draft).some(([k, v]) => v !== edit.fields[k]);
    approveChange(edit.id, degisti ? draft : null);
    setEdit(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FB, fontSize: 12.5, color: C.dim, maxWidth: 640, lineHeight: 1.6 }}>
          API'den gelen yeni mekanlar ve işletmelerin panelden girdiği bilgiler
          önce buraya düşer. <b>Onaylanmadan tüketici uygulamasında görünmezler.</b>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn label="Excel ile toplu yükle" onClick={() => setImporting(true)} variant="outline"
            icon={<Icon path={icons.upload} size={15} color={C.dim} />} />
          <Btn label="Restoran oluştur" onClick={() => setCreating(true)} variant="filled" tone="orange"
            icon={<Icon path={icons.plus} size={15} color={C.onBrand} />} />
        </div>
      </div>

      {/* İşletmelerin yüklediği dosyalar — üçüncü iş kuyruğu. En üstte
          çünkü mekan kaydından farklı olarak burada bir MÜŞTERİ bekliyor. */}
      <MediaQueue restaurants={restaurants} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard label="Bekleyen yeni mekan" value={`${venues.length}`} icon={icons.store}
          accent={{ color: C.orangeInk, soft: C.orangeSoft }} delta="dış besleme" deltaNeutral />
        <KpiCard label="Bekleyen bilgi değişikliği" value={`${changes.length}`} icon={icons.inbox}
          accent={{ color: C.blue, soft: C.blueSoft }} delta="işletmeden" deltaNeutral />
      </div>

      <section style={{ ...CARD, overflow: 'hidden', marginBottom: 18 }}>
        <SectionHead title="Yeni mekan kayıtları" right={`${gVenues.length} kayıt`} />
        {gVenues.length === 0
          ? <EmptyRow text={q ? `"${query}" için bekleyen mekan yok` : 'Bekleyen yeni mekan yok'} />
          : gVenues.map(r => (
            <div key={r.id} style={{ padding: '14px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                  {r.cat} · {r.district} · ★ {r.rating} · API'den geldi
                </div>
              </div>
              <Btn label="Detay" onClick={() => onOpen?.(r.id)} variant="outline" size="sm"
                icon={<Icon path={icons.eye} size={13} color={C.dim} />} />
              <Btn label="Reddet" onClick={() => decideVenue(r.id, 'rejected')} variant="soft" tone="red" size="sm" />
              <Btn label="Yayınla" onClick={() => decideVenue(r.id, 'approved')} variant="filled" tone="green" size="sm" />
            </div>
          ))}
      </section>

      <section style={{ ...CARD, overflow: 'hidden' }}>
        <SectionHead title="İşletmeden gelen bilgi değişiklikleri" right={`${gChanges.length} kayıt`} />
        {gChanges.length === 0
          ? <EmptyRow text={q ? `"${query}" için bekleyen değişiklik yok` : 'Bekleyen değişiklik yok'} />
          : gChanges.map(c => (
            <div key={c.id} style={{ padding: '14px 18px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.restaurantName}</div>
                  <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                    {Object.keys(c.fields).length} alan · {new Date(c.at).toLocaleString('tr')}
                  </div>
                </div>
                <Btn label="İncele ve onayla" onClick={() => ac(c)} variant="filled" tone="orange" size="sm" />
                <Btn label="Reddet" onClick={() => rejectChange(c.id)} variant="soft" tone="red" size="sm" />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.keys(c.fields).map(k => (
                  <span key={k} style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: C.dim,
                    background: C.panel2, borderRadius: R.pill, padding: '3px 9px' }}>{MOD_ALAN[k] || k}</span>
                ))}
              </div>
            </div>
          ))}
      </section>

      <AnimatePresence>
        {edit && (
          <Modal onClose={() => setEdit(null)} title={edit.restaurantName}
            subtitle="Gelen değerleri düzenleyebilirsiniz; yayınlanan hâl aşağıdakidir.">
            {Object.entries(edit.fields).map(([k, v]) => (
              <div key={k}>
                <AdminField label={MOD_ALAN[k] || k} value={draft[k] ?? ''}
                  onChange={val => setDraft(d => ({ ...d, [k]: val }))} />
                {draft[k] !== v && (
                  <div style={{ fontFamily: FB, fontSize: 11, color: C.yellowInk, margin: '-8px 0 12px' }}>
                    İşletmenin girdiği: {String(v).slice(0, 90)}
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Btn label="Onayla ve yayınla" onClick={onayla} variant="filled" tone="green" size="md" fullWidth
                icon={<Icon path={icons.check} size={15} color="#fff" />} />
              <Btn label="Reddet" onClick={() => { rejectChange(edit.id); setEdit(null); }}
                variant="soft" tone="red" size="md" />
            </div>
          </Modal>
        )}
        {creating && <CreateRestaurantModal onClose={() => setCreating(false)} onCreate={onCreate} />}
        {importing && <ImportRestaurantsModal onClose={() => setImporting(false)}
          onCreateMany={onCreateMany} existingNames={restaurants.map(r => r.name)} />}
      </AnimatePresence>
    </div>
  );
}

/**
 * Elle restoran oluşturma — sahiplenme akışını atlar.
 *
 * Yönetici zaten yetkili merci: kendi eklediği kayıt moderasyon kuyruğuna
 * DÜŞMEZ, doğrudan yayınlanır. Kaydı kuyruğa atıp kendi kendine onaylatmak
 * gereksiz bir tur olurdu.
 *
 * Sahiplenilmemiş olarak açılıyor (`account: false`): işletme sonradan
 * kendi kaydını sahiplenebilsin. Sahipsiz kayıtta masa ayırtma kapalı
 * kalır — söz verecek muhatap yok.
 */
function CreateRestaurantModal({ onClose, onCreate }) {
  const [f, setF] = useState({ name: '', cat: '', district: '', addr: '', phone: '', desc: '' });
  const [hata, setHata] = useState('');
  const set = k => v => { setF(x => ({ ...x, [k]: v })); setHata(''); };

  const kaydet = () => {
    if (!f.name.trim()) return setHata('Restoran adı zorunlu.');
    if (!f.cat.trim()) return setHata('Kategori zorunlu.');
    if (!f.district.trim()) return setHata('İlçe zorunlu.');
    onCreate?.({
      name: f.name.trim(), cat: f.cat.trim(), district: f.district.trim(),
      addr: f.addr.trim(), phone: f.phone.trim(), desc: f.desc.trim(),
    });
    onClose();
  };

  return (
    <Modal onClose={onClose} title="Restoran oluştur"
      subtitle="Yönetici kaydı doğrudan yayınlanır — moderasyon kuyruğuna düşmez.">
      <AdminField label="Restoran adı" value={f.name} onChange={set('name')} autoFocus />
      <AdminField label="Kategori" value={f.cat} onChange={set('cat')} />
      <AdminField label="İlçe" value={f.district} onChange={set('district')} />
      <AdminField label="Adres" value={f.addr} onChange={set('addr')} />
      <AdminField label="Telefon" value={f.phone} onChange={set('phone')} />
      <AdminField label="Kısa açıklama" value={f.desc} onChange={set('desc')} />
      {hata && (
        <div style={{ background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: 9,
          padding: '9px 12px', marginBottom: 14, fontSize: 12, color: C.redInk }}>{hata}</div>
      )}
      <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, marginBottom: 14, lineHeight: 1.55 }}>
        Kayıt sahiplenilmemiş olarak açılır; işletme sonradan sahiplenebilir.
        Sahiplenilene kadar masa ayırtma kapalı kalır.
      </div>
      <Btn label="Oluştur ve yayınla" onClick={kaydet} variant="filled" tone="orange" size="md" fullWidth />
    </Modal>
  );
}

/**
 * Excel / CSV ile toplu restoran yükleme.
 *
 * Akış üç adım: şablonu indir → dosyayı seç → ÖNİZLEMEYİ onayla. Ortadaki
 * adımda hiçbir şey yazılmıyor; dosya okunup satır satır doğrulanıyor ve
 * sonuç ekranda duruyor. "Yükle" düğmesine basmadan havuza tek kayıt
 * girmiyor — yüz satırlık bir dosyanın yarısı hatalıysa yönetici bunu
 * yazıldıktan sonra değil, önce görüyor.
 *
 * Hatalı satırlar ATLANIYOR, dosyayı reddetmiyoruz: doksan doğru satır
 * için on hatalıyı düzeltmeyi beklemek gereksiz. Kaç satırın atlandığı ve
 * hangi satır numarasında ne olduğu listede yazılı.
 */
function ImportRestaurantsModal({ onClose, onCreateMany, existingNames = [] }) {
  const girdiRef = useRef(null);
  const [satirlar, setSatirlar] = useState(null);
  const [dosyaAdi, setDosyaAdi] = useState('');
  const [hata, setHata] = useState('');
  const [mesgul, setMesgul] = useState(false);
  // İndirme engellenirse (artifact kum havuzu sayfanın kendi başlattığı
  // indirmelere izin vermiyor) başlık satırı ekranda gösterilir.
  const [basliklar, setBasliklar] = useState('');

  const sablon = async () => {
    const oldu = await downloadTemplate();
    if (!oldu) setBasliklar(templateHeaderLine());
  };

  const sec = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setMesgul(true); setHata(''); setSatirlar(null); setDosyaAdi(f.name);
    try {
      setSatirlar(await parseRestaurantFile(f, existingNames));
    } catch (err) {
      setHata(err?.message || 'Dosya okunamadı.');
    } finally {
      setMesgul(false);
    }
  };

  const gecerli = (satirlar || []).filter(r => !r.errors.length);
  const hatali = (satirlar || []).filter(r => r.errors.length);

  const yukle = () => {
    onCreateMany?.(gecerli.map(r => r.data));
    onClose();
  };

  return (
    <Modal onClose={onClose} title="Excel ile toplu restoran yükleme" width={720}
      subtitle="Şablonu doldurup yükleyin. Kayıtlar doğrudan yayınlanır, moderasyon kuyruğuna düşmez.">

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Btn label="Şablonu indir (.xlsx)" onClick={sablon} variant="outline"
          icon={<Icon path={icons.sheet} size={15} color={C.dim} />} />
        <Btn label={mesgul ? 'Okunuyor…' : 'Dosya seç (.xlsx / .csv)'} loading={mesgul}
          onClick={() => girdiRef.current?.click()} variant="filled" tone="orange"
          icon={<Icon path={icons.upload} size={15} color={C.onBrand} />} />
        <input ref={girdiRef} type="file" accept=".xlsx,.xls,.csv" onChange={sec}
          style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
      </div>

      {basliklar && (
        <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 9,
          padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontFamily: FB, fontSize: 11.5, color: C.dim, marginBottom: 6 }}>
            Tarayıcı indirmeyi engelledi. Aşağıdaki satırı Excel'in ilk satırına yapıştırın:
          </div>
          <code style={{ fontFamily: FM, fontSize: 11.5, color: C.text, wordBreak: 'break-word' }}>
            {basliklar.replace(/\t/g, '  |  ')}
          </code>
        </div>
      )}

      <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, lineHeight: 1.6, marginBottom: 14 }}>
        Sütunlar: {TEMPLATE_COLUMNS.map(c => c.header + (c.required ? '*' : '')).join(' · ')}
        {' '}— yıldızlı alanlar zorunlu. Başlık sırası önemli değil, adları eşleşiyor olmalı.
      </div>

      {hata && (
        <div role="status" style={{ background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: 9,
          padding: '9px 12px', marginBottom: 14, fontSize: 12, color: C.redInk }}>{hata}</div>
      )}

      {satirlar && (
        <>
          <div role="status" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontFamily: FB, fontSize: 11.5, fontWeight: 700, color: C.greenInk,
              background: C.greenSoft, borderRadius: R.pill, padding: '3px 10px' }}>
              {gecerli.length} satır yüklenecek
            </span>
            {hatali.length > 0 && (
              <span style={{ fontFamily: FB, fontSize: 11.5, fontWeight: 700, color: C.redInk,
                background: C.redSoft, borderRadius: R.pill, padding: '3px 10px' }}>
                {hatali.length} satır atlanacak
              </span>
            )}
            <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, alignSelf: 'center' }}>{dosyaAdi}</span>
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', border: `1px solid ${C.border}`,
            borderRadius: 10, marginBottom: 14 }}>
            {satirlar.map(r => (
              <div key={r.line} style={{ padding: '9px 12px', borderBottom: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                background: r.errors.length ? C.redSoft : 'transparent' }}>
                <span style={{ fontFamily: FM, fontSize: 11, color: C.faint, minWidth: 34 }}>#{r.line}</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{r.data.name || '—'}</div>
                  <div style={{ fontFamily: FB, fontSize: 11, color: C.faint }}>
                    {[r.data.cat, r.data.district].filter(Boolean).join(' · ') || 'kategori/ilçe yok'}
                  </div>
                </div>
                {/* Renk tek başına bilgi taşımaz: durum yazıyla da yazılı. */}
                <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700,
                  color: r.errors.length ? C.redInk : C.greenInk }}>
                  {r.errors.length ? `atlanacak — ${r.errors.join(', ')}` : 'hazır'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Btn label={gecerli.length ? `${gecerli.length} restoranı yükle ve yayınla` : 'Yüklenecek satır yok'}
        onClick={yukle} variant="filled" tone="orange" size="md" fullWidth
        disabled={!gecerli.length} />
    </Modal>
  );
}

function TableShell({ headers, children }) {
  return (
    <div style={{ ...CARD, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: h.right ? 'right' : 'left', padding: '12px 18px', fontSize: 11.5, fontWeight: 700, color: C.dim, whiteSpace: 'nowrap' }}>{h.label || h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// KAMPANYALAR — sponsorlu kart açık artırması
//
// İşletme bütçe ve teklif belirler; deste kurulurken skor = teklif ×
// kalite × ilgi ile sıralanır (shared/deck.js → rankCampaigns). Yalnız
// paraya bakan bir sıralama deneyimi bozarak uzun vadede geliri düşürür,
// bu yüzden kalite çarpanı burada da görünür.
// ═══════════════════════════════════════════════════════════════════════
const CAMPAIGN_SEED = [
  { id: 'cmp-1', restaurant: 'Çiya Sofrası',      org: 'Çiya Gıda Ltd.',      label: 'Öne Çıkan',     pricing: 'cpe', bid: 240, daily: 180000, spent: 96400, impressions: 18420, clicks: 1120, engagements: 742, status: 'active' },
  { id: 'cmp-2', restaurant: 'Balıkçı Sabahattin', org: 'Sabahattin Turizm',  label: 'Şefin Önerisi', pricing: 'cpc', bid: 180, daily: 90000,  spent: 41300, impressions: 11250, clicks: 690,  engagements: 318, status: 'active' },
  { id: 'cmp-3', restaurant: "Nonna's Trattoria",  org: 'Nonna Gastro A.Ş.',   label: 'Öne Çıkan',     pricing: 'cpe', bid: 310, daily: 42000,  spent: 42000, impressions: 7600,  clicks: 512,  engagements: 401, status: 'exhausted' },
  { id: 'cmp-4', restaurant: 'Klein Bistro',       org: 'Klein Kahve',         label: 'Öne Çıkan',     pricing: 'cpe', bid: 120, daily: 60000,  spent: 0,     impressions: 0,     clicks: 0,    engagements: 0,   status: 'paused' },
];

// Sunucudan gelen kampanya satırını tablonun beklediği şekle indirger.
function fromApi(c) {
  return {
    id: c.id, restaurant: c.restaurant, org: c.org, label: c.label,
    pricing: c.pricing, bid: c.bid_minor,
    daily: c.daily_budget_minor, spent: c.today_spent,
    impressions: c.impressions, clicks: c.clicks, engagements: c.engagements,
    status: c.status,
  };
}

const CAMPAIGN_STATUS = live({
  active:    () => ({ label: 'Yayında',      color: C.greenInk,  soft: C.greenSoft }),
  paused:    () => ({ label: 'Duraklatıldı', color: C.yellowInk, soft: C.yellowSoft }),
  exhausted: () => ({ label: 'Bütçe bitti',  color: C.faint,     soft: C.panel2 }),
});

function CampaignsPage({ query = '' }) {
  const [rows, setRows] = useState(CAMPAIGN_SEED);
  const [toast, setToast] = useState(null);
  const [live, setLive] = useState(false);

  // Sunucu varsa kampanyalar oradan; yoksa tohum listesi. Şekil aynı
  // olduğu için aşağıdaki hesaplar iki durumda da çalışıyor.
  useEffect(() => {
    let off = false;
    api.ensureMode().then(({ mode }) => {
      if (mode !== 'live' || off) return;
      setLive(true);
      api.getCampaigns()
        .then(({ campaigns }) => { if (!off) setRows(campaigns.map(fromApi)); })
        .catch(() => { /* tohum listesi kalır */ });
    });
    return () => { off = true; };
  }, []);

  const say = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const toggle = (id) => setRows(rs => rs.map(r => {
    if (r.id !== id || r.status === 'exhausted') return r;
    const status = r.status === 'active' ? 'paused' : 'active';
    if (live) api.patchCampaign(id, { status }).catch(() => {});
    return { ...r, status };
  }));
  const bump = (id, delta) => setRows(rs => rs.map(r => {
    if (r.id !== id) return r;
    const bid = Math.max(20, r.bid + delta);
    if (live) api.patchCampaign(id, { bidMinor: bid }).catch(() => {});
    return { ...r, bid };
  }));

  const money = (minor) => `₺${(minor / 100).toLocaleString('tr', { maximumFractionDigits: 0 })}`;
  // Kalite = etkileşim oranı; skor açık artırmadaki gerçek sıralama ölçütü.
  // Arama SIRALAMADAN ÖNCE değil sonra uygulanıyor: süzülmüş listede de
  // kampanyalar açık artırma skoruna göre sıralı kalmalı, alfabetik değil.
  const q = query.trim().toLocaleLowerCase('tr');
  const scored = rows.map(r => {
    const rate = r.impressions ? r.engagements / r.impressions : 0.02;
    const quality = Math.min(1.5, Math.max(0.2, rate * 20));
    return { ...r, rate, quality, score: r.bid * quality };
  }).sort((a, b) => (b.status === 'active' ? b.score : -1) - (a.status === 'active' ? a.score : -1))
    .filter(r => !q || [r.restaurant, r.org, r.badge].some(v =>
      String(v || '').toLocaleLowerCase('tr').includes(q)));

  const activeRows = rows.filter(r => r.status === 'active');
  const totalSpend = rows.reduce((a, r) => a + r.spent, 0);
  const totalImp = rows.reduce((a, r) => a + r.impressions, 0);
  const totalEng = rows.reduce((a, r) => a + r.engagements, 0);

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Yayındaki Kampanya" value={`${activeRows.length}`} delta={`${rows.length} toplam`} deltaNeutral icon={icons.trend} accent={{ color: C.greenInk, soft: C.greenSoft }} />
        <KpiCard label="Bugünkü Harcama" value={money(totalSpend)} delta="12%" deltaUp icon={icons.money} accent={{ color: C.orangeInk, soft: C.orangeSoft }} />
        <KpiCard label="Gösterim" value={totalImp.toLocaleString('tr')} delta="8%" deltaUp icon={icons.chart} accent={{ color: C.blue, soft: C.blueSoft }} />
        <KpiCard label="Etkileşim Oranı" value={`%${((totalEng / Math.max(totalImp, 1)) * 100).toFixed(1)}`} delta="sağa kaydırma" deltaNeutral icon={icons.star} accent={{ color: C.yellowInk, soft: C.yellowSoft }} />
      </div>

      <div style={{ ...CARD, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
        <Icon path={icons.chart} size={16} color={C.blue} />
        <span style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>
          Sponsorlu kart 5-7 organik kart arasına rastgele aralıkla giriyor; şablonu organik kartla
          birebir aynı, tek fark küçük bir rozet. Sıralama <b style={{ color: C.text }}>teklif × kalite</b> skoruna göre —
          yalnız teklife bakan bir sıralama etkileşimi ve uzun vadede geliri düşürüyor.
        </span>
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        <header style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr 140px', gap: 12, fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <span>Kampanya</span><span>Model</span><span>Teklif</span><span>Kalite</span><span>Bütçe</span><span style={{ textAlign: 'right' }}>Eylem</span>
        </header>
        {scored.map((r, i) => {
          const st = CAMPAIGN_STATUS[r.status];
          const pct = Math.min(100, (r.spent / r.daily) * 100);
          return (
            <div key={r.id} style={{ padding: '14px 18px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr 140px', gap: 12, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.restaurant}</span>
                  <Badge text={st.label} color={st.color} soft={st.soft} />
                </div>
                <div style={{ fontSize: 11.5, color: C.faint }}>{r.org} · rozet: “{r.label}”</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.pricing === 'cpe' ? C.green : C.blue, textTransform: 'uppercase' }}>{r.pricing}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => bump(r.id, -20)} className="gur-admin-btn" style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.dim, borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 13, lineHeight: 1, outline: 'none' }}>−</button>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'center' }}>{money(r.bid)}</span>
                <button onClick={() => bump(r.id, 20)} className="gur-admin-btn" style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.dim, borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 13, lineHeight: 1, outline: 'none' }}>+</button>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: r.quality >= 1 ? C.green : C.yellow, fontVariantNumeric: 'tabular-nums' }}>×{r.quality.toFixed(2)}</div>
                <div style={{ fontSize: 10.5, color: C.faint }}>skor {Math.round(r.score)}</div>
              </div>
              <div>
                <div style={{ height: 5, borderRadius: 3, background: C.bg, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct >= 100 ? C.red : C.orange }} />
                </div>
                <div style={{ fontSize: 10.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{money(r.spent)} / {money(r.daily)} günlük</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Btn
                  label={r.status === 'active' ? 'Duraklat' : r.status === 'exhausted' ? 'Bütçe bitti' : 'Yayınla'}
                  onClick={() => { if (r.status === 'exhausted') { say('Bütçe dolmuş kampanya için önce bütçe artırılmalı'); return; } toggle(r.id); say(r.status === 'active' ? `${r.restaurant} duraklatıldı` : `${r.restaurant} yayına alındı`); }}
                  variant={r.status === 'active' ? 'ghost' : 'filled'}
                  tone={r.status === 'active' ? undefined : 'orange'} size="sm"
                />
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 18px', fontSize: 13, color: C.text, boxShadow: SH.d3, zIndex: 100 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BÜYÜME — kohort, retention, ARPU ve LTV
//
// Sunucudaki cohort_retention / cohort_engagement / user_ltv tablolarının
// panel karşılığı. Sorgular server/db/queries/cohorts.sql içinde.
// ═══════════════════════════════════════════════════════════════════════
const COHORTS = [
  { week: '2026-07-06', size: 1840, d1: 46.2, d7: 28.4, d30: 15.1, swipes: 34.2, saves: 7.1, dirPct: 22.4, visitPct: 9.6, ltv: 4120 },
  { week: '2026-07-13', size: 2210, d1: 48.8, d7: 30.1, d30: 16.8, swipes: 36.8, saves: 7.9, dirPct: 24.1, visitPct: 10.8, ltv: 4480 },
  { week: '2026-07-20', size: 2640, d1: 51.3, d7: 32.6, d30: 18.2, swipes: 39.1, saves: 8.6, dirPct: 26.7, visitPct: 12.3, ltv: 4910 },
  { week: '2026-07-27', size: 3110, d1: 53.9, d7: 34.2, d30: 19.6, swipes: 41.5, saves: 9.2, dirPct: 28.9, visitPct: 13.7, ltv: 5240 },
  { week: '2026-08-03', size: 3480, d1: 55.1, d7: 35.8, d30: 20.4, swipes: 42.9, saves: 9.8, dirPct: 30.2, visitPct: 14.9, ltv: 5580 },
  { week: '2026-08-10', size: 3920, d1: 56.4, d7: 36.9, d30: null, swipes: 44.1, saves: 10.3, dirPct: 31.6, visitPct: 15.8, ltv: 5810 },
  { week: '2026-08-17', size: 4260, d1: 57.8, d7: 38.1, d30: null, swipes: 45.6, saves: 10.9, dirPct: 33.1, visitPct: 16.4, ltv: 6020 },
  { week: '2026-08-24', size: 4610, d1: 58.9, d7: null, d30: null, swipes: 46.8, saves: 11.4, dirPct: 34.2, visitPct: 17.1, ltv: 6190 },
];

// Retention hücresi: renk yoğunluğu oranla artar, sayı okunaklı kalır.
function HeatCell({ value }) {
  if (value == null) {
    return <span style={{ fontSize: 12, color: C.faint }} title="Bu kohort için veri yok">—</span>;
  }
  const alpha = Math.min(0.42, Math.max(0.05, value / 140));
  return (
    <span style={{
      display: 'inline-block', minWidth: 52, textAlign: 'center',
      padding: '4px 8px', borderRadius: 6,
      background: `rgba(19,179,100,${alpha})`,
      fontSize: 12, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums',
    }}>%{value.toFixed(1)}</span>
  );
}

function GrowthPage() {
  const [metric, setMetric] = useState('retention');
  const [cohorts, setCohorts] = useState(COHORTS);
  const [platform, setPlatform] = useState(null);
  const money = (minor) => `₺${(minor / 100).toFixed(2)}`;

  // Canlı kohortlar gecelik toplamadan gelir. Henüz hiç toplama
  // çalışmadıysa tablo boş döner; o durumda örnek veri gösterilir ki
  // panel boş bir iskelet gibi görünmesin.
  useEffect(() => {
    let off = false;
    api.ensureMode().then(({ mode }) => {
      if (mode !== 'live' || off) return;
      api.getGrowth(12).then(d => {
        if (off) return;
        setPlatform(d.platform);
        if (d.cohorts?.length) {
          setCohorts(d.cohorts.map(c => ({
            week: String(c.cohort_week).slice(0, 10),
            size: c.cohort_size,
            d1: c.d1 == null ? null : Number(c.d1),
            d7: c.d7 == null ? null : Number(c.d7),
            d30: c.d30 == null ? null : Number(c.d30),
            swipes: Number(c.swipes_per_user),
            saves: Number(c.saves_per_user),
            dirPct: Number(c.save_to_directions_pct),
            visitPct: Number(c.save_to_visit_pct),
            ltv: c.ltv_minor_avg,
          })));
        }
      }).catch(() => { /* örnek veri kalır */ });
    });
    return () => { off = true; };
  }, []);

  const COHORTS_VIEW = cohorts;
  const totalUsers = COHORTS_VIEW.reduce((a, c) => a + c.size, 0);
  const weightedLtv = platform?.ltv_minor || (COHORTS_VIEW.reduce((a, c) => a + c.ltv * c.size, 0) / Math.max(totalUsers, 1));
  const latest = COHORTS_VIEW[COHORTS_VIEW.length - 1] || { dirPct: 0, visitPct: 0, size: 0 };
  // ARPU = LTV / ortalama yaşam süresi (ay). Sunucuda user_ltv.arpu_minor.
  const AVG_LIFETIME_MONTHS = 14;

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Toplam Kullanıcı" value={totalUsers.toLocaleString('tr')} delta={`+${latest.size.toLocaleString('tr')} bu hafta`} deltaUp icon={icons.users} accent={{ color: C.blue, soft: C.blueSoft }} />
        <KpiCard label="Ortalama LTV" value={money(weightedLtv)} delta="11%" deltaUp icon={icons.money} accent={{ color: C.greenInk, soft: C.greenSoft }} />
        <KpiCard label="ARPU (aylık)" value={money(weightedLtv / AVG_LIFETIME_MONTHS)} delta={`${AVG_LIFETIME_MONTHS} ay ort. ömür`} deltaNeutral icon={icons.chart} accent={{ color: C.orangeInk, soft: C.orangeSoft }} />
        <KpiCard label="Kaydet → Git Dönüşümü" value={`%${latest.dirPct.toFixed(1)}`} delta={`ziyaret %${latest.visitPct.toFixed(1)}`} deltaUp icon={icons.trend} accent={{ color: C.yellowInk, soft: C.yellowSoft }} />
      </div>

      <TabBar
        tabs={[
          { id: 'retention', label: 'Retention' },
          { id: 'engagement', label: 'Etkileşim' },
          { id: 'conversion', label: 'Dönüşüm ve LTV' },
        ]}
        active={metric} onChange={setMetric}
      />

      <div style={{ ...CARD, overflow: 'hidden' }}>
        <header style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Kayıt haftasına göre kohortlar
          </span>
          <span style={{ fontSize: 11.5, color: C.faint }}>gecelik toplama · 04:00</span>
        </header>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {(metric === 'retention'
                  ? ['Kohort', 'Kişi', 'Gün 1', 'Gün 7', 'Gün 30']
                  : metric === 'engagement'
                    ? ['Kohort', 'Kişi', 'Kaydırma / kişi', 'Kaydetme / kişi', 'Gün 7']
                    : ['Kohort', 'Kişi', 'Yol tarifi', 'Fiziksel ziyaret', 'LTV']
                ).map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '11px 18px', fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COHORTS_VIEW.slice().reverse().map((c, i) => (
                <tr key={c.week} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <td style={{ padding: '11px 18px', fontSize: 13, fontWeight: 600 }}>{c.week}</td>
                  <td style={{ padding: '11px 18px', textAlign: 'right', fontSize: 12.5, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>{c.size.toLocaleString('tr')}</td>
                  {metric === 'retention' && <>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}><HeatCell value={c.d1} /></td>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}><HeatCell value={c.d7} /></td>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}><HeatCell value={c.d30} /></td>
                  </>}
                  {metric === 'engagement' && <>
                    <td style={{ padding: '11px 18px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.swipes.toFixed(1)}</td>
                    <td style={{ padding: '11px 18px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.saves.toFixed(1)}</td>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}><HeatCell value={c.d7} /></td>
                  </>}
                  {metric === 'conversion' && <>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}><HeatCell value={c.dirPct} /></td>
                    <td style={{ padding: '11px 18px', textAlign: 'right' }}><HeatCell value={c.visitPct} /></td>
                    <td style={{ padding: '11px 18px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: C.greenInk, fontVariantNumeric: 'tabular-nums' }}>{money(c.ltv)}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...CARD, padding: '16px 20px', marginTop: 20 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Bu tablo neyi ölçüyor</h3>
        <div style={{ display: 'grid', gap: 7 }}>
          {[
            ['Retention', 'Kayıt gününden N gün sonra en az bir ürün olayı üreten kullanıcı oranı. Sadece uygulamayı açmak yetmiyor.'],
            ['Etkileşim', 'Kohort başına kaydırma ve kaydetme sayısı; destenin doyup doymadığını gösterir.'],
            ['Dönüşüm', 'Sağa kaydırılan mekân için yol tarifi alınma ve konumla doğrulanmış ziyaret oranı — ürünün gerçek dünyadaki karşılığı.'],
            ['LTV', 'Reklam ve ücretli özellik gelirinin kullanıcı başına kümülatif toplamı; ARPU bunun aylığa bölünmüşü.'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.orangeInk, minWidth: 74 }}>{k}</span>
              <span style={{ fontSize: 12, color: C.faint, lineHeight: 1.55 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: R.pill, padding: 4, marginBottom: 16, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <motion.button
            key={t.id} onClick={() => onChange(t.id)} className="gur-admin-btn"
            data-tab={t.id} aria-pressed={on}
            whileTap={{ scale: 0.98 }} transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
            style={{
              border: on ? `1px solid ${C.border}` : '1px solid transparent',
              cursor: 'pointer', borderRadius: R.pill, padding: '7px 15px',
              background: on ? C.panel : 'transparent', color: on ? C.text : C.dim,
              boxShadow: on ? SH.s1 : 'none',
              fontFamily: FB, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 7, outline: 'none',
            }}>
            {t.label}
            {t.count != null && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, borderRadius: 20, padding: '1px 6px',
                background: t.alert ? C.redSoft : C.bg, color: t.alert ? C.red : C.faint,
                fontVariantNumeric: 'tabular-nums',
              }}>{t.count}</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function StarRow({ n, size = 12 }) {
  return (
    <span style={{ fontSize: size, color: C.orangeInk, letterSpacing: 1 }}>
      {'★'.repeat(n)}<span style={{ color: C.border }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

function MetaCell({ label, children }) {
  return (
    <div style={{ padding: '12px 18px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{children}</div>
    </div>
  );
}

// Tek yorum kartı — hem restoran detayında hem moderasyon akışlarında kullanılır
function ReviewCard({ v, showRestaurant, onOpenRestaurant, hidden, onHide }) {
  const low = v.stars <= 2;
  return (
    <article style={{
      padding: '14px 18px',
      borderTop: `1px solid ${C.border}`,
      background: hidden ? C.bg : (v.flagged ? C.redSoft : 'transparent'),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{v.user}</span>
        <StarRow n={v.stars} />
        {showRestaurant && (
          <button
            onClick={() => onOpenRestaurant?.(v.restId)} className="gur-admin-btn"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FB, fontSize: 12.5, fontWeight: 600, color: C.blue, outline: 'none' }}>
            {v.restName}
          </button>
        )}
        <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
          {daysAgoLabel(v.days)} • {formatDate(v.date)}
        </span>
        {v.flagged && <Badge text="Şikayet edildi" color={C.redInk} soft={C.redSoft} />}
        {low && !v.flagged && <Badge text={`${v.stars} puan`} color={C.yellowInk} soft={C.yellowSoft} />}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: C.dim, lineHeight: 1.55, maxWidth: '68ch', textDecoration: hidden ? 'line-through' : 'none' }}>{v.text}</p>
      {v.photos?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {v.photos.map((src, i) => (
            <div key={i} style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}`, flexShrink: 0 }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}
      {onHide && (
        <div style={{ marginTop: 10 }}>
          <Btn
            label={hidden ? 'Geri Yükle' : 'Yorumu Kaldır'}
            onClick={() => onHide(v.key)}
            variant={hidden ? 'outline' : 'soft'}
            tone={hidden ? 'neutral' : 'red'}
            size="sm"
          />
        </div>
      )}
    </article>
  );
}

function ReviewFeed({ reviews, hidden, onHide, onOpenRestaurant, empty }) {
  if (reviews.length === 0) {
    return (
      <div style={{ ...CARD, padding: '40px 20px', textAlign: 'center', color: C.faint, fontSize: 13 }}>
        {empty}
      </div>
    );
  }
  return (
    <div style={{ ...CARD, overflow: 'hidden' }}>
      {reviews.map(v => (
        <ReviewCard key={v.key} v={v} showRestaurant onOpenRestaurant={onOpenRestaurant}
          hidden={hidden.has(v.key)} onHide={onHide} />
      ))}
    </div>
  );
}

// Restoran bazlı özellik anahtarları.
function StoreFeatures({ restaurant }) {
  const settings = usePlatformSettings();
  const overrides = settings.storeOverrides?.[String(restaurant.id)] || {};
  const hidden = isRestaurantHidden(restaurant.id, settings);

  return (
    <>
    {/* ─── GÖRÜNÜRLÜK ───
        Özellik kapılarından AYRI bir kart. Kapılar "bu mekanda şu özellik
        yok" der; bu ise "bu mekan yok" der — aynı listeye koymak ikisini
        aynı ağırlıkta gösterirdi ve yanlış satıra basmak bir mekanı
        sessizce uygulamadan düşürürdü. */}
    <section style={{
      ...CARD, overflow: 'hidden', marginBottom: 16,
      borderColor: hidden ? C.redInk : C.border,
    }}>
      <div style={{ padding: '15px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
            Uygulamada görünürlük
            {hidden && (
              <span style={{ fontFamily: FB, fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
                color: C.redInk, background: C.redSoft, borderRadius: R.pill, padding: '2px 8px' }}>GİZLİ</span>
            )}
          </div>
          <div style={{ fontFamily: FB, fontSize: 12, color: C.dim, lineHeight: 1.55 }}>
            {hidden
              ? 'Bu mekan tüketici uygulamasında hiç görünmüyor: destede, aramada ve listelerde yok. Kaydı silinmedi, işletme paneli çalışmaya devam ediyor.'
              : 'Kapatırsan bu mekan tüketici uygulamasından tamamen kalkar — deste, arama ve listeler dahil. Kayıt silinmez, işletme paneli çalışmaya devam eder.'}
          </div>
        </div>
        <Toggle on={!hidden} onChange={() => setRestaurantHidden(restaurant.id, !hidden)} />
      </div>
    </section>

    <section style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
      <SectionHead title="Bu işletmede açık özellikler"
        right={`${PER_STORE_FEATURES.filter(f => settings[f.key] && overrides[f.key] !== false).length} / ${PER_STORE_FEATURES.length} açık`} />
      {PER_STORE_FEATURES.map(f => {
        const globalOn = !!settings[f.key];
        const on = globalOn && overrides[f.key] !== false;
        return (
          <div key={f.key} style={{ padding: '14px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {f.label}
                {!globalOn && <Badge text="platformda kapalı" color={C.yellowInk} soft={C.yellowSoft} />}
              </div>
              <div style={{ fontFamily: FB, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
            {/* Genel anahtar kapalıyken restoran bazlı açmak bir şey
                değiştirmez; çalışmayan bir anahtar sunmuyoruz. */}
            <Toggle on={on} disabled={!globalOn}
              onChange={() => setStoreFeature(restaurant.id, f.key, !on)}
              label={`${restaurant.name} · ${f.label}`} />
          </div>
        );
      })}
    </section>

    {/* Özellik kapılarının hemen altında ama AYRI kart: yukarısı
        "bu mekanda ne çalışıyor", burası "bu mekana ne satıyoruz". */}
    <StoreServiceGates restaurant={restaurant} />
    </>
  );
}

function RestaurantDetailPage({ r, onBack, onGastro, onSuspend }) {
  // Depo canlı dinleniyor: rozet takılınca hem burası hem tüketici
  // uygulaması aynı anda tazeleniyor.
  const takili = badgesOf(r, useBadgeMap());
  const reviews = useMemo(() => restaurantReviews(r), [r.id]);
  const services = storeServices(r);
  const serviceRev = storeServiceRevenue(r);

  // Yorum dağılımı — rozet kararını verirken bakılan asıl kanıt
  const dist = [5, 4, 3, 2, 1].map(star => ({ star, n: reviews.filter(v => v.stars === star).length }));

  // Etkileşim hunisi: gösterimden fiziksel ziyarete. Sunucuda bu sayılar
  // swipes / analytics_events / visits tablolarından geliyor
  // (server/db/queries/cohorts.sql → 4. sorgu).
  const engagement = useMemo(() => {
    const rnd = seeded(r.id * 31);
    const impressions = 3200 + Math.round(rnd() * 5400);
    const details = Math.round(impressions * (0.24 + rnd() * 0.13));
    const saves = Math.round(details * (0.38 + rnd() * 0.16));
    const directions = Math.round(saves * (0.29 + rnd() * 0.14));
    const visits = Math.round(directions * (0.35 + rnd() * 0.18));
    return {
      funnel: [
        { label: 'Kartı gördü', value: impressions, tone: C.faint },
        { label: 'Detayı açtı', value: details, tone: C.blue },
        { label: 'Sağa kaydırdı', value: saves, tone: C.green },
        { label: 'Yol tarifi aldı', value: directions, tone: C.orange },
        { label: 'Ziyaret doğrulandı', value: visits, tone: C.yellow },
      ],
    };
  }, [r.id]);
  const maxN = Math.max(1, ...dist.map(d => d.n));
  const flagged = reviews.filter(v => v.flagged).length;

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Btn label="Restoranlar" onClick={onBack} variant="ghost" size="sm"
          icon={<Icon path="M15 18l-6-6 6-6" size={14} color={C.dim} />} />
        <StoreAvatar restaurant={r} size={40} font={16} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{r.name}</h2>
            {r.gastro && <Badge text="★ Gastro Onaylı" color={C.orangeInk} soft={C.orangeSoft} />}
          </div>
          <div style={{ fontSize: 12.5, color: C.dim, marginTop: 2 }}>{r.cat} • {r.district}</div>
        </div>
        <Btn
          label={r.status === 'active' ? 'Askıya Al' : 'Aktifleştir'} onClick={() => onSuspend(r.id)}
          variant="outline" tone={r.status === 'active' ? 'yellow' : 'green'} size="sm"
        />
      </div>

      {/* Özet şeridi — listedeki bölge/puan/plan/durum bilgileri burada da görünür */}
      <div style={{ ...CARD, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 16, overflow: 'hidden' }}>
        <MetaCell label="Bölge">{r.district}</MetaCell>
        <MetaCell label="Puan"><span style={{ color: C.orangeInk }}>★</span> {r.rating} <span style={{ color: C.faint, fontWeight: 500, fontSize: 12 }}>({r.reviews.toLocaleString('tr')})</span></MetaCell>
        <MetaCell label="Aylık ciro">{money(storeMonthly(r))}</MetaCell>
        <MetaCell label="Durum"><StatusBadge status={r.status} /></MetaCell>
        <MetaCell label="Katılım">{formatDate(r.joined)}</MetaCell>
      </div>

      {/* ─── BU İŞLETMEDE AÇIK ÖZELLİKLER ───
          Restoran bazlı kapatma. Genel anahtar (Ayarlar) her zaman üstün
          gelir: platformda kapalı bir özelliği tek işletme için açmanın
          anlamı yok, o yüzden genel kapalıysa satır da kilitli görünür. */}
      <StoreFeatures restaurant={r} />

      {/* İşletmenin yüklediği menü / fotoğraf / reklam — tıklanıp açılır. */}
      <RestaurantMedia restaurant={r} />

      {/* ─── MÜŞTERİNİN SATIN ALDIĞI ÜCRETLİ ÖZELLİKLER ───
          Bir işletmeyle konuşmadan önce bakılan ilk yer: neyi almış, ne
          zamandır ödüyor, aylık ne ediyor. Katalog REVENUE_STREAMS'ten,
          hangi kalemin açık olduğu STORE_SERVICES'ten geliyor. */}
      <section style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
        <SectionHead title="Aldığı ücretli özellikler"
          right={`${services.length} kalem · ${money(serviceRev)} / ay`} />
        {services.map(x => (
          <div key={x.key} style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: KIND_TONE[x.kind], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{x.name}</span>
                <Badge text={x.kind} color={KIND_TONE[x.kind]} soft={C.panel2} />
              </div>
              <div style={{ fontSize: 11.5, color: C.faint }}>{x.note}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(x.monthly)}/ay</div>
              <div style={{ fontSize: 10.5, color: C.faint }}>{formatDate(x.since)}'ten beri</div>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <div style={{ padding: '20px 18px', fontSize: 12.5, color: C.faint, textAlign: 'center' }}>
            Bu işletme henüz ücretli bir özellik almadı — satış için uygun aday.
          </div>
        )}
      </section>

      {/* ─── ETKİLEŞİM ANALİZİ (B2B panelde işletmenin gördüğü sayılar) ─── */}
      <section style={{ ...CARD, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Son 30 gün · etkileşim hunisi</span>
          <span style={{ fontSize: 11.5, color: C.faint }}>işletme panelinde de görünür</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {engagement.funnel.map((f, i) => (
            <div key={f.label}>
              <div style={{ fontSize: 19, fontWeight: 800, color: f.tone, fontVariantNumeric: 'tabular-nums', marginBottom: 2 }}>
                {f.value.toLocaleString('tr')}
              </div>
              <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 6 }}>{f.label}</div>
              <div style={{ height: 4, borderRadius: 2, background: C.bg, overflow: 'hidden' }}>
                <div style={{ width: `${(f.value / engagement.funnel[0].value) * 100}%`, height: '100%', borderRadius: 2, background: f.tone }} />
              </div>
              {i > 0 && (
                <div style={{ fontSize: 10.5, color: C.faint, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  önceki adımın %{((f.value / engagement.funnel[i - 1].value) * 100).toFixed(0)}'i
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Buradaki "Menüler" bölümü KALDIRILDI. Tohumlanmış sahte veriydi:
          ad, sayfa sayısı ve tarih üretiyordu ama açılacak bir dosya yoktu
          — üstteki gerçek dosya bölümünün hemen altında duran, tıklanınca
          hiçbir şey olmayan bir liste. Gerçek menüler yukarıda
          (`RestaurantMedia`), tıklanıp büyütülebiliyor. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, alignItems: 'start' }}>

        {/* ─── YORUMLAR (rozet ataması bu bölümün başında) ─── */}
        <section style={{ ...CARD, overflow: 'hidden' }}>
          <header style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Yorumlar</span>
            <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
              son {reviews.length} yorum{flagged > 0 && <span style={{ color: C.redInk }}> • {flagged} şikayetli</span>}
            </span>
          </header>

          {/* Rozet ataması — kanıtın hemen üstünde, kararın verildiği yer */}
          <div style={{
            margin: 16, padding: '14px 16px', borderRadius: 12,
            background: r.gastro ? C.orangeSoft : C.panel2,
            border: `1px solid ${r.gastro ? C.orange + '55' : C.border}`,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: r.gastro ? C.orange : C.bg, border: `1px solid ${r.gastro ? C.orange : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon path={icons.star} size={17} color={r.gastro ? '#fff' : C.faint} fill={r.gastro ? '#fff' : 'none'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: r.gastro ? C.orange : C.text }}>
                {r.gastro ? 'Gastro Onaylı' : 'Gastro Onayı yok'}
              </div>
              <div style={{ fontSize: 11.5, color: C.dim, marginTop: 2 }}>
                {r.gastro
                  ? 'Rozet aktif — keşif akışında öncelikli yerleşim alıyor.'
                  : 'Aşağıdaki yorumları değerlendirip rozeti verebilirsiniz.'}
              </div>
            </div>
            <Btn
              label={r.gastro ? 'Rozeti Kaldır' : 'Rozet Ver'}
              onClick={() => onGastro(r.id)}
              variant={r.gastro ? 'outline' : 'filled'}
              tone={r.gastro ? 'red' : 'orange'}
              size="md"
              icon={<Icon path={r.gastro ? icons.x : icons.star} size={14} color={r.gastro ? C.redInk : '#fff'} fill={r.gastro ? 'none' : '#fff'} />}
            />
          </div>

          {/* Editoryal rozetler — Gastro'nun yanında, ama ayrı.
              Gastro şef değerlendirmesine dayanır ve kaydın kendi alanıdır;
              buradakiler editör kararıdır ve ayrı depoda tutulur
              (src/lib/badges.js), besleme kaydı tazelese de silinmezler.
              Bir mekan birden fazla rozet taşıyabilir. */}
          <div style={{ margin: '0 16px 16px', padding: '14px 16px', borderRadius: 12, background: C.panel2, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 3 }}>Editoryal rozetler</div>
            <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 12 }}>
              Uygulamada kartın üstünde ve mekan adının yanında görünür. Birden fazla seçilebilir.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ASSIGNABLE.map(b => {
                const on = takili.some(x => x.id === b.id);
                return (
                  <button
                    key={b.id} type="button" className="gur-admin-btn"
                    onClick={() => toggleBadge(r.id, b.id)}
                    aria-pressed={on} title={b.desc}
                    style={{
                      '--btn-bg': on ? b.hex : C.panel,
                      '--btn-bg-hover': on ? b.hex : C.panel2,
                      '--btn-bg-press': on ? b.hexInk : C.border,
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      border: `1px solid ${on ? b.hex : C.border}`, borderRadius: R.pill,
                      padding: '7px 13px', outline: 'none',
                      fontFamily: FB, fontSize: 12.5, fontWeight: 700,
                      color: on ? '#fff' : C.text,
                    }}>
                    <span aria-hidden style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: on ? '#fff' : b.hex,
                    }} />
                    {b.label}
                  </button>
                );
              })}
            </div>
            {takili.length > 0 && (
              <div style={{ fontSize: 11.5, color: C.dim, marginTop: 11 }}>
                Bu mekanda {takili.length} rozet: {takili.map(b => b.label).join(', ')}.
              </div>
            )}
          </div>

          {/* Puan dağılımı */}
          <div style={{ padding: '0 18px 16px', display: 'grid', gap: 5 }}>
            {dist.map(d => (
              <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11.5, color: C.faint, width: 26, fontVariantNumeric: 'tabular-nums' }}>{d.star}★</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
                  <div style={{ width: `${(d.n / maxN) * 100}%`, height: '100%', borderRadius: 3, background: d.star >= 4 ? C.green : d.star === 3 ? C.yellow : C.red }} />
                </div>
                <span style={{ fontSize: 11.5, color: C.faint, width: 18, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.n}</span>
              </div>
            ))}
          </div>

          {/* Yorum listesi */}
          <div style={{ borderTop: `1px solid ${C.border}` }}>
            {reviews.map((v, i) => (
              <article key={i} style={{ padding: '14px 18px', borderTop: i ? `1px solid ${C.border}` : 'none', background: v.flagged ? C.redSoft : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{v.user}</span>
                  <StarRow n={v.stars} />
                  <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                    {daysAgoLabel(v.days)} • {formatDate(v.date)}
                  </span>
                  {v.flagged && <Badge text="Şikayet edildi" color={C.redInk} soft={C.redSoft} />}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: C.dim, lineHeight: 1.55, maxWidth: '68ch' }}>{v.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function RestaurantsPage({ restaurants, query, onSuspend, onOpen }) {
  // Bu sekme müşterileri gösterir; sahiplenilmemiş mekanlar Mekan Havuzu
  // sayfasında. İkisini tek listede karıştırmak "kim müşterim" sorusunu
  // cevapsız bırakıyordu.
  const filtered = restaurants
    .filter(r => r.account)
    .filter(r => r.name.toLowerCase().includes(query.toLowerCase()) || r.cat.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <TableShell headers={['Restoran', 'Bölge', 'Puan', 'Ücretli Özellikler', { label: 'Aylık', right: true }, 'Durum', { label: 'İşlemler', right: true }]}>
        {filtered.map(r => (
          <tr key={r.id} className="row-hover" onClick={() => onOpen(r.id)} title={`${r.name} detayını aç`}
            style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.1s', cursor: 'pointer' }}>
            <td style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StoreAvatar restaurant={r} size={34} radius={9} />
                <div>
                  {/* Rozet adın hemen ardında kalsın: flex satırında ad
                      sarılınca yıldız hücrenin ucuna kaçıyordu. */}
                  <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>
                    {r.name}
                    {r.gastro && <span title="Gastro Onaylı" style={{ color: C.orangeInk, display: 'inline-block', marginLeft: 5, verticalAlign: '-1px' }}><Icon path={icons.star} size={13} color={C.orangeInk} fill={C.orange} /></span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint }}>{r.reviews.toLocaleString('tr')} yorum</div>
                </div>
              </div>
            </td>
            <td style={{ padding: '14px 18px', fontSize: 13, color: C.dim }}>{r.district}</td>
            <td style={{ padding: '14px 18px', fontSize: 13, fontWeight: 600 }}>★ {r.rating}</td>
            {/* Mağaza bazlı ücretli özellikler — hangi müşterinin neyi
                satın aldığı listede de görünsün, detaya girmeye gerek kalmasın */}
            <td style={{ padding: '14px 18px', maxWidth: 260 }}><ServiceChips services={storeServices(r)} max={3} /></td>
            <td style={{ padding: '14px 18px', textAlign: 'right' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(storeMonthly(r))}</div>
              <div style={{ fontSize: 10.5, color: C.faint }}>{storeServices(r).length} özellik</div>
            </td>
            <td style={{ padding: '14px 18px' }}><StatusBadge status={r.status} /></td>
            <td style={{ padding: '14px 18px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <Btn
                  label={r.status === 'active' ? 'Askıya Al' : 'Aktifleştir'} onClick={() => onSuspend(r.id)}
                  title={r.status === 'active' ? 'Askıya al' : 'Aktifleştir'}
                  variant="ghost" tone={r.status === 'active' ? 'yellow' : 'green'} size="sm"
                />
                {/* Rozet ataması restoran detayında, yorumların olduğu bölümde */}
                <Btn
                  label="Detay" onClick={() => onOpen(r.id)} title="Menüler, yorumlar ve rozet ataması"
                  variant="outline" size="sm"
                  icon={<Icon path={icons.eye} size={13} color={C.dim} />}
                />
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

// Restoranlar artık üç sekmeli bir çalışma alanı: liste, tüm yorumlar ve
// düşük puan kuyruğu. Yorumlar ayrı bir sayfa olmaktan çıkıp buraya taşındı.
function RestaurantsWorkspace({ restaurants, query, tab, onTab, onSuspend, onOpen, hidden, onHide }) {
  const reviews = useMemo(() => allUserReviews(restaurants), [restaurants]);
  const q = query.trim().toLowerCase();
  const match = (v) => !q || v.restName.toLowerCase().includes(q) || v.user.toLowerCase().includes(q) || v.text.toLowerCase().includes(q);
  const all = reviews.filter(match);
  const low = all.filter(v => v.stars <= 2);
  const openLow = low.filter(v => !hidden.has(v.key)).length;

  const tabs = [
    { id: 'list', label: 'Restoranlar', count: restaurants.filter(r => r.account).length },
    { id: 'reviews', label: 'Yorumlar', count: all.length },
    { id: 'low', label: 'Düşük Puanlar', count: openLow, alert: openLow > 0 },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <TabBar tabs={tabs} active={tab} onChange={onTab} />

      {tab === 'list' && (
        <RestaurantsPage restaurants={restaurants} query={query} onSuspend={onSuspend} onOpen={onOpen} />
      )}

      {tab === 'reviews' && (
        <ReviewFeed reviews={all} hidden={hidden} onHide={onHide} onOpenRestaurant={onOpen}
          empty={q ? `"${query}" için yorum bulunamadı` : 'Henüz yorum yok'} />
      )}

      {tab === 'low' && (
        <>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}`, borderRadius: 12, padding: '13px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon path={icons.ban} size={16} color={C.redInk} />
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>
              1 ve 2 puanlı son yorumlar, en yenisi üstte. İşletmeyle iletişime geçmeden önce
              yorumun kuralları ihlal edip etmediğini kontrol edin.
            </div>
          </div>
          <ReviewFeed reviews={low} hidden={hidden} onHide={onHide} onOpenRestaurant={onOpen}
            empty={q ? `"${query}" için düşük puanlı yorum yok` : 'Düşük puanlı yorum yok'} />
        </>
      )}
    </div>
  );
}

// Sahiplenme başvuruları. Tüketici uygulamasındaki ClaimScreen buraya
// yazıyor (src/lib/b2b.js); onaylanınca işletme panel erişimi kazanır ve
// girdiği alanlar dış API verisini ezmeye başlar.
function ClaimsPanel() {
  const localClaims = useClaims();
  const [remote, setRemote] = useState(null);

  const load = () => api.getClaims()
    .then(({ claims }) => setRemote(claims.map(c => ({
      id: c.id, status: c.status,
      restaurantName: c.restaurant_name,
      legalName: c.legal_name, taxId: c.tax_id,
      contactName: c.evidence?.contactName, phone: c.evidence?.phone,
    }))))
    .catch(() => {});

  useEffect(() => {
    let off = false;
    api.ensureMode().then(({ mode }) => { if (mode === 'live' && !off) load(); });
    return () => { off = true; };
     
  }, []);

  const claims = remote ?? localClaims;
  const decide = async (id, status) => {
    if (remote) {
      // Canlı modda karar sunucuda: onay aynı zamanda mekânın sahipliğini
      // bağlıyor, sonra listeyi tazeliyoruz.
      try { await api.decideClaimRemote(id, status, status === 'rejected' ? 'Belge doğrulanamadı' : null); }
      catch { /* liste tazelendiğinde gerçek durum görünür */ }
      await load();
      return;
    }
    decideClaim(id, status, status === 'rejected' ? 'Belge doğrulanamadı' : null);
  };

  const pending = claims.filter(c => c.status === 'pending');
  if (claims.length === 0) return null;

  return (
    <section style={{ ...CARD, overflow: 'hidden', marginBottom: 20 }}>
      <header style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>İşletme sahiplenme başvuruları</span>
        <Badge text={`${pending.length} bekliyor`} color={pending.length ? C.yellow : C.faint} soft={pending.length ? C.yellowSoft : C.panel2} />
      </header>
      {claims.map((c, i) => (
        <div key={c.id} style={{ padding: '14px 18px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.restaurantName}</span>
              {c.status === 'approved' && <Badge text="Onaylandı" color={C.greenInk} soft={C.greenSoft} />}
              {c.status === 'rejected' && <Badge text="Reddedildi" color={C.redInk} soft={C.redSoft} />}
              {c.status === 'pending' && <Badge text="Beklemede" color={C.yellowInk} soft={C.yellowSoft} />}
            </div>
            <div style={{ fontSize: 11.5, color: C.faint }}>
              {c.legalName}{c.taxId ? ` · VKN ${c.taxId}` : ''} · {c.contactName} · {c.phone}
            </div>
          </div>
          {c.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Btn label="Onayla" onClick={() => decide(c.id, 'approved')} variant="filled" tone="green" size="sm" />
              <Btn label="Reddet" onClick={() => decide(c.id, 'rejected')} variant="ghost" size="sm" />
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function ApplicationsPage({ apps, query = '', onReview, onApprove, onReject }) {
  // Başvuruda üç alan aranıyor: işletme adı, sahibin adı ve ilçe. Vergi
  // numarası bilerek dışarıda — kimse onu ezberden aramıyor.
  const q = query.trim().toLocaleLowerCase('tr');
  const gorunen = !q ? apps : apps.filter(a =>
    [a.name, a.owner, a.district].some(v => String(v || '').toLocaleLowerCase('tr').includes(q)));

  if (gorunen.length === 0) {
    return (
      <div style={{ animation: 'fadeIn 0.2s' }}>
      <ClaimsPanel />
      <div style={{ ...CARD, padding: 60, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: 16, background: C.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Icon path={icons.check} size={30} color={C.greenInk} />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>
          {q ? 'Eşleşen başvuru yok' : 'Bekleyen başvuru yok'}</h3>
        <p style={{ margin: 0, fontSize: 13.5, color: C.dim }}>
          {q ? `"${query}" için başvuru bulunamadı.` : 'Tüm restoran başvuruları değerlendirildi.'}</p>
      </div>
      </div>
    );
  }
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <ClaimsPanel />
      <div style={{ marginBottom: 16, padding: '12px 16px', background: C.yellowSoft, border: `1px solid ${C.yellow}44`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon path={icons.inbox} size={18} color={C.yellowInk} />
        <span style={{ fontSize: 13, color: C.text }}><b>{gorunen.length} başvuru</b> vergi levhası doğrulaması bekliyor.</span>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {gorunen.map(a => (
          <div key={a.id} style={{ ...CARD, padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#FF7A1A33,#F04E0033)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: C.orangeInk, flexShrink: 0 }}>{a.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 3 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: C.dim }}>{a.cat} • {a.district} • {a.owner}</div>
            </div>
            <div style={{ textAlign: 'right', marginRight: 8 }}>
              <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 4 }}>{a.submitted}</div>
              <Badge text={a.docStatus === 'yüklendi' ? 'Levha yüklendi' : 'İnceleniyor'} color={a.docStatus === 'yüklendi' ? C.blue : C.yellow} soft={a.docStatus === 'yüklendi' ? C.blueSoft : C.yellowSoft} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Btn label="İncele" onClick={() => onReview(a)} variant="outline" icon={<Icon path={icons.eye} size={14} color={C.dim} />} />
              <Btn label="Onayla" onClick={() => onApprove(a.id)} variant="filled" tone="green" icon={<Icon path={icons.check} size={14} color="#fff" />} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gastro Onaylı: yalnızca onaylı gurmelerin (şeflerin) değerlendirmeleri ve
// verdikleri 10 üzerinden puanlar. Rozet ATAMASI burada değil — Restoranlar
// bölümündeki restoran detayında, kullanıcı yorumlarının olduğu yerde yapılır.
function GastroPage({ restaurants, onGoRestaurants }) {
  const reviews = useMemo(() => gourmetReviews(restaurants), [restaurants]);
  const [chefId, setChefId] = useState('all');
  const shown = chefId === 'all' ? reviews : reviews.filter(v => v.chef.id === chefId);

  const avg = (list) => list.length ? (list.reduce((a, v) => a + Number(v.score), 0) / list.length).toFixed(1) : '—';
  const perChef = CHEFS.map(c => ({ ...c, list: reviews.filter(v => v.chef.id === c.id) }));

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      {/* Rozet atamasının nerede yapıldığını söyle — bu sayfa artık salt değerlendirme */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.orange}`, borderRadius: 12, padding: '13px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Icon path={icons.star} size={16} color={C.orangeInk} fill={C.orange} />
        <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>
          Onaylı gurmelerin değerlendirmeleri ve verdikleri puanlar. Rozet ataması
          Restoranlar bölümünde, restoranın yorumlarının olduğu yerde yapılır.
        </div>
        <Btn label="Restoranlara Git" onClick={onGoRestaurants} variant="outline" size="sm"
          icon={<Icon path={icons.store} size={13} color={C.dim} />} />
      </div>

      {/* Gurme kartları — tıklayınca o gurmenin değerlendirmelerine filtrelenir */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
        {perChef.map(c => {
          const on = chefId === c.id;
          return (
            <motion.button
              key={c.id} onClick={() => setChefId(on ? 'all' : c.id)} className="gur-admin-btn"
              whileTap={{ scale: 0.99 }} transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
              style={{
                textAlign: 'left', cursor: 'pointer', fontFamily: FB, outline: 'none',
                background: on ? C.panel2 : C.panel,
                border: `1px solid ${on ? C.orange + '77' : C.border}`,
                borderRadius: 12, padding: 15,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#FF7A1A,#F04E00)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 15, flexShrink: 0 }}>{c.name.split(' ')[1][0]}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>{c.specialty}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>
                <span><b style={{ color: C.orangeInk, fontSize: 13 }}>{c.list.length}</b> değerlendirme</span>
                <span>ort. <b style={{ color: C.text, fontSize: 13 }}>{avg(c.list)}</b></span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Değerlendirme akışı */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, margin: 0, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {chefId === 'all' ? 'Tüm Gurme Değerlendirmeleri' : `${CHEFS.find(c => c.id === chefId).name} Değerlendirmeleri`}
        </h3>
        <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
          {shown.length} kayıt • ortalama {avg(shown)}/10
        </span>
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {shown.map((v, i) => (
          <article key={v.key} style={{ padding: '14px 18px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {/* Puan rozeti */}
            <div style={{
              width: 52, flexShrink: 0, textAlign: 'center', borderRadius: 10, padding: '8px 4px',
              background: Number(v.score) >= 9 ? C.greenSoft : Number(v.score) >= 8 ? C.orangeSoft : C.panel2,
              border: `1px solid ${Number(v.score) >= 9 ? C.green + '55' : Number(v.score) >= 8 ? C.orange + '55' : C.border}`,
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: Number(v.score) >= 9 ? C.green : Number(v.score) >= 8 ? C.orange : C.dim, fontVariantNumeric: 'tabular-nums' }}>{v.score}</div>
              <div style={{ fontSize: 9.5, color: C.faint }}>/ 10</div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{v.chef.name}</span>
                <span style={{ fontSize: 12.5, color: C.faint }}>→</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>{v.restName}</span>
                {v.gastro && <Badge text="★ Gastro Onaylı" color={C.orangeInk} soft={C.orangeSoft} />}
                <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                  {daysAgoLabel(v.days)} • {formatDate(v.date)}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 6 }}>{v.restCat} • {v.district}</div>
              <p style={{ margin: 0, fontSize: 13, color: C.dim, lineHeight: 1.55, maxWidth: '70ch' }}>{v.note}</p>
            </div>
          </article>
        ))}
        {shown.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: C.faint, fontSize: 13 }}>Bu gurme henüz değerlendirme yapmamış</div>
        )}
      </div>
    </div>
  );
}

function UsersPage({ query }) {
  const filtered = USERS.filter(u => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <TableShell headers={['Kullanıcı', 'E-posta', 'Katılım', 'Kaydırma', 'Favori', 'Durum']}>
        {filtered.map(u => (
          <tr key={u.id} className="row-hover" style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.1s' }}>
            <td style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: C.dim }}>{u.name[0]}</div>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{u.name}</span>
              </div>
            </td>
            <td style={{ padding: '14px 18px', fontSize: 13, color: C.dim }}>{u.email}</td>
            <td style={{ padding: '14px 18px', fontSize: 13, color: C.dim }}>{u.joined}</td>
            <td style={{ padding: '14px 18px', fontSize: 13, fontWeight: 600 }}>{u.swipes.toLocaleString('tr')}</td>
            <td style={{ padding: '14px 18px', fontSize: 13 }}>{u.favs}</td>
            <td style={{ padding: '14px 18px' }}><StatusBadge status={u.status} /></td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

// Gelir kalemleri faz planına birebir bağlı. Her kalem hangi fazda
// açıldığını ve aktif fazda çalışıp çalışmadığını gösterir; toplam MRR
// yalnızca açık kalemlerden hesaplanır, böylece faz anahtarı gerçek bir
// senaryo farkı yaratır.
// ═══════════════════════════════════════════════════════════════════════
// MEKAN HAVUZU — dış beslemeden gelen, henüz sahiplenilmemiş kayıtlar
//
// Restoranlar sekmesi müşterileri gösteriyor; burası havuzun geri kalanı:
// Google Places / OSM beslemesinden gelen, kullanıcı adı olmayan mekanlar.
// Uygulamada görünüyorlar (kullanıcı onları da keşfediyor) ama bize ödeme
// yapmıyorlar — satışın başlayacağı liste burası.
// ═══════════════════════════════════════════════════════════════════════
/**
 * ALTIN PAKET — Gastro şef videosu.
 *
 * Katalogdaki tek "üst raf" kalem: şef çekimi yapılıyor, Gastro Onaylı
 * kategorisine giriyor ve en pahalısı. Diğer hizmetlerle aynı gri satırda
 * durunca farkı okunmuyordu, bu yüzden kendi altın yüzeyi var.
 *
 * Altın YENİ BİR RENK AİLESİ DEĞİL: palete kalıcı bir jeton eklenmedi,
 * yalnızca bu tek satırın yüzeyi. Yeni bir yeşil/kırmızı/amber yazmama
 * kuralı duruyor — altın bir DURUM değil, tek bir ürünün kimliği.
 *
 * İki temada iki farklı sorun var: koyu zeminde altın metin parlıyor ama
 * beyaz kâğıtta aynı ton (#E9C456, beyazla 1.7:1) okunmuyor. Bu yüzden
 * mürekkep açık temada koyulaşıyor (#7A5B0B, beyazla 6.4:1).
 */
const GOLD = live({
  bg: () => C.isDark
    ? 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(120,86,12,0.07))'
    : 'linear-gradient(135deg, rgba(233,196,86,0.20), rgba(255,244,214,0.55))',
  border: () => C.isDark ? 'rgba(233,196,86,0.40)' : 'rgba(180,140,30,0.38)',
  ink: () => C.isDark ? '#E9C456' : '#7A5B0B',
  soft: () => C.isDark ? 'rgba(233,196,86,0.16)' : 'rgba(233,196,86,0.30)',
});

// Rozet 'API' yazıyor: kaydın nereden geldiğini teknik adıyla söylemek
// 'dış besleme'den daha net — panelde bakan kişi Google Places / OSM
// beslemesini API olarak biliyor.
const SOURCE_LABEL = { api: 'API', owner: 'Sahiplenilmiş', manual: 'Elle eklendi' };

// Havuzdaki mekana sahiplenme daveti.
//
// E-posta varsa yöneticinin posta istemcisinde hazır bir taslak açılır
// (mailto:) — projede sunucu tarafı posta taşıması yok, "gönderildi"
// numarası yapmıyoruz. E-posta yoksa siteye/telefona yönlendirir; hiçbir
// kanal yoksa düğme kapalı ve nedeni yazıyor.
//
// NOT: havuzun e-postaları Google Places'ten GELMEZ — Places API'nin
// e-posta alanı yoktur. Bunlar mekanın kendi bildirdiği OSM
// `email`/`contact:email` etiketinden geliyor, çoğu kayıtta yok.
function InviteButton({ r, invite }) {
  const k = channelOf(r);
  if (invite) {
    return (
      <Btn label={`Davet edildi · ${formatDate(invite.at)}`} variant="soft" tone="green" size="sm"
        title={invite.adres ? `${invite.adres} adresine` : undefined}
        icon={<Icon path={icons.check} size={13} color={C.greenInk} />}
        onClick={() => sendInvite(r)} disabled={!k || k.kind !== 'email'} />
    );
  }
  if (!k) {
    return <Btn label="İletişim bilgisi yok" variant="ghost" size="sm" disabled
      title="Beslemede e-posta, site veya telefon yok — davet gönderilecek adres bulunamadı." />;
  }
  if (k.kind !== 'email') {
    return <Btn label={k.kind === 'website' ? 'Siteden ulaş' : 'Telefonla ara'} variant="outline" size="sm"
      title={`Beslemede e-posta yok; ${k.value} üzerinden ulaşabilirsiniz.`}
      onClick={() => window.open(k.kind === 'website' ? `https://${k.value.replace(/^https?:\/\//, '')}` : `tel:${k.value}`, '_blank', 'noopener')} />;
  }
  return <Btn label="E-posta ile davet et" variant="filled" tone="orange" size="sm"
    title={`${k.value} adresine davet taslağı açılır`}
    onClick={() => sendInvite(r)} />;
}

function VenuePoolPage({ restaurants = [], query = '', onOpen }) {
  // Davetler depoda: sayfa yenilenince kimin davet edildiği unutulmasın.
  const invites = useInvites();
  const [sort, setSort] = useState('rating');   // 'rating' | 'reviews' | 'name'

  const pool = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const rows = restaurants
      .filter(r => !r.account)
      .filter(r => !q || r.name.toLocaleLowerCase('tr').includes(q) || r.district.toLocaleLowerCase('tr').includes(q));
    const sorters = {
      rating: (a, b) => b.rating - a.rating,
      reviews: (a, b) => b.reviews - a.reviews,
      name: (a, b) => a.name.localeCompare(b.name, 'tr'),
    };
    return rows.sort(sorters[sort]);
  }, [restaurants, query, sort]);

  const owned = restaurants.filter(r => r.account).length;
  const total = restaurants.length;

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      {/* Havuzun neresindeyiz: sahiplenme oranı satışın tek ölçüsü */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Listedeki mekan" value={total} delta={`portföy ${STATS.totalRestaurants}`} deltaNeutral icon={icons.store} accent={{ color: C.blue, soft: C.blueSoft }} />
        <KpiCard label="Sahiplenilmiş" value={owned} delta={`%${Math.round((owned / total) * 100)}`} deltaNeutral icon={icons.check} accent={{ color: C.greenInk, soft: C.greenSoft }} />
        <KpiCard label="Sahiplenilmemiş" value={pool.length} icon={icons.inbox} accent={{ color: C.yellowInk, soft: C.yellowSoft }} />
        <KpiCard label="Gönderilen davet" value={Object.keys(invites).length} icon={icons.msg} accent={{ color: C.orangeInk, soft: C.orangeSoft }} />
      </div>

      <section style={{ ...CARD, overflow: 'hidden' }}>
        <SectionHead title="Sahiplenilmemiş mekanlar"
          right="API'den gelir · panel girişi yok" />

        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>Sırala:</span>
          {[['rating', 'Puan'], ['reviews', 'Yorum'], ['name', 'İsim A-Z']].map(([id, label]) => (
            <Btn key={id} label={label} onClick={() => setSort(id)} size="sm"
              variant={sort === id ? 'soft' : 'ghost'} tone={sort === id ? 'orange' : 'neutral'} />
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
            {pool.length} mekan{query ? ` · "${query}" için` : ''}
          </span>
        </div>

        {pool.map((r, i) => (
          <div key={r.id} className="row-hover"
            style={{ padding: '13px 18px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
            <StoreAvatar restaurant={r} size={34} radius={10} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.name}</span>
                <Badge text={SOURCE_LABEL[r.source] || 'API'} color={C.blue} soft={C.blueSoft} />
              </div>
              <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                {r.cat} · {r.district} · ★ {r.rating} ({r.reviews.toLocaleString('tr')} yorum) · havuza {formatDate(r.joined)} girdi
                {(() => {
                  const k = channelOf(r);
                  if (!k) return <> · <span style={{ color: C.yellowInk }}>iletişim bilgisi yok</span></>;
                  return <> · {k.kind === 'email' ? 'e-posta' : k.kind === 'website' ? 'site' : 'telefon'}: {k.value}</>;
                })()}
              </div>
            </div>
            <Btn label="Detay" onClick={() => onOpen?.(r.id)} variant="outline" size="sm"
              icon={<Icon path={icons.eye} size={13} color={C.dim} />} />
            <InviteButton r={r} invite={inviteOf(r.id, invites)} />
          </div>
        ))}

        {pool.length === 0 && (
          <div style={{ padding: '26px 18px', textAlign: 'center', fontFamily: FB, fontSize: 12.5, color: C.faint }}>
            {query ? `"${query}" için sahiplenilmemiş mekan yok` : 'Havuzdaki tüm mekanlar sahiplenilmiş'}
          </div>
        )}

        <div style={{ padding: '13px 18px', borderTop: `1px solid ${C.border}` }}>
          <p style={{ margin: 0, fontFamily: FB, fontSize: 11.5, color: C.faint, lineHeight: 1.6 }}>
            Bu mekanlar uygulamada görünür ve kullanıcı onları da keşfeder; bilgileri
            dış kaynaktan gelir. İşletme kaydını sahiplendiği anda Restoranlar
            sekmesine geçer, bilgilerini kendisi yönetmeye başlar ve fiyatlandırma
            panelinde muhatap olur.
          </p>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FİYATLANDIRMA — işletme bazlı fiyat teklifleri
//
// Teklif kaleme değil İŞLETMEYE gidiyor: bir mekanın aldığı hizmetlerin
// fiyatı tek ekranda görülüp tek tek teklif ediliyor. Liste fiyatı yok —
// her işletmenin fiyatı kendi pazarlığının sonucu.
//
// Panelde yalnızca kaydını sahiplenmiş, girişi olan müşteriler görünür.
// Dış beslemeden (Google Places / OSM) gelen mekanların kullanıcı adı da
// muhatabı da yok; onlara teklif göndermek boşa yazmak olurdu.
// ═══════════════════════════════════════════════════════════════════════
/**
 * PAZARLIKLI KALEMLERİN LİSTE FİYATI.
 *
 * Reklam envanterinin sabit fiyatı Reklam Takvimi sayfasında; burası
 * pazarlıklı üçlünün BAŞLANGIÇ fiyatı. İkisi ayrı sayfada çünkü ayrı
 * işler: orada takvim ve doluluk var, burada pazarlık.
 *
 * Fiyat değişikliği GÖNDERİLMİŞ TEKLİFLERİ bozmuyor (bkz. pricing.js →
 * setListPrice). Satırda "katalog: ₺X" yazıyor: yöneticinin kendi
 * değiştirdiği değerle varsayılanı ayırt edebilmesi gerekiyor, yoksa
 * "bunu ben mi yazdım" sorusunun cevabı yok.
 */
function ListPriceCard() {
  const store = pricing.usePricing();
  const [taslak, setTaslak] = useState({});     // yazarken tutulan ham metin

  const kaydet = (key) => {
    const raw = taslak[key];
    if (raw !== undefined) pricing.setListPrice(key, Number(String(raw).replace(/[^\d]/g, '')));
    setTaslak(t => { const n = { ...t }; delete n[key]; return n; });
  };

  return (
    <section style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
      <SectionHead title="Liste fiyatları — pazarlıklı kalemler"
        right={`${pricing.customListCount(store)} kalem elle belirlendi`} />
      <div style={{ padding: '11px 18px', fontFamily: FB, fontSize: 12, color: C.dim, lineHeight: 1.55, borderTop: `1px solid ${C.border}` }}>
        Teklif alanı bu fiyattan başlıyor ve işletme panelinde
        &ldquo;liste:&rdquo; önekiyle görünüyor — taahhüt değil, pazarlığın
        başlangıç noktası. Değiştirmek, gönderilmiş tekliflerin tutarını
        etkilemez.
      </div>
      {pricing.NEGOTIATED.map(sv => {
        const guncel = pricing.listPriceOf(sv.key, store);
        const ozel = guncel !== sv.price;
        const deger = taslak[sv.key] !== undefined ? taslak[sv.key] : String(guncel);
        return (
          <div key={sv.key} style={{ padding: '13px 18px', borderTop: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 190 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{sv.name}</div>
              <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                {ozel ? `katalog: ${tamPara(sv.price)} ${sv.unit}` : 'katalog fiyatında'}
              </div>
            </div>
            {ozel && <Badge text="elle belirlendi" color={C.orangeInk} soft={C.orangeSoft} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg,
              border: `1px solid ${C.border}`, borderRadius: R.control, padding: '0 12px', height: 38 }}>
              <span style={{ fontFamily: FB, fontSize: 13, color: C.faint }}>₺</span>
              <input
                value={deger}
                onChange={e => setTaslak(t => ({ ...t, [sv.key]: e.target.value }))}
                onBlur={() => kaydet(sv.key)}
                onKeyDown={e => { if (e.key === 'Enter') { kaydet(sv.key); e.currentTarget.blur(); } }}
                inputMode="numeric" aria-label={`${sv.name} liste fiyatı`}
                style={{ width: 84, background: 'transparent', border: 'none', outline: 'none',
                  color: C.text, fontFamily: FB, fontSize: 13.5, fontWeight: 700 }} />
              <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>{sv.unit}</span>
            </div>
            {/* Katalog değerine dönüş: elle yazılan sayıyı silmek için
                kutuyu boşaltıp beklemek gerekmesin. */}
            <Btn label="Katalog" size="sm" variant="outline" disabled={!ozel}
              onClick={() => pricing.setListPrice(sv.key, sv.price)} />
          </div>
        );
      })}
    </section>
  );
}

/**
 * MÜŞTERİ BAZLI SATIŞ KAPILARI — "bu müşteriye satıyor muyuz".
 *
 * Platform kapısıyla (Hizmetler sayfası) karıştırmayın: orası "bu kalemi
 * hiç satmıyoruz" der, burası "bu müşteriye satmıyoruz". Sıra tek yönlü —
 * platformda kapalıysa buradan açılamıyor; anahtar devre dışı kalıyor ve
 * sebebi satırda yazıyor.
 *
 * İki yerden çiziliyor (restoran detayı + Fiyatlandırma satırı) ama tek
 * bileşen ve tek depo: ikisi ayrı yazılsaydı biri eklenen bir kalemi
 * göstermeyi unuturdu. İkisi de tek bir müşteriye girilmiş olmayı
 * gerektiriyor, o yüzden "yanlış satıra basma" riski yok.
 */
function StoreServiceGates({ restaurant }) {
  const settings = usePlatformSettings();
  const kapali = closedServiceCount(restaurant.id, settings);

  return (
    <section style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
      <SectionHead title="Bu müşteriye satışta olan hizmetler"
        right={kapali ? `${kapali} kalem kapalı` : 'hepsi açık'} />
      {SERVICE_GATES.map(g => {
        const sebep = serviceGateReason(g.key, settings, restaurant.id);
        const acik = isServiceOpen(g.key, settings, restaurant.id);
        // Üstteki iki kapıdan kapalıysa müşteri anahtarı bir şey
        // değiştirmez; çalışmayan anahtar sunmuyoruz.
        const genelKapali = sebep === 'feature' || sebep === 'manual';
        return (
          <div key={g.key} style={{ padding: '13px 18px', borderTop: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {g.label}
                {sebep === 'feature' && <Badge text="özellik kapalı" color={C.yellowInk} soft={C.yellowSoft} />}
                {sebep === 'manual' && <Badge text="platformda kapalı" color={C.yellowInk} soft={C.yellowSoft} />}
                {sebep === 'store' && <Badge text="bu müşteriye kapalı" color={C.redInk} soft={C.redSoft} />}
              </div>
              {pricing.isNegotiated(g.key) && (
                <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, marginTop: 2 }}>
                  liste: {tamPara(pricing.listPriceOf(g.key))} {pricing.listUnitOf(g.key)}
                </div>
              )}
            </div>
            {/* Devre dışı sebebi doğru yazılsın: özellik kapısı Ayarlar'da,
                satış kapısı Hizmetler sayfasında — ikisini aynı cümleyle
                anlatmak yöneticiyi yanlış sayfaya yollardı. */}
            <Toggle on={acik} disabled={genelKapali}
              disabledTitle={sebep === 'feature'
                ? 'Dayandığı özellik kapalı — önce Ayarlar’dan açın'
                : 'Platform genelinde satışa kapalı — önce Hizmetler sayfasından açın'}
              label={`${restaurant.name} · ${g.label}`}
              onChange={() => setServiceOpenFor(restaurant.id, g.key, !acik)} />
          </div>
        );
      })}
    </section>
  );
}

function OfferField({ current, offer, onSend, listPrice = 0, listUnit = '' }) {
  // BİRİM UYUŞMASI ŞART. Teklifin tutarı AYLIK (`offerMonthly`) ve gelir
  // tabloları onu aylık olarak topluyor. Liste fiyatı ise kalemin kendi
  // biriminde: Gastro "/ ay", İkinci Şans "/ paket", anlık fırsat
  // "/ yayın". Yayın başına ₺450'yi aylık alana yazmak, ₺2.400 ödeyen
  // müşteride "-%81" gibi anlamsız bir sapma üretiyordu.
  //
  // Bu yüzden alan yalnızca AYLIK kalemlerde liste fiyatından doluyor;
  // diğerlerinde liste fiyatı alanın yanında BİLGİ olarak duruyor ve
  // tutarı yönetici kendi çeviriyor — çevirmeyi biz uydurmuyoruz.
  const aylikListe = listUnit === '/ ay' ? listPrice : 0;
  const [value, setValue] = useState(String(aylikListe || current || ''));
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const n = Number(value.replace(/[^\d]/g, ''));
  const valid = Number.isFinite(n) && n > 0;
  const delta = valid && current ? Math.round(((n - current) / current) * 100) : null;

  const send = () => {
    if (!valid) return;
    onSend({ offerMonthly: n, note });
    setNote('');
    setSent(true);
    setTimeout(() => setSent(false), 1800);
  };

  const tone = offer?.status === 'accepted' ? C.green
    : offer?.status === 'declined' ? C.red : C.yellow;
  const label = offer?.status === 'accepted' ? 'Kabul edildi'
    : offer?.status === 'declined' ? 'Reddedildi' : 'İşletmede bekliyor';

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: R.control, padding: '0 12px', height: 38 }}>
        <span style={{ fontFamily: FB, fontSize: 13, color: C.faint }}>₺</span>
        <input
          value={value} onChange={e => setValue(e.target.value)}
          inputMode="numeric" placeholder="Teklif"
          style={{ width: 84, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontFamily: FB, fontSize: 13.5, fontWeight: 700 }} />
        <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>/ay</span>
      </div>
      {delta !== null && delta !== 0 && (
        <span style={{ fontFamily: FB, fontSize: 11.5, fontWeight: 700, color: delta < 0 ? C.green : C.yellow }}>
          {delta > 0 ? '+' : ''}{delta}%
        </span>
      )}
      {/* Aylık kalemde listeye dönüş düğmesi; farklı birimli kalemde
          yalnızca bilgi — tek tıkla yazılamaz, çünkü aynı sayı değil. */}
      {aylikListe > 0 && n !== aylikListe && (
        <Btn label={`Liste ${tamPara(aylikListe)}`} size="sm" variant="outline"
          onClick={() => setValue(String(aylikListe))} />
      )}
      {listPrice > 0 && !aylikListe && (
        <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, whiteSpace: 'nowrap' }}>
          liste: {tamPara(listPrice)} {listUnit}
        </span>
      )}
      <input
        value={note} onChange={e => setNote(e.target.value)}
        placeholder="Not (işletme görür)"
        style={{ flex: 1, minWidth: 150, height: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: R.control, padding: '0 12px', color: C.text, fontFamily: FB, fontSize: 12.5, outline: 'none' }} />
      <Btn label={sent ? 'Gönderildi' : 'Teklif gönder'} onClick={send} disabled={!valid}
        variant="filled" tone={sent ? 'green' : 'orange'} size="md" />
      {offer && (
        <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: tone, background: `${tone}1F`, border: `1px solid ${tone}33`, borderRadius: R.pill, padding: '4px 11px' }}>
          {label} · {tamPara(offer.offerMonthly)}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HİZMETLER — sattığımız her şey tek listede
//
// Önceden bir kalemin kaç müşteride açık olduğunu görmenin tek yolu
// restoranları tek tek gezmekti; ciro sayfası toplamları veriyordu ama
// "banner'ı kimler almış" sorusunu cevaplamıyordu.
//
// Buradaki her satır bir ÜRÜN: kaç müşteride açık, aylık ne getiriyor,
// kaç teklif havada. Satıra basınca o hizmetin fiyatlandırma sekmesine
// gidiliyor — genel bakıştan işe tek tıkla.
// ═══════════════════════════════════════════════════════════════════════
function ServicesPage({ restaurants = [], query = '', onOpenStream }) {
  const store = pricing.usePricing();
  // Satış kapıları: bir hizmet kapatıldığında işletme panelinde kart
  // kaybolmuyor, "Pek yakında" yazıyor (bkz. lib/platform.js).
  const platform = usePlatformSettings();
  // Materyal alanı satır satır açılıyor: altısı birden açık olsaydı sayfa
  // yükleme kutularından ibaret kalır, katalogun kendisi kaybolurdu.
  const [acik, setAcik] = useState(null);
  useCreatives();
  const q = query.trim().toLocaleLowerCase('tr');

  const rows = REVENUE_STREAMS.map(sv => {
    const musteriler = restaurants.filter(r => storeServices(r).some(x => x.key === sv.key));
    const teklifler = store.offers.filter(o => o.streamKey === sv.key);
    return {
      ...sv,
      customers: musteriler,
      pending: teklifler.filter(o => o.status === 'pending').length,
      accepted: teklifler.filter(o => o.status === 'accepted').length,
      rejected: teklifler.filter(o => o.status === 'rejected').length,
    };
  }).filter(sv => !q
    || sv.name.toLocaleLowerCase('tr').includes(q)
    || sv.kind.toLocaleLowerCase('tr').includes(q)
    || sv.customers.some(r => r.name.toLocaleLowerCase('tr').includes(q)));

  const enCok = Math.max(1, ...rows.map(r => r.monthly));

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KpiCard label="Satılan hizmet" value={`${REVENUE_STREAMS.length}`} icon={icons.money}
          accent={{ color: C.orangeInk, soft: C.orangeSoft }} delta="katalogda" deltaNeutral />
        <KpiCard label="Aylık toplam" value={money(STREAM_TOTAL)} icon={icons.trend}
          accent={{ color: C.greenInk, soft: C.greenSoft }} delta="tüm kalemler" deltaNeutral />
        <KpiCard label="Bekleyen teklif" value={`${store.offers.filter(o => o.status === 'pending').length}`}
          icon={icons.inbox} accent={{ color: C.blue, soft: C.blueSoft }} delta="işletme kararı" deltaNeutral />
      </div>

      <section style={{ ...CARD, overflow: 'hidden' }}>
        <SectionHead title="Hizmet kataloğu" right={`${rows.length} kalem`} />
        {rows.length === 0 ? <EmptyRow text={`"${query}" için hizmet bulunamadı`} /> : rows.map(sv => (
          <div key={sv.key} style={{ padding: '15px 18px', borderTop: `1px solid ${C.border}`,
            position: 'relative', overflow: 'hidden',
            ...(sv.key === 'gastroPackage'
              ? { background: GOLD.bg, borderTop: `1px solid ${GOLD.border}` }
              : null) }}>
            {sv.key === 'gastroPackage' && <span className="gur-gold-sheen" aria-hidden="true" />}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700,
                    ...(sv.key === 'gastroPackage' ? { color: GOLD.ink } : null) }}>
                    {sv.key === 'gastroPackage' ? '\u2605 ' : ''}{sv.name}
                  </span>
                  <span style={{ fontFamily: FB, fontSize: 10.5, fontWeight: 700, color: C.dim,
                    background: C.panel2, borderRadius: R.pill, padding: '2px 9px' }}>{sv.kind}</span>
                  {sv.key === 'gastroPackage' && (
                    <span style={{ fontFamily: FB, fontSize: 10.5, fontWeight: 800, color: GOLD.ink,
                      background: GOLD.soft, border: `1px solid ${GOLD.border}`,
                      borderRadius: R.pill, padding: '2px 9px', letterSpacing: 0.3 }}>ALTIN PAKET</span>
                  )}
                  {/* Ödüllü video KULLANICI özelliği: reklam izleyen kaydırma
                      hakkı kazanır. Restoranın satın aldığı şey o akışta
                      yayınlanma hakkı — mekanizmanın kendisi değil. */}
                  {sv.key === 'rewardedAds' && (
                    <span style={{ fontFamily: FB, fontSize: 10.5, fontWeight: 700, color: C.blue,
                      background: C.blueSoft, borderRadius: R.pill, padding: '2px 9px' }}>kullanıcı özelliği</span>
                  )}
                  {/* Durum renkle DEĞİL yazıyla; sebebi de yazılı çünkü
                      "özellik kapalı" ile "satışı durdurdum" farklı işler. */}
                  {!isServiceOpen(sv.key, platform) && (
                    <span style={{ fontFamily: FB, fontSize: 10.5, fontWeight: 800, color: C.redInk,
                      background: C.redSoft, borderRadius: R.pill, padding: '2px 9px' }}>
                      {serviceGateReason(sv.key, platform) === 'feature' ? 'ÖZELLİK KAPALI' : 'SATIŞA KAPALI'}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>{sv.note}</div>
                {sv.key === 'rewardedAds' && (
                  <div style={{ fontFamily: FB, fontSize: 11.5, color: C.dim, lineHeight: 1.5, marginTop: 4 }}>
                    Kaydırma hakkı kazandıran akış kullanıcıya ait ve restorandan
                    bağımsız çalışır; restoran yalnızca bu akışta yayınlanacak
                    videoyu satın alır.
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', minWidth: 110 }}>
                <div style={{ fontSize: 15, fontWeight: 800, ...NUM }}>{money(sv.monthly)}</div>
                <div style={{ fontFamily: FB, fontSize: 11, color: C.faint }}>{sv.unit}</div>
              </div>
              {/* Satışı aç/kapa. Özellik kapısından kapalıysa buradan
                  açılamıyor — iki yerden aynı şeyi açmak, birini kapatıp
                  diğerinin açık kaldığını sanmak demekti. */}
              <Toggle
                on={isServiceOpen(sv.key, platform)}
                disabled={serviceGateReason(sv.key, platform) === 'feature'}
                label={`${sv.name} satışta mı`}
                onChange={() => setServiceOpen(sv.key, !isServiceOpen(sv.key, platform))} />
              <Btn label="Tanıtım" size="sm"
                variant={acik === sv.key ? 'filled' : 'outline'}
                tone={acik === sv.key ? 'orange' : undefined}
                count={liveCount(sv.key) || undefined}
                onClick={() => setAcik(v => (v === sv.key ? null : sv.key))} />
              <Btn label="Teklifler" onClick={() => onOpenStream?.(sv.key)} variant="outline" size="sm" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160, height: 6, borderRadius: 3, background: C.panel2, overflow: 'hidden' }}>
                <div style={{ width: `${(sv.monthly / enCok) * 100}%`, height: '100%', background: C.orange, borderRadius: 3 }} />
              </div>
              {/* Renk tek başına bilgi taşımasın: sayılar da yazılı. */}
              <span style={{ fontFamily: FB, fontSize: 11.5, color: C.dim }}>
                {sv.customers.length} müşteride açık
              </span>
              {sv.pending > 0 && (
                <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: C.yellowInk,
                  background: C.yellowSoft, borderRadius: R.pill, padding: '2px 9px' }}>{sv.pending} teklif bekliyor</span>
              )}
              {sv.accepted > 0 && (
                <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: C.greenInk,
                  background: C.greenSoft, borderRadius: R.pill, padding: '2px 9px' }}>{sv.accepted} kabul</span>
              )}
              {sv.rejected > 0 && (
                <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: C.redInk,
                  background: C.redSoft, borderRadius: R.pill, padding: '2px 9px' }}>{sv.rejected} ret</span>
              )}
            </div>

            {acik === sv.key && <CreativeSlot streamKey={sv.key} />}
          </div>
        ))}
      </section>
    </div>
  );
}

/**
 * İşletmeden gelen teklif talepleri.
 *
 * Fiyatlandırma sayfasının EN ÜSTÜNDE ve bu bilinçli: burası yöneticinin
 * "bugün ne yapmam lazım" listesi. Aşağıdaki müşteri listesi tarama içindir,
 * bu ise iş kuyruğu — kuyruk aşağıda kalsa fark edilmezdi.
 *
 * Talep, teklifin kendisi DEĞİL: yönetici buradan "Teklif gönder"e basınca
 * ilgili hizmetin sekmesine gidip fiyatı yazıyor. Talebi kapatmak tek
 * tıkla teklif göndermek olsaydı fiyat girilmemiş bir teklif çıkardı.
 */
function RequestQueue({ onGoStream }) {
  const talepler = useRequests();
  const acik = openRequests(talepler);
  if (!acik.length) return null;

  return (
    <section style={{ ...CARD, overflow: 'hidden', marginBottom: 16, borderColor: C.orangeInk }}>
      <SectionHead title="İşletmeden gelen teklif talepleri"
        right={`${acik.length} talep · fiyatlandırma bekliyor`} />
      {acik.map(t => (
        <div key={t.id} style={{ padding: '14px 18px', borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.restaurantName}</div>
            <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
              {t.streamName} · {new Date(t.at).toLocaleString('tr')}
            </div>
            {t.note && (
              <div style={{ fontFamily: FB, fontSize: 11.5, color: C.dim, marginTop: 4 }}>“{t.note}”</div>
            )}
          </div>
          {t.status === 'quoted' && (
            <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: C.blue,
              background: C.blueSoft, borderRadius: R.pill, padding: '3px 9px' }}>teklif gönderildi</span>
          )}
          <Btn label="Teklif gönder" size="sm" variant="filled" tone="orange"
            onClick={() => onGoStream?.(t.streamKey)} />
          <Btn label="Talebi kapat" size="sm" variant="soft" tone="red"
            onClick={() => closeRequest(t.id, 'yönetici kapattı')} />
        </div>
      ))}
    </section>
  );
}

function PricingPage({ restaurants = [], query = '', stream = 'all', onStream }) {
  const store = pricing.usePricing();
  // Müşteri bazlı satış kapıları satır başlığında rozet olarak yazılıyor.
  const platform = usePlatformSettings();
  const [openId, setOpenId] = useState(null);

  // Yalnız hesabı olan müşteriler. Dış beslemeden gelen mekanlar burada yok.
  //
  // HİZMET SEKMESİ seçiliyse liste o hizmetle ilgili müşterilere daralır:
  // "o hizmeti alanlar" + "o hizmet için teklif gönderilmiş olanlar".
  // İkincisi şart — teklif gönderdiğin ama henüz almamış müşteriyi
  // listeden düşürmek, takip etmen gereken tam kişiyi gizlerdi.
  const customers = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    const teklifli = new Set(store.offers
      .filter(o => o.streamKey === stream).map(o => String(o.restaurantId)));
    return restaurants
      .filter(r => r.account)
      .filter(r => stream === 'all'
        || storeServices(r).some(x => x.key === stream)
        || teklifli.has(String(r.id)))
      .filter(r => !q || r.name.toLocaleLowerCase('tr').includes(q))
      .sort((a, b) => storeMonthly(b) - storeMonthly(a));
  }, [restaurants, query, stream, store.offers]);

  const apiOnly = restaurants.filter(r => !r.account).length;
  const pendingFor = (id) => store.offers.filter(
    o => String(o.restaurantId) === String(id) && o.status === 'pending').length;
  const latestOffer = (id, key) => store.offers
    .filter(o => String(o.restaurantId) === String(id) && o.streamKey === key)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <RequestQueue onGoStream={onStream} />

      {/* Teklif alanı bu fiyattan başlıyor; en üstte çünkü teklif
          göndermeden önce bakılacak yer burası. */}
      <ListPriceCard />

      {/* ─── HİZMET SEKMELERİ ───
          Her ücretli kalemin kendi sekmesi. Sekmedeki sayı o hizmet için
          BEKLEYEN teklif sayısı: yöneticinin peşine düşmesi gereken iş.
          Etiketin tek başına renk taşıması yetmiyor, sayı da yazılı. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[{ key: 'all', short: 'Tümü' }, ...REVENUE_STREAMS].map(sv => {
          const secili = stream === sv.key;
          const bekleyen = sv.key === 'all'
            ? store.offers.filter(o => o.status === 'pending').length
            : store.offers.filter(o => o.streamKey === sv.key && o.status === 'pending').length;
          return (
            <Btn key={sv.key} label={sv.short} size="sm"
              variant={secili ? 'filled' : 'outline'} tone={secili ? 'orange' : 'neutral'}
              count={bekleyen || undefined}
              onClick={() => onStream?.(sv.key)} />
          );
        })}
      </div>

      <section style={{ ...CARD, padding: '15px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Icon path={icons.store} size={17} color={C.orangeInk} />
        <span style={{ fontFamily: FB, fontSize: 12.5, color: C.dim, lineHeight: 1.5, flex: 1, minWidth: 220 }}>
          Teklifler işletme bazlı gönderilir. Burada yalnızca kaydını
          sahiplenmiş, panel girişi olan müşteriler görünür
          {apiOnly > 0 && ` — dış beslemeden gelen ${apiOnly} mekan listede değil`}.
        </span>
        <span style={{ fontFamily: FB, fontSize: 11.5, fontWeight: 700, color: C.faint }}>
          {customers.length} müşteri · {store.offers.filter(o => o.status === 'pending').length} bekleyen teklif
        </span>
      </section>

      {customers.map(r => {
        const services = storeServices(r);
        const open = openId === r.id;
        const pending = pendingFor(r.id);
        return (
          <section key={r.id} style={{ ...CARD, overflow: 'hidden', marginBottom: 12 }}>
            <div className="row-hover" onClick={() => setOpenId(open ? null : r.id)}
              style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <StoreAvatar restaurant={r} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</span>
                  {r.gastro && <Icon path={icons.star} size={12} color={C.orangeInk} fill={C.orange} />}
                  {pending > 0 && <Badge text={`${pending} teklif bekliyor`} color={C.yellowInk} soft={C.yellowSoft} />}
                  {/* Kapalı kalem varsa satırı açmadan görünsün: kapatıp
                      unutmak, sonra "neden teklif istemiyor" diye
                      aramak demekti. */}
                  {closedServiceCount(r.id, platform) > 0 && (
                    <Badge text={`${closedServiceCount(r.id, platform)} kalem kapalı`} color={C.redInk} soft={C.redSoft} />
                  )}
                </div>
                <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                  {r.district} · {services.length} ücretli özellik
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(storeMonthly(r))}</div>
                <div style={{ fontFamily: FB, fontSize: 10.5, color: C.faint }}>aylık</div>
              </div>
              <Icon path={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} size={16} color={C.faint} />
            </div>

            {open && (
              <div>
                {/* Müşteri bazlı satış kapıları — restoranın detay
                    ekranındakiyle AYNI bileşen ve aynı depo. */}
                <div style={{ padding: '14px 18px 0' }}>
                  <StoreServiceGates restaurant={r} />
                </div>
                <SectionHead title="Aldığı hizmetler" right="fiyatı değiştirmek için teklif gönderin" />
                {services.map(sv => (
                  <div key={sv.key} style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: KIND_TONE[sv.kind], flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{sv.name}</span>
                      <Badge text={sv.kind} color={KIND_TONE[sv.kind]} soft={C.panel2} />
                      <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                        Yürürlükteki fiyat {tamPara(sv.monthly)} / ay
                        {sv.repriced && ' · kabul edilen teklif'}
                      </span>
                    </div>
                    <OfferField
                      current={sv.monthly}
                      listPrice={pricing.isNegotiated(sv.key) ? pricing.listPriceOf(sv.key, store) : 0}
                      listUnit={pricing.listUnitOf(sv.key)}
                      offer={latestOffer(r.id, sv.key)}
                      onSend={({ offerMonthly, note }) => {
                        pricing.sendOffer({
                          streamKey: sv.key, streamName: sv.name,
                          restaurantId: r.id, restaurantName: r.name,
                          currentMonthly: sv.monthly, offerMonthly, note,
                        });
                        // Talep varsa "fiyatlandı" olur ama KAPANMAZ:
                        // işletme reddederse ikinci bir teklif gidebilir
                        // ve talebin kendisi hâlâ geçerli.
                        const t = requestFor(r.id, sv.key);
                        if (t) markQuoted(t.id);
                      }}
                    />
                  </div>
                ))}
                {services.length === 0 && (
                  <div style={{ padding: '20px 18px', fontFamily: FB, fontSize: 12.5, color: C.faint, textAlign: 'center' }}>
                    Bu müşteri henüz ücretli bir özellik almadı — teklif için önce satış gerekiyor.
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      {customers.length === 0 && (
        <section style={{ ...CARD, padding: '26px 18px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontFamily: FB, fontSize: 12.5, color: C.faint }}>
            {query ? `"${query}" için hesabı olan müşteri bulunamadı` : 'Hesabı olan müşteri yok'}
          </p>
        </section>
      )}

      {/* Gönderilen tekliflerin akıbeti */}
      <section style={{ ...CARD, overflow: 'hidden', marginTop: 16 }}>
        <SectionHead title="Gönderilen teklifler"
          right={`${store.offers.length} teklif · ${store.offers.filter(o => o.status === 'pending').length} bekliyor`} />
        {store.offers.length === 0 && (
          <div style={{ padding: '22px', fontFamily: FB, fontSize: 12.5, color: C.faint, textAlign: 'center' }}>
            Henüz teklif gönderilmedi. Bir müşteriye dokunup hizmetlerini açın.
          </div>
        )}
        {store.offers.map((o, i) => {
          const tone = o.status === 'accepted' ? C.green : o.status === 'declined' ? C.red : C.yellow;
          const label = o.status === 'accepted' ? 'Kabul edildi' : o.status === 'declined' ? 'Reddedildi' : 'İşletmede bekliyor';
          const diff = o.currentMonthly ? Math.round(((o.offerMonthly - o.currentMonthly) / o.currentMonthly) * 100) : null;
          return (
            <div key={o.id} style={{ padding: '13px 18px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{o.restaurantName} · {o.streamName}</div>
                <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                  {tamPara(o.currentMonthly)} → {tamPara(o.offerMonthly)}
                  {diff !== null && diff !== 0 && ` (${diff > 0 ? '+' : ''}${diff}%)`}
                  {o.note ? ` · "${o.note}"` : ''}
                </div>
              </div>
              <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: tone, background: `${tone}1F`, border: `1px solid ${tone}33`, borderRadius: R.pill, padding: '4px 11px', flexShrink: 0 }}>{label}</span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// GELİR VE REKLAM
//
// Üç katman, hep aynı sırayla: (1) en üstte platformun bu hizmetlerden
// toplam cirosu, (2) bu cironun müşteri bazlı kırılımı, (3) kalem bazlı
// katalog. Toplam ile müşteri tablosu birbirini tutar: adı geçen sekiz
// işletmenin dışında kalan tutar "diğer işletmeler" satırında durur, hiçbir
// kuruş görünmez bir yerde kaybolmaz.
// ═══════════════════════════════════════════════════════════════════════
function RevenuePage({ restaurants = [], onOpenStore }) {
  const [sort, setSort] = useState('revenue');   // 'revenue' | 'services' | 'name'
  const [kind, setKind] = useState(null);        // kalem türü filtresi
  const [find, setFind] = useState('');          // isim araması

  const streams = REVENUE_STREAMS;
  const total = PLATFORM_TOTAL;
  const maxMonthly = Math.max(...streams.map(x => x.monthly));

  const group = (...kinds) => streams.filter(x => kinds.includes(x.kind)).reduce((a, x) => a + x.monthly, 0);
  const adRev = group('Reklam', 'Sponsorluk');
  const txRev = group('Performans');
  const subRev = group('İçerik');   // yalnızca Gastro paketi — abonelik kaldırıldı

  // ARPU/LTV: sunucudaki user_ltv anlık görüntüsünün panel karşılığı.
  const MAU = 41200;
  const AVG_LIFETIME_MONTHS = 14;
  const arpu = total / MAU;

  // ── Müşteri bazlı kırılım ──
  const customers = useMemo(() => {
    const rows = restaurants.map(r => {
      const services = storeServices(r);
      return {
        id: r.id, name: r.name, district: r.district, plan: r.plan,
        gastro: r.gastro, status: r.status, services,
        monthly: storeMonthly(r),
      };
    });
    const q = find.trim().toLocaleLowerCase('tr');
    const shown = rows
      .filter(r => !kind || r.services.some(x => x.kind === kind))
      .filter(r => !q || r.name.toLocaleLowerCase('tr').includes(q));
    const sorters = {
      revenue: (a, b) => b.monthly - a.monthly,          // büyükten küçüğe
      services: (a, b) => b.services.length - a.services.length || b.monthly - a.monthly,
      name: (a, b) => a.name.localeCompare(b.name, 'tr'),
    };
    return shown.sort(sorters[sort]);
  }, [restaurants, sort, kind, find]);

  const namedTotal = restaurants.reduce((a, r) => a + storeMonthly(r), 0);
  const otherCount = STATS.totalRestaurants - restaurants.length;
  const otherTotal = Math.max(0, total - namedTotal);
  const payingCount = restaurants.filter(r => storeServices(r).length > 0).length;
  const maxCustomer = Math.max(1, ...customers.map(c => c.monthly));

  const kinds = [...new Set(streams.map(x => x.kind))];

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>

      {/* ─── 1. DASHBOARD — platformun bu hizmetlerden toplam cirosu ─── */}
      <section style={{
        ...CARD, boxShadow: ELEV.raised, padding: '22px 24px', marginBottom: 16,
        // Koyu panelde açık metin varsayıyordu; panel açık temaya geçince
        // metin jetonları koyulaştı ve şerit okunmaz oldu. Artık beyaz kart
        // üstünde çok hafif sıcak bir yıkama — One'ın kart dili.
        background: `linear-gradient(135deg, ${C.panel} 0%, ${C.heroTint} 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240 }}>
            <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              Platform cirosu · bu ay
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                ₺{total.toLocaleString('tr')}
              </div>
              <span style={{ fontFamily: FB, fontSize: 13, fontWeight: 700, color: C.greenInk }}>↑ 18%</span>
            </div>
            <div style={{ fontFamily: FB, fontSize: 12.5, color: C.dim, marginTop: 8, lineHeight: 1.6 }}>
              Yıllıklandırılmış {money(total * 12)} · {STATS.totalRestaurants} işletmenin
              ücretli özelliklerinden.
            </div>
          </div>

          {/* Cironun nereden geldiği — üç kalem tek bakışta */}
          <div style={{ flex: 1, minWidth: 320, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {[
              { label: 'Reklam ve sponsorluk', value: adRev, tone: C.blue, note: 'Banner, push, ödüllü video' },
              { label: 'İçerik', value: subRev, tone: C.orange, note: 'Gastro şef videosu paketi' },
              { label: 'Performans', value: txRev, tone: C.green, note: 'Anlık fırsat, İkinci Şans' },
            ].map(b => (
              <div key={b.label} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: R.control, padding: '13px 15px' }}>
                <div style={{ fontFamily: FB, fontSize: 11.5, fontWeight: 700, color: b.tone, marginBottom: 5 }}>{b.label}</div>
                <div style={{ fontSize: 19, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginBottom: 7 }}>{money(b.value)}</div>
                <div style={{ height: 5, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
                  <div style={{ width: `${(b.value / total) * 100}%`, height: '100%', borderRadius: 3, background: b.tone }} />
                </div>
                <div style={{ fontFamily: FB, fontSize: 10.5, color: C.faint, marginTop: 6, lineHeight: 1.4 }}>
                  toplamın %{((b.value / total) * 100).toFixed(0)}'i · {b.note}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alt şerit: ciroyu okumaya yarayan dört sayı */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
          {[
            ['Ücretli özellik geliri', money(STREAM_TOTAL), `${streams.length} kalem`],
            ['Ödeyen işletme', `${payingCount}`, 'en az bir kalem açık'],
            ['ARPU (aylık)', `₺${arpu.toFixed(2)}`, `LTV ₺${(arpu * AVG_LIFETIME_MONTHS).toFixed(0)}`],
            ['İşletme başına ort.', money(total / STATS.totalRestaurants), 'aylık katkı'],
          ].map(([k, v, n]) => (
            <div key={k}>
              <div style={{ fontFamily: FB, fontSize: 11, color: C.faint, marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              <div style={{ fontFamily: FB, fontSize: 11, color: C.dim, marginTop: 2 }}>{n}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 2. MÜŞTERİ BAZLI GELİR ─── */}
      <section style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
        <SectionHead title="Müşteri bazlı gelir"
          right={`${payingCount} ödeyen müşteri · ${money(namedTotal)} / ay`} />

        {/* İsim araması */}
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <Icon path={icons.search} size={15} color={C.faint} />
            </div>
            <input value={find} onChange={e => setFind(e.target.value)} placeholder="Restoran adı ara"
              style={{ width: '100%', height: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: R.control, padding: '0 12px 0 34px', color: C.text, fontFamily: FB, fontSize: 13, outline: 'none' }} />
          </div>
          {find && <Btn label="Temizle" onClick={() => setFind('')} variant="ghost" size="sm" />}
          <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
            {customers.length} sonuç
          </span>
        </div>

        {/* Filtre ve sıralama */}
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, marginRight: 2 }}>Kalem:</span>
          <Btn label="Hepsi" onClick={() => setKind(null)} size="sm" variant={kind === null ? 'soft' : 'ghost'} tone={kind === null ? 'orange' : 'neutral'} />
          {kinds.map(k => (
            <Btn key={k} label={k} onClick={() => setKind(kind === k ? null : k)} size="sm"
              variant={kind === k ? 'soft' : 'ghost'} tone={kind === k ? 'orange' : 'neutral'} />
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint, marginRight: 2 }}>Sırala:</span>
          {[['revenue', 'Ciro ↓'], ['services', 'Özellik'], ['name', 'İsim A-Z']].map(([id, label]) => (
            <Btn key={id} label={label} onClick={() => setSort(id)} size="sm"
              variant={sort === id ? 'soft' : 'ghost'} tone={sort === id ? 'orange' : 'neutral'} />
          ))}
        </div>

        {customers.map(c => (
          <div key={c.id} className="row-hover" onClick={() => onOpenStore?.(c.id)}
            title={`${c.name} detayını aç`}
            style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
            <StoreAvatar restaurant={c} size={34} radius={10} />
            <div style={{ width: 190, flexShrink: 0, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {c.name}
                {c.gastro && <Icon path={icons.star} size={12} color={C.orangeInk} fill={C.orange} />}
              </div>
              <div style={{ fontFamily: FB, fontSize: 11, color: C.faint }}>
                {c.district}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ServiceChips services={c.services} />
            </div>
            <div style={{ width: 110, flexShrink: 0 }}>
              <div style={{ height: 5, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
                <div style={{ width: `${(c.monthly / maxCustomer) * 100}%`, height: '100%', borderRadius: 3, background: C.orange }} />
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 96, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(c.monthly)}</div>
              <div style={{ fontFamily: FB, fontSize: 10.5, color: C.faint }}>toplamın %{((c.monthly / total) * 100).toFixed(1)}'i</div>
            </div>
          </div>
        ))}
        {customers.length === 0 && (
          <div style={{ padding: '22px 18px', fontFamily: FB, fontSize: 12.5, color: C.faint, textAlign: 'center' }}>
            Bu kalemi satın alan müşteri yok.
          </div>
        )}

        {/* Toplamı kapatan satır: listede adı geçmeyen işletmeler */}
        {!kind && otherCount > 0 && (
          <div style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 14, background: C.panel2 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon path={icons.store} size={15} color={C.faint} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.dim }}>Diğer {otherCount} işletme</div>
              <div style={{ fontFamily: FB, fontSize: 11, color: C.faint }}>Listede tek tek gösterilmeyen portföy</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 96 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>{money(otherTotal)}</div>
              <div style={{ fontFamily: FB, fontSize: 10.5, color: C.faint }}>toplamın %{((otherTotal / total) * 100).toFixed(0)}'i</div>
            </div>
          </div>
        )}
      </section>

      {/* ─── 3. KALEM BAZLI KATALOG ─── */}
      <section style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
        <SectionHead title="Gelir kalemleri" right={`${streams.length} kalem · ${money(STREAM_TOTAL)} / ay`} />
        {streams.map((x, i) => {
          // Bu kalemi kaç adlandırılmış müşteri almış — satış konuşmasının başlangıcı
          const buyers = restaurants.filter(r => storeServices(r).some(sv => sv.key === x.key));
          return (
            <div key={x.key}
              style={{ padding: '13px 18px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: KIND_TONE[x.kind], flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{x.name}</span>
                  <Badge text={x.kind} color={KIND_TONE[x.kind]} soft={C.panel2} />
                </div>
                <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                  {x.note}
                  {buyers.length > 0 && <> · {buyers.length} işletme kullanıyor: {buyers.map(bR => bR.name).join(', ')}</>}
                </div>
              </div>
              <div style={{ width: 120, flexShrink: 0 }}>
                <div style={{ height: 5, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
                  <div style={{ width: `${(x.monthly / maxMonthly) * 100}%`, height: '100%', borderRadius: 3, background: KIND_TONE[x.kind] }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 96, flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(x.monthly)}</div>
                <div style={{ fontFamily: FB, fontSize: 10.5, color: C.faint }}>{x.unit}</div>
              </div>
            </div>
          );
        })}
      </section>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// AYARLAR
//
// Buradaki anahtarlar yalnız paneli değil uygulamayı da etkiliyor:
// src/lib/platform.js ortak depoya yazıyor, tüketici uygulaması aynı
// depodan okuyor. GUR Match kapatıldığında Keşfet'teki giriş şeridi
// kaybolur ve açık bir Match oturumu varsa akış Keşfet'e döner.
// (Gerçek dağıtımda bu bayrak sunucuda tutulur; istemcinin girişi
// gizlemesi yetmez, uç de reddetmelidir.)
// ═══════════════════════════════════════════════════════════════════════
function Toggle({ on, onChange, label, disabled, disabledTitle }) {
  return (
    <motion.button
      onClick={disabled ? undefined : onChange} disabled={disabled}
      role="switch" aria-checked={on} aria-label={label}
      title={disabled ? (disabledTitle || 'Platform genelinde kapalı — önce Ayarlar’dan açın') : undefined}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      className="gur-admin-btn"
      style={{
        '--btn-bg': on ? BRAND_GRAD : C.border,
        '--btn-bg-hover': on ? BRAND_GRAD_HOVER : C.panel2,
        '--btn-bg-press': on ? BRAND_GRAD : C.border,
        '--btn-shadow': on ? ELEV.brand : 'inset 0 2px 5px rgba(0,0,0,0.45)',
        '--btn-shadow-press': ELEV.pressDark,
        width: 48, height: 28, borderRadius: R.pill, border: 'none',
        position: 'relative', flexShrink: 0, padding: 0, outline: 'none',
      }}>
      <motion.span
        animate={{ x: on ? 22 : 3 }}
        transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
        style={{ position: 'absolute', top: 3, left: 0, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: SH.s1 }} />
    </motion.button>
  );
}

function SettingsRow({ item, on, onChange, children }) {
  return (
    <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{item.label}</div>
        <div style={{ fontFamily: FB, fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>{item.desc}</div>
        {children}
      </div>
      <Toggle on={on} onChange={onChange} label={item.label} />
    </div>
  );
}

// Bir özelliğin kaç işletmede ayrıca kapatıldığı.
function closedStores(settings, key) {
  return Object.values(settings.storeOverrides || {}).filter(o => o?.[key] === false).length;
}

function SettingsPage() {
  const settings = usePlatformSettings();
  const flip = (key) => toggleSetting(key);

  const groups = [
    {
      // Liste katalogdan geliyor (src/lib/platform.js → FEATURES): uygulamada
      // kontrol edilen kapı ile paneldeki anahtar aynı kaynaktan beslenmezse
      // anahtar er geç yalan söylemeye başlar.
      title: 'Uygulama özellikleri',
      note: 'Buradan kapatılan özellik tüketici uygulamasından da kalkar.',
      items: FEATURES.map(f => ({
        key: f.key, label: f.label, desc: f.desc, feature: true,
        perStore: f.perStore,
      })),
    },
    {
      title: 'Moderasyon',
      items: [
        { key: 'autoApprove', label: 'Otomatik başvuru onayı', desc: 'Vergi levhası yüklenen başvurular incelenmeden onaylanır (önerilmez).' },
        { key: 'newReviews', label: 'Yeni yorum bildirimleri', desc: 'Şikayet edilen yorumlar için anlık bildirim al.' },
      ],
    },
    {
      title: 'Sistem',
      items: [
        { key: 'maintenance', label: 'Bakım modu', desc: 'Uygulamayı geçici olarak kullanıma kapat.' },
      ],
    },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.2s', maxWidth: 760 }}>
      {groups.map(g => (
        <section key={g.title} style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
          <SectionHead title={g.title} right={g.note} />
          {g.items.map(it => (
            <SettingsRow key={it.key} item={it} on={!!settings[it.key]} onChange={() => flip(it.key)}>
              {it.feature && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: settings[it.key] ? C.greenSoft : C.panel2, border: `1px solid ${settings[it.key] ? `${C.green}44` : C.border}`, borderRadius: R.pill, padding: '5px 12px' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: settings[it.key] ? C.green : C.faint }} />
                    <span style={{ fontFamily: FB, fontSize: 11.5, fontWeight: 700, color: settings[it.key] ? C.green : C.faint }}>
                      {settings[it.key] ? 'Uygulamada açık' : 'Uygulamada kapalı'}
                    </span>
                  </span>
                  {it.perStore && (
                    <span style={{ fontFamily: FB, fontSize: 11, color: C.faint }}>
                      Restoran bazında da kapatılabilir — Restoranlar → ilgili işletme
                    </span>
                  )}
                  {/* Kapalı özelliğin kaç işletmede ayrıca kapatıldığı */}
                  {it.perStore && closedStores(settings, it.key) > 0 && (
                    <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: C.yellowInk, background: C.yellowSoft, borderRadius: R.pill, padding: '4px 10px' }}>
                      {closedStores(settings, it.key)} işletmede ayrıca kapalı
                    </span>
                  )}
                </div>
              )}
            </SettingsRow>
          ))}
        </section>
      ))}
    </div>
  );
}
