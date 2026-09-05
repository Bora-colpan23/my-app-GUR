# GUR — Proje Rehberi (Claude Code için)

Bu dosya Claude Code'un projeyi hızlıca anlaması içindir. GUR, İstanbul için
**Bumble mekaniğine dayalı restoran keşif platformu**dur.

## Ne inşa ediyoruz

Kullanıcılar restoranları kaydırarak keşfeder: **sağa** = kaydet, **sola** = geç,
**yukarı** = "hemen gitmek istiyorum" (süper beğeni). Karta dokununca detay ayrı
bir ekrana gitmez — kartın üstünde genişleyebilir bir sayfa olarak açılır.

Ana farklılaştırıcılar:
- **Gastro Onaylı**: tanınmış şefler restoranları onaylar, rozet + öncelikli yerleşim.
- **Konum doğrulamalı yorum**: mekânda yeterince kalan kullanıcıya "deneyim nasıldı"
  bildirimi gider ve yorum kilidi açılır; yorum "Konumla doğrulandı" rozeti alır.
- **B2B ekosistem**: mekan havuzu dış API'lerden otomatik dolar, işletme kendi
  kaydını sahiplenir (claim), doldurmadığı alanlar API'den gelmeye devam eder.

Gelir modeli tek ve bütüncül bir sistemdir — **aşamalı faz yapısı kaldırıldı**:
- Organik akışa harmanlanan sponsorlu kartlar (CPC/CPE açık artırma)
- İşletme abonelikleri (Ücretsiz / Premium / Pro)
- Rezervasyon ve anlık fırsat komisyonu
- Ödüllü video reklam ve GUR Plus tüketici aboneliği

Ürün dört arayüzden oluşur:
1. **Tüketici mobil uygulaması** — keşif, kaydırma, detay sayfası, favoriler, profil
2. **Doyurucu (B2B) paneli** — sahiplenme, bilgi/menü/fotoğraf yönetimi, etkileşim analizi
3. **Yönetici paneli** — başvuru ve sahiplenme onayı, Gastro yönetimi, kampanyalar, kohort/LTV
4. **Sunucu** — mekan beslemesi, swipe motoru, bildirim cron'ları, analitik toplama

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
```

- `/`       → Tüketici + Doyurucu uygulaması (telefon çerçevesi içinde önizlenir)
- `/admin`  → Yönetici paneli (tam ekran masaüstü, demo giriş: `admin` / `gur2026`)

Derleme: `npm run build` → `dist/`. Lint: `npm run lint`.

Sunucu ayrı kurulur — bkz. `server/README.md`.

## Proje yapısı

```
gur/
├── index.html                 # Giriş; fontlar bloke etmeden yüklenir
├── shared/                    # İSTEMCİ VE SUNUCUNUN ORTAK KULLANDIĞI SAF MODÜLLER
│   ├── deck.js                # buildDeck / rankCampaigns / quotaState
│   └── deeplink.js            # harita derin bağlantıları, Haversine
├── server/                    # Node tarafı (ayrı kurulum, bkz. server/README.md)
│   ├── db/schema.sql          # tam şema (tek migration)
│   ├── db/queries/cohorts.sql # retention / kohort / LTV toplama sorguları
│   └── src/{ingestion,swipe,visits,notifications,analytics,auth}, cron.js
└── src/
    ├── main.jsx               # React kökü + router; /admin ayrı parçaya alındı
    ├── lib/
    │   ├── analytics.js       # rıza kapılı GA4 + ürün olay akışı
    │   ├── visits.js          # konum doğrulamalı ziyaret (sunucu kurallarının aynısı)
    │   ├── b2b.js             # sahiplenme başvuruları + işletmenin girdiği alanlar
    │   ├── campaigns.js       # demo kampanya envanteri
    │   └── social-auth.js     # Google / Apple ile giriş
    ├── app/GurApp.jsx         # TÜM tüketici + doyurucu uygulaması (tek dosya)
    └── admin/GurAdmin.jsx     # Yönetici paneli (tek dosya)
```

## Mimari notlar (ÖNEMLİ)

### `shared/` — tek doğruluk kaynağı
`buildDeck` ve `directionsUrl` hem sunucu hem istemci tarafından çağrılır.
Yerleşim hissi ve harita bağlantı formatı iki yerde ayrı tutulursa biri
sessizce bozulur; bu yüzden saf ve ortak.

### Kota istemciye sayı olarak GÖNDERİLMEZ
`quotaState` yalnızca `pressure: "free" | "near" | "exhausted"` döndürür.
Arayüzde "kalan hakkın: 12" gibi bir ibare **bilinçli olarak yoktur**;
sınıra yaklaşınca sıcak bir vinyet, dolunca `PremiumOffer` açılır.

### Sponsorlu kart organik kartla aynı nesnedir
`buildDeck` yalnızca `sponsored` alanını ekler. `SwipeCard` iki durumu ayırt
etmez, yalnızca küçük bir rozet çizer. Aralık 5-7 arasında rastgeledir —
sabit aralık kullanıcı tarafından fark ediliyor.

### GurApp.jsx — tek dosyalık uygulama
- Ekran yönetimi: `screen` state'i + `render()` switch'i; gezinme `nav()`/`back()`.
  `nav()` bir tarayıcı kaydı iter, geri dönüş tek yoldan `popstate` ile işlenir
  (cihazın donanım geri tuşu böylece çalışır).
- Ortak bileşenler: `GurLogo`, `Screen`, `PhoneFrame`, `Img`, `InputField`, `Btn`,
  `IconBtn`, `Sheet`, `DangerConfirm`, `SocialAuthRow`, `CardDetailSheet`.
- Stil: **inline style** (CSS-in-JS yok, Tailwind yok). `GRAD = "#FF6600"`.
- Hareket: Motion (`motion/react` + imperatif `animate`). Springler Apple HIG'e
  göre: damping 1.0 varsayılan, momentum taşıyan hareketlerde bounce 0.2.
- Font: **Poppins** + **Outfit**. Başka font kullanma.

### Konum doğrulamalı ziyaret
`src/lib/visits.js` ve `server/src/visits/tracker.js` **aynı kuralları** taşır:
120 m yarıçap, 15 dk kalış, 100 m'den iyi hassasiyet. Ham konum hiçbir yerde
saklanmaz — yalnızca mesafe/süre özeti. Önizlemede test edilebilmesi için
"Demo: bu mekânda olduğumu varsay" yolu var (`accelerate` bayrağı).

### İşletme verisi: API mi, işletme mi
`src/lib/b2b.js` → `applyOwnerProfile` işletmenin girdiği alanı dış kaynağın
üstüne yazar; girilmeyen alan API'den gelir. Panelde her alanın yanında
"İŞLETMEDEN" / "API'DEN" rozeti bunu gösterir.

### Canlı veri
`fetchLiveRestaurants()` Overpass API'den gerçek Kadıköy restoranlarını çeker
(ücretsiz, anahtarsız, istemci tarafı iptal zaman aşımlı). Başarısız olursa
sessizce mock `RESTAURANTS` verisine düşer. Sunucu tarafında havuz ayrıca
Google Places + Foursquare + Tripadvisor + OSM'den cron ile beslenir.

## Görsel kurallar (bunlara uy)

- **Görseller**: `picsum.photos`. Küçük kutularda `<Img box={46}>` ver — kaynak
  o ölçüde istenir.
- **Alt bar**: TÜM ekranlarda aynı — beyaz pill, kenarda ikon+yazı, ortada GUR pili.
- **Logo boyutları**: 42px (header/nav), 60-80px (giriş), 22-24px (dekoratif), 110px (splash).
- **Dokunma hedefi**: en az 44×44pt. Küçük ikon butonlar görsel boyutunu korur,
  `.gur-icon-btn::after` ile hedef büyür.
- **Menü**: görsel galeri olarak açılır (metin liste değil).

## Bilinen kısıtlar

- Frontend tarafında veri mock/yerel; `server/` ayrı kurulmadıkça kalıcılık yok.
  (Ziyaretler, sahiplenme başvuruları ve rıza localStorage'da tutulur.)
- Kimlik doğrulama gerçek değil. Google/Apple akışı istemci kimliği tanımlanınca
  gerçek SDK'ya geçer; belirteç doğrulaması sunucuda (`server/src/auth/social.js`).
- Yönetici girişi istemci tarafında — **güvenlik sınırı değildir**, sunucu auth şart.
- Yasal metinlerdeki işletme bilgileri yer tutucu; yayına çıkmadan doldurulmalı.
