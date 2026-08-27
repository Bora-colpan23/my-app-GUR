# GUR

İstanbul için **Tinder-tarzı restoran keşif platformu**. Kullanıcılar restoranları kaydırarak keşfeder; tanınmış şeflerin onayladığı **Gastro Onaylı** restoranlar öne çıkar.

## Hızlı Başlangıç

```bash
npm install
npm run dev
```

Tarayıcı otomatik açılır: **http://localhost:5173**

| Yol | Arayüz |
|-----|--------|
| `/` | Tüketici + Doyurucu (restoran) uygulaması |
| `/admin` | Yönetici paneli |

## Komutlar

```bash
npm run dev       # Geliştirme sunucusu (hot reload)
npm run build     # Üretim derlemesi → dist/
npm run preview   # Derlemeyi yerel önizle
```

## Teknoloji

- **React 18** + **Vite** (hızlı geliştirme, hot reload)
- **React Router** (uygulama / yönetici paneli ayrımı)
- Inline style, **Poppins** font
- Canlı restoran verisi: **OpenStreetMap Overpass API** (ücretsiz)
- Harita/yol tarifi: **Google Maps** (link ile)

## Proje Yapısı

```
src/
├── main.jsx            # Router: / ve /admin
├── app/GurApp.jsx      # Tüketici + doyurucu uygulaması (tüm ekranlar)
└── admin/GurAdmin.jsx  # Yönetici paneli
```

Detaylı mimari ve geliştirme kuralları için **CLAUDE.md** dosyasına bakın.

## Özellikler

**Tüketici uygulaması**
- Kaydırmalı keşif (Tinder mekaniği), kategori filtreleme
- Restoran detayı: fotoğraf galerisi, yorumlar, görsel menü, konum
- Favoriler, profil

**Doyurucu (restoran) paneli**
- 3 adımlı kayıt + vergi levhası doğrulama
- Dashboard: istatistikler, yorumlar, menü/fotoğraf yükleme

**Yönetici paneli**
- Başvuru onayı (belge inceleme)
- Gastro Onaylı yönetimi, restoran/kullanıcı yönetimi
- Yorum moderasyonu, gelir takibi

## Yol Haritası

Bkz. `CLAUDE.md` → "Sonraki adımlar". Kısaca: backend (Supabase/Node), ödeme entegrasyonu, GUR Match, mobil (React Native).

## Notlar

Şu an tüm veri yerel/mock — backend yok. Kimlik doğrulama demo amaçlıdır. Kalıcı veri için backend bağlantısı gerekir (PRD'de veri modeli mevcut).
