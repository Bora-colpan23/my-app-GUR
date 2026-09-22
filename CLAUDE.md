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
- İşletmenin **tek tek satın aldığı** ücretli özellikler (banner, push, ödüllü
  video, anlık fırsat, İkinci Şans paketi, Gastro şef videosu)
- Ödüllü video reklam ve GUR Plus tüketici aboneliği

**İŞLETME ABONELİĞİ YOK.** Premium / Pro / Ücretsiz kademesi kaldırıldı; bir
işletmenin ödediği tutarın tamamı satın aldığı kalemlerden gelir. Plana bağlı
"tam görünürlük / öncelikli yerleşim" diye bir mekanizma da yok — görünürlük
tek yerden yönetiliyor (restoran bazlı görünürlük anahtarı).

**REZERVASYON KOMİSYONU YOK.** Masa ayırtma tamamen ücretsiz ve yalnızca
kaydını **sahiplenmiş** işletmelerde açık: sahipsiz bir mekan adına söz
veremeyiz. Kapı hem arayüzde hem sunucuda (`POST /api/reservations`).

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
│   ├── second-chance.js       # paket kotası ve günlük tekrar engeli
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
    │   ├── moderation.js      # yayın öncesi onay kuyruğu (mekan + alan değişikliği)
    │   ├── requests.js        # işletmenin teklif talepleri (satın alma YOK)
    │   ├── adslots.js        # SABİT FİYAT + takvim rezervasyonu (banner/video/push)
    │   ├── rewarded.js       # ödüllü video seçimi: yakınlık, tekrar yok, Google yedeği
    │   ├── creatives.js       # hizmet TANITIMI (yönetici yükler, işletme görür)
    │   ├── media.js           # işletme dosyaları: menü/foto/reklam + ONAY KUYRUĞU
    │   ├── import-restaurants.js  # Excel/CSV ile toplu restoran yükleme
    │   ├── second-chance.js   # haftalık yeniden gösterim paketi + geçilenler
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
| `lib/platform.js` | yönetici (özellik kapıları + **satış kapıları**) | tüketici ve işletme |
| `lib/reservations.js` | tüketici (talep) → işletme (karar) | tüketici (bildirim) |
| `lib/pricing.js` | yönetici (**liste fiyatı** + teklif) → işletme (karar) | işletme Büyüme kartları, yönetici gelir tabloları |
| `lib/ad-frequency.js` | tüketici (gösterim) | deste kurulumu |
| `lib/badges.js` | yönetici (editoryal rozet) | tüketici kartı, kaydırma, detay |
| `lib/invites.js` | yönetici (havuz daveti) | yönetici havuz listesi |
| `lib/geo.js` | tüketici (izin / seçilen ilçe) | deste sıralaması, konum çipi |
| `lib/moderation.js` | işletme + besleme → yönetici (karar) | tüketici destesi |
| `lib/second-chance.js` | işletme (paket) + tüketici (gösterim) | deste kurulumu, işletme paneli |
| `lib/requests.js` | işletme (teklif iste) → yönetici (fiyatla/kapat) | yönetici bildirimi, işletme paneli |
| `lib/adslots.js` | yönetici (fiyat) + işletme (tarih talebi) → yönetici (onay) | tüketici banner'ı, ödüllü video, işletme takvimi |
| `lib/rewarded.js` | tüketici (izledim) | ödüllü video seçimi |
| `lib/creatives.js` | yönetici (hizmet TANITIMI) | işletme Büyüme sekmesi |
| `lib/media.js` | işletme (menü/foto/reklam) → yönetici (onay) | tüketici destesi, yönetici detayı |
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

### Renk paleti: uygulama açık, panel iki temalı
Tüketici ve işletme uygulamasının tek bir açık teması var; orada koyu tema
**bilinçli olarak yok**. **Yönetici panelinin koyu teması var** (bkz.
"Yönetici paneli: iki tema").
Uygulama satır içi stille yazıldığı için renkler yine CSS değişkenlerinden
okunuyor (`src/ui/kit.jsx` → `GurStyles`): satır içi stil sınıf kuralını
yener ama `var()` değerini okur. Böylece palet tek yerden değişir.

Yeni renk yazarken **jeton kullan**: `var(--c-card)`, `var(--c-ink)`,
`var(--c-ink-2)`, `var(--c-muted)`, `var(--c-border)`, `var(--c-subtle)`.
Sabit `#fff` yalnızca turuncu/koyu zemin üstündeki metin ve ikonlar için.
Yönetici paneli kendi jeton kümesini taşır (`GurAdmin.jsx` → `C`).

### Turuncu zeminde yazı BEYAZ (ürün kararı)
Tabanı turuncu olan her yüzeyde metin beyaz. Bu **bilinçli bir tercih** ve
bedeli ölçüldü: beyaz `#FF6600` üstünde **2.94:1**, marka gradyanının açık
ucunda (`#FF7A1A`) **2.61:1** — WCAG AA eşiği 4.5'in altında. Denetleme
betiği bu yüzden uyarı veriyor. Tüketici ve işletme taramasında çıkan 25
uyarının **tamamı** budur; başka kaynaklı tek bir kontrast hatası yok.
Listeyi bu şekilde okuyun: sıfır beklemeyin, 25 bekleyin, 26 olursa yeni
bir hata girmiş demektir. Yönetici panelinin kendi rakamları için bkz.
"Yönetici paneli: iki tema".

Geçirmenin tek yolu metin taşıyan turuncu yüzeyi koyultmaktı
(`#C24B00`, beyazla 4.88:1) — marka turuncusu o zaman kiremite dönüyor,
onun yerine turuncu korundu.

| Jeton | Nerede |
|---|---|
| `--c-on-brand` | turuncu DOLGU üstünde ana metin (`#fff`) |
| `--c-on-brand-2` | turuncu üstünde ikincil metin (`rgba(255,255,255,0.86)`) |
| `--c-brand-ink` | kâğıt üstünde turuncu METİN — 5.02:1, AA geçer |
| `--c-field-label` | alan etiketi; kâğıtta koyu, turuncu kabukta beyaz |

**Alan etiketleri için `.gur-on-brand` kullan.** `InputField`/`SelectField`
etiketi rengini `--c-field-label`'dan okuyor. Aynı alan hem kremsi kâğıtta
hem turuncu kabukta kullanılıyor; turuncunun üstünde koyu mürekkep göze
batıyordu. Turuncu kabuğa `className="gur-on-brand"` yazmak yetiyor —
değişken kalıtımla iniyor, içindeki her alan devralıyor, tek tek bayrak
geçmeye gerek yok. Kâğıt üstündeki formlar (tüketici kaydı, işletme kayıt
adımları) sınıfı ALMAZ, koyu mürekkep orada doğru.

Alanın **içi** beyaz kart olarak kalır: kutunun içindeki yazıyı da beyaza
çevirmek beyaz zeminde beyaz metin demek olurdu.

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

### Parlak turuncu simge ve basınca dolan hap
Kaydırma düğmelerinin simgeleri düz turuncu değil, üstten aydınlık alta
doğru koyulaşan bir rampa (`#FFB067 → #FF7A1A → #EF4A00`, markanın kendi
uçları) artık — cam gibi duran referans düğmelerin yaptığı iş bu.

Gradyan **bir kez** tanımlanıyor (`GlossDefs`, uygulama kökünde) ve
simgeler `GLOSS` sabitiyle (`url(#gur-gloss)`) bağlanıyor. Her düğmede
ayrı bir `<defs>` çizerseniz aynı id çoğalır ve tarayıcı hepsini ilkine
bağlar. Gradyan bulunamazsa simge **siyah** çizilir — ekleyip görmeden
geçmeyin.

Kaydırma düğmelerinde renk artık ayrım taşımıyor, **şekil** taşıyor:
çarpı = geç, çift ok = detay, kalp = favori. Üçü de turuncu; ayrımı
simgenin biçimi yapıyor.

Bütün haplar basılınca **içeriden turuncu doluyor**: `.gur-btn::before`
merkezden büyüyen bir daire. Kurallar:
- Dolgu hapın zeminini değiştirmiyor, ÜSTÜNE biniyor — her varyantta çalışır.
- `transform: scale()` ile büyüyor; genişlik animasyonu her karede yeniden
  yerleşim yaptırırdı.
- İçerik `isolation: isolate` + `z-index: -1` ile dolgunun üstünde kalıyor.
- Hap tam yuvarlak olduğu için `overflow: hidden` dolguyu kenarda kesiyor.
- Kendi düğmesini elle yazan yerler `.gur-fill` sınıfını doğrudan kullanır.

### Yemek zili: iki an, tek nesne
`DinnerBell` iki yerde çalıyor — kota dolduğunda ("mutfak kapandı") ve GUR
Match'te eşleşme olduğunda ("masa hazır"). İkisi de aynı şeyi söylediği
için tek bileşen.

Zil **gövdesi** sallanıyor, tokmak değil: dönüş ekseni tepedeki topuz
(`transform-origin: 50% 10%`), yoksa zil havada kayıyor gibi duruyor.
İki tur sonra duruyor — sürekli dönen bir salınım 0.2 Hz civarında
rahatsız ediyor. Çevresindeki `.gur-bell-wave` halkaları sesin görsel
karşılığı.

**Ses yok.** İzinsiz ses çalmak kaba, üstelik sessiz moddaki telefonu da
yok sayardı. Zil görsel bir işaret.

Azaltılmış hareket tercihinde salınım ve halkalar duruyor, zil görünmeye
devam ediyor.

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

### Yönetici paneli: iki tema
Panelin açık ve **koyu** teması var (uygulamanın hâlâ yok). Anahtar iki
yerde: kenar çubuğunun altında ve giriş ekranının sağ üstünde. Seçim
`gur.admin.theme`'de saklanıyor; hiç seçilmemişse işletim sisteminin
tercihi (`prefers-color-scheme`) okunuyor.

**Nasıl çalışıyor.** Panel kendi stil bloğunu taşıyor ve `GurStyles`
jetonlarını görmüyor; renkler bu yüzden CSS değişkeni değil JS. Tema
değişince `LIGHT`/`DARK` paleti `C`nin üstüne **yerinde** yazılıyor
(`applyAdminTheme`) ve kökteki state bump'ı bütün ağacı yeniden çizdiriyor.
Böylece 560'tan fazla `C.x` kullanımı olduğu gibi kalıyor — SVG
öznitelikleri (`fill`, `stopColor`) ve `${C.red}44` gibi hex
birleştirmeleri dahil, ki bunların ikisi de `var()` ile çalışmazdı.
Ağaçta `React.memo` sınırı yok, o yüzden sayfa/filtre/arama durumu
korunuyor (kök `key` ile remount edilseydi kaybolurdu).

**Modül düzeyinde `const X = { a: C.foo }` YAZMAYIN.** O değer modül
yüklenirken donar ve tema değişince güncellenmez — koyu temada açık tema
renkleri sızar. Türev sabitler `live()` ile getter'a çevrildi: `CARD`,
`SH`, `ELEV`, `TONE_COLOR`, `TONE_SOFT`, `KIND_TONE`, `PLAN_COLOR`,
`CAMPAIGN_STATUS`. Yenisini eklerken aynısını yapın.

Bölünme kuralı uygulamanınkiyle aynı: **dolgu parlak tonunu korur, YAZI
zemine göre ton değiştirir.** Açık kâğıtta koyu mürekkep (`-Ink`), koyu
zeminde açık tint — ve koyu zemin tintleri uygulamanın `--c-*-light`
jetonlarıyla birebir aynı hexler (`#4ADE80`, `#FF7A70`, `#FFB454`,
`#FF9A4D`). Yeni renk tanımlanmadı.

Dolgu olarak kullanılan tonların ayrı jetonu var (`fillGreen`, `fillRed`,
`fillNeutral`): koyu temada `greenInk` açılıyor, dolgu olarak kullanılsaydı
üstündeki beyaz yazı okunmaz olurdu. `offBg`/`offInk`/`offBorder` devre
dışı hap, `heroTint` gelir şeridinin sıcak yıkaması, `tooltipBg` grafik
ipucu kutusu — hepsi iki temalı.

Koyu temada **gölge yükseklik anlatmaz**: siyah zeminde soluk siyah gölge
görünmez. Yüksekliği yüzeyin AÇILMASI anlatıyor (`bg` → `panel` →
`panel2`), gölge yalnızca ayırıcı. `SH_DARK` opaklıkları bu yüzden belirgin
biçimde yüksek.

Buton CSS'i tek yerde (`btnCss()`): iki stil bloğu da onu kullanıyor. Ayrı
tutulduğu dönemde giriş ekranındaki "Giriş yap" hapı hiç
biçimlendirilmiyordu — tarayıcının gri varsayılanı üstünde beyaz yazı,
1.15:1, düğme neredeyse görünmezdi.

**Ölçüm.** Koyu temada on dört sayfa tarandığında 36 uyarı çıkıyor ve
hepsi beyaz-turuncu kararından; başka kaynaklı sıfır. Açık temada aynı
tarama 68 uyarı veriyor ve bunun **32'si turuncu değil**: parlak dolgu
tonları (`C.green`, `C.orange`, `C.yellow`, `C.red`) beyaz kâğıtta
doğrudan YAZI rengi olarak kullanılmış — yukarıdaki iki-ton kuralının
ihlali, koyu temadan önce de vardı. Daha önce raporlanan "hepsi turuncu"
rakamı yalnızca panoyu tarayan dar bir taramadan geliyordu; sonradan eklenen
Reklam Takvimi, Hizmetler ve Moderasyon sayfaları da taramaya girdi — rakamların
28/62'den 36/69'a çıkması bu üç sayfadan, yeni bir ihlalden değil. Açık tema
69'dan 68'e düştü: devre dışı hap jetonu (`offInk`) 2.17:1'den 4.6:1'e çekildi.

### Dokunma hedefi, çentik ve rıza — ölçülmüş kurallar

Bu üç başlık "yapıldı" sanılıyordu; 393×852 (iPhone 14 Pro) ölçüsünde
ölçülünce üçünde de açık kalmış yerler çıktı. Ölçüm betiği:
`y20d.mjs` — her ekranda 44'ün altındaki hedefleri, çentik bandına düşen
metni ve rıza kutusunun altında kalan düğmeyi tarıyor.

**Rıza kutusu bir MODAL.** Karar verilmeden devam edilemiyor — ama bunu
söylemiyordu: karşılama ekranındaki "GUR'u kullanmaya başla" hapı kutunun
altında kalıyor, görünüyor, basılabilir duruyor ve hiçbir şey yapmıyordu
(hap 714–767, kutunun metni onun üstünde). Artık `role="dialog"
aria-modal="true"` ve arkasında bir **perde** var: engel görünür.
Perdeye dokunmak kapatmıyor — rıza sorusunun sessizce geçiştirilecek bir
cevabı yok.

**Mutlak konumlanmış öğe çerçevenin çentik payını ALMAZ.** `.gur-frame`
üstündeki `padding-top: max(0, inset-top - 44)` yalnızca akıştaki içeriği
itiyor; `position: absolute` bir öğenin sarmalayıcısı ata öğenin DOLGU
KUTUSU olduğu için dolgu onu aşağı itmiyor. Ölçüldü: çerçeveye 59px dolgu
verildi, CANLI/YEREL rozeti 8px'te kaldı — çentikli telefonda durum
çubuğunun altında kalıyordu. Çentik payını **kendi** okuyor artık:
`top: calc(env(safe-area-inset-top, 0px) + 8px)`. Üst kenara mutlak
konumlanan yeni bir öğe eklerken aynısını yapın.

**`.gur-tap` — metin hedefini büyütür.** `.gur-icon-btn::after` ikon
butonlar için; metin bağlantılarında eksik olan yalnızca YÜKSEKLİK
("Tümü" 37×14, "Kaydırarak gez" 101×14, "Doyurucu uygulamasına geç"
191×14). Yazıyı büyütmek düzeni bozardı, görünmez hedefi büyütmek
bozmuyor. `GurStyles` bir şablon dizgisi: oradaki yorumlara **ters tırnak
yazmayın**, dizgiyi orada bitirir.

**"Üç yol da eşit ağırlıkta" artık gerçekten öyle.** Konum ekranında
yazılıydı ama değildi: üstteki iki yol 341×53 / 16px iken "Şimdi değil"
341×35 / 12.5px idi — hem karanlık kalıp hem 44'ün altında hedef. Üçü de
aynı boy ve punto; ayrım yalnızca varyantta.

**Sonsuz iskelet.** `loadRestaurantDetail` cephesi kendi içinde yerele
düşüyor ama çağrı yerinde `.catch()` yoktu: bu yoldan sonra atılan bir
hata `detail`i null bırakır ve yorum iskeleti sonsuza kadar döner. Dönen
ama asla bitmeyen bir yükleme, hatanın en kötü hâli — iki çağrı yerinde de
`.catch()` var.

### Açılış, doğrulama ve çevrimdışı — ölçülmüş kurallar

**Splash hiçbir yüklemeye bağlı değil.** Sabit 3200 ms bekliyordu ve
atlanamıyordu: soğuk açılışta ilk boya 108 ms'de geliyor, etkileşime kadar
3294 ms geçiyordu — neredeyse tamamı boş bekleme. Üç kural:

| | Süre |
|---|---|
| İlk açılış (marka anı) | ~3.2 sn |
| İkinci açılıştan sonra (`gur.splashSeen`) | ~0.9 sn |
| Azaltılmış hareket | ~0.2 sn |
| Ekrana dokunma | anında |

Katsayı tek yerde (`k`), koreografi aynı kalıyor — süreleri tek tek
kısaltmak fazların birbirine girmesi demekti.

**Giriş formu HER İKİ MODDA doğrulanıyor.** `if (!live) return onLogin()`
doğrulamadan ÖNCE geliyordu: yerel modda BOŞ e-posta ve BOŞ parolayla
giriş yapılıyordu. "Yerel modda giriş bir formalite" doğru olabilir ama
formu doğrulamamak, alanları hiç sormamaktan kötü — kullanıcı yazdığının
bir yere gittiğini sanıyor. Doğrulama artık ilk satırda, mod kontrolü
sonra.

**Kayıt ekranındaki koşul onayı DEKORATİFTİ.** Kutu işaretlenmeden de
kayıt tamamlanıyordu; ekranda "kabul ettiğinizi onaylıyorsunuz" yazarken
onayı sormamak hem yalan hem hukuken sakıncalı. Düğme artık ad + geçerli
e-posta + 6 karakter parola + onay kutusu olmadan kapalı ve sebebi
`role="alert"` ile yazılı.

**Çevrimdışı kabuk (`public/sw.js`).** Uçak modunda sayfa yenilenince
uygulama ölüyordu (ERR_INTERNET_DISCONNECTED) — oysa YEREL mod tam da
bunun için var, veriler zaten localStorage'da; eksik olan yalnızca
kabuktu. İki strateji, bilinçli ayrı:

- **Belge (HTML) → önce ağ.** Yeni dağıtım hemen gelmeli; ağ yoksa
  önbellekteki kabuk devreye giriyor.
- **Varlık (hash'li js/css) → önce önbellek.** Dosya adı içeriğin hash'ini
  taşıyor: aynı ad = aynı içerik, ağa sormak boşuna.

Tersini yapmak (belgeyi önbellekten vermek) en klasik hatayı doğururdu:
dağıtım yapılır, kullanıcı haftalarca eski sürümü görür. Eski sürüm
önbellekleri `activate`'te siliniyor.

**Artifact önizlemesinde SW KAYDI YAPILMAZ.** Sayfa claude.ai'den servis
ediliyor, kendi kaynağı yok. Bayrak `__GUR_ARTIFACT__` (vite `define`) ve
ESLint'e `globals` ile tanıtılı. `public/sw.js` `dist/` köküne çıkıyor,
`dist/assets/` altına değil — artifact betiğinin "tek JS dosyası" kontrolü
bu yüzden etkilenmiyor.

**Paywall metni.** "Yıllık · 2 ay hediye" tutmuyordu: ₺79×12 = ₺948,
yıllık ₺690 → fark ₺258, yani **~%27** (2 ay değil ~3.3 ay). Fiyat iddiası
doğrulanabilir olmalı. Ayrıca yenileme ve iptal bilgisi hiç yoktu; fiyatı
ve faydayı yazıp bunu atlamak kararı eksik bilgiyle aldırmaktı.

### Ölçülüp TEMİZ çıkanlar (tekrar aramayın)

| Test | Sonuç |
|---|---|
| Yatay mod | İçerik kayıyor, taşma yok; alt fold'un altındaki düğmelere kaydırarak erişiliyor |
| Isınma (50 kaydırma) | DOM +7, animasyon +0, yığın +0.6 MB — sızıntı yok |
| Sil ve kur (depo tamamen silinir) | Uygulama temiz açılıyor |
| Kapladığı yer | İlk yükte ~188 KB JS; bir oturum sonrası localStorage < 1 KB |
| Çarpıyı bul | Sayfalar `aria-modal`, her birinde en az iki kapatma yolu |
| Karanlık mod | `color-scheme: light` bildirili — tek tema bilinçli, işletim sistemi koyu modda beyaz patlaması yok |

### BİLİNEN EKSİK: büyük yazı ölçeklenmiyor

Tarayıcı taban yazı boyutu 16 → 24 px yapıldığında **hiçbir metin
büyümüyor**: kök 24 px olurken başlık 36 px, gövde 13 px, düğme 16 px
olduğu yerde kalıyor. Sebebi yapısal — uygulama satır içi stille yazılı ve
her `fontSize` sabit piksel.

Düzeltmek `fontSize: N` → `rem` dönüşümü demek, ama **tek başına
yetmiyor**: genişlik/yükseklik/dolgu da sabit pikselde, yalnızca yazıyı
büyütmek taşma ve kırpılma üretir. Yani bu, ölçüm eşliğinde yapılması
gereken ayrı bir geçiş — yarım yapılırsa görünürde "destekliyor" ama
pratikte bozuk bir arayüz çıkar.

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

**Konum izni TEK KAPI — ziyaret takibi kendiliğinden başlar.** Önceden iki
ayrı bayrak vardı: girişten sonraki konum ekranında "Konumumu kullan" diyen
kullanıcı tarayıcı iznini zaten veriyordu ama o izin yalnızca `geo`ya
(deste sıralaması, konum çipi) gidiyordu; ziyaret takibini açan bayrak
ayrıydı ve yalnızca detay sayfasındaki "Buradayım, konumumu doğrula"
düğmesinden açılıyordu. Sonuç: izin verilmiş olmasına rağmen takip hiç
başlamıyor, düğme her mekânda çıkmaya devam ediyordu.

Artık cihaz izni varsa (`source === "device"`) `watchLocation` kendiliğinden
çalışıyor ve `ReviewGate` düğme yerine **"Konumun izleniyor"** yazıyor.
Elle açma yolu duruyor: ilçesini elle seçmiş ya da izni reddetmiş kullanıcı
oradan izin verebilmeli. `ReviewGate` takip durumunu prop olarak DEĞİL
doğrudan `geo`dan okuyor — iki ekran (kart sayfası ve tam detay) aynı
bileşeni çiziyor ve prop zincirinde birini güncellemeyi unutmak ikisinin
farklı şey söylemesi demekti.

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

### Havuz rozeti "API" yazar
`SOURCE_LABEL` üç değer taşır: **API** (dış besleme), **Sahiplenilmiş**,
**Elle eklendi**. Eskiden "Dış besleme" yazıyordu; panelde bakan kişi
Google Places / OSM beslemesini API olarak biliyor, teknik adı daha net.

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

### Hareket kiti
SmoothUI'nin hareket dili GUR'un kendi sistemine yazıldı. **Tailwind
eklenmedi** — zaten aynı motoru kullanıyoruz: Motion. (SmoothUI'nin kendi
bileşenleri bu ortamda indirilemiyor: `smoothui.dev` çıkış kapısında
engelli. Ayrıca Tailwind v4 + TypeScript istiyor, ikisi de burada yok.)

`src/ui/kit.jsx` içinde dört parça:

| Parça | Ne yapar | Nerede |
|---|---|---|
| `SplitText` | başlık harf harf belirir | karşılama ekranı, **yalnız orada** |
| `CountUp` | sayı sayarak artar | kit'te hazır (panelin kendi kopyası var) |
| `Orb` | üç katmanlı dönen turuncu küre | konum izni beklenirken |
| `Skeleton` | parlayan yer tutucu | dış yorumlar yüklenirken |

Ortak kural: **yalnızca `transform` ve `opacity`**. Genişlik/yükseklik/top
animasyonu her karede yeniden yerleşim yaptırıyor, bu ikisi yaptırmıyor.
Hepsi `prefers-reduced-motion`'a uyuyor — hareket durur, nesne kalır.

`SplitText` metni görsel olarak parçalıyor ama **ekran okuyucuya bütün
gönderiyor**: her harf ayrı düğüm olsaydı okuyucu heceleyebilirdi. Görünür
parçalar `aria-hidden` + `data-split`, yanlarında ekrandan gizli tam metin
duruyor. **`data-split` denetleme betiği için de gerekli**: harfleri tek tek
saymak bir başlıktan on bir satır uyarı üretiyordu — aynı piksel, aynı oran.

Panelin `AnimatedNumber`'ı KPI değerini hazır biçimlenmiş dizgeden ayırıyor
(`₺939K` → ek + sayı + ek) ve yalnızca sayıyı sayıyor. Animasyon bitince
**ekranda orijinal dizge** duruyor; biçimlendirmeyi yeniden üretmek binlik
ayıracında sessiz bir kaymaya yol açabilirdi.

### Ekran geçişleri ve genişleyen kart
Ekranlar `AnimatePresence mode="popLayout"` içinde. `popLayout` giden ekranı
akıştan çıkarıyor; olmazsa iki ekran bir kare boyunca üst üste yığılıp
sayfayı uzatıyor.

Geçişin **yönü** alt bardaki sekme sırasından geliyor (`SEKME_SIRA`): sağdaki
sekmeye giderken içerik sağdan, soldakine dönerken soldan. Yön rastgele
olsaydı kullanıcı nerede olduğunu kaybederdi. Sekme olmayan geçişlerde
(giriş, detay, yasal metin) "sağ/sol" diye bir anlam yok — orada yalnızca
yumuşak ölçek + solma.

**Genişleyen kart:** Keşfet listesindeki kartın görseli ile detay
sayfasının kapak görseli aynı `layoutId`'yi taşıyor
(`gur-kapak-${r.id}`), Motion ikisi arasında morph ediyor. Kimlik mekan
id'sine bağlı olmak **zorunda** — sabit bir id verilirse listedeki bütün
kartlar tek bir görselmiş gibi birbirine morph olur. `layoutId` karusel
ŞERİDİNDE değil dış sarmalayıcıda: şerit zaten `translateX` ile kayıyor,
ikisi aynı düğümde olsaydı morph ile karusel kaydırması aynı transform
üzerinde çakışırdı.

### Moderasyon: yayına çıkmadan önce yönetici görür
Önceden iki yol da denetimsizdi — beslemenin getirdiği yeni mekan anında
listedeydi, işletmenin girdiği alan anında karttaydı. Artık ikisi de kuyruğa
düşüyor (`src/lib/moderation.js`, sunucuda migration 003).

**İki ayrı şey, iki ayrı yer** — tek tabloda tutmak "mekan bekliyor" ile
"mekanın telefonu bekliyor" durumlarını karıştırırdı:

| Ne | Nerede | Kim karar verir |
|---|---|---|
| Kayıt yayında mı | `venues` / `restaurants.review_status` | Moderasyon sayfası |
| Yayındaki kaydın nesi değişecek | `changes` / `restaurant_change_requests` | Moderasyon sayfası |

**Mevcut kayıtlar ONAYLI sayılır.** Varsayılanı "bekliyor" yapmak havuzu bir
gecede boşaltırdı; yalnızca beslemenin GETİRDİĞİ yeni kayıt beklemeye düşer
(`markVenuePending`, tohum listesiyle karşılaştırarak).

Yönetici onaylarken **düzenleyebilir**: gelen metni olduğu gibi kabul etmek
zorunda değil, düzelttiği hâl yayınlanır ve kayıtta `edited` izi kalır.
İşletme panelinde alan rozetinin üçüncü hâli bunu söylüyor: **İNCELEMEDE**
(onaylanmamış bir değere "İŞLETMEDEN" demek yalan olurdu).

Bir mekanın aynı anda **tek bekleyen talebi** olur — işletme formu üç kez
kaydederse yöneticinin önüne üç iş değil son hâl çıkar. Sunucuda kısmi tekil
indeksle zorlanıyor.

**Elle restoran oluşturma** (Moderasyon sayfası → "Restoran oluştur")
sahiplenme akışını atlar ve doğrudan yayınlanır: yönetici zaten onaylayan
merci, kendi kaydını kendi kuyruğuna atmak boş bir tur olurdu. Kayıt
**sahiplenilmemiş** açılır (havuza düşer, müşteri listesine değil).

### Restoran bazlı görünürlük anahtarı
Tek bir mekanı tüketici uygulamasından **tamamen** gizler
(`platform.js` → `setRestaurantHidden`). Özellik kapılarından ayrı bir kart:
kapılar "bu mekanda şu özellik yok" der, bu "bu mekan yok" der.

Ayarlar sayfasında **değil**, restoranın kendi detay ekranında — genel bir
listede yanlış satıra basmak bir mekanı sessizce uygulamadan düşürürdü.

Süzgeç tüketici tarafında **tek yerde** (`GurApp` → `feed`): deste, arama,
kategori sayıları, favoriler ve GUR Match hepsi oradan besleniyor. İki ayrı
süzgeç arka arkaya ve ikisi ayrı soru soruyor:
`publishedOnly` (moderasyondan geçti mi) → `visibleRestaurants` (gizlendi mi).

### İkinci Şans: ücretsiz mekanik + satın alınan paket
İki ayrı şey, karıştırmayın:

- **Oturum içi tur (ücretsiz)** — deste bitti, geçtiklerine bir daha bak.
  Eskiden beri var, kaldırılmadı, kimseye para kazandırmıyor.
- **Haftalık paket (ücretli)** — restoran ödüyor ve kendisini **sola
  kaydırmış** kullanıcıların destesine geri giriyor. Başka gün, başka
  oturum, başka kullanıcı.

Paket kuralları `shared/second-chance.js`de (istemci ve sunucu ortak; ayrı
yazılsaydı sunucu paketi bitmiş sayarken istemci göstermeye devam ederdi):

| Kural | Değer |
|---|---|
| Erişim | **200 farklı kullanıcı** (gösterim sayısı değil) |
| Süre | 7 gün — ama **kotayla biter**, süreyle değil |
| Aynı kullanıcıya | günde en fazla 1 kez |
| Restoran başına | aynı anda **tek aktif paket** |

Hedefleme: yalnızca o restoranı **sola kaydırmış** kullanıcı. Hiç görmemiş
kişiye "ikinci şans" diye bir şey yok — o zaten organik akışta görecek.
Kart organik havuzun **arkasına** ekleniyor: kullanıcı bir kez "hayır"
demiş, önce hiç görmediklerini görsün.

**Aday listesi oturum başında DONDURULUYOR** (`scDondurulmus` ref'i) ve bu
şart. Canlı hesaplansaydı: kart en üste gelir → gösterim kaydedilir → depo
değişir → `candidatesFor` "bugün gösterildi" deyip kartı düşürür → kart
kullanıcı görmeden desteden silinir. Sayaç ilerler, restoran öder, kullanıcı
hiçbir şey görmez. Bu hata geliştirme sırasında gerçekten oluştu.

Mekan o oturumda zaten **organik** çıkıyorsa paket tüketilmiyor: kullanıcının
zaten göreceği kart için para almıyoruz (`zatenVar` kontrolü).

Sunucu karşılığı: `second_chance_packages` + `second_chance_impressions`
(migration 004). Tek aktif paket kuralı kısmi tekil indeksle veritabanı
seviyesinde zorlanıyor — uygulama katmanında kontrol yarış koşulunda yetmez.

### Satış kapıları: bir hizmet satın alınabilir mi (`lib/platform.js`)

Yönetici **Hizmetler** sayfasındaki satır anahtarıyla her kalemi satışa
açıp kapatıyor. Kapalıyken işletme panelinde **kart kaybolmuyor**, yerinde
**"Pek yakında"** yazıyor: kaldırmak işletmeye ürünün hiç var olmadığını
söylemek olurdu, oysa yakında açılacak. Fiyat da yazılmıyor —
alınamayan bir şeyin fiyatı bilgi değil.

**ÜÇ kapı var ve üçü ayrı soru soruyor:**

| Kapı | Soru | Nerede | Depo |
|---|---|---|---|
| `FEATURES` | özellik TÜKETİCİDE çalışıyor mu | Ayarlar | `storeOverrides` |
| `SERVICE_GATES` | bu hizmeti HİÇ satıyor muyuz | Hizmetler | `servicesOff` |
| müşteri kapısı | bu MÜŞTERİYE satıyor muyuz | müşterinin kendi kartı | `servicesOffFor` |

**Sıra tek yönlü ve üsttekiler alttakini kapsıyor**: özellik → platform →
müşteri. Üstten kapalı bir şeyi alttan açmak bir işe yaramaz, o yüzden
anahtar devre dışı kalıyor. `isServiceOpen(key, settings, restaurantId)`
üçünü bu sırayla soruyor; `restaurantId` verilmezse yalnızca ilk ikisi.
`serviceGateReason` hangisi olduğunu döndürüyor (`feature` / `manual` /
`store`) ve arayüz üçünü ayrı yazıyor — sebebi bilmeyen yönetici yanlış
sayfada anahtar arar. Devre dışı anahtarın `title`'ı da doğru sayfayı
söylüyor (özellik → Ayarlar, satış → Hizmetler).

`needs` alanı olan hizmet, dayandığı özellik kapalıyken **otomatik kapalı**
sayılıyor (`anlık fırsat → instantDealsEnabled`, `Gastro paketi →
gastroVideoEnabled`): teslim edemeyeceğimiz şeyin parasını alamayız.

**Müşteri kapısı `storeOverrides`a KONMADI.** Orası `FEATURES` kuyruğu ve
ayrı bir soru soruyor ("bu mekanda menü çalışıyor mu"); ikisini tek
haritada tutmak "özellik yok" ile "satmıyoruz" durumlarını karıştırırdı.

**Müşteri anahtarı iki yerden çiziliyor** — restoranın detay ekranı ve
Fiyatlandırma sayfasındaki müşteri satırı — ama **tek bileşen**
(`StoreServiceGates`) ve tek depo. İkisi ayrı yazılsaydı biri katalogda
açılan yeni kalemi göstermeyi unuturdu. "Yanlış satıra basma" riski yok:
ikisi de tek bir müşteriye girilmiş olmayı gerektiriyor. Müşteri satırında
kapalı kalem varsa satır **açılmadan** rozetle yazıyor — kapatıp unutmak,
sonra "neden teklif istemiyor" diye aramak demekti.

**Yalnızca KAPALI olanlar saklanıyor** (`servicesOff: { bannerAds: true }`,
`servicesOffFor: { "3": { gastroPackage: true } }`). Tersi olsaydı
katalogda yeni bir hizmet açıldığında eski kurulumlarda kapalı doğar ve
kimse fark etmezdi. Açılan kayıt siliniyor, boş kalan müşteri kaydı da.

**Kapı arayüzde DEĞİL depoda**: `requestQuote` (teklif talebi) ve `canBook`
(reklam rezervasyonu) kapalı kalemi reddediyor. Kart "Pek yakında" yazıyor
ama kapatıldıktan sonra açık kalmış bir sekmeden gelen istek de
reddedilmeli.

Kapalı kart `opacity` ile soluklaştırılmıyor — projenin kendi kuralı.
`GrowthCard` ve `GrowthSection` eskiden `opacity: 0.5` kullanıyordu,
kaldırıldı; fark artık renkle ve "Pek yakında" rozetiyle.

### Pazarlıklı kalemlerin liste fiyatı (`lib/pricing.js`)

Pazarlık artık boş sayfadan başlamıyor: üç pazarlıklı kalemin yöneticinin
belirlediği bir **liste fiyatı** var (`NEGOTIATED`), Fiyatlandırma
sayfasının en üstündeki kartta değiştiriliyor.

| Kalem | Katalog | Birim |
|---|---|---|
| Gastro şef videosu paketi | ₺13.200 | / ay |
| İkinci Şans paketi | ₺1.450 | / paket |
| Anlık fırsat | ₺450 | / yayın |

- **Yalnızca DEĞİŞTİRİLENLER saklanıyor** (`list: {}`); gerisi katalogdan
  geliyor. Tersi olsaydı katalog fiyatını güncellemek hiçbir kurulumu
  etkilemezdi. Katalog değerine dönülürse kayıt siliniyor — "değiştirilmedi"
  ile "aynı sayı yazıldı" aynı şey.
- **Liste fiyatı değişimi GÖNDERİLMİŞ teklifi bozmuyor.** Teklifteki tutar
  o an donmuş: listeyi yükseltmek, işletmenin önünde duran teklifi habersiz
  değiştirmek olurdu ve kabul edeceği tutarla kabul ettiği tutar farklı
  çıkardı. Yeni liste yalnızca bundan sonraki tekliflerin başlangıcı.
- **BİRİM UYUŞMASI ŞART.** Teklifin tutarı AYLIK (`offerMonthly`) ve gelir
  tabloları onu aylık topluyor. Teklif alanı bu yüzden yalnızca **"/ ay"**
  birimli kalemde liste fiyatından doluyor; "/ paket" ve "/ yayın"
  kalemlerde liste fiyatı alanın yanında BİLGİ olarak duruyor. Yayın başına
  ₺450'yi aylık alana yazmak, ₺2.400 ödeyen müşteride "−%81" gibi anlamsız
  bir sapma üretiyordu — çevirmeyi biz uydurmuyoruz.
- Birim katalogda **sabit**: fiyatı değiştirmek pazarlık, birimi
  değiştirmek satılan şeyi değiştirmek olurdu.
- İşletme panelindeki `liste: ₺X` rakamları **hepsi buradan** okunuyor.
  Önceden üçü de elle yazılıydı (`liste: ₺13.200 / ay`, `₺450 / yayın`,
  İkinci Şans'ta `PACKAGE.priceMinor` üzerinden `₺1.450 / hafta`) —
  yöneticinin değiştirdiği fiyat panele hiç ulaşmıyordu. İkinci Şans'ın
  birimi de düzeltildi: paket süreyle değil **kotayla** bittiği için
  "/ hafta" yanlıştı.

**Panelde fiyat `tamPara()` ile yazılıyor, `money()` ile değil.** `money()`
binleri kısaltıyor (₺13.200 → "₺13K") ve KPI toplamlarında doğru: oradaki
soru "ne mertebede". Elle yazılan bir fiyatta yanlış — ₺13.200 ile ₺13.400
ikisi de "₺13K" okunur, yazdığın sayıyı ekrandan doğrulayamazsın. Liste
fiyatı, teklif tutarı ve işletmeye görünen rakamlar tam yazılıyor: iki
taraf aynı sayıyı görmek zorunda.

### İki fiyat modeli — hangisi nerede

| | Kalemler | Fiyat | İşletme ne yapıyor |
|---|---|---|---|
| **Sabit** | banner, ödüllü video, push | **günlük**, listede yazar, yönetici günceller | takvimden tarih + 1–7 gün seçer |
| **Pazarlıklı** | Gastro paketi, İkinci Şans, anlık fırsat | müşteriye özel | teklif ister |

Reklam envanterinin fiyatı müşteriye göre değişmiyor: bir haftalık banner
herkese aynı. Gastro çekimi ya da İkinci Şans paketi ise mekâna göre
konuşuluyor. Aynı akışa sokmak ikisinden birini yanlış yere koyardı.

**İKİSİNDE DE SATIN ALMA SERBEST DEĞİL.** Sabit fiyatta kalkan şey
pazarlık, onay değil: işletme tarihi seçiyor, talep yöneticiye düşüyor,
onaylanınca slot kilitleniyor.

### İşletme HİÇBİR ŞEY satın alamaz — teklif ister (pazarlıklı kalemler)

Doyurucu panelinde "Satın al" diye bir düğme **yok** ve olmayacak.
Pazarlıklı kalemler (anlık fırsat, İkinci Şans paketi, Gastro şef videosu)
tek bir akıştan geçiyor:

```
işletme "Teklif iste"  →  yöneticide talep kuyruğu + bildirim
      →  yönetici fiyatı yazıp teklif gönderir
      →  işletme kabul/ret  →  hizmet açılır
```

Neden: fiyat müzakereye açık ve her mekan için aynı değil. Panelde sabit
bir fiyat gösterip "satın al" demek, pazarlığı olan bir kalemi liste
fiyatından satmak olurdu. Kartlarda yazan rakam bu yüzden **"liste:"**
önekiyle geçiyor — teklif değil, başlangıç noktası.

Depo `src/lib/requests.js`. Bilinmesi gereken üç kural:

- **Bir (restoran, hizmet) çifti için aynı anda tek açık talep.** İşletme
  düğmeye üç kez basarsa yöneticinin önüne üç iş değil bir iş çıkar.
- **Teklif göndermek talebi KAPATMAZ**, yalnızca `quoted` yapar. İşletme
  reddederse ikinci bir teklif gidebilmeli; talep hâlâ geçerli.
- `unseenCount` yalnızca `open` ve `quoted` talepleri sayar. Kapatılmış ya
  da geri çekilmiş talep bildirimde durmaz.

İşletme talebini **geri çekebilir** ("Vazgeç") — istenmeden gönderilmiş bir
talep için yöneticiyi beklemek gerekmiyor.

### Yönetici paneli: bildirim çanı
Başlıktaki çan üç kaynaktan gelen bekleyen işi tek listede topluyor: teklif
talepleri, sahiplenme başvuruları, moderasyon kuyruğu. Satıra basınca ilgili
sayfaya gidiyor. Eskiden çan yalnızca bir nokta çiziyordu ve tıklanınca
hiçbir şey olmuyordu — **çalışmayan bir bildirim, olmayandan kötüdür.**

Rozetteki sayı yalnızca **teklif taleplerini** sayıyor: başvuru ve
moderasyon kuyruğunun kendi sayaçları kenar çubuğunda duruyor, aynı sayıyı
iki yerde göstermek "iki ayrı iş var" gibi okunurdu.

**"Okundu" işareti liste KAPANIRKEN düşüyor, açılırken değil.** Açılışta
işaretlenseydi yeni satırın turuncu noktası aynı karede silinir ve hangisinin
yeni geldiği hiç görünmezdi.

### İki ayrı dosya yolu — KARIŞTIRMAYIN

Panelde iki yükleme alanı var ve **aynı şey değiller**:

| | Kim yükler | Kime görünür | Onay |
|---|---|---|---|
| **Hizmet tanıtımı** (`lib/creatives.js`) | yönetici | işletme, Büyüme sekmesinde | yok — yönetici zaten yetkili |
| **İşletme dosyası** (`lib/media.js`) | işletme | onaylanırsa tüketici | **var** |

**Hizmet tanıtımı** reklam içeriği DEĞİL: sattığımız hizmetin ne olduğunu
ANLATAN örnek ("banner ekranda nasıl görünüyor", "şef videosu neye
benziyor"). Hizmetler sayfasında satırdaki **Tanıtım** düğmesi açıyor.
Yükleme **taslak** geliyor; "İşletmelere göster" ayrı bir adım. İşletme
kartta bu tanıtımı görüp öyle teklif istiyor — fiyat ve iki satır açıklama
"dönen keşfet banner'ı"nın neye benzediğini anlatmıyordu.

Ödüllü video **kullanıcı özelliği**: kaydırma hakkı biten kullanıcı reklam
izleyip hak kazanıyor. Restoranın satın aldığı şey o akışta **yayınlanma
hakkı**. Hizmet listesinde bu ayrım "kullanıcı özelliği" çipiyle ve
satırın altındaki açıklamayla yazılı.

### İşletme dosyaları: onay kuyruğu (`lib/media.js`)
Menü, fotoğraf ve **yerleşim başına** reklam materyali. İşletme yüklüyor,
**yönetici onaylamadan tüketiciye çıkmıyor**:

```
işletme yükler (pending) → yönetici ÖNİZLER → onay: tüketicide görünür
                                            → ret: sebebiyle işletmede kalır
```

**Neden `moderation.js`'e koymadık.** Orası ALAN değişikliği kuyruğu: bir
mekanın tek bekleyen talebi olur ve talep bütün olarak onaylanır. Dosya
öyle değil — beş menü sayfasının üçü geçip ikisi kalabilmeli. Tek kayıtta
tutmak "menü bekliyor" ile "menünün 2. sayfası bekliyor" durumlarını
karıştırırdı.

**Eskiden hiç çalışmıyordu.** Menü ve fotoğraf yüklemeleri React state'te
(`ownerMedia`, blob URL) duruyordu: sayfa yenilenince kayboluyor, yönetici
panelinden görünmüyor, tüketiciye HİÇ ulaşmıyordu. Yönetici panelindeki
menü listesi de tohumlanmış sahte veriydi (`restaurantMenus`) — ad ve sayfa
sayısı vardı, açılacak dosya yoktu. İkisi de kaldırıldı.

Bilinmesi gerekenler:
- **Süzgeç tek yerde**: `ownerMediaFor` yalnızca `approved` döndürüyor ve
  tüketici destesi oradan besleniyor. İki ekran ayrı ayrı süzseydi biri
  er geç unuturdu.
- **Kayıt her zaman `pending` doğuyor** (`addMedia`). "Yükledim, yayında"
  diye bir yol yok; kapı depoda, arayüzde değil.
- **Görseller yazılmadan önce küçültülüyor** (`image.js` →
  `fileToFittedDataUrl`, oran korunur, JPEG). Küçültmeden üç telefon
  fotoğrafı tarayıcı kotasını dolduruyor ve dördüncü yükleme hata veriyordu.
  Video küçültülemiyor (tuval sesi ve süreyi kaybeder), orada sınır gerçek
  sınır.
- Kota taşarsa `write()` **hata fırlatıyor**, sessizce yutmuyor: yüklediğini
  sanıp kaybetmek en kötü sonuç.
- **Ret sebep istiyor.** Sebepsiz ret işletmeyi aynı dosyayı ikinci kez
  yüklemeye iter ve aynı iş yöneticiye geri gelir. Sebep işletme panelinde
  dosyanın altında yazılı.

**Yönetici tarafı üç yerde:**
- Moderasyon → "Onayımı bekleyen dosyalar" (en üstte: burada bir MÜŞTERİ
  bekliyor), önizle → onayla/reddet.
- Restoran detayı → "İşletmenin yüklediği dosyalar": tür sekmeleri, tıklayınca
  büyük açılır, karar oradan da verilebilir.
- Kenar çubuğundaki **Moderasyon sayacı** üç kuyruğu da topluyor; çan rozeti
  teklif talepleri + bekleyen dosyaları sayıyor.

**İşletme tarafı:** sekmelerin üstünde **ONAY DURUMU** şeridi — hangi türde
kaç dosya beklemede/yayında/reddedilmiş. Her sekmede duruyor: bekleyen bir
menü onayını görmek için Menü sekmesine girmek gerekseydi işletme onu ancak
arayarak bulurdu.

**Kayıt akışındaki (reg3) yüklemeler depoya gitmiyor**: orada henüz
sahiplenilmiş bir kayıt yok, dosyayı hangi restoranın altına yazacağımızı
bilmiyoruz. Panele girildikten sonraki yüklemeler kuyruğa düşüyor.

#### Reklam materyali YERLEŞİME GÖRE ayrı (`bannerAds` / `rewardedAds`)

Tek bir `ads` havuzu vardı ve iki tüketici de oradan besleniyordu; ayrımı
yalnızca MIME tipi yapıyordu — banner ilk GÖRSEL'i, ödüllü video ilk
VİDEO'yu alıyordu. İki sorun:

1. **Ödüllü videoda `|| liste[0]` yedeği vardı.** Restoran yalnızca banner
   görseli yüklediyse ödüllü video yuvasında hareketsiz bir JPEG
   "oynuyordu": kullanıcı süresi olmayan bir reklamı izlemiş sayılıp
   kaydırma hakkı kazanıyordu. Yedek kaldırıldı — video yoksa o restoran
   aday değil, akış Google yedeğine düşüyor.
2. **İşletme hangi dosyanın nereye gittiğini göremiyordu.** Tek kutuya bir
   dosya bırakıp ikisini birden doldurduğunu sanıyordu.

| Kova | Kabul | Nerede çıkar |
|---|---|---|
| `bannerAds` | `image/*` | Keşfet ekranının üstündeki dönen banner |
| `rewardedAds` | `video/*` | Kaydırma hakkı kazandıran ödüllü reklam |

Kutular işletme panelinde **alt alta**, her birinde yerleşim adı, tür çipi
(görsel/video) ve o türe kilitli dosya seçici var. Yan yana koymak telefonda
ikisini de hedef olmaktan çıkarırdı. Yönetici kuyruğunda da yerleşim adı
yazıyor: "Banner görseli" dosyanın TÜRÜNÜ söylüyor, ekranını değil — dikey
bir video banner'a uymaz ve onaylayanın kararı buna bağlı.

**Eski kayıtlar OKUMA ANINDA taşınıyor** (`tasi()`), depoyu yeniden
yazmadan: taşıma betiği bir "ilk açılış" kancası gerektirirdi ve o kanca
çalışmadan okuyan ekran boş liste görürdü. Dosya videoysa ödüllü video,
değilse banner — eski ayrımın aynısı, ama bir kez ve tek yerde.
`pendingAll` de bu taşımadan geçiyor, yoksa dosya yönetici kuyruğunda
görünmez ama işletmede "beklemede" yazardı.

**`media.js` deposu artık `storage` olayını dinliyor.** Önbellek yalnızca
kendi `write()`iyle tazeleniyordu (`if (cache) return cache`): yönetici
BAŞKA BİR SEKMEDE dosyayı onayladığında işletme sekmesi bunu hiç görmüyor,
sayfa yenilenene kadar "İncelemede" yazmaya devam ediyordu. Projedeki diğer
depolar bunu zaten doğru yapıyordu; burası tek istisnaydı. Anlık görüntü
ham metne göre önbellekleniyor — referans sabit kalmazsa
`useSyncExternalStore` sonsuz döner.

### Reklam slotları: sabit fiyat + takvim (`lib/adslots.js`)

```
işletme takvimden tarih seçer (pending — slot geçici tutulur)
     → yönetici onaylar (approved — slot kilitlenir, yayına girer)
     → yönetici reddeder (rejected — slot serbest kalır)
```

Yönetici takvime **kendisi de yerleştirebiliyor** (doğrudan `approved`):
telefonda anlaşılan bir yayın için işletmeye talep açtırmak boş bir tur
olurdu. Kota ve doluluk kuralları yöneticiye de uygulanıyor — kendi koyduğu
kuralı delebilmesi, kuralı kural olmaktan çıkarırdı.

**FİYAT BİRİMİ GÜN.** Üçünde de bedel `günlük fiyat × seçilen gün`.
Önceden her ürünün süresi sabitti ve birimi ayrıydı (hafta / ay / gönderim);
"ayda 1 kez alınır ama 30 gün kalır" cümlesi kotayla süreyi aynı yere
yazıyordu. Tek birim, tek çarpma.

| Kalem | Günlük | Süre | Restoran başına | Envanter |
|---|---|---|---|---|
| Keşfet banner'ı | ₺350 | 1–7 gün | ayda 1 | **tek yerleşim** |
| Ödüllü video | ₺105 | 1–7 gün | ayda 1 | havuz |
| Push bildirimi | ₺1.800 | 1–7 gün | **haftada 3 gün** | havuz |

Günlükler eski fiyatlardan türetildi: 2400/hafta ≈ 343→350, 3100/ay ≈ 103→105,
1800/gönderim = 1800 (bir gün bir gönderim). Hepsi panelden değişebilir.

**PUSH'TA BİR GÜN = BİR GÖNDERİM.** Üç günlük rezervasyon üç gönderim
demek, o yüzden haftalık sınır GÜN sayısı üzerinden işliyor (`weekDays: 3`):
7 gün seçilebilir ama haftada en fazla 3 gün dolar. Rezervasyon SAYISINI
saymak tek kayıtla yedi gönderim almanın önünü açardı.

**Yalnızca banner exclusive.** Keşfet karuselindeki slayt tek bir yerleşim;
aynı günü iki restorana satmak satılan şeyi ikiye bölerdi ve takvimin
doluluk göstermesi de buradan anlam kazanıyor. Ödüllü video ve push HAVUZ:
ödüllü videoda aynı anda birden çok restoranın videosu yayında olabilir,
hangisinin oynayacağına yakınlık ve "bu kullanıcı izledi mi" karar veriyor.
Exclusive yapılsaydı uygulanacak ikinci bir aday hiç olmazdı.

**Depo sürümlü** (`v: 2`). Fiyat birimi hafta/ay/gönderimden güne çevrildi;
kaydedilmiş eski `prices` değeri (2400) günlük sanılsaydı haftalık banner
yedi katına çıkardı. Sürüm uyuşmazsa fiyatlar atılıyor, rezervasyonlar
korunuyor — bedelleri zaten donmuş.

**Kota ve doluluk tek karar noktasında**: `canBook`. İşletme paneli,
yönetici paneli ve yazma yolu üçü de oradan geçiyor. Arayüzde
tekrarlansaydı panel "alabilirsin" derken yönetici tarafı reddederdi.

**Fiyat rezervasyon anında donuyor** — hem günlüğü (`dailyMinor`) hem
toplamı (`priceMinor`). Liste fiyatını yükseltmek, aylar önce onaylanmış
bir yayının bedelini geriye dönük değiştirmemeli; günlüğü de saklıyoruz ki
"kaç günden kaça" sorusu sonradan cevaplanabilsin.

**Bekleyen talep de slot tutuyor.** Yoksa iki işletme aynı slotu aynı anda
talep eder ve biri boşuna bekler.

Yönetici tarafı: **Reklam Takvimi** sayfası — fiyatlar, onay bekleyen
talepler ve aylık doluluk ızgarası tek yerde. Fiyatı Fiyatlandırma
sayfasına koymak yanlış olurdu: orası pazarlıklı kalemlerin yeri.

Takvimde geçmiş gün **`opacity` ile soluklaştırılmıyor** — projenin kendi
kuralı (bkz. "Pasif durumu opacity ile kurma"). İlk yazılışta öyleydi ve
koyu temada 19 yeni kontrast uyarısı üretti; fark artık renkle.

### Ödüllü video: kim ne izliyor (`lib/rewarded.js`)
Üç kural, sırayla:

1. **Yakınlık** — restoranın videosu yalnızca 15 km içindeki kullanıcıya.
   Kadıköy'deki bir mekânın videosunu Beylikdüzü'ndekine izletmek iki
   tarafa da bir şey kazandırmıyor. Sınır 15 km çünkü daha darı (5 km) demo
   havuzunda çoğu oturumda hiç aday bırakmıyordu.
2. **Tekrar yok** — bir kullanıcı bir videoyu bir kez izler. İkinci kez
   açmak hem sıkıcı hem de erişimi şişiriyordu: aynı kişi "iki kişi" gibi
   sayılırdı. İzlenenler `gur.rewardedSeen` altında.
3. **Google yedeği** — gösterilecek restoran videosu kalmadıysa Google
   reklamı oynar, kullanıcı hakkını yine kazanır, akış hiç tıkanmaz.

Oynatılacak dosya **onay kuyruğundan** geliyor (`media.js` →
`rewardedAds`, onaylı): rezervasyon yayını satın alır, hangi dosyanın
oynayacağını onay belirler. Onaysız video hiçbir koşulda oynamıyor.
Görsele düşen bir yedek de YOK (bkz. "Reklam materyali yerleşime göre").

### Dış kaynak yorumları ve görselleri
Detay sayfasındaki Google bloğunda iki şey var:

- **Yorumlar** açıldığında liste KENDİ İÇİNDE kayıyor (`max-height: 260`).
  Eskiden "2 yorum daha" sayfayı uzatıyordu ve sekiz yorumda detay sayfası
  yorumlardan ibaret kalıyordu. Kapalıyken ilk iki yorum görünür.
- **Görseller** yatay şeritte, tıklanınca tam boy açılıyor; video da
  destekleniyor. Bunlar sunucudan zaten geliyordu ama istemci cephesi
  (`lib/backend.js` → `loadRestaurantDetail`) yalnızca `services` ve
  `externalReviews` alıp `photos` alanını DÜŞÜRÜYORDU — Google Places
  fotoğrafları arayüze hiç ulaşmıyordu. Artık geçiyor ve
  `normalizePhotos` sağlayıcı farklarını (`url`/`src`/`photo_url`, video
  mü değil mi) tek yerde düzleştiriyor.

Banner da aynı mantıkta: Keşfet karuselinde bugüne denk gelen ONAYLI
rezervasyonun slaytı çıkıyor, görseli işletmenin onaylanmış reklam
materyali. Satın alınmış slayt yoksa GUR'un demo reklamları dönüyor —
karusel boş kalmıyor.

### Excel ile toplu restoran yükleme
Moderasyon sayfası → "Excel ile toplu yükle". Şablonu indir → doldur →
yükle → **önizlemeyi onayla**. `src/lib/import-restaurants.js`.

- **SheetJS dinamik yükleniyor** (`await import('xlsx')`): küçültülmüş hâli
  ~430 kB, yönetici panelinin tamamından iki kat büyük. Statik import
  olsaydı paneli açan herkes indirirdi. Tek dosyalık artifact derlemesinde
  `inlineDynamicImports` hepsini tek parçaya katıyor, orada fark yok.
- **Hiçbir şey yazılmadan önce doğrulanıyor.** Yarısı hatalı bir dosyayı
  yarıya kadar işlemek, yöneticiyi hangi satırın girdiğini elle aramaya
  zorlardı. Hatalı satırlar **atlanıyor**, dosya reddedilmiyor: doksan doğru
  satır için on hatalıyı beklemek gereksiz.
- Yakalananlar: zorunlu alan boş, dosyada aynı ad iki kez, havuzda zaten
  olan ad. Her biri satır numarasıyla yazılı.
- Başlık eşlemesi **gevşek**: büyük/küçük harf, boşluk ve zorunluluk
  yıldızı yok sayılıyor; sıra önemli değil. Şablonu Excel'de açıp başlığa
  dokunan kullanıcı dosyayı bozmuş olmuyor.
- CSV aynı yoldan geçiyor — SheetJS biçimi kendi tanıyor, ikinci bir
  ayrıştırıcı iki ayrı hata kaynağı demekti.
- Kayıtlar **sahiplenilmemiş** ve doğrudan **yayında** açılıyor (elle
  restoran oluşturmayla aynı kural: yönetici zaten onaylayan merci).
- Şablon indirmesi artifact kum havuzunda engelli olabiliyor; o durumda
  başlık satırı ekranda gösterilip kopyalatılıyor.

### Gastro şef paketi: altın paket
Katalogdaki tek "üst raf" kalem — şef çekimi yapılıyor, Gastro Onaylı
kategorisine giriyor, en pahalısı. Diğer hizmetlerle aynı gri satırda
durunca farkı okunmuyordu; kendi altın yüzeyi, `★` öneki ve "ALTIN PAKET"
çipi var. Üstünden geçen parıltı `.gur-gold-sheen` (`src/ui/kit.jsx`),
`prefers-reduced-motion`'da duruyor.

Altın **yeni bir renk ailesi değil**: palete kalıcı jeton eklenmedi,
yalnızca bu tek ürünün kimliği (`GOLD`, `GurAdmin.jsx`). Yeni bir
yeşil/kırmızı/amber yazmama kuralı duruyor — altın bir DURUM değil.

İki temada iki ayrı sorun var: koyu zeminde altın metin parlıyor ama beyaz
kâğıtta aynı ton (`#E9C456`, beyazla 1.7:1) okunmuyor. Mürekkep bu yüzden
açık temada koyulaşıyor (`#7A5B0B`, 6.4:1).

### Yönetici paneli: Hizmetler ve arama
**Hizmetler** sayfası sattığımız her kalemi tek listede gösteriyor: kaç
müşteride açık, aylık ne getiriyor, kaç teklif havada. Önceden "banner'ı
kimler almış" sorusunun cevabı yoktu — ciro sayfası toplam veriyordu,
restoranları tek tek gezmek gerekiyordu. Satırdaki "Teklifler" o hizmetin
fiyatlandırma sekmesine götürüyor.

**Fiyatlandırma** sayfasında her hizmetin kendi sekmesi var. Sekmedeki sayı
o hizmet için BEKLEYEN teklif. Sekme seçiliyken liste "o hizmeti alanlar +
o hizmet için teklif gönderilmiş olanlar"a daralıyor — ikincisi şart, yoksa
takip etmen gereken tam kişi (teklif gönderdiğin ama henüz almamış müşteri)
listeden düşerdi.

**Arama** tek bileşen (`SearchBar`) ama her sayfa **kendi alanında** arıyor;
hangi sayfada ne arandığı `SEARCHABLE` tablosunda. Arama olmayan sayfada
kutu **hiç çizilmiyor**: çalışmayan bir arama kutusu, olmayan aramadan
kötüdür. Sayfa değişince sorgu temizleniyor — "pizza" arayıp başka sayfaya
geçip dönünce boş liste görüp "bozuk" sanmanın önüne geçiyor.

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
- **Dosya deposu yok.** Menü/fotoğraf/reklam ve hizmet tanıtımları data URL
  olarak localStorage'da; tarayıcı kotası ~5 MB. Gerçek dağıtımda yerine bir
  nesne deposu (S3/R2) + sunucuda onay tablosu gelir; arayüz `url` ve
  `status` okuduğu için değişmesi gerekmiyor.
- **Google reklam entegrasyonu yok.** Ödüllü videoda restoran videosu
  kalmadığında oynayan Google yedeği yer tutucu; AdSense/AdMob birimi
  `src/lib/rewarded.js` → `GOOGLE_FALLBACK` yanındaki TODO'ya bağlanacak.
  Akış tam çalışıyor, yalnızca reklamın kendisi gelmiyor.
- **Ödeme entegrasyonu yok** (iyzico/Stripe). GUR Plus ve ücretli özellikler
  arayüzde var, tahsilat yok.
- **Tek dil.** Arayüz yalnızca Türkçe; dil değiştirme seçeneği yok ve
  metinler bileşenlerin içinde sabit. Çok dil desteği i18n katmanı +
  metinlerin dışarı çıkarılması demek, ayrı bir iş.
- **Büyük yazı ölçeklenmiyor** (bkz. "BİLİNEN EKSİK" bölümü).
- Yasal metinlerdeki işletme bilgileri yer tutucu; yayına çıkmadan doldurulmalı.
- Artifact önizlemesi tanımı gereği YEREL modda çalışır: statik tek dosya,
  arkasında sunucu yok.
