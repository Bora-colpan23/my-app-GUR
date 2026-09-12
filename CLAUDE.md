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
3. **Yönetici paneli** — başvuru ve sahiplenme onayı, mekan havuzu, Gastro
   yönetimi, kampanyalar, fiyatlandırma, kohort/LTV
4. **Sunucu** — mekan beslemesi, swipe motoru, bildirim cron'ları, analitik toplama

## Çalıştırma

```bash
npm install
npm run db:setup && npm run db:seed   # PostgreSQL + şema + tohum veri
npm run dev:all                       # API (8787) + arayüz (5173)
```

Yalnız arayüz: `npm run dev`. Yalnız API: `npm run dev:api`.

- `/`         → Tüketici uygulaması (telefon çerçevesi yalnızca masaüstünde)
- `/isletme`  → Doyurucu: işletme uygulaması (kendi girişi, kendi oturumu)
- `/admin`    → Yönetici paneli (tam ekran masaüstü)

Tohumlanan hesaplar: yönetici `admin` / `gur2026`, tüketici
`demo@gur.app` / `gur1234`.

Derleme: `npm run build` → `dist/`. Lint: `npm run lint` (src + server + shared).

**Artifact önizlemesi:** `npm run artifact` → `dist/gur-preview.html` (tek dosya).
Elle derlemeyin: yönetici paneli `src/main.jsx` içinde `React.lazy` ile
yükleniyor, tek dosyalık artifact o ayrı chunk'ı bulamaz ve panel açılmaz.
Betik `GUR_ARTIFACT=1` ile tek parça derliyor ve çıktıda birden fazla JS
dosyası kalırsa hata veriyor.

### İki mod: canlı ve yerel

Uygulama açılışta `/api/health` yoklar ve sağ üstte hangi modda olduğunu
gösterir:

- **CANLI** — sunucu ayakta. Kimlik, deste, kaydırma, ziyaret, yorum ve
  sahiplenme PostgreSQL'e yazılır; kota ve kampanya ücretlendirmesi sunucuda.
- **YEREL** — sunucu yok (artifact önizlemesi, çevrimdışı). Aynı akışlar
  localStorage üzerinde yürür, hiçbir ekran kilitlenmez.

Dallanma tek yerde: `src/lib/backend.js`. Ekranlar "sunucu var mı" diye
sormaz, bu cepheyi çağırır.

## Proje yapısı

```
gur/
├── index.html                 # Giriş; fontlar bloke etmeden yüklenir
├── shared/                    # İSTEMCİ VE SUNUCUNUN ORTAK KULLANDIĞI SAF MODÜLLER
│   ├── deck.js                # buildDeck / rankCampaigns / quotaState
│   └── deeplink.js            # harita derin bağlantıları, Haversine
├── server/                    # Node tarafı (bkz. server/README.md)
│   ├── index.js               # giriş: HTTP + cron + ilk besleme
│   ├── db/setup.sh            # rol + veritabanı + eklenti + şema
│   ├── db/schema.sql          # tam şema (tek migration, 26 tablo)
│   ├── db/seed.js             # tohum veri; önce gerçek beslemeyi dener
│   ├── db/queries/cohorts.sql # retention / kohort / LTV toplama sorguları
│   └── src/
│       ├── http/{server,routes}.js   # çerçevesiz router + API uçları
│       ├── auth/{session,password,social}.js
│       └── {ingestion,swipe,visits,notifications,analytics}/, cron.js
└── src/
    ├── main.jsx               # React kökü + router; /isletme ve /admin ayrı parçada
    ├── data/restaurants.js    # MEKAN HAVUZU — üç uygulamanın ortak verisi
    ├── ui/
    │   ├── kit.jsx            # ortak buton/ikon/alan/yüzey + stil bloğu
    │   └── sheets.jsx         # aşağı sürüklenip kapanan sayfalar
    ├── lib/
    │   ├── api.js             # API istemcisi + mod ölçümü
    │   ├── backend.js         # canlı/yerel cephesi — tek dallanma noktası
    │   ├── analytics.js       # rıza kapılı GA4 + ürün olay akışı
    │   ├── visits.js          # konum doğrulamalı ziyaret (sunucu kurallarının aynısı)
    │   ├── b2b.js             # sahiplenme başvuruları + işletmenin girdiği alanlar
    │   ├── campaigns.js       # demo kampanya envanteri
    │   └── social-auth.js     # Google / Apple ile giriş
    ├── app/GurApp.jsx         # Tüketici uygulaması
    ├── business/GurBusiness.jsx  # Doyurucu: işletme uygulaması
    └── admin/GurAdmin.jsx     # Yönetici paneli
```

## Mimari notlar (ÖNEMLİ)

### Üç uygulama, tek veri katmanı
Tüketici, işletme ve yönetici ayrı uygulamalar ama aynı kayıtları okuyup
yazıyorlar. Bağ ekranlarda değil depolarda:

| Depo | Yazan | Okuyan |
|---|---|---|
| `lib/b2b.js` | işletme (bilgi, menü, foto, **logo**) | tüketici kaydı, yönetici listesi |
| `lib/platform.js` | yönetici (özellik kapıları) | tüketici ve işletme |
| `lib/reservations.js` | tüketici (talep) → işletme (karar) | tüketici (bildirim) |
| `lib/pricing.js` | yönetici (teklif) → işletme (karar) | yönetici gelir tabloları |
| `lib/ad-frequency.js` | tüketici (gösterim) | deste kurulumu |
| `data/restaurants.js` | tohum/besleme | üçü de |

Bir mekanın kimliği tek yerde: `account` alanı işletmenin hesabı olup
olmadığını söyler. Hesabı olmayan (yalnız dış beslemeden gelen) mekanlar
fiyatlandırma panelinde görünmez — teklif gönderilecek muhatap yoktur.

### Telefon çerçevesi yalnızca masaüstünde
390×844'lük maket bir **önizleme kabuğu**. Gerçek telefonda `.gur-stage` ve
`.gur-frame` üstündeki medya kuralı devreye girer: çerçeve, gölge, köşe
yarıçapı ve sahte çentik kalkar, uygulama `100dvh` ile ekranı kaplar. Aksi
hâlde ekranda ikinci bir telefon çiziliyor, sahte çentik gerçeğinin altına
düşüyor ve 844px'lik kutu kısa ekranları taşırıyordu.

Kurallar `!important` — uygulama satır içi stille yazılı ve satır içi stil
sınıf kuralını yener; tersini yapmanın tek yolu bu.

### Yazı tipi: jetondan oku
`--f-display` (Poppins) ve `--f-body` (Outfit) `GurStyles` içinde tanımlı;
kodda `fontFamily: "var(--f-body)"` yazılır, aile adı elle yazılmaz. Yedek
zincirde `system-ui` var: yazı tipi gelene kadar iOS'ta San Francisco,
Android'de Roboto çizilir — genel `sans-serif` iki platformda iki ayrı
yazı tipi seçiyordu.

Her iki aile de **index.html'den** yüklenir. `GurStyles` içine `@import`
yazmayın: `@import` bir stil sayfasında ilk sırada olmak zorundadır, oradaki
`:root` kuralından sonra geldiği için tarayıcı sessizce atar (Outfit uzun
süre bu yüzden hiç yüklenmedi).

### Metin alanları 16px
iOS Safari 16px'ten küçük bir alana odaklanınca sayfayı yakınlaştırır ve
düzen bozulur. `input`/`textarea`/`select` taban ölçüsü 16px; satır içinde
daha küçük yazmayın.

### Renk paleti: tek açık tema
Uygulamanın tek bir açık teması var; koyu tema **bilinçli olarak yok**.
Uygulama satır içi stille yazıldığı için renkler yine CSS değişkenlerinden
okunuyor (`src/ui/kit.jsx` → `GurStyles`): satır içi stil sınıf kuralını
yener ama `var()` değerini okur. Böylece palet tek yerden değişir.

Yeni renk yazarken **jeton kullan**: `var(--c-card)`, `var(--c-ink)`,
`var(--c-ink-2)`, `var(--c-muted)`, `var(--c-border)`, `var(--c-subtle)`.
Sabit `#fff` yalnızca turuncu/koyu zemin üstündeki metin ve ikonlar için.
Yönetici paneli kendi jeton kümesini taşır (`GurAdmin.jsx` → `C`), ama o da
açık: koyu masaüstü sürümü kaldırıldı.

### Gölge: tek katman yok
Her gölge **üç katmandan** oluşur — dar ve yakın olan temas çizgisini,
geniş ve soluk olan yayılan ışığı taşır. Kurallar:

- Kaydırma **yalnızca dikey** (ışık tepeden). Yana kaçan gölge nesneyi
  eğri durur gibi gösteriyor.
- Bulanıklık kaydırmadan belirgin biçimde büyük.
- Her katman düşük opaklıkta (0.03–0.09), toplamı yumuşak bir yükseklik
  veriyor — sert kenarlı koyu bir leke değil.
- Renk **zeminin tonunda**: saf siyah, kremsi kâğıdın (#FDFBF7) üstünde
  gri duruyor. Uygulama sıcak (`--sh-tint: 45, 36, 25`), yönetici paneli
  soğuk (`rgba(15,18,25,…)`), turuncu yüzeyler turuncu (`--sh-brand`).
- Basılınca gölge **kısalır**, içeri dönmez: nesne kâğıda yaklaşır,
  yüzey çukurlaşmaz.

Ölçek `GurStyles` içinde: `--sh-1` … `--sh-4` (açık kâğıt), `--sh-d1` …
`--sh-d4` (fotoğraf ve koyu zemin), `--sh-brand` / `--sh-brand-lg` /
`--sh-brand-sm`, ve aşağıdan yükselen sayfa için `--sh-up`. Adlandırılmış
karşılıkları `ELEV` üzerinden okunur. Yönetici paneli kendi stil bloğunu
taşıdığı için aynı ölçeği JS'te tutar (`GurAdmin.jsx` → `SH`).

**Satır içine gölge yazmayın** — ölçekten okuyun.

### "One" buton dili
Bütün haplar tek tarifte: tam yuvarlak (`999`), kalın yazı (700), rengine
göre tonlanmış **dar** bir düşüş gölgesi, basılınca hem küçülme hem gölgenin
kısalması. İçeriden parlayan `inset` gölgeler kaldırıldı.

`src/ui/kit.jsx` → `Btn` varyantları:

| Varyant | Nerede |
|---|---|
| `filled` | turuncu birincil eylem |
| `ink` | siyah hap — turuncuyla yarışmadan birincil olabilen tek renk |
| `onColor` | turuncu zemin üstünde beyaz hap |
| `outlineDark` | beyaz zemin üstünde beyaz hap + ince kenarlık |
| `brandSoft` / `successSoft` / `destructiveSoft` | %10 tonlu zemin, renkli kalın yazı |
| `outline` / `plain` / `plainDark` | kenarlıklı ve düz metin hapları |

İki ek yuva: `trailing` bir simgeyi yuvarlak cebe alır (referanstaki
"Download ⬇"), `count` hapın içine küçük bir sayaç rozeti koyar ("Done ①").

Devre dışı hap **soluklaştırılmaz**: uygulamada kendi rengini koruyup geri
çekilir, yönetici panelinde gri hapa döner. `opacity: 0.42 + grayscale`
beyaz yazıyı okunmaz bırakıyordu.

### Yönetici panosu: One düzeni
Panel açık gri kâğıt (`C.bg`) üzerinde beyaz kartlar. Üç imza parçası
`GurAdmin.jsx` içinde:

- `Segmented` — gri kanal, seçili seçenek beyaz hap. Dönem ve zaman aralığı
  seçimlerinin tamamı bundan geçer ve **gerçekten veri değiştirir**
  (`TREND_RANGES`), yalnızca etiket değiştirmez.
- `TrendChart` — tek serili çizgi + solan alan, imleçle nişangâh ve koyu
  ipucu kutusu. Tek seri olduğu için gösterge kutusu yok; her noktaya sayı
  yazılmaz, yalnızca tepe noktası etiketlidir.
- `Sparkline` — tablo satırının 24 saatlik eğilimi. Renk tek başına bilgi
  taşımaz: yanındaki sütun yüzdeyi ↗/↘ ile de yazar.

Sayı sütunları `NUM` yayılımını kullanır (sistem mono + `tabular-nums`):
rakamlar hizalanır, ek font isteği gitmez.

### Erişilebilirlik kuralları (uyulacak)
- Alan etiketleri `htmlFor` ile bağlı (`InputField`), `<label>` süs değil.
- Bildirim ve geri bildirim yüzeyleri `role="status" aria-live="polite"`.
- Sayfalar (sheet) `role="dialog" aria-modal`, ekranlar `<main>`.
- Görseller anlamlı `alt` alır; süs görsel `alt=""`.
- Gri tonlar WCAG AA'ya göre: `--c-muted` beyaz üstünde 4.6:1.
- Renk tek başına bilgi taşımaz — ısı haritasında kutunun içinde yüzde de yazar.

### Karanlık kalıp yok
- Rıza kutusunda iki seçenek **aynı** görsel ağırlıkta; reddetmek kabul
  etmek kadar kolay.
- Kota teklifinde ücretsiz yol (reklam izle) ve çıkış görünür; satın alma
  tek belirgin seçenek değil.
- Ödüllü reklamda "Vazgeç" her zaman görünür.
- Hesap silme tek onayla ulaşılabilir (roach motel yok).

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
- Font: **Poppins** + **Outfit**, jetondan: `var(--f-display)` / `var(--f-body)`.
  Başka font kullanma. Sayı sütunlarında sistem mono (yönetici: `FM`).

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

- **Push taşıması yok.** Bildirim kuyruğu, tavan, sessiz saat ve tekrar
  engelleme çalışıyor; `server/index.js` içindeki `push` konsola yazıyor.
  APNs/FCM sarmalayıcısı oraya verilecek.
- **Google/Apple girişi anahtar bekliyor.** Akış ve sunucu tarafı doğrulama
  hazır; `VITE_GOOGLE_CLIENT_ID` / `APPLE_SERVICE_ID` tanımsızken düğmeler
  demo profiliyle tamamlanır ve bunu ekranda söyler.
- **Besleme dış ağ ister.** Anahtarsız OSM yolu bile giden HTTPS gerektirir;
  kapalı ağda tohum listesi devreye girer.
- **Ödeme entegrasyonu yok** (iyzico/Stripe). GUR Plus ve işletme abonelikleri
  arayüzde var, tahsilat yok.
- Yasal metinlerdeki işletme bilgileri yer tutucu; yayına çıkmadan doldurulmalı.
- Artifact önizlemesi tanımı gereği YEREL modda çalışır: statik tek dosya,
  arkasında sunucu yok.
