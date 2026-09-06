// ═══════════════════════════════════════════════════════════════════════
// GUR ARAYÜZ KİTİ — üç uygulamanın ortak parçaları
//
// Tüketici uygulaması (src/app), işletme uygulaması (src/business) ve
// yönetici paneli (src/admin) ayrı uygulamalar ama tek bir ürün. Buton,
// ikon, alan, yüzey ve hareket kuralları burada tek yerde duruyor;
// kopyalanan bir buton er geç ikisinden birinde ayrışır.
//
// Stil kuralı projenin geri kalanıyla aynı: satır içi stil, CSS-in-JS yok.
// Buton durumları (hover/basılı/odak/devre dışı) CSS değişkenlerinden
// okunuyor; kuralların kendisi uygulamanın <style> bloğunda.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';

export const GRAD = "#FF6600";

// Apple "Designing Fluid Interfaces" momentum projection: nereye bırakılacağını
// bırakma anındaki konum değil, hızın taşıdığı yönü kullanarak tahmin eder.
export function projectMomentum(velocity, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

// Sınırın ötesine gidildikçe artan direnç: sert durmak "donmuş" hissi verir,
// giderek zorlaşan hareket "buraya kadar" der ama tepkisiz kalmaz.
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// Seçilen dosyaları tek bir biçime indirger: { name, url, type }. Blob URL'i
// seçim anında bir kez üretilir — render sırasında değil, yoksa her çizimde
// yeni bir URL sızardı.
// Dokunsal geri bildirim — yalnızca anlam taşıyan anlarda (§13: nedensellik ve
// fayda). Vibration API masaüstünde ve iOS Safari'de yok; sessizce atlanır.
export function haptic(pattern = 12) {
  try { navigator.vibrate?.(pattern); } catch { /* desteklenmiyor */ }
}

// Sanal klavye açılınca odaklanılan alan klavyenin altında kalabiliyor;
// odaktan kısa süre sonra alanı görünür alanın ortasına kaydırıyoruz.
export function keepVisible(e) {
  const el = e.currentTarget;
  setTimeout(() => el?.scrollIntoView?.({ block: "center", behavior: "smooth" }), 280);
}

export function toMediaFiles(fileList) {
  return Array.from(fileList || []).map(f => ({ name: f.name, url: URL.createObjectURL(f), type: f.type }));
}

// Sistem "Hareketi Azalt" tercihini React tarafında okur. MotionConfig
// yalnızca Motion animasyonlarını kapsıyor; setTimeout ile dönen karusel
// gibi kendi zamanlayıcılarımızın da bu tercihe uyması gerekiyor.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

// Logo: beyaz hap şeklinde arka plan ile her yerde okunur
export function GurLogo({ size = 48, pill = false }) {
  const logo = <span style={{ fontSize: size, fontWeight: 900, fontFamily: "'Poppins', sans-serif", letterSpacing: -size/24, lineHeight: 1 }}>
    <span style={{ color: "#FFA500" }}>G</span><span style={{ color: "#FF6600" }}>U</span><span style={{ color: "#FF0000" }}>R</span>
  </span>;
  if (pill) return <div style={{ background: "#fff", borderRadius: size * 0.5, padding: `${size*0.12}px ${size*0.35}px`, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>{logo}</div>;
  return logo;
}

// Basit çizgi ikon seti — emoji yerine
export function Icon({ n, size = 18, color = "currentColor", strokeWidth = 2 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    plate: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></>,
    shield: <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />,
    palette: <><path d="M12 21a9 9 0 010-18 5 5 0 010 10h-1a2 2 0 000 4h1" /><circle cx="8.5" cy="10.5" r="1" fill={color} stroke="none" /><circle cx="12" cy="7.5" r="1" fill={color} stroke="none" /><circle cx="15.5" cy="10.5" r="1" fill={color} stroke="none" /></>,
    doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v5h5" /></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="14" r="3.5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,
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

export function BackBtn({ onClick, variant = "dark" }) {
  const stroke = variant === "dark" ? "#fff" : "#FF6600";
  return (
    <IconBtn onClick={onClick} tone={variant === "dark" ? "glassDark" : "solidLight"} size={40} elevated={variant !== "dark"} title="Geri">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    </IconBtn>
  );
}

// picsum.photos adresleri /seed/<ad>/<genişlik>/<yükseklik> biçiminde. 46px'lik
// bir küçük görsel için 600×400 indirmek boşuna bant genişliği; gösterim ölçüsü
// verildiğinde kaynağı da o ölçüde istiyoruz (2× retina payıyla).
export function sizedSrc(src, box) {
  if (!src || !box || !/picsum\.photos\/seed\//.test(src)) return src;
  return src.replace(/\/(\d+)\/(\d+)(\?|$)/, (m, w, h, tail) => {
    const ratio = Number(h) / Number(w) || 1;
    const targetW = Math.round(box * 2);
    return `/${targetW}/${Math.round(targetW * ratio)}${tail}`;
  });
}

export function Img({ src, style, bg = "var(--c-img-bg)", box, alt = "" }) {
  const [state, setState] = useState("loading"); // loading | ok | failed
  useEffect(() => {
    setState("loading");
    // Ağ hiç yanıt vermezse onLoad/onError de gelmez; spinner sonsuza kadar
    // dönmesin diye kendi zaman aşımımız var.
    const t = setTimeout(() => setState(v => (v === "loading" ? "failed" : v)), 8000);
    return () => clearTimeout(t);
  }, [src]);
  return (
    <div style={{ ...style, position: "relative", overflow: "hidden", background: bg }}>
      {state === "loading" && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 22, height: 22, border: "3px solid rgba(0,0,0,0.08)", borderTopColor: "#FF6600", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>}
      {/* Yüklenemeyen görselde <img> gizli kalır; arka plan rengi/gradyanı görünür
          — aksi halde tarayıcının bozuk görsel ikonu kartın üstüne düşüyordu. */}
      <img src={sizedSrc(src, box)} alt={alt} loading="lazy" decoding="async" onLoad={() => setState("ok")} onError={() => setState("failed")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: state === "ok" ? 1 : 0, transition: "opacity 0.4s" }} />
    </div>
  );
}

export function InputField({ label, value, onChange, placeholder, type = "text" }) {
  // Etiket alana htmlFor ile bağlı: etikete dokunmak alanı odaklıyor,
  // ekran okuyucu da alanı adıyla okuyor. Serbest bir <p> bunu yapamaz.
  const id = React.useId();
  return <div style={{ marginBottom: 20 }}>
    <label htmlFor={id} style={{ display: "block", marginBottom: 7, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--c-ink)" }}>{label}</label>
    <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={keepVisible} placeholder={placeholder} style={{ width: "100%", padding: "15px 18px", borderRadius: 16, border: "none", outline: "none", fontSize: 15, fontFamily: "'Outfit', sans-serif", background: "var(--c-card)", color: "var(--c-ink)", WebkitTextFillColor: "var(--c-ink)", boxShadow: "0 2px 16px var(--c-border)", boxSizing: "border-box" }} />
  </div>;
}

export function SelectField({ label, value, onChange, options }) {
  return <div style={{ marginBottom: 20 }}>
    <label style={{ display: "block", marginBottom: 7, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--c-ink)" }}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "15px 18px", borderRadius: 16, border: "none", outline: "none", fontSize: 15, fontFamily: "'Outfit', sans-serif", background: "#fff", color: value ? "#333" : "#aaa", appearance: "none", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", boxSizing: "border-box", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 18px center" }}>
      <option value="">Seçiniz</option>{options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>;
}

// Kabartma katmanları. Yüzeyin üstünde mi altında mı olduğumuzu gölgenin
// yönü söylüyor; basılı durumda gölge içeri dönüyor.
export const ELEV = {
  restLight: "0 6px 18px rgba(45,36,25,0.10), 0 1px 2px rgba(45,36,25,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
  // Koyu zeminde havada duran disk: açık gölge okunmaz, o yüzden
  // derinlik ışıkla kuruluyor — dışta yumuşak bir hâle, üst kenarda
  // parlama, altta ince bir iç gölge.
  floatLight: "0 14px 34px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06), 0 0 22px rgba(255,255,255,0.05), inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -3px 6px rgba(45,36,25,0.10)",
  restDark:  "0 10px 26px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14)",
  restBrand: "0 8px 22px rgba(255,102,0,0.34), inset 0 1px 0 rgba(255,255,255,0.34)",
  pressLight: "inset 0 3px 8px rgba(45,36,25,0.18), inset 0 -1px 0 rgba(255,255,255,0.7)",
  pressDark:  "inset 0 3px 10px rgba(0,0,0,0.55)",
  pressBrand: "inset 0 3px 10px rgba(120,40,0,0.45)",
};

// Marka gradyanı — referanstaki gradyan dolgunun GUR karşılığı.
export const BRAND_GRAD = "linear-gradient(145deg, #FF7A1A 0%, #FF6600 55%, #F04E00 100%)";

export const BRAND_GRAD_HOVER = "linear-gradient(145deg, #FF8A33 0%, #FF7311 55%, #FF5A05 100%)";

export function Spinner({ size = 15, color = "currentColor" }) {
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, flexShrink: 0, display: "inline-block",
      border: `2px solid ${color}`, borderTopColor: "transparent",
      borderRadius: "50%", animation: "spin 0.7s linear infinite", opacity: 0.9,
    }} />
  );
}

export function Btn({ text, onClick, disabled, loading, variant = "onColor", size = "lg", fullWidth = true, icon }) {
  const paddings = { lg: "16px 0", md: "13px 22px", sm: "9px 16px" };
  const fontSizes = { lg: 16, md: 14, sm: 12.5 };

  // Her varyant üç renk verir: duruş, üzerine gelme, basılı. CSS bu üçünü
  // değişkenlerden okuyor; inline background yazsaydık :hover'ı ezerdi.
  const palettes = {
    onColor:   { bg: "#fff", hover: "#FFF4EC", press: "#FFE8D8", color: "#FF6600", elev: "restLight", pressElev: "pressLight" },
    filled:    { bg: BRAND_GRAD, hover: BRAND_GRAD_HOVER, press: BRAND_GRAD, color: "#fff", elev: "restBrand", pressElev: "pressBrand" },
    outline:   { bg: "rgba(255,255,255,0.08)", hover: "rgba(255,255,255,0.16)", press: "rgba(255,255,255,0.06)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.55)", elev: "restDark", pressElev: "pressDark" },
    outlineDark: { bg: "#fff", hover: "#FFF6F0", press: "#FFEFE4", color: "var(--c-ink)", border: "1.5px solid rgba(45,36,25,0.14)", elev: "restLight", pressElev: "pressLight" },
    destructive: { bg: "linear-gradient(145deg, #FF5449, #FF3B30)", hover: "linear-gradient(145deg, #FF6B61, #FF4A40)", press: "linear-gradient(145deg, #E8352B, #D62F26)", color: "#fff", elev: "0 8px 20px rgba(255,59,48,0.32), inset 0 1px 0 rgba(255,255,255,0.3)", pressElev: "inset 0 3px 10px rgba(140,20,15,0.45)" },
    destructiveSoft: { bg: "rgba(255,59,48,0.08)", hover: "rgba(255,59,48,0.14)", press: "rgba(255,59,48,0.2)", color: "#FF3B30" },
    plain:     { bg: "transparent", hover: "rgba(255,255,255,0.08)", press: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.6)" },   // koyu/turuncu zemin
    plainDark: { bg: "transparent", hover: "rgba(255,102,0,0.08)", press: "rgba(255,102,0,0.14)", color: "#FF6600" },                      // beyaz zemin
  };
  const p = palettes[variant] || palettes.onColor;
  const busy = !!loading;
  const off = !!disabled || busy;
  const shadow = ELEV[p.elev] || p.elev || "none";
  const pressShadow = ELEV[p.pressElev] || p.pressElev || shadow;

  return (
    <motion.button
      onClick={off ? undefined : onClick}
      disabled={off}
      aria-busy={busy || undefined}
      data-state={busy ? "loading" : disabled ? "disabled" : "default"}
      // Basılma hareketi Motion'da, renk CSS'te: aynı özelliği iki yerden
      // yazmamak için bilinçli iş bölümü.
      whileTap={off ? undefined : { scale: 0.965 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className="gur-btn"
      style={{
        "--btn-bg": p.bg,
        "--btn-bg-hover": p.hover,
        "--btn-bg-press": p.press,
        "--btn-shadow": shadow,
        "--btn-shadow-press": pressShadow,
        width: fullWidth ? "100%" : "auto",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: paddings[size], borderRadius: 999,
        border: p.border || "none", color: p.color,
        fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: fontSizes[size],
        WebkitTapHighlightColor: "transparent", outline: "none", whiteSpace: "nowrap",
        position: "relative",
      }}>
      {busy ? <Spinner size={fontSizes[size]} color={p.color} /> : icon}
      {busy ? "Yükleniyor…" : text}
    </motion.button>
  );
}

// ─── İkon buton ──────────────────────────────────────────────────────
// Aynı durum sistemi; ek olarak `elevated` yüzeyi kabartıyor. Kaydırma
// aksiyonları bu yüzeyi kullanıyor: siyah zeminde havada duran üç disk.
export function IconBtn({ onClick, icon, children, tone = "glassDark", shape = "circle", size = 40, title, disabled, loading, elevated }) {
  const tones = {
    glassDark:  { bg: "rgba(0,0,0,0.35)", hover: "rgba(0,0,0,0.5)", press: "rgba(0,0,0,0.62)", blur: true, glass: "dark", elev: "restDark", pressElev: "pressDark" },
    glassLight: { bg: "rgba(255,255,255,0.16)", hover: "rgba(255,255,255,0.26)", press: "rgba(255,255,255,0.1)", blur: true, glass: "dark", elev: "restDark", pressElev: "pressDark" },
    solidLight: { bg: "linear-gradient(145deg, #ffffff, #f1ece7)", hover: "linear-gradient(145deg, #ffffff, #fff2e8)", press: "linear-gradient(145deg, #f2ece6, #ffffff)", elev: "floatLight", pressElev: "pressLight" },
    subtle:     { bg: "rgba(45,36,25,0.06)", hover: "rgba(45,36,25,0.11)", press: "rgba(45,36,25,0.16)" },
    dangerSoft: { bg: "rgba(255,59,48,0.1)", hover: "rgba(255,59,48,0.18)", press: "rgba(255,59,48,0.24)" },
    plain:      { bg: "transparent", hover: "rgba(45,36,25,0.07)", press: "rgba(45,36,25,0.12)" },
  };
  const t = tones[tone] || tones.glassDark;
  const busy = !!loading;
  const off = !!disabled || busy;
  const rest = elevated ? (ELEV[t.elev] || ELEV.restLight) : "none";
  const press = elevated ? (ELEV[t.pressElev] || ELEV.pressLight) : "none";

  return (
    <motion.button
      onClick={off ? undefined : onClick}
      disabled={off}
      title={title}
      aria-label={title}
      aria-busy={busy || undefined}
      data-state={busy ? "loading" : disabled ? "disabled" : "default"}
      whileTap={off ? undefined : { scale: 0.9 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className={`gur-icon-btn${t.glass ? ` gur-glass gur-glass-${t.glass}` : ""}`}
      style={{
        "--btn-bg": t.bg,
        "--btn-bg-hover": t.hover,
        "--btn-bg-press": t.press,
        "--btn-shadow": rest,
        "--btn-shadow-press": press,
        width: size, height: size, minWidth: size, minHeight: size, flexShrink: 0,
        borderRadius: shape === "circle" ? "50%" : 18,
        border: "none",
        backdropFilter: t.blur ? "blur(8px)" : undefined,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, position: "relative",
        WebkitTapHighlightColor: "transparent", outline: "none",
      }}>
      {busy ? <Spinner size={Math.round(size * 0.38)} color="#FF6600" /> : (children || icon)}
    </motion.button>
  );
}

// ─── Yatay şerit — parmakla ve imleçle sürüklenebilir ────────────────
//
// Dokunmatikte tarayıcının kendi kaydırması zaten en iyisi: ona
// dokunmuyoruz. İmleçte ise `overflow-x` tek başına işe yaramıyor —
// masaüstünde ve önizleme çerçevesinde kullanıcı listeyi tutup
// sürükleyemiyordu. Fare/kalem için 1:1 takip + bırakınca momentum
// ekliyoruz (Apple HIG: hareket parmağın hızını devralır, dikiş olmaz).
//
// Sürükleme sonrası tıklama bastırılıyor: listeyi kaydırmak isteyen
// kullanıcı yanlışlıkla bir kartı açmamalı.
export const HSCROLL_THRESHOLD = 8;   // bu kadar piksel sonrası "sürükleme" sayılır

export function HScroll({ children, style, className }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const raf = useRef(0);
  const suppressClick = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const clamp = (v, el) => Math.max(0, Math.min(v, el.scrollWidth - el.clientWidth));

  const onPointerDown = (e) => {
    if (e.pointerType === "touch") return;          // dokunmatik: tarayıcıya bırak
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    cancelAnimationFrame(raf.current);
    // Önceki sürüklemeden kalan bastırma bayrağı temizlenir: sürükleme
    // sonrası tarayıcı click üretmeyebiliyor, bayrak asılı kalırsa bir
    // sonraki gerçek tıklamayı yiyor.
    suppressClick.current = false;
    // Burada İMLEÇ YAKALANMIYOR. Yakalarsak tarayıcı uyumluluk fare
    // olaylarını (click dahil) da bu kaba yönlendiriyor ve şeritteki
    // kartlara tıklanamaz oluyor. Yakalama, eşik aşılınca yapılıyor.
    drag.current = {
      pointerId: e.pointerId, captured: false,
      startX: e.clientX, startLeft: el.scrollLeft,
      lastX: e.clientX, lastT: performance.now(), v: 0, moved: 0,
    };
  };

  const onPointerMove = (e) => {
    const d = drag.current, el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.startX;
    d.moved = Math.max(d.moved, Math.abs(dx));
    if (!d.captured) {
      // Histerezis: küçük titremeler tıklamayı bozmasın (Apple HIG ~10px)
      if (d.moved <= HSCROLL_THRESHOLD) return;
      d.captured = true;
      setGrabbing(true);
      try { el.setPointerCapture(d.pointerId); } catch { /* yakalanamazsa da çalışır */ }
    }
    // Eşik kadar kaydırma sayılmıyor ki sürükleme sıçrayarak başlamasın
    const eff = dx - Math.sign(dx) * HSCROLL_THRESHOLD;
    el.scrollLeft = clamp(d.startLeft - eff, el);
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) {
      // Son iki örnekten hız (px/sn) — bırakma anında bu devralınıyor
      d.v = ((e.clientX - d.lastX) / dt) * 1000;
      d.lastX = e.clientX; d.lastT = now;
    }
  };

  const onPointerUp = (e) => {
    const d = drag.current, el = ref.current;
    drag.current = null;
    setGrabbing(false);
    if (!d || !el) return;
    if (d.captured) { try { el.releasePointerCapture(e.pointerId); } catch { /* zaten bırakılmış */ } }
    if (!d.captured) return;                        // sürükleme değil, tıklama
    suppressClick.current = true;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    // Bırakma noktasından değil, momentumun taşıyacağı noktadan duruyoruz.
    const target = clamp(el.scrollLeft - projectMomentum(d.v), el);
    const start = el.scrollLeft;
    const dist = target - start;
    if (reduced || Math.abs(dist) < 1) { el.scrollLeft = target; return; }
    const dur = Math.min(700, 220 + Math.abs(dist) * 0.55);
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      el.scrollLeft = start + dist * (1 - Math.pow(1 - t, 3));   // sönümlenerek durur
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <div
      ref={ref}
      className={className}
      data-hscroll=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
      onDragStart={(e) => e.preventDefault()}
      style={{
        display: "flex", overflowX: "auto", overscrollBehaviorX: "contain",
        cursor: grabbing ? "grabbing" : "grab",
        userSelect: grabbing ? "none" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function UploadBox({ label, icon, accept, files, setFiles, multiple = true }) {
  const ref = useRef(null);
  const handle = (e) => { const nf = Array.from(e.target.files).map(f => ({ name: f.name, url: URL.createObjectURL(f), type: f.type })); setFiles(prev => multiple ? [...prev, ...nf] : nf); };
  const remove = (i) => setFiles(prev => { const f = prev[i]; if (f?.url?.startsWith("blob:")) URL.revokeObjectURL(f.url); return prev.filter((_, j) => j !== i); });
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", marginBottom: 8, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--c-ink)" }}>{label}</label>
      <input ref={ref} type="file" accept={accept} multiple={multiple} onChange={handle} style={{ display: "none" }} />
      <div onClick={() => ref.current?.click()} style={{ border: "2px dashed rgba(255,102,0,0.3)", borderRadius: 18, padding: files.length > 0 ? 14 : "30px 16px", textAlign: "center", cursor: "pointer", background: "#fff", transition: "border-color 0.2s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "#FF6600"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,102,0,0.3)"}>
        {files.length === 0 ? <><div style={{ display: "flex", justifyContent: "center" }}>{icon}</div><p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#A18F7C", margin: "10px 0 0" }}>Dosya seçmek için tıklayın</p></> : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {files.map((f, i) => <div key={i} style={{ position: "relative" }}>{f.type?.startsWith("image/") ? <img src={f.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: "2px solid rgba(255,102,0,0.2)" }} /> : <div style={{ width: 72, height: 72, borderRadius: 12, background: "#FFF3EA", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="doc" size={20} color="#FF6600" /></div>}<button type="button" className="gur-icon-btn" title="Kaldır" aria-label="Kaldır" onClick={e => { e.stopPropagation(); remove(i); }} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", padding: 0, outline: "none", background: "#FF3B30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>✕</button></div>)}
            <div style={{ width: 72, height: 72, borderRadius: 12, border: "2px dashed rgba(255,102,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 18, color: "rgba(255,102,0,0.4)" }}>+</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PhoneFrame({ children }) {
  return <div className="gur-frame" style={{ width: 390, maxWidth: "100%", height: 844, borderRadius: 44, overflow: "hidden", boxShadow: "0 25px 80px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)", position: "relative", background: "var(--c-bg)", margin: "0 auto" }}>
    <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 126, height: 30, background: "#000", borderBottomLeftRadius: 18, borderBottomRightRadius: 18, zIndex: 999 }} />
    {children}
  </div>;
}

export function Screen({ children, grad = true }) {
  // main: yardımcı teknolojiler doğrudan içeriğe atlayabilsin
  return <main className="gur-screen" style={{ width: "100%", height: "100%", background: grad ? "var(--c-bg)" : "var(--c-bg)", overflowY: "auto", overflowX: "hidden", position: "relative" }}>{children}</main>;
}


// İşletmenin GUR'da hesabı var: kaydını sahiplenmiş, bilgileri kendi
// yönetiyor. Kullanıcı için anlamı "bu sayfa güncel".
export function VerifiedStar({ size = 14, title = "İşletme hesabı doğrulanmış" }) {
  return (
    <span title={title} aria-label={title} style={{ display: "inline-flex", flexShrink: 0, verticalAlign: "middle" }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF6600" aria-hidden="true">
        <path d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.1 6.1 20.2l1.2-6.6L2.5 9l6.6-.9L12 2z" />
      </svg>
    </span>
  );
}

// ─── Ortak stil bloğu ────────────────────────────────────────────────
// Buton durumları, dokunma hedefi, güvenli alan payı ve erişilebilirlik
// tercihleri. Üç uygulama da aynı kuralları kullanıyor: kopyalanan bir
// :hover kuralı er geç birinde eskir.
export function GurStyles() {
  return (
      <style>{`
        /* ── TEMA JETONLARI ────────────────────────────────────────────
           Uygulama satır içi stille yazıldığı için renkler CSS
           değişkenlerinden okunuyor: satır içi stil sınıf kuralını yener
           ama var() değerini okur. Tema değişimi tek yerden.

           Açık temadaki gri tonları WCAG AA için koyulaştırıldı:
           eski #A8A29E beyaz üstünde 2.6:1 idi (metin için geçersiz),
           yenisi 4.6:1. */
        :root {
          --c-bg: #FDFBF7;              /* ekran zemini */
          --c-bg-2: #F4EFE7;            /* zeminin ikinci tonu */
          --c-card: #ffffff;            /* kart ve sayfa yüzeyi */
          --c-subtle: #FBFAF8;          /* kart içi ikinci yüzey */
          --c-ink: #1C1917;             /* ana metin */
          --c-ink-2: #4A443E;           /* ikincil metin (4.5:1+) */
          --c-muted: #6F6459;           /* üçüncül metin (4.6:1) */
          --c-line: #E3DCD2;            /* ayırıcı çizgi */
          --c-border: rgba(45,36,25,0.10);
          --c-img-bg: #e8e0d8;          /* görsel yüklenene kadar */
          --c-shadow: rgba(45,36,25,0.12);
          --c-brand-soft: rgba(255,102,0,0.08);
          --c-brand-ink: #B4530A;       /* turuncu zemin üstünde metin */
          --shadow-bar: 0 10px 30px rgba(45,36,25,0.12), 0 2px 6px rgba(45,36,25,0.05), inset 0 1px 0 rgba(255,255,255,0.9);
        }
        :root[data-theme="dark"] {
          --c-bg: #0E0C10;
          --c-bg-2: #17141A;
          --c-card: #1A171E;
          --c-subtle: #221E27;
          --c-ink: #F4F1EE;
          --c-ink-2: #C9C2BA;
          --c-muted: #9A9189;
          --c-line: #2E2933;
          --c-border: rgba(255,255,255,0.10);
          --c-img-bg: #2A2530;
          --c-shadow: rgba(0,0,0,0.55);
          --c-brand-soft: rgba(255,102,0,0.16);
          --c-brand-ink: #FFB170;
          --shadow-bar: 0 10px 30px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        /* Tarayıcı de form denetimlerini ve kaydırma çubuğunu temaya uydursun */
        :root { color-scheme: light; }
        :root[data-theme="dark"] { color-scheme: dark; }

        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes badgeMarquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
        ::-webkit-scrollbar { display:none; }
        /* ── BUTON DURUMLARI ──────────────────────────────────────────
           Renkler değişkenlerden okunuyor; buton bunları inline veriyor.
           Arka planı inline yazsaydık :hover ve :active hiç devreye
           giremezdi — satır içi stil sınıf kuralını yener. Basılma
           hareketi (scale) Motion'da; burada yalnızca renk ve gölge var,
           böylece iki sistem aynı özelliği yazmıyor. */
        .gur-btn, .gur-icon-btn {
          background: var(--btn-bg, transparent);
          box-shadow: var(--btn-shadow, none);
          cursor: pointer;
          transition: background 160ms ease, box-shadow 200ms ease, opacity 160ms ease, filter 160ms ease;
        }
        /* Üzerine gelme yalnızca gerçek imleçli cihazlarda: dokunmatikte
           :hover basıştan sonra takılı kalıyor. */
        @media (hover: hover) and (pointer: fine) {
          .gur-btn:not(:disabled):hover, .gur-icon-btn:not(:disabled):hover {
            background: var(--btn-bg-hover, var(--btn-bg));
            filter: brightness(1.02);
          }
        }
        .gur-btn:not(:disabled):active, .gur-icon-btn:not(:disabled):active {
          background: var(--btn-bg-press, var(--btn-bg));
          box-shadow: var(--btn-shadow-press, var(--btn-shadow, none));
        }
        .gur-btn:focus-visible, .gur-icon-btn:focus-visible, .gur-dot:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(255,102,0,0.65), var(--btn-shadow, 0 0 0 0 transparent);
        }
        /* Devre dışı: soluk ve tepkisiz. İmleç de bunu söylüyor. */
        .gur-btn:disabled, .gur-icon-btn:disabled {
          opacity: 0.42; cursor: not-allowed; box-shadow: none; filter: grayscale(0.35);
        }
        /* Yükleniyor: tıklanamaz ama soluk değil — iş sürüyor, kapalı değil. */
        .gur-btn[data-state="loading"], .gur-icon-btn[data-state="loading"] {
          opacity: 0.9; cursor: progress; filter: none;
        }

        /* Apple HIG: her dokunma hedefi en az 44×44pt. Küçük ikon butonların
           görsel boyutu korunur, tıklama alanı görünmez bir katmanla büyür. */
        .gur-icon-btn, .gur-dot { position: relative; }
        .gur-icon-btn::after, .gur-dot::after {
          content: ""; position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: max(100%, 44px); height: max(100%, 44px);
        }

        /* Çentik / ev çubuğu payı. Önizleme çerçevesinde env() 0 döner, tam
           ekran cihazda ekranın kenarlarına taşan içerik olmaz. Ekranların
           üst dolgusu zaten 44px; yalnızca bunu aşan çentikler için ek pay. */
        .gur-frame {
          padding-top: max(0px, calc(env(safe-area-inset-top, 0px) - 44px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
        }
        /* Klavye açıkken kaydırma alanı klavye yüksekliği kadar uzar */
        .gur-screen { padding-bottom: var(--gur-kb, 0px); }

        /* Erişilebilirlik tercihleri. Uygulama tamamen inline stille yazıldığı
           için cam yüzeyler .gur-glass sınıfıyla işaretlendi; hareket kuralları
           ise animasyon adını style özniteliğinden yakalıyor. */
        @media (prefers-reduced-motion: reduce) {
          .gur-btn, .gur-icon-btn { transition: none !important; }
          /* Sürekli dönen/nefes alan hareketler durur — vestibüler rahatsızlık kaynağı */
          [style*="badgeMarquee"], [style*="pulse"] { animation: none !important; }
          [style*="fadeInUp"] { animation-duration: 0.01ms !important; }
          [style*="spin"] { animation-duration: 2s !important; }
        }
        /* Saydamlık azaltıldığında bulanıklık kalkar ve zemin katılaşır —
           yalnızca blur'u kaldırmak yarı saydam yüzeyi okunmaz bırakırdı. */
        /* Buradaki cam yüzeylerin tamamı koyu ve fotoğraf üzerinde duruyor.
           Her biri inline stille yazıldığı için alfa değerini CSS'ten
           yükseltmek mümkün değil; inset gölge yazının altını dolduruyor. */
        @media (prefers-reduced-transparency: reduce) {
          [style*="backdrop-filter"] {
            backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
            box-shadow: inset 0 0 0 999px rgba(18,12,6,0.88) !important;
          }
          .gur-glass-light { box-shadow: inset 0 0 0 999px rgba(255,255,255,0.96) !important; }
        }
        @media (prefers-contrast: more) {
          [style*="backdrop-filter"] {
            backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
            box-shadow: inset 0 0 0 999px #140d06 !important;
            border: 1px solid rgba(255,255,255,0.65) !important;
          }
        }
      `}</style>
  );
}
