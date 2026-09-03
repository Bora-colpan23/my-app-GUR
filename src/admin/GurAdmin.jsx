import React, { useState, useMemo } from 'react';
import { PHASES, FEATURE_PHASE, usePhase, setPhase } from '../lib/phase.js';
import { motion, AnimatePresence } from 'motion/react';

// ═══════════════════════════════════════════════════════════════
// GUR YÖNETİCİ PANELİ — Platform kontrol merkezi
// Restoranlar, başvurular, kullanıcılar, Gastro Onaylı, gelir yönetimi
// ═══════════════════════════════════════════════════════════════

const C = {
  bg: '#0E1117',
  panel: '#161B22',
  panel2: '#1C2230',
  border: '#242C3A',
  text: '#E6EDF3',
  dim: '#8B98A9',
  faint: '#5A6675',
  orange: '#FF6600',
  orangeSoft: 'rgba(255,102,0,0.12)',
  green: '#3FB950',
  greenSoft: 'rgba(63,185,80,0.12)',
  red: '#F85149',
  redSoft: 'rgba(248,81,73,0.12)',
  yellow: '#D29922',
  yellowSoft: 'rgba(210,153,34,0.12)',
  blue: '#58A6FF',
  blueSoft: 'rgba(88,166,255,0.12)',
};

const F = "'Poppins', system-ui, sans-serif";

// ─── Mock veri ───
const STATS = {
  totalRestaurants: 342,
  activeRestaurants: 289,
  pendingApps: 14,
  totalUsers: 18420,
  dailyActive: 4230,
  totalSwipes: 892400,
  monthlyRevenue: 284500,
  gastroApproved: 47,
};

const SWIPE_TREND = [
  { d: 'Pzt', v: 118000 }, { d: 'Sal', v: 132000 }, { d: 'Çar', v: 141000 },
  { d: 'Per', v: 128000 }, { d: 'Cum', v: 165000 }, { d: 'Cmt', v: 190000 }, { d: 'Paz', v: 178000 },
];

const CAT_DIST = [
  { name: 'Türk Mutfağı', count: 89, color: '#FF6600' },
  { name: 'Kafe', count: 64, color: '#FF8C00' },
  { name: 'Fast Food', count: 47, color: '#FFA500' },
  { name: 'İtalyan', count: 38, color: '#FF6347' },
  { name: 'Uzak Doğu', count: 31, color: '#FF4500' },
  { name: 'Diğer', count: 73, color: '#8B98A9' },
];

const RESTAURANTS = [
  { id: 1, name: 'Nusr-Et Steakhouse', cat: 'Türk Mutfağı', district: 'Beşiktaş', rating: 4.8, reviews: 1240, status: 'active', gastro: true, plan: 'Premium', joined: '2024-03-12' },
  { id: 2, name: 'Mikla Restaurant', cat: 'Fine Dining', district: 'Beyoğlu', rating: 4.9, reviews: 890, status: 'active', gastro: true, plan: 'Premium', joined: '2024-01-08' },
  { id: 3, name: 'Çiya Sofrası', cat: 'Türk Mutfağı', district: 'Kadıköy', rating: 4.7, reviews: 2100, status: 'active', gastro: true, plan: 'Pro', joined: '2024-02-20' },
  { id: 4, name: 'Green Bowl', cat: 'Sağlıklı', district: 'Şişli', rating: 4.5, reviews: 340, status: 'active', gastro: false, plan: 'Ücretsiz', joined: '2024-06-15' },
  { id: 5, name: 'Klein Bistro', cat: 'Kafe', district: 'Beyoğlu', rating: 4.4, reviews: 560, status: 'suspended', gastro: false, plan: 'Ücretsiz', joined: '2024-05-02' },
  { id: 6, name: 'The Burger Joint', cat: 'Fast Food', district: 'Nişantaşı', rating: 4.2, reviews: 780, status: 'active', gastro: false, plan: 'Pro', joined: '2024-04-18' },
  { id: 7, name: 'Karaköy Güllüoğlu', cat: 'Tatlıcı', district: 'Karaköy', rating: 4.9, reviews: 3200, status: 'active', gastro: true, plan: 'Premium', joined: '2023-12-01' },
  { id: 8, name: 'Lucca Lounge', cat: 'Gece Hayatı', district: 'Bebek', rating: 4.3, reviews: 450, status: 'active', gastro: false, plan: 'Pro', joined: '2024-07-22' },
];

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
    <span style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color, background: soft, padding: '3px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: { text: 'Aktif', color: C.green, soft: C.greenSoft },
    suspended: { text: 'Askıda', color: C.yellow, soft: C.yellowSoft },
    banned: { text: 'Yasaklı', color: C.red, soft: C.redSoft },
  };
  const s = map[status] || map.active;
  return <Badge {...s} />;
}

// ─── Buton — Apple HIG tonlu: filled/soft/outline/ghost/plain, tutarlı hover + basılma geri bildirimi ───
const TONE_COLOR = { neutral: C.text, orange: C.orange, green: C.green, red: C.red, blue: C.blue, yellow: C.yellow };
const TONE_SOFT = { neutral: C.panel2, orange: C.orangeSoft, green: C.greenSoft, red: C.redSoft, blue: C.blueSoft, yellow: C.yellowSoft };

function Btn({ label, onClick, icon, variant = 'outline', tone = 'neutral', size = 'md', fullWidth = false, disabled, title }) {
  const toneColor = TONE_COLOR[tone] || C.text;
  const toneSoft = TONE_SOFT[tone] || C.panel2;
  const paddings = { sm: '7px 12px', md: '9px 14px', lg: '12px 18px' };
  const fontSizes = { sm: 12, md: 12.5, lg: 14 };
  const variants = {
    filled: { background: toneColor, color: tone === 'yellow' ? '#241c00' : '#fff', border: '1px solid transparent' },
    soft: { background: toneSoft, color: toneColor, border: `1px solid ${toneColor}44` },
    outline: { background: C.bg, color: tone === 'neutral' ? C.text : toneColor, border: `1px solid ${C.border}` },
    ghost: { background: 'transparent', color: toneColor, border: `1px solid ${C.border}` },
    plain: { background: 'transparent', color: toneColor, border: '1px solid transparent' },
  };
  const base = variants[variant] || variants.outline;
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      whileHover={disabled ? undefined : { filter: 'brightness(1.15)' }}
      whileTap={disabled ? undefined : { scale: 0.98, filter: 'brightness(0.9)' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
      className="gur-admin-btn"
      style={{
        width: fullWidth ? '100%' : 'auto',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: paddings[size], borderRadius: 9,
        fontFamily: F, fontSize: fontSizes[size], fontWeight: variant === 'filled' ? 700 : 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        ...base,
        whiteSpace: 'nowrap', outline: 'none',
      }}>
      {icon}{label}
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
        padding: '10px 12px', marginBottom: 2, borderRadius: 10, border: 'none',
        backgroundColor: active ? C.orangeSoft : 'transparent', cursor: 'pointer',
        color: active ? C.orange : C.dim, fontFamily: F, fontSize: 13.5, fontWeight: active ? 600 : 500,
        textAlign: 'left', outline: 'none',
      }}>
      <Icon path={item.icon} size={18} color={active ? C.orange : C.dim} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.count !== undefined && (
        <span style={{
          fontSize: 11, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: item.alert ? C.orange : C.panel2, color: item.alert ? '#fff' : C.dim,
        }}>{item.count}</span>
      )}
    </motion.button>
  );
}

// ─── Icon-only buton — sabit kare hedef, ince kenarlık, hover'da panel rengi ───
function IconBtn({ onClick, icon, size = 38, title, danger }) {
  return (
    <motion.button
      onClick={onClick} title={title} aria-label={title}
      whileHover={{ backgroundColor: danger ? C.redSoft : C.panel2, borderColor: danger ? C.red : C.border }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
      className="gur-admin-btn"
      style={{
        width: size, height: size, minWidth: size, borderRadius: 10,
        borderWidth: 1, borderStyle: 'solid', borderColor: C.border,
        backgroundColor: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, position: 'relative', padding: 0,
        outline: 'none',
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
          padding: '11px 13px', fontSize: 13.5, color: C.text, fontFamily: F, outline: 'none',
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

  const submit = () => {
    if (user.trim() === DEMO_USER && pass === DEMO_PASS) { setError(''); onLogin(); }
    else setError('Kullanıcı adı veya parola hatalı.');
  };

  return (
    <div style={{ height: '100vh', background: C.bg, fontFamily: F, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .gur-admin-btn:focus-visible { box-shadow: 0 0 0 3px ${C.orange}55 !important; }
        @media (prefers-reduced-motion: reduce) { .gur-admin-btn { transition: none !important; } }
      `}</style>

      <div style={{ width: '100%', maxWidth: 380, animation: 'fadeIn 0.3s ease-out' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 26 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '8px 16px', display: 'inline-flex', marginBottom: 14 }}>
            <GurLogo size={26} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>YÖNETİM PANELİ</div>
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>Devam etmek için giriş yapın</div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 20px' }}>
          <AdminField label="Kullanıcı adı" value={user} onChange={v => { setUser(v); setError(''); }} autoFocus onEnter={submit} />
          <AdminField label="Parola" value={pass} onChange={v => { setPass(v); setError(''); }} type="password" onEnter={submit} />

          {error && (
            <div style={{ background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: 9, padding: '9px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon path={icons.ban} size={14} color={C.red} />
              <span style={{ fontSize: 12, color: C.red }}>{error}</span>
            </div>
          )}

          <Btn label="Giriş yap" onClick={submit} variant="filled" tone="orange" size="md" fullWidth />

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.yellowSoft, border: `1px solid ${C.yellow}33`, borderRadius: 6, padding: '3px 8px', marginBottom: 8 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: C.yellow, letterSpacing: 1 }}>DEMO</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.6 }}>
              Kullanıcı adı <code style={{ color: C.dim, background: C.panel2, padding: '1px 5px', borderRadius: 4 }}>{DEMO_USER}</code>
              {' · '}Parola <code style={{ color: C.dim, background: C.panel2, padding: '1px 5px', borderRadius: 4 }}>{DEMO_PASS}</code>
              <br />Doğrulama tarayıcıda yapılır; gerçek koruma için backend gerekir.
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
    { id: 'restaurants', label: 'Restoranlar', icon: icons.store, count: restaurants.length },
    { id: 'applications', label: 'Başvurular', icon: icons.inbox, count: apps.length, alert: apps.length > 0 },
    { id: 'gastro', label: 'Gastro Onaylı', icon: icons.star },
    { id: 'users', label: 'Kullanıcılar', icon: icons.users },
    { id: 'revenue', label: 'Gelir & Reklam', icon: icons.money },
    { id: 'settings', label: 'Ayarlar', icon: icons.settings },
  ];

  // Açık restoran her zaman güncel kayıttan okunur; rozet/durum değişince
  // detay ekranı da anında tazelenir.
  const openRestaurant = openRestaurantId == null ? null : restaurants.find(r => r.id === openRestaurantId) || null;
  const pageTitle = openRestaurant ? openRestaurant.name : (nav.find(n => n.id === page)?.label || 'Genel Bakış');

  const goPage = (id) => { setOpenRestaurantId(null); setPage(id); };

  const logout = () => { setAuthed(false); setPage('dashboard'); setQuery(''); setReviewDoc(null); setOpenRestaurantId(null); setRestTab('list'); };

  // Giriş yapılmadan panel hiç render edilmez
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, fontFamily: F, color: C.text, overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2A3341; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #3A4453; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .row-hover:hover { background: ${C.panel2} !important; }
        .gur-admin-btn:focus-visible { box-shadow: 0 0 0 3px ${C.orange}55 !important; }
        @media (prefers-reduced-motion: reduce) { .gur-admin-btn { transition: none !important; } }
      `}</style>

      {/* ─── SIDEBAR ─── */}
      <aside style={{ width: 248, background: C.panel, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '6px 12px', display: 'inline-flex' }}>
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
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#FF6600,#FF3B30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>A</div>
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
          <PhaseSwitch />
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative', width: 280 }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <Icon path={icons.search} size={16} color={C.faint} />
            </div>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ara..." style={{
              width: '100%', height: 38, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '0 12px 0 36px', color: C.text, fontFamily: F, fontSize: 13, outline: 'none',
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
          {page === 'dashboard' && <DashboardPage />}
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
          {page === 'revenue' && <RevenuePage />}
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
                  <Btn label="Reddet" onClick={() => rejectApp(reviewDoc.id)} variant="soft" tone="red" size="lg" fullWidth icon={<Icon path={icons.x} size={16} color={C.red} />} />
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
          style={{ position: 'fixed', bottom: 24, right: 24, background: toast.type === 'error' ? C.red : C.green, color: '#fff', padding: '12px 20px', borderRadius: 12, fontFamily: F, fontSize: 13.5, fontWeight: 600, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
          <Icon path={toast.type === 'error' ? icons.x : icons.check} size={16} color="#fff" />
          {toast.msg}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

// ═══ SAYFALAR ═══

function KpiCard({ label, value, delta, deltaUp, deltaNeutral, icon, accent }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon path={icon} size={20} color={accent.color} />
        </div>
        {delta && (
          // Nötr delta: artış/azalış değil, bilgi (örn. "açılmamış potansiyel").
          // Ok ve renk kodu kullanılmaz ki yanlış okunmasın.
          <span style={{ fontSize: 12, fontWeight: 600, color: deltaNeutral ? C.faint : (deltaUp ? C.green : C.red), display: 'flex', alignItems: 'center', gap: 3 }}>
            {deltaNeutral ? '' : (deltaUp ? '↑' : '↓')} {delta}
          </span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: C.dim }}>{label}</div>
    </div>
  );
}

function DashboardPage() {
  const maxSwipe = Math.max(...SWIPE_TREND.map(d => d.v));
  const totalCat = CAT_DIST.reduce((a, c) => a + c.count, 0);
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      {/* KPI kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Toplam Restoran" value={STATS.totalRestaurants} delta="8%" deltaUp icon={icons.store} accent={{ color: C.orange, soft: C.orangeSoft }} />
        <KpiCard label="Günlük Aktif Kullanıcı" value={STATS.dailyActive.toLocaleString('tr')} delta="12%" deltaUp icon={icons.users} accent={{ color: C.blue, soft: C.blueSoft }} />
        <KpiCard label="Bekleyen Başvuru" value={STATS.pendingApps} icon={icons.inbox} accent={{ color: C.yellow, soft: C.yellowSoft }} />
        <KpiCard label="Aylık Gelir" value={`₺${(STATS.monthlyRevenue / 1000).toFixed(0)}K`} delta="18%" deltaUp icon={icons.money} accent={{ color: C.green, soft: C.greenSoft }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Kaydırma trendi */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Haftalık Kaydırma Aktivitesi</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: C.dim }}>Toplam {(STATS.totalSwipes / 1000).toFixed(0)}K kaydırma</p>
            </div>
            <Badge text="↑ 15% bu hafta" color={C.green} soft={C.greenSoft} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 180 }}>
            {SWIPE_TREND.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 10.5, color: C.faint, fontWeight: 600 }}>{(d.v / 1000).toFixed(0)}K</div>
                <div style={{ width: '100%', height: `${(d.v / maxSwipe) * 130}px`, background: `linear-gradient(180deg, ${C.orange}, ${C.orange}66)`, borderRadius: '6px 6px 0 0', transition: 'height 0.4s' }} />
                <div style={{ fontSize: 11, color: C.dim }}>{d.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Kategori dağılımı */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Kategori Dağılımı</h3>
          {CAT_DIST.map((c, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: C.text }}>{c.name}</span>
                <span style={{ fontSize: 12.5, color: C.dim, fontWeight: 600 }}>{c.count}</span>
              </div>
              <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(c.count / totalCat) * 100}%`, height: '100%', background: c.color, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alt satır: hızlı özet */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Aktif Restoran', value: STATS.activeRestaurants, icon: icons.store, color: C.green },
          { label: 'Gastro Onaylı', value: STATS.gastroApproved, icon: icons.star, color: C.orange },
          { label: 'Toplam Kullanıcı', value: STATS.totalUsers.toLocaleString('tr'), icon: icons.users, color: C.blue },
          { label: 'Toplam Kaydırma', value: `${(STATS.totalSwipes / 1000).toFixed(0)}K`, icon: icons.trend, color: C.yellow },
        ].map((s, i) => (
          <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Icon path={s.icon} size={22} color={s.color} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: 11.5, color: C.dim }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableShell({ headers, children }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: h.right ? 'right' : 'left', padding: '13px 18px', fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h.label || h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// Aktif gelir fazı. Buradan yapılan seçim hem yönetici panelini hem de
// tüketici uygulamasını etkiler: kilitli fazın gelir kalemleri uygulamada
// da görünmez (bkz. src/lib/phase.js).
function PhaseSwitch() {
  const phase = usePhase();
  const info = PHASES.find(p => p.id === phase);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 18 }}>
      <div style={{ display: 'flex', gap: 3, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: 3 }}>
        {PHASES.map(p => {
          const on = p.id === phase;
          return (
            <motion.button
              key={p.id} onClick={() => setPhase(p.id)} className="gur-admin-btn"
              data-phase={p.id} aria-pressed={on} title={p.name}
              whileTap={{ scale: 0.97 }} transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 7, padding: '5px 11px',
                background: on ? C.orange : 'transparent', color: on ? '#fff' : C.dim,
                fontFamily: F, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', outline: 'none',
              }}>{p.short}</motion.button>
          );
        })}
      </div>
      <span style={{ fontSize: 11, color: C.faint, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={info.name}>{info.name}</span>
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 11, padding: 4, marginBottom: 16, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <motion.button
            key={t.id} onClick={() => onChange(t.id)} className="gur-admin-btn"
            data-tab={t.id} aria-pressed={on}
            whileTap={{ scale: 0.98 }} transition={{ type: 'spring', bounce: 0, duration: 0.15 }}
            style={{
              border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 14px',
              background: on ? C.panel2 : 'transparent', color: on ? C.text : C.dim,
              fontFamily: F, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
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
    <span style={{ fontSize: size, color: C.orange, letterSpacing: 1 }}>
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
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: F, fontSize: 12.5, fontWeight: 600, color: C.blue, outline: 'none' }}>
            {v.restName}
          </button>
        )}
        <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
          {daysAgoLabel(v.days)} • {formatDate(v.date)}
        </span>
        {v.flagged && <Badge text="Şikayet edildi" color={C.red} soft={C.redSoft} />}
        {low && !v.flagged && <Badge text={`${v.stars} puan`} color={C.yellow} soft={C.yellowSoft} />}
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
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: '40px 20px', textAlign: 'center', color: C.faint, fontSize: 13 }}>
        {empty}
      </div>
    );
  }
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      {reviews.map(v => (
        <ReviewCard key={v.key} v={v} showRestaurant onOpenRestaurant={onOpenRestaurant}
          hidden={hidden.has(v.key)} onHide={onHide} />
      ))}
    </div>
  );
}

function RestaurantDetailPage({ r, onBack, onGastro, onSuspend }) {
  const menus = useMemo(() => restaurantMenus(r), [r.id]);
  const reviews = useMemo(() => restaurantReviews(r), [r.id]);
  const planColor = { Premium: C.orange, Pro: C.blue, 'Ücretsiz': C.faint };

  // Yorum dağılımı — rozet kararını verirken bakılan asıl kanıt
  const dist = [5, 4, 3, 2, 1].map(star => ({ star, n: reviews.filter(v => v.stars === star).length }));
  const maxN = Math.max(1, ...dist.map(d => d.n));
  const flagged = reviews.filter(v => v.flagged).length;

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <Btn label="Restoranlar" onClick={onBack} variant="ghost" size="sm"
          icon={<Icon path="M15 18l-6-6 6-6" size={14} color={C.dim} />} />
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#FF660033,#FF3B3033)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: C.orange, flexShrink: 0 }}>{r.name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{r.name}</h2>
            {r.gastro && <Badge text="★ Gastro Onaylı" color={C.orange} soft={C.orangeSoft} />}
          </div>
          <div style={{ fontSize: 12.5, color: C.dim, marginTop: 2 }}>{r.cat} • {r.district}</div>
        </div>
        <Btn
          label={r.status === 'active' ? 'Askıya Al' : 'Aktifleştir'} onClick={() => onSuspend(r.id)}
          variant="outline" tone={r.status === 'active' ? 'yellow' : 'green'} size="sm"
        />
      </div>

      {/* Özet şeridi — listedeki bölge/puan/plan/durum bilgileri burada da görünür */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 16, overflow: 'hidden' }}>
        <MetaCell label="Bölge">{r.district}</MetaCell>
        <MetaCell label="Puan"><span style={{ color: C.orange }}>★</span> {r.rating} <span style={{ color: C.faint, fontWeight: 500, fontSize: 12 }}>({r.reviews.toLocaleString('tr')})</span></MetaCell>
        <MetaCell label="Plan"><span style={{ color: planColor[r.plan] }}>{r.plan}</span></MetaCell>
        <MetaCell label="Durum"><StatusBadge status={r.status} /></MetaCell>
        <MetaCell label="Katılım">{formatDate(r.joined)}</MetaCell>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: 16, alignItems: 'start' }}>

        {/* ─── MENÜLER ─── */}
        <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <header style={{ padding: '13px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Menüler</span>
            <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{menus.length}</span>
          </header>
          <div>
            {menus.map((m, i) => (
              <div key={m.name} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.orangeSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon path={icons.doc} size={15} color={C.orange} />
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
        <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <header style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Yorumlar</span>
            <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
              son {reviews.length} yorum{flagged > 0 && <span style={{ color: C.red }}> • {flagged} şikayetli</span>}
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
                  {v.flagged && <Badge text="Şikayet edildi" color={C.red} soft={C.redSoft} />}
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
  const filtered = restaurants.filter(r => r.name.toLowerCase().includes(query.toLowerCase()) || r.cat.toLowerCase().includes(query.toLowerCase()));
  const planColor = { Premium: C.orange, Pro: C.blue, 'Ücretsiz': C.faint };
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <TableShell headers={['Restoran', 'Kategori', 'Bölge', 'Puan', 'Plan', 'Durum', { label: 'İşlemler', right: true }]}>
        {filtered.map(r => (
          <tr key={r.id} className="row-hover" onClick={() => onOpen(r.id)} title={`${r.name} detayını aç`}
            style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.1s', cursor: 'pointer' }}>
            <td style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#FF660033,#FF3B3033)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: C.orange }}>{r.name[0]}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.name}
                    {r.gastro && <span title="Gastro Onaylı" style={{ color: C.orange, display: 'inline-flex' }}><Icon path={icons.star} size={13} color={C.orange} fill={C.orange} /></span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint }}>{r.reviews.toLocaleString('tr')} yorum</div>
                </div>
              </div>
            </td>
            <td style={{ padding: '14px 18px', fontSize: 13, color: C.dim }}>{r.cat}</td>
            <td style={{ padding: '14px 18px', fontSize: 13, color: C.dim }}>{r.district}</td>
            <td style={{ padding: '14px 18px', fontSize: 13, fontWeight: 600 }}>★ {r.rating}</td>
            <td style={{ padding: '14px 18px' }}><span style={{ fontSize: 12, fontWeight: 600, color: planColor[r.plan] }}>{r.plan}</span></td>
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
    { id: 'list', label: 'Restoranlar', count: restaurants.length },
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
            <Icon path={icons.ban} size={16} color={C.red} />
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

function ApplicationsPage({ apps, onReview, onApprove, onReject }) {
  if (apps.length === 0) {
    return (
      <div style={{ animation: 'fadeIn 0.2s', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 60, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: 16, background: C.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Icon path={icons.check} size={30} color={C.green} />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>Bekleyen başvuru yok</h3>
        <p style={{ margin: 0, fontSize: 13.5, color: C.dim }}>Tüm restoran başvuruları değerlendirildi.</p>
      </div>
    );
  }
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <div style={{ marginBottom: 16, padding: '12px 16px', background: C.yellowSoft, border: `1px solid ${C.yellow}44`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon path={icons.inbox} size={18} color={C.yellow} />
        <span style={{ fontSize: 13, color: C.text }}><b>{apps.length} başvuru</b> vergi levhası doğrulaması bekliyor.</span>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {apps.map(a => (
          <div key={a.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#FF660033,#FF3B3033)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: C.orange, flexShrink: 0 }}>{a.name[0]}</div>
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
        <Icon path={icons.star} size={16} color={C.orange} fill={C.orange} />
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
                textAlign: 'left', cursor: 'pointer', fontFamily: F, outline: 'none',
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
                <span><b style={{ color: C.orange, fontSize: 13 }}>{c.list.length}</b> değerlendirme</span>
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

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
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
                {v.gastro && <Badge text="★ Gastro Onaylı" color={C.orange} soft={C.orangeSoft} />}
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
const REVENUE_STREAMS = [
  { key: 'bannerAds', name: 'Dönen keşfet banner\'ı', kind: 'Reklam', monthly: 128000, unit: '42 aktif kampanya', note: 'Keşfet ekranının üstündeki marka + sponsor karuseli.' },
  { key: 'pushAds', name: 'Push bildirim reklamları', kind: 'Reklam', monthly: 74000, unit: '41 gönderim / ay', note: 'Semt bazlı tek seferlik bildirim satışı.' },
  { key: 'rewardedAds', name: 'Ödüllü video reklam (kaydırma hakkı)', kind: 'Sponsorluk', monthly: 96000, unit: '~%78 tamamlanma', note: '10 kaydırma sonrası izlenen video, +5 hak kazandırır.' },
  { key: 'secondChance', name: 'İkinci Şans yerleşimi', kind: 'Performans', monthly: 41000, unit: '86 restoran', note: 'Geçilen restoranın desteye geri girmesi.' },
  { key: 'instantDeals', name: 'Anlık fırsat bildirimleri', kind: 'Performans', monthly: 63000, unit: '140 yayın / ay', note: 'Ölü saat doldurma; yayın başına ücret.' },
  { key: 'reservations', name: 'Rezervasyon ve menü komisyonu', kind: 'İşlem', monthly: 88000, unit: '%8 komisyon', note: 'Gerçekleşen işlem başına alınır.' },
  { key: 'chefVideo', name: 'Gastro şefli video paketi', kind: 'İçerik', monthly: 52000, unit: '8 çekim / ay', note: 'Üç büyük semtte VIP marka algısı.' },
  { key: 'contentLicense', name: 'Gastro içerik lisanslama', kind: 'İçerik', monthly: 39000, unit: '6 lisans / ay', note: '15 sn dikey videonun restorana devri.' },
  { key: 'analyticsSaas', name: 'Restoran Analiz Paneli (SaaS)', kind: 'Abonelik', monthly: 145000, unit: '50 abone', note: 'Tıklama, kaydetme ve konum ilgisi verisi.' },
];

const KIND_TONE = {
  'Reklam': C.blue, 'Sponsorluk': C.orange, 'Performans': C.green,
  'İşlem': C.yellow, 'İçerik': C.red, 'Abonelik': C.orange,
};

function RevenuePage() {
  const phase = usePhase();
  const plans = [
    { name: 'Premium', price: 4999, count: 42, color: C.orange },
    { name: 'Pro', price: 1999, count: 118, color: C.blue },
    { name: 'Ücretsiz', price: 0, count: 182, color: C.faint },
  ];
  const subsRev = plans.reduce((a, p) => a + p.price * p.count, 0);

  const streams = REVENUE_STREAMS.map(x => ({ ...x, phase: FEATURE_PHASE[x.key], live: phase >= FEATURE_PHASE[x.key] }));
  const liveStreams = streams.filter(x => x.live);
  const streamRev = liveStreams.reduce((a, x) => a + x.monthly, 0);
  const total = subsRev + streamRev;
  const locked = streams.length - liveStreams.length;
  const potential = streams.reduce((a, x) => a + x.monthly, 0) + subsRev;
  const maxMonthly = Math.max(...streams.map(x => x.monthly));

  const money = (n) => `₺${(n / 1000).toFixed(0)}K`;

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Aylık Yinelenen Gelir" value={money(total)} delta="18%" deltaUp icon={icons.money} accent={{ color: C.green, soft: C.greenSoft }} />
        <KpiCard label="Abonelikten" value={money(subsRev)} delta="9%" deltaUp icon={icons.store} accent={{ color: C.orange, soft: C.orangeSoft }} />
        <KpiCard label="Diğer Gelir Kalemleri" value={money(streamRev)} delta="24%" deltaUp icon={icons.trend} accent={{ color: C.blue, soft: C.blueSoft }} />
        <KpiCard label="Kilitli Kalem" value={`${locked}`} delta={`+${money(potential - total)} potansiyel`} deltaNeutral icon={icons.chart} accent={{ color: C.yellow, soft: C.yellowSoft }} />
      </div>

      {/* Faz planı */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {PHASES.map(p => {
          const on = phase >= p.id;
          const active = phase === p.id;
          const rev = streams.filter(x => x.phase === p.id).reduce((a, x) => a + x.monthly, 0);
          return (
            <div key={p.id} style={{
              background: C.panel,
              border: `1px solid ${active ? C.orange + '77' : C.border}`,
              borderLeft: `3px solid ${on ? C.orange : C.border}`,
              borderRadius: 12, padding: '15px 17px', opacity: on ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: on ? C.orange : C.faint }}>{p.short}</span>
                {active && <Badge text="Aktif" color={C.green} soft={C.greenSoft} />}
                {!on && <Badge text="Kilitli" color={C.faint} soft={C.panel2} />}
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: on ? C.text : C.faint, fontVariantNumeric: 'tabular-nums' }}>{money(rev)}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5, marginBottom: 10 }}>{p.summary}</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {p.added.map(a => (
                  <div key={a} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <span style={{ color: on ? C.green : C.faint, fontSize: 11, lineHeight: 1.5 }}>+</span>
                    <span style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.5 }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gelir kalemleri */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
        <header style={{ padding: '13px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gelir Kalemleri</span>
          <span style={{ fontSize: 11.5, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{liveStreams.length}/{streams.length} açık</span>
        </header>
        {streams.map((x, i) => (
          <div key={x.key} style={{ padding: '13px 18px', borderTop: i ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', gap: 14, opacity: x.live ? 1 : 0.45 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.live ? KIND_TONE[x.kind] : C.border, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{x.name}</span>
                <Badge text={`Faz ${x.phase}`} color={x.live ? C.orange : C.faint} soft={x.live ? C.orangeSoft : C.panel2} />
                <Badge text={x.kind} color={KIND_TONE[x.kind]} soft={C.panel2} />
                {!x.live && <span style={{ fontSize: 11, color: C.faint }}>Faz {x.phase}'te açılıyor</span>}
              </div>
              <div style={{ fontSize: 11.5, color: C.faint }}>{x.note}</div>
            </div>
            <div style={{ width: 120, flexShrink: 0 }}>
              <div style={{ height: 5, borderRadius: 3, background: C.bg, overflow: 'hidden' }}>
                <div style={{ width: `${(x.monthly / maxMonthly) * 100}%`, height: '100%', borderRadius: 3, background: x.live ? KIND_TONE[x.kind] : C.border }} />
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 96, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: x.live ? C.text : C.faint, fontVariantNumeric: 'tabular-nums' }}>{money(x.monthly)}</div>
              <div style={{ fontSize: 10.5, color: C.faint }}>{x.unit}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Abonelikler */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Abonelik Paketleri</h3>
        {plans.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: i < plans.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: C.faint }}>{p.price === 0 ? 'Ücretsiz plan' : `₺${p.price.toLocaleString('tr')}/ay`}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{p.count}</div>
              <div style={{ fontSize: 11, color: C.faint }}>restoran</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 90 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: p.color }}>{money(p.price * p.count)}</div>
              <div style={{ fontSize: 11, color: C.faint }}>aylık</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  const [toggles, setToggles] = useState({ autoApprove: false, gastroPublic: true, newReviews: true, maintenance: false });
  const items = [
    { key: 'autoApprove', label: 'Otomatik başvuru onayı', desc: 'Vergi levhası yüklenen başvurular otomatik onaylanır (önerilmez)' },
    { key: 'gastroPublic', label: 'Gastro Onaylı rozetini göster', desc: 'Onaylı restoranlar uygulamada rozet ile öne çıkar' },
    { key: 'newReviews', label: 'Yeni yorum bildirimleri', desc: 'Şikayet edilen yorumlar için anlık bildirim al' },
    { key: 'maintenance', label: 'Bakım modu', desc: 'Uygulamayı geçici olarak kullanıma kapat' },
  ];
  return (
    <div style={{ animation: 'fadeIn 0.2s', maxWidth: 680 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{it.label}</div>
              <div style={{ fontSize: 12.5, color: C.dim }}>{it.desc}</div>
            </div>
            <button onClick={() => setToggles(t => ({ ...t, [it.key]: !t[it.key] }))} className="gur-admin-btn" style={{ width: 46, height: 26, borderRadius: 13, border: 'none', background: toggles[it.key] ? C.orange : C.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, outline: 'none' }}>
              <div style={{ position: 'absolute', top: 3, left: toggles[it.key] ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
