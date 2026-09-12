import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useClaims, decideClaim, useOwnerProfiles, ownerLogo } from '../lib/b2b.js';

import * as api from '../lib/api.js';
import { motion, AnimatePresence } from 'motion/react';
import { usePlatformSettings, toggleSetting, setStoreFeature, FEATURES, PER_STORE_FEATURES } from '../lib/platform.js';
import * as pricing from '../lib/pricing.js';

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
const C = {
  bg: '#EEF0F3',
  panel: '#FFFFFF',
  panel2: '#F3F4F7',
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
  onBrand:   '#2B1400',   /* turuncu DOLGU üstünde yazı, 6.0:1 */
};

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
const SH = {
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

// Basılınca gölge bir basamak kısalır: nesne kâğıda yaklaşır.
const ELEV = {
  card:      SH.s2,
  raised:    SH.s3,
  brand:     SH.brand,
  pressDark: SH.s1,
  pressBrand: SH.brandSm,
};
// Köşe yarıçapları uygulamayla aynı ölçekte: kart 18, kontrol 12, pill 999.
const R = { card: 24, control: 14, pill: 999 };
// Panellerin tamamı tek bir kart tarifinden geçiyor — 20 ayrı yerde
// tekrarlanan literal, tek yerden değişebilen bir jetona indi.
const CARD = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: R.card, boxShadow: ELEV.card };

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
  { id: 4, name: 'Green Bowl', cat: 'Sağlıklı', district: 'Şişli', rating: 4.5, reviews: 340, status: 'active', gastro: false, plan: 'Ücretsiz', joined: '2024-06-15', account: false, source: 'api' },
  { id: 6, name: 'Klein Bistro', cat: 'Kafe', district: 'Beyoğlu', rating: 4.4, reviews: 560, status: 'suspended', gastro: false, plan: 'Ücretsiz', joined: '2024-05-02', account: false, source: 'api' },
  { id: 11, name: 'The Burger Joint', cat: 'Fast Food', district: 'Nişantaşı', rating: 4.2, reviews: 780, status: 'active', gastro: false, plan: 'Pro', joined: '2024-04-18', account: true, source: 'owner' },
  { id: 12, name: 'Karaköy Güllüoğlu', cat: 'Tatlıcı', district: 'Karaköy', rating: 4.9, reviews: 3200, status: 'active', gastro: true, plan: 'Premium', joined: '2023-12-01', account: true, source: 'owner' },
  // Dış beslemeden gelen, henüz sahiplenilmemiş mekanlar
  { id: 5, name: 'Ateş Mangal', cat: 'Mangal', district: 'Beykoz', rating: 4.7, reviews: 210, status: 'active', gastro: false, plan: 'Ücretsiz', joined: '2026-02-14', account: false, source: 'api' },
  { id: 13, name: 'Balıkçı Sabahattin', cat: 'Deniz Ürünleri', district: 'Fatih', rating: 4.6, reviews: 980, status: 'active', gastro: false, plan: 'Ücretsiz', joined: '2026-01-22', account: false, source: 'api' },
  { id: 14, name: 'Spice Market', cat: 'Uzak Doğu', district: 'Şişli', rating: 4.4, reviews: 150, status: 'active', gastro: false, plan: 'Ücretsiz', joined: '2026-03-30', account: false, source: 'api' },
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
  { key: 'secondChance', short: 'İkinci Şans', name: 'İkinci Şans yerleşimi', kind: 'Performans', monthly: 41000, unit: '86 restoran', note: 'Geçilen restoranın desteye geri girmesi.' },
  { key: 'instantDeals', short: 'Anlık fırsat', name: 'Anlık fırsat bildirimleri', kind: 'Performans', monthly: 63000, unit: '140 yayın / ay', note: 'Ölü saat doldurma; yayın başına ücret.' },
  // Şef videosu ile içerik lisansı tek pakettir: video çekilmeden lisanslanacak
  // içerik yok, çekildiğinde de zaten restorana devrediliyor. Bu paketi alan
  // mekan Gastro Onaylı kategorisine girer — rozetin karşılığı bu çekimdir.
  { key: 'gastroPackage', short: 'Gastro paketi', name: 'Gastro şef videosu paketi', kind: 'İçerik', monthly: 91000, unit: '8 çekim / ay', note: 'Şef çekimi + 15 sn dikey videonun süresiz kullanım hakkı. Gastro Onaylı rozetini getirir.' },
];

const KIND_TONE = {
  'Reklam': C.blue, 'Sponsorluk': C.orange, 'Performans': C.green, 'İçerik': C.red,
};

// İşletme abonelik paketleri. Adetler STATS.totalRestaurants ile uyumlu.
const PLANS = [
  { id: 'Premium', price: 4999, count: 42,  color: C.orangeInk },
  { id: 'Pro',     price: 1999, count: 118, color: C.blue },
  { id: 'Ücretsiz', price: 0,   count: 182, color: C.faint },
];
const PLAN_COLOR = Object.fromEntries(PLANS.map(p => [p.id, p.color]));
const PLAN_PRICE = Object.fromEntries(PLANS.map(p => [p.id, p.price]));
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
/** Abonelik + hizmet: mağazanın platforma aylık toplam katkısı. */
function storeMonthly(r) {
  return (PLAN_PRICE[r.plan] || 0) + storeServiceRevenue(r);
}

// Katalogdaki her kalemin platform geneli aylık toplamı; adı geçen sekiz
// müşteri bu toplamın içinden çıkar, kalanı "diğer işletmeler" satırıdır.
const STREAM_TOTAL = REVENUE_STREAMS.reduce((a, x) => a + x.monthly, 0);
const SUBS_TOTAL = PLANS.reduce((a, p) => a + p.price * p.count, 0);
const PLATFORM_TOTAL = STREAM_TOTAL + SUBS_TOTAL;

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

const MENU_KINDS = [
  { name: 'Ana Menü', pages: [8, 16] },
  { name: 'İçecek Menüsü', pages: [2, 6] },
  { name: 'Tatlı Menüsü', pages: [1, 4] },
  { name: 'Kahvaltı Menüsü', pages: [2, 5] },
  { name: 'Şarap Listesi', pages: [3, 9] },
  { name: 'Set Menü', pages: [1, 3] },
];

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

function restaurantMenus(r) {
  const rand = seeded(r.id * 7 + 3);
  const count = 2 + Math.floor(rand() * 3);           // 2-4 menü
  const picked = [];
  const pool = [...MENU_KINDS];
  for (let i = 0; i < count && pool.length; i++) {
    const k = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const [lo, hi] = k.pages;
    picked.push({
      name: k.name,
      pages: lo + Math.floor(rand() * (hi - lo + 1)),
      uploaded: isoDaysAgo(4 + Math.floor(rand() * 300)),
      sizeMb: (0.6 + rand() * 5.4).toFixed(1),
    });
  }
  return picked.sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1));
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
      background: logo ? C.panel2 : 'linear-gradient(135deg,#FF660033,#FF3B3033)',
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
const TONE_COLOR = { neutral: C.text, orange: C.orange, green: C.green, red: C.red, blue: C.blue, yellow: C.yellow };
const TONE_SOFT = { neutral: C.panel2, orange: C.orangeSoft, green: C.greenSoft, red: C.redSoft, blue: C.blueSoft, yellow: C.yellowSoft };

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
function Btn({ label, onClick, icon, variant = 'outline', tone = 'neutral', size = 'md', fullWidth = false, disabled, loading, title }) {
  const toneColor = TONE_COLOR[tone] || C.text;
  const toneSoft = TONE_SOFT[tone] || C.panel2;
  const paddings = { sm: '7px 13px', md: '9px 15px', lg: '12px 19px' };
  const fontSizes = { sm: 12, md: 12.5, lg: 14 };
  const brand = tone === 'orange';
  // Dolu hapta zemin ile yazı birlikte seçilir: parlak yeşil/kırmızı
  // üstünde beyaz 2.7–3.9:1'de, turuncu üstünde 2.9:1'de kalıyordu.
  // Yeşil ve kırmızı dolgu koyu tonuna iner, turuncu ise yazıyı koyultur.
  const FILL_BG = { neutral: C.text, orange: BRAND_GRAD, green: C.greenInk, red: C.redInk, blue: C.blue, yellow: C.yellow };
  const FILL_INK = { orange: C.onBrand, yellow: '#241c00' };
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
    outline: { bg: C.panel, hover: '#FAFBFC', press: C.panel2, color: tone === 'neutral' ? C.text : toneColor, border: `1px solid ${C.border}`, elev: SH.s1, pressElev: ELEV.pressDark },
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

function AdminLogin({ onLogin }) {
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
    <div lang="tr" style={{ minHeight: '100dvh', background: C.bg, fontFamily: FB, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, colorScheme: 'light' }}>
      <style>{`
        /* Yazı tipleri index.html'den yükleniyor — buraya @import yazmayın. */
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .gur-admin-btn:focus-visible { box-shadow: 0 0 0 3px ${C.orange}55 !important; }
        @media (prefers-reduced-motion: reduce) { .gur-admin-btn { transition: none !important; } }
      `}</style>

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
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [apps, setApps] = useState(APPLICATIONS);
  const [restaurants, setRestaurants] = useState(RESTAURANTS);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [openRestaurantId, setOpenRestaurantId] = useState(null);
  const [restTab, setRestTab] = useState('list');
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

  const nav = [
    { id: 'dashboard', label: 'Genel Bakış', icon: icons.dash },
    { id: 'restaurants', label: 'Restoranlar', icon: icons.store, count: restaurants.filter(r => r.account).length },
    { id: 'pool', label: 'Mekan Havuzu', icon: icons.inbox, count: restaurants.filter(r => !r.account).length },
    { id: 'applications', label: 'Başvurular', icon: icons.inbox, count: apps.length, alert: apps.length > 0 },
    { id: 'gastro', label: 'Gastro Onaylı', icon: icons.star },
    { id: 'users', label: 'Kullanıcılar', icon: icons.users },
    { id: 'campaigns', label: 'Kampanyalar', icon: icons.trend, count: 4 },
    { id: 'growth', label: 'Büyüme & Kohort', icon: icons.chart },
    { id: 'revenue', label: 'Gelir & Reklam', icon: icons.money },
    { id: 'pricing', label: 'Fiyatlandırma', icon: icons.trend },
    { id: 'settings', label: 'Ayarlar', icon: icons.settings },
  ];

  // Açık restoran her zaman güncel kayıttan okunur; rozet/durum değişince
  // detay ekranı da anında tazelenir.
  const openRestaurant = openRestaurantId == null ? null : restaurants.find(r => r.id === openRestaurantId) || null;
  const pageTitle = openRestaurant ? openRestaurant.name : (nav.find(n => n.id === page)?.label || 'Genel Bakış');

  const goPage = (id) => { setOpenRestaurantId(null); setPage(id); };
  // Gelir tablosundan müşteriye geçiş: aynı işletme kaydı, tek tıkla.
  const openStore = (id) => { setPage('restaurants'); setRestTab('list'); setOpenRestaurantId(id); };

  const logout = () => { setAuthed(false); setPage('dashboard'); setQuery(''); setReviewDoc(null); setOpenRestaurantId(null); setRestTab('list'); };

  // Giriş yapılmadan panel hiç render edilmez
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  return (
    // lang: Türkçe büyük harf kuralı (i→İ). Artifact kabuğunda <html lang>
    // bize ait değil, o yüzden kökte bildiriyoruz.
    <div lang="tr" style={{ display: 'flex', height: '100dvh', background: C.bg, fontFamily: FB, color: C.text, overflow: 'hidden', colorScheme: 'light' }}>
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

        /* ── BUTON DURUMLARI — uygulamadaki .gur-btn ile aynı sistem ──
           Renk ve gölge değişkenlerden okunuyor; buton bunları inline
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
          background: #E7E9EE !important; color: #98A0AE !important;
          border-color: #E0E3E9 !important;
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
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#FF6600,#FF3B30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: C.onBrand }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Admin</div>
              <div style={{ fontSize: 10.5, color: C.faint }}>admin@gur.app</div>
            </div>
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
          <div style={{ position: 'relative', width: 280 }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <Icon path={icons.search} size={16} color={C.faint} />
            </div>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ara..." style={{
              width: '100%', height: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '0 12px 0 36px', color: C.text, fontFamily: FB, fontSize: 13, outline: 'none',
            }} />
          </div>
          <IconBtn
            title="Bildirimler"
            icon={<>
              <Icon path={icons.bell} size={17} color={C.dim} />
              {apps.length > 0 && <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: C.orange }} />}
            </>}
          />
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
          {page === 'applications' && <ApplicationsPage apps={apps} onReview={setReviewDoc} onApprove={approveApp} onReject={rejectApp} />}
          {page === 'gastro' && <GastroPage restaurants={restaurants} onGoRestaurants={() => goPage('restaurants')} />}
          {page === 'users' && <UsersPage query={query} />}
          {page === 'campaigns' && <CampaignsPage />}
          {page === 'growth' && <GrowthPage />}
          {page === 'revenue' && <RevenuePage restaurants={restaurants} onOpenStore={openStore} />}
          {page === 'pool' && <VenuePoolPage restaurants={restaurants} query={query} onOpen={openStore} />}
          {page === 'pricing' && <PricingPage restaurants={restaurants} query={query} />}
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
          background: '#17130F', color: '#fff', borderRadius: 12, padding: '9px 11px',
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
      <div style={{ fontSize: 27, fontWeight: 700, marginBottom: 3, ...NUM }}>{value}</div>
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

const CAMPAIGN_STATUS = {
  active:    { label: 'Yayında',      color: C.greenInk,  soft: C.greenSoft },
  paused:    { label: 'Duraklatıldı', color: C.yellowInk, soft: C.yellowSoft },
  exhausted: { label: 'Bütçe bitti',  color: C.faint,  soft: C.panel2 },
};

function CampaignsPage() {
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
  const scored = rows.map(r => {
    const rate = r.impressions ? r.engagements / r.impressions : 0.02;
    const quality = Math.min(1.5, Math.max(0.2, rate * 20));
    return { ...r, rate, quality, score: r.bid * quality };
  }).sort((a, b) => (b.status === 'active' ? b.score : -1) - (a.status === 'active' ? a.score : -1));

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
            <div key={r.id} style={{ padding: '14px 18px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr 140px', gap: 12, alignItems: 'center', opacity: r.status === 'active' ? 1 : 0.6 }}>
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
            ['LTV', 'Reklam + abonelik gelirinin kullanıcı başına kümülatif toplamı; ARPU bunun aylığa bölünmüşü.'],
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
      opacity: hidden ? 0.5 : 1,
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

  return (
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
  );
}

function RestaurantDetailPage({ r, onBack, onGastro, onSuspend }) {
  const menus = useMemo(() => restaurantMenus(r), [r.id]);
  const reviews = useMemo(() => restaurantReviews(r), [r.id]);
  const services = storeServices(r);
  const serviceRev = storeServiceRevenue(r);
  const planFee = PLAN_PRICE[r.plan] || 0;

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
        <MetaCell label="Plan"><span style={{ color: PLAN_COLOR[r.plan] }}>{r.plan}</span></MetaCell>
        <MetaCell label="Aylık ciro">{money(storeMonthly(r))}</MetaCell>
        <MetaCell label="Durum"><StatusBadge status={r.status} /></MetaCell>
        <MetaCell label="Katılım">{formatDate(r.joined)}</MetaCell>
      </div>

      {/* ─── BU İŞLETMEDE AÇIK ÖZELLİKLER ───
          Restoran bazlı kapatma. Genel anahtar (Ayarlar) her zaman üstün
          gelir: platformda kapalı bir özelliği tek işletme için açmanın
          anlamı yok, o yüzden genel kapalıysa satır da kilitli görünür. */}
      <StoreFeatures restaurant={r} />

      {/* ─── MÜŞTERİNİN SATIN ALDIĞI ÜCRETLİ ÖZELLİKLER ───
          Bir işletmeyle konuşmadan önce bakılan ilk yer: neyi almış, ne
          zamandır ödüyor, aylık ne ediyor. Katalog REVENUE_STREAMS'ten,
          hangi kalemin açık olduğu STORE_SERVICES'ten geliyor. */}
      <section style={{ ...CARD, overflow: 'hidden', marginBottom: 16 }}>
        <SectionHead title="Aldığı ücretli özellikler"
          right={`${services.length} kalem · ${money(serviceRev + planFee)} / ay`} />
        <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: PLAN_COLOR[r.plan], flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.plan} abonelik</div>
            <div style={{ fontSize: 11.5, color: C.faint }}>
              {planFee ? 'İşletme paneli, analiz ve öncelikli destek' : 'Ücretsiz plan — yalnızca temel kayıt'}
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: planFee ? C.text : C.faint }}>
            {planFee ? `${money(planFee)}/ay` : '—'}
          </div>
        </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: 16, alignItems: 'start' }}>

        {/* ─── MENÜLER ─── */}
        <section style={{ ...CARD, overflow: 'hidden' }}>
          <header style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Menüler</span>
            <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{menus.length}</span>
          </header>
          <div>
            {menus.map((m, i) => (
              <div key={m.name} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.orangeSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon path={icons.doc} size={15} color={C.orangeInk} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
                    {m.pages} sayfa • {m.sizeMb} MB
                  </div>
                  <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                    Yüklendi: {formatDate(m.uploaded)}
                  </div>
                </div>
              </div>
            ))}
            {menus.length === 0 && (
              <div style={{ padding: '22px 16px', fontSize: 12.5, color: C.faint, textAlign: 'center' }}>Henüz menü yüklenmemiş</div>
            )}
          </div>
        </section>

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
              icon={<Icon path={r.gastro ? icons.x : icons.star} size={14} color={r.gastro ? C.red : '#fff'} fill={r.gastro ? 'none' : '#fff'} />}
            />
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
      <TableShell headers={['Restoran', 'Bölge', 'Puan', 'Plan', 'Ücretli Özellikler', { label: 'Aylık', right: true }, 'Durum', { label: 'İşlemler', right: true }]}>
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
            <td style={{ padding: '14px 18px' }}><span style={{ fontSize: 12, fontWeight: 700, color: PLAN_COLOR[r.plan] }}>{r.plan}</span></td>
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

function ApplicationsPage({ apps, onReview, onApprove, onReject }) {
  if (apps.length === 0) {
    return (
      <div style={{ animation: 'fadeIn 0.2s' }}>
      <ClaimsPanel />
      <div style={{ ...CARD, padding: 60, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: 16, background: C.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Icon path={icons.check} size={30} color={C.greenInk} />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>Bekleyen başvuru yok</h3>
        <p style={{ margin: 0, fontSize: 13.5, color: C.dim }}>Tüm restoran başvuruları değerlendirildi.</p>
      </div>
      </div>
    );
  }
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <ClaimsPanel />
      <div style={{ marginBottom: 16, padding: '12px 16px', background: C.yellowSoft, border: `1px solid ${C.yellow}44`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon path={icons.inbox} size={18} color={C.yellowInk} />
        <span style={{ fontSize: 13, color: C.text }}><b>{apps.length} başvuru</b> vergi levhası doğrulaması bekliyor.</span>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {apps.map(a => (
          <div key={a.id} style={{ ...CARD, padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#FF660033,#FF3B3033)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: C.orangeInk, flexShrink: 0 }}>{a.name[0]}</div>
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
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#FF6600,#FF3B30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 15, flexShrink: 0 }}>{c.name.split(' ')[1][0]}</div>
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
const SOURCE_LABEL = { api: 'Dış besleme', owner: 'Sahiplenilmiş' };

function VenuePoolPage({ restaurants = [], query = '', onOpen }) {
  const [invited, setInvited] = useState(() => new Set());
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
        <KpiCard label="Gönderilen davet" value={invited.size} icon={icons.msg} accent={{ color: C.orangeInk, soft: C.orangeSoft }} />
      </div>

      <section style={{ ...CARD, overflow: 'hidden' }}>
        <SectionHead title="Sahiplenilmemiş mekanlar"
          right="dış beslemeden gelir · panel girişi yok" />

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
                <Badge text={SOURCE_LABEL[r.source] || 'Dış besleme'} color={C.blue} soft={C.blueSoft} />
              </div>
              <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                {r.cat} · {r.district} · ★ {r.rating} ({r.reviews.toLocaleString('tr')} yorum) · havuza {formatDate(r.joined)} girdi
              </div>
            </div>
            <Btn label="Detay" onClick={() => onOpen?.(r.id)} variant="outline" size="sm"
              icon={<Icon path={icons.eye} size={13} color={C.dim} />} />
            <Btn
              label={invited.has(r.id) ? 'Davet gönderildi' : 'Sahiplenmeye davet et'}
              onClick={() => setInvited(s => new Set(s).add(r.id))}
              disabled={invited.has(r.id)}
              variant={invited.has(r.id) ? 'soft' : 'filled'} tone={invited.has(r.id) ? 'green' : 'orange'} size="sm" />
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
function OfferField({ current, offer, onSend }) {
  const [value, setValue] = useState(String(current || ''));
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
      <input
        value={note} onChange={e => setNote(e.target.value)}
        placeholder="Not (işletme görür)"
        style={{ flex: 1, minWidth: 150, height: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: R.control, padding: '0 12px', color: C.text, fontFamily: FB, fontSize: 12.5, outline: 'none' }} />
      <Btn label={sent ? 'Gönderildi' : 'Teklif gönder'} onClick={send} disabled={!valid}
        variant="filled" tone={sent ? 'green' : 'orange'} size="md" />
      {offer && (
        <span style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: tone, background: `${tone}1F`, border: `1px solid ${tone}33`, borderRadius: R.pill, padding: '4px 11px' }}>
          {label} · {money(offer.offerMonthly)}
        </span>
      )}
    </div>
  );
}

function PricingPage({ restaurants = [], query = '' }) {
  const store = pricing.usePricing();
  const [openId, setOpenId] = useState(null);

  // Yalnız hesabı olan müşteriler. Dış beslemeden gelen mekanlar burada yok.
  const customers = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return restaurants
      .filter(r => r.account)
      .filter(r => !q || r.name.toLocaleLowerCase('tr').includes(q))
      .sort((a, b) => storeMonthly(b) - storeMonthly(a));
  }, [restaurants, query]);

  const apiOnly = restaurants.filter(r => !r.account).length;
  const pendingFor = (id) => store.offers.filter(
    o => String(o.restaurantId) === String(id) && o.status === 'pending').length;
  const latestOffer = (id, key) => store.offers
    .filter(o => String(o.restaurantId) === String(id) && o.streamKey === key)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
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
                </div>
                <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                  {r.district} · <span style={{ color: PLAN_COLOR[r.plan], fontWeight: 700 }}>{r.plan}</span> · {services.length} ücretli özellik
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
                <SectionHead title="Aldığı hizmetler" right="fiyatı değiştirmek için teklif gönderin" />
                <div style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PLAN_COLOR[r.plan], flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.plan} abonelik</div>
                    <div style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>Paket fiyatı — kalem bazlı teklif dışında</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: PLAN_PRICE[r.plan] ? C.text : C.faint }}>
                    {PLAN_PRICE[r.plan] ? `${money(PLAN_PRICE[r.plan])}/ay` : '—'}
                  </div>
                </div>
                {services.map(sv => (
                  <div key={sv.key} style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: KIND_TONE[sv.kind], flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{sv.name}</span>
                      <Badge text={sv.kind} color={KIND_TONE[sv.kind]} soft={C.panel2} />
                      <span style={{ fontFamily: FB, fontSize: 11.5, color: C.faint }}>
                        Yürürlükteki fiyat {money(sv.monthly)} / ay
                        {sv.repriced && ' · kabul edilen teklif'}
                      </span>
                    </div>
                    <OfferField
                      current={sv.monthly}
                      offer={latestOffer(r.id, sv.key)}
                      onSend={({ offerMonthly, note }) => pricing.sendOffer({
                        streamKey: sv.key, streamName: sv.name,
                        restaurantId: r.id, restaurantName: r.name,
                        currentMonthly: sv.monthly, offerMonthly, note,
                      })}
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
                  {money(o.currentMonthly)} → {money(o.offerMonthly)}
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
  const subRev = SUBS_TOTAL + group('İçerik');   // abonelik planları + Gastro paketi

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
  const payingCount = restaurants.filter(r => storeServices(r).length > 0 || PLAN_PRICE[r.plan] > 0).length;
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
        background: `linear-gradient(135deg, ${C.panel} 0%, #FFF6EE 100%)`,
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
              abonelik ve ücretli özelliklerinden.
            </div>
          </div>

          {/* Cironun nereden geldiği — üç kalem tek bakışta */}
          <div style={{ flex: 1, minWidth: 320, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {[
              { label: 'Reklam ve sponsorluk', value: adRev, tone: C.blue, note: 'Banner, push, ödüllü video' },
              { label: 'Abonelik ve içerik', value: subRev, tone: C.orange, note: 'İşletme planları, Gastro paketi' },
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
            ['Abonelik geliri', money(SUBS_TOTAL), `${PLANS[0].count + PLANS[1].count} ödeyen işletme`],
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
                {c.district} · <span style={{ color: PLAN_COLOR[c.plan], fontWeight: 700 }}>{c.plan}</span>
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
function Toggle({ on, onChange, label, disabled }) {
  return (
    <motion.button
      onClick={disabled ? undefined : onChange} disabled={disabled}
      role="switch" aria-checked={on} aria-label={label}
      title={disabled ? 'Platform genelinde kapalı — önce Ayarlar’dan açın' : undefined}
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
