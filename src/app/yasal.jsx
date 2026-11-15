// ═══════════════════════════════════════════════════════════════════════
// SİTENİN YASAL VE DESTEK SAYFALARI
//
//   /gizlilik   /kosullar   /kvkk   /hesap-silme   /destek
//
// Bunlar süs değil MAĞAZA GEREKSİNİMİ: Apple App Store Connect "Gizlilik
// Politikası URL'si" ve "Destek URL'si" ister; Google Play Console "Veri
// güvenliği" formunda hem gizlilik politikası hem de HESAP SİLME TALEBİ
// için herkese açık bir web adresi ister (uygulama içi silme tek başına
// yetmiyor). Metinler shared/legal.js'ten gelir — uygulamayla AYNI.
// ═══════════════════════════════════════════════════════════════════════

import React from "react";
import { WebHeader, WebFooter, Grain, KAP } from "./site.jsx";
import { GurStyles } from "../ui/kit.jsx";
import { LEGAL, LEGAL_DOCS, SILME_ADIMLARI, SILINEN_VERI, KALAN_VERI } from "../../shared/legal.js";

const ADRESLER = { gizlilik: "privacy", kosullar: "terms", kvkk: "kvkk" };

function Kabuk({ baslik, ust, children }) {
  return (
    <div style={{ background: "var(--c-bg)", minHeight: "100dvh", colorScheme: "light" }}>
      <GurStyles />
      <Grain />
      <WebHeader />
      <main style={{ maxWidth: Math.min(KAP, 760), margin: "0 auto", padding: "128px 20px 96px" }}>
        {ust ? <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.14em", color: "var(--c-brand-ink)", margin: "0 0 10px", textTransform: "uppercase" }}>{ust}</p> : null}
        <h1 style={{ fontFamily: "var(--f-display)", fontSize: "clamp(30px, 6vw, 46px)", lineHeight: 1.08, letterSpacing: "-0.03em", color: "var(--c-ink)", margin: "0 0 12px" }}>{baslik}</h1>
        {children}
      </main>
      <WebFooter />
    </div>
  );
}

const Para = ({ children }) => (
  <p style={{ fontFamily: "var(--f-body)", fontSize: 16, lineHeight: 1.7, color: "var(--c-ink-2)", margin: "0 0 14px" }}>{children}</p>
);
const Baslik = ({ children }) => (
  <h2 style={{ fontFamily: "var(--f-display)", fontSize: 20, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "30px 0 8px" }}>{children}</h2>
);
const Eposta = ({ adres }) => (
  <a href={`mailto:${adres}`} style={{ color: "var(--c-brand-ink)", fontWeight: 700 }}>{adres}</a>
);

/** Metin sayfası: gizlilik, koşullar, KVKK. */
export function YasalMetin({ ad }) {
  const doc = LEGAL_DOCS.find(d => d.id === ADRESLER[ad]) || LEGAL_DOCS[0];
  return (
    <Kabuk baslik={doc.title} ust={`${LEGAL.unvan} · Son güncelleme ${LEGAL.guncelleme}`}>
      {doc.body.map(([b, t]) => (
        <section key={b}><Baslik>{b}</Baslik><Para>{t}</Para></section>
      ))}
    </Kabuk>
  );
}

/** Google Play "hesap silme talebi" adresi + Apple'ın istediği açık yol. */
export function HesapSilme() {
  return (
    <Kabuk baslik="Hesabını sil" ust="GUR · Hesap ve veri silme">
      <Para>Hesabını ve ona bağlı verileri istediğin zaman silebilirsin. Silme geri alınamaz.</Para>
      <Baslik>Nasıl silerim?</Baslik>
      <ol style={{ margin: "0 0 14px", paddingLeft: 22 }}>
        {SILME_ADIMLARI.map(a => (
          <li key={a} style={{ fontFamily: "var(--f-body)", fontSize: 16, lineHeight: 1.7, color: "var(--c-ink-2)", marginBottom: 8 }}>{a}</li>
        ))}
      </ol>
      <Baslik>Neler silinir?</Baslik>
      <ul style={{ margin: "0 0 14px", paddingLeft: 22 }}>
        {SILINEN_VERI.map(a => (
          <li key={a} style={{ fontFamily: "var(--f-body)", fontSize: 16, lineHeight: 1.7, color: "var(--c-ink-2)" }}>{a}</li>
        ))}
      </ul>
      <Baslik>Neler kalabilir?</Baslik>
      <Para>{KALAN_VERI}</Para>
      <Para>Talebini e-postayla iletmek için: <Eposta adres={LEGAL.destek} /></Para>
    </Kabuk>
  );
}

/** Apple "Destek URL'si". */
export function Destek() {
  return (
    <Kabuk baslik="Destek" ust="GUR · Yardım">
      <Para>Bir sorun mu yaşıyorsun, bir mekân bilgisi hatalı mı, uygunsuz bir içerik mi gördün? Bize yaz: <Eposta adres={LEGAL.destek} /></Para>
      <Baslik>Sık sorulanlar</Baslik>
      <Para><strong>Mekânın bilgisi yanlış.</strong> Mekânın adını ve neyin hatalı olduğunu yaz. İşletme sahibiysen kaydını sahiplenip kendin düzeltebilirsin.</Para>
      <Para><strong>Hesabımı silmek istiyorum.</strong> Uygulamada Profil → "Hesabımı sil", ya da <a href="/hesap-silme" style={{ color: "var(--c-brand-ink)", fontWeight: 700 }}>hesap silme sayfası</a>.</Para>
      <Para><strong>Konum iznini vermek zorunda mıyım?</strong> Hayır. İlçeni seçerek de kullanabilirsin; konumun yalnızca cihazında kullanılır.</Para>
      <Para><strong>Kişisel verilerim hakkında bilgi almak istiyorum.</strong> <a href="/kvkk" style={{ color: "var(--c-brand-ink)", fontWeight: 700 }}>KVKK aydınlatma metni</a> ve <a href="/gizlilik" style={{ color: "var(--c-brand-ink)", fontWeight: 700 }}>gizlilik politikası</a>.</Para>
    </Kabuk>
  );
}
