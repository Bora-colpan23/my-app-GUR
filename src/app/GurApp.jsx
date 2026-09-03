import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import { animate } from 'motion';
import { useFeature } from '../lib/phase.js';

// Apple "Designing Fluid Interfaces" momentum projection: nereye bırakılacağını
// bırakma anındaki konum değil, hızın taşıdığı yönü kullanarak tahmin eder.
function projectMomentum(velocity, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

// ── GUR Match: arkadaşın kararları ───────────────────────────────────────
// Backend yok; arkadaşın beğenileri davet kodundan türeyen deterministik bir
// diziyle üretilir. Aynı kod her zaman aynı sonucu verir, böylece "arkadaşınla
// aynı oturumdasın" hissi tutarlı kalır ve demo tekrar edilebilir olur.
function hashCode(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Arkadaş kartların ~%55'ini beğenir — eşleşme yeterince sık ama garanti değil
function friendLikes(code, ids, likeRate = 0.55) {
  const rand = mulberry32(hashCode(code || "GUR"));
  const set = new Set();
  ids.forEach(id => { if (rand() < likeRate) set.add(id); });
  return set;
}

function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karıştırılabilecek harfler yok
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const FRIEND_NAMES = ["Ali", "Elif", "Mert", "Zeynep", "Can", "Deniz", "Ece", "Kaan"];
function friendNameFor(code) {
  return FRIEND_NAMES[hashCode(code || "GUR") % FRIEND_NAMES.length];
}


// ═══════════════════════════════════════════════
// IMAGES
// ═══════════════════════════════════════════════
const I = {
  hero: "https://picsum.photos/seed/gur-hero/800/400",
  turkish1: "https://picsum.photos/seed/turkish1/600/400",
  turkish2: "https://picsum.photos/seed/turkish2/600/400",
  sushi1: "https://picsum.photos/seed/sushi1/600/400",
  sushi2: "https://picsum.photos/seed/sushi2/600/400",
  healthy1: "https://picsum.photos/seed/healthy1/600/400",
  healthy2: "https://picsum.photos/seed/healthy2/600/400",
  bbq1: "https://picsum.photos/seed/bbq1/600/400",
  bbq2: "https://picsum.photos/seed/bbq2/600/400",
  night1: "https://picsum.photos/seed/night1/600/400",
  cocktail1: "https://picsum.photos/seed/cocktail1/600/400",
  cafe1: "https://picsum.photos/seed/cafe1/600/400",
  cafe2: "https://picsum.photos/seed/cafe2/600/400",
  pasta1: "https://picsum.photos/seed/pasta1/600/400",
  pizza1: "https://picsum.photos/seed/pizza1/600/400",
  burger1: "https://picsum.photos/seed/burger1/600/400",
  steak1: "https://picsum.photos/seed/steak1/600/400",
  dessert1: "https://picsum.photos/seed/dessert1/600/400",
  seafood1: "https://picsum.photos/seed/seafood1/600/400",
  interior1: "https://picsum.photos/seed/interior1/600/400",
  interior2: "https://picsum.photos/seed/interior2/600/400",
  interior3: "https://picsum.photos/seed/interior3/600/400",
  bosphorus: "https://picsum.photos/seed/bosphorus/600/400",
  ramen1: "https://picsum.photos/seed/ramen1/600/400",
  dimsum1: "https://picsum.photos/seed/dimsum1/600/400",
  kebab1: "https://picsum.photos/seed/kebab1/600/400",
  salad1: "https://picsum.photos/seed/salad1/600/400",
  wine1: "https://picsum.photos/seed/wine1/600/400",
  bread1: "https://picsum.photos/seed/bread1/600/400",
  curry1: "https://picsum.photos/seed/curry1/600/400",
  rooftop1: "https://picsum.photos/seed/rooftop1/600/400",
  barista1: "https://picsum.photos/seed/barista1/600/400",
  icecream1: "https://picsum.photos/seed/icecream1/600/400",
  soup1: "https://picsum.photos/seed/soup1/600/400",
  taco1: "https://picsum.photos/seed/taco1/600/400",
};

const GRAD = "#FF6600";

const RESTAURANTS = [
  { id:1, name:"Nusr-Et Steakhouse", cat:"Türk Mutfağı", rating:4.8, dist:"2.3 km", price:"₺2.500+", addr:"Etiler, Nispetiye Cd. No:87, Beşiktaş", desc:"Dünyaca ünlü et restoranı. Özel kesim etler ve eşsiz sunum.", imgs:[I.steak1,I.interior1,I.kebab1], menu:["https://picsum.photos/seed/menu-nusr1/600/900","https://picsum.photos/seed/menu-nusr2/600/900"], hours:"12:00 - 00:00", tags:["Fine Dining","Et"] },
  { id:2, name:"Mikla Restaurant", cat:"Fine Dining", rating:4.9, dist:"5.1 km", price:"₺3.000+", addr:"Beyoğlu, Meşrutiyet Cd. No:15", desc:"Skandinav-Türk mutfağı füzyonu. İstanbul manzarası eşliğinde.", imgs:[I.interior2,I.bosphorus,I.wine1], menu:["https://picsum.photos/seed/menu-mikla1/600/900","https://picsum.photos/seed/menu-mikla2/600/900","https://picsum.photos/seed/menu-mikla3/600/900"], hours:"18:00 - 01:00", tags:["Manzara","Romantik"] },
  { id:3, name:"La Sagrata Famila", cat:"Uzak Doğu", rating:4.5, dist:"10 km", price:"₺800+", addr:"Kadıköy, Moda Cd. No:42", desc:"Geleneksel Japon lezzetini taze malzemelerle modern bir dokunuşla sunuyoruz.", imgs:[I.interior3,I.sushi1,I.sushi2], menu:["https://picsum.photos/seed/menu-sagr1/600/900","https://picsum.photos/seed/menu-sagr2/600/900"], hours:"11:00 - 23:00", tags:["Sushi","Japon"] },
  { id:4, name:"Green Bowl", cat:"Sağlıklı", rating:4.5, dist:"1.2 km", price:"₺350+", addr:"Şişli, Halaskargazi Cd. No:12", desc:"Organik ve sağlıklı tarifler. Vegan seçenekler.", imgs:[I.healthy1,I.healthy2,I.salad1], menu:["https://picsum.photos/seed/menu-green1/600/900"], hours:"08:00 - 22:00", tags:["Vegan","Organik"] },
  { id:5, name:"Ateş Mangal", cat:"Mangal", rating:4.7, dist:"4.5 km", price:"₺600+", addr:"Üsküdar, Bağlarbaşı Cd. No:88", desc:"Geleneksel odun ateşinde pişen lezzetler.", imgs:[I.bbq1,I.bbq2,I.kebab1], menu:["https://picsum.photos/seed/menu-ates1/600/900","https://picsum.photos/seed/menu-ates2/600/900"], hours:"11:00 - 00:00", tags:["Mangal","Aile"] },
  { id:6, name:"Klein Bistro", cat:"Kafe", rating:4.4, dist:"0.8 km", price:"₺200+", addr:"Beyoğlu, İstiklal Cd. No:156", desc:"Butik kahve ve ev yapımı pastalar.", imgs:[I.cafe1,I.cafe2,I.barista1], menu:["https://picsum.photos/seed/menu-klein1/600/900"], hours:"07:30 - 23:00", tags:["Kahve","Brunch"] },
  { id:7, name:"Lucca Lounge", cat:"Gece Hayatı", rating:4.3, dist:"6.2 km", price:"₺1.200+", addr:"Bebek, Cevdetpaşa Cd. No:51", desc:"Boğaz manzaralı lounge. Canlı DJ.", imgs:[I.night1,I.cocktail1,I.rooftop1], menu:["https://picsum.photos/seed/menu-lucca1/600/900","https://picsum.photos/seed/menu-lucca2/600/900"], hours:"17:00 - 04:00", tags:["Lounge","Kokteyl"] },
  { id:8, name:"Nonna's Trattoria", cat:"İtalyan", rating:4.6, dist:"3.1 km", price:"₺500+", addr:"Karaköy, Kemankeş Cd. No:29", desc:"Napoli usulü pizza ve makarna.", imgs:[I.pasta1,I.pizza1,I.bread1], menu:["https://picsum.photos/seed/menu-nonna1/600/900","https://picsum.photos/seed/menu-nonna2/600/900","https://picsum.photos/seed/menu-nonna3/600/900"], hours:"12:00 - 23:30", tags:["Pizza","Makarna"] },
  { id:9, name:"Çiya Sofrası", cat:"Türk Mutfağı", rating:4.7, dist:"4.0 km", price:"₺400+", addr:"Kadıköy, Güneşlibahçe Sk. No:43", desc:"Anadolu'nun dört köşesinden geleneksel tarifler.", imgs:[I.turkish1,I.turkish2,I.soup1], menu:["https://picsum.photos/seed/menu-ciya1/600/900","https://picsum.photos/seed/menu-ciya2/600/900"], hours:"11:00 - 22:00", tags:["Geleneksel","Anadolu"] },
  { id:10, name:"Mandarin Oriental", cat:"Uzak Doğu", rating:4.8, dist:"5.5 km", price:"₺1.500+", addr:"Kuruçeşme, Muallim Naci Cd.", desc:"Uzak Doğu'nun en rafine lezzetleri.", imgs:[I.dimsum1,I.ramen1,I.interior2], menu:["https://picsum.photos/seed/menu-mand1/600/900","https://picsum.photos/seed/menu-mand2/600/900"], hours:"12:00 - 23:00", tags:["Dim Sum","Ramen"] },
  { id:11, name:"The Burger Joint", cat:"Fast Food", rating:4.2, dist:"1.5 km", price:"₺250+", addr:"Nişantaşı, Abdi İpekçi Cd. No:22", desc:"El yapımı burgerler ve özel soslar.", imgs:[I.burger1,I.taco1,I.icecream1], menu:["https://picsum.photos/seed/menu-burg1/600/900"], hours:"11:00 - 01:00", tags:["Burger","Casual"] },
  { id:12, name:"Karaköy Güllüoğlu", cat:"Tatlıcı", rating:4.9, dist:"2.8 km", price:"₺150+", addr:"Kemankeş, Mumhane Cd. No:171", desc:"1820'den beri efsanevi baklava.", imgs:[I.dessert1,I.bread1,I.cafe1], menu:["https://picsum.photos/seed/menu-gull1/600/900","https://picsum.photos/seed/menu-gull2/600/900"], hours:"06:00 - 01:00", tags:["Baklava","Tatlı"] },
  { id:13, name:"Balıkçı Sabahattin", cat:"Deniz Ürünleri", rating:4.6, dist:"6.0 km", price:"₺900+", addr:"Sultanahmet, Seyit Hasan Kuyu Sk.", desc:"1927'den beri taze deniz lezzetleri.", imgs:[I.seafood1,I.bosphorus,I.wine1], menu:["https://picsum.photos/seed/menu-bal1/600/900","https://picsum.photos/seed/menu-bal2/600/900","https://picsum.photos/seed/menu-bal3/600/900"], hours:"12:00 - 23:00", tags:["Balık","Tarihi"] },
  { id:14, name:"Spice Market", cat:"Hint", rating:4.4, dist:"3.8 km", price:"₺450+", addr:"Cihangir, Akarsu Cd. No:15", desc:"Otantik Hint baharat dünyası.", imgs:[I.curry1,I.interior1,I.bread1], menu:["https://picsum.photos/seed/menu-spic1/600/900","https://picsum.photos/seed/menu-spic2/600/900"], hours:"12:00 - 23:00", tags:["Hint","Curry"] },
  { id:15, name:"Mövenpick Bosphorus", cat:"Fine Dining", rating:4.5, dist:"7.3 km", price:"₺1.800+", addr:"Örnektepe, İstanbul", desc:"Boğaz kenarında muhteşem manzara.", imgs:[I.bosphorus,I.interior3,I.seafood1], menu:["https://picsum.photos/seed/menu-mov1/600/900","https://picsum.photos/seed/menu-mov2/600/900"], hours:"07:00 - 00:00", tags:["Boğaz","Dünya Mutfağı"] },
];

// Seçilen dosyaları tek bir biçime indirger: { name, url, type }. Blob URL'i
// seçim anında bir kez üretilir — render sırasında değil, yoksa her çizimde
// yeni bir URL sızardı.
function toMediaFiles(fileList) {
  return Array.from(fileList || []).map(f => ({ name: f.name, url: URL.createObjectURL(f), type: f.type }));
}

// Doyurucu panelinden yüklenen görselleri, sahibi olduğu restoranın kendi
// dizilerine karıştırır. Tüm ekranlar (swipe kartı, detay galerisi, menü
// overlay'i, favoriler, profil) r.imgs / r.menu'den beslendiği için tek
// noktadan yapılan bu ekleme hepsine birden yansır.
function withOwnerMedia(list, ownerId, media) {
  // Menü olarak PDF de yüklenebiliyor; galeri yalnızca görselleri gösterebilir.
  const isImg = (f) => !f.type || f.type.startsWith("image/");
  const photos = (media?.photos || []).filter(isImg);
  const menu = (media?.menu || []).filter(isImg);
  if (ownerId == null || (photos.length === 0 && menu.length === 0)) return list;
  return list.map(r => r.id !== ownerId ? r : {
    ...r,
    imgs: [...photos.map(f => f.url), ...r.imgs],
    menu: [...menu.map(f => f.url), ...(r.menu || [])],
    ownerPhotoCount: photos.length,
  });
}

// Doyurucu'nun yönettiği restoran. Canlı OSM verisinde id'ler string
// ("osm-123"), demo veride sayı — bu yüzden sabit bir id'ye bağlanmıyoruz.
function findOwnerRestaurant(list) {
  return list.find(r => /Kadıköy/.test(r.addr || "")) || list[0] || null;
}

const CATEGORIES = [
  { name:"Türk Mutfağı", img:I.turkish1 }, { name:"Uzak Doğu", img:I.sushi1 },
  { name:"Sağlıklı", img:I.healthy1 }, { name:"Mangal", img:I.bbq1 },
  { name:"Gece Hayatı", img:I.night1 }, { name:"Alkollü", img:I.cocktail1 },
  { name:"Kafe", img:I.cafe1 }, { name:"İtalyan", img:I.pasta1 },
  { name:"Fast Food", img:I.burger1 }, { name:"Tatlıcı", img:I.dessert1 },
  { name:"Deniz Ürünleri", img:I.seafood1 }, { name:"Hint", img:I.curry1 },
  { name:"Fine Dining", img:I.interior2 },
];

// ═══════════════════════════════════════════════
// GELİR: ÖDÜLLÜ VİDEO REKLAM (Faz 1)
// ═══════════════════════════════════════════════
// Kaydırma bir kotaya bağlı: FREE_SWIPES hak biter, kullanıcı kısa bir
// video reklam izleyerek REWARD_SWIPES hak kazanır. Reklam akışı bölmez,
// akışın devamının bedelidir — envanter böylece izlenme garantili olur.
const FREE_SWIPES = 10;
const REWARD_SWIPES = 5;
const AD_DURATION = 5; // saniye

const REWARD_ADS = [
  {
    id: "rw-1", brand: "Öz Değirmen", tagline: "Taş değirmen tam buğday unu",
    headline: "15 dakikada ev yapımı pide", cta: "Tarifi Gör",
    img: "https://picsum.photos/seed/gur-sp-bread/600/900", accent: "#C2410C",
  },
  {
    id: "rw-2", brand: "Kalamış Zeytinyağı", tagline: "Erken hasat, soğuk sıkım",
    headline: "Şeflerin tercih ettiği zeytinyağı", cta: "Ürünü İncele",
    img: "https://picsum.photos/seed/gur-sp-oil/600/900", accent: "#4D7C0F",
  },
  {
    id: "rw-3", brand: "Bereket Baharat", tagline: "Tek kaynaktan öğütülmüş",
    headline: "Mangalını kurtaran baharat karışımı", cta: "Sepete Ekle",
    img: "https://picsum.photos/seed/gur-sp-spice/600/900", accent: "#B45309",
  },
];

// Keşfet üstündeki dönen banner: marka slaytı + sponsor slaytları
const BANNER_ADS = [
  { id: "ad-1", brand: "Öz Değirmen", text: "Tam buğday ununda %20 indirim", cta: "Kampanyayı gör", img: "https://picsum.photos/seed/gur-ad-flour/800/400", accent: "#C2410C" },
  { id: "ad-2", brand: "Kalamış Zeytinyağı", text: "Erken hasat sezonu başladı", cta: "Ürünlere bak", img: "https://picsum.photos/seed/gur-ad-oil/800/400", accent: "#4D7C0F" },
];

// ═══════════════════════════════════════════════
// GELİR: ANLIK FIRSATLAR (Faz 2)
// ═══════════════════════════════════════════════
// Restoran ölü saatini doldurmak için süreli indirim yayınlar; platform
// bunu konum bazlı bildirim reklamı olarak satar. Bitiş saati sabit bir
// referanstan türetilir ki geri sayım demo boyunca tutarlı kalsın.
const DEALS = [
  { restaurantId: 9, pct: 20, note: "15:00-17:00 arası tüm ana yemeklerde", minutesLeft: 96 },
  { restaurantId: 3, pct: 25, note: "Öğle menüsünde, sınırlı sayıda", minutesLeft: 42 },
  { restaurantId: 6, pct: 15, note: "Brunch saatleri dışında", minutesLeft: 158 },
];
function dealFor(restaurantId) {
  return DEALS.find(d => d.restaurantId === restaurantId) || null;
}
function formatCountdown(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
}

// Restoran destesine her N kartta bir sponsorlu kart serpiştirilir.
// Reklam yoğunluğu tek yerden ayarlanır; deste kısa olduğunda araya
// hiç girmez ki keşif akışı reklamla boğulmasın.
// ═══════════════════════════════════════════════
// SHARED UI — Polished
// ═══════════════════════════════════════════════

// Logo: beyaz hap şeklinde arka plan ile her yerde okunur
function GurLogo({ size = 48, pill = false }) {
  const logo = <span style={{ fontSize: size, fontWeight: 900, fontFamily: "'Poppins', sans-serif", letterSpacing: -size/24, lineHeight: 1 }}>
    <span style={{ color: "#FFA500" }}>G</span><span style={{ color: "#FF6600" }}>U</span><span style={{ color: "#FF0000" }}>R</span>
  </span>;
  if (pill) return <div style={{ background: "#fff", borderRadius: size * 0.5, padding: `${size*0.12}px ${size*0.35}px`, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>{logo}</div>;
  return logo;
}

// Basit çizgi ikon seti — emoji yerine
function Icon({ n, size = 18, color = "currentColor", strokeWidth = 2 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    plate: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></>,
    shield: <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />,
    palette: <><path d="M12 21a9 9 0 010-18 5 5 0 010 10h-1a2 2 0 000 4h1" /><circle cx="8.5" cy="10.5" r="1" fill={color} stroke="none" /><circle cx="12" cy="7.5" r="1" fill={color} stroke="none" /><circle cx="15.5" cy="10.5" r="1" fill={color} stroke="none" /></>,
    doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v5h5" /></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="14" r="3.5" /></>,
    sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />,
    check: <polyline points="20 6 9 17 4 12" />,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></>,
    heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
    cross: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    chat: <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    flame: <path d="M12 2c1 3-3 4-3 8a3 3 0 006 0c1.5 1 2 3 2 4a5 5 0 01-10 0c0-4 3-6 5-12z" />,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    chart: <><line x1="4" y1="20" x2="4" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="20" y1="20" x2="20" y2="14" /></>,
    pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></>,
    bulb: <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0012 2z" />,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></>,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    brokenHeart: <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /><line x1="10" y1="9" x2="14" y2="14" /><line x1="14" y1="9" x2="10" y2="14" /></>,
    bank: <><line x1="3" y1="21" x2="21" y2="21" /><line x1="5" y1="21" x2="5" y2="10" /><line x1="19" y1="21" x2="19" y2="10" /><polygon points="12 2 20 8 4 8" /></>,
    photo: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  };
  return <svg {...p}>{paths[n] || null}</svg>;
}

// ─── Icon-only buton — Apple HIG: dairesel/rounded "glass" veya opak hedef, min 40pt dokunma alanı ───
function IconBtn({ onClick, icon, children, tone = "glassDark", shape = "circle", size = 40, title }) {
  const tones = {
    glassDark: { bg: "rgba(0,0,0,0.35)", blur: true },
    glassLight: { bg: "rgba(255,255,255,0.16)", blur: true },
    solidLight: { bg: "#fff", shadow: "0 2px 10px rgba(0,0,0,0.08)" },
    subtle: { bg: "rgba(45,36,25,0.06)" },
    dangerSoft: { bg: "rgba(255,59,48,0.1)" },
    plain: { bg: "transparent" },
  };
  const t = tones[tone] || tones.glassDark;
  return (
    <motion.button
      onClick={onClick}
      title={title}
      aria-label={title}
      whileTap={{ scale: 0.88 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className="gur-icon-btn"
      style={{
        width: size, height: size, minWidth: size, minHeight: size, flexShrink: 0,
        borderRadius: shape === "circle" ? "50%" : 14,
        border: "none", background: t.bg,
        backdropFilter: t.blur ? "blur(8px)" : undefined,
        boxShadow: t.shadow || "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 0,
        WebkitTapHighlightColor: "transparent", outline: "none",
      }}>
      {children || icon}
    </motion.button>
  );
}

// Geri butonu: her arka planda görünür
function BackBtn({ onClick, variant = "dark" }) {
  const stroke = variant === "dark" ? "#fff" : "#FF6600";
  return (
    <IconBtn onClick={onClick} tone={variant === "dark" ? "glassDark" : "solidLight"} size={40} title="Geri">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    </IconBtn>
  );
}

function Img({ src, style, bg = "#e8e0d8" }) {
  const [state, setState] = useState("loading"); // loading | ok | failed
  useEffect(() => { setState("loading"); }, [src]);
  return (
    <div style={{ ...style, position: "relative", overflow: "hidden", background: bg }}>
      {state === "loading" && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 22, height: 22, border: "3px solid rgba(0,0,0,0.08)", borderTopColor: "#FF6600", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>}
      {/* Yüklenemeyen görselde <img> gizli kalır; arka plan rengi/gradyanı görünür
          — aksi halde tarayıcının bozuk görsel ikonu kartın üstüne düşüyordu. */}
      <img src={src} alt="" onLoad={() => setState("ok")} onError={() => setState("failed")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: state === "ok" ? 1 : 0, transition: "opacity 0.4s" }} />
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }) {
  return <div style={{ marginBottom: 20 }}>
    <label style={{ display: "block", marginBottom: 7, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#2D2419" }}>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "15px 18px", borderRadius: 16, border: "none", outline: "none", fontSize: 15, fontFamily: "'Outfit', sans-serif", background: "#fff", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", boxSizing: "border-box" }} />
  </div>;
}

function SelectField({ label, value, onChange, options }) {
  return <div style={{ marginBottom: 20 }}>
    <label style={{ display: "block", marginBottom: 7, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#2D2419" }}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "15px 18px", borderRadius: 16, border: "none", outline: "none", fontSize: 15, fontFamily: "'Outfit', sans-serif", background: "#fff", color: value ? "#333" : "#aaa", appearance: "none", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", boxSizing: "border-box", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 18px center" }}>
      <option value="">Seçiniz</option>{options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>;
}

// ─── Ana buton — Apple HIG "filled" kapsül: tam yuvarlak köşe, tek tip basılma geri bildirimi ───
function Btn({ text, onClick, disabled, variant = "onColor", size = "lg", fullWidth = true, icon }) {
  const paddings = { lg: "16px 0", md: "13px 22px", sm: "9px 16px" };
  const fontSizes = { lg: 16, md: 14, sm: 12.5 };
  const palettes = {
    onColor: { bg: "#fff", color: "#FF6600", shadow: "0 6px 20px rgba(0,0,0,0.15)" },
    filled: { bg: GRAD, color: "#fff", shadow: "0 6px 20px rgba(255,69,0,0.3)" },
    outline: { bg: "rgba(255,255,255,0.08)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.55)" },
    outlineDark: { bg: "transparent", color: "#2D2419", border: "1.5px solid rgba(45,36,25,0.15)" },
    destructive: { bg: "#FF3B30", color: "#fff", shadow: "0 6px 18px rgba(255,59,48,0.3)" },
    destructiveSoft: { bg: "rgba(255,59,48,0.08)", color: "#FF3B30" },
    plain: { bg: "transparent", color: "rgba(255,255,255,0.6)" },
  };
  const p = palettes[variant] || palettes.onColor;
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className="gur-btn"
      style={{
        width: fullWidth ? "100%" : "auto",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: paddings[size], borderRadius: 999,
        border: p.border || "none", background: p.bg, color: p.color,
        fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: fontSizes[size],
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : (p.shadow || "none"),
        opacity: disabled ? 0.4 : 1,
        WebkitTapHighlightColor: "transparent", outline: "none", whiteSpace: "nowrap",
      }}>
      {icon}{text}
    </motion.button>
  );
}

function UploadBox({ label, icon, accept, files, setFiles, multiple = true }) {
  const ref = useRef(null);
  const handle = (e) => { const nf = Array.from(e.target.files).map(f => ({ name: f.name, url: URL.createObjectURL(f), type: f.type })); setFiles(prev => multiple ? [...prev, ...nf] : nf); };
  const remove = (i) => setFiles(prev => { const f = prev[i]; if (f?.url?.startsWith("blob:")) URL.revokeObjectURL(f.url); return prev.filter((_, j) => j !== i); });
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", marginBottom: 8, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#2D2419" }}>{label}</label>
      <input ref={ref} type="file" accept={accept} multiple={multiple} onChange={handle} style={{ display: "none" }} />
      <div onClick={() => ref.current?.click()} style={{ border: "2px dashed rgba(255,102,0,0.3)", borderRadius: 18, padding: files.length > 0 ? 14 : "30px 16px", textAlign: "center", cursor: "pointer", background: "#fff", transition: "border-color 0.2s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "#FF6600"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,102,0,0.3)"}>
        {files.length === 0 ? <><div style={{ display: "flex", justifyContent: "center" }}>{icon}</div><p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#A18F7C", margin: "10px 0 0" }}>Dosya seçmek için tıklayın</p></> : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {files.map((f, i) => <div key={i} style={{ position: "relative" }}>{f.type?.startsWith("image/") ? <img src={f.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: "2px solid rgba(255,102,0,0.2)" }} /> : <div style={{ width: 72, height: 72, borderRadius: 12, background: "#FFF3EA", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="doc" size={20} color="#FF6600" /></div>}<div onClick={e => { e.stopPropagation(); remove(i); }} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: "#FF3B30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>✕</div></div>)}
            <div style={{ width: 72, height: 72, borderRadius: 12, border: "2px dashed rgba(255,102,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 18, color: "rgba(255,102,0,0.4)" }}>+</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneFrame({ children }) {
  return <div style={{ width: 390, maxWidth: "100%", height: 844, borderRadius: 44, overflow: "hidden", boxShadow: "0 25px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)", position: "relative", background: "#fff", margin: "0 auto" }}>
    <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 126, height: 30, background: "#000", borderBottomLeftRadius: 18, borderBottomRightRadius: 18, zIndex: 999 }} />
    {children}
  </div>;
}

function Screen({ children, grad = true }) {
  return <div style={{ width: "100%", height: "100%", background: grad ? "#fff" : "#fff", overflowY: "auto", overflowX: "hidden", position: "relative" }}>{children}</div>;
}

// ═══════════════════════════════════════════════
// SWIPE CARD — Eski Tinder stili, tam ekran fotoğraf
// ═══════════════════════════════════════════════
const SwipeCard = React.forwardRef(function SwipeCard({ r, onLeft, onRight, isTop, onTap }, flingRef) {
  const ref = useRef(null);
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [ii, setIi] = useState(0);

  // x, tüm görsel özellikleri sürükler: dönüş ve opaklık ondan türetilir (§7 — tek eksenden tutarlı hareket)
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-20, 0, 20]);
  const dragOpacity = useTransform(x, [-320, -60, 0, 60, 320], [0.5, 1, 1, 1, 0.5]);
  const favOpacity = useTransform(x, [30, 110], [0, 1]);
  const nopeOpacity = useTransform(x, [-110, -30], [1, 0]);

  // Kart hem sürüklenip bırakılınca hem de aksiyon butonuna basılınca aynı çıkış animasyonundan geçer
  const commit = (direction, velocity = 0) => {
    const flyX = direction * 900;
    animate(x, flyX, { type: "spring", bounce: 0, duration: 0.5, velocity })
      .then(() => (direction > 0 ? onRight() : onLeft()));
  };
  React.useImperativeHandle(flingRef, () => ({ fling: (direction) => commit(direction) }), [onLeft, onRight]);

  const handleDragStart = () => { movedRef.current = false; setDragging(true); };
  const handleDrag = (e, info) => { if (Math.abs(info.offset.x) > 6) movedRef.current = true; };

  const handleDragEnd = (e, info) => {
    setDragging(false);
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    // §6 — bırakma noktası değil, hızın taşıyacağı nokta karar verir
    const projected = offset + projectMomentum(velocity);
    const goRight = projected > 100;
    const goLeft = projected < -100;
    if (goRight || goLeft) {
      // §5 — bırakma hızı sıfırlanmadan spring'e devrediliyor, animasyon parmağın hızıyla devam ediyor
      commit(goRight ? 1 : -1, velocity);
    } else {
      animate(x, 0, { type: "spring", bounce: 0.15, duration: 0.5, velocity });
    }
  };

  const tap = (e) => { if (movedRef.current) return; const rect = ref.current?.getBoundingClientRect(); if (!rect) return; const tx = e.clientX - rect.left;
    if (tx > rect.width * 0.6) setIi(i => Math.min(i + 1, r.imgs.length - 1));
    else if (tx < rect.width * 0.4) setIi(i => Math.max(i - 1, 0));
    else onTap?.();
  };

  return (
    <motion.div
      ref={ref}
      drag={isTop ? "x" : false}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onClick={tap}
      style={{
        x: isTop ? x : 0, rotate: isTop ? rotate : 0, opacity: isTop ? dragOpacity : 1,
        position: "absolute", inset: 0,
        cursor: isTop ? (dragging ? "grabbing" : "grab") : "default",
        userSelect: "none", pointerEvents: isTop ? "auto" : "none", zIndex: isTop ? 2 : 1,
        borderRadius: 24, overflow: "hidden",
        boxShadow: isTop ? "0 12px 48px rgba(0,0,0,0.35)" : "0 4px 16px rgba(0,0,0,0.1)",
      }}
      animate={{ scale: isTop ? 1 : 0.96, y: isTop ? 0 : 10 }}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
    >
      <Img src={r.imgs[ii]} style={{ position: "absolute", inset: 0, borderRadius: 24 }} bg="linear-gradient(135deg, #1a1008, #2a1a0a, #1a1008)" />
      {/* Sürükleme etiketleri her kart türünde görünür — reklam kartında da
          kullanıcı ne yaptığını anlamalı (§1 — sürekli geri bildirim) */}
      {isTop && (
        <>
          <motion.div style={{ opacity: favOpacity, position: "absolute", top: 90, left: 24, zIndex: 10, border: "4px solid #4CAF50", borderRadius: 14, padding: "8px 22px", transform: "rotate(-15deg)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(6px)" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#4CAF50" }}>FAV!</span>
          </motion.div>
          <motion.div style={{ opacity: nopeOpacity, position: "absolute", top: 90, right: 24, zIndex: 10, border: "4px solid #FF3B30", borderRadius: 14, padding: "8px 22px", transform: "rotate(15deg)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(6px)" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#FF3B30" }}>NOPE</span>
          </motion.div>
        </>
      )}

      {isTop && <>
      {/* İşletmenin kendi yüklediği fotoğraflar öne alınır ve işaretlenir */}
      {ii < (r.ownerPhotoCount || 0) && (
        <div style={{ position: "absolute", top: 54, left: 14, zIndex: 6, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 20, padding: "4px 11px" }}>
          <Icon n="camera" size={11} color="#FFA500" />
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: "#fff" }}>İşletmeden</span>
        </div>
      )}
      {/* Photo indicators */}
      <div style={{ position: "absolute", top: 40, left: 14, right: 14, display: "flex", gap: 4, zIndex: 5 }}>
        {r.imgs.map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === ii ? "#fff" : "rgba(255,255,255,0.3)", transition: "background 0.2s" }} />)}
      </div>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 30%, transparent 55%)", borderRadius: 24 }} />
      {/* Content */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 22px 28px", zIndex: 5 }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 8px", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{r.name}</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ background: "#fff", borderRadius: 10, padding: "4px 12px", fontSize: 13, fontWeight: 700, color: "#1C1917", fontFamily: "'Outfit', sans-serif", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon n="star" color="#F59E0B" size={12} />{r.rating}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "'Outfit', sans-serif" }}>{r.dist}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "'Outfit', sans-serif" }}>•  {r.price}</span>
        </div>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.85)", margin: "0 0 12px", lineHeight: 1.45 }}>{r.desc}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {r.tags.map(t => <span key={t} style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>{t}</span>)}
        </div>
      </div>
      </>}
    </motion.div>
  );
});

// ═══════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════

function SplashScreen({ onNext }) {
  const [phase, setPhase] = useState(0); // 0=wait, 1=G, 2=U, 3=R, 4=together, 5=done
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1300),
      setTimeout(() => setPhase(4), 1900),
      setTimeout(() => setPhase(5), 2600),
      setTimeout(onNext, 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const letterStyle = (letter, delay) => ({
    fontSize: phase >= 4 ? 110 : 130,
    fontWeight: 900,
    fontFamily: "'Poppins', sans-serif",
    display: "inline-block",
    opacity: phase >= (letter === "G" ? 1 : letter === "U" ? 2 : 3) ? 1 : 0,
    transform: phase >= 4
      ? "translateY(0) scale(1)"
      : phase >= (letter === "G" ? 1 : letter === "U" ? 2 : 3)
        ? "translateY(0) scale(1.15)"
        : "translateY(80px) scale(0.3)",
    transition: phase >= 4 ? "all 0.6s cubic-bezier(.34,1.56,.64,1)" : "all 0.45s cubic-bezier(.34,1.56,.64,1)",
    textShadow: "3px 4px 0 rgba(0,0,0,0.08)",
  });

  return (
    <Screen grad={false}>
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#fff", position: "relative",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: phase >= 4 ? 0 : 30,
          transition: "gap 0.6s cubic-bezier(.34,1.56,.64,1)",
          letterSpacing: phase >= 4 ? -5 : 0,
          position: "relative", zIndex: 1,
        }}>
          <span style={{ ...letterStyle("G"), color: "#FFA500" }}>G</span>
          <span style={{ ...letterStyle("U"), color: "#FF6600" }}>U</span>
          <span style={{ ...letterStyle("R"), color: "#FF0000" }}>R</span>
        </div>

        {/* Alt yazı — harfler birleştikten sonra */}
        <p style={{
          fontFamily: "'Outfit', sans-serif", fontSize: 14,
          color: "#bbb",
          marginTop: 20,
          opacity: phase >= 4 ? 1 : 0,
          transform: phase >= 4 ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s ease-out 0.3s",
          position: "relative", zIndex: 1,
        }}>
          Lezzet keşfine hazır mısın?
        </p>
      </div>
    </Screen>
  );
}

function WelcomeScreen({ onStart, onDoyurucu }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 100); }, []);

  return (
    <Screen grad={false}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        {/* Üst kısım — beyaz, büyük logo */}
        <div style={{
          flex: 1.1, background: "#fff", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2,
        }}>
          {/* Dekoratif daireler */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,102,0,0.04)" }} />
          <div style={{ position: "absolute", bottom: -20, left: -30, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,0,0,0.03)" }} />

          <div style={{
            opacity: show ? 1 : 0, transform: show ? "scale(1)" : "scale(0.8)",
            transition: "all 0.7s cubic-bezier(.34,1.56,.64,1)",
          }}>
            <GurLogo size={110} />
          </div>

          <p style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "#ccc",
            marginTop: 10, letterSpacing: 2,
            opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(10px)",
            transition: "all 0.5s ease-out 0.4s",
          }}>
            LEZZET PLATFORMU
          </p>
        </div>

        {/* Alt kısım — turuncu gradient eğri */}
        <div style={{
          background: GRAD, padding: "40px 30px 50px",
          borderTopLeftRadius: 40, borderTopRightRadius: 40,
          position: "relative", zIndex: 3,
          transform: show ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.7s cubic-bezier(.22,1,.36,1) 0.2s",
        }}>
          {/* Dekoratif küçük logo */}
          <div style={{
            position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)",
            background: "#fff", borderRadius: 20, padding: "8px 20px",
            boxShadow: "0 4px 20px rgba(255,69,0,0.2)",
          }}>
            <GurLogo size={22} pill />
          </div>

          <h2 style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 28, color: "#fff",
            textAlign: "center", margin: "14px 0 6px",
            textShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
            Hoş geldin!
          </h2>
          <p style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.75)",
            textAlign: "center", margin: "0 0 28px", lineHeight: 1.5,
          }}>
            İstanbul'un en iyi restoranlarını keşfet, favorilerini kaydet
          </p>

          <Btn text="GUR uldamaya başla sende" onClick={onStart} />
          <div style={{ height: 12 }} />
          <Btn text="Doyurucu için doğru yer" onClick={onDoyurucu} variant="outline" />
        </div>
      </div>
    </Screen>
  );
}

function LoginScreen({ onBack, onLogin, onRegister }) {
  const [e, setE] = useState(""); const [p, setP] = useState("");
  return <Screen grad={false}><div style={{ height: "38%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}><GurLogo size={60} pill /></div><div style={{ minHeight: "62%", background: GRAD, borderTopLeftRadius: 44, borderTopRightRadius: 44, padding: "28px 28px 40px", position: "relative" }}><div style={{ position: "absolute", left: 14, top: 18 }}><BackBtn onClick={onBack} /></div><h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, color: "#fff", margin: "0 0 6px", textAlign: "center", textShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>Giriş yap</h2><p onClick={onRegister} style={{ textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 14, marginBottom: 32, cursor: "pointer", textDecoration: "underline", fontFamily: "'Outfit', sans-serif" }}>Üyeliğiniz yoksa lütfen kayıt için dokununuz</p><InputField label="Mail Adresi" value={e} onChange={setE} placeholder="kullanıcı@mail.com" /><InputField label="Şifre" value={p} onChange={setP} placeholder="******" type="password" /><div style={{ marginTop: 24 }}><Btn text="GUR uldamaya başla" onClick={onLogin} /></div></div></Screen>;
}

function RegisterScreen({ onBack, onDone }) {
  const [n,setN]=useState(""); const [e,setE]=useState(""); const [p,setP]=useState(""); const [d,setD]=useState(""); const [a,setA]=useState(false);
  return <Screen><div style={{ padding: "24px 26px 40px" }}><div style={{ position: "absolute", left: 14, top: 18 }}><BackBtn onClick={onBack} /></div><div style={{ textAlign: "center", marginTop: 12, marginBottom: 14 }}><GurLogo size={42} pill /></div><p style={{ textAlign: "center", color: "#6B5D4C", fontSize: 14, fontFamily: "'Outfit', sans-serif", marginBottom: 26 }}>Eğer hesabınız varsa lütfen burda kendinizi yormayınınız =)</p><InputField label="İsim" value={n} onChange={setN} placeholder="Bora Çolpan" /><InputField label="Mail adresi" value={e} onChange={setE} placeholder="kullanıcı@gmail.com" /><InputField label="Şifre" value={p} onChange={setP} placeholder="******" type="password" /><SelectField label="Doğum Tarihi" value={d} onChange={setD} options={Array.from({length:30},(_,i)=>String(1980+i))} /><div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 10, marginBottom: 22 }}><p style={{ flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "#6B5D4C", margin: 0 }}>Lütfen yasal sözleşmeyi onaylayarak devam ediniz.</p><div onClick={()=>setA(!a)} style={{ width: 28, height: 28, borderRadius: 10, border: "2px solid #FF6600", background: a?"#FF6600":"transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>{a && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}</div></div><Btn text="Kaydınızı Tamamlayınız" onClick={onDone} /></div></Screen>;
}

// ═══════════════════════════════════════════════
// DOYURUCU GİRİŞ — Hesap seçimi
// ═══════════════════════════════════════════════
function DoyurucuAuthScreen({ onBack, onLogin, onRegister }) {
  return (
    <Screen grad={false}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        {/* Üst beyaz alan */}
        <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,102,0,0.04)" }} />
          <div style={{ position: "absolute", bottom: -15, left: -20, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,0,0,0.03)" }} />
          
<div style={{ marginBottom: 16, animation: "fadeInUp 0.6s ease-out" }}><Icon n="plate" color="#FF6600" size={34} /></div>
          <GurLogo size={60} pill />
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "#bbb", marginTop: 8, letterSpacing: 1.5 }}>DOYURUCU PANELİ</p>
        </div>

        {/* Alt turuncu alan */}
        <div style={{ background: GRAD, padding: "28px 28px 50px", borderTopLeftRadius: 40, borderTopRightRadius: 40, position: "relative" }}>
          <div style={{ position: "absolute", left: 14, top: 14 }}>
            <BackBtn onClick={onBack} />
          </div>

          <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", background: "#fff", borderRadius: 20, padding: "8px 20px", boxShadow: "0 4px 20px rgba(255,69,0,0.2)" }}>
            <GurLogo size={22} pill />
          </div>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", textAlign: "center", margin: "16px 0 8px", textShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>Doyurucu Girişi</h2>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.75)", textAlign: "center", margin: "0 0 28px", lineHeight: 1.5 }}>
            Restoranınızı yönetin, istatistikleri takip edin
          </p>

          <Btn text="Giriş Yap" onClick={onLogin} />
          <div style={{ height: 12 }} />
          <Btn text="Yeni Hesap Oluştur" onClick={onRegister} variant="outline" />
        </div>
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// DOYURUCU LOGIN — Mevcut hesapla giriş
// ═══════════════════════════════════════════════
function DoyurucuLoginScreen({ onBack, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Screen grad={false}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Üst beyaz */}
        <div style={{ height: "32%", background: "#fafafa", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
<div style={{ marginBottom: 10 }}><Icon n="plate" color="#FF6600" size={22} /></div>
          <GurLogo size={60} pill />
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#bbb", marginTop: 4, letterSpacing: 1.5 }}>DOYURUCU</p>
        </div>

        {/* Alt gradient */}
        <div style={{ flex: 1, background: GRAD, borderTopLeftRadius: 44, borderTopRightRadius: 44, padding: "28px 28px 40px", position: "relative" }}>
          <div style={{ position: "absolute", left: 14, top: 18 }}>
            <BackBtn onClick={onBack} />
          </div>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "#fff", margin: "0 0 6px", textAlign: "center", textShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>Giriş Yap</h2>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center", margin: "0 0 30px" }}>
            İşletme hesabınızla giriş yapın
          </p>

          <InputField label="E-posta Adresi" value={email} onChange={setEmail} placeholder="restoran@mail.com" />
          <InputField label="Şifre" value={password} onChange={setPassword} placeholder="******" type="password" />

          <div style={{ marginTop: 8 }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "right", margin: "0 0 20px", cursor: "pointer", textDecoration: "underline" }}>Şifremi unuttum</p>
          </div>

          <Btn text="İşletme Paneline Gir" onClick={onLogin} />
        </div>
      </div>
    </Screen>
  );
}

// ─── Progress Bar Component ───
function StepProgress({ current, total = 3 }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < current ? "#FF6600" : "rgba(45,36,25,0.1)", transition: "background 0.4s" }} />
      ))}
    </div>
  );
}

// ─── Step Header ───
function StepHeader({ step, title, subtitle, onBack }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <BackBtn onClick={onBack} />
        <GurLogo size={42} pill />
        <div style={{ width: 38 }} /> {/* spacer for centering */}
      </div>
      <StepProgress current={step} />
      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 800, color: "#2D2419", margin: "0 0 6px", textAlign: "center" }}>{title}</h2>
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#8A7A68", textAlign: "center", marginBottom: 24 }}>{subtitle}</p>
    </>
  );
}

// ─── Info Card ───
function InfoCard({ icon, text }) {
  return (
    <div style={{ background: "#FFF3EA", borderRadius: 18, padding: "14px 16px", marginBottom: 22, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 30, height: 30, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#6B5D4C", margin: 0, lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ADIM 1 — İşletme Bilgileri
// ═══════════════════════════════════════════════
function RestRegStep1({ onBack, onNext }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [locFocused, setLocFocused] = useState(false);
  const [serviceType, setServiceType] = useState("");
  const [size, setSize] = useState("");
  const [year, setYear] = useState("");

  // Basit lokasyon önerileri
  const locationSuggestions = [
    "Kadıköy, İstanbul", "Beşiktaş, İstanbul", "Beyoğlu, İstanbul",
    "Şişli, İstanbul", "Üsküdar, İstanbul", "Fatih, İstanbul",
    "Bakırköy, İstanbul", "Sarıyer, İstanbul", "Maltepe, İstanbul",
  ];
  const filteredLocs = location.length > 0
    ? locationSuggestions.filter(l => l.toLowerCase().includes(location.toLowerCase()))
    : [];

  const canProceed = name.trim().length > 0 && location.trim().length > 0 && serviceType && size;

  return (
    <Screen>
      <div style={{ padding: "44px 24px 40px" }}>
        <StepHeader step={1} title="İşletme Bilgileri" subtitle="Adım 1/3 — Restoranınızı tanıyalım" onBack={onBack} />

        <InfoCard icon={<Icon n="plate" color="#FF6600" size={16} />} text="İşletmenizin temel bilgilerini girin. Bu bilgiler uygulamada profilinizi oluşturmak için kullanılacaktır." />

        <InputField label="İşletme Adı" value={name} onChange={setName} placeholder="ör: Karadeniz Pide Salonu" />

        {/* Lokasyon — önerilerle */}
        <div style={{ marginBottom: 20, position: "relative" }}>
          <label style={{ display: "block", marginBottom: 7, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#2D2419" }}>Lokasyon</label>
          <div style={{ position: "relative" }}>
            <input
              value={location} onChange={e => setLocation(e.target.value)}
              onFocus={() => setLocFocused(true)} onBlur={() => setTimeout(() => setLocFocused(false), 200)}
              placeholder="İlçe veya adres yazın..."
              style={{ width: "100%", padding: "15px 18px 15px 42px", borderRadius: 16, border: "none", outline: "none", fontSize: 15, fontFamily: "'Outfit', sans-serif", background: "#fff", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", boxSizing: "border-box" }}
            />
            <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
          </div>
          {/* Öneri dropdown */}
          {locFocused && filteredLocs.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.15)", zIndex: 20, marginTop: 4, overflow: "hidden" }}>
              {filteredLocs.slice(0, 4).map((l, i) => (
                <div key={i} onMouseDown={() => { setLocation(l); setLocFocused(false); }}
                  style={{ padding: "12px 16px", cursor: "pointer", borderBottom: i < Math.min(filteredLocs.length, 4) - 1 ? "1px solid #f5f5f5" : "none", display: "flex", alignItems: "center", gap: 10, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FFF8F4"}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#333" }}>{l}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <SelectField label="Hizmet Türü" value={serviceType} onChange={setServiceType}
          options={["Restoran", "Kafe", "Bar", "Fast Food", "Fine Dining", "Kahvaltıcı", "Tatlıcı", "Balıkçı", "Pub & Lounge"]} />

        <SelectField label="İşletme Büyüklüğü" value={size} onChange={setSize}
          options={["Küçük (1-10 masa)", "Orta (10-25 masa)", "Büyük (25-50 masa)", "Çok Büyük (50+ masa)"]} />

        <SelectField label="Açılış Yılı" value={year} onChange={setYear}
          options={Array.from({ length: 30 }, (_, i) => String(2025 - i))} />

        <div style={{ marginTop: 24 }}>
          <Btn text="Devam Et →" onClick={onNext} disabled={!canProceed} />
          {!canProceed && (
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(45,36,25,0.45)", textAlign: "center", marginTop: 10 }}>
              İşletme adı, lokasyon, hizmet türü ve büyüklük alanları zorunludur
            </p>
          )}
        </div>
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// ADIM 2 — İşletme Doğrulama (Vergi Levhası)
// ═══════════════════════════════════════════════
function RestRegStep2({ onBack, onNext }) {
  const [taxNo, setTaxNo] = useState("");
  const [companyTitle, setCompanyTitle] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [levhaFiles, setLevhaFiles] = useState([]);

  const canProceed = levhaFiles.length > 0 && taxNo.trim().length > 0;

  return (
    <Screen>
      <div style={{ padding: "44px 24px 40px" }}>
        <StepHeader step={2} title="İşletme Doğrulama" subtitle="Adım 2/3 — Restoranınızı doğrulayalım" onBack={onBack} />

        <InfoCard icon={<Icon n="shield" color="#FF6600" size={16} />} text="Platformumuzda sadece doğrulanmış işletmeler yer alır. Vergi levhanızı yükleyerek işletmenizi doğrulayın. Belgeleriniz 24 saat içinde incelenir." />

        <InputField label="Vergi Numarası" value={taxNo} onChange={setTaxNo} placeholder="ör: 1234567890" />
        <InputField label="Şirket Ünvanı (Opsiyonel)" value={companyTitle} onChange={setCompanyTitle} placeholder="ör: Lezzet Gıda San. Tic. Ltd. Şti." />
        <InputField label="Vergi Dairesi" value={taxOffice} onChange={setTaxOffice} placeholder="ör: Kadıköy Vergi Dairesi" />

        <UploadBox
          label="Vergi Levhası Görseli"
          icon={<Icon n="bank" color="#FF6600" size={20} />}
          accept=".pdf,.jpg,.jpeg,.png"
          files={levhaFiles}
          setFiles={setLevhaFiles}
          multiple={false}
        />

        {/* Yükleme ipuçları */}
        <div style={{ background: "#F6F1EA", borderRadius: 16, padding: "14px 16px", marginBottom: 24 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#6B5D4C", margin: "0 0 8px" }}>Yükleme İpuçları</p>
          {["Telefonunuzdan fotoğraf çekerek yükleyebilirsiniz", "PDF veya görsel formatları kabul edilir", "Belgenin tamamının görünür olduğundan emin olun"].map((tip, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 2 ? 5 : 0 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(45,36,25,0.3)", flexShrink: 0 }} />
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#8A7A68", margin: 0 }}>{tip}</p>
            </div>
          ))}
        </div>

        <Btn text="Devam Et →" onClick={onNext} disabled={!canProceed} />
        {!canProceed && (
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(45,36,25,0.45)", textAlign: "center", marginTop: 10 }}>
            {levhaFiles.length === 0 ? "Devam etmek için vergi levhası yüklemeniz gerekiyor" : "Vergi numarası zorunludur"}
          </p>
        )}
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// ADIM 3 — Menü, Logo & Görseller
// ═══════════════════════════════════════════════
function RestRegStep3({ onBack, onDone, ownerMedia, setOwnerMedia }) {
  const [logoFiles, setLogoFiles] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  // Kayıt sırasında yüklenenler doğrudan uygulama geneline yazılır; böylece
  // panele geçildiğinde de, tüketici tarafında da aynı görseller görünür.
  const menuFiles = ownerMedia.menu;
  const photoFiles = ownerMedia.photos;
  const setMenuFiles = (up) => setOwnerMedia(p => ({ ...p, menu: typeof up === "function" ? up(p.menu) : up }));
  const setPhotoFiles = (up) => setOwnerMedia(p => ({ ...p, photos: typeof up === "function" ? up(p.photos) : up }));

  if (submitted) {
    return (
      <Screen>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 28px" }}>
          {/* Başarı animasyonu */}
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            background: "#EAF7EC",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 24, animation: "fadeInUp 0.5s ease-out",
            boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
          }}>
            <Icon n="check" color="#22A34D" size={32} strokeWidth={2.5} />
          </div>

          <h2 style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, color: "#2D2419",
            textAlign: "center", margin: "0 0 10px",
            animation: "fadeInUp 0.5s ease-out 0.1s both",
          }}>Başvurunuz Alındı!</h2>

          <p style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "#6B5D4C",
            textAlign: "center", lineHeight: 1.6, margin: "0 0 24px",
            animation: "fadeInUp 0.5s ease-out 0.2s both",
          }}>
            Belgeleriniz incelemeye alınmıştır. Onay süreciniz tamamlandığında size bildirim gönderilecektir.
          </p>

          {/* Yükleme özeti */}
          <div style={{
            width: "100%", background: "#fff", borderRadius: 20,
            padding: "18px 18px 14px", marginBottom: 28, boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
            animation: "fadeInUp 0.5s ease-out 0.3s both",
          }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#8A7A68", margin: "0 0 12px" }}>Yükleme Özeti</p>
            {[
              { icon: <Icon n="bank" size={16} color="#8A7A68" />, text: "Vergi levhası", done: true },
              { icon: <Icon n="palette" size={16} color="#8A7A68" />, text: logoFiles.length > 0 ? "Logo yüklendi" : "Logo yüklenmedi", done: logoFiles.length > 0 },
              { icon: <Icon n="doc" size={16} color="#8A7A68" />, text: menuFiles.length > 0 ? `${menuFiles.length} menü dosyası` : "Menü yüklenmedi", done: menuFiles.length > 0 },
              { icon: <Icon n="camera" size={16} color="#8A7A68" />, text: photoFiles.length > 0 ? `${photoFiles.length} fotoğraf` : "Fotoğraf yüklenmedi", done: photoFiles.length > 0 },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderBottom: i < 3 ? "1px solid rgba(45,36,25,0.06)" : "none",
              }}>
                {item.icon}
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#4A3F33", flex: 1 }}>{item.text}</span>
                {item.done ? <Icon n="check" size={16} color="#22A34D" /> : <Icon n="clock" size={16} color="#C9A24B" />}
              </div>
            ))}
          </div>

          {/* Bilgi kartı */}
          <div style={{
            width: "100%", background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.25)",
            borderRadius: 16, padding: "14px 16px", marginBottom: 24, display: "flex", gap: 12,
            animation: "fadeInUp 0.5s ease-out 0.4s both",
          }}>
            <Icon n="clock" size={16} color="#2F8C46" />
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#2F8C46", margin: 0, lineHeight: 1.5 }}>
              Başvurunuz en geç 24 saat içinde incelenecek ve onaylandığında restoranınız GUR'da yayınlanacaktır.
            </p>
          </div>

          <div style={{ width: "100%", animation: "fadeInUp 0.5s ease-out 0.5s both" }}>
            <Btn text="Ana Sayfaya Dön" onClick={onDone} />
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <div style={{ padding: "44px 24px 40px" }}>
        <StepHeader step={3} title="Menü & Görseller" subtitle="Adım 3/3 — Restoranınızı öne çıkarın" onBack={onBack} />

        <InfoCard icon={<Icon n="sparkle" color="#FF6600" size={16} />} text="Logo, menü ve fotoğraflar restoranınızın uygulamadaki vitrinidir. Kaliteli görseller müşteri ilgisini %70 artırır!" />

        {/* Logo */}
        <UploadBox
          label="Restoran Logosu"
          icon={<Icon n="palette" color="#FF6600" size={20} />}
          accept=".jpg,.jpeg,.png,.svg,.webp"
          files={logoFiles}
          setFiles={setLogoFiles}
          multiple={false}
        />

        {/* Menü */}
        <UploadBox
          label="Menü (PDF veya Fotoğraf)"
          icon={<Icon n="doc" color="#FF6600" size={20} />}
          accept=".pdf,.jpg,.jpeg,.png"
          files={menuFiles}
          setFiles={setMenuFiles}
          multiple={true}
        />

        {/* Fotoğraflar */}
        <UploadBox
          label="Mekan & Yemek Fotoğrafları"
          icon={<Icon n="camera" color="#FF6600" size={20} />}
          accept=".jpg,.jpeg,.png,.webp"
          files={photoFiles}
          setFiles={setPhotoFiles}
          multiple={true}
        />

        {/* İpucu kartı */}
        <div style={{ background: "#F6F1EA", borderRadius: 16, padding: "14px 16px", marginBottom: 24 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#6B5D4C", margin: "0 0 8px" }}>Fotoğraf Önerileri</p>
          {[
            "Mekan iç görünümü (ambiyans)",
            "Mekan dış cephesi (bulunabilirlik)",
            "En popüler 2-3 yemek fotoğrafı",
            "Menü görseli (okunabilir kalitede)",
          ].map((tip, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 3 ? 5 : 0 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(45,36,25,0.3)", flexShrink: 0 }} />
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#8A7A68", margin: 0 }}>{tip}</p>
            </div>
          ))}
        </div>

        <Btn text="Başvuruyu Tamamla ✓" onClick={() => setSubmitted(true)} />
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// RESTORAN PANELİ — İstatistikler (sadece restoranlar görür)
// ═══════════════════════════════════════════════
// ── Doyurucu paneli: gelir ürünü kartları ────────────────────────────────
function DarkChip({ label, active, onClick }) {
  return (
    <motion.button
      onClick={onClick} className="gur-btn"
      whileTap={{ scale: 0.95 }} transition={{ type: "spring", bounce: 0, duration: 0.25 }}
      style={{
        border: `1.5px solid ${active ? "#22C55E" : "rgba(255,255,255,0.14)"}`,
        background: active ? "rgba(34,197,94,0.14)" : "transparent",
        color: active ? "#4ADE80" : "rgba(255,255,255,0.6)",
        borderRadius: 11, padding: "7px 13px", cursor: "pointer", outline: "none",
        fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 700,
      }}>{label}</motion.button>
  );
}

function GrowthSection({ title, phase, locked, children }) {
  return (
    <div style={{ marginBottom: 22, opacity: locked ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.5)", margin: 0, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</p>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#FF6600", background: "rgba(255,102,0,0.12)", borderRadius: 6, padding: "2px 7px" }}>{phase}</span>
      </div>
      {children}
    </div>
  );
}

function LockedCard({ text }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 18, padding: "18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 11 }}>
      <Icon n="shield" size={16} color="rgba(255,255,255,0.3)" />
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.4)", margin: 0 }}>{text}</p>
    </div>
  );
}

function GrowthCard({ title, price, desc, active, locked, onBuy }) {
  return (
    <div style={{
      background: active ? "rgba(255,102,0,0.07)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${active ? "rgba(255,102,0,0.28)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 18, padding: "16px 18px", marginBottom: 12, opacity: locked ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>{title}</p>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 700, color: "#FF9A4D", flexShrink: 0 }}>{price}</span>
      </div>
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.5 }}>{desc}</p>
      {locked ? (
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.35)", margin: 0 }}>Bu paket sonraki fazda açılıyor</p>
      ) : active ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon n="check" size={14} color="#4ADE80" />
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 700, color: "#4ADE80" }}>Aktif</span>
        </div>
      ) : (
        <Btn text="Satın Al" onClick={onBuy} variant="filled" size="sm" fullWidth={false} />
      )}
    </div>
  );
}

function RestaurantDashboard({ onLogout, ownerMedia, setOwnerMedia, ownerRestaurant }) {
  const [activeTab, setActiveTab] = useState("stats");
  // Gelir ürünleri faza göre açılır (bkz. src/lib/phase.js)
  const sponsorOn = useFeature("pushAds");
  const dealsOn = useFeature("instantDeals");
  const bookingOn = useFeature("reservations");
  const licenseOn = useFeature("contentLicense");
  const saasOn = useFeature("analyticsSaas");
  const [bought, setBought] = useState({});
  const [notice, setNotice] = useState(null);
  const buy = (key, label) => { setBought(p => ({ ...p, [key]: true })); setNotice(label); setTimeout(() => setNotice(null), 2200); };
  const [dealPct, setDealPct] = useState(20);
  const [dealHours, setDealHours] = useState(2);
  const [dealLive, setDealLive] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  // Yüklemeler uygulama kökünde tutulur — panelden çıkınca kaybolmaz ve
  // tüketici tarafındaki swipe/detay ekranlarına anında yansır.
  const menuUploads = ownerMedia.menu;
  const photoUploads = ownerMedia.photos;
  const setMenuUploads = (up) => setOwnerMedia(p => ({ ...p, menu: typeof up === "function" ? up(p.menu) : up }));
  const setPhotoUploads = (up) => setOwnerMedia(p => ({ ...p, photos: typeof up === "function" ? up(p.photos) : up }));

  // Mock istatistik verileri
  const stats = {
    totalViews: 1248,
    swipeRight: 847,
    swipeLeft: 401,
    favRate: 67.9,
    avgRating: 4.6,
    totalReviews: 38,
    weeklyData: [
      { day: "Pzt", right: 95, left: 45 },
      { day: "Sal", right: 120, left: 55 },
      { day: "Çar", right: 140, left: 60 },
      { day: "Per", right: 110, left: 50 },
      { day: "Cum", right: 165, left: 70 },
      { day: "Cmt", right: 190, left: 80 },
      { day: "Paz", right: 170, left: 75 },
    ],
    reviews: [
      { user: "Ahmet Y.", stars: 5, text: "Muhteşem lezzetler! Özellikle köfte tabağı harikaydı. Kesinlikle tekrar geleceğim.", date: "2 saat önce" },
      { user: "Elif K.", stars: 4, text: "Ambiyans çok güzel, servis hızlı. Fiyatlar biraz yüksek ama kalite var.", date: "1 gün önce" },
      { user: "Mert S.", stars: 5, text: "Şehirdeki en iyi mekan! Personel çok ilgili ve yemekler şahane.", date: "2 gün önce" },
      { user: "Zeynep A.", stars: 3, text: "Yemekler güzeldi ama bekleme süresi uzundu. İyileştirme gerekli.", date: "3 gün önce" },
      { user: "Can B.", stars: 5, text: "Arkadaşlarımla harika bir akşam geçirdik. Tatlılar enfes!", date: "5 gün önce" },
    ],
  };

  const maxBar = Math.max(...stats.weeklyData.map(d => d.right + d.left));

  return (
    <Screen grad={false}>
      <div style={{ height: "100%", background: "#0f0f0f", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ background: GRAD, padding: "44px 20px 24px", borderBottomLeftRadius: 32, borderBottomRightRadius: 32, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Btn
              text="Çıkış" onClick={() => setShowLogout(true)}
              variant="outline" size="sm" fullWidth={false}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>}
            />
            <GurLogo size={42} pill />
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "6px 12px", backdropFilter: "blur(8px)" }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#fff", fontWeight: 700 }}>İŞLETME PANELİ</span>
            </div>
          </div>

          {/* Restoran bilgisi */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="plate" color="#fff" size={22} /></div>
            <div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 3px" }}>{ownerRestaurant?.name || "Restoranınız"}</h2>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{ownerRestaurant?.addr || "Kadıköy, İstanbul"} • Aktif</p>
            </div>
          </div>

          {/* Puan badge */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)" }}>
<Icon n="star" color="#fff" size={18} />
              <div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>{stats.avgRating}</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.6)", margin: 0 }}>Ortalama Puan</p>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)" }}>
<Icon n="chat" color="#fff" size={18} />
              <div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>{stats.totalReviews}</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.6)", margin: 0 }}>Toplam Yorum</p>
              </div>
            </div>
            <div style={{ background: "rgba(76,175,80,0.2)", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 14, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
<Icon n="flame" color="#4CAF50" size={18} />
              <div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#4CAF50", margin: 0, lineHeight: 1 }}>%{stats.favRate}</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(76,175,80,0.7)", margin: 0 }}>Beğeni Oranı</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 16px 40px" }}>
          {/* Tab seçici */}
          <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { id: "stats", label: "İstatistikler" },
              { id: "reviews", label: "Yorumlar" },
              { id: "menu", label: "Menü" },
              { id: "photos", label: "Fotoğraflar" },
              { id: "growth", label: "Büyüme" },
            ].map(tab => (
              <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: "13px 8px", textAlign: "center", cursor: "pointer",
                background: activeTab === tab.id ? "rgba(255,102,0,0.15)" : "transparent",
                borderBottom: activeTab === tab.id ? "2px solid #FF6600" : "2px solid transparent",
                transition: "all 0.25s",
              }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: activeTab === tab.id ? 700 : 500, color: activeTab === tab.id ? "#FF6600" : "rgba(255,255,255,0.4)" }}>
                  {tab.label}
                </span>
              </div>
            ))}
          </div>

          {/* ─── TAB: İstatistikler ─── */}
          {activeTab === "stats" && (
            <div>
              {/* Büyük stat kartları */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {/* Sağ kaydırma */}
                <div style={{ background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.15)", borderRadius: 20, padding: "18px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
<div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(76,175,80,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="heart" color="#4CAF50" size={16} /></div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(76,175,80,0.8)", fontWeight: 600 }}>Sağ Kaydırma</span>
                  </div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: "#4CAF50", margin: "0 0 2px" }}>{stats.swipeRight}</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>kişi beğendi</p>
                </div>
                {/* Sol kaydırma */}
                <div style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.15)", borderRadius: 20, padding: "18px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
<div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,59,48,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="cross" color="#FF3B30" size={16} /></div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,59,48,0.8)", fontWeight: 600 }}>Sol Kaydırma</span>
                  </div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: "#FF3B30", margin: "0 0 2px" }}>{stats.swipeLeft}</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>kişi geçti</p>
                </div>
              </div>

              {/* Toplam görüntülenme */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
<div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,165,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="eye" color="#FFA500" size={18} /></div>
                  <div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 2px" }}>Toplam Görüntülenme</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>{stats.totalViews.toLocaleString()}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#4CAF50", fontWeight: 700 }}>↑ 12%</span>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>bu hafta</p>
                </div>
              </div>

              {/* Haftalık grafik */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 16px", marginBottom: 20 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 16px" }}>Haftalık Kaydırma Grafiği</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, paddingBottom: 24, position: "relative" }}>
                  {stats.weeklyData.map((d, i) => {
                    const totalH = ((d.right + d.left) / maxBar) * 100;
                    const rightH = (d.right / (d.right + d.left)) * totalH;
                    const leftH = totalH - rightH;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                        <div style={{ width: "100%", display: "flex", flexDirection: "column", borderRadius: 8, overflow: "hidden" }}>
                          <div style={{ height: leftH * 0.96, background: "rgba(255,59,48,0.4)", transition: "height 0.5s ease-out", transitionDelay: `${i * 0.05}s` }} />
                          <div style={{ height: rightH * 0.96, background: "rgba(76,175,80,0.6)", transition: "height 0.5s ease-out", transitionDelay: `${i * 0.05}s` }} />
                        </div>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(76,175,80,0.6)" }} />
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Beğeni</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(255,59,48,0.4)" }} />
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Geçme</span>
                  </div>
                </div>
              </div>

              {/* Puan dağılımı */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 16px" }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 14px" }}>Puan Dağılımı</p>
                {[
                  { stars: 5, count: 18, pct: 47 },
                  { stars: 4, count: 11, pct: 29 },
                  { stars: 3, count: 5, pct: 13 },
                  { stars: 2, count: 2, pct: 5 },
                  { stars: 1, count: 2, pct: 5 },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 4 ? 8 : 0 }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", width: 14, textAlign: "right" }}>{r.stars}</span>
                    <span style={{ fontSize: 12, color: "#FFA500" }}>★</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ width: `${r.pct}%`, height: "100%", borderRadius: 4, background: r.stars >= 4 ? "rgba(76,175,80,0.5)" : r.stars === 3 ? "rgba(255,165,0,0.5)" : "rgba(255,59,48,0.4)", transition: "width 0.6s ease-out", transitionDelay: `${i * 0.1}s` }} />
                    </div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", width: 28, textAlign: "right" }}>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TAB: Yorumlar ─── */}
          {activeTab === "reviews" && (
            <div>
              {stats.reviews.map((rev, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 20, padding: "16px 18px", marginBottom: 12,
                  animation: `fadeInUp 0.4s ease-out ${i * 0.07}s both`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: "#FF6600", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 800 }}>
                        {rev.user.charAt(0)}
                      </div>
                      <div>
                        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{rev.user}</p>
                        <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} style={{ fontSize: 11, color: s <= rev.stars ? "#FFA500" : "rgba(255,255,255,0.12)" }}>★</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{rev.date}</span>
                  </div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>{rev.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* ─── TAB: Menü Yönetimi ─── */}
          {activeTab === "menu" && (
            <div>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>Menü görsellerinizi buradan yükleyin. Kullanıcılar restoranınızın menüsünü bu görseller üzerinden görecektir.</p>
              </div>

              {/* Yüklü menüler */}
              {menuUploads.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                  {menuUploads.map((file, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", animation: `fadeInUp 0.3s ease-out ${i * 0.05}s both` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,102,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
<Icon n="doc" color="#FF6600" size={18} />
                        </div>
                        <div>
                          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", margin: "0 0 2px" }}>{file.name}</p>
                          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0 }}>Menü sayfası {i + 1}</p>
                        </div>
                      </div>
                      <IconBtn
                        onClick={() => setMenuUploads(p => { if (p[i]?.url) URL.revokeObjectURL(p[i].url); return p.filter((_, idx) => idx !== i); })}
                        tone="dangerSoft" shape="rounded" size={32} title="Menüyü kaldır"
                        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Yükleme alanı */}
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "28px 16px", borderRadius: 20, border: "2px dashed rgba(255,102,0,0.25)", background: "rgba(255,102,0,0.04)", cursor: "pointer" }}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{ display: "none" }} onChange={e => { const files = toMediaFiles(e.target.files); setMenuUploads(p => [...p, ...files]); e.target.value = ""; }} />
                <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,102,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#FF6600", margin: 0 }}>Menü Görseli Yükle</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>PDF veya fotoğraf (JPG, PNG)</p>
              </label>

              {menuUploads.length > 0 && (
                <div style={{ background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.15)", borderRadius: 16, padding: "12px 16px", marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
<Icon n="check" color="#4CAF50" size={16} />
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(76,175,80,0.8)", margin: 0 }}>{menuUploads.length} menü sayfası yüklendi</p>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: Büyüme (gelir ürünleri) ─── */}
          {activeTab === "growth" && (
            <div>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>
                  Görünürlüğünüzü artıran ve doğrudan gelir getiren paketler. Platform bunların bir kısmında işlem başına komisyon alır.
                </p>
              </div>

              {/* Faz 1 — reklam / sponsorluk */}
              <GrowthSection title="Reklam ve Sponsorluk" phase="Faz 1">
                <GrowthCard
                  title="Keşfet Banner'ı" price="₺2.400 / hafta" active={bought.featured}
                  desc="Keşfet ekranının üstündeki dönen banner'da bir slayt. Haftada ~4.000 gösterim."
                  onBuy={() => buy("featured", "Banner slaytınız yayına alındı")}
                />
                <GrowthCard
                  title="Ödüllü Video Reklam" price="₺3.100 / 1.000 izlenme" active={bought.rewarded}
                  desc="Kullanıcı kaydırma hakkı kazanmak için videonuzu sonuna kadar izler — tamamlanma oranı ~%78."
                  onBuy={() => buy("rewarded", "Ödüllü video kampanyası başlatıldı")}
                />
                <GrowthCard
                  title="Push Bildirim Reklamı" price="₺1.800 / gönderim" active={bought.push} locked={!sponsorOn}
                  desc="Semtinizdeki kullanıcılara tek seferlik bildirim. Gönderim saatini siz seçersiniz."
                  onBuy={() => buy("push", "Push bildirim gönderimi planlandı")}
                />
              </GrowthSection>

              {/* Faz 2 — performans ve işlem */}
              <GrowthSection title="Anlık Fırsat ve Rezervasyon" phase="Faz 2" locked={!dealsOn && !bookingOn}>
                {dealsOn ? (
                  <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 18, padding: "16px 18px", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>Anlık İndirim Yayınla</p>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4ADE80" }}>₺450 / yayın</span>
                    </div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.5 }}>
                      Ölü saatlerinizi doldurun: yakındaki kullanıcılara süreli indirim bildirimi gider.
                    </p>

                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 7px" }}>İndirim oranı</p>
                    <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
                      {[10, 15, 20, 25, 30].map(v => (
                        <DarkChip key={v} label={`%${v}`} active={dealPct === v} onClick={() => setDealPct(v)} />
                      ))}
                    </div>

                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 7px" }}>Süre</p>
                    <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
                      {[1, 2, 3, 4].map(v => (
                        <DarkChip key={v} label={`${v} saat`} active={dealHours === v} onClick={() => setDealHours(v)} />
                      ))}
                    </div>

                    {dealLive ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(34,197,94,0.12)", borderRadius: 14, padding: "11px 14px" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", animation: "pulse 1.6s ease-in-out infinite", flexShrink: 0 }} />
                        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "#4ADE80", margin: 0, flex: 1 }}>
                          %{dealPct} indirim {dealHours} saat boyunca yayında
                        </p>
                        <Btn text="Durdur" onClick={() => setDealLive(false)} variant="destructiveSoft" size="sm" fullWidth={false} />
                      </div>
                    ) : (
                      <Btn text={`%${dealPct} indirimi ${dealHours} saat yayınla`} onClick={() => { setDealLive(true); setNotice("Fırsat yayında — yakındaki kullanıcılara bildirim gitti"); setTimeout(() => setNotice(null), 2200); }} variant="filled" />
                    )}
                  </div>
                ) : (
                  <LockedCard text="Kullanıcı kitlesi hedefe ulaşınca açılır." />
                )}

                {bookingOn ? (
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "16px 18px" }}>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Rezervasyon ve Tadım Menüsü</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.5 }}>
                      Kullanıcı uygulamadan masa ayırtır veya tadım menüsü satın alır. Komisyon yalnızca gerçekleşen işlemden alınır.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {[["Bu ay", "38"], ["Ciro", "₺52.400"], ["Komisyon", "₺4.192"]].map(([k, v]) => (
                        <div key={k} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "11px 12px" }}>
                          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.4)", margin: "0 0 3px" }}>{k}</p>
                          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </GrowthSection>

              {/* Faz 3 — B2B */}
              <GrowthSection title="İçerik Lisansı ve Analiz" phase="Faz 3" locked={!licenseOn && !saasOn}>
                <GrowthCard
                  title="Gastro Video Lisansı" price="₺6.500 / video" active={bought.license} locked={!licenseOn}
                  desc="Şefin çektiği 15 sn dikey videoyu kendi sosyal medya hesaplarınızda süresiz kullanma hakkı."
                  onBuy={() => buy("license", "Video lisansı satın alındı")}
                />
                <GrowthCard
                  title="Analiz Paneli" price="₺2.900 / ay" active={bought.saas} locked={!saasOn}
                  desc="Tıklama, kaydetme ve konum bazlı ilgi verisi; rakip semt kıyaslaması ve haftalık rapor."
                  onBuy={() => buy("saas", "Analiz Paneli aboneliği başlatıldı")}
                />
              </GrowthSection>
            </div>
          )}

          {/* ─── TAB: Fotoğraf Yönetimi ─── */}
          {activeTab === "photos" && (
            <div>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>Mekan ve yemek fotoğraflarınızı yükleyin. Kaliteli görseller müşteri ilgisini %70 artırır!</p>
              </div>

              {/* Yüklü fotoğraflar — grid */}
              {photoUploads.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {photoUploads.map((file, i) => (
                    <div key={i} style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "1", animation: `fadeInUp 0.3s ease-out ${i * 0.05}s both` }}>
                      <img src={file.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", top: 4, right: 4 }}>
                        <IconBtn
                          onClick={() => setPhotoUploads(p => { if (p[i]?.url) URL.revokeObjectURL(p[i].url); return p.filter((_, idx) => idx !== i); })}
                          tone="glassDark" shape="rounded" size={26} title="Fotoğrafı kaldır"
                          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Yükleme alanı */}
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "28px 16px", borderRadius: 20, border: "2px dashed rgba(255,102,0,0.25)", background: "rgba(255,102,0,0.04)", cursor: "pointer" }}>
                <input type="file" accept=".jpg,.jpeg,.png,.webp" multiple style={{ display: "none" }} onChange={e => { const files = toMediaFiles(e.target.files); setPhotoUploads(p => [...p, ...files]); e.target.value = ""; }} />
                <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,102,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#FF6600", margin: 0 }}>Fotoğraf Yükle</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>JPG, PNG, WEBP</p>
              </label>

              {/* İpuçları */}
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 16px", marginTop: 16 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 8px" }}>Fotoğraf Önerileri</p>
                {["Mekan iç görünümü (ambiyans)", "Dış cephe (bulunabilirlik)", "En popüler 2-3 yemek", "Servis ve sunum detayları"].map((tip, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 3 ? 5 : 0 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>{tip}</p>
                  </div>
                ))}
              </div>

              {photoUploads.length > 0 && (
                <div style={{ background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.15)", borderRadius: 16, padding: "12px 16px", marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
<Icon n="check" color="#4CAF50" size={16} />
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(76,175,80,0.8)", margin: 0 }}>{photoUploads.length} fotoğraf yüklendi — keşif kartınızda ilk sırada gösteriliyor</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Büyüme sekmesi bildirimi */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            style={{
              position: "absolute", left: 16, right: 16, bottom: 22, zIndex: 200,
              background: "#22C55E", borderRadius: 16, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 9, boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
            }}>
            <Icon n="check" size={15} color="#fff" />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{notice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Çıkış onay modalı — perde soluklaşarak, kart "materialize" olarak (opaklık+ölçek birlikte) belirir */}
      <AnimatePresence>
        {showLogout && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 30,
            }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              style={{
                background: "#1a1a1a", borderRadius: 24, padding: "30px 24px 24px",
                width: "100%", maxWidth: 320, border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: "rgba(255,59,48,0.1)", margin: "0 auto 16px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Çıkış Yap</h3>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.5 }}>
                  İşletme panelinden çıkış yapmak istediğinize emin misiniz?
                </p>
              </div>

              <div style={{ marginBottom: 10 }}>
                <Btn text="Evet, Çıkış Yap" onClick={onLogout} variant="destructive" />
              </div>
              <Btn text="Vazgeç" onClick={() => setShowLogout(false)} variant="outline" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </Screen>
  );
}

// ═══════════════════════════════════════════════
// KEŞFET SAYFASI — 4 rastgele kategori + tüm kategoriler sayfası
// ═══════════════════════════════════════════════
// Keşfet üstündeki dönen banner: marka slaytı ile sponsor slaytları
// sırayla döner. Reklam slaytları her zaman "REKLAM" etiketi taşır.
function HeroCarousel({ slides, intervalMs = 4500 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setTimeout(() => setI(v => (v + 1) % slides.length), intervalMs);
    return () => clearTimeout(t);
  }, [i, slides.length, intervalMs]);

  const slide = slides[i] || slides[0];
  if (!slide) return null;

  return (
    <div style={{ borderRadius: 24, overflow: "hidden", marginBottom: 18, height: 148, position: "relative", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", flexShrink: 0 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Img src={slide.img} style={{ position: "absolute", inset: 0 }} bg={slide.accent || "#2c1810"} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 60%)" }} />
          {slide.ad && (
            <span style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "2px 7px", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: 0.5 }}>REKLAM</span>
          )}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "18px 18px 22px" }}>
            {slide.eyebrow && (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>{slide.eyebrow}</p>
            )}
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, color: "#fff", margin: "0 0 3px", fontWeight: 800, textShadow: "0 2px 10px rgba(0,0,0,0.45)" }}>{slide.title}</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0 }}>{slide.sub}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slayt göstergeleri */}
      {slides.length > 1 && (
        <div style={{ position: "absolute", bottom: 10, right: 14, display: "flex", gap: 5, zIndex: 3 }}>
          {slides.map((sl, k) => (
            <div key={sl.id} onClick={() => setI(k)} style={{
              width: k === i ? 16 : 6, height: 6, borderRadius: 3, cursor: "pointer",
              background: k === i ? "#fff" : "rgba(255,255,255,0.45)", transition: "all 0.3s",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExploreScreen({ onCategoryTap, onSwipe, onFavorites, onProfile, onMatch, restaurants = [], onDetail }) {
  const adsOn = useFeature("bannerAds");
  const dealsOn = useFeature("instantDeals");
  // Marka slaytı her zaman ilk sırada; sponsor slaytları faz açıksa eklenir
  const slides = useMemo(() => [
    { id: "brand", img: I.hero, title: "İstanbul'un Lezzetleri", sub: "En popüler restoranları keşfet" },
    ...(adsOn ? BANNER_ADS.map(a => ({
      id: a.id, img: a.img, accent: a.accent, ad: true,
      eyebrow: a.brand, title: a.text, sub: a.cta,
    })) : []),
  ], [adsOn]);
  // Yalnızca destede gerçekten bulunan restoranların fırsatları gösterilir
  const liveDeals = dealsOn
    ? DEALS.map(d => ({ ...d, r: restaurants.find(x => x.id === d.restaurantId) })).filter(d => d.r)
    : [];
  const [showAll, setShowAll] = useState(false);
  const [randomCats] = useState(() => {
    const shuffled = [...CATEGORIES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  });

  // Tüm Kategoriler overlay
  if (showAll) {
    return (
      <Screen>
        <div style={{ padding: "44px 16px 30px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <IconBtn
              onClick={() => setShowAll(false)} tone="subtle" title="Geri"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D2419" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>}
            />
            <GurLogo size={42} pill />
            <div style={{ width: 38 }} />
          </div>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 800, color: "#2D2419", margin: "0 0 6px", textAlign: "center" }}>Tüm Kategoriler</h2>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(45,36,25,0.55)", textAlign: "center", marginBottom: 24 }}>{CATEGORIES.length} mutfak türü</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {CATEGORIES.map((c, i) => (
              <div key={i} onClick={() => onCategoryTap(c.name)} style={{
                borderRadius: 22, overflow: "hidden", height: 130, position: "relative", cursor: "pointer",
                transition: "transform 0.15s", boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                animation: `fadeInUp 0.35s ease-out ${i * 0.04}s both`,
              }}
                onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
                onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                <Img src={c.img} style={{ position: "absolute", inset: 0 }} bg="#d4c8bc" />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.05) 55%)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px" }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>{c.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Screen>
    );
  }

  // Ana keşfet ekranı — 4 rastgele kategori
  return (
    <Screen>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "44px 16px 0" }}>

        {/* Logo + profil */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative", animation: "fadeInUp 0.6s ease-out" }}>
          <GurLogo size={42} pill />
          <div style={{ position: "absolute", right: 0 }}>
            <IconBtn onClick={onProfile} tone="solidLight" size={40} title="Profil">
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#FF6600", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 800 }}>B</div>
            </IconBtn>
          </div>
        </div>

        {/* Dönen banner — marka slaytı + sponsor reklamları, ekranın en üstünde */}
        <HeroCarousel slides={slides} />

        {/* Anlık fırsatlar — Faz 2 (konum bazlı süreli indirim) */}
        {liveDeals.length > 0 && (
          <div style={{ marginBottom: 16, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: "#2D2419", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", animation: "pulse 1.6s ease-in-out infinite" }} />
                Şu an yakınında
              </p>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(45,36,25,0.45)" }}>{liveDeals.length} fırsat</span>
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
              {liveDeals.map(d => (
                <motion.div
                  key={d.restaurantId} onClick={() => onDetail?.(d.r)}
                  whileTap={{ scale: 0.97 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  style={{ flexShrink: 0, width: 178, borderRadius: 18, overflow: "hidden", position: "relative", height: 96, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.1)" }}>
                  <Img src={d.r.imgs[0]} style={{ position: "absolute", inset: 0 }} bg="#2c1810" />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.15))" }} />
                  <div style={{ position: "absolute", top: 8, left: 8, background: "#22C55E", borderRadius: 8, padding: "3px 8px" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 800, color: "#fff" }}>%{d.pct}</span>
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 10px" }}>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 700, color: "#fff", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.r.name}</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.75)", margin: 0 }}>{formatCountdown(d.minutesLeft)} kaldı</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* GUR Match girişi */}
        <motion.div
          onClick={onMatch}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 16, cursor: "pointer",
            background: "linear-gradient(100deg, #FF6600, #FF3B30)", borderRadius: 18, padding: "12px 14px",
            boxShadow: "0 6px 20px rgba(255,69,0,0.28)", flexShrink: 0,
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 13, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon n="sparkle" size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, fontWeight: 800, color: "#fff", margin: "0 0 2px" }}>GUR Match</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.8)", margin: 0 }}>Arkadaşınla birlikte kaydır, birlikte karar ver</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
        </motion.div>

        {/* Başlık */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: "#2D2419", margin: 0 }}>Senin İçin Öneriler</h3>
        </div>

        {/* 4 Rastgele Kategori — 2x2 grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1, minHeight: 0 }}>
          {randomCats.map((c, i) => (
            <div key={c.name} onClick={() => onCategoryTap(c.name)} style={{
              borderRadius: 20, overflow: "hidden", position: "relative", cursor: "pointer",
              transition: "transform 0.15s", boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              animation: `fadeInUp 0.4s ease-out ${i * 0.08}s both`,
            }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
              <Img src={c.img} style={{ position: "absolute", inset: 0 }} bg="#d4c8bc" />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.05) 55%)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 14px" }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 800, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>{c.name}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tüm Kategoriler butonu */}
        <div onClick={() => setShowAll(true)} style={{
          margin: "14px 0", background: "#fff", borderRadius: 20, padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          transition: "transform 0.15s",
        }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(255,102,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
            </div>
            <div>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#333", margin: 0 }}>Tüm Kategoriler</p>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#aaa", margin: 0 }}>{CATEGORIES.length} mutfak türü</p>
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </div>

        {/* Alt bar — beyaz, sabit */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", background: "#fff", borderRadius: 24, padding: "10px 8px", margin: "0 0 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF6600" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF6600", fontWeight: 700 }}>Keşfet</span>
          </div>
          <div onClick={onSwipe} style={{ cursor: "pointer" }}><GurLogo size={24} pill /></div>
          <div onClick={onFavorites} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px", cursor: "pointer", opacity: 0.4 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF3B30", fontWeight: 700 }}>Favoriler</span>
          </div>
        </div>

      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// KAYDIRMA (Swipe) SAYFASI — Temiz, profesyonel
// ═══════════════════════════════════════════════
// ── Ödüllü video reklam ──────────────────────────────────────────────────
// Geri sayım bitmeden kapatılamaz; bitince ödül verilir. Süre boyunca
// ilerleme çubuğu doluyor, kullanıcı ne kadar kaldığını görüyor.
function RewardedAdOverlay({ ad, onComplete, onAbort }) {
  const [left, setLeft] = useState(AD_DURATION);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const done = left <= 0;
  const pct = ((AD_DURATION - left) / AD_DURATION) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ position: "absolute", inset: 0, zIndex: 400, background: "#0a0500", display: "flex", flexDirection: "column" }}
    >
      {/* Video alanı */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${ad.accent}, #0a0500)` }} />
        <Img src={ad.img} style={{ position: "absolute", inset: 0, opacity: 0.45 }} bg="transparent" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 55%)" }} />

        {/* Üst şerit: reklam etiketi + geri sayım */}
        <div style={{ position: "absolute", top: 44, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
          <span style={{ background: "rgba(255,255,255,0.16)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 20, padding: "4px 11px", fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 800, color: "#fff", letterSpacing: 0.6 }}>REKLAM</span>
          {done ? (
            <IconBtn onClick={onComplete} tone="glassLight" size={32} title="Kapat"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
          ) : (
            <span style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "5px 13px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontVariantNumeric: "tabular-nums" }}>{left} sn</span>
          )}
        </div>

        {/* Oynatma göstergesi */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
          <div style={{ width: 62, height: 62, borderRadius: "50%", background: "rgba(255,255,255,0.14)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)"><polygon points="6 3 20 12 6 21" /></svg>
          </div>
        </div>

        {/* Marka bilgisi */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 20px 22px", zIndex: 5 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 800, color: "rgba(255,255,255,0.75)", margin: "0 0 4px" }}>{ad.brand}</p>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 19, fontWeight: 800, color: "#fff", margin: "0 0 6px", lineHeight: 1.25 }}>{ad.headline}</h3>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.6)", margin: "0 0 14px" }}>{ad.tagline}</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", borderRadius: 999, padding: "9px 18px" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: ad.accent }}>{ad.cta}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ad.accent} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        </div>

        {/* İlerleme */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.12)", zIndex: 6 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#FF6600", transition: "width 1s linear" }} />
        </div>
      </div>

      {/* Alt eylem */}
      <div style={{ padding: "16px 20px 22px", background: "#0a0500" }}>
        {done ? (
          <Btn text={`+${REWARD_SWIPES} kaydırma hakkı al`} onClick={onComplete} variant="filled" icon={<Icon n="check" size={15} color="#fff" />} />
        ) : (
          <>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.45)", textAlign: "center", margin: "0 0 10px" }}>
              Reklam bitince {REWARD_SWIPES} kaydırma hakkı kazanacaksın
            </p>
            <Btn text="Vazgeç" onClick={onAbort} variant="plain" size="sm" />
          </>
        )}
      </div>
    </motion.div>
  );
}

// Kaydırma hakkı bitince çıkan kapı
function SwipeGate({ onWatch, onExplore }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ position: "absolute", inset: 0, zIndex: 350, background: "rgba(10,5,0,0.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        style={{ width: "100%", textAlign: "center" }}
      >
        <div style={{ width: 74, height: 74, borderRadius: "50%", background: "rgba(255,102,0,0.14)", border: "1px solid rgba(255,102,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <Icon n="clock" size={28} color="#FFA500" />
        </div>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 19, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Kaydırma hakkın bitti</h3>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, color: "rgba(255,255,255,0.55)", margin: "0 0 22px", lineHeight: 1.55 }}>
          Kısa bir reklam izle, <b style={{ color: "#FFA500" }}>{REWARD_SWIPES} kaydırma hakkı</b> daha kazan.
        </p>
        <Btn text={`Reklam izle • +${REWARD_SWIPES} hak`} onClick={onWatch} variant="filled"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21" /></svg>} />
        <div style={{ marginTop: 10 }}>
          <Btn text="Keşfete dön" onClick={onExplore} variant="plain" size="sm" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function SwipeScreen({ onDetail, onExplore, onFavorites, favorites, setFavorites, filterCat, restaurants = RESTAURANTS, dataSource = "demo" }) {
  const rewardOn = useFeature("rewardedAds");
  const secondChanceOn = useFeature("secondChance");

  const allCards = filterCat ? restaurants.filter(r => r.cat === filterCat || r.tags.includes(filterCat)) : restaurants;

  const [idx, setIdx] = useState(0);
  const [toast, setToast] = useState(null);
  const [done, setDone] = useState(false);
  // Faz 2 — "İkinci Şans": geçilen restoranlar deste bitince tekrar önerilir
  const [passed, setPassed] = useState([]);
  const [encore, setEncore] = useState(null); // {cards, idx} | null
  const topCardRef = useRef(null);

  const show = (m, t) => { setToast({ m, t }); setTimeout(() => setToast(null), 1400); };

  // Faz 1 — kaydırma kotası + ödüllü reklam
  const [swipesLeft, setSwipesLeft] = useState(FREE_SWIPES);
  const [gate, setGate] = useState(false);        // hak bitti kapısı
  const [playingAd, setPlayingAd] = useState(null);
  const [adIdx, setAdIdx] = useState(0);
  const outOfSwipes = rewardOn && swipesLeft <= 0;

  const watchAd = () => { setPlayingAd(REWARD_ADS[adIdx % REWARD_ADS.length]); setGate(false); };
  const finishAd = () => {
    setPlayingAd(null);
    setAdIdx(i => i + 1);
    setSwipesLeft(v => v + REWARD_SWIPES);
    show(`+${REWARD_SWIPES} kaydırma hakkı kazandın`, "fav");
  };
  const abortAd = () => { setPlayingAd(null); setGate(true); };

  useEffect(() => { setIdx(0); setDone(false); setPassed([]); setEncore(null); }, [filterCat, restaurants]);

  const deck = encore ? encore.cards : allCards;
  const cursor = encore ? encore.idx : idx;
  const visible = deck.slice(cursor, cursor + 2).reverse();

  const next = () => {
    // Her kaydırma bir hak yer; hak biterse kapı açılır (Faz 1)
    if (rewardOn) {
      setSwipesLeft(v => {
        const left = v - 1;
        if (left <= 0) setGate(true);
        return Math.max(0, left);
      });
    }
    if (encore) {
      if (encore.idx >= encore.cards.length - 1) { setEncore(null); setDone(true); }
      else setEncore(e => ({ ...e, idx: e.idx + 1 }));
      return;
    }
    if (idx >= allCards.length - 1) {
      // Deste bitti: geçilenler varsa ikinci şans turu başlar
      if (secondChanceOn && passed.length > 0) {
        setEncore({ cards: passed, idx: 0 });
        setPassed([]);
        show("İkinci şans: geçtiğin yerler", "fav");
      } else setDone(true);
    } else setIdx(i => i + 1);
  };

  const right = () => {
    const r = deck[cursor];
    if (r && !favorites.find(f => f.id === r.id)) setFavorites(p => [...p, r]);
    show(r?.name + " favorilere eklendi!", "fav");
    next();
  };
  const left = () => {
    const r = deck[cursor];
    if (r && !encore) setPassed(p => (p.find(x => x.id === r.id) ? p : [...p, r]));
    show("Geçildi", "nope");
    next();
  };

  const progress = deck.length > 0 ? ((cursor + (done ? 1 : 0)) / deck.length) * 100 : 0;

  return (
    <Screen grad={false}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#000" }}>

        {/* Header — sadece logo ortada + kategori filtresi */}
        <div style={{ padding: "44px 18px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <GurLogo size={42} pill />
          {/* Kalan kaydırma hakkı — Faz 1 kotası */}
          {rewardOn && !done && deck.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: swipesLeft <= 3 ? "rgba(255,102,0,0.16)" : "rgba(255,255,255,0.07)", border: `1px solid ${swipesLeft <= 3 ? "rgba(255,165,0,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: 14, padding: "4px 13px" }}>
              <Icon n="flame" size={12} color={swipesLeft <= 3 ? "#FFA500" : "rgba(255,255,255,0.5)"} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 700, color: swipesLeft <= 3 ? "#FFA500" : "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" }}>
                {swipesLeft} kaydırma hakkı
              </span>
            </div>
          )}
          {dataSource === "live" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(76,175,80,0.12)", border: "1px solid rgba(76,175,80,0.25)", borderRadius: 12, padding: "3px 12px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50", animation: "pulse 1.5s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#4CAF50", fontWeight: 600 }}>Canlı Veri • OpenStreetMap</span>
            </div>
          )}
          {filterCat && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#fff", background: "rgba(255,102,0,0.2)", borderRadius: 14, padding: "5px 16px", fontWeight: 600, border: "1px solid rgba(255,102,0,0.25)" }}>{filterCat}</span>
              <IconBtn
                onClick={onExplore} tone="glassLight" shape="rounded" size={26} title="Filtreyi kaldır"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
              />
            </div>
          )}
          {/* Progress bar */}
          {deck.length > 0 && !done && (
            <div style={{ width: "60%", height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", borderRadius: 2, background: "#FF6600", transition: "width 0.4s ease-out" }} />
            </div>
          )}
        </div>

        {/* Swipe alanı */}
        <div style={{ flex: 1, position: "relative", margin: "0 16px 8px", minHeight: 0 }}>
          {deck.length === 0 ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
<div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon n="search" color="rgba(255,255,255,0.4)" size={20} />
              </div>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>Restoran bulunamadı</p>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Bu kategoride henüz restoran yok</p>
              <div style={{ marginTop: 8 }}>
                <Btn text="← Keşfete Dön" onClick={onExplore} variant="plain" size="sm" fullWidth={false} />
              </div>
            </div>
          ) : done ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
<div style={{ width: 90, height: 90, borderRadius: "50%", background: "rgba(255,102,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon n="plate" color="#FF6600" size={30} />
              </div>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", textAlign: "center" }}>Hepsini gördün!</p>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
                {favorites.length > 0 ? `${favorites.length} favori eklendi` : "Henüz favori eklemedin"}
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <Btn text="Tekrar Keşfet" onClick={() => { setIdx(0); setDone(false); }} variant="filled" size="md" fullWidth={false} />
                <Btn text="Kategoriler" onClick={onExplore} variant="outline" size="md" fullWidth={false} />
              </div>
            </div>
          ) : visible.map((r, i) => {
            const top = i === visible.length - 1;
            return <SwipeCard key={`${r.id}-${cursor}`} ref={top ? topCardRef : null} r={r} isTop={top && !outOfSwipes} onRight={right} onLeft={left}
              onTap={() => onDetail(deck[cursor])} />;
          })}
        </div>

        {/* Aksiyon butonları — kartı sürüklemekle aynı fiziksel çıkışı tetikler */}
        {!done && deck.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, padding: "10px 16px 16px", zIndex: 10 }}>
            <IconBtn
              onClick={() => (outOfSwipes ? setGate(true) : topCardRef.current?.fling(-1))} tone="solidLight" size={56} title="Geç"
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
            />

            <IconBtn
              onClick={() => onDetail(deck[cursor])} tone="solidLight" size={40} title="Detay"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4FC3F7" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>}
            />

            <IconBtn
              onClick={() => (outOfSwipes ? setGate(true) : topCardRef.current?.fling(1))} tone="solidLight" size={68} title="Favorilere ekle"
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="#22C55E" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>}
            />
          </div>
        )}

        {/* Kaydırma kapısı ve ödüllü reklam — Faz 1 */}
        <AnimatePresence>
          {gate && !playingAd && <SwipeGate onWatch={watchAd} onExplore={onExplore} />}
          {playingAd && <RewardedAdOverlay ad={playingAd} onComplete={finishAd} onAbort={abortAd} />}
        </AnimatePresence>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "absolute", top: 120, left: "50%", transform: "translateX(-50%)",
            background: toast.t === "fav" ? "#4CAF50" : "#FF3B30",
            color: "#fff", padding: "10px 22px", borderRadius: 16,
            fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700,
            zIndex: 100, boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            animation: "fadeInUp 0.3s ease-out",
            display: "flex", alignItems: "center", gap: 8,
          }}>
{toast.t === "fav" ? <Icon n="heart" color="#fff" size={16} /> : <Icon n="cross" color="#fff" size={16} />}
            {toast.m}
          </div>
        )}

        {/* Alt bar — beyaz, keşfet sayfası ile aynı */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", background: "#fff", borderRadius: 24, padding: "10px 8px", margin: "0 16px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", flexShrink: 0 }}>
          <div onClick={onExplore} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px", cursor: "pointer", opacity: 0.4 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF6600", fontWeight: 700 }}>Keşfet</span>
          </div>
          <div style={{ cursor: "pointer" }}><GurLogo size={24} pill /></div>
          <div onClick={onFavorites} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px", cursor: "pointer", opacity: 0.4 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF3B30", fontWeight: 700 }}>Favoriler</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// GUR MATCH — Arkadaşınla birlikte kaydır
// ═══════════════════════════════════════════════
function MatchStartScreen({ onBack, onStart }) {
  const [mode, setMode] = useState(null); // null | "create" | "join"
  const [code] = useState(() => makeInviteCode());
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    try { navigator.clipboard?.writeText(code); } catch { /* pano yoksa sessiz geç */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Screen grad={false}>
      <div style={{ height: "100%", background: "linear-gradient(160deg, #1a0f00, #2b1400 55%, #1a0f00)", display: "flex", flexDirection: "column", padding: "44px 22px 24px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
          <IconBtn onClick={onBack} tone="glassLight" title="Geri"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>} />
          <GurLogo size={42} pill />
          <div style={{ width: 40 }} />
        </div>

        <div style={{ textAlign: "center", marginBottom: 28, animation: "fadeInUp 0.5s ease-out" }}>
          <div style={{ width: 76, height: 76, borderRadius: "50%", background: "rgba(255,102,0,0.14)", border: "1px solid rgba(255,102,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Icon n="sparkle" size={30} color="#FFA500" />
          </div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>GUR Match</h2>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.55 }}>
            Arkadaşınla aynı anda kaydır. İkiniz de sağa kaydırdığınız restoranlar eşleşme olur — nereye gideceğinizi tartışmayın, bırakın kartlar karar versin.
          </p>
        </div>

        {mode === null && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeInUp 0.5s ease-out 0.1s both" }}>
            <Btn text="Yeni oturum başlat" onClick={() => setMode("create")} variant="filled" size="lg" />
            <Btn text="Koda katıl" onClick={() => setMode("join")} variant="outline" size="lg" />
          </div>
        )}

        {mode === "create" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.45)", textAlign: "center", margin: "0 0 12px" }}>Bu kodu arkadaşına gönder</p>
            <div onClick={copy} style={{ background: "rgba(255,255,255,0.06)", border: "1px dashed rgba(255,165,0,0.45)", borderRadius: 20, padding: "22px 16px", textAlign: "center", cursor: "pointer", marginBottom: 16 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, color: "#FFA500", letterSpacing: 6 }}>{code}</span>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: copied ? "#4CAF50" : "rgba(255,255,255,0.35)", margin: "10px 0 0" }}>
                {copied ? "Kopyalandı!" : "Kopyalamak için dokun"}
              </p>
            </div>
            <Btn text={`${friendNameFor(code)} katıldı — Başla`} onClick={() => onStart(code)} variant="filled" size="lg" />
            <div style={{ marginTop: 10 }}>
              <Btn text="Geri" onClick={() => setMode(null)} variant="plain" size="sm" />
            </div>
          </div>
        )}

        {mode === "join" && (
          <div style={{ animation: "fadeInUp 0.4s ease-out" }}>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: "18px 16px 4px", marginBottom: 16 }}>
              <InputField label="Davet kodu" value={joinCode} onChange={v => setJoinCode(v.toUpperCase().slice(0, 6))} placeholder="ÖRN: K7WQ2M" />
            </div>
            <Btn text="Katıl ve kaydırmaya başla" onClick={() => onStart(joinCode)} variant="filled" size="lg" disabled={joinCode.length < 4} />
            <div style={{ marginTop: 10 }}>
              <Btn text="Geri" onClick={() => setMode(null)} variant="plain" size="sm" />
            </div>
          </div>
        )}

        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.22)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
            Demo sürümü — arkadaşın kararları davet kodundan üretilir. Gerçek eş zamanlı oturum için backend gerekir.
          </p>
        </div>
      </div>
    </Screen>
  );
}

function MatchSwipeScreen({ code, restaurants, onExit, onFinish }) {
  const cards = restaurants;
  const friendName = friendNameFor(code);
  const likes = useMemo(() => friendLikes(code, cards.map(c => c.id)), [code, cards]);

  const [idx, setIdx] = useState(0);
  const [matches, setMatches] = useState([]);
  const [popup, setPopup] = useState(null); // eşleşme overlay'i
  const topCardRef = useRef(null);

  const visible = cards.slice(idx, idx + 2).reverse();
  const advance = () => { if (idx >= cards.length - 1) onFinish(matches); else setIdx(i => i + 1); };

  const right = () => {
    const r = cards[idx];
    if (r && likes.has(r.id)) {
      const next = [...matches, r];
      setMatches(next);
      setPopup(r);           // eşleşme: ikisi de sağa kaydırdı
      return;                // kart ilerletme overlay kapanınca
    }
    advance();
  };
  const left = () => advance();

  const closePopup = () => { setPopup(null); advance(); };

  return (
    <Screen grad={false}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0a0500" }}>
        {/* Header */}
        <div style={{ padding: "44px 18px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <IconBtn onClick={onExit} tone="glassLight" size={34} title="Çık"
              icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>} />
            <GurLogo size={42} pill />
            <div style={{ width: 34 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,102,0,0.12)", border: "1px solid rgba(255,165,0,0.28)", borderRadius: 14, padding: "5px 14px" }}>
            <Icon n="sparkle" size={12} color="#FFA500" />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "#FFA500", fontWeight: 700 }}>
              {friendName} ile eşleşiyorsun • {matches.length} eşleşme
            </span>
          </div>
        </div>

        {/* Kartlar — tüketici swipe'ıyla birebir aynı fizik */}
        <div style={{ flex: 1, position: "relative", margin: "10px 16px 8px", minHeight: 0 }}>
          {visible.map((r, i) => {
            const top = i === visible.length - 1;
            return <SwipeCard key={r.id} ref={top ? topCardRef : null} r={r} isTop={top} onRight={right} onLeft={left} onTap={() => {}} />;
          })}
        </div>

        {/* Aksiyonlar */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 22, padding: "10px 16px 20px", zIndex: 10 }}>
          <IconBtn onClick={() => topCardRef.current?.fling(-1)} tone="solidLight" size={56} title="Geç"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
          <IconBtn onClick={() => topCardRef.current?.fling(1)} tone="solidLight" size={68} title="Beğen"
            icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="#22C55E" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>} />
        </div>

        {/* Eşleşme anı */}
        <AnimatePresence>
          {popup && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closePopup}
              style={{ position: "absolute", inset: 0, background: "rgba(10,5,0,0.92)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, cursor: "pointer" }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                style={{ width: "100%", textAlign: "center" }}
              >
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#FFA500", fontWeight: 700, letterSpacing: 3, margin: "0 0 10px" }}>EŞLEŞTİNİZ!</p>
                <div style={{ width: "100%", height: 220, borderRadius: 24, overflow: "hidden", position: "relative", marginBottom: 18, boxShadow: "0 18px 60px rgba(255,102,0,0.25)" }}>
                  <Img src={popup.imgs[0]} style={{ position: "absolute", inset: 0 }} bg="#2c1810" />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent 60%)" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px", textAlign: "left" }}>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{popup.name}</h3>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.65)", margin: 0 }}>{popup.cat} • {popup.dist}</p>
                  </div>
                </div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", margin: "0 0 20px" }}>
                  Sen ve {friendName} ikiniz de beğendiniz
                </p>
                <Btn text="Kaydırmaya devam et" onClick={closePopup} variant="filled" size="md" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Screen>
  );
}

function MatchResultScreen({ code, matches, onDetail, onRestart, onExplore }) {
  const friendName = friendNameFor(code);
  return (
    <Screen>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "44px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, position: "relative" }}>
          <GurLogo size={42} pill />
        </div>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: "#2D2419", margin: "0 0 6px" }}>
            {matches.length > 0 ? `${matches.length} eşleşme!` : "Eşleşme çıkmadı"}
          </h2>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(45,36,25,0.55)", margin: 0 }}>
            {matches.length > 0 ? `${friendName} ile ikinizin de beğendiği yerler` : `${friendName} ile ortak beğeniniz olmadı — tekrar deneyin`}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {matches.map((r, i) => (
            <div key={r.id} onClick={() => onDetail(r)} style={{
              display: "flex", gap: 12, alignItems: "center", background: "#fff", borderRadius: 20, padding: 10, marginBottom: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)", cursor: "pointer", animation: `fadeInUp 0.35s ease-out ${i * 0.05}s both`,
            }}>
              <div style={{ width: 74, height: 74, borderRadius: 16, overflow: "hidden", flexShrink: 0, position: "relative" }}>
                <Img src={r.imgs[0]} style={{ position: "absolute", inset: 0 }} bg="#e8e0d8" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14.5, fontWeight: 800, color: "#2D2419", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</h4>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(45,36,25,0.5)", margin: "0 0 6px" }}>{r.cat} • {r.dist}</p>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,102,0,0.1)", borderRadius: 10, padding: "3px 9px", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#FF6600" }}>
                  <Icon n="sparkle" size={10} color="#FF6600" /> Eşleşme
                </span>
              </div>
            </div>
          ))}
          {matches.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: 12 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(45,36,25,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon n="brokenHeart" size={26} color="rgba(45,36,25,0.3)" />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, padding: "14px 0 18px" }}>
          <Btn text="Yeni oturum" onClick={onRestart} variant="filled" size="md" />
          <Btn text="Keşfete dön" onClick={onExplore} variant="outlineDark" size="md" />
        </div>
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// GELİR: REZERVASYON VE TADIM MENÜSÜ (Faz 2)
// ═══════════════════════════════════════════════
// Kullanıcı keşifle kalmıyor, doğrudan masa ayırtıyor veya uygulamaya
// özel tadım menüsünü satın alıyor. Platform işlem başına komisyon alır;
// komisyon oranı onay ekranında açıkça gösterilir.
const COMMISSION_RATE = 0.08;
const TASTING_MENUS = {
  default: { name: "Şef Tadım Menüsü", courses: 5, price: 1450, note: "Uygulamaya özel, 5 servis" },
};
function tastingMenuFor(r) {
  const base = TASTING_MENUS.default;
  const priceHint = parseInt(String(r.price).replace(/\D/g, ""), 10) || 600;
  return { ...base, price: Math.round((priceHint * 1.9) / 50) * 50 };
}

function Sheet({ title, subtitle, onClose, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{ position: "absolute", inset: 0, background: "rgba(20,14,8,0.55)", backdropFilter: "blur(4px)", zIndex: 320, display: "flex", alignItems: "flex-end" }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxHeight: "88%", overflowY: "auto", background: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: "20px 20px 24px" }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E5E0DA", margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, color: "#2D2419", margin: "0 0 3px" }}>{title}</h3>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(45,36,25,0.55)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</p>
          </div>
          <IconBtn onClick={onClose} tone="subtle" size={34} title="Kapat"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D2419" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <motion.button
      onClick={onClick} className="gur-btn"
      whileTap={{ scale: 0.95 }} transition={{ type: "spring", bounce: 0, duration: 0.25 }}
      style={{
        border: `1.5px solid ${active ? "#FF6600" : "rgba(45,36,25,0.14)"}`,
        background: active ? "rgba(255,102,0,0.08)" : "#fff",
        color: active ? "#FF6600" : "#2D2419",
        borderRadius: 12, padding: "9px 14px", cursor: "pointer", outline: "none",
        fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
      }}>{label}</motion.button>
  );
}

function ReservationSheet({ r, onClose, onConfirm }) {
  const [people, setPeople] = useState(2);
  const [day, setDay] = useState("Bugün");
  const [time, setTime] = useState(null);
  const times = ["18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];
  const deal = dealFor(r.id);

  return (
    <Sheet title="Masa ayırt" subtitle={r.name} onClose={onClose}>
      <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#2D2419", marginBottom: 8 }}>Kişi sayısı</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5, 6].map(n => <Chip key={n} label={n === 6 ? "6+" : String(n)} active={people === n} onClick={() => setPeople(n)} />)}
      </div>

      <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#2D2419", marginBottom: 8 }}>Gün</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {["Bugün", "Yarın", "Cumartesi"].map(d => <Chip key={d} label={d} active={day === d} onClick={() => setDay(d)} />)}
      </div>

      <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#2D2419", marginBottom: 8 }}>Saat</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {times.map(t => <Chip key={t} label={t} active={time === t} onClick={() => setTime(t)} />)}
      </div>

      {deal && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, padding: "11px 14px", marginBottom: 18 }}>
          <span style={{ background: "#22C55E", borderRadius: 8, padding: "3px 8px", fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 800, color: "#fff" }}>%{deal.pct}</span>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "#166534", margin: 0, lineHeight: 1.4 }}>
            Anlık fırsat bu rezervasyona uygulanır — {formatCountdown(deal.minutesLeft)} kaldı
          </p>
        </div>
      )}

      <Btn text={time ? `${day} ${time} • ${people} kişi — Onayla` : "Saat seçin"} onClick={() => time && onConfirm({ day, time, people, deal })} variant="filled" disabled={!time} />
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(45,36,25,0.4)", textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
        Rezervasyon ücretsizdir. Restoran, gerçekleşen rezervasyon başına platforma komisyon öder.
      </p>
    </Sheet>
  );
}

function TastingSheet({ r, onClose, onConfirm }) {
  const menu = tastingMenuFor(r);
  const [people, setPeople] = useState(2);
  const deal = dealFor(r.id);
  const gross = menu.price * people;
  const discount = deal ? Math.round(gross * deal.pct / 100) : 0;
  const total = gross - discount;
  const commission = Math.round(total * COMMISSION_RATE);

  const row = (label, value, strong, color) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0" }}>
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: strong ? 14 : 13, fontWeight: strong ? 800 : 500, color: color || (strong ? "#2D2419" : "rgba(45,36,25,0.6)") }}>{label}</span>
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: strong ? 16 : 13, fontWeight: strong ? 800 : 600, color: color || "#2D2419", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );

  return (
    <Sheet title={menu.name} subtitle={`${r.name} • ${menu.note}`} onClose={onClose}>
      <div style={{ borderRadius: 18, overflow: "hidden", height: 130, position: "relative", marginBottom: 18 }}>
        <Img src={r.imgs[0]} style={{ position: "absolute", inset: 0 }} bg="#2c1810" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: 10, left: 14 }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff" }}>{menu.courses} servislik şef menüsü</span>
        </div>
      </div>

      <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#2D2419", marginBottom: 8 }}>Kişi sayısı</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {[1, 2, 3, 4].map(n => <Chip key={n} label={String(n)} active={people === n} onClick={() => setPeople(n)} />)}
      </div>

      <div style={{ background: "#FBFAF8", borderRadius: 16, padding: "12px 16px", marginBottom: 18 }}>
        {row(`${menu.name} × ${people}`, `₺${gross.toLocaleString("tr")}`)}
        {deal && row(`Anlık fırsat (%${deal.pct})`, `−₺${discount.toLocaleString("tr")}`, false, "#16A34A")}
        <div style={{ height: 1, background: "rgba(45,36,25,0.08)", margin: "6px 0" }} />
        {row("Toplam", `₺${total.toLocaleString("tr")}`, true)}
      </div>

      <Btn text="Satın Al" onClick={() => onConfirm({ people, total, commission, menu })} variant="filled" />
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(45,36,25,0.4)", textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
        Demo ödeme — gerçek tahsilat yapılmaz. Platform komisyonu ₺{commission.toLocaleString("tr")} (%{Math.round(COMMISSION_RATE * 100)}).
      </p>
    </Sheet>
  );
}

function ConfirmSheet({ title, lines, onClose }) {
  return (
    <Sheet title={title} subtitle="Onaylandı" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "6px 0 18px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#EAF7EC", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon n="check" color="#22A34D" size={26} strokeWidth={2.5} />
        </div>
      </div>
      <div style={{ background: "#FBFAF8", borderRadius: 16, padding: "12px 16px", marginBottom: 18 }}>
        {lines.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(45,36,25,0.6)" }}>{k}</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#2D2419", fontVariantNumeric: "tabular-nums" }}>{v}</span>
          </div>
        ))}
      </div>
      <Btn text="Tamam" onClick={onClose} variant="filled" />
    </Sheet>
  );
}

// ═══════════════════════════════════════════════
// YORUM YAZMA — puan, metin ve fotoğraf ekleme
// ═══════════════════════════════════════════════
function ReviewComposer({ restaurantName, onCancel, onSubmit }) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]);
  const fileRef = useRef(null);

  // Blob URL'ler yalnızca vazgeçildiğinde serbest bırakılır; gönderilen
  // yorumun görselleri uygulama boyunca yaşamaya devam eder.
  const addPhotos = (e) => {
    // Dosyalar burada, olay anında okunur — state güncelleyicisinin içinde
    // değil: React güncelleyiciyi sonraya bıraktığı için o ana kadar input
    // temizlenmiş olur ve seçim kaybolurdu. Ayrıca StrictMode güncelleyiciyi
    // iki kez çağırdığından blob URL üretimi de dışarıda kalmalı.
    const room = Math.max(0, 4 - photos.length);
    const picked = toMediaFiles(Array.from(e.target.files || []).slice(0, room));
    e.target.value = "";
    if (picked.length) setPhotos(prev => [...prev, ...picked].slice(0, 4));
  };
  const removePhoto = (i) => setPhotos(prev => {
    if (prev[i]?.url) URL.revokeObjectURL(prev[i].url);
    return prev.filter((_, j) => j !== i);
  });
  const cancel = () => { photos.forEach(f => f.url && URL.revokeObjectURL(f.url)); onCancel(); };

  const canSubmit = stars > 0 && text.trim().length >= 10;
  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      stamp: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: "Sen",
      stars,
      text: text.trim(),
      date: "az önce",
      photos: photos.map(f => f.url),
      mine: true,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ position: "absolute", inset: 0, background: "rgba(20,14,8,0.55)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
      onClick={cancel}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxHeight: "88%", overflowY: "auto", background: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: "20px 20px 24px" }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E5E0DA", margin: "0 auto 16px" }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, color: "#2D2419", margin: "0 0 3px" }}>Yorumunu yaz</h3>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(45,36,25,0.55)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{restaurantName}</p>
          </div>
          <IconBtn onClick={cancel} tone="subtle" size={34} title="Vazgeç"
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D2419" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
        </div>

        {/* Puan */}
        <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#2D2419", marginBottom: 8 }}>Puanın</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <motion.button
              key={n} onClick={() => setStars(n)} className="gur-icon-btn"
              whileTap={{ scale: 0.86 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              aria-label={`${n} yıldız`} title={`${n} yıldız`}
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, outline: "none", WebkitTapHighlightColor: "transparent" }}>
              <Icon n="star" size={30} color={n <= stars ? "#F59E0B" : "#E5E0DA"} />
            </motion.button>
          ))}
        </div>

        {/* Metin */}
        <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#2D2419", marginBottom: 8 }}>Deneyimin</label>
        <textarea
          value={text} onChange={e => setText(e.target.value)} rows={4}
          placeholder="Ne yedin, servis nasıldı, tekrar gider misin?"
          style={{
            width: "100%", resize: "vertical", borderRadius: 16, padding: "13px 14px",
            border: "1.5px solid rgba(45,36,25,0.14)", background: "#FBFAF8",
            fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#2D2419", lineHeight: 1.5, outline: "none",
          }}
          onFocus={e => e.currentTarget.style.borderColor = "#FF6600"}
          onBlur={e => e.currentTarget.style.borderColor = "rgba(45,36,25,0.14)"}
        />
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: text.trim().length < 10 ? "#C4776B" : "rgba(45,36,25,0.4)", margin: "6px 0 18px" }}>
          {text.trim().length < 10 ? `En az 10 karakter (${text.trim().length}/10)` : `${text.trim().length} karakter`}
        </div>

        {/* Fotoğraflar */}
        <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#2D2419", marginBottom: 8 }}>
          Fotoğraf ekle <span style={{ fontWeight: 500, color: "rgba(45,36,25,0.45)" }}>— en fazla 4</span>
        </label>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={addPhotos} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {photos.map((f, i) => (
            <div key={i} style={{ position: "relative", width: 74, height: 74, borderRadius: 14, overflow: "hidden", border: "1.5px solid rgba(45,36,25,0.1)" }}>
              <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div onClick={() => removePhoto(i)} title="Fotoğrafı kaldır" style={{ position: "absolute", top: 3, right: 3, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕</div>
            </div>
          ))}
          {photos.length < 4 && (
            <motion.button
              onClick={() => fileRef.current?.click()} className="gur-icon-btn"
              whileTap={{ scale: 0.94 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              title="Fotoğraf seç"
              style={{
                width: 74, height: 74, borderRadius: 14, cursor: "pointer", outline: "none",
                border: "2px dashed rgba(255,102,0,0.35)", background: "rgba(255,102,0,0.05)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              }}>
              <Icon n="camera" size={19} color="#FF6600" />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: "#FF6600" }}>Ekle</span>
            </motion.button>
          )}
        </div>

        <Btn text="Yorumu Paylaş" onClick={submit} variant="filled" disabled={!canSubmit} />
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════
// RESTORAN DETAY — Fotoğraf carousel + kaydırılabilir yorumlar
// ═══════════════════════════════════════════════
function DetailScreen({ r, onBack, isFav, toggleFav, onExplore, onSwipe, onFavorites, userReviews = [], onAddReview }) {
  const bookingOn = useFeature("reservations");
  const dealsOn = useFeature("instantDeals");
  const videoOn = useFeature("chefVideo");
  const [sheet, setSheet] = useState(null);      // "reserve" | "tasting" | null
  const [confirmed, setConfirmed] = useState(null);
  const deal = dealsOn ? dealFor(r.id) : null;
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const photoRef = useRef(null);

  // Fotoğraf carousel touch
  const photoTouch = useRef({ startX: 0, moved: false });
  const handlePhotoStart = (e) => { photoTouch.current.startX = e.touches?.[0]?.clientX || e.clientX; photoTouch.current.moved = false; };
  const handlePhotoEnd = (e) => {
    const endX = e.changedTouches?.[0]?.clientX || e.clientX;
    const diff = photoTouch.current.startX - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && photoIdx < r.imgs.length - 1) setPhotoIdx(i => i + 1);
      if (diff < 0 && photoIdx > 0) setPhotoIdx(i => i - 1);
    }
  };

  // Yorum carousel touch
  const [revIdx, setRevIdx] = useState(0);
  const revTouch = useRef({ startX: 0, moved: false });
  const handleRevStart = (e) => { revTouch.current.startX = e.touches?.[0]?.clientX || e.clientX; revTouch.current.moved = false; };
  const handleRevEnd = (e) => {
    const endX = e.changedTouches?.[0]?.clientX || e.clientX;
    const diff = revTouch.current.startX - endX;
    if (Math.abs(diff) > 30) {
      revTouch.current.moved = true;
      if (diff > 0 && revIdx < reviews.length - 1) setRevIdx(i => i + 1);
      if (diff < 0 && revIdx > 0) setRevIdx(i => i - 1);
    }
  };

  // Google Maps aç
  const openMaps = () => {
    // OSM'den gelen gerçek koordinat varsa doğrudan pin, yoksa isim+adres araması
    const url = r.lat && r.lng
      ? `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + " " + r.addr)}`;
    window.open(url, "_blank");
  };

  // Kullanıcının bu restorana yazdığı yorumlar en üstte, örnek yorunlar altında
  const sampleReviews = [
    { user: "A.O.", stars: 5, text: "Taze malzemeler, hızlı servis ve harika sunum! Kesinlikle tavsiye ederim. Özellikle ana yemekler muhteşemdi.", date: "2 saat önce", photos: [r.imgs[0], r.imgs[1] || r.imgs[0]] },
    { user: "Elif K.", stars: 4, text: "Ambiyans çok güzel, servis hızlı. Fiyatlar biraz yüksek ama kalite var. Tatlıları da denemenizi öneririm.", date: "1 gün önce", photos: [r.imgs[1] || r.imgs[0]] },
    { user: "Mert S.", stars: 5, text: "Şehirdeki en iyi mekan! Personel çok ilgili ve yemekler şahane. Arkadaşlarımla harika vakit geçirdik.", date: "3 gün önce", photos: [r.imgs[2] || r.imgs[0], r.imgs[0]] },
    { user: "Zeynep A.", stars: 3, text: "Yemekler güzeldi ama bekleme süresi uzundu. Genel olarak fena değil ama iyileştirme gerekli.", date: "1 hafta önce", photos: [] },
  ];
  const reviews = [...userReviews, ...sampleReviews];

  const [selectedReview, setSelectedReview] = useState(null);
  const [composing, setComposing] = useState(false);

  return (
    <Screen grad={false}>
      <div style={{ height: "100%", background: "#fff", overflowY: "auto" }}>
        <div style={{ background: GRAD, padding: "44px 16px 0", position: "relative" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <BackBtn onClick={onBack} />
            <GurLogo size={42} pill />
            <div style={{ width: 38 }} />
          </div>

          {/* Info chips */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ background: "#fff", borderRadius: 14, padding: "5px 14px", fontSize: 14, fontWeight: 700, color: "#FF6600", fontFamily: "'Outfit', sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>★ {r.rating}</span>
            <span style={{ background: "#fff", borderRadius: 14, padding: "5px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "#333", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>{r.name}</span>
            <span style={{ background: "#FF6600", borderRadius: 14, padding: "5px 14px", fontSize: 13, color: "#fff", fontWeight: 700, fontFamily: "'Outfit', sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>{r.dist}</span>
          </div>

          {/* Açıklama */}
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "#fff", margin: "0 4px 14px", lineHeight: 1.35, textShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>{r.desc}</p>

          {/* Fotoğraf Carousel — kaydırılabilir */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <div
              onTouchStart={handlePhotoStart}
              onTouchEnd={handlePhotoEnd}
              onMouseDown={handlePhotoStart}
              onMouseUp={handlePhotoEnd}
              style={{ overflow: "hidden", borderRadius: 18, cursor: "grab" }}>
              <div style={{
                display: "flex", transition: "transform 0.35s cubic-bezier(.4,0,.2,1)",
                transform: `translateX(-${photoIdx * 100}%)`,
              }}>
                {r.imgs.map((img, i) => (
                  <div key={i} style={{ minWidth: "100%", flexShrink: 0 }}>
                    <Img src={img} style={{ width: "100%", height: 210, borderRadius: 0 }} bg="#d4c8bc" />
                  </div>
                ))}
              </div>
            </div>
            {/* Dot indicators */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {r.imgs.map((_, i) => (
                <div key={i} onClick={() => setPhotoIdx(i)} style={{
                  width: i === photoIdx ? 20 : 8, height: 8, borderRadius: 4,
                  background: i === photoIdx ? "#fff" : "rgba(255,255,255,0.35)",
                  transition: "all 0.3s", cursor: "pointer",
                }} />
              ))}
            </div>
          </div>

          {/* Küçük thumbnail'lar */}
          <div style={{ display: "flex", gap: 10, paddingBottom: 16, overflowX: "auto", scrollbarWidth: "none" }}>
            {r.imgs.map((img, i) => (
              <div key={i} onClick={() => setPhotoIdx(i)} style={{
                flexShrink: 0, width: 80, height: 60, borderRadius: 12, overflow: "hidden",
                border: i === photoIdx ? "3px solid #fff" : "3px solid rgba(255,255,255,0.2)",
                opacity: i === photoIdx ? 1 : 0.6, transition: "all 0.2s", cursor: "pointer",
              }}>
                <Img src={img} style={{ width: "100%", height: "100%" }} bg="#d4c8bc" />
              </div>
            ))}
          </div>
        </div>

        {/* Beyaz alan */}
        <div style={{ padding: "18px 0 110px" }}>

          {/* Yorumlar — tek tek gösterim */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", marginBottom: 10 }}>
<p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#333", margin: 0, display: "flex", alignItems: "center", gap: 6 }}><Icon n="chat" color="#333" size={16} />Yorumlar</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#bbb" }}>{revIdx + 1} / {reviews.length}</span>
                <Btn text="Yorum Yaz" onClick={() => setComposing(true)} variant="filled" size="sm" fullWidth={false}
                  icon={<Icon n="camera" size={13} color="#fff" />} />
              </div>
            </div>

            <div
              onTouchStart={handleRevStart}
              onTouchEnd={handleRevEnd}
              onMouseDown={handleRevStart}
              onMouseUp={handleRevEnd}
              style={{ overflow: "hidden", margin: "0 16px", cursor: "grab" }}>
              <div style={{
                transition: "transform 0.4s cubic-bezier(.25,.8,.25,1)",
                transform: `translateX(-${revIdx * 100}%)`,
                display: "flex",
              }}>
                {reviews.map((rev, i) => (
                  <div key={i} style={{ minWidth: "100%", width: "100%", flexShrink: 0, padding: "0 2px", boxSizing: "border-box" }}>
                    <div
                      onClick={() => { if (!revTouch.current.moved) setSelectedReview(rev); }}
                      style={{
                        background: "#FFF8F4", border: "2px solid #FF6600",
                        borderRadius: 20, padding: "16px 18px",
                        boxShadow: "0 2px 12px rgba(255,102,0,0.06)",
                        cursor: "pointer",
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 12, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 800 }}>{rev.user.charAt(0)}</div>
                          <div>
                            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 14, color: "#FF6600", margin: 0 }}>{rev.user}</p>
                            <div style={{ display: "flex", gap: 2 }}>
                              {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 11, color: s <= rev.stars ? "#FFA500" : "#ddd" }}>★</span>)}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#ccc" }}>{rev.date}</span>
                      </div>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#666", margin: "0 0 8px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{rev.text}</p>
                      {rev.photos && rev.photos.length > 0 && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {rev.photos.slice(0, 3).map((p, pi) => (
                            <div key={pi} style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,102,0,0.15)" }}>
                              <Img src={p} style={{ width: 44, height: 44 }} bg="#f0e8e0" />
                            </div>
                          ))}
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#ccc" }}>detay →</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dot indicators */}
            <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 12 }}>
              {reviews.map((_, i) => (
                <div key={i} onClick={() => setRevIdx(i)} style={{
                  width: i === revIdx ? 20 : 7, height: 7, borderRadius: 4,
                  background: i === revIdx ? "#FF6600" : "#e0e0e0",
                  transition: "all 0.3s", cursor: "pointer",
                }} />
              ))}
            </div>
          </div>

          {/* Tags */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 16px", marginBottom: 18 }}>
            {r.tags.map(t => <span key={t} style={{ background: "#FFF0E5", borderRadius: 14, padding: "6px 16px", fontSize: 13, color: "#FF6600", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>{t}</span>)}
            <span style={{ background: "#FFF0E5", borderRadius: 14, padding: "6px 16px", fontSize: 13, color: "#FF6600", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>🕐 {r.hours}</span>
          </div>

          {/* Anlık fırsat — Faz 2 */}
          {deal && (
            <div style={{ margin: "0 16px 16px", display: "flex", alignItems: "center", gap: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 18, padding: "13px 15px" }}>
              <div style={{ background: "#22C55E", borderRadius: 10, padding: "6px 11px", flexShrink: 0 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff" }}>%{deal.pct}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#166534", margin: "0 0 2px" }}>Şu an geçerli</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(22,101,52,0.75)", margin: 0 }}>{deal.note}</p>
              </div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 700, color: "#16A34A", flexShrink: 0 }}>{formatCountdown(deal.minutesLeft)}</span>
            </div>
          )}

          {/* Gastro şef videosu — Faz 3 (tanıtım paketi) */}
          {videoOn && r.gastro !== false && (
            <div style={{ margin: "0 16px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Icon n="sparkle" size={14} color="#FF6600" />
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, fontWeight: 800, color: "#2D2419", margin: 0 }}>Şef tanıtımı</p>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#FF6600", background: "#FFF0E5", borderRadius: 6, padding: "2px 7px" }}>15 sn</span>
              </div>
              <div style={{ position: "relative", height: 160, borderRadius: 18, overflow: "hidden" }}>
                <Img src={r.imgs[1] || r.imgs[0]} style={{ position: "absolute", inset: 0 }} bg="#2c1810" />
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF6600"><polygon points="6 3 20 12 6 21" /></svg>
                  </div>
                </div>
                <div style={{ position: "absolute", bottom: 10, left: 12, right: 12 }}>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.9)", margin: 0 }}>Gastro Onaylı şef çekimi</p>
                </div>
              </div>
            </div>
          )}

          {/* Rezervasyon ve tadım menüsü — Faz 2 (işlem komisyonu) */}
          {bookingOn && (
            <div style={{ display: "flex", gap: 10, padding: "0 16px", marginBottom: 12 }}>
              <Btn text="Masa Ayırt" onClick={() => setSheet("reserve")} variant="filled" size="md" />
              <Btn text="Tadım Menüsü" onClick={() => setSheet("tasting")} variant="outlineDark" size="md" />
            </div>
          )}

          {/* Favori butonu */}
          <div style={{ padding: "0 16px" }}>
            <Btn
              text={isFav ? "Favorilerden Çıkar" : "Favorilere Ekle"} onClick={toggleFav}
              variant={isFav ? "outlineDark" : "filled"}
            />
          </div>
        </div>

        {/* Alt bar — Explore ile aynı stil */}
        <div style={{ position: "sticky", bottom: 0, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-around", borderRadius: 24, padding: "10px 8px", margin: "0 16px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          <div onClick={() => setShowMenu(true)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px", cursor: "pointer", opacity: 0.5 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF6600", fontWeight: 700 }}>Menü</span>
          </div>
          <div onClick={onSwipe} style={{ cursor: "pointer" }}><GurLogo size={24} pill /></div>
          <div onClick={openMaps} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px", cursor: "pointer", opacity: 0.5 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF6600", fontWeight: 700 }}>Konum</span>
          </div>
        </div>

        {/* Rezervasyon / tadım menüsü / onay — Faz 2 */}
        <AnimatePresence>
          {sheet === "reserve" && (
            <ReservationSheet r={r} onClose={() => setSheet(null)}
              onConfirm={(b) => { setSheet(null); setConfirmed({ title: "Masanız ayrıldı", lines: [["Restoran", r.name], ["Gün", b.day], ["Saat", b.time], ["Kişi", `${b.people}`], ...(b.deal ? [["Fırsat", `%${b.deal.pct} indirim`]] : [])] }); }} />
          )}
          {sheet === "tasting" && (
            <TastingSheet r={r} onClose={() => setSheet(null)}
              onConfirm={(t) => { setSheet(null); setConfirmed({ title: "Satın alındı", lines: [["Restoran", r.name], ["Menü", t.menu.name], ["Kişi", `${t.people}`], ["Ödenen", `₺${t.total.toLocaleString("tr")}`], ["Platform komisyonu", `₺${t.commission.toLocaleString("tr")}`]] }); }} />
          )}
          {confirmed && <ConfirmSheet title={confirmed.title} lines={confirmed.lines} onClose={() => setConfirmed(null)} />}
        </AnimatePresence>

        {/* Yorum Yazma — yıldız, metin ve fotoğraf ekleme */}
        <AnimatePresence>
        {composing && (
          <ReviewComposer
            restaurantName={r.name}
            onCancel={() => setComposing(false)}
            onSubmit={(review) => { onAddReview?.(r.id, review); setComposing(false); setRevIdx(0); }}
          />
        )}
        </AnimatePresence>

        {/* Yorum Detay Overlay — alttan gelip alta geri döner (§7 — giriş/çıkış aynı yol) */}
        <AnimatePresence>
        {selectedReview && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            style={{ position: "absolute", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {/* Header */}
              <div style={{ padding: "52px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 10 }}><Icon n="chat" color="#fff" size={22} />Yorum Detayı</h2>
                <IconBtn
                  onClick={() => setSelectedReview(null)} tone="glassLight" title="Kapat"
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                />
              </div>

              <div style={{ padding: "0 20px 40px" }}>
                {/* Kullanıcı bilgisi */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 18, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 800 }}>{selectedReview.user.charAt(0)}</div>
                  <div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 3px" }}>{selectedReview.user}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 14, color: s <= selectedReview.stars ? "#FFA500" : "rgba(255,255,255,0.15)" }}>★</span>)}
                      </div>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{selectedReview.date}</span>
                    </div>
                  </div>
                </div>

                {/* Yorum metni */}
                <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 20px", marginBottom: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.65 }}>{selectedReview.text}</p>
                </div>

                {/* Fotoğraflar */}
                {selectedReview.photos && selectedReview.photos.length > 0 && (
                  <div>
<p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", margin: "0 0 12px" }}>Fotoğraflar</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {selectedReview.photos.map((p, pi) => (
                        <div key={pi} style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                          <Img src={p} style={{ width: "100%", height: 200, borderRadius: 18 }} bg="#2a1a0a" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Restoran bilgisi */}
                <div style={{ background: "rgba(255,102,0,0.1)", borderRadius: 18, padding: "14px 16px", marginTop: 20, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgba(255,102,0,0.15)" }}>
<Icon n="plate" color="#FF6600" size={16} />
                  <div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#FF6600", margin: 0 }}>{r.name}</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>{r.cat} • {r.addr}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Menü Overlay — Görsel Galeri */}
        <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            style={{ position: "absolute", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "52px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
<h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 3px", display: "flex", alignItems: "center", gap: 8 }}><Icon n="doc" color="#fff" size={16} />Menü</h2>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>{r.name} • {r.menu ? r.menu.length : 0} sayfa</p>
              </div>
              <IconBtn
                onClick={() => setShowMenu(false)} tone="glassLight" title="Kapat"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
              />
            </div>

            {/* Menü görselleri */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px 30px" }}>
              {r.menu && r.menu.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {r.menu.map((menuImg, mi) => (
                    <div key={mi} style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.3)", animation: `fadeInUp 0.4s ease-out ${mi * 0.1}s both` }}>
                      <div style={{ position: "relative" }}>
                        <Img src={menuImg} style={{ width: "100%", height: 380, borderRadius: 18 }} bg="#1a1a1a" />
                        <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.5)", borderRadius: 10, padding: "4px 10px", backdropFilter: "blur(6px)" }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{mi + 1} / {r.menu.length}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px" }}>
<div style={{ marginBottom: 16 }}><Icon n="bank" color="rgba(255,255,255,0.4)" size={36} /></div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.6)", margin: "0 0 6px" }}>Menü henüz eklenmedi</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>Restoran menüsünü yakında yükleyecek</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// FAVORİLER
// ═══════════════════════════════════════════════
function FavScreen({ onExplore, onSwipe, onDetail, favorites, setFavorites, onProfile }) {
  const [confirmDelete, setConfirmDelete] = useState(null);

  const removeFav = (id) => { setFavorites(p => p.filter(f => f.id !== id)); setConfirmDelete(null); };

  return (
    <Screen>
      <div style={{ padding: "44px 16px 110px" }}>

        {/* Header — aynı keşfet animasyonu */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative", animation: "fadeInUp 0.6s ease-out" }}>
          <GurLogo size={42} pill />
          <div style={{ position: "absolute", right: 0 }}>
            <IconBtn onClick={onProfile} tone="solidLight" size={40} title="Profil">
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#FF6600", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 800 }}>B</div>
            </IconBtn>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24, animation: "fadeInUp 0.6s ease-out 0.15s both" }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 800, color: "#2D2419", margin: "0 0 6px" }}>Favorilerim</h2>
          {favorites.length > 0 && (
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(45,36,25,0.5)", margin: 0 }}>
              {favorites.length} restoran kayıtlı
            </p>
          )}
        </div>

        {/* Boş durum */}
        {favorites.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 100, height: 100, borderRadius: "50%", background: "#FFF3EA", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon n="brokenHeart" color="#FF6600" size={32} />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: "#2D2419", margin: "0 0 8px" }}>Henüz favori eklemediniz</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(45,36,25,0.5)", margin: "0 0 28px", lineHeight: 1.5 }}>
              Restoranları sağa kaydırarak favorilerinize ekleyin
            </p>
            <Btn text="Keşfetmeye Başla" onClick={onSwipe} variant="filled" fullWidth={false} />
          </div>
        ) : (
          <>
            {/* İstatistik çubuğu */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Toplam", value: favorites.length, icon: <Icon n="heart" color="#FF6600" size={18} /> },
                { label: "Ort. Puan", value: (favorites.reduce((a, r) => a + r.rating, 0) / favorites.length).toFixed(1), icon: <Icon n="star" color="#FF6600" size={18} /> },
                { label: "Kategori", value: [...new Set(favorites.map(r => r.cat))].length, icon: <Icon n="plate" color="#FF6600" size={18} /> },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: "#fff", borderRadius: 18, padding: "14px 10px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>{s.icon}</div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#2D2419", margin: "4px 0 2px" }}>{s.value}</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(45,36,25,0.5)", margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Favori kartları */}
            {favorites.map((r, i) => (
              <div key={r.id} style={{
                background: "#fff", borderRadius: 22, overflow: "hidden", marginBottom: 14,
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                animation: `fadeInUp 0.4s ease-out ${i * 0.06}s both`,
              }}>
                {/* Üst kısım — fotoğraf */}
                <div onClick={() => onDetail(r)} style={{ cursor: "pointer", position: "relative", height: 160 }}>
                  <Img src={r.imgs[0]} style={{ position: "absolute", inset: 0 }} bg="#d4c8bc" />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 45%)" }} />

                  {/* Puan ve kategori */}
                  <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
                    <span style={{ background: "#fff", borderRadius: 10, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: "#1C1917", fontFamily: "'Outfit', sans-serif", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon n="star" color="#F59E0B" size={11} />{r.rating}</span>
                    <span style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(6px)", borderRadius: 10, padding: "4px 10px", fontSize: 11, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>{r.cat}</span>
                  </div>

                  {/* Fiyat */}
                  <span style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", borderRadius: 10, padding: "4px 10px", fontSize: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>{r.price}</span>

                  {/* İsim ve mesafe */}
                  <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>{r.name}</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.8)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "3px 8px" }}>{r.dist}</span>
                  </div>
                </div>

                {/* Alt kısım — bilgiler + silme */}
                <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50" }} />
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4CAF50", fontWeight: 700 }}>Açık</span>
                    </div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#bbb" }}>{r.hours}</span>
                  </div>

                  {/* Silme — onaylı */}
                  {confirmDelete === r.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn text="Sil" onClick={() => removeFav(r.id)} variant="destructive" size="sm" fullWidth={false} />
                      <Btn text="İptal" onClick={() => setConfirmDelete(null)} variant="outlineDark" size="sm" fullWidth={false} />
                    </div>
                  ) : (
                    <Btn
                      text="Kaldır" onClick={() => setConfirmDelete(r.id)}
                      variant="destructiveSoft" size="sm" fullWidth={false}
                      icon={<Icon n="trash" color="#FF3B30" size={14} />}
                    />
                  )}
                </div>

                {/* Adres */}
                <div style={{ padding: "0 16px 14px" }}>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#bbb", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {r.addr}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}

      </div>
      {/* Alt bar — beyaz, keşfet sayfası ile aynı */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 16px", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", background: "#fff", borderRadius: 24, padding: "10px 8px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          <div onClick={onExplore} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px", cursor: "pointer", opacity: 0.4 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF6600", fontWeight: 700 }}>Keşfet</span>
          </div>
          <div onClick={onSwipe} style={{ cursor: "pointer" }}><GurLogo size={24} pill /></div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF3B30" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF3B30", fontWeight: 700 }}>Favoriler</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// PROFİLİM
// ═══════════════════════════════════════════════
const MY_REVIEWS = [
  { rid: 1, name: "Nusr-Et Steakhouse", stars: 5, text: "Etler mükemmel pişmiş, servis çok hızlıydı. Kesinlikle tekrar geleceğim.", date: "3 gün önce", img: I.steak1 },
  { rid: 8, name: "Nonna's Trattoria", stars: 4, text: "Pizza hamuru harikaydı, sadece bekleme süresi biraz uzundu.", date: "1 hafta önce", img: I.pasta1 },
  { rid: 12, name: "Karaköy Güllüoğlu", stars: 5, text: "1820'den beri neden efsane olduğu belli, baklava enfes.", date: "2 hafta önce", img: I.dessert1 },
  { rid: 6, name: "Klein Bistro", stars: 4, text: "Kahve kalitesi çok iyi, brunch menüsü de doyurucu.", date: "3 hafta önce", img: I.cafe1 },
];

const BADGES = [
  { icon: "sparkle", label: "İlk Yorum" },
  { icon: "heart", label: "5+ Favori" },
  { icon: "star", label: "Puan Ustası" },
  { icon: "flame", label: "Sadık Müşteri" },
];

function ProfileScreen({ onBack, onSwipe, onExplore, onFavorites, favorites, onDetail, accentColor = "#FF6600", showBadges = true, badgeSpeed = 14, userReviews = {}, restaurants = [], onRemoveUserReview }) {
  const [tab, setTab] = useState("reviews");
  const [sampleReviews, setSampleReviews] = useState(MY_REVIEWS);
  // Uygulama içinde yazılan yorumlar profil listesinin şekline dönüştürülür
  const written = useMemo(() => Object.entries(userReviews).flatMap(([restId, list]) =>
    (list || []).map(v => {
      const rest = restaurants.find(x => String(x.id) === String(restId));
      return {
        rid: v.stamp, restId, mine: true,
        name: rest?.name || "Restoran",
        img: v.photos?.[0] || rest?.imgs?.[0],
        date: v.date, stars: v.stars, text: v.text, photos: v.photos || [],
      };
    })
  ), [userReviews, restaurants]);
  const reviews = [...written, ...sampleReviews];
  const [photo, setPhoto] = useState(null);
  const fileRef = useRef(null);
  const pickPhoto = () => fileRef.current?.click();
  const onPhoto = (e) => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); };
  const removeReview = (rid) => {
    const mine = written.find(r => r.rid === rid);
    if (mine) onRemoveUserReview?.(mine.restId, rid);
    else setSampleReviews(prev => prev.filter(r => r.rid !== rid));
  };
  const avgScore = reviews.length ? (reviews.reduce((a, r) => a + r.stars, 0) / reviews.length).toFixed(1) : "-";

  return (
    <Screen grad={false}>
      <div style={{ height: "100%", background: "#fff", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "44px 20px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <BackBtn onClick={onBack} variant="light" />
            <div style={{ width: 38 }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
            <div onClick={pickPhoto} style={{ position: "relative", cursor: "pointer" }}>
              <div style={{ width: 84, height: 84, borderRadius: "50%", background: photo ? "transparent" : accentColor, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 30, fontWeight: 800 }}>
                {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "B"}
              </div>
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "#fff", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
                <Icon n="camera" size={13} color={accentColor} />
              </div>
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 19, fontWeight: 800, color: "#1C1917", margin: "14px 0 3px" }}>Bora Çolpan</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "#A8A29E", margin: "0 0 16px" }}>Nisan 2024'ten beri üye</p>

            {/* Tek satır istatistik */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#57534E" }}><b style={{ color: "#1C1917" }}>{favorites.length}</b> Favori</span>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#D6D0C4" }} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#57534E" }}><b style={{ color: "#1C1917" }}>{reviews.length}</b> Yorum</span>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#D6D0C4" }} />
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#57534E", display: "flex", alignItems: "center", gap: 3 }}><Icon n="star" size={12} color="#F59E0B" /><b style={{ color: "#1C1917" }}>{avgScore}</b> Ortalama</span>
            </div>
          </div>

          {/* Rozetlerim — otomatik kayan döngü */}
          {showBadges && (
            <div style={{ marginTop: 22 }}>
              <div style={{ overflow: "hidden", maskImage: "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)" }}>
                <div style={{ display: "flex", gap: 8, width: "max-content", animation: `badgeMarquee ${badgeSpeed}s linear infinite` }}>
                  {[...BADGES, ...BADGES].map((b, i) => (
                    <div key={i} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 999, padding: "6px 12px" }}>
                      <Icon n={b.icon} size={12} color={accentColor} />
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#57534E", whiteSpace: "nowrap" }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab seçici — alt çizgi stili */}
        <div style={{ display: "flex", gap: 0, margin: "24px 20px 0", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          {[{ id: "reviews", label: "Yorumlarım" }, { id: "favorites", label: "Beğendiğim Yerler" }].map(t => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "0 0 12px", marginRight: 28, cursor: "pointer",
              borderBottom: tab === t.id ? "2px solid #FF6600" : "2px solid transparent",
              transition: "all 0.2s",
            }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "#1C1917" : "#A8A29E" }}>{t.label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: "18px 20px 100px" }}>
          {tab === "reviews" && (
            reviews.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#8A7A68", margin: 0 }}>Henüz yorum yapmadın</p>
              </div>
            ) : reviews.map((rev, i) => (
              <div key={rev.rid} style={{ display: "flex", gap: 12, padding: "16px 0", borderBottom: i < reviews.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none", animation: `fadeInUp 0.35s ease-out ${i * 0.06}s both` }}>
                <div style={{ width: 50, height: 50, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                  <Img src={rev.img} style={{ width: "100%", height: "100%" }} bg="#e8e0d8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#1C1917", margin: 0 }}>{rev.name}</p>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#C4B5A3", flexShrink: 0, marginLeft: 6 }}>{rev.date}</span>
                  </div>
                  <div style={{ display: "flex", gap: 2, margin: "4px 0 6px" }}>
                    {[1,2,3,4,5].map(st => <Icon key={st} n="star" size={10} color={st <= rev.stars ? "#F59E0B" : "#E5E0D8"} />)}
                  </div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "#57534E", margin: 0, lineHeight: 1.45 }}>{rev.text}</p>
                  {rev.photos?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {rev.photos.map((src, pi) => (
                        <div key={pi} style={{ width: 46, height: 46, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(0,0,0,0.06)" }}>
                          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ alignSelf: "flex-start" }}>
                  <IconBtn onClick={() => removeReview(rev.rid)} tone="plain" size={28} title="Yorumu sil" icon={<Icon n="trash" size={14} color="#C4B5A3" />} />
                </div>
              </div>
            ))
          )}

          {tab === "favorites" && (
            favorites.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#8A7A68", margin: 0 }}>Henüz beğendiğin bir yer yok</p>
              </div>
            ) : favorites.map((r, i) => (
              <div key={r.id} onClick={() => onDetail(r)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: i < favorites.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none", cursor: "pointer" }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                  <Img src={r.imgs[0]} style={{ width: "100%", height: "100%" }} bg="#e8e0d8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#1C1917", margin: "0 0 2px" }}>{r.name}</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "#8A7A68", margin: 0 }}>{r.cat} · {r.dist}</p>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <Icon n="star" color="#F59E0B" size={12} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#1C1917" }}>{r.rating}</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Alt bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 16px", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", background: "#fff", borderRadius: 24, padding: "10px 8px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          <div onClick={onExplore} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px", cursor: "pointer", opacity: 0.4 }}>
            <Icon n="search" color="#FF6600" size={22} />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF6600", fontWeight: 700 }}>Keşfet</span>
          </div>
          <div onClick={onSwipe} style={{ cursor: "pointer" }}><GurLogo size={24} pill /></div>
          <div onClick={onFavorites} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 14px", cursor: "pointer", opacity: 0.4 }}>
            <Icon n="heart" color="#FF3B30" size={22} />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "#FF3B30", fontWeight: 700 }}>Favoriler</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// CANLI VERİ — OpenStreetMap Overpass API (ücretsiz, key gerektirmez)
// Gerçek İstanbul restoranlarını çeker; başarısız olursa mock veriye düşer
// ═══════════════════════════════════════════════
const CAT_MAP = {
  turkish: "Türk Mutfağı", kebab: "Türk Mutfağı", regional: "Türk Mutfağı",
  japanese: "Uzak Doğu", sushi: "Uzak Doğu", chinese: "Uzak Doğu", asian: "Uzak Doğu", thai: "Uzak Doğu", korean: "Uzak Doğu", vietnamese: "Uzak Doğu", ramen: "Uzak Doğu",
  italian: "İtalyan", pizza: "İtalyan", pasta: "İtalyan",
  burger: "Fast Food", fast_food: "Fast Food", sandwich: "Fast Food", chicken: "Fast Food",
  seafood: "Deniz Ürünleri", fish: "Deniz Ürünleri",
  coffee_shop: "Kafe", cafe: "Kafe", breakfast: "Kafe",
  dessert: "Tatlıcı", ice_cream: "Tatlıcı", cake: "Tatlıcı", baklava: "Tatlıcı",
  indian: "Hint", curry: "Hint",
  vegetarian: "Sağlıklı", vegan: "Sağlıklı", salad: "Sağlıklı",
  barbecue: "Mangal", grill: "Mangal", steak_house: "Mangal",
  bar: "Gece Hayatı", pub: "Gece Hayatı",
};

function osmToRestaurant(el, idx) {
  const t = el.tags || {};
  const cuisineRaw = (t.cuisine || "").split(";")[0].trim().toLowerCase();
  const cat = CAT_MAP[cuisineRaw] || "Türk Mutfağı";
  const seed = `osm-${el.id}`;
  const streetAddr = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" No:");
  return {
    id: `osm-${el.id}`,
    name: t.name,
    cat,
    rating: (3.8 + ((el.id % 12) / 10)).toFixed(1) * 1, // 3.8 - 4.9 arası deterministik
    dist: `${(0.3 + (el.id % 70) / 10).toFixed(1)} km`,
    price: ["₺150+", "₺300+", "₺500+", "₺800+"][el.id % 4],
    addr: streetAddr ? `${streetAddr}, ${t["addr:district"] || "Kadıköy"}, İstanbul` : `${t["addr:district"] || "Kadıköy"}, İstanbul`,
    desc: t.description || `${cat} kategorisinde${cuisineRaw ? ` (${cuisineRaw})` : ""} hizmet veren mekan.`,
    imgs: [
      `https://picsum.photos/seed/${seed}-a/600/400`,
      `https://picsum.photos/seed/${seed}-b/600/400`,
      `https://picsum.photos/seed/${seed}-c/600/400`,
    ],
    menu: [`https://picsum.photos/seed/${seed}-menu/600/900`],
    hours: t.opening_hours ? t.opening_hours.slice(0, 20) : "11:00 - 23:00",
    tags: [cat, cuisineRaw ? cuisineRaw.charAt(0).toUpperCase() + cuisineRaw.slice(1) : "Restoran"].filter((v, i, a) => a.indexOf(v) === i),
    lat: el.lat, lng: el.lon,
    isLive: true, // OSM'den geldiğini işaretle
  };
}

async function fetchLiveRestaurants() {
  // Kadıköy merkez bölgesi bounding box
  const query = `[out:json][timeout:15];node["amenity"="restaurant"]["name"](40.980,29.015,41.005,29.045);out body 40;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error("Overpass hata: " + res.status);
  const data = await res.json();
  const list = (data.elements || [])
    .filter(el => el.tags && el.tags.name)
    .map(osmToRestaurant);
  if (list.length < 5) throw new Error("Yetersiz veri");
  return list;
}

export default function GurApp(props = {}) {
  const accentColor = props.accentColor || "#FF6600";
  const showBadges = props.showBadges !== undefined ? props.showBadges : true;
  const badgeSpeed = props.badgeSpeed || 14;
  const [screen, setScreen] = useState("splash");
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const [restaurants, setRestaurants] = useState(RESTAURANTS); // mock ile başla
  const [dataSource, setDataSource] = useState("demo"); // "demo" | "live"
  // Doyurucu panelinden yüklenen görseller — uygulama genelinde tek kaynak
  const [ownerMedia, setOwnerMedia] = useState({ photos: [], menu: [] });
  // GUR Match oturumu
  const [matchCode, setMatchCode] = useState("");
  const [matchResults, setMatchResults] = useState([]);
  // Kullanıcının yazdığı yorumlar restoran id'sine göre — hem restoran
  // detayında hem profildeki "Yorumlarım" listesinde aynı kaynaktan okunur
  const [userReviews, setUserReviews] = useState({});

  const addReview = (restaurantId, review) =>
    setUserReviews(prev => ({ ...prev, [restaurantId]: [review, ...(prev[restaurantId] || [])] }));
  const removeUserReview = (restaurantId, stamp) =>
    setUserReviews(prev => ({ ...prev, [restaurantId]: (prev[restaurantId] || []).filter(v => v.stamp !== stamp) }));

  const ownerRestaurant = useMemo(() => findOwnerRestaurant(restaurants), [restaurants]);
  // Tüketici tarafındaki her ekran bu türetilmiş listeden beslenir
  const feed = useMemo(
    () => withOwnerMedia(restaurants, ownerRestaurant?.id, ownerMedia),
    [restaurants, ownerRestaurant, ownerMedia]
  );

  // Canlı veri dene — başarısızsa sessizce mock ile devam
  useEffect(() => {
    let cancelled = false;
    fetchLiveRestaurants()
      .then(list => { if (!cancelled) { setRestaurants(list); setDataSource("live"); } })
      .catch(() => { /* mock veri zaten yüklü */ });
    return () => { cancelled = true; };
  }, []);

  // Detay ekranı seçim anındaki kopyayı değil güncel kaydı gösterir; böylece
  // panelden yeni fotoğraf eklenince açık detay da tazelenir.
  const liveSelected = useMemo(
    () => (selected ? feed.find(r => r.id === selected.id) || selected : null),
    [feed, selected]
  );

  const nav = (to) => { setHistory(p => [...p, screen]); setScreen(to); };
  const back = () => { if (history.length > 0) { setScreen(history[history.length - 1]); setHistory(h => h.slice(0, -1)); } };
  const openDetail = (r) => { setSelected(r); nav("detail"); };
  const isFav = (r) => favorites.some(f => f.id === r?.id);
  const toggleFav = () => { if (!selected) return; if (isFav(selected)) setFavorites(p => p.filter(f => f.id !== selected.id)); else setFavorites(p => [...p, selected]); };
  const goExplore = () => { setFilterCat(null); nav("explore"); };
  const goSwipe = () => { nav("swipe"); };
  const goFav = () => { nav("fav"); };
  const goProfile = () => { nav("profile"); };
  const catTap = (cat) => { setFilterCat(cat); nav("swipe"); };
  const goMatch = () => { setMatchResults([]); nav("match-start"); };
  const startMatch = (code) => { setMatchCode(code); setMatchResults([]); nav("match-swipe"); };
  const finishMatch = (found) => { setMatchResults(found); nav("match-result"); };

  const render = () => {
    switch (screen) {
      case "splash": return <SplashScreen onNext={() => setScreen("welcome")} />;
      case "welcome": return <WelcomeScreen onStart={() => nav("login")} onDoyurucu={() => nav("doyurucu-auth")} />;
      case "login": return <LoginScreen onBack={back} onLogin={() => nav("explore")} onRegister={() => nav("register")} />;
      case "register": return <RegisterScreen onBack={back} onDone={() => nav("explore")} />;
      case "doyurucu-auth": return <DoyurucuAuthScreen onBack={back} onLogin={() => nav("doyurucu-login")} onRegister={() => nav("rest1")} />;
      case "doyurucu-login": return <DoyurucuLoginScreen onBack={back} onLogin={() => nav("rest-dashboard")} />;
      case "rest1": return <RestRegStep1 onBack={back} onNext={() => nav("rest2")} />;
      case "rest2": return <RestRegStep2 onBack={back} onNext={() => nav("rest3")} />;
      case "rest3": return <RestRegStep3 onBack={back} onDone={() => nav("rest-dashboard")} ownerMedia={ownerMedia} setOwnerMedia={setOwnerMedia} />;
      case "rest-dashboard": return <RestaurantDashboard onLogout={() => { setHistory([]); setScreen("welcome"); }} ownerMedia={ownerMedia} setOwnerMedia={setOwnerMedia} ownerRestaurant={ownerRestaurant} />;
      case "explore": return <ExploreScreen onCategoryTap={catTap} onSwipe={goSwipe} onFavorites={goFav} onProfile={goProfile} onMatch={goMatch} restaurants={feed} onDetail={openDetail} />;
      case "match-start": return <MatchStartScreen onBack={back} onStart={startMatch} />;
      case "match-swipe": return <MatchSwipeScreen code={matchCode} restaurants={feed} onExit={goExplore} onFinish={finishMatch} />;
      case "match-result": return <MatchResultScreen code={matchCode} matches={matchResults} onDetail={openDetail} onRestart={goMatch} onExplore={goExplore} />;
      case "swipe": return <SwipeScreen onDetail={openDetail} onExplore={goExplore} onFavorites={goFav} favorites={favorites} setFavorites={setFavorites} filterCat={filterCat} restaurants={feed} dataSource={dataSource} />;
      case "detail": return <DetailScreen r={liveSelected} onBack={back} isFav={isFav(selected)} toggleFav={toggleFav} onExplore={goExplore} onSwipe={goSwipe} onFavorites={goFav} userReviews={userReviews[liveSelected?.id] || []} onAddReview={addReview} />;
      case "fav": return <FavScreen onExplore={goExplore} onSwipe={goSwipe} onDetail={openDetail} favorites={favorites} setFavorites={setFavorites} onProfile={goProfile} />;
      case "profile": return <ProfileScreen onBack={back} onExplore={goExplore} onSwipe={goSwipe} onFavorites={goFav} favorites={favorites} onDetail={openDetail} accentColor={accentColor} showBadges={showBadges} badgeSpeed={badgeSpeed} userReviews={userReviews} restaurants={feed} onRemoveUserReview={removeUserReview} />;
      default: return <SplashScreen onNext={() => setScreen("welcome")} />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0d0d1a, #1a1a2e, #0d0d1a)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes badgeMarquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
        ::-webkit-scrollbar { display:none; }
        .gur-btn:focus-visible, .gur-icon-btn:focus-visible { box-shadow: 0 0 0 3px rgba(255,102,0,0.5) !important; }
        @media (prefers-reduced-motion: reduce) { .gur-btn, .gur-icon-btn { transition: none !important; } }
      `}</style>
      <PhoneFrame>{render()}</PhoneFrame>
    </div>
  );
}

