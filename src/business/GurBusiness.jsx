// ═══════════════════════════════════════════════════════════════════════
// GUR DOYURUCU — işletme uygulaması
//
// Tüketici uygulamasından ayrı bir uygulama: kendi rotası (/isletme), kendi
// girişi, kendi oturumu. İşletme sahibi buradan giriş yapar; müşteri
// uygulamasında artık işletme girişi yok.
//
// Üçü tek üründür ve aynı veri katmanını paylaşır:
//   src/lib/b2b.js        → sahiplenme başvurusu, işletmenin girdiği alanlar, logo
//   src/lib/platform.js   → yöneticinin açıp kapattığı özellik kapıları
//   src/lib/reservations.js → masa talepleri (tüketiciden gelir, burada karara bağlanır)
//   src/lib/pricing.js    → yöneticinin gönderdiği fiyat teklifleri
//   src/ui/kit.jsx        → ortak buton/alan/yüzey
//
// Yani "ayrı uygulama" kopya kod demek değil: ekranlar ayrı, kayıt ortak.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import {
  GurLogo, Icon, Img, InputField, SelectField, Btn, IconBtn, Spinner, GlossDefs,
  HScroll, UploadBox, PhoneFrame, Screen, GurStyles, VerifiedStar,
  GRAD, BackBtn, haptic, keepVisible, toMediaFiles,
} from '../ui/kit.jsx';
import {
  submitClaim, useClaims, applyOwnerProfile, useOwnerProfiles,
  saveOwnerProfile, saveOwnerLogo, clearOwnerLogo, ownerLogo, OVERRIDABLE,
} from '../lib/b2b.js';
import { fileToSquareDataUrl } from '../lib/image.js';
import { useFeature, useServiceOpen } from '../lib/platform.js';
import * as reservations from '../lib/reservations.js';
import * as pricing from '../lib/pricing.js';
import * as backend from '../lib/backend.js';
import { useModeration, pendingChangeFor } from '../lib/moderation.js';
import * as secondChance from '../lib/second-chance.js';
import { useRequests, requestFor, requestQuote, withdraw } from '../lib/requests.js';
import {
  useMedia, KINDS as MEDIA_KINDS, AD_KINDS, listMedia, addMedia, removeMedia,
  statusSummary, ownerMediaFor, isVideo as mediaIsVideo, sizeLabel as mediaSize,
} from '../lib/media.js';
import { useCreatives, promoFor, isVideo as promoIsVideo } from '../lib/creatives.js';
import {
  AD_PRODUCTS, isFixedPrice, useAdSlots, priceOf, canBook, requestBooking,
  cancelBooking, bookingsOfRestaurant, dayState, monthGrid, today, endOf,
  prettyDay, gunFarki, slotsOf, WEEKDAYS_TR, MONTHS_TR as AY_ADLARI,
} from '../lib/adslots.js';
import { RESTAURANTS, findOwnerRestaurant, withOwnerMedia } from '../data/restaurants.js';
import { DangerConfirm, Sheet } from '../ui/sheets.jsx';

// ═══════════════════════════════════════════════
// DOYURUCU GİRİŞ — Hesap seçimi
// ═══════════════════════════════════════════════
function DoyurucuAuthScreen({ onLogin, onRegister, onClaim }) {
  return (
    <Screen grad={false}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        {/* Üst beyaz alan */}
        <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,102,0,0.04)" }} />
          <div style={{ position: "absolute", bottom: -15, left: -20, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,0,0,0.03)" }} />
          
{/* Yalnızca logo: üstteki ikon ve "DOYURUCU PANELİ" yazısı, altındaki
              başlık zaten aynı şeyi söylediği için gereksizdi. */}
          <div style={{ animation: "fadeInUp 0.6s ease-out" }}>
            <GurLogo size={72} pill />
          </div>
        </div>

        {/* Alt turuncu alan */}
        <div className="gur-on-brand" style={{ background: GRAD, padding: "28px 28px 50px", borderTopLeftRadius: 40, borderTopRightRadius: 40, position: "relative" }}>
          {/* Bu ekran işletme uygulamasının başlangıcı: geri gidilecek bir
              yer yok, geri düğmesi de yok. Tıklandığında hiçbir şey
              yapmayan bir düğme, olmayan düğmeden kötü. */}

          <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", background: "#fff", borderRadius: 20, padding: "8px 20px", boxShadow: "var(--sh-brand)" }}>
            <GurLogo size={22} pill />
          </div>

          <h2 style={{ fontFamily: "var(--f-body)", fontSize: 14, color: "var(--c-on-brand)", textAlign: "center", margin: "16px 0 8px" }}>Doyurucu Girişi</h2>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "var(--c-on-brand-2)", textAlign: "center", margin: "0 0 28px", lineHeight: 1.5 }}>
            Restoranınızı yönetin, istatistikleri takip edin
          </p>

          <Btn text="Giriş Yap" onClick={onLogin} />
          <div style={{ height: 12 }} />
          <Btn text="Yeni Hesap Oluştur" onClick={onRegister} variant="outlineBrand" />
          <div style={{ height: 12 }} />
          {/* Havuzdaki kayıtların çoğu dış API'lerden geliyor: işletmenin
              sıfırdan kayıt açması değil, var olanı sahiplenmesi asıl yol. */}
          <Btn text="İşletmem zaten GUR'da — sahiplen" onClick={onClaim} variant="outlineBrand" />
        </div>
      </div>
    </Screen>
  );
}

// İşletmenin kendi bilgileri.
//
// Havuzdaki kaydın çoğu dış API'lerden geliyor. İşletme bir alanı
// doldurursa o alan API'yi ezer; boş bırakırsa API'den gelmeye devam eder.
// Hangi alanın nereden geldiği açıkça yazılır ki işletme "benim girmediğim
// bu bilgi nereden geldi" diye sormasın.
const INFO_FIELDS = [
  { key: "name",  label: "İşletme adı",   placeholder: "Görünen ad" },
  { key: "desc",  label: "Tanıtım yazısı", placeholder: "Mekânı bir iki cümleyle anlat", multiline: true },
  { key: "hours", label: "Çalışma saatleri", placeholder: "11:00 - 23:00" },
  { key: "price", label: "Fiyat aralığı", placeholder: "₺400+" },
  { key: "phone", label: "Telefon",       placeholder: "0216 000 00 00" },
  { key: "addr",  label: "Adres",         placeholder: "Mahalle, cadde, no" },
];

// İşletmenin aldığı hizmetler — yalnızca Doyurucu panelinde.
// Tüketici tarafında bilinçli olarak yok: kullanıcı bir mekânın hangi
// paketi satın aldığını değil, mekânın kendisini görmeli.
function OwnerServices({ restaurant }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    if (!restaurant) return;
    let off = false;
    backend.loadRestaurantDetail(restaurant).then(d => { if (!off) setDetail(d); });
    return () => { off = true; };
  }, [restaurant]);

  if (!restaurant) return null;
  const svc = detail?.services;
  const campaigns = svc?.campaigns || [];

  return (
    <div style={{ background: "rgba(255,102,0,0.07)", border: "1px solid rgba(255,102,0,0.2)", borderRadius: 20, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 800, color: "#fff", margin: 0 }}>Aldığın hizmetler</p>
        {/* PLAN ROZETİ KALDIRILDI — işletme aboneliği yok. Ödenen tutarın
            tamamı satın alınan ücretli özelliklerden geliyor; "hangi
            kademedeyim" diye bir bilgi artık yok. */}
        <span style={{ fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.07)", borderRadius: 6, padding: "3px 9px" }}>
          {campaigns.length} KALEM
        </span>
      </div>

      {campaigns.length === 0 ? (
        <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: 0 }}>
          Yayında kampanyan yok. Büyüme sekmesinden öne çıkan kart, banner veya
          push bildirimi satın alarak keşif akışında görünürlüğünü artırabilirsin.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {campaigns.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-ok)", flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 600, color: "#fff" }}>
                {c.label} kartı
              </span>
              <span style={{ fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.45)", letterSpacing: 0.3 }}>
                {String(c.pricing || "").toLocaleUpperCase("tr")}
              </span>
            </div>
          ))}
          <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, margin: "2px 0 0" }}>
            Bu hizmetler restoran sayfanda kullanıcıya da açıkça gösteriliyor.
          </p>
        </div>
      )}
    </div>
  );
}

function OwnerInfoTab({ restaurant }) {
  const modState = useModeration();
  const profiles = useOwnerProfiles();
  const own = profiles[String(restaurant?.id)] || {};
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(INFO_FIELDS.map(f => [f.key, own[f.key] || ""])));
  const [saved, setSaved] = useState(false);

  if (!restaurant) {
    return <LockedCard text="Önce bir işletme sahiplen; bilgiler o kayda yazılır." />;
  }

  const save = async () => {
    await backend.saveOwnerFields(restaurant.id, draft, { restaurantName: restaurant.name });
    haptic(12);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const filled = OVERRIDABLE.filter(f => draft[f]?.trim()).length;
  // Bekleyen değişiklik: girilen alan yayında değil, yöneticide.
  const bekleyen = pendingChangeFor(restaurant?.id, modState);

  return (
    <div>
      {/* İşletmenin aldığı hizmetler — panelin en üstünde, hangi ürünün
          açık olduğu tek bakışta görünsün. */}
      <OwnerServices restaurant={restaurant} />

      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "14px 16px", marginBottom: 16 }}>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.55 }}>
          Kaydın harita servislerinden otomatik oluşturuldu. Doldurduğun alanlar bu veriyi
          ezer; boş bıraktıkların API'den gelmeye devam eder.
          <br />Girdiğin bilgiler <b>yayına girmeden önce GUR ekibince incelenir</b>.
        </p>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, fontWeight: 700, color: "var(--c-warn)", margin: "9px 0 0" }}>
          {filled}/{OVERRIDABLE.length} alan işletmeden
        </p>
      </div>

      {INFO_FIELDS.map(f => {
        const incelemede = !!bekleyen && Object.prototype.hasOwnProperty.call(bekleyen.fields, f.key);
        const fromOwner = !incelemede && !!own[f.key]?.trim();
        return (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{f.label}</label>
              {/* Rozetin üçüncü hâli: İNCELEMEDE. Onaylanmamış bir değere
                  "İŞLETMEDEN" demek yalan olurdu — o değer henüz yayında
                  değil, yöneticinin önünde. */}
              <span style={{
                fontFamily: "var(--f-body)", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4,
                padding: "2px 8px", borderRadius: 6,
                color: incelemede ? "var(--c-warn-light)" : fromOwner ? "var(--c-ok-light)" : "rgba(255,255,255,0.45)",
                background: incelemede ? "rgba(245,158,11,0.16)" : fromOwner ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.07)",
              }}>{incelemede ? "İNCELEMEDE" : fromOwner ? "İŞLETMEDEN" : "API'DEN"}</span>
            </div>
            {f.multiline ? (
              <textarea
                value={draft[f.key]} rows={3} onFocus={keepVisible}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={restaurant[f.key] || f.placeholder}
                style={{ width: "100%", resize: "vertical", borderRadius: 14, padding: "11px 13px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontFamily: "var(--f-body)", fontSize: 16, lineHeight: 1.5, outline: "none", boxSizing: "border-box" }}
              />
            ) : (
              <input
                value={draft[f.key]} onFocus={keepVisible}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={restaurant[f.key] || f.placeholder}
                style={{ width: "100%", borderRadius: 14, padding: "11px 13px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", WebkitTextFillColor: "#fff", fontFamily: "var(--f-body)", fontSize: 16, outline: "none", boxSizing: "border-box" }}
              />
            )}
            {!fromOwner && restaurant[f.key] && (
              <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(255,255,255,0.32)", margin: "5px 0 0" }}>
                Şu an gösterilen: {String(restaurant[f.key]).slice(0, 70)}
              </p>
            )}
          </div>
        );
      })}

      <Btn text={saved ? "Kaydedildi" : "Bilgileri kaydet"} onClick={save} variant="filled" />
    </div>
  );
}

// ═══════════════════════════════════════════════
// İŞLETME SAHİPLENME (CLAIM)
//
// Mekan havuzu dış API'lerden otomatik doluyor (Google Places, Foursquare,
// OSM). İşletme kendi kaydını burada bulur, sahiplenme başvurusu yapar;
// yönetici onaylayınca panel erişimi açılır.
//
// Onaydan sonra işletmenin girdiği alanlar dış kaynağı ezer; girmediği
// alanlar API'den gelmeye devam eder (bkz. src/lib/b2b.js).
// ═══════════════════════════════════════════════
function ClaimScreen({ onBack, onDone, restaurants = [] }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState({ legalName: "", taxId: "", contactName: "", phone: "", email: "" });
  const [error, setError] = useState(null);
  const claims = useClaims();

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (q.length < 2) return [];
    return restaurants
      .filter(r => r.name.toLocaleLowerCase("tr").includes(q) || (r.addr || "").toLocaleLowerCase("tr").includes(q))
      .slice(0, 8);
  }, [query, restaurants]);

  const statusFor = (id) => claims.find(c => String(c.restaurantId) === String(id))?.status;
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.legalName.trim() || !form.contactName.trim() || !form.phone.trim()) {
      setError("Ticaret unvanı, yetkili adı ve telefon zorunlu.");
      return;
    }
    setBusy(true); setError(null);
    // Canlı modda başvuru veritabanına, yerelde localStorage'a düşer;
    // her iki durumda da yönetici panelinde görünür.
    const res = await backend.submitClaim({
      restaurantId: picked.id, restaurantName: picked.name, ...form,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.reason === "already_pending"
        ? "Bu işletme için zaten bekleyen bir başvuru var."
        : res.reason || "Başvuru gönderilemedi.");
      return;
    }
    haptic([12, 30, 18]);
    onDone(picked);
  };

  return (
    <Screen grad={false}>
      <div style={{ height: "100%", background: "#fff", overflowY: "auto" }}>
        <div style={{ padding: "44px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <BackBtn onClick={onBack} variant="light" />
            <h2 style={{ fontFamily: "var(--f-body)", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "#1C1917", margin: 0 }}>İşletmemi sahiplen</h2>
          </div>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "#8A7A68", lineHeight: 1.55, margin: "0 0 18px" }}>
            İşletmen büyük ihtimalle GUR'da zaten var: harita servislerinden otomatik olarak
            ekleniyor. Kaydını bul, sahiplen; onaydan sonra menü, fotoğraf ve bilgileri sen yönetirsin.
          </p>
        </div>

        <div style={{ padding: "0 20px 120px" }}>
          {!picked ? (
            <>
              <div style={{ position: "relative", marginBottom: 14 }}>
                <input
                  value={query} onChange={e => setQuery(e.target.value)} onFocus={keepVisible}
                  placeholder="İşletme adı veya adres yaz…"
                  style={{ width: "100%", padding: "14px 16px 14px 42px", borderRadius: 16, border: "1px solid rgba(45,36,25,0.12)", outline: "none", fontSize: 16, fontFamily: "var(--f-body)", background: "#FBFAF8", color: "#2D2419", WebkitTextFillColor: "#2D2419", boxSizing: "border-box" }}
                />
                <div style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }}>
                  <Icon n="search" size={16} color="#A8A29E" />
                </div>
              </div>

              {query.trim().length >= 2 && results.length === 0 && (
                <div style={{ textAlign: "center", padding: "26px 16px" }}>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 13.5, color: "#8A7A68", margin: "0 0 4px" }}>Bu isimde bir kayıt bulamadık</p>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "#A8A29E", lineHeight: 1.5, margin: 0 }}>
                    Havuzda yoksa sıfırdan kayıt açabilirsin — geri dönüp "Yeni Hesap Oluştur" adımını seç.
                  </p>
                </div>
              )}

              {results.map(r => {
                const st = statusFor(r.id);
                return (
                  <button
                    key={r.id} type="button" className="gur-btn"
                    onClick={() => !st && setPicked(r)}
                    disabled={!!st}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                      border: "none", background: "transparent", padding: "11px 0", cursor: st ? "not-allowed" : "pointer",
                      outline: "none", borderBottom: "1px solid rgba(0,0,0,0.06)", opacity: st ? 0.5 : 1,
                    }}>
                    <div style={{ width: 48, height: 48, borderRadius: 13, overflow: "hidden", flexShrink: 0, position: "relative" }}>
                      <Img src={r.imgs[0]} style={{ position: "absolute", inset: 0 }} bg="#e8e0d8" box={48} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 700, color: "#1C1917", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>{r.name}{(r.claimed || r.ownerClaimed) && <VerifiedStar size={12} />}</p>
                      <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "#8A7A68", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.addr}</p>
                    </div>
                    <span style={{ fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 700, flexShrink: 0, color: st === "approved" ? "var(--c-ok-ink)" : st === "pending" ? "var(--c-warn-ink)" : "#FF6600" }}>
                      {st === "approved" ? "Sahiplenilmiş" : st === "pending" ? "Beklemede" : "Sahiplen"}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#FFF8F4", border: "1px solid rgba(255,102,0,0.16)", borderRadius: 16, padding: "11px 13px", marginBottom: 18 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", flexShrink: 0, position: "relative" }}>
                  <Img src={picked.imgs[0]} style={{ position: "absolute", inset: 0 }} bg="#e8e0d8" box={42} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 13.5, fontWeight: 700, color: "#1C1917", margin: 0 }}>{picked.name}</p>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "#8A7A68", margin: 0 }}>{picked.addr}</p>
                </div>
                <Btn text="Değiştir" onClick={() => setPicked(null)} variant="plainDark" size="sm" fullWidth={false} />
              </div>

              <InputField label="Ticaret unvanı" value={form.legalName} onChange={set("legalName")} placeholder="ör: Çiya Gıda San. Tic. Ltd. Şti." />
              <InputField label="Vergi numarası" value={form.taxId} onChange={set("taxId")} placeholder="10 haneli" />
              <InputField label="Yetkili adı" value={form.contactName} onChange={set("contactName")} placeholder="Ad Soyad" />
              <InputField label="Telefon" value={form.phone} onChange={set("phone")} placeholder="0216 000 00 00" />
              <InputField label="E-posta" value={form.email} onChange={set("email")} placeholder="isletme@mail.com" />

              <div style={{ background: "#FBFAF8", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "#8A7A68", lineHeight: 1.55, margin: 0 }}>
                  Başvurun yönetici onayına düşer. Onaylanınca panelde menü, fotoğraf ve bilgileri
                  düzenleyebilirsin; doldurmadığın alanlar harita servislerinden gelmeye devam eder.
                </p>
              </div>

              {error && (
                <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "var(--c-bad-ink)", margin: "0 0 12px" }}>{error}</p>
              )}
              <Btn text="Sahiplenme başvurusu gönder" onClick={submit} loading={busy} variant="filled" />
            </>
          )}
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
        <div style={{ height: "32%", background: "var(--c-warm-1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
<div style={{ marginBottom: 10 }}><Icon n="plate" color="#FF6600" size={22} /></div>
          <GurLogo size={60} pill />
          <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "var(--c-muted)", marginTop: 4, letterSpacing: 1.5 }}>DOYURUCU</p>
        </div>

        {/* Alt gradient */}
        <div className="gur-on-brand" style={{ flex: 1, background: GRAD, borderTopLeftRadius: 44, borderTopRightRadius: 44, padding: "28px 28px 40px", position: "relative" }}>
          <div style={{ position: "absolute", left: 14, top: 18 }}>
            <BackBtn onClick={onBack} />
          </div>

          <h2 style={{ fontFamily: "var(--f-body)", fontSize: 16, color: "var(--c-on-brand)", margin: "0 0 6px", textAlign: "center", textShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>Giriş Yap</h2>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "var(--c-on-brand-2)", textAlign: "center", margin: "0 0 30px" }}>
            İşletme hesabınızla giriş yapın
          </p>

          <InputField label="E-posta Adresi" value={email} onChange={setEmail} placeholder="restoran@mail.com" />
          <InputField label="Şifre" value={password} onChange={setPassword} placeholder="******" type="password" />

          <div style={{ marginTop: 8 }}>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "var(--c-on-brand-2)", textAlign: "right", margin: "0 0 20px", cursor: "pointer", textDecoration: "underline" }}>Şifremi unuttum</p>
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
      <h2 style={{ fontFamily: "var(--f-body)", fontSize: 16, fontWeight: 800, color: "#2D2419", margin: "0 0 6px", textAlign: "center" }}>{title}</h2>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "#8A7A68", textAlign: "center", marginBottom: 24 }}>{subtitle}</p>
    </>
  );
}

// ─── Info Card ───
function InfoCard({ icon, text }) {
  return (
    <div style={{ background: "#FFF3EA", borderRadius: 18, padding: "14px 16px", marginBottom: 22, display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 30, height: 30, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "#6B5D4C", margin: 0, lineHeight: 1.55 }}>{text}</p>
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
          <label style={{ display: "block", marginBottom: 7, fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 700, color: "#2D2419" }}>Lokasyon</label>
          <div style={{ position: "relative" }}>
            <input
              value={location} onChange={e => setLocation(e.target.value)}
              onFocus={e => { setLocFocused(true); keepVisible(e); }} onBlur={() => setTimeout(() => setLocFocused(false), 200)}
              placeholder="İlçe veya adres yazın..."
              style={{ width: "100%", padding: "15px 18px 15px 42px", borderRadius: 16, border: "none", outline: "none", fontSize: 16, fontFamily: "var(--f-body)", background: "#fff", color: "#2D2419", WebkitTextFillColor: "#2D2419", boxShadow: "var(--sh-1)", boxSizing: "border-box" }}
            />
            <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
          </div>
          {/* Öneri dropdown */}
          {locFocused && filteredLocs.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", borderRadius: 14, boxShadow: "var(--sh-2)", zIndex: 20, marginTop: 4, overflow: "hidden" }}>
              {filteredLocs.slice(0, 4).map((l, i) => (
                <div key={i} onMouseDown={() => { setLocation(l); setLocFocused(false); }}
                  style={{ padding: "12px 16px", cursor: "pointer", borderBottom: i < Math.min(filteredLocs.length, 4) - 1 ? "1px solid #f5f5f5" : "none", display: "flex", alignItems: "center", gap: 10, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FFF8F4"}
                  onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <span style={{ fontFamily: "var(--f-body)", fontSize: 14, color: "var(--c-warm-ink)" }}>{l}</span>
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
            <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(45,36,25,0.45)", textAlign: "center", marginTop: 10 }}>
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
          <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 700, color: "#6B5D4C", margin: "0 0 8px" }}>Yükleme İpuçları</p>
          {["Telefonunuzdan fotoğraf çekerek yükleyebilirsiniz", "PDF veya görsel formatları kabul edilir", "Belgenin tamamının görünür olduğundan emin olun"].map((tip, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 2 ? 5 : 0 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(45,36,25,0.3)", flexShrink: 0 }} />
              <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "#8A7A68", margin: 0 }}>{tip}</p>
            </div>
          ))}
        </div>

        <Btn text="Devam Et →" onClick={onNext} disabled={!canProceed} />
        {!canProceed && (
          <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(45,36,25,0.45)", textAlign: "center", marginTop: 10 }}>
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
            boxShadow: "var(--sh-2)",
          }}>
            <Icon n="check" color="var(--c-ok-ink)" size={32} strokeWidth={2.5} />
          </div>

          <h2 style={{
            fontFamily: "var(--f-body)", fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "#2D2419",
            textAlign: "center", margin: "0 0 10px",
            animation: "fadeInUp 0.5s ease-out 0.1s both",
          }}>Başvurunuz Alındı!</h2>

          <p style={{
            fontFamily: "var(--f-body)", fontSize: 15, color: "#6B5D4C",
            textAlign: "center", lineHeight: 1.6, margin: "0 0 24px",
            animation: "fadeInUp 0.5s ease-out 0.2s both",
          }}>
            Belgeleriniz incelemeye alınmıştır. Onay süreciniz tamamlandığında size bildirim gönderilecektir.
          </p>

          {/* Yükleme özeti */}
          <div style={{
            width: "100%", background: "#fff", borderRadius: 20,
            padding: "18px 18px 14px", marginBottom: 28, boxShadow: "var(--sh-1)",
            animation: "fadeInUp 0.5s ease-out 0.3s both",
          }}>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 700, color: "#8A7A68", margin: "0 0 12px" }}>Yükleme Özeti</p>
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
                <span style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "#4A3F33", flex: 1 }}>{item.text}</span>
                {item.done ? <Icon n="check" size={16} color="var(--c-ok-ink)" /> : <Icon n="clock" size={16} color="var(--c-warn)" />}
              </div>
            ))}
          </div>

          {/* Bilgi kartı */}
          <div style={{
            width: "100%", background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.25)",
            borderRadius: 16, padding: "14px 16px", marginBottom: 24, display: "flex", gap: 12,
            animation: "fadeInUp 0.5s ease-out 0.4s both",
          }}>
            <Icon n="clock" size={16} color="var(--c-ok-ink)" />
            <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "var(--c-ok-ink)", margin: 0, lineHeight: 1.5 }}>
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
          <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 700, color: "#6B5D4C", margin: "0 0 8px" }}>Fotoğraf Önerileri</p>
          {[
            "Mekan iç görünümü (ambiyans)",
            "Mekan dış cephesi (bulunabilirlik)",
            "En popüler 2-3 yemek fotoğrafı",
            "Menü görseli (okunabilir kalitede)",
          ].map((tip, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 3 ? 5 : 0 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(45,36,25,0.3)", flexShrink: 0 }} />
              <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "#8A7A68", margin: 0 }}>{tip}</p>
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
        border: `1.5px solid ${active ? "var(--c-ok)" : "rgba(255,255,255,0.14)"}`,
        background: active ? "rgba(34,197,94,0.14)" : "transparent",
        color: active ? "var(--c-ok-light)" : "rgba(255,255,255,0.6)",
        borderRadius: 11, padding: "7px 13px", cursor: "pointer", outline: "none",
        fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700,
      }}>{label}</motion.button>
  );
}

/**
 * PEK YAKINDA — satışa kapatılmış bir hizmetin yerinde duran şey.
 *
 * Kart KALDIRILMIYOR: işletmeye ürünün hiç var olmadığını söylemek yanlış
 * olurdu, yakında açılacak. Kapalı kart `opacity` ile de soluklaştırılmıyor
 * (projenin kendi kuralı) — fark renkle ve yazıyla.
 */
function ComingSoon({ compact = false }) {
  return (
    <div role="status" style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      background: "rgba(255,180,84,0.12)", border: "1px solid rgba(255,180,84,0.26)",
      borderRadius: 999, padding: compact ? "5px 11px" : "7px 14px",
    }}>
      <Icon n="clock" size={compact ? 12 : 13} color="var(--c-warn-light)" />
      <span style={{ fontFamily: "var(--f-body)", fontSize: compact ? 11.5 : 12.5,
        fontWeight: 800, color: "var(--c-warn-light)" }}>Pek yakında</span>
    </div>
  );
}

function GrowthSection({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.5)", margin: 0, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function LockedCard({ text }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 18, padding: "18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 11 }}>
      <Icon n="shield" size={16} color="rgba(255,255,255,0.3)" />
      <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "rgba(255,255,255,0.4)", margin: 0 }}>{text}</p>
    </div>
  );
}

/**
 * İkinci Şans paketi kartı.
 *
 * Diğer büyüme kartları "satın alındı" bayrağı tutuyor; bu gerçek bir
 * kota yürütüyor: 200 FARKLI kullanıcıya gösterim. İlerleme çubuğu
 * kullanıcıya kaç kişiye ulaştığını söylüyor — "satın aldın" demek tek
 * başına bir şey ifade etmiyordu.
 *
 * Aktif paket varken ikincisi alınamaz: aynı kullanıcıya iki kat gösterim
 * satın alınmasın diye (kural shared/second-chance.js içinde, düğme
 * yalnızca onu yansıtıyor).
 */
function SecondChanceCard({ restaurant }) {
  const state = secondChance.useSecondChance();
  const talepler = useRequests();
  // Kapı müşteri bazlı: aynı kalem platformda açık olup bu restorana
  // kapatılmış olabilir (bkz. lib/platform.js → servicesOffFor).
  const satista = useServiceOpen("secondChance", restaurant?.id);
  const talep = restaurant ? requestFor(restaurant.id, "secondChance", talepler) : null;
  if (!restaurant) return <LockedCard text="Önce bir işletme sahiplen." />;
  if (!satista) {
    return (
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 18, padding: "16px 18px", marginBottom: 12 }}>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>İkinci Şans paketi</p>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.5 }}>
          Sizi sola kaydırmış kullanıcıların destesine geri girersiniz.
        </p>
        <ComingSoon />
      </div>
    );
  }

  const aktif = secondChance.activeFor(restaurant.id, state);
  const oran = secondChance.progress(aktif);
  // Fiyat yöneticinin belirlediği LİSTE fiyatından; `PACKAGE.priceMinor`
  // paketin kota/süre kurallarıyla birlikte duran varsayılanı, pazarlığın
  // kendisi değil. İkisi ayrı yerdeydi ve panelde eski sayı yazıyordu.
  // Birim "/ paket": paket süreyle değil KOTAYLA bittiği için "/ hafta"
  // demek yanlıştı (bkz. shared/second-chance.js).
  const fiyat = `liste: ₺${pricing.listPriceOf("secondChance").toLocaleString("tr")} ${pricing.listUnitOf("secondChance")}`;

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${aktif ? "rgba(255,102,0,0.35)" : "rgba(255,255,255,0.06)"}`, borderRadius: 18, padding: "16px 18px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>
          İkinci Şans Paketi
        </p>
        <span style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, color: "var(--c-brand-light)", flexShrink: 0 }}>{fiyat}</span>
      </div>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.55 }}>
        Sizi <b>sola kaydırmış</b> {secondChance.PACKAGE.reach} farklı kullanıcının destesine geri
        eklenirsiniz. Aynı kişiye günde bir kez gösterilir; kota dolunca paket kapanır.
      </p>

      {aktif ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "rgba(255,255,255,0.55)" }}>
              {aktif.used} / {aktif.quota} kullanıcıya ulaşıldı
            </span>
            <span style={{ fontFamily: "var(--f-body)", fontSize: 11.5, fontWeight: 700, color: "var(--c-ok-light)" }}>
              %{Math.round(oran * 100)}
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.09)", overflow: "hidden", marginBottom: 12 }}>
            <div style={{ width: `${oran * 100}%`, height: "100%", background: "linear-gradient(90deg,#FF7A1A,#F04E00)", borderRadius: 4 }} />
          </div>
          <Btn text="Paketi durdur" variant="outlineDark" size="sm"
            onClick={() => secondChance.cancel(aktif.id)} />
        </>
      ) : (
        // Paket doğrudan başlatılamıyor: teklif istenir, yönetici
        // fiyatlandırır, kabul edilince başlar (bkz. requests.js).
        talep ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Icon n="clock" size={14} color="var(--c-warn-light)" />
            <span style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, color: "var(--c-warn-light)" }}>
              {talep.status === "quoted" ? "Fiyatlandırılıyor" : "Teklif istendi"}
            </span>
            <Btn text="Vazgeç" onClick={() => withdraw(talep.id)} variant="plainDark" size="sm" fullWidth={false} />
          </div>
        ) : (
          <Btn text="Teklif iste" variant="filled" size="md"
            onClick={() => { requestQuote({ restaurantId: restaurant.id, restaurantName: restaurant.name, streamKey: "secondChance", streamName: "İkinci Şans paketi" }); haptic(14); }} />
        )
      )}
    </div>
  );
}

/**
 * Büyüme kartı.
 *
 * SATIN ALMA DÜĞMESİ YOK. İşletme kendi kendine hiçbir hizmeti açamıyor;
 * yalnızca **teklif isteyebiliyor**. Talep yöneticiye düşer, fiyatı o
 * belirler ve teklif gönderir; işletme kabul ederse hizmet açılır.
 *
 * Fiyat "liste fiyatı" olarak yazılıyor ve bunu söylüyor: gerçek tutar
 * tekliften gelir. Eskiden yazan rakam bağlayıcıymış gibi duruyordu.
 *
 * `gold` Gastro paketi için: satın alınan değil, seçilerek verilen bir
 * paket olduğu için ayrı bir görsel dil taşıyor (bkz. GoldCard).
 */
/**
 * SABİT FİYATLI REKLAM — takvimden tarih seçip talep gönderme.
 *
 * Banner, ödüllü video ve push pazarlığa açık değil: fiyat listede yazıyor.
 * Ama satın alma serbest DEĞİL — işletme müsait tarihi seçiyor, talep
 * yöneticiye düşüyor, onaylanınca slot kilitleniyor.
 *
 * Takvim doluluğu ve kota kuralı ARAYÜZDE hesaplanmıyor: `canBook` tek
 * karar noktası (lib/adslots.js). Burada tekrarlansaydı panel "alabilirsin"
 * derken yönetici tarafı reddedebilirdi.
 */
/**
 * REKLAM GÖRSELİ — tarih onayına BAĞLI yükleme alanı.
 *
 * Akış tek yönlü ve her adımı ekranda yazılı:
 *
 *   1. takvimden tarih seç        → yayın talebi (pending)
 *   2. yönetici tarihi onaylar    → slot kilitlenir, YÜKLEME ALANI AÇILIR
 *   3. görseli yükle              → dosya onay kuyruğuna düşer (pending)
 *   4. yönetici görseli onaylar   → yayına girer
 *
 * Yükleme alanı önceden HER ZAMAN açıktı. Tarihi olmayan bir işletme
 * dosya yükleyebiliyor, dosya onay kuyruğuna düşüyor ve yönetici
 * yayınlanacak yeri olmayan bir görseli onaylıyordu. Kapı burada: teslim
 * edilecek bir yer yoksa dosya istemiyoruz.
 *
 * Geçmiş rezervasyonlar kapıyı açmıyor (`slotsOf` → `end >= bugün`):
 * geçen ayki bir yayın, hiçbir yere gitmeyecek dosyalar toplardı.
 */
function AdCreativeSlot({ kind, restaurant }) {
  const slotDurum = useAdSlots();
  const medyaDurum = useMedia();
  const tanim = MEDIA_KINDS[kind];
  const { approved, pending } = restaurant
    ? slotsOf(restaurant.id, kind, slotDurum)
    : { approved: [], pending: [] };
  const acik = approved.length > 0;
  const dosyalar = restaurant ? listMedia(restaurant.id, kind, medyaDurum) : [];
  const yayinda = dosyalar.some(f => f.status === "approved");
  const incelemede = dosyalar.some(f => f.status === "pending");

  // Adım göstergesi: hangi aşamada olduğun tek bakışta görünsün.
  const adim = !acik ? (pending.length ? 1 : 0) : yayinda ? 3 : incelemede ? 2 : 2;
  const durumMetni = !acik
    ? (pending.length
        ? `Tarih onayı bekleniyor · ${prettyDay(pending[0].start)} – ${prettyDay(pending[0].end)}`
        : "Henüz yayın tarihi yok")
    : yayinda
      ? `Yayında · ${prettyDay(approved[0].start)} – ${prettyDay(approved[0].end)}`
      : incelemede
        ? "Görsel onayda — GUR ekibi inceliyor"
        : `${prettyDay(approved[0].start)} – ${prettyDay(approved[0].end)} için dosyanızı yükleyin`;
  const durumRenk = yayinda ? "var(--c-ok-light)" : acik ? "var(--c-brand-light)" : "var(--c-warn-light)";

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 800, color: "#fff" }}>
          {tanim.label}
        </span>
        {/* Nereye çıkacağı ve hangi tür dosya istendiği başlığın yanında:
            "reklam materyali" tek başına hangi ekranı kastettiğini
            söylemiyordu. */}
        <span style={{ fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 700,
          color: "var(--c-brand-light)", background: "rgba(255,102,0,0.14)",
          border: "1px solid rgba(255,102,0,0.26)", borderRadius: 999, padding: "2px 9px" }}>
          {tanim.accept.startsWith("video") ? "video" : "görsel"}
        </span>
      </div>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "rgba(255,255,255,0.45)", margin: "0 0 10px", lineHeight: 1.5 }}>
        {tanim.slot}
      </p>

      {/* Dört adım, hangisinde olduğun dolu noktayla. Renk tek başına bilgi
          taşımıyor: altında cümlesi yazılı. */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {["Tarih", "Onay", "Görsel", "Yayın"].map((etiket, i) => (
          <div key={etiket} style={{ display: "flex", alignItems: "center", gap: 6, flex: i < 3 ? 1 : "0 0 auto" }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: i <= adim ? durumRenk : "rgba(255,255,255,0.18)",
            }} />
            <span style={{ fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 700,
              color: i <= adim ? durumRenk : "rgba(255,255,255,0.32)" }}>{etiket}</span>
            {i < 3 && <span style={{ flex: 1, height: 1, background: i < adim ? durumRenk : "rgba(255,255,255,0.12)" }} />}
          </div>
        ))}
      </div>
      <p role="status" style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 700,
        color: durumRenk, margin: "0 0 10px" }}>{durumMetni}</p>

      {acik ? (
        <MediaManager restaurant={restaurant} kind={kind} />
      ) : (
        /* KAPALI. Kutuyu çizip devre dışı bırakmak yerine ne yapılması
           gerektiğini yazıyoruz: tıklanamayan bir yükleme kutusu, sebebini
           söylemeyen bir engeldir. */
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.14)",
          borderRadius: 18, padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 11,
        }}>
          <Icon n="clock" size={15} color="var(--c-warn-light)" />
          <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.55 }}>
            {pending.length
              ? "Tarih talebiniz yöneticide. Onaylandığı anda yükleme alanı burada açılacak."
              : <>Önce yukarıdaki <b style={{ color: "#fff" }}>{AD_PRODUCTS[kind]?.name || tanim.label}</b> kartından
                takvimi açıp tarih seçin. Tarih onaylandıktan sonra dosyanızı buradan gönderirsiniz.</>}
          </p>
        </div>
      )}
    </div>
  );
}

function SlotBooking({ streamKey, restaurant }) {
  const durum = useAdSlots();
  const p = AD_PRODUCTS[streamKey];
  const [acik, setAcik] = useState(false);
  const [ay, setAy] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [secili, setSecili] = useState(null);
  const [gun, setGun] = useState(1);          // kaç gün — 1..maxDays
  const [hata, setHata] = useState("");

  if (!p || !restaurant) return null;

  const fiyat = priceOf(streamKey, durum);
  const kendi = bookingsOfRestaurant(restaurant.id, durum)
    .filter(b => b.streamKey === streamKey && b.status !== "cancelled" && b.status !== "rejected");
  const bekleyen = kendi.find(b => b.status === "pending");
  const onayli = kendi.filter(b => b.status === "approved");

  const hucreler = monthGrid(ay.y, ay.m);
  const bugun = today();

  const gonder = () => {
    try {
      requestBooking({
        streamKey, restaurantId: restaurant.id, restaurantName: restaurant.name,
        start: secili, days: gun,
      });
      setSecili(null); setGun(1); setAcik(false); setHata("");
      haptic(14);
    } catch (e) { setHata(e.message || "Talep gönderilemedi."); }
  };

  const kontrol = secili ? canBook(streamKey, restaurant.id, secili, gun, durum) : null;
  const toplam = fiyat * gun;

  return (
    <div>
      {/* Kural her zaman görünür: "neden alamıyorum" sorusu sorulmadan cevaplanır. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <Icon n="clock" size={13} color="rgba(255,255,255,0.35)" />
        <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.45 }}>{p.rule}</p>
      </div>

      {onayli.map(b => (
        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <Icon n="check" size={14} color="var(--c-ok-light)" />
          <span style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, color: "var(--c-ok-light)" }}>
            {prettyDay(b.start)}{b.end !== b.start ? ` – ${prettyDay(b.end)}` : ""} · {(b.days ?? gunFarki(b.start, b.end) + 1)} gün · yayında
          </span>
        </div>
      ))}

      {bekleyen ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Icon n="clock" size={14} color="var(--c-warn-light)" />
          <span style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, color: "var(--c-warn-light)" }}>
            {prettyDay(bekleyen.start)}{bekleyen.end !== bekleyen.start ? ` – ${prettyDay(bekleyen.end)}` : ""} · {(bekleyen.days ?? gunFarki(bekleyen.start, bekleyen.end) + 1)} gün · onay bekliyor
          </span>
          <Btn text="Vazgeç" onClick={() => cancelBooking(bekleyen.id)} variant="plainDark" size="sm" fullWidth={false} />
        </div>
      ) : !acik ? (
        <Btn text="Tarih seç" onClick={() => { setAcik(true); setHata(""); }}
          variant="filled" size="sm" fullWidth={false} />
      ) : (
        <div style={{ background: "rgba(0,0,0,0.22)", borderRadius: 14, padding: 12 }}>
          {/* Ay gezinmesi */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <IconBtn size={28} shape="rounded" tone="glassLight" title="Önceki ay"
              onClick={() => setAy(a => a.m === 0 ? { y: a.y - 1, m: 11 } : { y: a.y, m: a.m - 1 })}
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>} />
            <span style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 800, color: "#fff" }}>
              {AY_ADLARI[ay.m]} {ay.y}
            </span>
            <IconBtn size={28} shape="rounded" tone="glassLight" title="Sonraki ay"
              onClick={() => setAy(a => a.m === 11 ? { y: a.y + 1, m: 0 } : { y: a.y, m: a.m + 1 })}
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
            {WEEKDAYS_TR.map(g => (
              <div key={g} style={{ textAlign: "center", fontFamily: "var(--f-body)", fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>{g}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {hucreler.map((gunISO, i) => {
              if (!gunISO) return <div key={`b${i}`} />;
              const d = dayState(streamKey, gunISO, durum);
              const gecmis = gunISO < bugun;
              const secim = gunISO === secili;
              // Seçilen aralığın tamamı vurgulanıyor: kullanıcı yalnız
              // başlangıcı seçiyor ama kaç gün tutacağını görmeli.
              const aralikta = secili && gunISO >= secili && gunISO <= endOf(streamKey, secili, gun);
              const kapali = gecmis || (p.exclusive && d.status !== "free");
              return (
                <button key={gunISO} type="button" disabled={kapali}
                  onClick={() => { setSecili(gunISO); setHata(""); }}
                  title={kapali ? (gecmis ? "Geçmiş tarih" : "Dolu") : gunISO}
                  style={{
                    aspectRatio: "1", borderRadius: 8, border: secim ? "2px solid #FF6600" : "1px solid rgba(255,255,255,0.08)",
                    background: aralikta ? "rgba(255,102,0,0.35)"
                      : d.status === "approved" ? "rgba(255,122,112,0.22)"
                      : d.status === "pending" ? "rgba(255,180,84,0.18)"
                      : "rgba(255,255,255,0.04)",
                    color: kapali ? "rgba(255,255,255,0.25)" : "#fff",
                    fontFamily: "var(--f-body)", fontSize: 11, fontWeight: 700,
                    cursor: kapali ? "not-allowed" : "pointer", padding: 0, outline: "none",
                  }}>{Number(gunISO.slice(-2))}</button>
              );
            })}
          </div>

          {/* Renk tek başına bilgi taşımasın: gösterge yazılı. */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 9 }}>
            {[["rgba(255,255,255,0.04)", "müsait"], ["rgba(255,180,84,0.18)", "tutuluyor"], ["rgba(255,122,112,0.22)", "dolu"]].map(([c, t]) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
                <span style={{ fontFamily: "var(--f-body)", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t}</span>
              </span>
            ))}
          </div>

          {secili && (
            <div style={{ marginTop: 11, paddingTop: 11, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Gün sayısı: fiyat günlük, süreyi işletme seçiyor. Kurala
                  takılan gün sayısı pasif çizilmiyor — basılınca SEBEBİ
                  yazılıyor. Sessizce tıklanamayan bir düğme "bozuk" diye
                  okunuyordu. */}
              <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 7px" }}>
                Kaç gün? (en fazla {p.maxDays})
              </p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                {Array.from({ length: p.maxDays }, (_, k) => k + 1).map(n => {
                  const secimi = n === gun;
                  return (
                    <button key={n} type="button" onClick={() => { setGun(n); setHata(""); }}
                      style={{
                        minWidth: 34, height: 32, borderRadius: 9, cursor: "pointer", outline: "none",
                        border: secimi ? "2px solid #FF6600" : "1px solid rgba(255,255,255,0.12)",
                        background: secimi ? "rgba(255,102,0,0.22)" : "rgba(255,255,255,0.04)",
                        color: "#fff", fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700,
                      }}>{n}</button>
                  );
                })}
              </div>
              <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.65)", margin: "0 0 4px" }}>
                {prettyDay(secili)}{gun > 1 ? ` – ${prettyDay(endOf(streamKey, secili, gun))}` : ""}
              </p>
              <p style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 800, color: "#FF9A4D", margin: "0 0 10px" }}>
                ₺{fiyat.toLocaleString("tr")} × {gun} gün = ₺{toplam.toLocaleString("tr")}
              </p>
              {kontrol && !kontrol.ok && (
                <p role="status" style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "var(--c-bad-light)", margin: "0 0 10px", lineHeight: 1.45 }}>{kontrol.reason}</p>
              )}
              <Btn text="Talep gönder" onClick={gonder} variant="filled" size="sm" fullWidth={false}
                disabled={!kontrol?.ok} />
            </div>
          )}

          {hata && (
            <p role="status" style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "var(--c-bad-light)", margin: "9px 0 0" }}>{hata}</p>
          )}

          <div style={{ marginTop: 10 }}>
            <Btn text="Kapat" onClick={() => { setAcik(false); setSecili(null); setGun(1); }} variant="plainDark" size="sm" fullWidth={false} />
          </div>
        </div>
      )}
    </div>
  );
}

function GrowthCard({ title, price, desc, active, locked, streamKey, streamName, restaurant, gold }) {
  // Sabit fiyatlı üç reklam kalemi (banner / ödüllü video / push) teklif
  // akışından çıktı: fiyat listede yazıyor, takvimden tarih seçiliyor.
  // Geri kalanlar (Gastro, İkinci Şans, anlık fırsat) hâlâ pazarlıklı.
  const sabit = isFixedPrice(streamKey);
  // Satışa kapalıysa kart duruyor ama yerinde "Pek yakında" yazıyor.
  // Kapı hem platform hem MÜŞTERİ bazlı: yönetici tek bir restorana da
  // kapatabiliyor ve o zaman yalnızca onun panelinde "Pek yakında" çıkıyor.
  const satista = useServiceOpen(streamKey, restaurant?.id);
  const slotDurum = useAdSlots();
  const talepler = useRequests();
  const talep = restaurant && streamKey
    ? requestFor(restaurant.id, streamKey, talepler) : null;
  const teklifler = pricing.usePricing();
  const gelen = restaurant && streamKey
    ? teklifler.offers.find(o => String(o.restaurantId) === String(restaurant.id)
        && o.streamKey === streamKey && o.status === "pending")
    : null;

  const iste = () => {
    if (!restaurant) return;
    requestQuote({
      restaurantId: restaurant.id, restaurantName: restaurant.name,
      streamKey, streamName: streamName || title,
    });
    haptic(14);
  };

  return (
    <div style={{
      background: gold
        ? "linear-gradient(140deg, rgba(212,175,55,0.16), rgba(120,86,12,0.10))"
        : active ? "rgba(255,102,0,0.07)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${gold ? "rgba(233,196,86,0.42)" : active ? "rgba(255,102,0,0.28)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 18, padding: "16px 18px", marginBottom: 12,
      position: "relative", overflow: "hidden",
    }}>
      {gold && <span className="gur-gold-sheen" aria-hidden="true" />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: gold ? "#F6E6A8" : "#fff", margin: 0 }}>{title}</p>
        <span style={{ fontFamily: "var(--f-body)", fontSize: 11.5, fontWeight: 700, color: gold ? "#E9C456" : "#FF9A4D", flexShrink: 0 }}>
          {!satista ? "" : sabit
            ? `₺${priceOf(streamKey, slotDurum).toLocaleString("tr")} / gün`
            : pricing.isNegotiated(streamKey)
              ? `liste: ₺${pricing.listPriceOf(streamKey, teklifler).toLocaleString("tr")} ${pricing.listUnitOf(streamKey)}`
              : price}
        </span>
      </div>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 12px", lineHeight: 1.5 }}>{desc}</p>
      {/* Hizmetin tanıtımı — yönetici yüklüyor (lib/creatives.js). Fiyatın
          yanında duruyor: "banner nedir" sorusunun cevabı teklif
          istenmeden önce, ayrı bir ekranda değil burada olmalı. */}
      <ServicePromo streamKey={streamKey} />
      {locked || !satista ? (
        <ComingSoon />
      ) : sabit ? (
        <SlotBooking streamKey={streamKey} restaurant={restaurant} />
      ) : active ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon n="check" size={14} color="var(--c-ok-light)" />
          <span style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, color: "var(--c-ok-light)" }}>Aktif</span>
        </div>
      ) : gelen ? (
        // Teklif geldi: düğme burada değil, "Teklifler" sekmesinde karar
        // veriliyor. Aynı kararı iki yerden vermek kafa karıştırır.
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon n="sparkle" size={14} color="var(--c-brand-light)" />
          <span style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, color: "var(--c-brand-light)" }}>
            Teklif geldi — Teklifler sekmesine bak
          </span>
        </div>
      ) : talep ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Icon n="clock" size={14} color="var(--c-warn-light)" />
          <span style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, color: "var(--c-warn-light)" }}>
            {talep.status === "quoted" ? "Fiyatlandırılıyor" : "Teklif istendi"}
          </span>
          <Btn text="Vazgeç" onClick={() => withdraw(talep.id)} variant="plainDark" size="sm" fullWidth={false} />
        </div>
      ) : (
        <Btn text="Teklif iste" onClick={iste}
          variant={gold ? "outlineDark" : "filled"} size="sm" fullWidth={false} />
      )}
    </div>
  );
}

/**
 * DURUM ROZETİ — bir dosyanın onay hâli.
 *
 * Renk tek başına bilgi taşımıyor: yanında her zaman yazı var. Reddedilen
 * dosyada sebep de yazılı — "reddedildi" deyip sebebi söylememek işletmeyi
 * aynı dosyayı ikinci kez yüklemeye iter.
 */
function MediaStatus({ file }) {
  const map = {
    pending:  { text: "İncelemede", renk: "var(--c-warn-light)", zemin: "rgba(255,180,84,0.14)" },
    approved: { text: "Yayında",    renk: "var(--c-ok-light)",   zemin: "rgba(74,222,128,0.14)" },
    rejected: { text: "Reddedildi", renk: "var(--c-bad-light)",  zemin: "rgba(255,122,112,0.14)" },
  };
  const d = map[file.status] || map.pending;
  return (
    <span style={{
      fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 800, color: d.renk,
      background: d.zemin, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap",
    }}>{d.text}</span>
  );
}

/**
 * ONAY KUYRUKLU YÜKLEME — menü, fotoğraf ve reklam materyali için tek bileşen.
 *
 * Üç sekmede üç ayrı kopya vardı; menüde silme düğmesi, fotoğrafta grid,
 * reklamda hiçbiri. Aynı işi yapan üç kod üç ayrı davranış demekti.
 *
 * Yüklenen dosya DOĞRUDAN YAYINA GİRMİYOR: `addMedia` kaydı `pending`
 * doğuruyor ve tüketici yalnızca onaylananı görüyor. Ekran bunu saklamıyor,
 * yükleme kutusunun altında yazıyor — "yükledim, neden görünmüyor" sorusu
 * sorulmadan cevaplanmış oluyor.
 */
function MediaManager({ restaurant, kind, grid = false }) {
  const durum = useMedia();
  const k = MEDIA_KINDS[kind];
  const girdi = useRef(null);
  const [hata, setHata] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const dosyalar = restaurant ? listMedia(restaurant.id, kind, durum) : [];

  const sec = async (e) => {
    const secilen = Array.from(e.target.files || []);
    e.target.value = "";
    if (!secilen.length || !restaurant) return;
    setMesgul(true); setHata("");
    try {
      // Sırayla: hepsini aynı anda yazmak son yazanın kazandığı bir
      // yarış kuruyordu (her biri aynı anlık görüntüden okuyor).
      for (const f of secilen) await addMedia(restaurant.id, kind, f);
    } catch (err) {
      setHata(err?.message || "Dosya yüklenemedi.");
    } finally { setMesgul(false); }
  };

  if (!restaurant) return null;

  return (
    <div>
      {dosyalar.length > 0 && (grid ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {dosyalar.map(f => (
            <div key={f.id} style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "1" }}>
              <img src={f.url} alt={f.name} loading="lazy" decoding="async"
                style={{ width: "100%", height: "100%", objectFit: "cover",
                  // Onaylanmamış dosya soluk DEĞİL, üstünde rozet var:
                  // soluklaştırma hem okunmuyor hem "bozuk" gibi duruyordu.
                  filter: f.status === "rejected" ? "grayscale(1)" : "none" }} />
              <div style={{ position: "absolute", left: 4, bottom: 4 }}><MediaStatus file={f} /></div>
              <div style={{ position: "absolute", top: 4, right: 4 }}>
                <IconBtn onClick={() => removeMedia(restaurant.id, kind, f.id)}
                  tone="glassDark" shape="rounded" size={26} title="Kaldır"
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {dosyalar.map(f => (
            <div key={f.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              {mediaIsVideo(f) ? (
                <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(255,102,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF6600" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                </div>
              ) : (
                <img src={f.url} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 600, color: "#fff", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <MediaStatus file={f} />
                  <span style={{ fontFamily: "var(--f-body)", fontSize: 10.5, color: "rgba(255,255,255,0.3)" }}>{mediaSize(f.sizeMB)}</span>
                </div>
                {f.status === "rejected" && f.reason && (
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "var(--c-bad-light)", margin: "5px 0 0", lineHeight: 1.4 }}>{f.reason}</p>
                )}
              </div>
              <IconBtn onClick={() => removeMedia(restaurant.id, kind, f.id)}
                tone="dangerSoft" shape="rounded" size={32} title="Kaldır"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--c-bad-light)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
            </div>
          ))}
        </div>
      ))}

      <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "26px 16px", borderRadius: 20, border: "2px dashed rgba(255,102,0,0.25)", background: "rgba(255,102,0,0.04)", cursor: mesgul ? "progress" : "pointer" }}>
        <input ref={girdi} type="file" accept={k.accept} multiple disabled={mesgul}
          style={{ display: "none" }} onChange={sec} />
        <div style={{ width: 46, height: 46, borderRadius: 16, background: "rgba(255,102,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
        </div>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 600, color: "var(--c-brand-ink)", margin: 0 }}>
          {mesgul ? "Yükleniyor…" : `${k.tekil} yükle`}
        </p>
        <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0, textAlign: "center", lineHeight: 1.45 }}>
          {k.hint} · en fazla {k.maxMB} MB
        </p>
      </label>

      {hata && (
        <div role="status" style={{ background: "rgba(255,122,112,0.12)", border: "1px solid rgba(255,122,112,0.24)", borderRadius: 14, padding: "10px 14px", marginTop: 12 }}>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "var(--c-bad-light)", margin: 0 }}>{hata}</p>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, padding: "11px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)" }}>
        <Icon n="shield" size={14} color="rgba(255,255,255,0.4)" />
        <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.5 }}>
          Yüklediğiniz dosya <b>GUR ekibinin onayından sonra</b> yayına girer.
          Onaylanana kadar yalnızca siz görürsünüz.
        </p>
      </div>
    </div>
  );
}

/**
 * ONAY DURUMU ŞERİDİ — "neyim onayda".
 *
 * Sekmelerin ÜSTÜNDE ve her sekmede görünüyor: bekleyen bir menü onayını
 * görmek için Menü sekmesine girmek gerekseydi işletme onu ancak
 * aramaya giderse bulurdu.
 *
 * Hiç dosya yoksa hiç çizilmiyor — boş bir "0 bekliyor" satırı yer
 * kaplamaktan başka bir şey yapmaz.
 */
function ApprovalStatus({ restaurant, onGo }) {
  const durum = useMedia();
  if (!restaurant) return null;
  const ozet = statusSummary(restaurant.id, durum);
  if (!ozet.length) return null;

  const sekme = { menu: "menu", photos: "photos", ads: "growth" };

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "14px 16px", marginBottom: 16 }}>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.5)", margin: "0 0 10px", letterSpacing: 0.2 }}>ONAY DURUMU</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ozet.map(x => (
          <button key={x.kind} type="button" onClick={() => onGo?.(sekme[x.kind])}
            style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap",
              background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" }}>
            <span style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, color: "#fff", minWidth: 96 }}>{x.label}</span>
            {/* Renk tek başına bilgi taşımasın: sayıların yanında ne olduğu da yazılı. */}
            {x.pending > 0 && (
              <span style={{ fontFamily: "var(--f-body)", fontSize: 11, fontWeight: 700, color: "var(--c-warn-light)", background: "rgba(255,180,84,0.14)", borderRadius: 999, padding: "2px 9px" }}>{x.pending} onay bekliyor</span>
            )}
            {x.approved > 0 && (
              <span style={{ fontFamily: "var(--f-body)", fontSize: 11, fontWeight: 700, color: "var(--c-ok-light)", background: "rgba(74,222,128,0.14)", borderRadius: 999, padding: "2px 9px" }}>{x.approved} yayında</span>
            )}
            {x.rejected > 0 && (
              <span style={{ fontFamily: "var(--f-body)", fontSize: 11, fontWeight: 700, color: "var(--c-bad-light)", background: "rgba(255,122,112,0.14)", borderRadius: 999, padding: "2px 9px" }}>{x.rejected} reddedildi</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * HİZMET TANITIMI — yöneticinin yüklediği örnek görsel / video.
 *
 * Kartın içinde duruyor: "banner nedir" sorusunun cevabı fiyatın yanında
 * olmalı, ayrı bir ekranda değil. Tanıtım yoksa hiç yer kaplamıyor.
 *
 * Video `controls` ile geliyor ama `autoPlay` YOK: izinsiz oynayan bir
 * video paneli gezerken şaşırtıyor ve sessiz moddaki telefonu yok sayar.
 */
function ServicePromo({ streamKey }) {
  const durum = useCreatives();
  const promo = streamKey ? promoFor(streamKey, durum) : null;
  if (!promo) return null;
  return (
    <div style={{ marginBottom: 12, borderRadius: 14, overflow: "hidden", background: "rgba(0,0,0,0.25)" }}>
      {promoIsVideo(promo)
        ? <video src={promo.url} controls playsInline preload="metadata"
            style={{ width: "100%", maxHeight: 190, display: "block", background: "#000" }} />
        : <img src={promo.url} alt={`${promo.name} — hizmet tanıtımı`} loading="lazy" decoding="async"
            style={{ width: "100%", maxHeight: 190, objectFit: "cover", display: "block" }} />}
    </div>
  );
}

// İşletmenin masa talebi kuyruğu. Sunucuda bunun karşılığı reservations
// tablosu ve bildirim kuyruğudur; burada ortak depo (src/lib/reservations.js)
// üzerinden çalışıyor.
// İşletmenin kendi logosu. Yüklenen görsel küçültülüp data URL olarak
// ortak depoya yazılıyor (src/lib/b2b.js → saveOwnerLogo), böylece aynı
// logo yönetici panelinde ve tüketici tarafındaki kayıtta da görünüyor.
function LogoUpload({ restaurant, size = 56 }) {
  const profiles = useOwnerProfiles();
  const logo = restaurant ? ownerLogo(restaurant.id, profiles) : null;
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pick = () => { if (restaurant) ref.current?.click(); };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !restaurant) return;
    setBusy(true); setError(null);
    try {
      const dataUrl = await fileToSquareDataUrl(file, 256);
      saveOwnerLogo(restaurant.id, dataUrl);
    } catch (err) {
      setError(err.message || "Logo yüklenemedi");
      setTimeout(() => setError(null), 2600);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <input ref={ref} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      <button
        type="button" className="gur-btn" onClick={pick} disabled={busy}
        title={logo ? "Logoyu değiştir" : "Logo yükle"} aria-label={logo ? "Logoyu değiştir" : "Logo yükle"}
        style={{
          "--btn-bg": "rgba(255,255,255,0.15)",
          "--btn-bg-hover": "rgba(255,255,255,0.26)",
          "--btn-bg-press": "rgba(255,255,255,0.1)",
          width: size, height: size, borderRadius: 18, padding: 0, overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.3)", outline: "none",
          display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
        }}>
        {busy
          ? <Spinner size={18} color="#fff" />
          : logo
            ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Icon n="plate" color="#fff" size={22} />}
        {/* Yükleme rozeti: kutunun tıklanabilir olduğu görünsün */}
        <span style={{
          position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: "50%",
          background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "var(--sh-1)",
        }}>
          <Icon n="camera" size={11} color="#FF6600" />
        </span>
      </button>
      {logo && (
        <button type="button" className="gur-btn" onClick={() => clearOwnerLogo(restaurant.id)}
          title="Logoyu kaldır" aria-label="Logoyu kaldır"
          style={{
            "--btn-bg": "rgba(0,0,0,0.45)", "--btn-bg-hover": "rgba(0,0,0,0.6)", "--btn-bg-press": "rgba(0,0,0,0.7)",
            position: "absolute", left: -6, top: -6, width: 20, height: 20, borderRadius: "50%",
            border: "none", padding: 0, outline: "none", color: "#fff", fontSize: 11, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
      )}
      {error && (
        <p style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, fontFamily: "var(--f-body)", fontSize: 10.5, color: "#fff", background: "rgba(255,59,48,0.9)", borderRadius: 8, padding: "3px 8px", whiteSpace: "nowrap" }}>{error}</p>
      )}
    </div>
  );
}

// ─── ETKİLEŞİM ISI HARİTASI ──────────────────────────────────────────
//
// Isı haritası (heat map) bir araştırma yöntemidir: ilginin nereye
// yığıldığını sayı olarak değil renk olarak gösterir, böylece desen tek
// bakışta okunur. Burada gün × saat: işletme hangi saatlerde keşfedildiğini
// görüp anlık fırsatını ölü saate koyabilir.
//
// Sunucudaki karşılığı analytics_events tablosunun saat kırılımıdır; demo
// modda restoran kimliğinden deterministik üretiliyor ki panel gezinirken
// sayılar zıplamasın.
const HEAT_DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const HEAT_SLOTS = [
  { label: "09-12", peak: 0.25 },
  { label: "12-15", peak: 0.85 },
  { label: "15-18", peak: 0.45 },
  { label: "18-21", peak: 1.00 },
  { label: "21-24", peak: 0.60 },
];

function InteractionHeatmap({ restaurant }) {
  const grid = useMemo(() => {
    let a = ((Number(String(restaurant?.id).replace(/\D/g, "")) || 7) * 2654435761) >>> 0;
    const rnd = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return HEAT_SLOTS.map(slot => HEAT_DAYS.map((d, di) => {
      const weekend = di >= 4 ? 1.25 : 1;               // Cuma-Pazar daha yoğun
      const v = slot.peak * weekend * (0.7 + rnd() * 0.6);
      return Math.min(1, v);
    }));
  }, [restaurant?.id]);

  const best = useMemo(() => {
    let top = { v: -1 };
    grid.forEach((row, si) => row.forEach((v, di) => { if (v > top.v) top = { v, si, di }; }));
    return top;
  }, [grid]);
  const worst = useMemo(() => {
    let low = { v: 2 };
    grid.forEach((row, si) => row.forEach((v, di) => { if (v < low.v) low = { v, si, di }; }));
    return low;
  }, [grid]);

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 16px", marginBottom: 20 }}>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>Ne zaman keşfediliyorsunuz?</p>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "rgba(255,255,255,0.4)", margin: "0 0 14px", lineHeight: 1.5 }}>
        Son 30 günde kartınızın görüldüğü saatler. Koyu turuncu = yoğun.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "46px repeat(7, 1fr)", gap: 4 }}>
        <span />
        {HEAT_DAYS.map(d => (
          <span key={d} style={{ fontFamily: "var(--f-body)", fontSize: 9.5, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>{d}</span>
        ))}
        {HEAT_SLOTS.map((slot, si) => (
          <React.Fragment key={slot.label}>
            <span style={{ fontFamily: "var(--f-body)", fontSize: 9.5, color: "rgba(255,255,255,0.35)", alignSelf: "center" }}>{slot.label}</span>
            {HEAT_DAYS.map((d, di) => {
              const v = grid[si][di];
              return (
                <div key={d}
                  title={`${d} ${slot.label} · yoğunluk %${Math.round(v * 100)}`}
                  aria-label={`${d} ${slot.label} yoğunluk yüzde ${Math.round(v * 100)}`}
                  style={{
                    height: 26, borderRadius: 7,
                    // Renk tek başına bilgi taşımasın diye kutunun içinde
                    // yüzde de yazıyor: renk körlüğünde de okunur kalsın.
                    background: `rgba(255,102,0,${(0.10 + v * 0.75).toFixed(2)})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--f-body)", fontSize: 9, fontWeight: 700,
                    color: v > 0.55 ? "#fff" : "rgba(255,255,255,0.45)",
                  }}>
                  {Math.round(v * 100)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--f-body)", fontSize: 11, fontWeight: 700, color: "var(--c-ok-light)", background: "rgba(76,175,80,0.14)", borderRadius: 999, padding: "5px 11px" }}>
          En yoğun: {HEAT_DAYS[best.di]} {HEAT_SLOTS[best.si].label}
        </span>
        <span style={{ fontFamily: "var(--f-body)", fontSize: 11, fontWeight: 700, color: "var(--c-warn)", background: "rgba(255,165,0,0.14)", borderRadius: 999, padding: "5px 11px" }}>
          En sakin: {HEAT_DAYS[worst.di]} {HEAT_SLOTS[worst.si].label} — anlık fırsat için uygun
        </span>
      </div>
    </div>
  );
}

function TableRequests({ restaurant }) {
  const all = reservations.useReservations();
  const mine = all.filter(x => x.restaurantId === String(restaurant?.id));
  const pending = mine.filter(x => x.status === "pending");
  const past = mine.filter(x => x.status !== "pending");

  // Panel açıldığında bekleyenler "görüldü" olur; rozet söner ama talep
  // kuyrukta kalır — görmek cevap vermek değildir.
  useEffect(() => {
    if (restaurant?.id) reservations.markSeen(restaurant.id);
  }, [restaurant?.id, mine.length]);

  const row = (x, actionable) => (
    <div key={x.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: actionable ? 12 : 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 13, background: "rgba(255,102,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon n="clock" size={17} color="#FF9A4D" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 2px" }}>
            {x.day} · {x.time} · {x.people} kişi
          </p>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "rgba(255,255,255,0.45)", margin: 0 }}>
            {x.guestName}{x.dealPct ? ` · %${x.dealPct} fırsatla` : ""}
          </p>
        </div>
        {!actionable && (
          <span style={{
            fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "4px 11px",
            color: x.status === "confirmed" ? "var(--c-ok-light)" : "rgba(255,255,255,0.4)",
            background: x.status === "confirmed" ? "rgba(76,175,80,0.14)" : "rgba(255,255,255,0.06)",
          }}>{x.status === "confirmed" ? "Onaylandı" : "Reddedildi"}</span>
        )}
      </div>
      {actionable && (
        <div style={{ display: "flex", gap: 9 }}>
          <Btn text="Onayla" onClick={() => reservations.decideReservation(x.id, "confirmed")} variant="filled" size="sm" />
          <Btn text="Reddet" onClick={() => reservations.decideReservation(x.id, "declined")} variant="destructiveSoft" size="sm" />
        </div>
      )}
    </div>
  );

  return (
    <div>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Bekleyen talepler</p>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "rgba(255,255,255,0.4)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Uygulamadan gelen masa talepleri. Onaylayana kadar misafire "iletildi"
        görünür — masayı veren taraf sizsiniz.
      </p>
      {pending.length === 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 18, padding: "22px 16px", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "rgba(255,255,255,0.38)", margin: 0 }}>Bekleyen talep yok</p>
        </div>
      )}
      {pending.map(x => row(x, true))}

      {past.length > 0 && (
        <>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 800, color: "#fff", margin: "18px 0 10px" }}>Geçmiş</p>
          {past.map(x => row(x, false))}
        </>
      )}
    </div>
  );
}

// GUR'un işletmeye gönderdiği fiyat teklifleri. Yönetici panelinde
// "Gelir kalemleri"nden gönderiliyor (src/lib/pricing.js); kabul edilene
// kadar yürürlükteki fiyat değişmiyor, karar burada veriliyor.
function PriceOffers({ restaurant }) {
  const store = pricing.usePricing();
  const mine = store.offers.filter(o => String(o.restaurantId) === String(restaurant?.id));
  const open = mine.filter(o => o.status === "pending");
  const past = mine.filter(o => o.status !== "pending");

  useEffect(() => {
    if (restaurant?.id) pricing.markOffersSeen(restaurant.id);
  }, [restaurant?.id, mine.length]);

  const fmt = (n) => `₺${Math.round(n).toLocaleString("tr")}`;

  const card = (o, actionable) => {
    const cheaper = o.offerMonthly < o.currentMonthly;
    const diff = o.currentMonthly ? Math.round(((o.offerMonthly - o.currentMonthly) / o.currentMonthly) * 100) : null;
    return (
      <div key={o.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 13, background: "rgba(255,102,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon n="sparkle" size={17} color="#FF9A4D" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 2px" }}>{o.streamName}</p>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "rgba(255,255,255,0.45)", margin: 0 }}>
              GUR'dan fiyat teklifi
            </p>
          </div>
          {!actionable && (
            <span style={{
              fontFamily: "var(--f-body)", fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "4px 11px",
              color: o.status === "accepted" ? "var(--c-ok-light)" : "rgba(255,255,255,0.4)",
              background: o.status === "accepted" ? "rgba(76,175,80,0.14)" : "rgba(255,255,255,0.06)",
            }}>{o.status === "accepted" ? "Kabul edildi" : "Reddedildi"}</span>
          )}
        </div>

        {/* Eski ve yeni fiyat yan yana: teklif tek başına bir sayı değil, bir değişiklik */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.22)", borderRadius: 14, padding: "11px 14px", marginBottom: actionable ? 12 : 0 }}>
          <div>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 10.5, color: "rgba(255,255,255,0.4)", margin: "0 0 2px" }}>Şu anki</p>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", margin: 0, textDecoration: "line-through" }}>{fmt(o.currentMonthly)}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.4" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></svg>
          <div>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 10.5, color: "rgba(255,255,255,0.4)", margin: "0 0 2px" }}>Teklif</p>
            <p style={{ fontFamily: "var(--f-body)", fontSize: 17, fontWeight: 800, color: cheaper ? "var(--c-ok-light)" : "var(--c-warn)", margin: 0 }}>{fmt(o.offerMonthly)}<span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}> /ay</span></p>
          </div>
          {diff !== null && diff !== 0 && (
            <span style={{ marginLeft: "auto", fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 800, color: cheaper ? "var(--c-ok-light)" : "var(--c-warn)" }}>
              {diff > 0 ? "+" : ""}{diff}%
            </span>
          )}
        </div>

        {o.note && (
          <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.55)", margin: actionable ? "0 0 12px" : "10px 0 0", lineHeight: 1.5 }}>"{o.note}"</p>
        )}

        {actionable && (
          <div style={{ display: "flex", gap: 9 }}>
            <Btn text="Kabul et" onClick={() => pricing.decideOffer(o.id, "accepted")} variant="filled" size="sm" />
            <Btn text="Reddet" onClick={() => pricing.decideOffer(o.id, "declined")} variant="destructiveSoft" size="sm" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Size gelen teklifler</p>
      <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, color: "rgba(255,255,255,0.4)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Kullandığınız hizmetlerin fiyatına dair GUR'dan gelen teklifler.
        Kabul etmediğiniz sürece mevcut fiyatınız değişmez.
      </p>
      {open.length === 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 18, padding: "22px 16px", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "rgba(255,255,255,0.38)", margin: 0 }}>Bekleyen teklif yok</p>
        </div>
      )}
      {open.map(o => card(o, true))}

      {past.length > 0 && (
        <>
          <p style={{ fontFamily: "var(--f-body)", fontSize: 13, fontWeight: 800, color: "#fff", margin: "18px 0 10px" }}>Geçmiş</p>
          {past.map(o => card(o, false))}
        </>
      )}
    </div>
  );
}

function RestaurantDashboard({ onLogout, ownerRestaurant }) {
  const [activeTab, setActiveTab] = useState("stats");
  // Masa ayırtma yönetici panelinden kapatılabiliyor; kapalıysa sekme de
  // talep de yok — işletmeye cevaplayamayacağı bir kuyruk göstermeyiz.
  const canReserve = useFeature("reservationsEnabled", ownerRestaurant?.id);
  const allReservations = reservations.useReservations();
  const pendingCount = allReservations.filter(
    x => x.restaurantId === String(ownerRestaurant?.id) && x.status === "pending").length;
  const priceStore = pricing.usePricing();
  const openOffers = priceStore.offers.filter(
    o => String(o.restaurantId) === String(ownerRestaurant?.id) && o.status === "pending").length;
  const [bought, setBought] = useState({});
  const [notice, setNotice] = useState(null);
  // `buy` KALDIRILDI: işletme kendi kendine hizmet açamıyor. Paketler
  // yalnızca yöneticinin gönderdiği teklif kabul edilince açılıyor;
  // `bought` artık yalnızca "şu an aktif mi" göstergesi olarak okunuyor.
  const [dealPct, setDealPct] = useState(20);
  const [dealHours, setDealHours] = useState(2);
  const [dealLive, setDealLive] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  // Anlık fırsat satışa kapalıysa kart yerinde duruyor ama "Pek yakında".
  const anlikSatista = useServiceOpen("instantDeals", ownerRestaurant?.id);
  // Menü ve fotoğraf yüklemeleri artık ortak depoda (src/lib/media.js) ve
  // onay kuyruğundan geçiyor; MediaManager doğrudan oradan okuyup yazıyor.
  // Eskiden burada kökten prop olarak inen geçici bir dizi vardı: sayfa
  // yenilenince kayboluyor, yönetici panelinden hiç görünmüyordu.

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
      <div style={{ height: "100%", background: "#100D0B", overflowY: "auto" }}>
        {/* Header */}
        <div className="gur-on-brand" style={{ background: GRAD, padding: "44px 20px 24px", borderBottomLeftRadius: 32, borderBottomRightRadius: 32, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Btn
              text="Çıkış" onClick={() => setShowLogout(true)}
              variant="outline" size="sm" fullWidth={false}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>}
            />
            <GurLogo size={42} pill />
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "6px 12px", backdropFilter: "blur(8px)" }}>
              <span style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "#fff", fontWeight: 700 }}>İŞLETME PANELİ</span>
            </div>
          </div>

          {/* Restoran bilgisi */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <LogoUpload restaurant={ownerRestaurant} />
            <div>
              <h2 style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 3px" }}>{ownerRestaurant?.name || "Restoranınız"}</h2>
              <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{ownerRestaurant?.addr || "Kadıköy, İstanbul"} • Aktif</p>
            </div>
          </div>

          {/* Puan badge */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)" }}>
<Icon n="star" color="#fff" size={18} />
              <div>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>{stats.avgRating}</p>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 10, color: "rgba(255,255,255,0.6)", margin: 0 }}>Ortalama Puan</p>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)" }}>
<Icon n="chat" color="#fff" size={18} />
              <div>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>{stats.totalReviews}</p>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 10, color: "rgba(255,255,255,0.6)", margin: 0 }}>Toplam Yorum</p>
              </div>
            </div>
            {/* Turuncu zeminde yeşil-üstüne-yeşil okunmuyordu: beyaz kart,
                marka turuncusu yazı. */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, boxShadow: "var(--sh-1)" }}>
<Icon n="flame" color="#FF6600" size={18} />
              <div>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "var(--c-brand-ink)", margin: 0, lineHeight: 1 }}>%{stats.favRate}</p>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 10, color: "rgba(255,102,0,0.75)", margin: 0 }}>Beğeni Oranı</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "0 16px 40px" }}>
          {/* Tab seçici */}
          {/* Sekmeler sığmıyor: eşit bölmek yerine kaydırılabilir şerit.
              Sekme sayısı arttıkça yazılar kırpılıyordu. */}
          <HScroll style={{ marginBottom: 20, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { id: "stats", label: "İstatistikler" },
              ...(canReserve ? [{ id: "tables", label: "Masalar", badge: pendingCount }] : []),
              { id: "offers", label: "Teklifler", badge: openOffers },
              { id: "info", label: "Bilgiler" },
              { id: "reviews", label: "Yorumlar" },
              { id: "menu", label: "Menü" },
              { id: "photos", label: "Fotoğraflar" },
              { id: "growth", label: "Büyüme" },
            ].map(tab => (
              <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flexShrink: 0, padding: "13px 16px", textAlign: "center", cursor: "pointer", whiteSpace: "nowrap",
                background: activeTab === tab.id ? "rgba(255,102,0,0.15)" : "transparent",
                borderBottom: activeTab === tab.id ? "2px solid #FF6600" : "2px solid transparent",
                transition: "all 0.25s",
              }}>
                <span style={{ fontFamily: "var(--f-body)", fontSize: 11, fontWeight: activeTab === tab.id ? 700 : 500, color: activeTab === tab.id ? "#FF6600" : "rgba(255,255,255,0.4)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {tab.label}
                  {/* Bekleyen talep sayısı: işletmenin ilk bakacağı yer */}
                  {tab.badge > 0 && (
                    <span style={{ minWidth: 15, height: 15, borderRadius: 8, background: "var(--c-bad)", color: "#fff", fontSize: 9, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{tab.badge}</span>
                  )}
                </span>
              </div>
            ))}
          </HScroll>

          {/* Onay durumu her sekmede görünür: bekleyen bir menü onayını
              görmek için Menü sekmesine girmek gerekseydi işletme onu
              ancak arayarak bulurdu. */}
          <ApprovalStatus restaurant={ownerRestaurant} onGo={setActiveTab} />

          {/* ─── TAB: Masa talepleri ───
              Kullanıcı uygulamadan masa ayırttığında talep buraya düşer.
              Masayı verecek taraf işletme olduğu için karar da burada. */}
          {activeTab === "tables" && canReserve && (
            <TableRequests restaurant={ownerRestaurant} />
          )}

          {/* ─── TAB: Fiyat teklifleri ─── */}
          {activeTab === "offers" && (
            <PriceOffers restaurant={ownerRestaurant} />
          )}

          {/* ─── TAB: İşletme bilgileri ─── */}
          {activeTab === "info" && (
            <OwnerInfoTab restaurant={ownerRestaurant} />
          )}

          {/* ─── TAB: İstatistikler ─── */}
          {activeTab === "stats" && (
            <div>
              {/* Büyük stat kartları */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {/* Sağ kaydırma */}
                <div style={{ background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.15)", borderRadius: 20, padding: "18px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
<div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(76,175,80,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="heart" color="var(--c-ok-light)" size={16} /></div>
                    <span style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(76,175,80,0.8)", fontWeight: 600 }}>Sağ Kaydırma</span>
                  </div>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--c-ok-light)", margin: "0 0 2px" }}>{stats.swipeRight}</p>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>kişi beğendi</p>
                </div>
                {/* Sol kaydırma */}
                <div style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.15)", borderRadius: 20, padding: "18px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
<div style={{ width: 36, height: 36, borderRadius: 12, background: "var(--c-bad-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="cross" color="var(--c-bad-ink)" size={16} /></div>
                    <span style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(255,59,48,0.8)", fontWeight: 600 }}>Sol Kaydırma</span>
                  </div>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--c-bad-ink)", margin: "0 0 2px" }}>{stats.swipeLeft}</p>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>kişi geçti</p>
                </div>
              </div>

              {/* Toplam görüntülenme */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
<div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,165,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="eye" color="var(--c-warn)" size={18} /></div>
                  <div>
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 2px" }}>Toplam Görüntülenme</p>
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>{stats.totalViews.toLocaleString()}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "var(--c-ok-light)", fontWeight: 700 }}>↑ 12%</span>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>bu hafta</p>
                </div>
              </div>

              <InteractionHeatmap restaurant={ownerRestaurant} />

              {/* Haftalık grafik */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 16px", marginBottom: 20 }}>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 16px" }}>Haftalık Kaydırma Grafiği</p>
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
                        <span style={{ fontFamily: "var(--f-body)", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(76,175,80,0.6)" }} />
                    <span style={{ fontFamily: "var(--f-body)", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Beğeni</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(255,59,48,0.4)" }} />
                    <span style={{ fontFamily: "var(--f-body)", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Geçme</span>
                  </div>
                </div>
              </div>

              {/* Puan dağılımı */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 16px" }}>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 14px" }}>Puan Dağılımı</p>
                {[
                  { stars: 5, count: 18, pct: 47 },
                  { stars: 4, count: 11, pct: 29 },
                  { stars: 3, count: 5, pct: 13 },
                  { stars: 2, count: 2, pct: 5 },
                  { stars: 1, count: 2, pct: 5 },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 4 ? 8 : 0 }}>
                    <span style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", width: 14, textAlign: "right" }}>{r.stars}</span>
                    <span style={{ fontSize: 12, color: "var(--c-warn)" }}>★</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ width: `${r.pct}%`, height: "100%", borderRadius: 4, background: r.stars >= 4 ? "rgba(76,175,80,0.5)" : r.stars === 3 ? "rgba(255,165,0,0.5)" : "rgba(255,59,48,0.4)", transition: "width 0.6s ease-out", transitionDelay: `${i * 0.1}s` }} />
                    </div>
                    <span style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(255,255,255,0.35)", width: 28, textAlign: "right" }}>{r.count}</span>
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
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: "#FF6600", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", fontFamily: "var(--f-body)", fontWeight: 800 }}>
                        {rev.user.charAt(0)}
                      </div>
                      <div>
                        <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{rev.user}</p>
                        <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} style={{ fontSize: 11, color: s <= rev.stars ? "var(--c-warn)" : "rgba(255,255,255,0.12)" }}>★</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{rev.date}</span>
                  </div>
                  <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>{rev.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* ─── TAB: Menü Yönetimi ─── */}
          {activeTab === "menu" && (
            <div>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>Menü sayfalarınızı buradan yükleyin. GUR ekibi onayladıktan sonra kullanıcılar menünüzü bu görseller üzerinden görür.</p>
              </div>

              <MediaManager restaurant={ownerRestaurant} kind="menu" />
            </div>
          )}

          {/* ─── TAB: Büyüme (gelir ürünleri) ─── */}
          {activeTab === "growth" && (
            <div>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>
                  Görünürlüğünüzü artıran paketler. <b>Hiçbiri doğrudan satın alınmaz</b> —
                  GUR ekibi onaylamadan hiçbiri yayına girmez. Reklam kalemlerinin
                  (banner, ödüllü video, push) <b>fiyatı sabittir</b>: takvimden müsait
                  tarihi seçip talep gönderirsiniz. Diğer paketlerde fiyat size özel
                  belirlenir, teklif istersiniz. Rezervasyon ve menü ücretsizdir.
                </p>
              </div>

              {/* Faz 1 — reklam / sponsorluk */}
              <GrowthSection title="Reklam ve Sponsorluk">
                <GrowthCard
                  title="Keşfet Banner'ı" price="" active={bought.featured}
                  streamKey="bannerAds" streamName="Dönen keşfet banner'ı" restaurant={ownerRestaurant}
                  desc="Keşfet ekranının üstündeki dönen banner'da bir slayt. Haftada ~4.000 gösterim."
                />
                <GrowthCard
                  title="Ödüllü Video Reklam" price="" active={bought.rewarded}
                  streamKey="rewardedAds" streamName="Ödüllü video reklam" restaurant={ownerRestaurant}
                  desc="Kullanıcı kaydırma hakkı kazanmak için videonuzu sonuna kadar izler — tamamlanma oranı ~%78."
                />
                <GrowthCard
                  title="Push Bildirim Reklamı" price="" active={bought.push}
                  streamKey="pushAds" streamName="Push bildirim reklamları" restaurant={ownerRestaurant}
                  desc="Semtinizdeki kullanıcılara tek seferlik bildirim. Gönderim saatini siz seçersiniz."
                />
              </GrowthSection>

              <GrowthSection title="Anlık Fırsat ve Rezervasyon">
                {!anlikSatista ? (
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "16px 18px", marginBottom: 12 }}>
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Anlık İndirim Yayınla</p>
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.5 }}>
                      Ölü saatlerinizi doldurun: yakındaki kullanıcılara süreli indirim bildirimi gider.
                    </p>
                    <ComingSoon />
                  </div>
                ) : (
                  <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 18, padding: "16px 18px", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>Anlık İndirim Yayınla</p>
                      {/* Fiyat depodan: yönetici Fiyatlandırma sayfasından
                          değiştirdiğinde burası da değişiyor. */}
                      <span style={{ fontFamily: "var(--f-body)", fontSize: 11, fontWeight: 700, color: "var(--c-ok-light)" }}>
                        liste: ₺{pricing.listPriceOf("instantDeals").toLocaleString("tr")} / yayın
                      </span>
                    </div>
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.5 }}>
                      Ölü saatlerinizi doldurun: yakındaki kullanıcılara süreli indirim bildirimi gider.
                    </p>

                    <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 7px" }}>İndirim oranı</p>
                    <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
                      {[10, 15, 20, 25, 30].map(v => (
                        <DarkChip key={v} label={`%${v}`} active={dealPct === v} onClick={() => setDealPct(v)} />
                      ))}
                    </div>

                    <p style={{ fontFamily: "var(--f-body)", fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 7px" }}>Süre</p>
                    <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
                      {[1, 2, 3, 4].map(v => (
                        <DarkChip key={v} label={`${v} saat`} active={dealHours === v} onClick={() => setDealHours(v)} />
                      ))}
                    </div>

                    {dealLive ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(34,197,94,0.12)", borderRadius: 14, padding: "11px 14px" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-ok)", animation: "pulse 1.6s ease-in-out infinite", flexShrink: 0 }} />
                        <p style={{ fontFamily: "var(--f-body)", fontSize: 12.5, color: "var(--c-ok-light)", margin: 0, flex: 1 }}>
                          %{dealPct} indirim {dealHours} saat boyunca yayında
                        </p>
                        <Btn text="Durdur" onClick={() => setDealLive(false)} variant="destructiveSoft" size="sm" fullWidth={false} />
                      </div>
                    ) : (
                      <Btn text={`%${dealPct} indirimi ${dealHours} saat yayınla`} onClick={() => { setDealLive(true); setNotice("Fırsat yayında — yakındaki kullanıcılara bildirim gitti"); setTimeout(() => setNotice(null), 2200); }} variant="filled" />
                    )}
                  </div>
                )}

                {(
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "16px 18px" }}>
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Rezervasyon</p>
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.5 }}>
                      Kullanıcı uygulamadan masa ayırtır, talep panelinize düşer. Tamamen ücretsizdir.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {[["Bu ay", "38"], ["Ciro", "₺52.400"], ["Onaylanan", "31"]].map(([k, v]) => (
                        <div key={k} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "11px 12px" }}>
                          <p style={{ fontFamily: "var(--f-body)", fontSize: 10.5, color: "rgba(255,255,255,0.4)", margin: "0 0 3px" }}>{k}</p>
                          <p style={{ fontFamily: "var(--f-body)", fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </GrowthSection>

              {/* ─── İKİNCİ ŞANS ───
                  Diğer kartlardan farklı: gerçek bir kota tutuyor.
                  Satın alınınca paket aktifleşiyor, 200 farklı kullanıcıya
                  gösterildikçe ilerliyor ve kota bitince kendiliğinden
                  kapanıyor. Aktifken ikinci paket alınamıyor — düğme
                  kapanıyor ve kural depoda da var. */}
              <GrowthSection title="İkinci Şans">
                <SecondChanceCard restaurant={ownerRestaurant} />
              </GrowthSection>

              {/* ─── GASTRO: ALTIN PAKET ───
                  Kataloğun en üst basamağı ve tek "seçilerek verilen"
                  paketi — rozet bağımsız şef değerlendirmesine dayanıyor,
                  parayla alınmıyor. Görsel dili bu yüzden diğerlerinden
                  ayrı: altın gradyan + üstünden geçen parıltı. */}
              <GrowthSection title="Gastro Paketi">
                <GrowthCard
                  gold
                  title="Gastro Şef Videosu Paketi" price="" active={bought.license}
                  desc="Tanınmış bir şef mekânınızda 15 sn dikey video çeker; video hem uygulamada galeride yayınlanır hem de kendi sosyal medyanızda süresiz kullanılır. Paketi alan mekan Gastro Onaylı kategorisine girer."
                  streamKey="gastroPackage" streamName="Gastro şef videosu paketi" restaurant={ownerRestaurant}
                />
              </GrowthSection>

              {/* ─── KENDİ REKLAM DOSYANIZ ───
                  Yukarıdaki kartlar "ne satın alıyorum"u anlatıyor; burası
                  "yayınlanmasını istediğim dosya". İkisi ayrı: biri bizim
                  tanıtımımız (yönetici yüklüyor), bu ise müşterinin
                  gönderdiği içerik ve ONAYDAN GEÇİYOR.

                  HER YERLEŞİMİN KENDİ KUTUSU. Tek bir "reklam dosyası"
                  kutusu vardı ve banner ile ödüllü video aynı havuzdan
                  besleniyordu; işletme hangi dosyanın nereye gittiğini
                  göremiyor, bir dosya bırakıp ikisini de doldurduğunu
                  sanıyordu. Kutular yan yana değil ALT ALTA: telefonda iki
                  yükleme alanını yan yana sıkıştırmak ikisini de hedef
                  olmaktan çıkarırdı. */}
              <GrowthSection title="Reklam materyaliniz">
                <p style={{ fontFamily: "var(--f-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 16px", lineHeight: 1.55 }}>
                  Her reklam alanının dosyası ayrı: banner yatay bir görsel,
                  ödüllü reklam dikey bir video ister. GUR ekibi onayladıktan
                  sonra satın aldığınız alanda yayınlanır.
                </p>
                {AD_KINDS.map(k => (
                  <AdCreativeSlot key={k} kind={k} restaurant={ownerRestaurant} />
                ))}
              </GrowthSection>
            </div>
          )}

          {/* ─── TAB: Fotoğraf Yönetimi ─── */}
          {activeTab === "photos" && (
            <div>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>Mekan ve yemek fotoğraflarınızı yükleyin. Onaylananlar keşif kartınızda ilk sırada gösterilir.</p>
              </div>

              <MediaManager restaurant={ownerRestaurant} kind="photos" grid />

              {/* İpuçları */}
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 16px", marginTop: 16 }}>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: "0 0 8px" }}>Fotoğraf Önerileri</p>
                {["Mekan iç görünümü (ambiyans)", "Dış cephe (bulunabilirlik)", "En popüler 2-3 yemek", "Servis ve sunum detayları"].map((tip, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 3 ? 5 : 0 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                    <p style={{ fontFamily: "var(--f-body)", fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>{tip}</p>
                  </div>
                ))}
              </div>

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
              background: "var(--c-ok)", borderRadius: 16, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 9, boxShadow: "var(--sh-d2)",
            }}>
            <Icon n="check" size={15} color="#fff" />
            <span style={{ fontFamily: "var(--f-body)", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{notice}</span>
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
                background: "var(--c-warm-dark)", borderRadius: 24, padding: "30px 24px 24px",
                width: "100%", maxWidth: 320, border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "var(--sh-d4)",
              }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "50%",
                  background: "rgba(255,59,48,0.1)", margin: "0 auto 16px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--c-bad-light)" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </div>
                <h3 style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Çıkış Yap</h3>
                <p style={{ fontFamily: "var(--f-body)", fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.5 }}>
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

// ═══════════════════════════════════════════════════════════════════════
// UYGULAMA KÖKÜ — işletmenin oturumu ve ekran yönlendirmesi
//
// Tüketici uygulamasının kökünden bağımsız: kendi geçmişi, kendi çıkışı.
// Oturum bellekte tutuluyor (demo); gerçek dağıtımda sunucudaki işletme
// oturumu bunun yerini alır ve hangi restoranın yönetildiği token'dan gelir.
// ═══════════════════════════════════════════════════════════════════════
export default function GurBusiness() {
  const [screen, setScreen] = useState("auth");   // auth | login | claim | reg1..3 | dashboard
  const [history, setHistory] = useState([]);
  // Kayıt akışındaki (reg3) geçici yüklemeler. Orada henüz sahiplenilmiş
  // bir kayıt YOK — dosyayı hangi restoranın altına yazacağımızı
  // bilmiyoruz — o yüzden depoya değil ekrana bağlı duruyorlar. Panele
  // girildikten sonraki yüklemeler ortak depoya ve onay kuyruğuna gider.
  const [ownerMedia, setOwnerMedia] = useState({ photos: [], menu: [] });
  const [claimedRestaurant, setClaimedRestaurant] = useState(null);

  const ownerProfiles = useOwnerProfiles();
  const mediaState = useMedia();

  // Yönetilen mekan: sahiplenilen kayıt, yoksa demo işletmesi. Liste
  // tüketici uygulamasıyla ortak (src/data/restaurants.js).
  //
  // İki adım şart: hangi mekanı yönettiğimizi bilmeden onun medyasını
  // ekleyemeyiz, ama medyayı eklemeden de kaydın son hâli çıkmaz. Önce
  // kimliği buluyoruz, sonra o kimliğin ONAYLI dosyalarını bindiriyoruz —
  // işletme kendi panelinde tüketicinin gördüğü kaydın aynısını görsün.
  const basePool = useMemo(
    () => RESTAURANTS.map(r => applyOwnerProfile(r, ownerProfiles)),
    [ownerProfiles]
  );
  const baseOwner = useMemo(
    () => (claimedRestaurant
      ? basePool.find(r => String(r.id) === String(claimedRestaurant.id)) || claimedRestaurant
      : findOwnerRestaurant(basePool)),
    [basePool, claimedRestaurant]
  );
  const pool = useMemo(
    () => withOwnerMedia(basePool, baseOwner?.id, ownerMediaFor(baseOwner?.id, mediaState)),
    [basePool, baseOwner, mediaState]
  );
  const ownerRestaurant = useMemo(
    () => pool.find(r => String(r.id) === String(baseOwner?.id)) || baseOwner,
    [pool, baseOwner]
  );

  const nav = (next) => { setHistory(h => [...h, screen]); setScreen(next); };
  const back = () => setHistory(h => {
    if (!h.length) return h;
    setScreen(h[h.length - 1]);
    return h.slice(0, -1);
  });
  const logout = () => { setHistory([]); setClaimedRestaurant(null); setScreen("auth"); };

  // Sunucu var mı — tüketici uygulamasıyla aynı ölçüm.
  useEffect(() => { backend.boot(); }, []);

  const render = () => {
    switch (screen) {
      case "login": return <DoyurucuLoginScreen onBack={back} onLogin={() => nav("dashboard")} />;
      case "claim": return <ClaimScreen onBack={back} restaurants={pool}
        onDone={(r) => { setClaimedRestaurant(r); nav("dashboard"); }} />;
      case "reg1": return <RestRegStep1 onBack={back} onNext={() => nav("reg2")} />;
      case "reg2": return <RestRegStep2 onBack={back} onNext={() => nav("reg3")} />;
      case "reg3": return <RestRegStep3 onBack={back} onDone={() => nav("dashboard")} ownerMedia={ownerMedia} setOwnerMedia={setOwnerMedia} />;
      case "dashboard": return <RestaurantDashboard onLogout={logout} ownerRestaurant={ownerRestaurant} />;
      default: return <DoyurucuAuthScreen
        onLogin={() => nav("login")} onRegister={() => nav("reg1")} onClaim={() => nav("claim")} />;
    }
  };

  return (
    <div className="gur-stage" style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0d0d1a, #1a1a2e, #0d0d1a)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 0", colorScheme: "light" }}>
      <GurStyles />
      {/* Parlak turuncu simge gradyanı bir kez tanımlanıyor; simgeler
          url(#gur-gloss) ile buna bağlanıyor. Her düğmede ayrı <defs>
          çizilseydi aynı id çoğalır, tarayıcı ilkine bağlanırdı. */}
      <GlossDefs />
      <PhoneFrame>
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ height: "100%" }}>
            {render()}
          </motion.div>
        </AnimatePresence>
      </PhoneFrame>
    </div>
  );
}
