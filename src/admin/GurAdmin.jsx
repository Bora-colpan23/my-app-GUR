import React, { useState } from 'react';
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

export default function GurAdmin() {
  const [page, setPage] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [apps, setApps] = useState(APPLICATIONS);
  const [restaurants, setRestaurants] = useState(RESTAURANTS);
  const [reviewDoc, setReviewDoc] = useState(null);
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
    { id: 'reviews', label: 'Yorumlar', icon: icons.msg },
    { id: 'revenue', label: 'Gelir & Reklam', icon: icons.money },
    { id: 'settings', label: 'Ayarlar', icon: icons.settings },
  ];

  const pageTitle = nav.find(n => n.id === page)?.label || 'Genel Bakış';

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
            return <NavItem key={item.id} item={item} active={active} onClick={() => setPage(item.id)} />;
          })}
        </nav>

        <div style={{ padding: '12px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#FF6600,#FF3B30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Admin</div>
              <div style={{ fontSize: 10.5, color: C.faint }}>admin@gur.app</div>
            </div>
            <IconBtn size={30} title="Çıkış yap" danger icon={<Icon path={icons.logout} size={16} color={C.faint} />} />
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
          {page === 'restaurants' && <RestaurantsPage restaurants={restaurants} query={query} onGastro={toggleGastro} onSuspend={toggleSuspend} />}
          {page === 'applications' && <ApplicationsPage apps={apps} onReview={setReviewDoc} onApprove={approveApp} onReject={rejectApp} />}
          {page === 'gastro' && <GastroPage restaurants={restaurants} onGastro={toggleGastro} />}
          {page === 'users' && <UsersPage query={query} />}
          {page === 'reviews' && <ReviewsPage />}
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

function KpiCard({ label, value, delta, deltaUp, icon, accent }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon path={icon} size={20} color={accent.color} />
        </div>
        {delta && (
          <span style={{ fontSize: 12, fontWeight: 600, color: deltaUp ? C.green : C.red, display: 'flex', alignItems: 'center', gap: 3 }}>
            {deltaUp ? '↑' : '↓'} {delta}
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

function RestaurantsPage({ restaurants, query, onGastro, onSuspend }) {
  const filtered = restaurants.filter(r => r.name.toLowerCase().includes(query.toLowerCase()) || r.cat.toLowerCase().includes(query.toLowerCase()));
  const planColor = { Premium: C.orange, Pro: C.blue, 'Ücretsiz': C.faint };
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <TableShell headers={['Restoran', 'Kategori', 'Bölge', 'Puan', 'Plan', 'Durum', { label: 'İşlemler', right: true }]}>
        {filtered.map(r => (
          <tr key={r.id} className="row-hover" style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.1s' }}>
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
            <td style={{ padding: '14px 18px', textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', gap: 6 }}>
                <Btn
                  label="Gastro" onClick={() => onGastro(r.id)} title={r.gastro ? 'Gastro onayını kaldır' : 'Gastro Onaylı yap'}
                  variant={r.gastro ? 'soft' : 'ghost'} tone={r.gastro ? 'orange' : 'neutral'} size="sm"
                  icon={<Icon path={icons.star} size={13} color={r.gastro ? C.orange : C.dim} fill={r.gastro ? C.orange : 'none'} />}
                />
                <Btn
                  label={r.status === 'active' ? 'Askıya Al' : 'Aktifleştir'} onClick={() => onSuspend(r.id)}
                  title={r.status === 'active' ? 'Askıya al' : 'Aktifleştir'}
                  variant="ghost" tone={r.status === 'active' ? 'yellow' : 'green'} size="sm"
                />
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
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

function GastroPage({ restaurants, onGastro }) {
  const approved = restaurants.filter(r => r.gastro);
  const candidates = restaurants.filter(r => !r.gastro && r.rating >= 4.4);
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      {/* Şefler */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: C.dim }}>ONAYLAYAN ŞEFLER</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {CHEFS.map(c => (
            <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#FF6600,#FF3B30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 15 }}>{c.name.split(' ')[1][0]}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.faint }}>{c.specialty}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.dim }}><b style={{ color: C.orange }}>{c.endorsements}</b> onay verdi</div>
            </div>
          ))}
        </div>
      </div>

      {/* Onaylı restoranlar */}
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: C.dim }}>GASTRO ONAYLI RESTORANLAR ({approved.length})</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {approved.map(r => (
          <div key={r.id} style={{ background: C.panel, border: `1px solid ${C.orange}44`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
              <Icon path={icons.star} size={16} color={C.orange} fill={C.orange} />
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>{r.cat} • ★ {r.rating}</div>
            <Btn label="Onayı Kaldır" onClick={() => onGastro(r.id)} variant="ghost" tone="red" fullWidth />
          </div>
        ))}
      </div>

      {/* Aday restoranlar */}
      {candidates.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: C.dim }}>ADAY RESTORANLAR (4.4+ puan)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {candidates.map(r => (
              <div key={r.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>{r.cat} • ★ {r.rating}</div>
                <Btn label="Gastro Onaylı Yap" onClick={() => onGastro(r.id)} variant="filled" tone="orange" fullWidth icon={<Icon path={icons.star} size={13} color="#fff" fill="#fff" />} />
              </div>
            ))}
          </div>
        </>
      )}
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

function ReviewsPage() {
  const reviews = [
    { user: 'Elif K.', rest: 'Nusr-Et Steakhouse', stars: 5, text: 'Muhteşem lezzetler, kesinlikle tavsiye ederim.', flagged: false },
    { user: 'Anonim', rest: 'Klein Bistro', stars: 1, text: 'Bu mekan berbat, herkese kötü davranıyorlar!!!', flagged: true },
    { user: 'Mert S.', rest: 'Çiya Sofrası', stars: 5, text: 'Şehirdeki en iyi mekan, personel çok ilgili.', flagged: false },
    { user: 'Zeynep A.', rest: 'The Burger Joint', stars: 3, text: 'Yemekler güzeldi ama bekleme süresi uzundu.', flagged: false },
  ];
  return (
    <div style={{ animation: 'fadeIn 0.2s', display: 'grid', gap: 12 }}>
      {reviews.map((r, i) => (
        <div key={i} style={{ background: C.panel, border: `1px solid ${r.flagged ? C.red + '44' : C.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.user}</span>
              <span style={{ fontSize: 12.5, color: C.faint }}> → {r.rest}</span>
              <div style={{ fontSize: 12, color: C.orange, marginTop: 2 }}>{'★'.repeat(r.stars)}<span style={{ color: C.border }}>{'★'.repeat(5 - r.stars)}</span></div>
            </div>
            {r.flagged && <Badge text="⚠ Şikayet edildi" color={C.red} soft={C.redSoft} />}
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: C.dim, lineHeight: 1.5 }}>{r.text}</p>
          {r.flagged && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn label="Yorumu Kaldır" variant="soft" tone="red" />
              <Btn label="Onayla" variant="outline" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RevenuePage() {
  const plans = [
    { name: 'Premium', price: 4999, count: 42, color: C.orange },
    { name: 'Pro', price: 1999, count: 118, color: C.blue },
    { name: 'Ücretsiz', price: 0, count: 182, color: C.faint },
  ];
  const monthlyRev = plans.reduce((a, p) => a + p.price * p.count, 0);
  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label="Aylık Yinelenen Gelir" value={`₺${(monthlyRev / 1000).toFixed(0)}K`} delta="18%" deltaUp icon={icons.money} accent={{ color: C.green, soft: C.greenSoft }} />
        <KpiCard label="Ücretli Abonelik" value={plans[0].count + plans[1].count} delta="9%" deltaUp icon={icons.store} accent={{ color: C.orange, soft: C.orangeSoft }} />
        <KpiCard label="Dönüşüm Oranı" value="%46" delta="3%" deltaUp icon={icons.trend} accent={{ color: C.blue, soft: C.blueSoft }} />
      </div>

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
              <div style={{ fontSize: 15, fontWeight: 700, color: p.color }}>₺{((p.price * p.count) / 1000).toFixed(0)}K</div>
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
