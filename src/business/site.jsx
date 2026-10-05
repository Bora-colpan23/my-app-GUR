// ═══════════════════════════════════════════════════════════════════════
// DOYURUCU — İŞLETME WEB SİTESİ
//
// Doyurucu artık telefon çerçevesi içinde bir maket değil, kendi başına
// bir WEB SİTESİ. Restoran sahibi siteye masaüstünden geliyor, ne
// sunduğumuzu okuyor, buradan kayıt oluyor ve aynı site üzerinden panele
// giriyor.
//
// ÜÇ ARAYÜZ HÂLÂ TEK VERİ KATMANI. Site yeni bir ürün değil, Doyurucu'nun
// yeni kabuğu: kayıt `lib/b2b.js`e, dosyalar `lib/media.js`e, reklam
// tarihleri `lib/adslots.js`e yazılıyor — yani tüketici uygulaması ve
// yönetici paneli aynı kayıtları okumaya devam ediyor. Değişen şey yalnız
// kabuk ve yönlendirme.
//
// RENK: SİTE AÇIK, PANEL KOYU. Bilinçli bir sınır — site pazarlama,
// panel ürün. Geçiş girişte oluyor ve kullanıcı o anda zaten "içeri
// giriyorum" diyor. Paneli de açığa çevirmek 2500 satırlık koyu zemin
// arayüzünü (ve üstüne yazılmış panoyu) yeniden boyamak demekti; kazancı
// yoktu, riski büyüktü.
//
// Satır içi stil kuralı aynı. Responsive düzen `useMediaQuery` ile JS'te
// karara bağlanıyor çünkü satır içi stile `@media` yazılamıyor.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { GurLogo, Icon, Btn, useMediaQuery, GENIS, ELEV } from '../ui/kit.jsx';

const KAP = 1120;          // içerik kabının en büyük genişliği

// ─── Bölüm kabı ──────────────────────────────────────────────────────
export function Section({ children, id, bg = "transparent", pad = 72 }) {
  const genis = useMediaQuery(GENIS);
  return (
    <section id={id} style={{ background: bg, padding: `${genis ? pad : Math.round(pad * 0.62)}px 20px` }}>
      <div style={{ maxWidth: KAP, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

export function SectionTitle({ eyebrow, title, desc, center = true }) {
  return (
    <div style={{ textAlign: center ? "center" : "left", marginBottom: 36, maxWidth: center ? 620 : "none", marginLeft: center ? "auto" : 0, marginRight: center ? "auto" : 0 }}>
      {eyebrow && (
        <p style={{
          fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em",
          color: "var(--c-brand-ink)", margin: "0 0 10px", textTransform: "uppercase",
        }}>{eyebrow}</p>
      )}
      <h2 style={{
        fontFamily: "var(--f-display)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em",
        color: "var(--c-ink)", margin: "0 0 12px", lineHeight: 1.18,
      }}>{title}</h2>
      {desc && (
        <p style={{ fontFamily: "var(--f-body)", fontSize: 15.5, color: "var(--c-muted)", margin: 0, lineHeight: 1.6 }}>{desc}</p>
      )}
    </div>
  );
}

export function Card({ children, pad = 22, style }) {
  return (
    <div style={{
      background: "var(--c-card)", border: "1px solid var(--c-border)", borderRadius: 22,
      padding: pad, boxShadow: ELEV.restLight, ...style,
    }}>{children}</div>
  );
}

// ─── Üst çubuk ───────────────────────────────────────────────────────
// Sitenin gezinmesi. Dar ekranda bağlantılar bir açılır panele iniyor:
// sıkıştırmak yerine gizlemek — altı bağlantıyı 390 px'e dizmek hepsini
// okunmaz yapardı.
export function SiteHeader({ onGo, girisli, onLogout, aktif }) {
  const genis = useMediaQuery(GENIS);
  const [acik, setAcik] = useState(false);

  const baglantilar = [
    { id: "nasil", label: "Nasıl çalışır" },
    { id: "kazanc", label: "Ne kazanırsınız" },
    { id: "ucret", label: "Ücretlendirme" },
    { id: "sss", label: "Sık sorulanlar" },
  ];

  const git = (id) => {
    setAcik(false);
    if (aktif !== "landing") { onGo("landing", id); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const eylemler = (
    <>
      {girisli ? (
        <>
          <Btn text="Panele dön" onClick={() => { setAcik(false); onGo("panel"); }} variant="filled" size="md" fullWidth={!genis} />
          <Btn text="Çıkış" onClick={() => { setAcik(false); onLogout(); }} variant="outlineDark" size="md" fullWidth={!genis} />
        </>
      ) : (
        <>
          <Btn text="Giriş yap" onClick={() => { setAcik(false); onGo("giris"); }} variant="outlineDark" size="md" fullWidth={!genis} />
          <Btn text="Ücretsiz kayıt ol" onClick={() => { setAcik(false); onGo("kayit"); }} variant="filled" size="md" fullWidth={!genis} />
        </>
      )}
    </>
  );

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(253,251,247,0.86)", backdropFilter: "blur(14px)",
      borderBottom: "1px solid var(--c-border)",
    }}>
      <div style={{
        maxWidth: KAP, margin: "0 auto", padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      }}>
        <button type="button" onClick={() => onGo("landing")} className="gur-tap"
          style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <GurLogo size={38} pill />
          <span style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: "var(--c-ink-2)" }}>DOYURUCU</span>
        </button>

        {genis ? (
          <>
            <nav style={{ display: "flex", gap: 4 }}>
              {baglantilar.map(b => (
                <button key={b.id} type="button" onClick={() => git(b.id)} className="gur-tap"
                  style={{
                    background: "none", border: "none", cursor: "pointer", borderRadius: 999,
                    padding: "10px 13px", fontFamily: "var(--f-body)", fontSize: 14,
                    fontWeight: 600, color: "var(--c-ink-2)", whiteSpace: "nowrap",
                  }}>{b.label}</button>
              ))}
            </nav>
            <div style={{ display: "flex", gap: 8 }}>{eylemler}</div>
          </>
        ) : (
          <button type="button" onClick={() => setAcik(a => !a)}
            aria-expanded={acik} aria-label={acik ? "Menüyü kapat" : "Menüyü aç"}
            className="gur-icon-btn"
            style={{
              width: 42, height: 42, borderRadius: 14, border: "1px solid var(--c-border)",
              background: "var(--c-card)", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", padding: 0, outline: "none",
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-ink)" strokeWidth="2.2" strokeLinecap="round">
              {acik ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                    : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
          </button>
        )}
      </div>

      {!genis && acik && (
        <div style={{ borderTop: "1px solid var(--c-border)", background: "var(--c-card)", padding: "12px 20px 18px" }}>
          <nav style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
            {baglantilar.map(b => (
              <button key={b.id} type="button" onClick={() => git(b.id)}
                style={{
                  background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  padding: "13px 2px", minHeight: 44, fontFamily: "var(--f-body)",
                  fontSize: 15, fontWeight: 600, color: "var(--c-ink)",
                  borderBottom: "1px solid var(--c-subtle)",
                }}>{b.label}</button>
            ))}
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{eylemler}</div>
        </div>
      )}
    </header>
  );
}

// ─── Alt bilgi ───────────────────────────────────────────────────────
export function SiteFooter({ onGo }) {
  const genis = useMediaQuery(GENIS);
  return (
    <footer style={{ background: "var(--c-warm-1)", borderTop: "1px solid var(--c-border)", padding: "40px 20px 28px" }}>
      <div style={{
        maxWidth: KAP, margin: "0 auto",
        display: "flex", flexDirection: genis ? "row" : "column", gap: 28,
        justifyContent: "space-between", alignItems: genis ? "flex-start" : "stretch",
      }}>
        <div style={{ maxWidth: 320 }}>
          <GurLogo size={40} pill />
          <p style={{ fontFamily: "var(--f-body)", fontSize: 13.5, color: "var(--c-muted)", margin: "12px 0 0", lineHeight: 1.6 }}>
            Doyurucu, GUR'un işletme tarafıdır. Restoranınızın GUR'daki kaydını
            buradan yönetirsiniz.
          </p>
        </div>

        <div style={{ display: "flex", gap: genis ? 56 : 28, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "var(--c-ink)", margin: "0 0 10px" }}>İŞLETME</p>
            {[["kayit", "Kayıt ol"], ["sahiplen", "Kaydını sahiplen"], ["giris", "Giriş yap"]].map(([id, t]) => (
              <button key={id} type="button" onClick={() => onGo(id)} className="gur-tap"
                style={{ display: "block", background: "none", border: "none", cursor: "pointer", padding: "5px 0", fontFamily: "var(--f-body)", fontSize: 13.5, color: "var(--c-ink-2)" }}>{t}</button>
            ))}
          </div>
          <div>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "var(--c-ink)", margin: "0 0 10px" }}>GUR</p>
            <a href="/" className="gur-tap" style={{ display: "block", padding: "5px 0", fontFamily: "var(--f-body)", fontSize: 13.5, color: "var(--c-ink-2)", textDecoration: "none" }}>Tüketici uygulaması</a>
            <span style={{ display: "block", padding: "5px 0", fontFamily: "var(--f-body)", fontSize: 13.5, color: "var(--c-muted)" }}>İstanbul</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: KAP, margin: "26px auto 0", paddingTop: 18, borderTop: "1px solid var(--c-border)" }}>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "var(--c-muted)", margin: 0 }}>
          © {new Date().getFullYear()} GUR · Kayıt ve panel kullanımı ücretsizdir, işletme aboneliği yoktur.
        </p>
      </div>
    </footer>
  );
}

// ─── Form sayfaları için dar kap ─────────────────────────────────────
// Kayıt, sahiplenme ve giriş ekranları telefon için yazılmıştı; web'de
// ekranın tamamına yayılsalardı satır uzunluğu okunmaz olurdu. Ortada
// sabit genişlikte bir sütunda duruyorlar — matbaanın kendi kuralı.
export function FormKap({ children, en = 560 }) {
  return (
    <div style={{ background: "var(--c-warm-1)", minHeight: "70vh", padding: "32px 20px 56px" }}>
      {/* Kartın zemini kâğıt kremi: içindeki ekranlar kendi <Screen>
          kabuğunu çiziyor ve o da kremsi — beyaz kart koysaydık kartın
          içinde ikinci bir ton belirirdi. */}
      <div style={{
        maxWidth: en, margin: "0 auto", background: "var(--c-bg)",
        border: "1px solid var(--c-border)", borderRadius: 26, overflow: "hidden",
        boxShadow: ELEV.restLight,
      }}>{children}</div>
    </div>
  );
}

// ─── Tanıtım sayfası ─────────────────────────────────────────────────

const ADIMLAR = [
  {
    n: "01", baslik: "Kaydınızı bulun ya da oluşturun",
    metin: "GUR'un mekan havuzu dış kaynaklardan otomatik doluyor, bu yüzden restoranınız büyük ihtimalle zaten listede. Arayıp sahiplenin; yoksa sıfırdan kayıt açın.",
  },
  {
    n: "02", baslik: "Kısa bir inceleme",
    metin: "Yeni kayıtlar ve değiştirdiğiniz alanlar yayına çıkmadan önce GUR ekibinin onayından geçiyor. Kullanıcıya yanlış telefon ya da yanlış adres göstermemek için.",
  },
  {
    n: "03", baslik: "Panelden yönetin",
    metin: "Bilgiler, menü, fotoğraflar, masa talepleri ve etkileşim panosu tek yerde. Girdiğiniz her alan dış kaynaktan geleni ezer; boş bıraktığınız alan beslemeden gelmeye devam eder.",
  },
];

const KAZANCLAR = [
  { ikon: "plate", baslik: "Keşif akışında yer", metin: "Kullanıcılar restoranları kaydırarak keşfediyor. Kaydınız organik akışın içinde; sıralamayı konum ve ilgi belirliyor." },
  { ikon: "doc", baslik: "Bilgileriniz sizin", metin: "Tanıtım yazısı, saatler, fiyat aralığı, telefon, adres. Hangi alanın sizden hangisinin dış kaynaktan geldiği panelde rozetle yazılı." },
  { ikon: "clock", baslik: "Masa talepleri", metin: "Kullanıcı uygulamadan masa ayırtıyor, talep panelinize düşüyor. Tamamen ücretsiz — rezervasyon komisyonu yok." },
  { ikon: "pin", baslik: "Konum doğrulamalı yorum", metin: "Yorum yazabilmek için mekânda yeterince kalmış olmak gerekiyor. Yorumlar \"Konumla doğrulandı\" rozeti alıyor." },
  { ikon: "chart", baslik: "Etkileşim panosu", metin: "Kaç kişi gördü, kaçı beğendi, hangi saatlerde keşfedildiniz. Ölü saatinizi görüp fırsatınızı oraya koyabilirsiniz." },
  { ikon: "star", baslik: "Gastro Onaylı", metin: "Tanınmış şeflerin değerlendirmesine dayanan rozet. Satın alınamaz; bağımsız bir karardır." },
];

const SSS = [
  {
    s: "Restoranım zaten GUR'da görünüyor, ne yapmalıyım?",
    c: "Havuz dış kaynaklardan dolduğu için kaydınız sizden önce oluşmuş olabilir. \"Kaydını sahiplen\" ile arayıp başvurun; onaylandığında yönetim size geçer ve o güne kadarki bilgiler korunur.",
  },
  {
    s: "Kayıt olmak ücretli mi?",
    c: "Hayır. Kayıt, panel ve masa ayırtma ücretsiz. İşletme aboneliği diye bir şey yok — ne Premium ne Pro. Ödediğiniz tek şey varsa, tek tek satın aldığınız reklam kalemleridir.",
  },
  {
    s: "Reklam almak zorunda mıyım?",
    c: "Hayır. Reklam almayan bir restoran da keşif akışında görünür. Reklam yalnızca görünürlüğü hızlandırır.",
  },
  {
    s: "Yüklediğim fotoğraf hemen yayına girer mi?",
    c: "Girmez. Menü, fotoğraf ve reklam materyali yönetici onayından geçiyor. Reddedilirse sebebi panelinizde dosyanın altında yazıyor.",
  },
  {
    s: "Masa ayırtmadan komisyon alıyor musunuz?",
    c: "Almıyoruz. Masa ayırtma yalnızca kaydını sahiplenmiş işletmelerde açık, çünkü sahipsiz bir mekan adına söz veremeyiz.",
  },
];

function AdimKart({ a }) {
  return (
    <Card pad={24}>
      <p style={{ fontFamily: "var(--f-display)", fontSize: 28, fontWeight: 800, color: "var(--c-brand-ink)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>{a.n}</p>
      <h3 style={{ fontFamily: "var(--f-body)", fontSize: 17, fontWeight: 800, color: "var(--c-ink)", margin: "0 0 8px" }}>{a.baslik}</h3>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 14, color: "var(--c-muted)", margin: 0, lineHeight: 1.6 }}>{a.metin}</p>
    </Card>
  );
}

function KazancKart({ k }) {
  return (
    <Card pad={22}>
      <div style={{
        width: 44, height: 44, borderRadius: 14, background: "var(--c-brand-soft)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
      }}>
        <Icon n={k.ikon} size={20} color="#FF6600" />
      </div>
      <h3 style={{ fontFamily: "var(--f-body)", fontSize: 16, fontWeight: 800, color: "var(--c-ink)", margin: "0 0 7px" }}>{k.baslik}</h3>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 13.5, color: "var(--c-muted)", margin: 0, lineHeight: 1.6 }}>{k.metin}</p>
    </Card>
  );
}

function SSSSatir({ q, acikMi, onToggle }) {
  return (
    <div style={{ borderBottom: "1px solid var(--c-border)" }}>
      <button type="button" onClick={onToggle} aria-expanded={acikMi}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, background: "none", border: "none", cursor: "pointer", textAlign: "left",
          padding: "18px 2px", minHeight: 44,
        }}>
        <span style={{ fontFamily: "var(--f-body)", fontSize: 15.5, fontWeight: 700, color: "var(--c-ink)" }}>{q.s}</span>
        <span aria-hidden="true" style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: "var(--c-brand-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: acikMi ? "rotate(45deg)" : "none", transition: "transform 0.22s",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B4530A" strokeWidth="2.6" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
      </button>
      {acikMi && (
        <p style={{ fontFamily: "var(--f-body)", fontSize: 14.5, color: "var(--c-muted)", margin: "0 0 18px", lineHeight: 1.65, paddingRight: 42 }}>{q.c}</p>
      )}
    </div>
  );
}

export function Landing({ onGo }) {
  const genis = useMediaQuery(GENIS);
  const [sss, setSss] = useState(0);

  const izgara = (min) => ({
    display: "grid",
    gridTemplateColumns: genis ? `repeat(auto-fit, minmax(${min}px, 1fr))` : "1fr",
    gap: 16,
  });

  return (
    <div style={{ background: "var(--c-bg)" }}>
      {/* ── Kahraman ── */}
      <Section pad={genis ? 84 : 56}>
        <div style={{
          display: "grid", gridTemplateColumns: genis ? "1.05fr 0.95fr" : "1fr",
          gap: genis ? 48 : 32, alignItems: "center",
        }}>
          <div>
            <p style={{
              display: "inline-block", fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800,
              letterSpacing: "0.08em", color: "var(--c-brand-ink-soft)", background: "var(--c-brand-soft)",
              borderRadius: 999, padding: "6px 13px", margin: "0 0 18px",
            }}>GUR İŞLETME</p>

            <h1 style={{
              fontFamily: "var(--f-display)", fontSize: genis ? 46 : 34, fontWeight: 800,
              letterSpacing: "-0.03em", lineHeight: 1.1, color: "var(--c-ink)", margin: "0 0 18px",
            }}>
              Restoranınız İstanbul'un keşif akışında
            </h1>

            <p style={{
              fontFamily: "var(--f-body)", fontSize: genis ? 17 : 15.5, color: "var(--c-muted)",
              lineHeight: 1.65, margin: "0 0 26px", maxWidth: 520,
            }}>
              GUR kullanıcıları restoranları kaydırarak keşfediyor. Kaydınızı
              sahiplenin; bilgilerinizi, menünüzü ve fotoğraflarınızı siz yönetin,
              kaç kişinin kartınızı gördüğünü panelden görün.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <Btn text="Ücretsiz kayıt ol" onClick={() => onGo("kayit")} variant="filled" size="lg" fullWidth={false} />
              <Btn text="İşletmem zaten GUR'da" onClick={() => onGo("sahiplen")} variant="outlineDark" size="lg" fullWidth={false} />
            </div>

            <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "var(--c-muted)", margin: 0, lineHeight: 1.6 }}>
              Kayıt, panel ve masa ayırtma ücretsiz. İşletme aboneliği yok,
              rezervasyon komisyonu yok.
            </p>
          </div>

          {/* Ürünün kendisi: panelin ne gösterdiğini anlatan bir özet kart.
              Ekran görüntüsü koymuyoruz — panel sık değişiyor ve bayat bir
              görsel, olmayan bir özelliği vaat etmekten kötü değil ama
              yanıltıcı olur. */}
          <Card pad={genis ? 26 : 20} style={{ borderRadius: 26 }}>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "var(--c-muted)", margin: "0 0 16px" }}>PANELDE NE VAR</p>
            {[
              ["chart", "Etkileşim panosu", "Görüntülenme, beğeni oranı, yoğun saatler"],
              ["doc", "Bilgi ve menü yönetimi", "Girdiğiniz alan dış kaynağı ezer"],
              ["clock", "Masa talepleri", "Gelen talebi onaylayın ya da reddedin"],
              ["camera", "Fotoğraf ve reklam dosyaları", "Onay kuyruğundan geçer"],
            ].map(([ikon, b, alt], i) => (
              <div key={b} style={{
                display: "flex", gap: 13, alignItems: "flex-start",
                padding: "13px 0", borderTop: i ? "1px solid var(--c-subtle)" : "none",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: "var(--c-brand-soft)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon n={ikon} size={17} color="#FF6600" />
                </div>
                <div>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 14.5, fontWeight: 700, color: "var(--c-ink)", margin: "0 0 2px" }}>{b}</p>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "var(--c-muted)", margin: 0, lineHeight: 1.5 }}>{alt}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </Section>

      {/* ── Nasıl çalışır ── */}
      <Section id="nasil" bg="var(--c-warm-1)">
        <SectionTitle
          eyebrow="Nasıl çalışır"
          title="Üç adımda GUR'dasınız"
          desc="Kaydınızı sahiplenmek birkaç dakika sürüyor; gerisini panel yapıyor." />
        <div style={izgara(260)}>
          {ADIMLAR.map(a => <AdimKart key={a.n} a={a} />)}
        </div>
      </Section>

      {/* ── Ne kazanırsınız ── */}
      <Section id="kazanc">
        <SectionTitle
          eyebrow="Ne kazanırsınız"
          title="Kaydınızın sahibi siz olun"
          desc="Dış kaynaktan gelen bir kayıt eksik ve eskidir. Sahiplendiğinizde mekânın GUR'daki yüzünü siz yazarsınız." />
        <div style={izgara(300)}>
          {KAZANCLAR.map(k => <KazancKart key={k.baslik} k={k} />)}
        </div>
      </Section>

      {/* ── Ücretlendirme ── */}
      <Section id="ucret" bg="var(--c-warm-1)">
        <SectionTitle
          eyebrow="Ücretlendirme"
          title="Abonelik yok, yalnızca aldığınız kalem"
          desc="Bir işletmenin ödediği tutarın tamamı tek tek satın aldığı kalemlerden gelir. Plana bağlı görünürlük diye bir mekanizma yok." />

        <div style={{ display: "grid", gridTemplateColumns: genis ? "1fr 1fr 1fr" : "1fr", gap: 16 }}>
          <Card pad={24} style={{ borderColor: "rgba(255,102,0,0.3)" }}>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "var(--c-brand-ink)", margin: "0 0 10px" }}>ÜCRETSİZ</p>
            <h3 style={{ fontFamily: "var(--f-display)", fontSize: 26, fontWeight: 800, color: "var(--c-ink)", margin: "0 0 14px", letterSpacing: "-0.02em" }}>₺0</h3>
            {["Kayıt ve sahiplenme", "İşletme paneli", "Bilgi, menü, fotoğraf yönetimi", "Masa ayırtma (komisyon yok)", "Etkileşim panosu"].map(t => (
              <p key={t} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontFamily: "var(--f-body)", fontSize: 13.5, color: "var(--c-ink-2)", margin: "0 0 8px", lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}><Icon n="check" size={14} color="var(--c-ok-ink)" /></span>{t}
              </p>
            ))}
          </Card>

          <Card pad={24}>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "var(--c-muted)", margin: "0 0 10px" }}>SABİT FİYATLI REKLAM</p>
            <h3 style={{ fontFamily: "var(--f-body)", fontSize: 17, fontWeight: 800, color: "var(--c-ink)", margin: "0 0 14px" }}>Günlük fiyat, takvimden tarih</h3>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 13.5, color: "var(--c-muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
              Keşfet banner'ı, ödüllü video ve push bildirimi. Fiyat listede yazıyor
              ve müşteriye göre değişmiyor; 1–7 gün arası seçersiniz.
            </p>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "var(--c-ink-2)", margin: 0, lineHeight: 1.6, background: "var(--c-subtle)", borderRadius: 12, padding: "10px 12px" }}>
              Satın alma serbest değil: tarihi siz seçersiniz, onaylandığında slot
              kilitlenir ve yayına girer.
            </p>
          </Card>

          <Card pad={24}>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "var(--c-muted)", margin: "0 0 10px" }}>PAZARLIKLI KALEMLER</p>
            <h3 style={{ fontFamily: "var(--f-body)", fontSize: 17, fontWeight: 800, color: "var(--c-ink)", margin: "0 0 14px" }}>Teklif istersiniz</h3>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 13.5, color: "var(--c-muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
              Gastro şef videosu paketi, İkinci Şans paketi ve anlık fırsat. Bedel
              mekâna göre konuşuluyor, panelde yazan rakam başlangıç noktasıdır.
            </p>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "var(--c-ink-2)", margin: 0, lineHeight: 1.6, background: "var(--c-subtle)", borderRadius: 12, padding: "10px 12px" }}>
              Panelde "satın al" düğmesi yoktur: teklif istersiniz, gelen teklifi
              kabul ya da reddedersiniz.
            </p>
          </Card>
        </div>
      </Section>

      {/* ── SSS ── */}
      <Section id="sss">
        <SectionTitle eyebrow="Sık sorulanlar" title="Merak edilenler" />
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {SSS.map((q, i) => (
            <SSSSatir key={q.s} q={q} acikMi={sss === i} onToggle={() => setSss(sss === i ? -1 : i)} />
          ))}
        </div>
      </Section>

      {/* ── Son çağrı ── */}
      <Section pad={56}>
        <div className="gur-on-brand" style={{
          background: "linear-gradient(145deg, #FF7A1A 0%, #FF6600 55%, #F04E00 100%)",
          borderRadius: 28, padding: genis ? "48px 44px" : "32px 22px", textAlign: "center",
          boxShadow: "var(--sh-brand-lg)",
        }}>
          <h2 style={{
            fontFamily: "var(--f-display)", fontSize: genis ? 32 : 25, fontWeight: 800,
            letterSpacing: "-0.02em", color: "var(--c-on-brand)", margin: "0 0 12px", lineHeight: 1.2,
          }}>
            Kaydınız sizi bekliyor
          </h2>
          <p style={{
            fontFamily: "var(--f-body)", fontSize: 15.5, color: "var(--c-on-brand-2)",
            margin: "0 auto 24px", maxWidth: 480, lineHeight: 1.6,
          }}>
            Restoranınız havuzda zaten varsa sahiplenin, yoksa birkaç dakikada
            yeni kayıt açın.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Btn text="Ücretsiz kayıt ol" onClick={() => onGo("kayit")} variant="onColor" size="lg" fullWidth={false} />
            <Btn text="Kaydını sahiplen" onClick={() => onGo("sahiplen")} variant="outlineBrand" size="lg" fullWidth={false} />
          </div>
        </div>
      </Section>
    </div>
  );
}
