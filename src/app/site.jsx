// ═══════════════════════════════════════════════════════════════════════
// GUR — TANITIM WEB SİTESİ (tüketici)
//
// GUR dört parçadan oluşuyor ve bu, birincisi:
//
//   /           → TANITIM SİTESİ (burası) — anlatır ve MAĞAZAYA yollar
//   /isletme/*  → restoran kayıt sitesi (Doyurucu)
//   /admin      → yönetici paneli
//   mobile/     → mobil uygulama (Expo; App Store + Google Play)
//
// TARAYICIDA TÜKETİCİ UYGULAMASI YOK. Bir dönem vardı ve kök yol
// genişliğe göre dallanıyordu (telefonda uygulama, masaüstünde site);
// iki kabuk aynı işi yapınca hangisinin gerçek ürün olduğu okunmuyordu.
// Tek cevap: site anlatır, mağaza indirtir, uygulama çalışır. Bu yüzden
// sitenin birincil eylemi "uygulamayı aç" değil App Store / Google Play
// (bkz. aşağıdaki MAGAZA).
//
// ─── TASARIM DİLİ: KILAVUZ vs PROJE ─────────────────────────────────
// Katman `high-end-visual-design` kılavuzuyla kuruldu. Kılavuzun bazı
// maddeleri PROJENİN KENDİ KURALLARIYLA ÇAKIŞIYOR; çakışanlarda proje
// kazandı. Tablo CLAUDE.md'de.
//
// UYGULANANLAR: "Editorial Luxury" doku (kremsi kâğıt + film grenli
// kaplama + yüksek kontrastlı iri başlık), kahramanda "Editorial Split",
// özelliklerde asimetrik bento, her kartta çift bizel (dış tepsi + iç
// çekirdek, eş merkezli yarıçap), haplarda düğme-içinde-düğme simge
// cebi, 112 px bölüm dolgusu, özel cubic-bezier ve `whileInView` giriş.
//
// SÜREKLİ HAREKET YOK: giriş animasyonları var ama sayfada sonsuz
// dönen/salınan bir nesne bilinçli olarak yok — 0.2 Hz civarındaki
// salınım vestibüler rahatsızlık kaynağı.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  GurLogo, Icon, Btn, Img, GurStyles, useMediaQuery, GENIS, ELEV,
} from '../ui/kit.jsx';
import { I } from '../data/restaurants.js';
import { MAGAZA, MAGAZA_HAZIR } from '../lib/magaza.js';

export const KAP = 1180;                       // içerik kabının en geniş hâli
const EGRI = [0.16, 1, 0.3, 1];                // giriş eğrisi (Motion dizisi)
const EGRI_CSS = "cubic-bezier(0.16,1,0.3,1)"; // aynısının CSS karşılığı

// ─── Film greni ──────────────────────────────────────────────────────
// Kremsi kâğıdın fiziksel bir yüzey gibi okunmasını sağlayan tek şey.
// SABİT ve `pointer-events: none`: kayan bir kabın içine konsaydı her
// karede yeniden boyanır ve mobilde kare düşürürdü.
export function Grain({ z = 90, opacity = 0.045 }) {
  const gren = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">' +
    '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3"/>' +
    '<feColorMatrix type="saturate" values="0"/></filter>' +
    '<rect width="140" height="140" filter="url(#n)"/></svg>'
  );
  return (
    <div aria-hidden="true" style={{
      position: "fixed", inset: 0, zIndex: z, pointerEvents: "none",
      backgroundImage: `url("${gren}")`, backgroundSize: "140px 140px",
      opacity, mixBlendMode: "multiply",
    }} />
  );
}

// ─── Giriş animasyonu ────────────────────────────────────────────────
// Hiçbir öğe durağan belirmiyor: görüş alanına girerken ağır bir yukarı
// süzülme. `once: true` — kullanıcı yukarı kaydırdığında sayfa yeniden
// canlanmıyor, bu bir gösteri değil.
export function Belir({ children, gecikme = 0, y = 28, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.72, delay: gecikme, ease: EGRI }}
      style={style}
    >{children}</motion.div>
  );
}

// ─── Çift bizel ──────────────────────────────────────────────────────
// Kart doğrudan zemine konmuyor: hafif koyu bir TEPSİ içinde oturuyor.
// Yarıçaplar eş merkezli (iç = dış − dolgu), yoksa iki köşe birbirini
// kesiyor ve kutu makineyle işlenmiş gibi durmuyor.
export function Bezel({ children, r = 30, pad = 7, tepsi, cekirdek, style, icStyle }) {
  return (
    <div style={{
      background: tepsi || "var(--c-bg-2)", border: "1px solid var(--c-border)",
      borderRadius: r, padding: pad, boxShadow: ELEV.restLight, ...style,
    }}>
      <div style={{
        background: cekirdek || "var(--c-card)", borderRadius: Math.max(6, r - pad),
        height: "100%", overflow: "hidden", ...icStyle,
      }}>{children}</div>
    </div>
  );
}

// ─── Kaş etiketi ─────────────────────────────────────────────────────
export function Kas({ children, tone = "light" }) {
  const koyu = tone === "dark";
  return (
    <span style={{
      display: "inline-block", fontFamily: "var(--f-body)", fontSize: 10.5,
      fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase",
      color: koyu ? "#FF9A4D" : "var(--c-brand-ink-soft)",
      background: koyu ? "rgba(255,154,77,0.12)" : "var(--c-brand-soft)",
      border: `1px solid ${koyu ? "rgba(255,154,77,0.2)" : "rgba(255,102,0,0.16)"}`,
      borderRadius: 999, padding: "6px 12px",
    }}>{children}</span>
  );
}

// ─── Bölüm ───────────────────────────────────────────────────────────
// Dolgu bilinçli olarak büyük: tasarım nefes alsın. Telefonda 0.52
// katsayıyla iniyor — masaüstü dolgusu 390 px'te ekranın yarısını
// harcıyordu.
function Bolum({ id, children, bg = "transparent", pad = 112, en = KAP }) {
  const genis = useMediaQuery(GENIS);
  return (
    <section id={id} style={{
      background: bg, padding: `${genis ? pad : Math.round(pad * 0.52)}px 20px`,
      scrollMarginTop: 96,   // sabit ada gezinmesi başlığı yutmasın
    }}>
      <div style={{ maxWidth: en, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function Baslik({ kas, baslik, aciklama, orta = true, tone = "light", en = 680 }) {
  const genis = useMediaQuery(GENIS);
  const koyu = tone === "dark";
  return (
    <div style={{
      textAlign: orta ? "center" : "left", maxWidth: orta ? en : "none",
      margin: orta ? "0 auto 48px" : "0 0 48px",
    }}>
      {kas && <div style={{ marginBottom: 18 }}><Kas tone={tone}>{kas}</Kas></div>}
      <h2 style={{
        fontFamily: "var(--f-display)", fontSize: genis ? 38 : 27, fontWeight: 800,
        letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0,
        color: koyu ? "var(--c-bg)" : "var(--c-ink)",
      }}>{baslik}</h2>
      {aciklama && (
        <p style={{
          fontFamily: "var(--f-body)", fontSize: genis ? 17 : 15.5, lineHeight: 1.62,
          color: koyu ? "rgba(253,251,247,0.72)" : "var(--c-muted)",
          margin: "14px 0 0", maxWidth: orta ? "none" : 560,
        }}>{aciklama}</p>
      )}
    </div>
  );
}

// MAĞAZA BAĞLANTILARI. İki adres `src/lib/magaza.js` içinde — işletme
// sitesinin alt bilgisi de aynı yerden okuyor. Buradan yeniden dışa
// aktarılıyor ki sayfayı okuyan eski içe aktarmalar kırılmasın.
export { MAGAZA, MAGAZA_HAZIR };

const APPLE_GLYPH = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.53c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.98.9-3.77 2.28-1.61 2.79-.41 6.92 1.15 9.18.76 1.11 1.67 2.35 2.86 2.3 1.15-.05 1.58-.74 2.97-.74s1.78.74 3 .72c1.24-.02 2.02-1.12 2.78-2.24.87-1.28 1.23-2.53 1.25-2.6-.03-.01-2.4-.92-2.4-3.68zM14.8 5.53c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.68-1.09 1.77-.95 2.81 1.02.08 2.06-.52 2.68-1.28z" />
  </svg>
);

// Google Play üçgeni: Google'ın kendi marka renkleri paletin kural
// dışılarından (bkz. CLAUDE.md → "Tutarlı renk seçimi").
const PLAY_GLYPH = (
  <svg width="18" height="19" viewBox="0 0 24 26" aria-hidden="true">
    <path d="M2.1 1.2C1.7 1.6 1.5 2.2 1.5 3v20c0 .8.2 1.4.6 1.8l.1.1L13.4 13v-.2L2.2 1.2h-.1z" fill="#34A853" />
    <path d="M17.1 16.8 13.4 13v-.2l3.7-3.8.1.1 4.4 2.5c1.3.7 1.3 1.9 0 2.6l-4.4 2.5-.1.1z" fill="#FBBC05" />
    <path d="m17.2 16.7-3.8-3.8L2.1 24.8c.4.5 1.1.5 1.9.1l13.2-8.2" fill="#EA4335" />
    <path d="M17.2 9.1 4 1c-.8-.5-1.5-.4-1.9.1l11.3 11.8 3.8-3.8z" fill="#4285F4" />
  </svg>
);

// Tek rozet. Adres varsa gerçek bir bağlantı (yeni sekme), yoksa
// tıklanamaz bir çip. Devre dışı hap DEĞİL: projede pasif durumu
// `opacity` ile kurmak yasak ve soluk bir hap zaten okunmuyordu —
// fark RENKLE ve "YAKINDA" etiketiyle.
function MagazaRozeti({ tur }) {
  const url = tur === "ios" ? MAGAZA.ios : MAGAZA.android;
  const ad = tur === "ios" ? "App Store" : "Google Play";
  const glif = tur === "ios" ? APPLE_GLYPH : PLAY_GLYPH;
  const ortak = {
    display: "inline-flex", alignItems: "center", gap: 11,
    minHeight: 56, padding: "0 24px", borderRadius: 999,
    fontFamily: "var(--f-body)", fontWeight: 700, fontSize: 15,
    textDecoration: "none", whiteSpace: "nowrap",
  };

  if (!url) {
    return (
      <span style={{
        ...ortak, background: "var(--c-bg-2)", border: "1px solid var(--c-line)",
        color: "var(--c-muted)", cursor: "default",
      }}>
        <span style={{ display: "inline-flex", color: "var(--c-muted)" }}>{glif}</span>
        {ad}
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", borderRadius: 999,
          padding: "4px 9px", background: "var(--c-card)", border: "1px solid var(--c-line)",
          color: "var(--c-ink-2)",
        }}>YAKINDA</span>
      </span>
    );
  }

  const koyuHap = tur === "ios";
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="gur-btn"
      style={{
        ...ortak,
        "--btn-bg": koyuHap ? "var(--c-espresso)" : "var(--c-card)",
        "--btn-bg-hover": koyuHap ? "#241E18" : "#FAF8F6",
        "--btn-bg-press": koyuHap ? "#0D0A08" : "#F1ECE7",
        "--btn-shadow": "var(--sh-2)", "--btn-shadow-press": "var(--sh-1)",
        border: koyuHap ? "1px solid transparent" : "1px solid var(--c-line)",
        color: koyuHap ? "var(--c-bg)" : "var(--c-ink)",
      }}>
      <span style={{ display: "inline-flex" }}>{glif}</span>
      {ad}
    </a>
  );
}

// İki rozet + altındaki dürüst satır. Adresler boşken burada bir yalan
// yazmıyoruz: "yakında" diyoruz ve o kadar.
export function MagazaRozetleri({ orta = false, not = true }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: orta ? "center" : "flex-start" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: orta ? "center" : "flex-start" }}>
        <MagazaRozeti tur="ios" />
        <MagazaRozeti tur="android" />
      </div>
      {not && (
        <p style={{
          fontFamily: "var(--f-body)", fontSize: 13.5, color: "var(--c-muted)",
          margin: 0, lineHeight: 1.6, textAlign: orta ? "center" : "left",
        }}>
          {MAGAZA_HAZIR
            ? "Ücretsiz indirilir · iOS 15+ ve Android 8+"
            : "Mağaza sürümleri yayına hazırlanıyor."}
        </p>
      )}
    </div>
  );
}

const OK = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="19" x2="19" y2="5" /><polyline points="11 5 19 5 19 13" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════
// GEZİNME — YÜZEN ADA
//
// Kılavuzun yasakladığı şey "ekranın üstüne yapışmış kenardan kenara
// çubuk". Bunun yerine ortada duran, kenarlardan kopmuş bir cam hap.
// `backdrop-filter` yalnızca SABİT öğede: kayan bir kapta her karede GPU
// yeniden boyar.
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// TEK SİTE, İKİ İZLEK
//
// Tanıtım (`/`) ve işletme (`/isletme/*`) bir dönem İKİ AYRI SİTEYDİ: iki
// başlık, iki alt bilgi, iki gezinme, iki ayrı "GUR" logosu. Ziyaretçi
// aralarında geçince başka bir ürüne geçmiş gibi oluyordu — oysa ikisi de
// aynı ürünün iki kitlesi.
//
// Şimdi tek kabuk: AYNI yüzen ada başlığı ve AYNI espresso alt bilgi iki
// izlekte de çiziliyor, yalnızca İÇERİĞİ izleğe göre değişiyor. Karar tek
// satırda: yol `/isletme` ile başlıyorsa işletme izleği.
//
// Logo her iki izlekte de `/`ye gider — site kökü orası. İşletme izleğinde
// logonun yanında "İŞLETME" etiketi duruyor: aynı başlık iki yerde
// kullanılınca kullanıcının hangi bölümde olduğunu bilmesi gerekiyor.
//
// PANEL BU KABUĞUN DIŞINDA (`/isletme/panel`): kendi başlığı ve koyu teması
// var, iki gezinme şeridi üst üste hangisinin ana olduğunu sildirir.
// ═══════════════════════════════════════════════════════════════════════
const MENU = [
  { id: "indir", label: "İndir" },
  { id: "kaydir", label: "Nasıl çalışır" },
  { id: "ozellik", label: "Uygulamada ne var" },
  { id: "gizlilik", label: "Gizlilik" },
  { id: "sss", label: "Sık sorulanlar" },
];

const ISLETME_MENU = [
  { id: "nasil", label: "Nasıl çalışır" },
  { id: "kazanc", label: "Ne kazanırsınız" },
  { id: "ucret", label: "Ücretlendirme" },
  { id: "sss", label: "Sık sorulanlar" },
];

export function WebHeader({ koyu = false }) {
  const genis = useMediaQuery(GENIS);
  const [acik, setAcik] = useState(false);
  const nav = useNavigate();
  const yer = useLocation();

  // TEK KARAR NOKTASI. Başlık hangi izlekte olduğunu yoldan okuyor; prop
  // olarak geçirilseydi bir sayfada yanlış vermeyi unutmak iki gezinmenin
  // birbirine yalan söylemesi demekti.
  const isIzlek = yer.pathname.startsWith("/isletme");
  const kok = isIzlek ? "/isletme" : "/";
  const bolumler = isIzlek ? ISLETME_MENU : MENU;

  // Menü açıkken Escape kapatır ve arkadaki sayfa kaymaz.
  useEffect(() => {
    if (!acik) return;
    const esc = (e) => { if (e.key === "Escape") setAcik(false); };
    window.addEventListener("keydown", esc);
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = eski; };
  }, [acik]);

  // Bölüme gitmek önce o izleğin kökünde olmayı gerektiriyor; sayfa
  // çizilmeden önce id aranırsa hiçbir şey bulunmuyor, o yüzden bir kare
  // bekleniyor.
  const git = (id) => {
    setAcik(false);
    if (yer.pathname !== kok) {
      nav(kok);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cam = koyu
    ? { bg: "rgba(24,18,14,0.72)", kenar: "1px solid rgba(255,255,255,0.1)", ink: "rgba(253,251,247,0.78)", inkGuclu: "var(--c-bg)" }
    : { bg: "rgba(253,251,247,0.78)", kenar: "1px solid var(--c-border)", ink: "var(--c-ink-2)", inkGuclu: "var(--c-ink)" };

  // HER İZLEKTE TEK TURUNCU EYLEM. Tüketicide indirme, işletmede kayıt.
  // İkinci bir turuncu hap hangisinin ana yol olduğunu sildirirdi
  // (bkz. "Renkle hiyerarşi").
  //
  // "GİRİŞ YAP" TEK KAPI VE OTURUMA GÖRE DEĞİŞMİYOR. Bir dönem oturum
  // açıkken yerine "Panele dön", yanına da "Çıkış" geliyordu: üç ayrı
  // etiket aynı düğmede dönüyor, giriş kapısı oturumu olanda hiç
  // görünmüyordu. Şimdi düğme hep aynı şeyi diyor ve hep aynı yere
  // götürüyor — oturum varsa `/isletme/giris` kullanıcıyı doğrudan panele
  // alıyor (bkz. GurBusiness). Çıkış panelin kendi kenar çubuğunda:
  // oturumu kapatmak sitede değil üründe yapılan bir iş.
  const ikincil = koyu ? "plain" : "plainDark";
  const birincil = isIzlek
    ? <Btn text="Ücretsiz kayıt ol" onClick={() => { setAcik(false); nav("/isletme/kayit"); }} variant="filled" size="md" fullWidth={!genis} trailing={OK} />
    : <Btn text="Uygulamayı indir" onClick={() => git("indir")} variant="filled" size="md" fullWidth={!genis} trailing={OK} />;

  const yanEylem = isIzlek
    ? <Btn text="Giriş yap" onClick={() => { setAcik(false); nav("/isletme/giris"); }} variant={ikincil} size="md" fullWidth={!genis} />
    : <Btn text="İşletmeler" onClick={() => { setAcik(false); nav("/isletme"); }} variant={ikincil} size="md" fullWidth={!genis} />;

  return (
    <>
      <header style={{
        position: "fixed", top: genis ? 18 : 12, left: 0, right: 0, zIndex: 100,
        display: "flex", justifyContent: "center", padding: "0 16px", pointerEvents: "none",
      }}>
        <div className={`gur-glass gur-glass-${koyu ? "dark" : "light"}`} style={{
          pointerEvents: "auto", display: "flex", alignItems: "center", gap: genis ? 8 : 10,
          background: cam.bg, backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          border: cam.kenar, borderRadius: 999, padding: genis ? "8px 10px 8px 14px" : "7px 8px 7px 12px",
          boxShadow: koyu ? "var(--sh-d3)" : "var(--sh-2)",
          maxWidth: "100%",
        }}>
          <button type="button" onClick={() => nav("/")} className="gur-tap"
            aria-label="GUR ana sayfası"
            style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
            <GurLogo size={34} pill />
          </button>
          {/* Aynı başlık iki izlekte de çiziliyor; kullanıcının hangi
              bölümde olduğunu bilmesi gerekiyor. Tüketici izleğinde etiket
              yok — orası sitenin kendisi. */}
          {isIzlek && (
            <span style={{
              fontFamily: "var(--f-body)", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
              color: cam.ink, whiteSpace: "nowrap", flexShrink: 0,
            }}>İŞLETME</span>
          )}

          {genis ? (
            <>
              <nav aria-label="Sayfa bölümleri" style={{ display: "flex", gap: 2, margin: bolumler.length ? "0 6px" : 0 }}>
                {bolumler.map(m => (
                  <button key={m.id} type="button" onClick={() => git(m.id)} className="gur-nav-link"
                    style={{
                      background: "none", border: "none", cursor: "pointer", borderRadius: 999,
                      padding: "11px 13px", minHeight: 44, fontFamily: "var(--f-body)",
                      fontSize: 13.5, fontWeight: 600, color: cam.ink, whiteSpace: "nowrap",
                    }}>{m.label}</button>
                ))}
              </nav>
              {yanEylem}
              {birincil}
            </>
          ) : (
            <>
              <span style={{ flex: 1, minWidth: 4 }} />
              {/* Dar ekranda pilde yalnız BİRİNCİL eylem; ikincisi menünün
                  içinde. İkisi de sığmıyor ve sıkıştırmak ikisini de
                  44 px'in altına düşürüyordu. */}
              <div style={{ flexShrink: 0 }}>{birincil}</div>
              <button type="button" onClick={() => setAcik(true)}
                aria-expanded={acik} aria-label="Menüyü aç" className="gur-icon-btn"
                style={{
                  width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                  border: cam.kenar, background: koyu ? "rgba(255,255,255,0.06)" : "var(--c-card)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cam.inkGuclu} strokeWidth="2.2" strokeLinecap="round">
                  <line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="13" x2="21" y2="13" /><line x1="3" y1="19" x2="15" y2="19" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Dar ekran menüsü: ekranı kaplayan cam perde, bağlantılar sırayla
          belirir. Kapatma iki yoldan: çarpı ve perdeye dokunma. */}
      <AnimatePresence>
        {acik && (
          <motion.div
            role="dialog" aria-modal="true" aria-label="Menü"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EGRI }}
            onClick={() => setAcik(false)}
            className={`gur-glass gur-glass-${koyu ? "dark" : "light"}`}
            style={{
              position: "fixed", inset: 0, zIndex: 110,
              background: koyu ? "rgba(14,11,9,0.86)" : "rgba(253,251,247,0.9)",
              backdropFilter: "blur(26px)", WebkitBackdropFilter: "blur(26px)",
              display: "flex", flexDirection: "column", padding: "18px 22px 32px",
            }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setAcik(false)} aria-label="Menüyü kapat" className="gur-icon-btn"
                style={{
                  width: 44, height: 44, borderRadius: 999, border: cam.kenar,
                  background: koyu ? "rgba(255,255,255,0.06)" : "var(--c-card)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cam.inkGuclu} strokeWidth="2.3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav aria-label="Sayfa bölümleri" onClick={e => e.stopPropagation()}
              style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 24 }}>
              {bolumler.map((m, i) => (
                <motion.button key={m.id} type="button" onClick={() => git(m.id)}
                  initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.06 + i * 0.05, ease: EGRI }}
                  style={{
                    background: "none", border: "none", cursor: "pointer", textAlign: "left",
                    padding: "16px 2px", minHeight: 44, fontFamily: "var(--f-display)",
                    fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em",
                    color: cam.inkGuclu,
                  }}>{m.label}</motion.button>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.06 + bolumler.length * 0.05, ease: EGRI }}
                style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 26 }}>
                {isIzlek ? (
                  <>
                    <Btn text="Ücretsiz kayıt ol" onClick={() => { setAcik(false); nav("/isletme/kayit"); }} variant="filled" size="lg" trailing={OK} />
                    <Btn text="Giriş yap" onClick={() => { setAcik(false); nav("/isletme/giris"); }} variant="outlineDark" size="lg" />
                    <Btn text="Tüketici tarafına geç" onClick={() => { setAcik(false); nav("/"); }} variant="plainDark" size="lg" />
                  </>
                ) : (
                  <>
                    <Btn text="Uygulamayı indir" onClick={() => git("indir")} variant="filled" size="lg" trailing={OK} />
                    <Btn text="Restoran mısınız? İşletme tarafına geçin" onClick={() => { setAcik(false); nav("/isletme"); }} variant="outlineDark" size="lg" />
                  </>
                )}
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Alt bilgi ───────────────────────────────────────────────────────
export function WebFooter() {
  const genis = useMediaQuery(GENIS);
  const nav = useNavigate();
  const sutun = (baslik, satirlar) => (
    <div>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.18em", color: "rgba(253,251,247,0.5)", margin: "0 0 12px", textTransform: "uppercase" }}>{baslik}</p>
      {satirlar.map(([t, fn]) => (fn ? (
        <button key={t} type="button" onClick={fn} className="gur-tap"
          style={{ display: "block", background: "none", border: "none", cursor: "pointer", padding: "6px 0", textAlign: "left", fontFamily: "var(--f-body)", fontSize: 14, color: "rgba(253,251,247,0.78)" }}>{t}</button>
      ) : (
        <span key={t} style={{ display: "block", padding: "6px 0", fontFamily: "var(--f-body)", fontSize: 14, color: "rgba(253,251,247,0.5)" }}>{t}</span>
      )))}
    </div>
  );
  return (
    <footer style={{ background: "var(--c-espresso)", padding: "56px 20px 32px" }}>
      <div style={{
        maxWidth: KAP, margin: "0 auto", display: "flex", gap: genis ? 48 : 32,
        flexDirection: genis ? "row" : "column", justifyContent: "space-between",
      }}>
        <div style={{ maxWidth: 320 }}>
          <GurLogo size={42} pill />
          <p style={{ fontFamily: "var(--f-body)", fontSize: 14, lineHeight: 1.65, color: "rgba(253,251,247,0.7)", margin: "14px 0 0" }}>
            İstanbul'un restoranlarını kaydırarak keşfedin. Beğendiğinizi
            kaydedin, bu akşam gideceğinizi yukarı kaydırın.
          </p>
        </div>
        <div style={{ display: "flex", gap: genis ? 56 : 32, flexWrap: "wrap" }}>
          {sutun("İndir", [
            // Adres boşken ÖLÜ BAĞLANTI yazmıyoruz: satır ne durumda
            // olduğunu söylüyor (bkz. MAGAZA).
            [MAGAZA.ios ? "App Store" : "App Store · yakında", MAGAZA.ios ? () => window.open(MAGAZA.ios, "_blank", "noopener") : null],
            [MAGAZA.android ? "Google Play" : "Google Play · yakında", MAGAZA.android ? () => window.open(MAGAZA.android, "_blank", "noopener") : null],
          ])}
          {/* İŞLETME SÜTUNU BURAYA TAŞINDI. İşletme sitesinin kendi alt
              bilgisi vardı (`SiteFooter`); iki alt bilgi iki ayrı site
              demekti. Satırlar o alt bilgiden geldi, hiçbiri kaybolmadı. */}
          {sutun("İşletmeler", [
            ["Ne sunuyoruz", () => nav("/isletme")],
            ["Ücretsiz kayıt ol", () => nav("/isletme/kayit")],
            ["Kaydını sahiplen", () => nav("/isletme/sahiplen")],
            ["Giriş yap", () => nav("/isletme/giris")],
            ["Kayıt ve panel ücretsiz", null],
          ])}
        </div>
      </div>
      <div style={{ maxWidth: KAP, margin: "40px auto 0", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "rgba(253,251,247,0.5)", margin: 0, lineHeight: 1.6 }}>
          © {new Date().getFullYear()} GUR · İstanbul · Konum verisi cihazında kalır,
          ham koordinat hiçbir yere gönderilmez · İşletme aboneliği yoktur.
        </p>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TANITIM SAYFASI
// ═══════════════════════════════════════════════════════════════════════

const KAYDIRMALAR = [
  { ikon: "heart", baslik: "Sağa kaydır", alt: "Kaydet", metin: "Beğendiğin mekan favorilerine düşer; listeye sonra bakarsın, kart akışını bozmaz." },
  { ikon: "cross", baslik: "Sola kaydır", alt: "Geç", metin: "İlgilenmediğin kart gider. Deste bitince geçtiklerine bir tur daha bakabilirsin." },
  { ikon: "sparkle", baslik: "Yukarı kaydır", alt: "Hemen gitmek istiyorum", metin: "Bu akşamın adayı. Süper beğeni, kararını verdiğin mekanı öne alır." },
];

const OZELLIKLER = [
  {
    w: 2, ikon: "star", baslik: "Gastro Onaylı",
    metin: "Tanınmış şeflerin değerlendirmesine dayanan rozet. Satın alınamaz; bir restoran para ödeyerek Gastro Onaylı olamaz. Rozeti gördüğünde arkasında bağımsız bir karar var.",
    one: true,
  },
  {
    w: 2, ikon: "chat", baslik: "Konum doğrulamalı yorum",
    metin: "Yorum yazabilmek için mekânda yeterince kalmış olmak gerekiyor. Oradaysan uygulama \"deneyim nasıldı\" diye soruyor ve yorumun \"Konumla doğrulandı\" rozeti alıyor.",
  },
  { w: 2, ikon: "plate", baslik: "GUR Match", metin: "Arkadaşlarınla aynı koda girin, ayrı ayrı kaydırın. Aynı mekanda buluştuğunuzda zil çalar — masa hazır." },
  { w: 1, ikon: "clock", baslik: "Ücretsiz masa ayırtma", metin: "Komisyon yok. Talebin restoranın paneline düşer." },
  { w: 1, ikon: "pin", baslik: "İlçeni sen seç", metin: "Konum izni vermek zorunda değilsin; ilçeni elle seçersen akış ona göre sıralanır." },
];

const SSS = [
  {
    s: "Uygulamayı nereden indiririm?",
    c: "App Store ve Google Play'den; iki mağazada da ücretsiz. Mağaza sürümleri yayına hazırlanıyor, çıktığında bu sayfadaki düğmeler doğrudan mağazaya götürecek.",
  },
  {
    s: "Konumumu vermek zorunda mıyım?",
    c: "Değilsin. Üç yol da eşit: konumunu kullan, ilçeni elle seç ya da \"şimdi değil\" de. Hiçbiri akışı tıkamıyor. Ham koordinatın hiçbir yere gönderilmiyor — yalnızca mesafe özeti hesaplanıyor ve o da cihazında kalıyor.",
  },
  {
    s: "Yorum yazmak için ne gerekiyor?",
    c: "Mekânda yeterince kalmış olmak: 120 metre yarıçapta, en az 15 dakika. O eşiği geçtiğinde yorum kilidi açılıyor ve yazdığın yorum konumla doğrulanmış sayılıyor. Hiç gitmediğin bir yere yorum yazılamıyor.",
  },
  {
    s: "Sponsorlu kartları nasıl ayırt ederim?",
    c: "Kartın üstünde \"Sponsorlu\" rozeti yazıyor. Sponsorlu kart organik kartla aynı nesne; akışın içinde geliyor ama ne olduğunu saklamıyoruz.",
  },
  {
    s: "İnternetim yokken ne oluyor?",
    c: "Uygulama açılmaya devam ediyor. Sunucuya ulaşılamadığında GUR yerel moda geçiyor ve yazdıkların yalnızca bu tarayıcıda saklanıyor — sağ üstteki rozet hangi modda olduğunu söylüyor, bunu gizlemiyoruz.",
  },
];

// Kahramandaki kart yığını. Üç kart hafifçe üst üste ve eğik duruyor;
// hareket transform'la, negatif kenar boşluğuyla değil (negatif boşluk
// mobilde dokunma hedeflerini üst üste bindiriyor).
function KartYigini() {
  const genis = useMediaQuery(GENIS);
  const kartlar = [
    { src: I.steak1, ad: "Mangal Ustası", tur: "Izgara · Kadıköy", puan: "4.8", d: 0 },
    { src: I.sushi1, ad: "Sakura", tur: "Japon · Beşiktaş", puan: "4.6", d: 1 },
    { src: I.pasta1, ad: "Trattoria Mia", tur: "İtalyan · Nişantaşı", puan: "4.7", d: 2 },
  ];
  return (
    <div style={{ position: "relative", height: genis ? 452 : 384, maxWidth: 340, margin: "0 auto", width: "100%" }}>
      {kartlar.slice().reverse().map((k) => {
        const i = k.d;                                  // 0 = en üstteki
        const egim = genis ? [0, -3.4, 4.6][i] : 0;     // 900 altında eğim YOK
        const kay = genis ? [0, 22, -18][i] : 0;
        const yuksel = -i * 18;                        // arka kartlar yukarıdan peyda olur
        return (
          <motion.div key={k.ad}
            initial={{ opacity: 0, y: 36 + i * 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, delay: 0.1 + (2 - i) * 0.08, ease: EGRI }}
            style={{
              position: "absolute", inset: 0,
              transform: `translate(${kay}px, ${yuksel}px) scale(${1 - i * 0.05}) rotate(${egim}deg)`,
              transformOrigin: "50% 50%", zIndex: 10 - i,
            }}>
            <Bezel r={34} pad={8} tepsi={i ? "var(--c-bg-2)" : "rgba(255,255,255,0.9)"}
              style={{ height: "100%", boxShadow: i ? ELEV.restLight : "var(--sh-4)" }}
              icStyle={{ display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                <Img src={k.src} box={340} alt="" style={{ position: "absolute", inset: 0 }} />
                {i === 0 && (
                  <>
                    <span style={{
                      position: "absolute", top: 14, left: 14, fontFamily: "var(--f-body)",
                      fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", color: "#fff",
                      background: "rgba(255,102,0,0.94)", borderRadius: 999, padding: "6px 11px",
                    }}>GASTRO ONAYLI</span>
                    <span style={{
                      position: "absolute", bottom: 14, right: 14, fontFamily: "var(--f-body)",
                      fontSize: 11.5, fontWeight: 800, color: "var(--c-ink)",
                      background: "rgba(255,255,255,0.94)", borderRadius: 999, padding: "6px 11px",
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}>
                      <Icon n="star" size={11} color="var(--c-warn-ink)" />{k.puan}
                    </span>
                  </>
                )}
              </div>
              <div style={{ padding: "14px 16px 16px", background: "var(--c-card)" }}>
                <p style={{ fontFamily: "var(--f-display)", fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: 0 }}>{k.ad}</p>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "var(--c-muted)", margin: "3px 0 0" }}>{k.tur}</p>
              </div>
            </Bezel>
          </motion.div>
        );
      })}
    </div>
  );
}

function KaydirmaKart({ k, gecikme }) {
  return (
    <Belir gecikme={gecikme} style={{ height: "100%" }}>
      <Bezel r={28} style={{ height: "100%" }} icStyle={{ padding: 24 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 999, background: "var(--c-brand-soft)",
          border: "1px solid rgba(255,102,0,0.16)", display: "flex",
          alignItems: "center", justifyContent: "center", marginBottom: 18,
        }}>
          <Icon n={k.ikon} size={20} color="#FF6600" />
        </div>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.18em", color: "var(--c-brand-ink-soft)", margin: "0 0 7px", textTransform: "uppercase" }}>{k.alt}</p>
        <h3 style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "0 0 9px" }}>{k.baslik}</h3>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 14.5, lineHeight: 1.62, color: "var(--c-muted)", margin: 0 }}>{k.metin}</p>
      </Bezel>
    </Belir>
  );
}

export function TuketiciLanding() {
  const genis = useMediaQuery(GENIS);
  const [sss, setSss] = useState(0);
  const nav = useNavigate();

  // Bento: dört sütun, satır satır değişen bölünme (2+2 · 2+1+1).
  // Dar ekranda tek sütun ve sıra AYNI — düzen değişir, okuma sırası değişmez.
  const hucre = (w) => ({ gridColumn: `span ${genis ? w : 1}`, minWidth: 0 });

  return (
    // JETONLAR BURADAN GELİYOR. GurStyles yalnızca uygulamaların
    // köklerinde çiziliyordu; tanıtım sayfası ayrı bir rota olduğu için
    // onu kendi çizmek zorunda. Olmadan var(--c-bg) çözülmüyor, satır içi
    // background geçersiz kalıyor ve index.html'in koyu gövde zemini
    // sayfanın tamamını yutuyordu (ölçüldü: kâğıt siyah çıkıyordu).
    <div style={{ background: "var(--c-bg)", minHeight: "100dvh", overflowX: "hidden", colorScheme: "light" }}>
      <GurStyles />
      <Grain />
      <WebHeader />

      {/* ═══ KAHRAMAN — Editorial Split ═══ */}
      <section style={{
        minHeight: genis ? "100dvh" : "auto",
        display: "flex", alignItems: "center",
        padding: genis ? "132px 20px 96px" : "104px 20px 56px",
        position: "relative",
      }}>
        {/* Kâğıdın ısındığı iki nokta. Marka turuncusunun çok soluk hâli;
            yeni renk değil, aynı turuncunun %6'sı. */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(900px 520px at 78% 18%, rgba(255,122,26,0.09), transparent 70%), radial-gradient(700px 420px at 8% 82%, rgba(255,102,0,0.055), transparent 70%)",
        }} />
        <div style={{
          maxWidth: KAP, margin: "0 auto", width: "100%", position: "relative",
          display: "grid", gridTemplateColumns: genis ? "1.08fr 0.92fr" : "1fr",
          gap: genis ? 64 : 44, alignItems: "center",
        }}>
          <div>
            <motion.div
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EGRI }}>
              <Kas>İstanbul · Restoran keşfi</Kas>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.08, ease: EGRI }}
              style={{
                fontFamily: "var(--f-display)",
                fontSize: genis ? "clamp(40px, 3.8vw, 58px)" : 36,
                fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.04,
                color: "var(--c-ink)", margin: "22px 0 0", maxWidth: 9.2 + "em",
              }}>
              Bu akşam nerede yiyeceğini{" "}
              <span style={{ color: "var(--c-brand-ink)" }}>kaydırarak</span> bul.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.16, ease: EGRI }}
              style={{
                fontFamily: "var(--f-body)", fontSize: genis ? 18 : 16,
                lineHeight: 1.65, color: "var(--c-muted)", margin: "24px 0 0", maxWidth: 480,
              }}>
              Onlarca sekme, dokuz farklı puan sitesi, bitmeyen liste yok.
              GUR mekanları tek tek önüne getirir: beğendiğini kaydet,
              ilgilenmediğini geç, bu akşamın adayını yukarı kaydır.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.24, ease: EGRI }}
              style={{ margin: "34px 0 0" }}>
              <MagazaRozetleri />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.34, ease: EGRI }}
              style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "var(--c-muted)", margin: "20px 0 0", lineHeight: 1.6 }}>
              Ücretsiz · İstanbul geneli · Ham konumun hiçbir yere gönderilmiyor
            </motion.p>
          </div>

          <KartYigini />
        </div>
      </section>

      {/* ═══ KAYDIRMA DİLİ ═══ */}
      <Bolum id="kaydir" bg="var(--c-bg-2)">
        <Baslik
          kas="Nasıl çalışır"
          baslik="Üç yön, üç karar"
          aciklama="Öğrenilecek bir arayüz yok: kartı sevdiysen sağa, sevmediysen sola, bu akşam gideceksen yukarı." />
        <div style={{ display: "grid", gridTemplateColumns: genis ? "repeat(3, 1fr)" : "1fr", gap: 16, alignItems: "start" }}>
          {KAYDIRMALAR.map((k, i) => <KaydirmaKart key={k.baslik} k={k} gecikme={i * 0.08} />)}
        </div>
        <Belir gecikme={0.24} style={{ marginTop: 16 }}>
          <Bezel r={28} tepsi="rgba(255,102,0,0.07)" icStyle={{ padding: genis ? "26px 30px" : 22 }}>
            <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexDirection: genis ? "row" : "column" }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontFamily: "var(--f-display)", fontSize: genis ? 24 : 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "0 0 9px" }}>
                  Detay için ekran değişmiyor
                </h3>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 15, lineHeight: 1.62, color: "var(--c-muted)", margin: 0, maxWidth: 620 }}>
                  Karta dokunduğunda başka bir sayfaya gitmiyorsun: menü, fotoğraflar,
                  yorumlar ve masa ayırtma kartın üstünde açılan bir sayfada geliyor.
                  Aşağı sürükleyip kapatıyorsun, akışta kaldığın yerde devam ediyorsun.
                </p>
              </div>
              <Btn text="İndir" onClick={() => document.getElementById("indir")?.scrollIntoView({ behavior: "smooth", block: "start" })} variant="ink" size="md" fullWidth={false} trailing={OK} />
            </div>
          </Bezel>
        </Belir>
      </Bolum>

      {/* ═══ BENTO — uygulamada ne var ═══ */}
      <Bolum id="ozellik">
        <Baslik
          kas="Uygulamada ne var"
          baslik="Kaydırmaktan fazlası"
          aciklama="Rozetler satın alınmıyor, yorumlar konumla doğrulanıyor, masa ayırtmak ücretsiz. Hepsi aynı akışın içinde." />
        <div style={{
          display: "grid",
          gridTemplateColumns: genis ? "repeat(4, minmax(0,1fr))" : "1fr",
          gap: 16, alignItems: "start",
        }}>
          {OZELLIKLER.map((o, i) => (
            <Belir key={o.baslik} gecikme={i * 0.07} style={hucre(o.w)}>
              <Bezel r={28}
                tepsi={o.one ? "rgba(255,102,0,0.09)" : "var(--c-bg-2)"}
                icStyle={{ padding: genis && o.one ? 30 : 24 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 999, marginBottom: 18,
                  background: o.one ? "rgba(255,102,0,0.1)" : "var(--c-subtle)",
                  border: `1px solid ${o.one ? "rgba(255,102,0,0.2)" : "var(--c-line)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon n={o.ikon} size={20} color={o.one ? "#FF6600" : "var(--c-ink-2)"} />
                </div>
                <h3 style={{
                  fontFamily: "var(--f-display)", fontSize: genis && o.one ? 27 : 21,
                  fontWeight: 800, letterSpacing: "-0.025em", color: "var(--c-ink)", margin: "0 0 10px",
                }}>{o.baslik}</h3>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 14.5, lineHeight: 1.62, color: "var(--c-muted)", margin: 0 }}>{o.metin}</p>
              </Bezel>
            </Belir>
          ))}
        </div>
      </Bolum>

      {/* ═══ GİZLİLİK — espresso şerit ═══ */}
      <Bolum id="gizlilik" bg="var(--c-espresso)" pad={120}>
        <div style={{
          display: "grid", gridTemplateColumns: genis ? "0.95fr 1.05fr" : "1fr",
          gap: genis ? 56 : 36, alignItems: "center",
        }}>
          <Belir>
            <Baslik tone="dark" orta={false}
              kas="Gizlilik"
              baslik="Konumun bizde değil, cihazında"
              aciklama="Yakındaki mekanları sıralamak için konum gerekiyor; o konumun sunucuya gitmesi gerekmiyor. GUR mesafeyi cihazında hesaplıyor, ham koordinatı hiçbir yere göndermiyor." />
          </Belir>
          <Belir gecikme={0.1}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["pin", "Ham koordinat gönderilmiyor", "Ziyaret doğrulamasında bile yalnızca mesafe ve süre özeti tutuluyor."],
                ["shield", "Rıza sorulur, reddetmek kolaydır", "Kabul ve ret aynı görsel ağırlıkta; izni sonradan da değiştirebilirsin."],
                ["bulb", "Sunucu olmasa da çalışır", "Bağlantı yoksa uygulama yerel moda geçer ve bunu sağ üstte açıkça yazar."],
              ].map(([ikon, b, alt]) => (
                <div key={b} style={{
                  display: "flex", gap: 15, alignItems: "flex-start",
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 20, padding: "18px 20px",
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 999, flexShrink: 0,
                    background: "rgba(255,154,77,0.14)", border: "1px solid rgba(255,154,77,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon n={ikon} size={17} color="#FF9A4D" />
                  </div>
                  <div>
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 15.5, fontWeight: 700, color: "var(--c-bg)", margin: "0 0 4px" }}>{b}</p>
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 13.5, lineHeight: 1.58, color: "rgba(253,251,247,0.68)", margin: 0 }}>{alt}</p>
                  </div>
                </div>
              ))}
            </div>
          </Belir>
        </div>
      </Bolum>

      {/* ═══ SSS ═══ */}
      <Bolum id="sss" bg="var(--c-bg-2)">
        <Baslik kas="Sık sorulanlar" baslik="Merak edilenler" />
        <Belir>
          <Bezel r={32} pad={8} icStyle={{ padding: genis ? "8px 28px" : "4px 18px" }}>
            {SSS.map((q, i) => (
              <div key={q.s} style={{ borderTop: i ? "1px solid var(--c-line)" : "none" }}>
                <button type="button" onClick={() => setSss(sss === i ? -1 : i)} aria-expanded={sss === i}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 16, background: "none", border: "none", cursor: "pointer", textAlign: "left",
                    padding: "22px 0", minHeight: 44,
                  }}>
                  <span style={{ fontFamily: "var(--f-body)", fontSize: genis ? 17 : 15.5, fontWeight: 700, color: "var(--c-ink)" }}>{q.s}</span>
                  <span aria-hidden="true" style={{
                    flexShrink: 0, width: 30, height: 30, borderRadius: 999,
                    background: "var(--c-brand-soft)", border: "1px solid rgba(255,102,0,0.16)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transform: sss === i ? "rotate(45deg)" : "none",
                    transition: `transform 420ms ${EGRI_CSS}`,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-brand-ink-soft)" strokeWidth="2.6" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                </button>
                {sss === i && (
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 15, lineHeight: 1.68, color: "var(--c-muted)", margin: "0 0 22px", paddingRight: genis ? 46 : 0 }}>{q.c}</p>
                )}
              </div>
            ))}
          </Bezel>
        </Belir>
      </Bolum>

      {/* ═══ İNDİRME — sitenin asıl işi ═══ */}
      {/* Kap dar: 1180 px'lik bir kutuda ortalanmış üç satır metin
          "bitmemiş" duruyordu; kart içeriğinin boyuna yakın. */}
      <Bolum id="indir" pad={104} en={880}>
        <Belir>
          <Bezel r={36} pad={9} tepsi="rgba(255,102,0,0.08)"
            icStyle={{ padding: genis ? "64px 48px" : "40px 24px", textAlign: "center" }}>
            <Kas>İndir</Kas>
            <h2 style={{
              fontFamily: "var(--f-display)", fontSize: genis ? 40 : 28, fontWeight: 800,
              letterSpacing: "-0.035em", lineHeight: 1.08, color: "var(--c-ink)", margin: "18px 0 0",
            }}>
              GUR cebinizde
            </h2>
            <p style={{
              fontFamily: "var(--f-body)", fontSize: genis ? 17 : 15.5, lineHeight: 1.62,
              color: "var(--c-muted)", margin: "14px auto 30px", maxWidth: 480,
            }}>
              Keşif akışı, favoriler ve masa ayırtma telefonunuzda. Hesabınız
              her iki sürümde de aynı.
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <MagazaRozetleri orta />
            </div>
          </Bezel>
        </Belir>
      </Bolum>

      {/* ═══ SON ÇAĞRI + RESTORAN YOLU ═══ */}
      <Bolum pad={96}>
        <Belir>
          <div className="gur-on-brand" style={{
            background: "linear-gradient(145deg, #FF7A1A 0%, #FF6600 55%, #F04E00 100%)",
            borderRadius: 34, padding: genis ? "72px 56px" : "40px 24px", textAlign: "center",
            boxShadow: "var(--sh-brand-lg)",
          }}>
            <h2 style={{
              fontFamily: "var(--f-display)", fontSize: genis ? 44 : 29, fontWeight: 800,
              letterSpacing: "-0.035em", lineHeight: 1.08, color: "var(--c-on-brand)", margin: 0,
            }}>
              Deste hazır
            </h2>
            <p style={{
              fontFamily: "var(--f-body)", fontSize: genis ? 17 : 15.5, lineHeight: 1.62,
              color: "var(--c-on-brand-2)", margin: "16px auto 32px", maxWidth: 460,
            }}>
              İstanbul'un mekanları karta dizildi. İlk kaydırmaya kadar
              bir dokunuş kaldı.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Btn text="Uygulamayı indir" onClick={() => document.getElementById("indir")?.scrollIntoView({ behavior: "smooth", block: "start" })} variant="onColor" size="lg" fullWidth={false} trailing={OK} />
            </div>
          </div>
        </Belir>

        <Belir gecikme={0.1} style={{ marginTop: 16 }}>
          <Bezel r={28} icStyle={{ padding: genis ? "26px 30px" : 22 }}>
            <div style={{ display: "flex", gap: 18, alignItems: genis ? "center" : "flex-start", flexDirection: genis ? "row" : "column" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.18em", color: "var(--c-muted)", margin: "0 0 8px", textTransform: "uppercase" }}>Restoran sahibi misiniz?</p>
                <h3 style={{ fontFamily: "var(--f-display)", fontSize: genis ? 23 : 19, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "0 0 7px" }}>
                  Kaydınız büyük ihtimalle GUR'da zaten var
                </h3>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 14.5, lineHeight: 1.6, color: "var(--c-muted)", margin: 0, maxWidth: 620 }}>
                  Mekan havuzu dış kaynaklardan otomatik doluyor. Doyurucu'dan
                  kaydınızı sahiplenin; bilgilerinizi, menünüzü ve fotoğraflarınızı
                  siz yönetin. Kayıt ve panel ücretsiz.
                </p>
              </div>
              <Btn text="Doyurucu'ya git" onClick={() => nav("/isletme")} variant="outlineDark" size="md" fullWidth={false} trailing={OK} />
            </div>
          </Bezel>
        </Belir>
      </Bolum>

      <WebFooter />
    </div>
  );
}
