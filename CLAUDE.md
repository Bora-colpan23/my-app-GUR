# GUR — Proje Rehberi (Claude Code için)

Bu dosya Claude Code'un projeyi hızlıca anlaması içindir. GUR, İstanbul için **Tinder-tarzı restoran keşif platformu**dur.

## Ne inşa ediyoruz

Kullanıcılar restoranları kaydırarak keşfeder (sağa = favori, sola = geç). Ana farklılaştırıcı **Gastro Onaylı** sistemidir: tanınmış şefler restoranları onaylar, onaylılar rozet + öncelikli yerleşim alır. Gelir modeli restoran abonelikleridir (Premium/Pro/Ücretsiz).

Ürün üç arayüzden oluşur:
1. **Tüketici mobil uygulaması** — keşif, kaydırma, favoriler, detay, profil
2. **Doyurucu (restoran) paneli** — kayıt, doğrulama, dashboard, menü/fotoğraf yükleme
3. **Yönetici paneli** — başvuru onayı, Gastro yönetimi, moderasyon, gelir

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
```

- `/`       → Tüketici + Doyurucu uygulaması (telefon çerçevesi içinde önizlenir)
- `/admin`  → Yönetici paneli (tam ekran masaüstü)

Derleme: `npm run build` → `dist/`

## Proje yapısı

```
gur/
├── index.html                 # Giriş; Poppins fontu burada yüklenir
├── vite.config.js             # Vite + React eklentisi
├── package.json
└── src/
    ├── main.jsx               # React kökü + router (/ ve /admin)
    ├── app/
    │   └── GurApp.jsx         # TÜM tüketici + doyurucu uygulaması (tek dosya, ~2260 satır)
    └── admin/
        └── GurAdmin.jsx       # Yönetici paneli (tek dosya, ~730 satır)
```

## Mimari notlar (ÖNEMLİ)

### GurApp.jsx — tek dosyalık uygulama
- Tüm ekranlar tek dosyada ayrı fonksiyon bileşenleri: `SplashScreen`, `WelcomeScreen`, `LoginScreen`, `RegisterScreen`, `DoyurucuAuthScreen`, `DoyurucuLoginScreen`, `RestReg1/2/3`, `RestaurantDashboard`, `ExploreScreen`, `SwipeScreen`, `DetailScreen`, `FavScreen`, `ProfileScreen`.
- Ekran yönetimi: `GurApp` içinde `screen` state'i + `render()` switch'i. Navigasyon `nav(to)` / `back()` ile history stack üzerinden.
- Ortak bileşenler: `GurLogo` (pill logo), `Screen`, `PhoneFrame`, `Img`, `InputField`, `Btn`, `UploadBox`.
- Stil: **inline style** (CSS-in-JS yok, Tailwind yok). Renkler `GRAD = "#FF6600"` turuncu-kırmızı marka gradyanı.
- Animasyonlar: dosya sonundaki `<style>` bloğunda `@keyframes` (fadeInUp, badgeMarquee, spin, pulse).
- Font: **Poppins** (index.html'de yüklenir). Başka font kullanma.

### Canlı veri (OpenStreetMap)
- `fetchLiveRestaurants()` — Overpass API'den gerçek Kadıköy restoranlarını çeker (ücretsiz, API-key yok).
- Başarısız olursa sessizce mock `RESTAURANTS` verisine düşer.
- `dataSource` state'i "demo" | "live"; canlı ise Swipe ekranında yeşil rozet gösterilir.
- `CAT_MAP` OSM mutfak etiketlerini (turkish, sushi...) 13 kategoriye eşler.

### GurAdmin.jsx — yönetici paneli
- Koyu, veri-yoğun "operatör" arayüzü (GitHub/Linear estetiği). Renkler `C` nesnesinde.
- Sayfalar: `DashboardPage`, `RestaurantsPage`, `ApplicationsPage`, `GastroPage`, `UsersPage`, `ReviewsPage`, `RevenuePage`, `SettingsPage`.
- Tüm veriler mock (dosya başındaki sabitler). State'li aksiyonlar çalışır (onay, Gastro ver/al, askıya al).

## Görsel kurallar (bunlara uy)

- **Görseller**: `picsum.photos` kullan (Unsplash artifact'ta güvenilmez). URL formatı: `https://picsum.photos/seed/AD/600/400`.
- **Alt bar**: TÜM ekranlarda aynı olmalı — beyaz yuvarlak pill, kenarda ikon+yazı, ortada GUR pill logo. Inline (position:absolute değil).
- **Logo boyutları**: 42px pill (header/nav), 60-80px (giriş ekranları), 22-24px (dekoratif/alt bar), 110px (yalnızca splash).
- **Font**: her yerde Poppins, italic yok.
- **Menü**: görsel galeri olarak açılır (metin liste değil). Her restoranın `menu: [...]` alanı var.

## Sonraki adımlar (yapılabilecekler)

- Backend bağlantısı: Supabase veya Node+PostgreSQL (bkz. veri modeli, PRD'de).
- React Native sürümü ayrı bir projede mevcut (gur-mobile).
- GUR Match özelliği (arkadaşla birlikte kaydırma, eşleşme ekranı) — viral büyüme için.
- Ödeme entegrasyonu (iyzico/Stripe) abonelikler için.
- Yönetici girişi (şu an doğrudan /admin açılıyor).

## Bilinen kısıtlar

- Tüm veri mock/yerel; backend yok (kalıcılık yok, sayfa yenilenince sıfırlanır).
- Kimlik doğrulama gerçek değil (giriş ekranları herhangi bir değerle geçer).
- GurApp.jsx büyük tek dosya; istenirse ekranlar ayrı dosyalara bölünebilir.
