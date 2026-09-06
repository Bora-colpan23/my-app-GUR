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
  GurLogo, Icon, Img, InputField, SelectField, Btn, IconBtn, Spinner,
  HScroll, UploadBox, PhoneFrame, Screen, GurStyles, VerifiedStar,
  GRAD, BackBtn, haptic, keepVisible, toMediaFiles,
} from '../ui/kit.jsx';
import {
  submitClaim, useClaims, applyOwnerProfile, useOwnerProfiles,
  saveOwnerProfile, saveOwnerLogo, clearOwnerLogo, ownerLogo, OVERRIDABLE,
} from '../lib/b2b.js';
import { fileToSquareDataUrl } from '../lib/image.js';
import { useFeature } from '../lib/platform.js';
import * as reservations from '../lib/reservations.js';
import * as pricing from '../lib/pricing.js';
import * as backend from '../lib/backend.js';
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
        <div style={{ background: GRAD, padding: "28px 28px 50px", borderTopLeftRadius: 40, borderTopRightRadius: 40, position: "relative" }}>
          {/* Bu ekran işletme uygulamasının başlangıcı: geri gidilecek bir
              yer yok, geri düğmesi de yok. Tıklandığında hiçbir şey
              yapmayan bir düğme, olmayan düğmeden kötü. */}

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
          <div style={{ height: 12 }} />
          {/* Havuzdaki kayıtların çoğu dış API'lerden geliyor: işletmenin
              sıfırdan kayıt açması değil, var olanı sahiplenmesi asıl yol. */}
          <Btn text="İşletmem zaten GUR'da — sahiplen" onClick={onClaim} variant="outline" />
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
  const plan = svc?.plan && svc.plan !== "free"
    ? (svc.plan === "pro" ? "Pro" : "Premium") : "Ücretsiz";

  return (
    <div style={{ background: "rgba(255,102,0,0.07)", border: "1px solid rgba(255,102,0,0.2)", borderRadius: 20, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: "#fff", margin: 0 }}>Aldığın hizmetler</p>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, color: plan === "Ücretsiz" ? "rgba(255,255,255,0.5)" : "#FFA500", background: "rgba(255,255,255,0.07)", borderRadius: 6, padding: "3px 9px" }}>
          {plan.toLocaleUpperCase("tr")} PLAN
        </span>
      </div>

      {campaigns.length === 0 ? (
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: 0 }}>
          Yayında kampanyan yok. Büyüme sekmesinden öne çıkan kart, banner veya
          push bildirimi satın alarak keşif akışında görünürlüğünü artırabilirsin.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {campaigns.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 600, color: "#fff" }}>
                {c.label} kartı
              </span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.45)", letterSpacing: 0.3 }}>
                {String(c.pricing || "").toLocaleUpperCase("tr")}
              </span>
            </div>
          ))}
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, margin: "2px 0 0" }}>
            Bu hizmetler restoran sayfanda kullanıcıya da açıkça gösteriliyor.
          </p>
        </div>
      )}
    </div>
  );
}

function OwnerInfoTab({ restaurant }) {
  const profiles = useOwnerProfiles();
  const own = profiles[String(restaurant?.id)] || {};
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(INFO_FIELDS.map(f => [f.key, own[f.key] || ""])));
  const [saved, setSaved] = useState(false);

  if (!restaurant) {
    return <LockedCard text="Önce bir işletme sahiplen; bilgiler o kayda yazılır." />;
  }

  const save = async () => {
    await backend.saveOwnerFields(restaurant.id, draft);
    haptic(12);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const filled = OVERRIDABLE.filter(f => draft[f]?.trim()).length;

  return (
    <div>
      {/* İşletmenin aldığı hizmetler — panelin en üstünde, hangi ürünün
          açık olduğu tek bakışta görünsün. */}
      <OwnerServices restaurant={restaurant} />

      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "14px 16px", marginBottom: 16 }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.55 }}>
          Kaydın harita servislerinden otomatik oluşturuldu. Doldurduğun alanlar bu veriyi
          ezer; boş bıraktıkların API'den gelmeye devam eder.
        </p>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 700, color: "#FFA500", margin: "9px 0 0" }}>
          {filled}/{OVERRIDABLE.length} alan işletmeden
        </p>
      </div>

      {INFO_FIELDS.map(f => {
        const fromOwner = !!draft[f.key]?.trim();
        return (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{f.label}</label>
              <span style={{
                fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4,
                padding: "2px 8px", borderRadius: 6,
                color: fromOwner ? "#4ADE80" : "rgba(255,255,255,0.45)",
                background: fromOwner ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.07)",
              }}>{fromOwner ? "İŞLETMEDEN" : "API'DEN"}</span>
            </div>
            {f.multiline ? (
              <textarea
                value={draft[f.key]} rows={3} onFocus={keepVisible}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={restaurant[f.key] || f.placeholder}
                style={{ width: "100%", resize: "vertical", borderRadius: 14, padding: "11px 13px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 13.5, lineHeight: 1.5, outline: "none", boxSizing: "border-box" }}
              />
            ) : (
              <input
                value={draft[f.key]} onFocus={keepVisible}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={restaurant[f.key] || f.placeholder}
                style={{ width: "100%", borderRadius: 14, padding: "11px 13px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", WebkitTextFillColor: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: 13.5, outline: "none", boxSizing: "border-box" }}
              />
            )}
            {!fromOwner && restaurant[f.key] && (
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.32)", margin: "5px 0 0" }}>
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
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "#1C1917", margin: 0 }}>İşletmemi sahiplen</h2>
          </div>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#8A7A68", lineHeight: 1.55, margin: "0 0 18px" }}>
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
                  style={{ width: "100%", padding: "14px 16px 14px 42px", borderRadius: 16, border: "1px solid rgba(45,36,25,0.12)", outline: "none", fontSize: 14.5, fontFamily: "'Outfit', sans-serif", background: "#FBFAF8", color: "#2D2419", WebkitTextFillColor: "#2D2419", boxSizing: "border-box" }}
                />
                <div style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }}>
                  <Icon n="search" size={16} color="#A8A29E" />
                </div>
              </div>

              {query.trim().length >= 2 && results.length === 0 && (
                <div style={{ textAlign: "center", padding: "26px 16px" }}>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, color: "#8A7A68", margin: "0 0 4px" }}>Bu isimde bir kayıt bulamadık</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#A8A29E", lineHeight: 1.5, margin: 0 }}>
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
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#1C1917", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>{r.name}{(r.claimed || r.ownerClaimed) && <VerifiedStar size={12} />}</p>
                      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "#8A7A68", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.addr}</p>
                    </div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, flexShrink: 0, color: st === "approved" ? "#16A34A" : st === "pending" ? "#D97706" : "#FF6600" }}>
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
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, fontWeight: 700, color: "#1C1917", margin: 0 }}>{picked.name}</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "#8A7A68", margin: 0 }}>{picked.addr}</p>
                </div>
                <Btn text="Değiştir" onClick={() => setPicked(null)} variant="plainDark" size="sm" fullWidth={false} />
              </div>

              <InputField label="Ticaret unvanı" value={form.legalName} onChange={set("legalName")} placeholder="ör: Çiya Gıda San. Tic. Ltd. Şti." />
              <InputField label="Vergi numarası" value={form.taxId} onChange={set("taxId")} placeholder="10 haneli" />
              <InputField label="Yetkili adı" value={form.contactName} onChange={set("contactName")} placeholder="Ad Soyad" />
              <InputField label="Telefon" value={form.phone} onChange={set("phone")} placeholder="0216 000 00 00" />
              <InputField label="E-posta" value={form.email} onChange={set("email")} placeholder="isletme@mail.com" />

              <div style={{ background: "#FBFAF8", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "#8A7A68", lineHeight: 1.55, margin: 0 }}>
                  Başvurun yönetici onayına düşer. Onaylanınca panelde menü, fotoğraf ve bilgileri
                  düzenleyebilirsin; doldurmadığın alanlar harita servislerinden gelmeye devam eder.
                </p>
              </div>

              {error && (
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "#FF3B30", margin: "0 0 12px" }}>{error}</p>
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
              onFocus={e => { setLocFocused(true); keepVisible(e); }} onBlur={() => setTimeout(() => setLocFocused(false), 200)}
              placeholder="İlçe veya adres yazın..."
              style={{ width: "100%", padding: "15px 18px 15px 42px", borderRadius: 16, border: "none", outline: "none", fontSize: 15, fontFamily: "'Outfit', sans-serif", background: "#fff", color: "#2D2419", WebkitTextFillColor: "#2D2419", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", boxSizing: "border-box" }}
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
            fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "#2D2419",
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

function GrowthSection({ title, locked, children }) {
  return (
    <div style={{ marginBottom: 22, opacity: locked ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.5)", margin: 0, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</p>
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
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
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
        <p style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "#fff", background: "rgba(255,59,48,0.9)", borderRadius: 8, padding: "3px 8px", whiteSpace: "nowrap" }}>{error}</p>
      )}
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
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 2px" }}>
            {x.day} · {x.time} · {x.people} kişi
          </p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.45)", margin: 0 }}>
            {x.guestName}{x.dealPct ? ` · %${x.dealPct} fırsatla` : ""}
          </p>
        </div>
        {!actionable && (
          <span style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "4px 11px",
            color: x.status === "confirmed" ? "#4CAF50" : "rgba(255,255,255,0.4)",
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
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Bekleyen talepler</p>
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.4)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Uygulamadan gelen masa talepleri. Onaylayana kadar misafire "iletildi"
        görünür — masayı veren taraf sizsiniz.
      </p>
      {pending.length === 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 18, padding: "22px 16px", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.38)", margin: 0 }}>Bekleyen talep yok</p>
        </div>
      )}
      {pending.map(x => row(x, true))}

      {past.length > 0 && (
        <>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: "#fff", margin: "18px 0 10px" }}>Geçmiş</p>
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
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 2px" }}>{o.streamName}</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.45)", margin: 0 }}>
              GUR'dan fiyat teklifi
            </p>
          </div>
          {!actionable && (
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "4px 11px",
              color: o.status === "accepted" ? "#4CAF50" : "rgba(255,255,255,0.4)",
              background: o.status === "accepted" ? "rgba(76,175,80,0.14)" : "rgba(255,255,255,0.06)",
            }}>{o.status === "accepted" ? "Kabul edildi" : "Reddedildi"}</span>
          )}
        </div>

        {/* Eski ve yeni fiyat yan yana: teklif tek başına bir sayı değil, bir değişiklik */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.22)", borderRadius: 14, padding: "11px 14px", marginBottom: actionable ? 12 : 0 }}>
          <div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.4)", margin: "0 0 2px" }}>Şu anki</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)", margin: 0, textDecoration: "line-through" }}>{fmt(o.currentMonthly)}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.4" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></svg>
          <div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.4)", margin: "0 0 2px" }}>Teklif</p>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 800, color: cheaper ? "#4CAF50" : "#FFA500", margin: 0 }}>{fmt(o.offerMonthly)}<span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}> /ay</span></p>
          </div>
          {diff !== null && diff !== 0 && (
            <span style={{ marginLeft: "auto", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 800, color: cheaper ? "#4CAF50" : "#FFA500" }}>
              {diff > 0 ? "+" : ""}{diff}%
            </span>
          )}
        </div>

        {o.note && (
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", margin: actionable ? "0 0 12px" : "10px 0 0", lineHeight: 1.5 }}>"{o.note}"</p>
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
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Size gelen teklifler</p>
      <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.4)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Kullandığınız hizmetlerin fiyatına dair GUR'dan gelen teklifler.
        Kabul etmediğiniz sürece mevcut fiyatınız değişmez.
      </p>
      {open.length === 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 18, padding: "22px 16px", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.38)", margin: 0 }}>Bekleyen teklif yok</p>
        </div>
      )}
      {open.map(o => card(o, true))}

      {past.length > 0 && (
        <>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: "#fff", margin: "18px 0 10px" }}>Geçmiş</p>
          {past.map(o => card(o, false))}
        </>
      )}
    </div>
  );
}

function RestaurantDashboard({ onLogout, ownerMedia, setOwnerMedia, ownerRestaurant }) {
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
            <LogoUpload restaurant={ownerRestaurant} />
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
            {/* Turuncu zeminde yeşil-üstüne-yeşil okunmuyordu: beyaz kart,
                marka turuncusu yazı. */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}>
<Icon n="flame" color="#FF6600" size={18} />
              <div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#FF6600", margin: 0, lineHeight: 1 }}>%{stats.favRate}</p>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,102,0,0.75)", margin: 0 }}>Beğeni Oranı</p>
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
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: activeTab === tab.id ? 700 : 500, color: activeTab === tab.id ? "#FF6600" : "rgba(255,255,255,0.4)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {tab.label}
                  {/* Bekleyen talep sayısı: işletmenin ilk bakacağı yer */}
                  {tab.badge > 0 && (
                    <span style={{ minWidth: 15, height: 15, borderRadius: 8, background: "#FF3B30", color: "#fff", fontSize: 9, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{tab.badge}</span>
                  )}
                </span>
              </div>
            ))}
          </HScroll>

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
<div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(76,175,80,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="heart" color="#4CAF50" size={16} /></div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(76,175,80,0.8)", fontWeight: 600 }}>Sağ Kaydırma</span>
                  </div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "#4CAF50", margin: "0 0 2px" }}>{stats.swipeRight}</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>kişi beğendi</p>
                </div>
                {/* Sol kaydırma */}
                <div style={{ background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.15)", borderRadius: 20, padding: "18px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
<div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,59,48,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="cross" color="#FF3B30" size={16} /></div>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,59,48,0.8)", fontWeight: 600 }}>Sol Kaydırma</span>
                  </div>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "#FF3B30", margin: "0 0 2px" }}>{stats.swipeLeft}</p>
                  <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>kişi geçti</p>
                </div>
              </div>

              {/* Toplam görüntülenme */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "18px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
<div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,165,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="eye" color="#FFA500" size={18} /></div>
                  <div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 2px" }}>Toplam Görüntülenme</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", margin: 0 }}>{stats.totalViews.toLocaleString()}</p>
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
                  Görünürlüğünüzü artıran paketler. Rezervasyon ve menü ücretsizdir — GUR bunlardan komisyon almaz.
                </p>
              </div>

              {/* Faz 1 — reklam / sponsorluk */}
              <GrowthSection title="Reklam ve Sponsorluk">
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
                  title="Push Bildirim Reklamı" price="₺1.800 / gönderim" active={bought.push}
                  desc="Semtinizdeki kullanıcılara tek seferlik bildirim. Gönderim saatini siz seçersiniz."
                  onBuy={() => buy("push", "Push bildirim gönderimi planlandı")}
                />
              </GrowthSection>

              <GrowthSection title="Anlık Fırsat ve Rezervasyon">
                {(
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
                )}

                {(
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "16px 18px" }}>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Rezervasyon</p>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 14px", lineHeight: 1.5 }}>
                      Kullanıcı uygulamadan masa ayırtır, talep panelinize düşer. Ücretsizdir — GUR rezervasyondan komisyon almaz.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {[["Bu ay", "38"], ["Ciro", "₺52.400"], ["GUR payı", "₺0"]].map(([k, v]) => (
                        <div key={k} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "11px 12px" }}>
                          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.4)", margin: "0 0 3px" }}>{k}</p>
                          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </GrowthSection>

              <GrowthSection title="Gastro Paketi">
                <GrowthCard
                  title="Gastro Şef Videosu Paketi" price="₺13.200 / ay" active={bought.license}
                  desc="Tanınmış bir şef mekânınızda 15 sn dikey video çeker; video hem uygulamada galeride yayınlanır hem de kendi sosyal medyanızda süresiz kullanılır. Paketi alan mekan Gastro Onaylı kategorisine girer."
                  onBuy={() => buy("license", "Gastro paketi satın alındı")}
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
                      <img src={file.url} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
  // Yüklenen menü ve fotoğraflar: panelde girilen medya tüketici tarafına
  // da gidiyor (withOwnerMedia), o yüzden kökte duruyor.
  const [ownerMedia, setOwnerMedia] = useState({ photos: [], menu: [] });
  const [claimedRestaurant, setClaimedRestaurant] = useState(null);

  const ownerProfiles = useOwnerProfiles();
  // Yönetilen mekan: sahiplenilen kayıt, yoksa demo işletmesi. Liste
  // tüketici uygulamasıyla ortak (src/data/restaurants.js).
  const pool = useMemo(
    () => withOwnerMedia(RESTAURANTS, null, ownerMedia).map(r => applyOwnerProfile(r, ownerProfiles)),
    [ownerMedia, ownerProfiles]
  );
  const ownerRestaurant = useMemo(
    () => (claimedRestaurant
      ? pool.find(r => String(r.id) === String(claimedRestaurant.id)) || claimedRestaurant
      : findOwnerRestaurant(pool)),
    [pool, claimedRestaurant]
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
      case "dashboard": return <RestaurantDashboard onLogout={logout} ownerMedia={ownerMedia} setOwnerMedia={setOwnerMedia} ownerRestaurant={ownerRestaurant} />;
      default: return <DoyurucuAuthScreen
        onLogin={() => nav("login")} onRegister={() => nav("reg1")} onClaim={() => nav("claim")} />;
    }
  };

  return (
    <PhoneFrame>
      <GurStyles />
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
  );
}
