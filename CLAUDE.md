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
    │   ├── badges.js          # rozet kataloğu + atamalar (Gastro + editoryal)
    │   ├── invites.js         # havuz daveti: kanal seçimi + mailto taslağı
    │   ├── geo.js             # konum izni, elle ilçe seçimi, başlangıç noktası
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
| `lib/badges.js` | yönetici (editoryal rozet) | tüketici kartı, kaydırma, detay |
| `lib/invites.js` | yönetici (havuz daveti) | yönetici havuz listesi |
| `lib/geo.js` | tüketici (izin / seçilen ilçe) | deste sıralaması, konum çipi |
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

### Turuncu zeminde yazı BEYAZ (ürün kararı)
Tabanı turuncu olan her yüzeyde metin beyaz. Bu **bilinçli bir tercih** ve
bedeli ölçüldü: beyaz `#FF6600` üstünde **2.94:1**, marka gradyanının açık
ucunda (`#FF7A1A`) **2.61:1** — WCAG AA eşiği 4.5'in altında. Denetleme
betiği bu yüzden 21 uyarı veriyor ve **hepsi budur**; başka kaynaklı tek
bir kontrast hatası yok. Listeyi bu şekilde okuyun: sıfır beklemeyin,
21 bekleyin, 22 olursa yeni bir hata girmiş demektir.

Geçirmenin tek yolu metin taşıyan turuncu yüzeyi koyultmaktı
(`#C24B00`, beyazla 4.88:1) — marka turuncusu o zaman kiremite dönüyor,
onun yerine turuncu korundu.

| Jeton | Nerede |
|---|---|
| `--c-on-brand` | turuncu DOLGU üstünde ana metin (`#fff`) |
| `--c-on-brand-2` | turuncu üstünde ikincil metin (`rgba(255,255,255,0.86)`) |
| `--c-brand-ink` | kâğıt üstünde turuncu METİN — 5.02:1, AA geçer |

Kâğıt üstünde `#FF6600`'ı metin rengi olarak **kullanma** — `--c-brand-ink`
var. Turuncu zeminde elle `#fff` **yazma** — `--c-on-brand` var; jetondan
okumak paletin tek yerden değişmesini sağlıyor.

Aynı kural durum renklerinde: parlak ton dolgu, koyu ton yazı.
`--c-ok` / `--c-ok-ink` / `--c-ok-on`, `--c-bad` / `--c-bad-ink`; panelde
`C.orangeInk`, `C.greenInk`, `C.redInk`, `C.yellowInk`, `C.onBrand`.

**Pasif durumu `opacity` ile kurma.** `opacity: 0.4` bir etiketi ~2:1'e
düşürüyordu ve denetimden de kaçıyordu. Aktif/pasif farkı renkle: pasif
`--c-muted` (5.6:1), aktif marka mürekkebi.

Denetleme betiği ata zincirindeki opaklığı ve fotoğraf perdesini hesaba
katarak on ekranı tarıyor; GUR kelime markası (tek harfli G/U/R) logotype
olduğu için kural dışı.

### Renkle hiyerarşi
Renk **yalnızca aktif ve birincil olanda** kalır; gerisi nötr. Keşfet
ekranında dokuz ayrı turuncu vardı (konum iğnesi, arama çubuğundaki eylem,
"Tümü", "Kaydırarak gez", kategori halkaları, ızgara simgesi, "Aç" çipi,
alt bar, Match şeridi) — hepsi doygun olunca hiçbiri birincil olmuyordu.

Turuncu kalanlar: **alt bardaki seçili sekme**, **GUR Match şeridi** (öne
çıkarılan tek özellik) ve **marka logosu**. Süs simgeler, bölüm bağlantıları
ve seçili olmayan kategori halkaları `--c-ink-2` / `--c-line`.

Bir **durum**u marka rengiyle gösterme: "Aç" çipi marka gradyanı taşıyordu,
şimdi yeşil ailesinde — durum bilgisi eylem gibi görünmüyor.

Ölçüt: bir ekranda ekranda görünen doygun renk sayısı tek haneli kalmalı ve
her rengin tek bir işi olmalı.

### Tutarlı renk seçimi
Her rolün **tek** bir rengi var. Aynı işi yapan dokuz ayrı yeşil
(`#4CAF50`, `#4ADE80`, `#22C55E`, `#16A34A`, `#166534`, `#22A34D`,
`#2F8C46`…), altı kırmızı ve dört amber arayüzü tutarsız gösteriyordu.
Süper beğeni etiketi de paletin dışında bir gök mavisiydi (`#38BDF8`) —
tek yabancı ton oydu, marka turuncusuna alındı.

Her rol iki zemin için iki ton taşır — `-ink` açık kâğıt, `-light` koyu
zemin ve fotoğraf için:

| Rol | Dolgu | Açık zemin | Koyu zemin | Yumuşak |
|---|---|---|---|---|
| olumlu | `--c-ok` | `--c-ok-ink` | `--c-ok-light` | `--c-ok-soft` |
| olumsuz | `--c-bad` | `--c-bad-ink` | `--c-bad-light` | `--c-bad-soft` |
| uyarı / puan | `--c-warn` | `--c-warn-ink` | `--c-warn-light` | `--c-warn-soft` |
| marka | `#FF6600` | `--c-brand-ink` | `--c-brand-light` | `--c-brand-soft` |

Yeni bir yeşil/kırmızı/amber **yazma** — ailede zaten var. Marka gradyanına
tehlike kırmızısı karıştırma: `#FF7A1A → #F04E00` turuncunun kendi iki ucu.

Kural dışı olanlar: GUR kelime markasının harfleri (`#FFA500`/`#FF6600`/
`#FF0000`), Google'ın marka renkleri ve sponsorlu reklam verisindeki
reklamveren aksanları (`SPONSORED[].accent`).

### Tonlu griler
Nötr gri (`#ccc`, `#bbb`, `#333`, `#aaa`…) kremsi kâğıdın ve sıcak
fotoğrafların yanında ölü duruyor. Hepsi paletin sıcak ekseninde:
`--c-warm-1` … `--c-warm-4`, `--c-warm-ink`, `--c-warm-dark`. Panelin
kâğıdı soğuk olduğu için oradaki griler soğuk eksende (`C.dim`, `C.faint`).

Dikkat: `--c-warm-3` / `--c-warm-4` **koyu zemin için**. Açık kâğıtta
okunmazlar — orada `--c-muted` kullan.

### Tonlarla vurgu
Sıralı bir büyüklüğü altı ayrı renkle değil, tek rengin tonlarıyla göster.
`CAT_DIST` altı ayrı turuncu-kırmızı-amber karışımıydı; şimdi tek bir
turuncu rampa, "Diğer" toplama kalemi olduğu için rampanın dışında nötr.

### Doğal gradyanlar
İki duraklı siyah→saydam geçişi ortada gri bir pus ve bittiği yerde görünür
bir kesim bırakıyor: alfa doğrusal artıyor, algılanan parlaklık öyle
artmıyor. `scrim(peak, end%, floor)` (`src/ui/kit.jsx`) durakları yumuşatma
eğrisine oturtuyor. Fotoğraf üstüne elle `linear-gradient` yazma.

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

### Konum: giriş biter bitmez sorulur
Kimlik akışı (`login` / `register`) bittiğinde ekran **doğrudan Keşfet'e
gitmez**: `afterAuth()` önce `geo.consentAsked()` bakar, hiç sorulmadıysa
`location` ekranına götürür. Tarayıcının izin kutusu deste kurulurken
habersiz açılmasın diye niyet önce yazıyla anlatılıyor.

Üç yol da eşit ağırlıkta (karanlık kalıp yok): **Konumumu kullan**,
**İlçemi seçeyim**, **Şimdi değil**.

İzin reddedilirse akış tıkanmaz — `src/lib/geo.js` iki ayrı başlangıç
noktası tanıyor:

| `source` | Nereden | Ne zaman |
|---|---|---|
| `device` | Geolocation API | izin verildi |
| `manual` | `DISTRICTS` listesinden seçilen ilçe | izin yok/reddedildi |

`origin()` ikisini de döndürür, `hasOrigin()` ikisini de sayar; sıralama
kodu hangisi olduğunu bilmez. Seçim `gur.geo.choice` altında saklanır ve
açılışta `restore()` ile geri yüklenir.

**Sol üstteki konum çipi bir düğmedir.** Dokununca `LocationSheet` açılır:
izni tekrar isteyebilir ya da ilçeyi değiştirebilirsin. Reddeden kullanıcı
tarayıcı ayarlarına gitmeden geri dönebilsin diye bu yol her ekranda
duruyor. Çipin üst satırı durumu söyler: "Konumun" / "Seçtiğin ilçe" /
"Konum kapalı".

Ham koordinat hiçbir yere gönderilmez; ekran da bunu yazar.

### Rozetler: bir mekanda birden fazla nişan
`src/lib/badges.js` altı rozetlik bir katalog taşıyor. **Gastro Onaylı
kaydın kendi alanı** (`r.gastro`) olarak kalıyor — bağımsız şef
değerlendirmesine dayanıyor ve satın alınamıyor. Diğer beşi (Günün
Restoranı, Haftanın Keşfi, Editör Seçimi, Yeni Açıldı, Semtin Favorisi)
yönetici panelinden elle veriliyor ve **ayrı depoda** (`gur.badges`):
besleme kaydı tazelediğinde editoryal karar silinmesin.

`badgesOf(r, map)` ikisini birleştirip **katalog sırasında** döndürür —
rozetler her ekranda aynı sırada görünür.

Üç gösterim, üçü de aynı katalogdan:

| Bileşen | Nerede | Ne gösterir |
|---|---|---|
| `BadgeChips` | Keşfet listesinde fotoğraf üstünde | doygun dolgu + beyaz kısa ad |
| `BadgeChips onLight` | detay sayfasında adın altında | yumuşak zemin + koyu mürekkep, **tam ad** |
| `BadgeMarks` | kaydırma kartında ismin yanında | renkli disk içinde yalnız simge |

Kurallar:
- **Aynı rozeti bir kartta iki kez çizme.** Kaydırma kartında rozet yalnız
  ismin yanında; fotoğrafın üstündeki çip oradan kaldırıldı.
- `BadgeMarks` **diskin içinde**. Çıplak simge çizilince Gastro'nun yıldızı,
  hesabın doğrulandığını söyleyen `VerifiedStar` ile tek şey gibi okunuyordu.
  Sıra: isim → rozetler → `VerifiedStar`.
- Nişan sayısı **üçle sınırlı** (`max`); tamamı detayda adlarıyla yazılı.
- Rozetin rengi paletin durum ailesinden; **yeni bir yeşil/amber/kırmızı
  tanımlama**. Katalogda `hex`/`hexInk` de var: yönetici paneli `GurStyles`
  render etmediği için orada `var()` çözülmez.

### Havuz daveti: e-posta nereden geliyor
`src/lib/invites.js`. Burada iki şeyi doğru bilmek gerekiyor:

- **Google Places API e-posta DÖNDÜRMEZ** — böyle bir alanı yok. Havuzdaki
  adresler mekanın kendi bildirdiği OSM `email` / `contact:email`
  etiketinden geliyor (`osmToRestaurant` bunları okuyor) ve çoğu kayıtta yok.
- **Projede posta taşıması yok** (SMTP/nodemailer kurulu değil). Bu yüzden
  davet, yöneticinin kendi posta istemcisinde hazır bir taslak olarak
  açılıyor (`mailto:`) — gönderildi numarası yapmıyoruz.

`channelOf(r)` sırayla e-posta → site → telefon bakar ve düğme dört
durumdan birini çizer: **E-posta ile davet et** / **Siteden ulaş** /
**iletişim bilgisi yok** (pasif) / **Davet edildi**. Kim, ne zaman, hangi
adrese — hepsi `gur.invites` altında; gerçek dağıtımda buranın yerine
sunucuda bir kuyruk gelir, arayüz değişmeden.

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
- **Posta taşıması yok.** Havuz daveti `mailto:` ile yöneticinin posta
  istemcisinde taslak açıyor; sunucudan giden posta yok. Ayrıca Google
  Places API e-posta alanı döndürmüyor — adresler OSM etiketlerinden
  geliyor ve çoğu kayıtta yok.
- **Ödeme entegrasyonu yok** (iyzico/Stripe). GUR Plus ve işletme abonelikleri
  arayüzde var, tahsilat yok.
- Yasal metinlerdeki işletme bilgileri yer tutucu; yayına çıkmadan doldurulmalı.
- Artifact önizlemesi tanımı gereği YEREL modda çalışır: statik tek dosya,
  arkasında sunucu yok.
