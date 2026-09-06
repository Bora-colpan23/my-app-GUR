// ═══════════════════════════════════════════════════════════════════════
// SAYFALAR (sheet) — aşağı sürüklenerek kapanan yüzeyler
//
// Hem tüketici hem işletme uygulaması kullanıyor. Kapanış kararını bırakma
// noktası değil momentumun taşıdığı nokta veriyor; animasyon parmağın
// hızını devralıyor, yani sürükleme ile animasyon arasında dikiş yok.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useLayoutEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { animate } from 'motion';
import { projectMomentum, rubberband, haptic, Btn, IconBtn, Icon } from './kit.jsx';

// Sheet, aşağı sürüklenerek kapatılabilir. Kapanıp kapanmayacağına bırakma
// noktası değil, momentumun taşıyacağı nokta karar verir; kapanış animasyonu
// parmağın hızını devralır, yani sürükleme ile animasyon arasında dikiş olmaz.
// Yukarı çekişte lastik direnç var — sert durmak "donmuş" hissi verirdi.
export const SHEET_DISMISS_RATIO = 0.4;   // yüksekliğin bu kadarını geçerse kapanır

export function Sheet({ title, subtitle, onClose, children }) {
  // y'yi Framer'ın declarative animate'ine bırakmıyoruz: aynı değeri hem o
  // hem biz sürersek jest sırasındaki set'lerimiz eziliyor. Giriş, çıkış ve
  // sürükleme tek elden burada yönetiliyor.
  const y = useMotionValue(0);
  const panelRef = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight || 420;
    y.set(h);
    animate(y, 0, { type: "spring", bounce: 0.2, duration: 0.3 });
    // Yalnızca ilk açılışta: y ve panel yüksekliği ref üzerinden okunuyor
  }, []);

  // Kapanış her yoldan aynı: panel aşağı iner, sonra kapanır (§7 — giriş ve
  // çıkış aynı yolu izler)
  const close = () => {
    const h = panelRef.current?.offsetHeight || 420;
    animate(y, h, { type: "spring", bounce: 0, duration: 0.3 }).then(onClose);
  };
  // Perde panel indikçe soluklaşır; panelin kendisi solmaz — sürüklenen
  // nesne parmakla birebir kalmalı.
  const scrimOpacity = useTransform(y, [0, 320], [1, 0.12]);

  // Sürükleme Framer'ın drag'ine değil doğrudan Pointer Events'e bağlı:
  // dragConstraints kendi geri dönüşünü yapıp bırakma fiziğimizle çakışıyordu.
  const height = () => panelRef.current?.offsetHeight || 420;

  const onPointerDown = (e) => {
    // Düğmeden başlayan basış sürükleme değildir: pointer'ı yakalarsak
    // tıklama butona hiç ulaşmıyor ve kapatma çalışmıyordu.
    if (e.target.closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, base: y.get(), hist: [[performance.now(), e.clientY]] };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const raw = d.base + (e.clientY - d.startY);
    // Aşağı serbest, yukarı lastik direnç
    y.set(raw < 0 ? -rubberband(-raw, height()) : raw);
    d.hist.push([performance.now(), e.clientY]);
    if (d.hist.length > 6) d.hist.shift();
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    const [t0, y0] = d.hist[0];
    const [t1, y1] = d.hist[d.hist.length - 1];
    const velocity = t1 > t0 ? ((y1 - y0) / (t1 - t0)) * 1000 : 0;   // px/s
    // Bırakma noktası değil, momentumun taşıyacağı nokta karar verir
    const projected = y.get() + projectMomentum(velocity);
    if (projected > height() * SHEET_DISMISS_RATIO) {
      // Çıkış parmağın hızını devralır — sürükleme ile animasyon arasında dikiş yok
      animate(y, height(), { type: "spring", bounce: 0, duration: 0.35, velocity }).then(onClose);
    } else {
      // Apple'ın çekmece değerleri: damping 0.8 / response 0.3
      animate(y, 0, { type: "spring", bounce: 0.2, duration: 0.3, velocity });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={close}
      style={{ position: "absolute", inset: 0, zIndex: 320, display: "flex", alignItems: "flex-end" }}
    >
      <motion.div
        aria-hidden
        style={{ position: "absolute", inset: 0, background: "rgba(20,14,8,0.55)", backdropFilter: "blur(4px)", opacity: scrimOpacity }}
      />
      <motion.div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={title}
        style={{ y, position: "relative", width: "100%", maxHeight: "88%", overflowY: dragging ? "hidden" : "auto", background: "var(--c-card)", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: "20px 20px 24px" }}
      >
        {/* Sürükleme bölgesi: tutamaç ve başlık. İçerik kaydırılabilir kaldığı
            için jest yalnızca burada dinleniyor. */}
        <div
          data-sheet-drag
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab", margin: "-20px -20px 0", padding: "20px 20px 0" }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: dragging ? "#C9C1B8" : "#E5E0DA", margin: "0 auto 16px", transition: "background 0.2s" }} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "0 0 3px" }}>{title}</h3>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "var(--c-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</p>
            </div>
            <IconBtn onClick={close} tone="subtle" size={34} title="Kapat"
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
          </div>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Chip({ label, active, onClick }) {
  return (
    <motion.button
      onClick={onClick} className="gur-btn"
      whileTap={{ scale: 0.95 }} transition={{ type: "spring", bounce: 0, duration: 0.25 }}
      style={{
        border: `1.5px solid ${active ? "#FF6600" : "var(--c-border)"}`,
        background: active ? "var(--c-brand-soft)" : "var(--c-card)",
        color: active ? "#FF6600" : "var(--c-ink)",
        borderRadius: 12, padding: "9px 14px", cursor: "pointer", outline: "none",
        fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
      }}>{label}</motion.button>
  );
}

// Geri alınamayan işlemler için onay. Apple HIG: yıkıcı eylem kırmızı ve
// açık isimli, kaçış yolu ("Vazgeç") her zaman görünür.
export function DangerConfirm({ title, message, confirmText, onConfirm, onClose }) {
  return (
    <Sheet title={title} subtitle="Bu işlem geri alınamaz" onClose={onClose}>
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "var(--c-ink-2)", lineHeight: 1.55, margin: "0 0 20px" }}>{message}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn text={confirmText} onClick={() => { haptic([18, 40, 18]); onConfirm(); }} variant="destructive" />
        <Btn text="Vazgeç" onClick={onClose} variant="outlineDark" />
      </div>
    </Sheet>
  );
}
