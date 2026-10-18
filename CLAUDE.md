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

## ÜRÜN DÖRT YÜZEY + BİR MAĞAZA PAKETİ

| # | Yüzey | Nerede | Kim kullanır |
|---|---|---|---|
| 1 | **WEB SİTESİ — tüketici izleği** | `/` (`src/app/site.jsx`) | tüketici (indirmeye gider) |
| 1 | **WEB SİTESİ — işletme izleği** | `/isletme/*` (Doyurucu) | restoran sahibi |
| 2 | **Tüketici uygulaması** | `/uygulama` (`src/app/GurApp.jsx`, telefon çerçevesinde) | tüketici |
| 3 | **Yönetici paneli** | `/admin` | GUR ekibi |
| — | **Mağaza paketi** | `mobile/` (Expo, App Store + Google Play) | tüketici |

**TANITIM VE İŞLETME TEK SİTE.** İkisi bir dönem iki ayrı siteydi: iki
başlık, iki alt bilgi, iki gezinme, iki ayrı GUR logosu. Ziyaretçi `/`
ile `/isletme` arasında geçince başka bir ürüne geçmiş gibi oluyordu.
Artık aynı kabuk (`WebHeader` + `WebFooter`), yalnızca içeriği izleğe
göre değişiyor — ayrıntı "TEK SİTE, İKİ İZLEK" başlığında.

Dördü de önizlemede EŞİT AĞIRLIKTA, aynı şeritte.

**TÜKETİCİ UYGULAMASI GERİ GELDİ (5 Ekim sürümü).** Bir dönem
kaldırılmış, yerine `mobile/` Expo paketi geçmişti. Ama Expo'ya yalnızca
on ekran taşınmıştı; **22 bileşen taşınmadı** — GUR Match (üç ekran),
ödüllü reklam, GUR Plus / paywall, masa ayırtma + onay, yorum yazma,
ziyaret doğrulama, şef videosu, dış yorumlar, ilçe seçici, yasal
metinler, hero karusel. 4.476 satır 1.816'ya düşmüştü. Tam sürüm
`git checkout 533f4ed -- src/app/GurApp.jsx` ile geri alındı.

**KÖK YOL GENİŞLİĞE GÖRE DALLANMIYOR.** Eskiden `/` telefonda
uygulamayı, masaüstünde siteyi açıyordu ve hangisinin gerçek ürün olduğu
okunmuyordu. Artık iki ayrı adres: `/` anlatır, `/uygulama` çalışır.

**`mobile/` SİLİNMEDİ.** Mağazaya çıkacak paket o; tarayıcıdaki uygulama
onun yerine geçmiyor, önündeki eksik iş hâlâ yukarıdaki 22 bileşeni
React Native'e taşımak.

Bunların altında bir de **sunucu** var ama o bir arayüz değil, hepsinin
ortak zemini: mekan beslemesi, swipe motoru, bildirim cron'ları,
analitik toplama (`server/`).

## Çalıştırma

```bash
npm install
npm run db:setup && npm run db:seed   # PostgreSQL + şema + tohum veri
npm run dev:all                       # API (8787) + arayüz (5173)
```

Yalnız arayüz: `npm run dev`. Yalnız API: `npm run dev:api`.

- `/`          → **web sitesi, tüketici izleği** (mağazaya yollar)
- `/isletme`   → **web sitesi, işletme izleği** (tanıtım + kayıt + panel) — AYNI başlık ve alt bilgi
- `/uygulama`  → **tüketici uygulaması** (telefon çerçevesinde; gerçek telefonda çerçeve kalkar)
- `/admin`     → **yönetici paneli** (tam ekran masaüstü)

Doyurucu'nun alt yolları: `/isletme/kayit`, `/isletme/sahiplen`,
`/isletme/giris`, `/isletme/panel`.

Başka yol yok. Eski `/site` yer imleri `*` kuralıyla tanıtım sayfasına
düşüyor.

**DEMO HESAP YOK.** Yönetici hesabı yalnızca `ADMIN_PASSWORD` (en az 8
karakter; `ADMIN_USER` varsayılanı `admin`) ortamdan verilirse tohumda kurulur,
verilmezse tohum uyarı yazar ve hesap açmaz — varsayılan parola yok. Sunucu
yokken (YEREL mod, artifact önizlemesi) yönetici girişi de YOK: tarayıcıda
doğrulanan sabit bir parola gerçek koruma sağlamaz, yalnızca herkesin bildiği bir
kapı olurdu; panel sunucuya bağlıyken açılır. Tüketici kendi hesabını uygulamadan
açar, işletme kaydını sahiplenerek girer.

Derleme: `npm run build` → `dist/`. Lint: `npm run lint` (src + server + shared).

**Üç parça da TEMBEL yükleniyor** (`src/main.jsx`): yönetici paneli,
işletme uygulaması ve tüketici uygulaması. `/` yalnızca mağazaya yollayan
bir sayfa; uygulamanın 181 kB'ı orada boşuna inerdi. Artifact derlemesi
bunun TERSİNİ yapıyor (`scripts/artifact-main.jsx`) — tek dosyalık
önizleme ayrı parça yükleyemez, orada üçü de statik.

**Mağaza uygulaması:** `cd mobile && npm install && npx expo start`.
Ayrıntı ve mağazaya çıkarma adımları `mobile/README.md` içinde.

**Artifact önizlemesi:** `npm run artifact` → `dist/gur-preview.html` (tek dosya).
Elle derlemeyin: yönetici paneli `src/main.jsx` içinde `React.lazy` ile
yükleniyor, tek dosyalık artifact o ayrı chunk'ı bulamaz ve panel açılmaz.
Betik `GUR_ARTIFACT=1` ile tek parça derliyor ve çıktıda birden fazla JS
dosyası kalırsa hata veriyor.

**Dört yüzeyin dördü de bu tek dosyanın içinde** ve sol üstteki hap
şeridiyle geçiliyor (`scripts/artifact-main.jsx` → `ArtifactSwitcher`).
Bir dönem mağaza paketinin web dışa aktarımı ayrı bir iframe'de duruyor
ve dışarıda ikinci bir sekme şeridi çizen bir kabuk vardı
(`scripts/onizleme-kabuk.html` + `npm run onizleme`); tüketici
uygulaması bu derlemeye geri gelince gereksiz kaldı ve kaldırıldı. Expo
paketini önizlemek gerekirse: `cd mobile && npx expo export --platform
web` ve çıktıyı ayrı yayınlayın.

### Base44'te çalıştırma — dört parça tek origin

Depoda Base44 için hazır bir yığın var (`docker-compose.base44.yml`,
`.base44/environment.json`, `AGENTS.md`). Başlatma komutu
`.base44/environment.json` içinde yazılı ve yalnızca **3000** portu dışa
açık:

```
postgres ─ şema (schema.sql) ilk boot'ta uygulanır
   ↓
db-setup ─ tek seferlik: npm install + server/db/seed.js, biter
   ↓
api ─ node server/index.js  :8787
   ↓
web ─ vite :5173 → host 3000 ; /api'yi VITE_API_TARGET ile api'ye proxy'ler
```

**"Birbirine bağlı" olan şey tek origin.** Üç arayüz (`/`, `/isletme`,
`/admin`) aynı origin'den servis ediliyor, aynı `/api` yoluna gidiyor ve
aynı PostgreSQL'i okuyup yazıyor — yani mod **CANLI** olur ve veri
kullanıcılar arası paylaşılır. Bunu kaybederseniz uygulama kilitlenmez,
sessizce **YEREL**'e düşer: üç panel açılır, çalışır görünür, ama her
tarayıcı kendi localStorage'ında yaşar. Aradaki fark rozet dışında
görünmediği için "bağlı çalışmıyor" şikâyeti hep buradan çıkıyor.

Ölçüldü (docker olmadan, aynı topoloji): API + Postgres ayaktayken üç
arayüzün üçü de CANLI, `/api/health` `{"ok":true,"restaurants":218}`
döndürüyor ve istekler proxy üzerinden gidiyor (`canli.mjs`).

**Üç tuzak ve çözümleri:**

1. **`env_file: /run/base44/app.env` ZORUNLU olmamalı.** O dosyayı Base44
   çalışma anında enjekte ediyor; yerelde yok ve `docker compose up` hiç
   başlamıyor ("env file not found"), hata sebebi de söylemiyor. Yani aynı
   yığını yerelde ayağa kaldırıp hata ayıklayamıyorsunuz. Çözüm compose
   spec'inin `required: false` biçimi.
2. **`web`, `api`'nin HAZIR olmasını beklemeli.** Yalnızca
   `depends_on: - api` konteynerin BAŞLAMASINI bekler. İki konteyner de
   açılışta `npm install` çalıştırdığı için api dakikalarca cevap
   vermeyebiliyor; o aralıkta sayfayı açan herkes YEREL'e düşüyordu.
   `api`ye healthcheck + `condition: service_healthy` eklendi.
3. **Başarısız mod yoklaması artık kalıcı değil** (`lib/api.js`). Tek
   `probe` sözü hem başarıyı hem başarısızlığı önbelleğe alıyordu ve
   `boot()` bir kez çağrılıyordu: sunucu o 2.5 saniyede cevap vermezse
   uygulama OTURUM BOYUNCA yerel kalıyordu, sayfa yenilenmeden
   düzelmiyordu. Artık başarı önbelleklenir, başarısızlık arkadan
   3s/8s/20s aralıklarla üç kez yeniden yoklanır. **Yoklama başarınca
   `probe` de yerine konuyor** — yalnızca `mode`u güncellemek yetmiyordu,
   `ensureMode()` eski sözü döndürdüğü için rozet YEREL'de kalıyordu
   (ölçüldü). Mod rozetini çizen her yüzey `subscribeApi`ye abone olmak
   zorunda; mekanizma bir dönem vardı ama kimse abone olmamıştı.

Ölçüldü: API kapalıyken açılan sayfa YEREL'e düşüyor, API sonradan
başlatıldığında **sayfa yenilenmeden ~6 saniyede** CANLI'ya geçiyor
(`gecikmeli.mjs`).

**Yerelde docker olmadan aynısı:** `pg_ctlcluster 16 main start` →
`psql -f server/db/schema.sql` → `node server/db/seed.js` →
`DATABASE_URL=… node server/index.js` → `VITE_API_TARGET=http://127.0.0.1:8787
npx vite`. Tek origin yine Vite proxy'sinden gelir.

### Railway'de yayın — TEK servis + PostgreSQL

`npm start` = `node server/db/init.js && node server/index.js`. Sunucu
`dist/` varsa derlenmiş arayüzü de servis ediyor (`server/src/http/static.js`):
SPA düşüşü (`/isletme/panel`, `/admin`, `/uygulama` → `index.html`), hash'li
`assets/` bir yıl önbellekte, HTML ve `sw.js` ASLA; `/api` altında bilinmeyen
uç JSON 404, uzantılı eksik dosya 404 (HTML ile maskelenmez). Böylece Caddy /
nginx gerekmeden tek origin → uygulama CANLI.

`init.js` setup.sh'in barındırma karşılığı (`su postgres` yok): şema yoksa
`schema.sql`, Bakırköy listesi boşsa tohum, `ADMIN_PASSWORD` verilmiş ama
yönetici yoksa o da. Var olan veriye dokunmaz, her açılışta güvenle tekrarlanır.
`railway.json`: derleme `npm install --include=dev && npm run build` (vite
devDependency; `NODE_ENV=production` DEĞİŞKENİ yazmayın, yoksa derleme aracı
kurulmaz), sağlık yolu `/api/health`.

Gerekli değişkenler: `DATABASE_URL` (Postgres eklentisinden `${{Postgres.DATABASE_URL}}`
referansı), `ADMIN_PASSWORD` (≥ 8), `SESSION_SECRET` (uzun rastgele; yoksa her
yeniden başlatmada herkes oturumdan düşer). Eklentiler (`cube`, `earthdistance`,
`pgcrypto`, `citext`) bağlanan rolün kurabilmesini ister — Railway'in Postgres'inde
kurabiliyor; başka yönetilen veritabanında rol yetkisi gerekir.

Ölçüldü (yerel, süper kullanıcı rolüyle, taze veritabanı): şema + 218 kayıt +
yönetici kuruldu, `/api/health` 200, `/`, `/admin`, `/isletme/panel` HTML,
yönetici paneline giriş çalıştı; ikinci açılış "veri hazır". **Railway'in
kendisinde denenmedi.** Dosya deposu yok: yüklemeler tarayıcı deposunda
(bkz. "Bilinen kısıtlar"); Railway disk'i geçici, sunucuya dosya yazmıyoruz.

### İki mod: canlı ve yerel

Uygulama açılışta `/api/health` yoklar ve sağ üstte hangi modda olduğunu
gösterir:

- **CANLI** — sunucu ayakta. Kimlik, deste, kaydırma, ziyaret, yorum ve
  sahiplenme PostgreSQL'e yazılır; kota ve kampanya ücretlendirmesi sunucuda.
- **YEREL** — sunucu yok (artifact önizlemesi, çevrimdışı). Aynı akışlar
  localStorage üzerinde yürür, hiçbir ekran kilitlenmez.

Dallanma tek yerde: `src/lib/backend.js`. Ekranlar "sunucu var mı" diye
sormaz, bu cepheyi çağırır.

### `main` dalı AYRI BİR SOY — geçmişe katıldı, içeriği alınmadı (17 Ekim)

GitHub'da `main` ile çalışma dalı (`claude/app-runnable-version-3vkqoa`)
**aynı soydan değil**: ortak ata 27 Ağustos'taki `9755473` ("Add files via
upload"), çalışma dalı o noktadan 78 commit ilerledi. `main`'e 17 Ekim'de
başka bir araçla (Google AI Studio benzeri; `metadata.json`, solution id
`gmp_mcp_codeassist_v1_aistudio`) iki commit eklendi: kökte `server.ts`
(Express 5 + JSON dosyası) ve Google Maps bağlantısı.

**KARAR: kendi `server/` backend'imiz geçerli; `main` geçmişe katıldı ama
çatışan her dosyada BİZİM sürüm kaldı.** Birleştirme 7 dosyada çatıştı
(`GurApp.jsx`, `GurAdmin.jsx`, `main.jsx` kökten `src/` altına taşınmış;
`package.json`, `vite.config.js`, `.env.example`, `index.html`). Hepsi
çalışma dalı lehine çözüldü: `package.json` `dev` komutu `vite` kaldı
(`main` onu `tsx server.ts` yapıyordu ve PostgreSQL düzenini bozuyordu),
`vite.config.js` proxy'li kaldı. `index.html`de yalnızca `og:title` /
`og:description` etiketleri `main`'den alındı. `main`'in Google Maps rozeti
ve veri kaynağı anahtarı `GurApp.jsx`te YOK; `main` geçmişinde duruyor.
`server.ts` ve `bun.lock` bilerek alınmadı (aşağıdaki tablo + anahtar
uyarısı); `.gmp_cache/` ve `metadata.json` kayıtsız bir şekilde geldi, hiçbir
kod bunları okumuyor. Çalışma dalındaki backend'de Places beslemesi zaten var
(`server/src/ingestion/providers.js`): kimlik `(provider, external_id)`
ile sabit, alan maskesi yazılı, Gastro otomatik atanmıyor.

**Gerçek restoran verisi nasıl gelir:** `.env`'e **yeni ve kısıtlı** bir
`GOOGLE_PLACES_API_KEY` yazılır, `npm run db:seed` ya da sunucunun açılış
beslemesi çalışır — **ama dış besleme artık varsayılan KAPALI**
(`GUR_INGESTION=1` cron'u, `GUR_SEED_INGEST=1` tohumdaki turu açar): ana data
Bakırköy listesi ve besleme aynı mekânları farklı kimlikle ikinci kez yazar.
Anahtar yokken sağlayıcı sessizce `[]` döner ve yalnızca liste (218 mekân)
kalır — ölçüldü: `fromApi: 0`, `/api/health` `{"ok":true,"restaurants":218}`.

`main`'deki `server.ts` çalıştırıldı ve doğrulandı (4 sorgu, 32 gerçek
İstanbul restoranı geldi), ama **olduğu gibi alınmamalı**:

| Sorun | Neden önemli |
|---|---|
| `NODE_ENV=production` ile açılışta çöküyor (`app.get('*')`, Express 5'te geçersiz) | canlıya alınamaz; denendi |
| Puanı ≥ 4.7 olan her mekâna **"Gastro Onaylı"** etiketi basıyor | rozet şef değerlendirmesine dayanır, puanla verilemez; gerçek işletmeler hakkında yanlış iddia |
| `dist` sahte: 6 değerlik listeden sırayla dağıtılıyor | koordinat gerçekken yanlış mesafe yazılıyor |
| `menu` rastgele stok fotoğraf (`generateProbableMenu`) | gerçek menü değil |
| `id: index + 1` | sıra değişirse favori/rezervasyon yanlış mekâna bağlanır; 1–15 tohum kimlikleriyle çakışır |
| `rating`, `userRatingCount`, yorum metni, koordinat için uydurma yedek değerler | veri yokken sayı üretiyor |
| `hours` yalnızca Pazartesi satırı | diğer günler yanlış |
| `POST /api/restaurants/sync` kimlik doğrulamasız, `cors()` açık | herkes anahtarla faturalı istek tetikler |
| `/api/places/photo` gelen `name`'i doğrulamadan Google adresine ekliyor | anahtarla açık vekil (kod okunarak; denenmedi) |

**API ANAHTARI `main`'in git geçmişinde** (`server.ts` 21. satır, yedek
değer olarak). Anahtarı Google Cloud'dan yenileyin ve kısıtlayın; bu
dosyaya ya da başka bir yere elle yazmayın. Eski anahtar bu depodaki hiçbir
yolda kullanılmadı.

**Google Places koşulları:** genelde yalnızca `place_id`'nin süresiz,
koordinatların 30 güne kadar saklanmasına izin veriliyor; ad, puan, yorum ve
fotoğrafın kalıcı saklanması kısıtlı. Yayına almadan resmi koşullardan teyit
edin — `restaurant_sources.payload` saklaması da bu kapsama girebilir.

### Bakırköy listesi: ANA DATA, 218 kayıt, tek kaynak (18 Ekim)

**Bu liste mekân havuzunun TAMAMI.** Eskiden elle yazılmış 15 demo mekân
(Nusr-Et, Mikla, Çiya Sofrası…) vardı; kaldırıldı. `data/restaurants.js` →
`RESTAURANTS`, yönetici `RESTAURANTS`i, mobil paketin tohumu ve sunucu tohumu
yalnızca bu 218 kaydı içeriyor. YEREL modda Overpass'ten Kadıköy mekânı
çekip havuzun yerine koyma da kaldırıldı (`fetchLiveRestaurants` hâlâ dosyada
ama çağrılmıyor); varsayılan başlangıç noktası Bakırköy merkezi
(`geo.DEFAULT_ORIGIN`).

**DEMO YOK.** Yönetici panelindeki uydurma müşteriler, satın alımlar
(`STORE_SERVICES`), kampanyalar (`CAMPAIGN_SEED`), kullanıcılar (`USERS`) ve
sahiplenme başvuruları (`APPLICATIONS`); tüketici uygulamasındaki anlık
fırsatlar (`DEALS`), yerel kampanyalar (`LOCAL_CAMPAIGNS`), uydurma yorumlar;
sunucu tohumundaki kampanyalar, demo tüketici ve varsayılan yönetici parolası
KALDIRILDI. Gerçek işletmeler adına uydurma ticari ilişki, indirim ya da yorum
göstermek yanlıştı. Tüketici destesi YEREL modda yalnızca organik kartlardan
oluşur; sponsorlu kart ve fırsat gerçek bir reklamveren olunca sunucudan gelir.
Gastro Onaylı da yok (yönetici panelinden elle verilebilir).

**İşletme paneli yönettiği mekânı sahiplenmeden açılmaz.** Eskiden oturum
sahiplenme olmadan da açılıyor, `findOwnerRestaurant` bir demo işletmenin
panelini gösteriyordu. Artık o fallback yok: sahiplenmemiş oturum girişten
sonra `/isletme/sahiplen`e yönleniyor, doğrudan `/isletme/panel`e gelen "Henüz
yönettiğiniz bir mekân yok" boş durumunu görüyor. (Not: `/isletme/kayit` ile
havuzda olmayan yeni bir işletme kaydı henüz bir mekâna bağlanmıyor — kayıt
akışı mekân kaydı üretmiyor, o da sahiplenmeye yönlenir.)

**Artifact önizlemesinde yönetici sekmesi giriş ekranında kalır** (sunucu yok);
işletme sekmesinde sahiplen → panel yolu çalışır.

Dış kaynaktan çekilen **Bakırköy kafe/restoran tablosu** (`.xlsx`, Google
Maps taraması, 4 km yarıçap) havuza alındı. Tek kaynak `shared/bakirkoy.js`
(ÜRETİLMİŞ dosya, elle düzenlemeyin); tablo değişince:

```bash
npm run leads:import -- yeni-tablo.xlsx   # scripts/bakirkoy-iceri-al.mjs
npm run db:seed                            # CANLI modda sunucuya yazar (kopya üretmez)
```

Aynı 218 kaydı dört yer okuyor ve **kimlik hepsinde `bkr-<anahtar>`**:
tüketici uygulaması + işletme sahiplenme listesi (`data/restaurants.js` →
`HAVUZ`), yönetici paneli Mekan Havuzu (`GurAdmin.jsx` → `RESTAURANTS`),
sunucu (`server/db/seed.js` → `seedBakirkoy`, kaynak `(manual, bakirkoy:<anahtar>)`).
Hepsi **dış kaynaklı, sahiplenilmemiş, Gastro'suz** (rozet puanla verilmez). Yönetici panelinde hepsi Mekan Havuzu'nda (`account: false`).

**TABLODA OLMAYAN HİÇBİR ŞEY UYDURULMADI.** Koordinat, çalışma saati, fiyat
düzeyi, fotoğraf, menü ve açıklama tabloda yok. Sonuçları:

| Alan | Kayıtta | Ekranda |
|---|---|---|
| koordinat | `lat`/`lng` **null**; yalnızca `area` = Bakırköy İLÇE merkezi | mesafe yazılmıyor, `dist` yerine "Bakırköy"; yol tarifi isimle arama |
| saat | null | "Bugün …" satırı, saat etiketi, "Açık" / "Aç" durum çipleri **çizilmiyor** (saati olmayana açık denmez) |
| fiyat | null | fiyat çipi çizilmiyor (`hydrate` artık `"₺₺"` uydurmuyor) |
| fotoğraf / menü | yer tutucu (picsum, diğer havuz kayıtlarıyla aynı) / boş | — |
| açıklama | `"Pizza · Zeytinlik, Bakırköy."` (tablodaki tür + mahalle) | — |

**Kategori tahmindir.** Tablonun kendi notu: "Tür isimden tahmin edilmiştir".
`tur` ham hâliyle saklanıyor, `kategori` onun GUR kategorisine eşlemesi
(Meyhane → Alkollü, Pastane → Tatlıcı, Kebap/Ev yemekleri/Lokanta → Türk
Mutfağı…). Betik yalnızca varsayılana ("Restoran / Lokanta") düşmüş ve adında
açık bir kahve/kafe sözcüğü geçenleri düzeltiyor (Espressolab). Tabloda restoran
olmayan birkaç kayıt var (belediye parkı, AVM, "Midpoint Capacity"); silinmedi,
ayıklamak yönetici panelinden gizleme anahtarıyla yapılır.

**İLÇE MERKEZİ SIRALAMA İÇİN, KONUM DEĞİL.** `shared/deck.js` →
`orderByProximity`: kaydın kendi koordinatı yoksa ama `area`sı varsa halka o
noktadan hesaplanıyor (Bakırköy'deki kullanıcı onları yakın görür), ama
`distanceKm` null kalıyor. Koordinatsız kaydı herkesin en sonuna atmak, ilçesi
belli bir mekânı o ilçedeki kullanıcıya hiç göstermemek demekti.

**Sunucuda `location_exact` (migration 005).** `restaurants.lat/lng` NOT NULL
olduğu için kayıtlar ilçe merkeziyle yazılıp `location_exact = false`
işaretleniyor. Bayrağın kuralı: API kartta `lat`/`lng`/`dist` boş gider, yalnızca
`area` gider (`shapeCard`); **ziyaret doğrulaması bu kayıtları hiç eşleştirmez**
(`visits/tracker.js` — yoksa ilçe merkezinin 120 m'sinde duran biri rastgele bir
mekâna "Konumla doğrulandı" rozeti kazandırırdı). İşletme sahiplenip gerçek
koordinatı girdiğinde bayrak true olmalı (henüz bağlı değil).

**Gastro Onaylı YOK, uydurma yorum YOK.** Eski tohumdaki `seedGastro` ve örnek
dış yorumlar kaldırıldı: puanı 4.9, yorumu binlerce olan Bakırköy kayıtları
"Gastro Onaylı" olurdu (`main`'deki `server.ts`in hatasının aynısı) ve gerçek
işletmelerin altında "örnek" yorumlar çıkardı. Aynı sebeple tüketici detay
sayfasındaki dört sabit uydurma yorum ("A.O.", "Elif K."…) ve profildeki
`MY_REVIEWS` kaldırıldı; yorum bloğu yalnızca kullanıcının yazdıkları varken
çiziliyor, dış kaynak yorumları ayrı blokta ve kaynağı yazılı. Gastro rozeti
yönetici panelinden elle verilebilir (`toggleGastro`). Ölçüm: tohum sonrası
Gastro 0, dış yorum 0.

**CANLI modda tüketici beslemesi boş kalıyordu — düzeltildi.** `GurApp`
sunucudan gelen listeyi de yerel moderasyon kuyruğundan (`kuyrugaAl`)
geçiriyordu; sunucu kimlikleri UUID olduğu için tohum listede yok, hepsi
"bekliyor" sayılıp ekranda "Burada henüz mekan yok" çıkıyordu (5 Ekim
sürümünden beri). CANLI'da yayın kararı sunucuda (`review_status`): liste artık
kuyruktan geçmiyor, sunucu da deste / arama / kampanya sorgularında
`review_status = 'approved'` süzüyor. Havuz isteği `limit: 300` (önceden 40:
218 kayıtın büyük kısmı hiç gelmezdi). **Ölçek notu:** bu tek istekle tüm
listeyi çekmek birkaç yüz kayıtta uygun; binlerce kayıtta sayfalama gerekir.

**Bilinen eksikler.**
- Koordinat yok → mesafe, ziyaret doğrulaması ve harita pini bu 218 kayıt için
  çalışmıyor. Çözüm: `GOOGLE_PLACES_API_KEY` ile besleme turu ya da tabloya
  koordinat sütunu. Besleme gelirse `upsertPlace` yalnızca `(provider,
  external_id)` ile eşleştiği için aynı mekân **ikinci kez** yazılır (ad
  benzerliği eşleştirmesi yalnızca tek turun içinde `dedupe`de var) — o zaman
  önce eşleştirme yazılmalı.
- E-posta sütunu tamamen boş; Instagram 14, Facebook 1 kayıtta dolu. Sunucuda
  bu iki sütun yok, yalnızca ham `payload`da duruyor.
- 7 haneli yerel numaralara alan kodu **212** eklendi (Bakırköy Avrupa yakası).
- **Kaynak koşulları.** Tablonun notu "Google Maps (gosom scraper)" diyor. Google
  Maps'in koşulları taramayı ve puan/yorum sayısının kalıcı saklanmasını
  kısıtlıyor (yukarıdaki Places koşulları uyarısıyla aynı konu); yayına almadan
  önce teyit edin. Tablodaki puan ve yorum sayısı bu yüzden en riskli alanlar.

## Proje yapısı

```
gur/
├── index.html                 # Giriş; fontlar bloke etmeden yüklenir
├── shared/                    # İSTEMCİ VE SUNUCUNUN ORTAK KULLANDIĞI SAF MODÜLLER
│   ├── bakirkoy.js            # ÜRETİLMİŞ: Bakırköy listesi, 218 kayıt (npm run leads:import)
│   ├── deck.js                # buildDeck / rankCampaigns / quotaState / orderByProximity
│   ├── second-chance.js       # paket kotası ve günlük tekrar engeli
│   └── deeplink.js            # harita derin bağlantıları, Haversine
├── server/                    # Node tarafı (bkz. server/README.md)
│   ├── index.js               # giriş: HTTP + cron + ilk besleme
│   ├── db/setup.sh            # rol + veritabanı + eklenti + şema
│   ├── db/schema.sql          # tam şema (tek migration, 26 tablo; migrations/ = canlı veritabanları için ekler)
│   ├── db/seed.js             # tohum veri; önce gerçek beslemeyi dener
│   ├── db/queries/cohorts.sql # retention / kohort / LTV toplama sorguları
│   └── src/
│       ├── http/{server,routes}.js   # çerçevesiz router + API uçları
│       ├── auth/{session,password,social}.js
│       └── {ingestion,swipe,visits,notifications,analytics}/, cron.js
├── mobile/                    # MAĞAZA UYGULAMASI (Expo / React Native)
│   ├── app.json               # mağaza kimliği, simgeler, izin metinleri
│   ├── eas.json               # derleme profilleri
│   ├── metro.config.js        # depo kökündeki shared/ + data/ dosyalarını görür
│   └── src/{tema,api,depo,veri,konum}.js + bilesen/ + ekran/
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
    │   ├── magaza.js          # App Store / Google Play adresleri — TEK YER
    │   ├── invites.js         # havuz daveti: kanal seçimi + mailto taslağı
    │   ├── geo.js             # konum izni, elle ilçe seçimi, başlangıç noktası
    │   ├── moderation.js      # yayın öncesi onay kuyruğu (mekan + alan değişikliği)
    │   ├── requests.js        # işletmenin teklif talepleri (satın alma YOK)
    │   ├── adcontent.js      # uygulama içi GUR reklam görselleri (yönetici değiştirir)
    │   ├── adslots.js        # SABİT FİYAT + takvim rezervasyonu (banner/video/push)
    │   ├── rewarded.js       # ödüllü video seçimi: yakınlık, tekrar yok, Google yedeği
    │   ├── creatives.js       # hizmet TANITIMI (yönetici yükler, işletme görür)
    │   ├── media.js           # işletme dosyaları: menü/foto/reklam + ONAY KUYRUĞU
    │   ├── import-restaurants.js  # Excel/CSV ile toplu restoran yükleme
    │   ├── second-chance.js   # haftalık yeniden gösterim paketi + geçilenler
    │   └── social-auth.js     # Google / Apple ile giriş
    ├── app/
    │   ├── site.jsx           # TANITIM SİTESİ: anlatır + mağazaya yollar
    │   └── GurApp.jsx         # TÜKETİCİ UYGULAMASI (/uygulama, telefon çerçevesinde)
    ├── business/
    │   ├── site.jsx           # İŞLETME WEB SİTESİ: başlık, tanıtım, alt bilgi
    │   └── GurBusiness.jsx    # Doyurucu: yönlendirme, kayıt akışı, panel
    └── admin/GurAdmin.jsx     # Yönetici paneli
```

## Mimari notlar (ÖNEMLİ)

### Veri katmanı: web yüzeyleri depoyu, mobil SUNUCUYU paylaşır

İki web yüzeyi (kayıt sitesi + yönetici paneli) ayrı uygulamalar ama
aynı kayıtları okuyup yazıyorlar. Bağ ekranlarda değil depolarda:

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

**MOBİL UYGULAMA BU DEPOLARI PAYLAŞMAZ.** Telefondaki uygulamanın kendi
kumbarası var (AsyncStorage) ve web yüzeyleriyle tek bağı SUNUCU:
`/api/...`. Yani YEREL modda (sunucu yokken) mobil uygulama ile tarayıcı
sekmeleri birbirini görmez — bu kasıtlı, iki ayrı cihazın localStorage'ı
zaten paylaşılamaz. CANLI modda dördü de aynı PostgreSQL'i okur.
Ölçüldü (`butunluk.mjs`): siteden gönderilen sahiplenme başvurusu
`gur.claims`e düşüyor, yönetici panelinde adıyla görünüyor ve yöneticinin
görünürlük anahtarı gerçekten yazıyor (GİZLİ rozeti).

### TELEFON MAKETİ — yalnızca `/uygulama` için
390×844'lük `PhoneFrame` ve `.gur-stage` / `.gur-frame` / `.gur-notch`
kuralları tarayıcıdaki tüketici uygulamasının kabuğu. Bir dönem
kaldırılmıştı — o sırada tarayıcıda tüketici uygulaması yoktu ve
kullanılmayan bir kabuk kalıyordu; uygulama geri gelince maket de geri
geldi. **Başka hiçbir yüzey telefon taklidi etmiyor**: tanıtım sitesi,
işletme sitesi ve yönetici paneli tam genişlikte.

**GERÇEK TELEFONDA ÇERÇEVE YOK.** Dar (< 440 px) ya da dokunmatik-kısa
ekranda medya kuralı maketi kaldırıyor: sahte çentik gerçek çentiğin
altına düşüyor, 844 px'lik kutu 667 px'lik ekranı taşırıp sayfayı
kaydırıyor ve alt bar ekran dışında kalıyordu. Kurallar `!important`,
çünkü uygulama satır içi stille yazılı ve satır içi stil sınıf kuralını
yener. Ölçüldü: 393×852'de çerçeve 393×852'ye açılıyor, masaüstünde
390×844 kalıyor.

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
| `plainOnDark` | KOYU zeminde düz hap |

**`plainDark` ADI YANILTICI**: oradaki "dark" MÜREKKEBİ anlatıyor, zemini
değil — beyaz kâğıt içindir. Koyu panelde kullanıldığında marka mürekkebi
siyaha yakın zeminde **3.64:1** veriyordu (ölçüldü, beş yerde). Koyu zemin
için `plainOnDark` var; mürekkebi paletin koyu-zemin tonu (`#FF9A4D`).

**Yumuşak turuncu zeminde metin `--c-brand-ink-soft`** (`#A84D09`).
`--c-brand-ink` kâğıtta 5.02:1 ama %8–10 turuncu tintin üstünde 4.4'e
düşüyor; `brandSoft` hapı ve sitedeki çipler bu jetondan okuyor.

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

### Mağaza uygulaması (`mobile/`) — WebView kabuğu DEĞİL

Tüketici uygulamasının App Store ve Google Play'e çıkan sürümü
`mobile/` altında: **Expo SDK 58 / React Native 0.88**, yerli ekranlar,
yerli dokunma hareketleri (Gesture Handler + Reanimated), yerli konum
izni. Web sitesini saran bir `WebView` paketi değil — Apple'ın 4.2
"Minimum Functionality" kuralı öyle bir paketi zaten reddediyor.

**TEK VERİ KATMANI MOBİLDE DE GEÇERLİ.** Uygulama webdekiyle aynı
sunucuya bakıyor (`mobile/src/api.js` → `/api/...`) ve saf kurgu
modüllerini KOPYALAMIYOR: `shared/deck.js` (deste + yakınlık sıralaması)
ile `shared/deeplink.js` (harita bağlantıları) depo kökünden
okunuyor. Metro bunu `mobile/metro.config.js` → `watchFolders` ile
yapıyor; `disableHierarchicalLookup` de açık, yoksa metro depo
kökündeki WEB bağımlılıklarına (react-router, motion, ikinci bir react)
ulaşır ve iki react kopyası yüklenirdi.

Kopyalamanın bedeli somut: sponsorlu kart aralığı webde 5-7, mobilde
başka bir şey olurdu ve kimse fark etmezdi.

**Jetonlar birebir aynı** (`mobile/src/tema.js`): aynı turuncu, aynı
kremsi kâğıt, aynı üç katmanlı gölge ölçeği, aynı Poppins + Outfit.
React Native'de `var()` yok, bu yüzden jetonlar düz bir JS nesnesi —
yönetici panelinin `C`si gibi. Gölgeler `boxShadow` ile yazılıyor (RN
0.76+ CSS söz dizimini kabul ediyor), böylece ÜÇ KATMAN korunuyor; tek
katmanlı `shadowRadius` kartı kâğıda yapıştırılmış bir leke gibi
gösteriyordu.

**Kaydırma hareketi Apple'ın akışkan arayüz ilkeleriyle**
(`bilesen/KaydirmaKarti.js`): 1:1 takip, kesilebilirlik, bırakma hızının
yaya devri, momentum izdüşümü (`(v/1000)·r/(1-r)` — fizik kitabındaki
`v²/2a` DEĞİL) ve dikey eksende lastik bant. "Aşağı" bir karar
taşımadığı için kart oraya kaçmıyor, kademeli olarak direniyor.

**10 px histerezis AÇIKÇA yazılı** (`activeOffsetX/Y`). Varsayılana
bırakıldığında hareket bazı ortamlarda hiç etkinleşmiyordu: `onBegin`
geliyor, `onUpdate`/`onEnd` hiç gelmiyordu (ölçüldü). Dokunuş ile
sürükleme `Gesture.Exclusive` ile ayrılıyor — `Simultaneous` ikisini
birden tanımaya çalışıp karar anını bulanıklaştırıyordu.

**Simgeler gerçek Poppins ile üretildi.** `assets/` altındaki mağaza
simgesi, Android uyarlanabilir simgesi ve açılış görseli GUR kelime
markasının kendi renkleriyle (G `#FFA500` · U `#FF6600` · R `#FF0000`)
çiziliyor. Android ön katmanında marka küçük: uyarlanabilir maske dış
%33'ü kesebiliyor.

**Ürün kuralları web ile aynı** ve mobilde de ölçüldü: üç yön üç karar,
konum ekranında üç yol eşit ağırlıkta, rıza bir modal, doğrulama her iki
modda, ham koordinat gönderilmiyor, dokunma hedefi ≥ 44 px, pasif durum
`opacity` ile kurulmuyor, masa ayırtma ücretsiz ve yalnızca
sahiplenilmiş mekanlarda açık.

**Ölçüm.** Gerçek cihaz/simülatör bu ortamda yok; doğrulama
`npx expo export --platform web` çıktısı üzerinden yapıldı (aynı bileşen
ağacı, aynı düzen kodu). 393×852'de: on ekranın onu da çiziliyor, yatay
taşma 0 px, 44 px altında dokunma hedefi yok, boş formla giriş
engelleniyor, **sağa sürükleme kartı ilerletip mekanı favorilere
yazıyor**, sola sürükleme geçiyor. Dokunsal geri bildirim, konum izni ve
mağaza paketlemesi yalnızca gerçek cihazda doğrulanabilir.

**Henüz bağlanmamışlar** (arayüzde de yazıyor, "var gibi"
gösterilmiyor): Google/Apple ile giriş (ikisi de anahtar istiyor ve App
Store kuralı gereği biri varsa diğeri de olmalı), konum doğrulamalı
yorum YAZMA adımı, push bildirimi, ödüllü video ve GUR Plus.

### TEK SİTE, İKİ İZLEK — ortak başlık ve alt bilgi

`src/app/site.jsx` → `WebHeader` ve `WebFooter` **iki izlekte de** çiziliyor;
işletme sitesinin kendi `SiteHeader` / `SiteFooter`i KALDIRILDI.

**Karar tek satırda ve YOLDAN okunuyor**: `yer.pathname.startsWith("/isletme")`.
Prop olarak geçirilseydi bir sayfada yanlış vermeyi unutmak iki gezinmenin
birbirine yalan söylemesi demekti.

| | Tüketici izleği (`/`) | İşletme izleği (`/isletme*`) |
|---|---|---|
| Gezinme | `MENU` — İndir · Nasıl çalışır · Uygulamada ne var · Gizlilik · SSS | `ISLETME_MENU` — Nasıl çalışır · Ne kazanırsınız · Ücretlendirme · SSS |
| Turuncu eylem | Uygulamayı indir | Ücretsiz kayıt ol |
| İkincil eylem | İşletmeler | Giriş yap |
| Logo yanı | — | `İŞLETME` etiketi |

**Logo her iki izlekte de `/`ye gider** — site kökü orası. İşletme
izleğinde logonun yanında "İŞLETME" yazıyor: aynı başlık iki yerde
kullanılınca kullanıcının hangi bölümde olduğunu bilmesi gerekiyor.

**"GİRİŞ YAP" TEK KAPI VE OTURUMA GÖRE DEĞİŞMİYOR.** Bir dönem oturum
açıkken yerine **"Panele dön"**, yanına da **"Çıkış"** geliyordu: aynı
düğmede üç ayrı etiket dönüyor, giriş kapısı oturumu olanda hiç
görünmüyordu ve "panel" kelimesi kapıdan önce geliyordu. Şimdi düğme hep
aynı şeyi diyor ve hep `/isletme/giris`e götürüyor.

**Kapı iki yönlü** (`GurBusiness` → `useEffect`):

| Durum | Nereye |
|---|---|
| oturum yok + `/isletme/panel` | `/isletme/giris` |
| oturum **var** + `/isletme/giris` | `/isletme/panel` |

İkincisi olmasaydı oturumu olan kullanıcı "Giriş yap"a basınca boş bir
form doldururdu. İkisi de `replace`: geri tuşu aynı kapıya tekrar
çarpmasın.

**Çıkış panelin kendi kenar çubuğunda**, site başlığında değil: oturumu
kapatmak sitede değil üründe yapılan bir iş. Başlık da bu yüzden oturum
durumunu hiç bilmiyor — prop almıyor, `localStorage` okumuyor.

**Giriş formunda DEMO künyesi YOK** (eskiden `DEMO_ISLETME` rozeti vardı,
kaldırıldı). Form HER İKİ MODDA doğrulanıyor: geçerli e-posta + en az 6
karakter parola, aksi hâlde `role="alert"` ile sebep yazılı. YEREL modda
gerçek hesap kaydı yok, bu yüzden geçerli biçimli her e-posta kabul ediliyor
(siteden kayıt olan kendi yazdığıyla girebilmeli); gerçek doğrulama CANLI
modda sunucuda. Giriş sonrası yönetilecek mekân yoksa sahiplenme sayfasına
gidiliyor (bkz. "DEMO YOK").

**Dar ekranda pilde yalnız BİRİNCİL eylem var**, ikincisi menünün içinde:
ikisi de sığmıyor ve sıkıştırmak ikisini de 44 px'in altına düşürüyordu.

**Yüzen ada SABİT ve yer kaplamıyor.** Eski işletme başlığı `sticky` idi ve
akışta yer tutuyordu; ortak başlık `fixed`, o yüzden üst payı
`GurBusiness` veriyor (94 / 78 px). Panelde pay da yok, başlık da.

**PANEL BU KABUĞUN DIŞINDA** (`/isletme/panel`): kendi başlığı ve koyu
teması var, iki gezinme şeridi üst üste hangisinin ana olduğunu sildirir.

Alt bilgi tek ve espresso: marka künyesi + **İndir** (mağazalar) +
**İşletmeler** (ne sunuyoruz / kayıt / sahiplen / giriş). İşletme alt
bilgisindeki satırların hepsi buraya taşındı, hiçbiri kaybolmadı.

### Tanıtım web sitesi (`/`) — işi İNDİRTMEK

Site tek genişlikte tek şey yapıyor: GUR'un ne olduğunu anlatıp
ziyaretçiyi App Store / Google Play'e yollamak. Tarayıcıda açılan bir
tüketici uygulaması olmadığı için "uygulamayı aç" diye bir yol da yok —
tek birincil eylem indirme.

**İki mağaza adresi TEK YERDE**: `src/lib/magaza.js` → `MAGAZA.ios` /
`MAGAZA.android`. Yayına çıkarken yalnız o iki satır doldurulacak; ada
gezinmesindeki hap, kahramandaki eylem satırı, `#indir` bölümü, alt bilgi
ve **işletme sitesinin alt bilgisi** aynı iki adrese bakıyor ve
kendiliğinden gerçek bağlantıya dönüyor
(`target="_blank" rel="noopener noreferrer"`).

Kendi modülünde duruyor, tanıtım sayfasının içinde değil: işletme sitesi
de aynı adresleri okuyor ve `src/app/site.jsx`ten içe aktarsaydı 900
satırlık tanıtım sayfası işletme parçasına da girerdi. `site.jsx` ikisini
yeniden dışa aktarıyor, eski içe aktarmalar kırılmasın diye.

**BOŞKEN SAHTE BAĞLANTI ÜRETİLMİYOR.** Olmayan bir mağaza sayfasına
götüren rozet, rozetin hiç olmamasından kötü: kullanıcı tıklar, 404
görür ve ürünün var olmadığını sanır. Adres boşken rozet **tıklanamaz**
bir "YAKINDA" çipi; devre dışı hap değil (pasif durumu `opacity` ile
kurmak yasak), fark renkle ve etiketle. Alt bilgide de eylemi olmayan
satır düğme değil düz metin.

Apple logosu `SocialAuthRow`daki yolun aynısı; Google Play üçgeni
Google'ın kendi marka renklerinde (paletin kural dışılarından).

Dosya `src/app/site.jsx`: tanıtım sayfası (`TuketiciLanding`), yüzen ada
gezinmesi (`WebHeader`), alt bilgi (`WebFooter`) ve mağaza rozetleri
(`MagazaRozetleri`). `GurStyles` BURADA DA çiziliyor — jetonlar oradan
geliyor ve sayfa ayrı bir rota: olmadan `var(--c-bg)` çözülmüyor, satır
içi `background` geçersiz kalıyor ve `index.html`in koyu gövde zemini
(`#0d0d1a`) sayfanın tamamını yutuyordu (ölçüldü: kâğıt siyah çıktı).

#### Tasarım dili: kılavuz vs proje

Katman `high-end-visual-design` kılavuzuyla kuruldu; panoda olduğu gibi
kılavuzun bazı maddeleri projenin kendi kurallarıyla çakıştı ve
çakışanlarda **proje kazandı**:

| Kılavuz | Proje | Sonuç |
|---|---|---|
| Tailwind | satır içi stil, Tailwind YOK | satır içi stil |
| Geist / Clash Display | Poppins + Outfit | Poppins + Outfit |
| Phosphor / Remix ikon | `kit.jsx` → `Icon` | kendi kiti |
| OLED siyah + mor/yeşil küre | yeni renk ailesi yok | kremsi kâğıt + turuncunun %6'sı |
| `blur(md)` → `blur(0)` giriş | yalnız `transform` + `opacity` | blur animasyonu yok |

Uygulananlar: **Editorial Luxury** doku (kremsi kâğıt + sabit film greni
+ yüksek kontrastlı iri başlık), kahramanda **Editorial Split**,
özelliklerde **asimetrik bento** (2+2 · 2+1+1), her kartta **çift bizel**
(dış tepsi `--c-bg-2`, iç çekirdek beyaz, eş merkezli yarıçap: iç = dış −
dolgu), haplarda **düğme-içinde-düğme** simge cebi, 112 px bölüm dolgusu,
özel `cubic-bezier(0.16,1,0.3,1)` ve `whileInView` giriş.

**SÜREKLİ HAREKET YOK.** Kılavuz "hiçbir şey durağan belirmesin" diyor;
giriş animasyonları var ama sayfada sonsuz dönen/salınan bir nesne
bilinçli olarak yok — 0.2 Hz civarındaki salınım vestibüler rahatsızlık
kaynağı.

**Yüzen ada kenardan kopuk.** Kılavuzun yasakladığı şey "üste yapışmış
kenardan kenara çubuk". Ölçüldü: hap `fixed`, üstten 18 px, yarıçap 999,
`backdrop-filter: blur(20px)`. `backdrop-filter` yalnızca SABİT öğede —
kayan bir kapta her karede GPU yeniden boyar.

**Film greni SABİT ve `pointer-events: none`.** Kayan bir kabın içinde
olsaydı sürekli yeniden boyanırdı.

**İki jeton eklendi** (`kit.jsx`): `--c-espresso` (#17130F — yeni renk
değil, `ink` hapının kendi zemini; gizlilik şeridi ve alt bilgi) ve
`.gur-btn-chip` sınıfı (`Btn`in `trailing` cebi üzerine gelince çapraz
kayıp büyüyor — yalnız `transform`).

**Yüksek kontrastta AÇIK cam yüzey düzeltildi.** `prefers-contrast: more`
kuralı `[style*="backdrop-filter"]` taşıyan her şeye koyu bir dolgu
basıyordu; açık ada gezinmesi o dolguyla koyu mürekkep-koyu zemin
oluyordu. `.gur-glass-light` artık o blokta da kendi dolgusunu alıyor.

**Ölçüm.** Tanıtım sayfası masaüstünde ve telefonda **3'er** kontrast
uyarısı veriyor: ikisi GUR kelime markası (logotype, kural dışı), biri
"GASTRO ONAYLI" çipinde beyaz-üstü-turuncu (bilinen ürün kararı). Yeni
kaynaklı sıfır. Yatay taşma iki genişlikte de 0 px; 44 px altında dokunma
hedefi yok. Dar ekran menüsü `role="dialog" aria-modal="true"` ve üç
kapatma yolu var (çarpı, perde, Escape). Tek dosyalık artifact
derlemesinde dört sekmenin dördü de kendi yüzeyini açıyor
(`dort-sekme.mjs`): Tanıtım · Uygulama · İşletme · Yönetici.

### Doyurucu artık bir WEB SİTESİ

`/isletme` telefon çerçevesi içinde bir maket değil, kendi yolları olan
bir site. Restoran sahibi masaüstünden geliyor, ne sunduğumuzu okuyor,
**siteden kayıt oluyor** ve aynı site üzerinden panele giriyor.

| Yol | Ne |
|---|---|
| `/isletme` | tanıtım sayfası (kahraman, nasıl çalışır, kazançlar, ücretlendirme, SSS) |
| `/isletme/kayit` | yeni kayıt — üç adım tek yolda |
| `/isletme/sahiplen` | havuzdaki kaydı sahiplen |
| `/isletme/giris` | giriş |
| `/isletme/panel` | işletme paneli (oturum ister) |

**ÜÇ ARAYÜZ HÂLÂ TEK VERİ KATMANI.** Site yeni bir ürün değil, Doyurucu'nun
yeni kabuğu: sahiplenme `lib/b2b.js`e, dosyalar `lib/media.js`e, reklam
tarihleri `lib/adslots.js`e yazılıyor. Ölçüldü (`butunluk.mjs`, tek
tarayıcı bağlamında üç sekme): siteden gönderilen sahiplenme başvurusu
`gur.claims`e düşüyor, **yönetici panelinde adıyla görünüyor** ve tüketici
uygulaması aynı mekan havuzunu okumaya devam ediyor.

**YOLLAR GERÇEK.** Ekran bir state değil, adres çubuğundaki yol: kayıt
sayfasının linki paylaşılabiliyor, tarayıcının geri tuşu kendiliğinden
çalışıyor, sayfa yenilenince aynı yerde kalınıyor. Önceki `screen` state'i
+ elle tutulan `history` yığını üçünü de veremiyordu. `main.jsx`te rota
`'/isletme/*'` — splat olmadan alt adresler `"*"` kuralına düşüp ana
sayfaya yönleniyordu.

**Oturum `localStorage`da** (`gur.doyurucu.session`). Gerçek bir kimlik
doğrulaması değil — YEREL modda işletme girişi zaten bir formalite — ama
bir işaret gerekiyor: olmadan `/isletme/panel` adresini yenileyen kullanıcı
girişe düşer ve sitede kaybolur. Oturumsuz panel isteği `replace` ile
girişe yönleniyor (geri tuşu kapalı kapıya çarpmasın).

**SİTE AÇIK, PANEL KOYU.** Bilinçli bir sınır: site pazarlama, panel ürün.
Geçiş girişte oluyor ve kullanıcı o anda zaten "içeri giriyorum" diyor.
Paneli de açığa çevirmek 2500 satırlık koyu arayüzü (ve üstüne yeni
yazılmış panoyu) baştan boyamak demekti.

**Responsive düzen JS'te.** Satır içi stile `@media` yazılamıyor; kararı
`useMediaQuery(GENIS)` veriyor (`ui/kit.jsx`, kırılma 900 px). Telefon
çerçevesindeki ekranlarda gerek yoktu — genişlik sabitti.

| | < 900 px | ≥ 900 px |
|---|---|---|
| Site başlığı | hamburger + açılır panel | yatay gezinme + iki eylem |
| Tanıtım ızgaraları | tek sütun | `auto-fit` çoklu sütun |
| Panel | eski yığın düzen (turuncu başlık + yatay sekme şeridi) | sol kenar çubuğu + içerik |

**Sekme listesi TEK YERDE** (`sekmeler`): dar ekrandaki yatay şerit ve
geniş ekrandaki kenar çubuğu aynı diziyi çiziyor, gövde de aynı
(`panelIcerik`). İki kopya olsaydı biri katalogda açılan yeni sekmeyi
göstermeyi unuturdu.

**Başlık ve alt bilgi ARTIK ORTAK.** `SiteHeader` / `SiteFooter` bu
dosyadan kaldırıldı; `/isletme` tanıtım sitesiyle aynı kabuğu çiziyor
(bkz. "TEK SİTE, İKİ İZLEK"). Burada kalanlar İÇERİK: `Section`,
`SectionTitle`, `Card`, `FormKap`, `Landing`.

**Panelde site başlığı yok.** Panelin kendi başlığı ve gezinmesi var; iki
gezinme şeridi üst üste hangisinin ana olduğunu sildirir. Siteye dönüş
yolu iki düzende de duruyor (kenar çubuğunun altı / dar düzende üst
satır) ve **çıkıştan ayrı**: oturumu kapatmıyor.

**Bildirim ve çıkış modalı `fixed`.** Telefon kabuğunda `absolute`
doğruydu: kaydırma `Screen`in içindeydi. Web'de belge kayıyor ve
`absolute; inset: 0` perde uzun sayfanın tamamını kaplıyor, kart o kutunun
ortasına — yani ekranın dışına — düşüyordu.

**Eski `DoyurucuAuthScreen` kaldırıldı.** Üç düğmeli o telefon ekranının
yerini tanıtım sayfası aldı: işletme sahibi artık ne sunduğumuzu okuyup
öyle kayıt oluyor, boş bir giriş kapısıyla karşılaşmıyor.

**Giriş ekranı yüzdeyle bölünmüyor artık.** Telefonda üst %32 krem / alt
turuncu idi; web'de yükseklik serbest olduğu için yüzdeli bölme kart
içinde çöküyor ve turuncu alan içeriğe göre zıplıyordu. İkisi de içerik
kadar.

**Ölçüm.** Tanıtım sayfasında 3, kayıtta 3, sahiplenmede 2, girişte 9
kontrast uyarısı kaldı; hepsi GUR kelime markası, bilinen beyaz-üstü-
turuncu kararı ya da **devre dışı** hap (WCAG 1.4.3 devre dışı denetimleri
kapsam dışı bırakıyor). Bu geçişte kapatılanlar: kâğıt üstünde 4.15:1'de
kalan `#8A7A68` açıklama metinleri (13 yer) ve 2.69:1'deki `rgba(45,36,25,
0.45)` ipuçları (2 yer) `--c-muted`e çekildi. Telefon genişliğinde yatay
taşma 0 px, 44 px altında dokunma hedefi yok.

### Doyurucu panosu: "İstatistikler" değil "Pano"

İşletme panelinin ilk sekmesi yeniden yazıldı (`GurBusiness.jsx` → PANO
bölümü). Referans pano düzeni (üstte KPI kartları, altında tek serili
büyük grafik, sonra takvim ve program) telefon genişliğine **yeniden
dizildi**: masaüstündeki üç sütun burada tek sütun ve sıra "ne oldu →
ne zaman oluyor → sırada ne var". Üç sütunu küçültüp yan yana bırakmak
390 px'de üç okunmaz şerit demekti.

| Parça | Ne gösterir | Kaynak |
|---|---|---|
| Selamlama + tarih | saate göre selam, `Intl` ile tr-TR tarih | — |
| Dönem seçici | 7 gün / 30 gün / 12 hafta | seçim GERÇEKTEN veri değiştirir |
| Dört KPI kartı | görüntülenme, beğeni oranı, beğenen, masa talebi | seri + `reservations` |
| Etkileşim takibi | tek serili çizgi + alan, tepe etiketli | seri |
| Aktif yayın kartı | yayındaki/sıradaki reklam, kalan gün, bedel | `adslots` + `media` |
| Isı haritası | gün × saat yoğunluk (eskiden beri) | seri üreteci |
| Yayın takvimi | bu ay hangi günler yayında | `adslots` |
| Sırada | yaklaşan yayınlar + bekleyen masa talepleri | `adslots` + `reservations` |
| Puan dağılımı | (eskiden beri) | demo |

**İki ayrı veri, karıştırmayın.** Görüntülenme/kaydırma serisi DEMO —
CANLI modda `analytics_events`ten gelecek. Takvim, yaklaşan yayınlar ve
masa talepleri UYDURMA DEĞİL: doğrudan depolardan okunuyor. İşletmenin
karar vereceği yerde uydurma sayı olmaz.

**TEK SERİ, TEK TOHUM.** Dönem seçici üç ayrı seri üretmiyor: 182 günlük
(26 tam hafta) tek bir günlük seri `tohumlu()` ile üretilip dilimleniyor,
haftalıkta toplanıyor. Her dönem kendi tohumundan doğsaydı "7 gün"
toplamı "30 gün"ün son yedi gününü tutmazdı ve aynı ekranda iki farklı
gerçek yazardı. Ölçüldü: 7 günün toplamı (1.570) haftalık grafikteki son
sütunun aynısı. Başlıktaki **beğeni oranı rozeti de bu seriden** okunuyor
(30 günlük) ve rozetin altında dönemi yazıyor — başlık bir sayı, kart
başka bir sayı yazsaydı hangisinin doğru olduğu sorulurdu.

`tohumlu(seed)` ısı haritasıyla ORTAK: aynı restoran = aynı sayılar.
`Math.random()` olsaydı her yeniden çizimde değişir, sekme değiştirip
dönen işletme "veri yenilendi" sanırdı.

**Koyu zeminde metin opaklığı en az 0.5.** Panelin eski ekranlarında
ikincil yazılar `rgba(255,255,255,0.3)`–`0.45` arasında; ölçüldüğünde
0.35 → **3.23:1**, yani AA'nın altında. Yeni ekran aynı hatayı
taşımıyor: 0.5 en koyu yüzeyde bile 5.06:1. Bu, "pasif durumu opacity
ile kurma" kuralının yerine geçmiyor — yalnızca okunur bir taban.

Panoyu tarayınca kalan kontrast uyarılarının **tamamı** ya turuncu
başlıktan (bilinen karar) ya da pano öncesinden gelen bileşenlerden
(sekme şeridi 0.4, ısı haritası 0.35) geliyor; panonun kendi eklediği
tek kategori beyaz-üstü-turuncu (seçili dönem hapı, takvimde yayın günü).
Not: tarayıcı SVG metnini `color`dan okuduğu için grafik eksen etiketleri
yanlış olarak "siyah" raporlanıyor — `fill` özniteliği görülmüyor.

**Grafik parmakla okunuyor.** Yalnız `mousemove` dinlenseydi telefonda
hiçbir nokta okunamazdı. `pointerdown` yakalanıp sürükleme boyunca
izleniyor, `touchAction: "pan-y"` dikey kaydırmayı bırakıyor — grafiğin
üstünde parmak yukarı giderse sayfa kaymalı, grafik onu yutmamalı.

**Takvim özetinde bedel yazmıyor.** İlk yazılışta "3 gün yayın · ₺1.400"
diyordu; oysa o yayın 4 günlüktü ve bir günü sonraki aya taşıyordu —
satır, dört günün bedelini üç güne yazılmış gibi okutuyordu. Şimdi
"Bu ay 3 gün yayın · 1 rezervasyon".

**KPI'daki küçük görseller süs değil**: sparkline eğilimi, halka oranı,
sütunlar dengeyi anlatıyor; üçü de yanındaki sayıyı tekrar ediyor, tek
başına bilgi taşımıyor. Mini sparkline'ın dolgusu düz renk + opaklık:
gradyan olsaydı her kopyası aynı id'li bir `<defs>` çizerdi ve tarayıcı
hepsini ilkine bağlardı (bkz. `GlossDefs`).

Dönem hapları **44 px yüksekliğinde**: ilk ölçümde 38 px'ti ve dokunma
hedefi kuralının altında kalıyordu.

### Panoda tasarım geçişi: yüzey, bento, dokunsal geri bildirim

Pano bir tasarım gözüyle yeniden ele alındı. Çıkış noktası dış bir
"anti-slop" kılavuzuydu; o kılavuzun bazı maddeleri PROJENİN KENDİ
KURALLARIYLA ÇAKIŞIYOR ve çakışanlarda proje kazandı. Karar tablosu,
bir dahakine tekrar tartışılmasın diye:

| Kılavuz | Proje | Sonuç |
|---|---|---|
| Tailwind | satır içi stil, Tailwind YOK | satır içi stil |
| Geist / Satoshi | Poppins + Outfit, "başka font kullanma" | Poppins + Outfit |
| Phosphor / Radix ikon | `kit.jsx` → `Icon` | kendi kiti (yeni bağımlılık yok) |
| "diffusion shadow" ile yükseklik | koyu zeminde yüksekliği GÖLGE anlatmaz | yüzey merdiveni |
| GSAP / ThreeJS | Motion zaten var | Motion |
| Framer Motion | `motion/react` — aynı motor | olduğu gibi |

Uygulananlar:

**Yüzey merdiveni + yarıçap ölçeği** (`YUZ`, `RAD`). Panodaki ALTI bloğun
altısı da aynı kutuydu: `rgba(255,255,255,0.04)` + 1px kenarlık + 20
yarıçap. Hepsi aynı ağırlıkta olunca hiçbiri öne çıkmıyordu. Artık taban
kart / öne çıkan kart / parça için üç yüzey ve dış kap 26 · kart 18 ·
parça 12 için üç yarıçap var. Tek bir `PanoKart` bileşeni altı ayrı elle
yazılmış kutunun yerine geçti.

**Bento ızgarası.** Pano tek sütunluk bir yığındı; masaüstünde ekranın
yarısını harcıyor ve "önce neye bakayım" sorusunu cevapsız bırakıyordu.
Dört sütun, satır satır değişen bölünme: **2+1+1 · 1+3 · 4 · 2+2 · 2+2**.
Dar ekranda ızgara ikiye düşüyor ve sıra ESKİSİNİN AYNISI.

İki kural ızgaranın içinde ölçümle oturdu:
- **`alignItems: "start"`.** `stretch` ile kısa kart satırdaki en uzun
  kartın boyuna çekiliyordu: "Masa talebi" grafiğin yanında 260 px boş
  kalıyor, ısı haritası takvimin boyuna uzayıp altında kocaman bir
  boşluk bırakıyordu. Şişmiş bir kart bozuk görünür, satır altında kalan
  boşluk görünmez.
- **KPI satırının üçü `stretch`.** Genel kural `start` ama aynı satırdaki
  üç KPI'nın altı 10 px kaymış dursa bu tasarım değil hizasızlık okunur.
  Ölçüldü: üçünün alt kenarı da 297 px.
- Satır ATLAMA (`grid-row span`) bilerek yok: bir kart iki satıra
  yayılınca komşusunun boyu onu geriyor ve içerik uzadıkça ızgara
  öngörülemez hâle geliyor.

**Sayılar mono + `tabular-nums`** (`NUM`). Oransal rakamlar basamak
başına farklı genişlikte; dönem değişince KPI değeri yerinde zıplıyordu.
Yönetici panelinde bu zaten böyleydi.

**Dokunsal geri bildirim** (`.gur-press`). Haplar basılınca içeriden
doluyordu ama kart büyüklüğündeki tıklanabilir yüzeylerde (pano satırı,
takvim günü, kenar çubuğu sekmesi) hiçbir şey yoktu. Nesne kâğıda
yaklaşıyor: 1px aşağı + hafif küçülme.

**Tek bir sürekli hareket** (`.gur-breathe` + `CanliNokta`). "YAYINDA"
rozetinin yanında nefes alan bir nokta — yalnızca orada. Her şey
kıpırdarsa hiçbiri dikkat çekmez. Halka CSS'te, bileşen `React.memo`lu:
sürekli dönen bir animasyonun ata bileşeni yeniden çizmesi panonun
tamamını her karede yeniden çizdirirdi.

**Sıralı giriş** (`SIRA` / `PARCA`). Kartlar aynı anda değil dalga
hâlinde beliriyor. Azaltılmış hareketi kökteki
`MotionConfig reducedMotion="user"` zaten kapatıyor.

**Emoji kaldırıldı.** Selamlamadaki el emojisi yazı tipinin kontrol
etmediği bir görsel: platforma göre değişiyor ve başlığın ağırlığını
dağıtıyor.

**İSKELET EKLENMEDİ** — kılavuz yükleme durumu istiyor ama panoda
BEKLENECEK BİR ŞEY YOK: seri senkron üretiliyor, depolar localStorage.
Olmayan bir yüklemeyi iskeletle göstermek, splash'a sahte çark takmakla
aynı yalan olurdu (bkz. "Neden 2.6 ve neden gösterge yok").

**Ölçüm.** Panelin kontrast uyarısı **39'dan 16'ya** düştü ve kalanların
tamamı iki bilinen kategoride: GUR kelime markası, beyaz-üstü-turuncu
kararı ve SVG metninin yanlış okunması. Yol boyunca çıkan gerçek kusur:
ısı haritasında **düşük değerli hücrenin yazısı daha KOYU zeminde daha
SOLUKTU** (`rgba(255,255,255,0.45)`, `rgb(84,42,14)` üstünde 3.74:1) —
okunurluğu ters yönde bozuyordu; değer farkını zaten zeminin tonu
anlatıyor. Takvim günleri de 620 px'lik kartta 85 px'lik karelere
büyüyordu, ızgara 392 px'te sabitlendi (hedef hâlâ 44'ün üstünde).

**Referans site açılamadı.** `tgoyemek.com` bu ortamın çıkış kapısında
engelli (CONNECT'e 403); oradan ölçüm alınmadı. İkinci kez denendi, aynı
sonuç — tasarım dili kılavuzlardan ve projenin kendi jetonlarından
kuruldu.

### Panelin geri kalanı: ölçü, asimetri, hedef

Pano bento ızgarasına geçmişti; **geri kalan yedi sekme tek sütunda
kalmıştı** ve o sütun içerik alanının tamamını kaplıyordu. 1440 px'te
ölçülenler: 1126 px genişliğinde metin satırı, etiketinden ~900 px
uzakta duran kaynak rozeti, ekranı boydan boya geçen turuncu "kaydet"
çubuğu, beş yorumun altında 350 px boşluk, 44 px'in altında 19 dokunma
hedefi.

Üç ilkel eklendi (`GurBusiness.jsx`, panonun ilkelleriyle aynı yerde):

| İlkel | İşi |
|---|---|
| `Olcu` | okunur genişlik (varsayılan 680 px ≈ 68 karakter) |
| `PanelIkili` | 1120 px üstünde asimetrik iki sütun: **sol iş, sağ karar** |
| `YanKart` / `BosDurum` / `SuzgecHap` / `Yildizlar` | sağ sütun kutusu, boş durum, süzgeç hapı, yıldız sırası |

Sekiz sekmenin yedisi bu ikiliden geçiyor (Pano kendi bentosunu
koruyor). Sağ sütun **yapışkan**, çünkü taşıdığı şey (kaydet, özet,
kural) sayfanın her yerinden gerekli.

**`yanOnce`: dar ekranda sağ sütun önce.** Yorumlarda dağılım,
Büyüme'de kural metni, Masalar/Teklifler'de özet listeden önce
okunmalı — telefonda zaten eskiden de oradaydılar. Bilgiler'de TERSİ:
kaydet düğmesi formdan önce gelirse doldurmadan basılacak bir düğme
olur. Sıralama CSS `order` ile DEĞİL DOM'da yapılıyor; `order` görsel
sırayla sekme sırasını ayırıyor ve klavyeyle gezen kullanıcı listeyi
atlayıp özete düşüyordu.

Sekme sekme ne değişti:

- **Bilgiler** — kısa alanlar (saat, fiyat, telefon, adres) yan yana;
  ad ve tanıtım yazısı tam genişlikte. Kaynak rozeti ETİKETİN YANINDA:
  `space-between` ile satırın öbür ucuna atılıyor ve hangi alanı
  anlattığı okunmuyordu. Sağda "Yayın durumu": doldurulan alan sayısı,
  ilerleme çubuğu, bekleyen inceleme uyarısı ve kaydet düğmesi.
- **Yorumlar** — kutular yerine ince ayırıcı, metin 720 px ölçüde, üç
  süzgeç hapı (Tümü / 4-5 yıldız / **Düşük puan**) ve boş durum. Sağda
  puan dağılımı. Dağılımın altında **kaynağı yazılı**: çubuklar
  yüklenen 5 yorumdan sayılıyor, künyedeki 38 ise toplam — etiketsiz
  bırakılsaydı aynı kartta iki farklı gerçek yazardı.
- **Masalar / Teklifler** — özet + sayaç sağda, liste okunur ölçüde,
  kesik çizgili "yok" kutusu yerine gerçek boş durum.
- **Menü / Fotoğraflar** — yükleme alanı artık 1100 px değil; kural ve
  öneri metni sağ sütunda.
- **Büyüme** — "hiçbiri doğrudan satın alınmaz" şeridi sağ sütunda
  yapışkan; fiyatlar mono + `tabular-nums`.

**Dokunma hedefi: 19 → 0.** `Btn`in `sm` boyu 35 px veriyordu ve
görünmez hedef büyütücüsü (`.gur-tap::after`) burada ÇALIŞMIYOR:
`.gur-btn` basınca içeriden dolan daireyi kırpmak için
`overflow: hidden` taşıyor, taşan sözde öğeyi de kırpıyor. Kite
**opt-in `tap` bayrağı** eklendi (`minHeight: 44`) ve paneldeki 17
`sm` hapına verildi; bütün `sm` hapları 44'e çekmek yönetici
panelindeki yoğun tablo satırlarını da uzatırdı, orası ayrı bir karar.
`DarkChip` 31 → 44, kenar çubuğundaki logo 42 → 44.

**Koyu zeminde opaklık tabanı 0.5 uygulandı** (panoda ölçülmüş kural,
panelin eski ekranlarında tutulmamıştı): 20 yerde 0.25–0.48 arası metin
0.5–0.58 bandına çekildi, hiyerarşi korunarak.

**Ölçüm.** Sekiz sekme × iki genişlik: yatay taşma 0 px, 44 px altında
hedef yok (kalan üçü artifact önizlemesinin kendi şeridi, ürün değil),
en geniş metin satırı 1126 → 717 px, JS hatası yok (`panel-olcu.mjs`,
`panel-kontrast.mjs`). Kontrast uyarısı **33 → 19** ve kalan 19'un
tamamı iki bilinen kategoride: GUR kelime markası ve beyaz-üstü-turuncu
kararı. Yol boyunca kapatılan gerçek kusurlar: yükleme kutusunun
başlığı kâğıt jetonunu (`--c-brand-ink`) koyu zeminde kullanıyordu
(3.72:1 → koyu zemin jetonu `--c-brand-light`), dar düzendeki sekme
şeridi 0.4 opaklıkta (3.82:1), turuncu başlıktaki ikincil metinler
0.6/0.7 yerine `--c-on-brand-2`, beyaz kart üstündeki "Beğeni oranı"
`rgba(255,102,0,0.75)` ile 2.31:1.

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
| İlk açılış (marka anı) | ~2.6 sn |
| İkinci açılıştan sonra (`gur.splashSeen`) | ~0.7 sn |
| Azaltılmış hareket | ~0.2 sn |
| Ekrana dokunma | anında |

Katsayı tek yerde (`k`), koreografi aynı kalıyor — süreleri tek tek
kısaltmak fazların birbirine girmesi demekti.

**Neden 2.6 ve neden gösterge yok.** Kabul edilen kural: açılış ekranı
1–3 saniye görünür, daha uzun kalacaksa bir yükleme göstergesi ister.
3.2 sn eşiğin üstündeydi. Gösterge takmak da yanlış olurdu: bu ekran
HİÇBİR YÜKLEMEYE BAĞLI DEĞİL (bkz. yukarısı), dönen bir çark orada
olmayan bir işi varmış gibi gösterirdi. 3.0 değil 2.6 seçildi çünkü
kullanıcının saydığı süre sayfanın açılmasıyla başlıyor: 2.8 sn'lik
koreografi uçtan uca **3007 ms** ölçülüyordu. 2.6 ile uçtan uca
~2.96 sn.

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

### Her uygulamanın olması gereken ekranları — ölçülmüş kurallar

Beş kural tek tek mevcut ekranlara karşı denetlendi. Ölçüm betiği her
akışı 393×852'de gezip göstergeyi, doğrulamayı ve boş durumu okuyor.

| Kural | Durum | Ne yapıldı |
|---|---|---|
| Karşılama ekranı 1–3 sn, ortalanmış, yalnız ad/logo/slogan | eksikti | 3.2 → 2.6 sn (bkz. yukarısı) |
| Giriş: alanlar + onay düğmesi | tüketicide vardı | — |
| Giriş: Google/Apple yolu | **Doyurucu'da hiç yoktu** | `SocialAuthRow` kite taşındı, işletme girişine eklendi |
| Giriş doğrulaması | **Doyurucu'da hiç yoktu** | boş e-posta + boş parolayla panele giriliyordu |
| Kurulumda adım göstergesi | Doyurucu'da vardı (1/3) | tüketici kurulumuna eklendi (1/2 → 2/2) |
| Ana ekranda boş durum + CTA | **Keşfet'te yoktu** | "Burada henüz mekan yok" + konum/favori yolu |
| Boş aramada çıkış yolu | yarım | "Kaydırarak keşfet" hapı eklendi |

**`SocialAuthRow` ve `StepProgress` artık `ui/kit.jsx`'te.** İkisi de
önce tek bir uygulamanın içinde tanımlıydı: sosyal giriş tüketicide,
adım göstergesi işletmede. Kopyalamak yerine taşındılar — iki kopya er
geç ayrışır (biri App Store'un Apple kuralını unutur, öbürü
"tamamlandı" rengini değiştirir ve iki akış kullanıcıya farklı bir
ilerleme anlatır).

**Doyurucu girişi doğrulamıyordu.** Düğme doğrudan `onLogin`e bağlıydı:
BOŞ e-posta ve BOŞ parolayla işletme paneline giriliyordu. Tüketici
tarafında aynı hata daha önce ölçülüp düzeltilmişti, işletme tarafında
kalmış. Ölçüldü: boş formla "panele girdi mi: false", uyarı
`role="alert"` ile yazılı.

**Adım göstergesi YALNIZCA kayıttan gelindiğinde.** Girişten gelen
kullanıcı için konum tek ekranlık bir soru ve "1/1" yazan bir çubuk
bilgi değil gürültü olurdu. `afterAuth(kayittan)` bunu taşıyor; ölçüldü:
girişten gelince gösterge sayısı 0.

**Keşfet'in boş durumu yoktu.** Yönetici bütün mekanları gizlediğinde
(ya da moderasyon hepsini tuttuğunda, ya da besleme hiç dönmediğinde)
ekran yine çiziliyordu: kategoriler hepsi "0", "yakınında popüler"
şeridi bomboş, fırsat yok. Kullanıcı uygulamanın bozuk olduğunu
sanıyordu. Artık ne olduğunu yazıyor ve iki yol gösteriyor (konumu
değiştir / favorilerim). Destenin ve favorilerin boş durumları zaten
vardı; eksik olan ana ekrandı.

**`brandSoft` hapının mürekkebi koyulaştı** (`#B4530A` → `#A84D09`).
Variant kitte duruyordu ama hiçbir yerde kullanılmamıştı; ilk kullanımda
ölçülünce çıktı: marka mürekkebi kâğıt üstünde 5.02:1 ama bu hapın KENDİ
zemini kâğıt değil, %10 turuncu tint (`#FDECDE`) — orada **4.36:1**.
Yeni ton aynı zeminde 4.87:1, kâğıtta 5.42:1.

Taramada kalan uyarılar: Doyurucu girişinde 9, Keşfet boş durumunda 3 —
hepsi beyaz-üstü-turuncu kararı ve GUR kelime markası. Yeni kaynaklı
sıfır.

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

### Tüketici ekranları İKİ YERDE

| | Nerede | Kaç ekran |
|---|---|---|
| **Tam sürüm** | `src/app/GurApp.jsx` (`/uygulama`) | 32 bileşen, 4.476 satır |
| **Mağaza paketi** | `mobile/src/ekran/` | 10 ekran, 1.816 satır |

Aşağıdaki bölümlerin tamamı (konum üç yolu, rıza modalı, açılış
süreleri, rozetler, kota, sponsorlu kart, İkinci Şans, ödüllü video,
GUR Match, masa ayırtma) **tam sürümün** ürün kurallarını anlatıyor ve
hepsi `GurApp.jsx` içinde çalışıyor.

**Expo tarafının eksiği yukarıda listeli** (bkz. başlıktaki tablo):
GUR Match, ödüllü reklam, GUR Plus, masa ayırtma, yorum yazma, yasal
metinler ve altı bileşen daha taşınmadı. İki kopyanın ayrışma riski
gerçek — kural değişirse ikisinde de değişmeli. Saf kurgu zaten ortak
(`shared/deck.js`, `shared/deeplink.js`, `shared/second-chance.js`);
ayrışabilecek olan EKRAN davranışı.

`src/lib/` altındaki tüketici modülleri (`visits`, `rewarded`,
`ad-frequency`, `analytics`, `campaigns`, `geo`) web derlemesine yeniden
GİRİYOR — `GurApp.jsx` onları doğrudan çağırıyor. Sunucu aynı eşikleri
aynadan uyguluyor (120 m / 15 dk, 15 km, günde 1 kez…).

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
(`markVenuePending`; YEREL modda havuz listenin kendisi olduğu için bugün çağrılmıyor, CANLI'da karar sunucuda).

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

### Bölgeler: açık / "Çok yakında" (`platform.js` → BÖLGELER)
Tüketici uygulamasının ilçe seçicisi (`DistrictGrid`, kurulum ekranı ve konum
sayfasında aynı bileşen) iki grup çiziyor: **AÇIK BÖLGELER** (seçilebilir) ve
altında **ÇOK YAKINDA** (seçilemez, marka turuncusunda parlayan çerçeve ve
etiket). Yönetici **Ayarlar → Bölgeler**'den her ilçeyi açıp kapatıyor
(`setDistrictOpen`); iki yüz aynı depoyu (`districtOverrides`) okuyor, kapatınca
açık uygulama sayfa yenilenmeden değişiyor (ölçüldü).

- **Varsayılan: mekân verisi olan ilçe AÇIK**, olmayan kapalı (bugün yalnızca
  Bakırköy). Yalnızca varsayılandan AYRILAN kararlar saklanıyor — `servicesOff`
  ile aynı mantık. Verisi olmayan ilçeyi açmak mümkün, panel "boş deste görür"
  uyarısı yazıyor.
- **Kapalı bölgenin mekânları da tüketici listesinden düşüyor**
  (`visibleRestaurants`). Bakırköy'ü kapatmak bugün uygulamayı boş bırakır.
- **Parıltı sabit gölge + opaklık animasyonu** (`.gur-soon`, `GurStyles`):
  gölgeyi animasyonlamak yeniden boyatır. Azaltılmış harekette parıltı durur,
  çerçeve kalır. Pasif durum `opacity` ile kurulmuyor: kart soluk değil.
- **AÇIK EKSİKLER:** depo localStorage (tüm platform kapıları gibi) — CANLI
  modda cihazlar arası paylaşılmıyor, sunucuda `platform_settings` karşılığı yok.
  Mobil paket (`mobile/src/konum.js` → `ILCELER`) bu kapıyı okumuyor. Kullanıcının
  daha önce seçip sonradan kapatılan ilçesi kayıtlı kalıyor.

### Restoran bazlı görünürlük anahtarı
Tek bir mekanı tüketici uygulamasından **tamamen** gizler
(`platform.js` → `setRestaurantHidden`). Özellik kapılarından ayrı bir kart:
kapılar "bu mekanda şu özellik yok" der, bu "bu mekan yok" der.

Ayarlar sayfasında **değil**, restoranın kendi detay ekranında — genel bir
listede yanlış satıra basmak bir mekanı sessizce uygulamadan düşürürdü.

İki ayrı süzgeç arka arkaya çalışır ve ikisi AYRI soru sorar:
`publishedOnly` (moderasyondan geçti mi) → `visibleRestaurants` (gizlendi
mi). Süzgeç tüketiciye giden listenin kurulduğu TEK yerde durmalı, yoksa
deste bir şey, arama başka bir şey gösterir.

**AÇIK EKSİK — mobil tarafta bu süzgeç henüz yok.** Uygulama havuzu
`/api/restaurants`ten alıyor; gizleme kararının telefona ulaşması için
süzgecin SUNUCUDA, o uçta uygulanması gerekiyor. Yerel modda (tohum
listeyle açılan uygulama) gizleme hiç etkili değil. Bunu "çalışıyor" diye
yazmıyoruz: yöneticinin bastığı anahtarın bir işe yaradığını sanmak, hiç
anahtar olmamasından kötü.

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

#### Görsel yükleme alanı TARİH ONAYINA bağlı

Akış tek yönlü ve her adımı işletme panelinde yazılı
(`AdCreativeSlot`, dört noktalı gösterge):

```
takvimden tarih seç   → yayın talebi (pending)
yönetici onaylar      → slot kilitlenir, YÜKLEME ALANI AÇILIR
görseli yükle         → dosya onay kuyruğuna düşer (pending)
yönetici onaylar      → yayına girer
```

Yükleme alanı önceden HER ZAMAN açıktı: tarihi olmayan bir işletme dosya
yükleyebiliyor, dosya onay kuyruğuna düşüyor ve yönetici yayınlanacak yeri
olmayan bir görseli onaylıyordu. Kapı `hasApprovedSlot` ile depoda.

**Geçmiş yayınlar kapıyı açmıyor** (`slotsOf` → `end >= bugün`): geçen ayki
bir rezervasyon yükleme alanını sonsuza kadar açık tutar ve işletme hiçbir
yere gitmeyecek dosyalar yüklerdi.

Kapalıyken kutu **çizilip devre dışı bırakılmıyor**, yerine ne yapılması
gerektiği yazılıyor ("önce şu karttan takvimi açıp tarih seçin") —
tıklanamayan bir yükleme kutusu, sebebini söylemeyen bir engeldir.

**Eski kayıtlar OKUMA ANINDA taşınıyor** (`tasi()`), depoyu yeniden
yazmadan: taşıma betiği bir "ilk açılış" kancası gerektirirdi ve o kanca
çalışmadan okuyan ekran boş liste görürdü. Dosya videoysa ödüllü video,
değilse banner — eski ayrımın aynısı, ama bir kez ve tek yerde.
`pendingAll` de bu taşımadan geçiyor, yoksa dosya yönetici kuyruğunda
görünmez ama işletmede "beklemede" yazardı.

**`media.js` VE `adslots.js` depoları artık `storage` olayını dinliyor.** Önbellek yalnızca
kendi `write()`iyle tazeleniyordu (`if (cache) return cache`): yönetici
BAŞKA BİR SEKMEDE dosyayı onayladığında işletme sekmesi bunu hiç görmüyor,
sayfa yenilenene kadar "İncelemede" yazmaya devam ediyordu. Projedeki diğer
depolar bunu zaten doğru yapıyordu; burası tek istisnaydı. Anlık görüntü
ham metne göre önbellekleniyor — referans sabit kalmazsa
`useSyncExternalStore` sonsuz döner.

`adslots.js` aynı hatayı taşıyordu ve orada sonucu daha ağırdı: görsel
yükleme alanı tarih onayına bakıyor, yani yönetici başka sekmede onay
verdiğinde akışın kapısı hiç açılmıyordu.

**Testler bu hataya DAYANMIŞTI.** `gunluk-test.mjs` depoyu ortada doğrudan
eziyor (sürüm göçü denemesi) ve sonra aynı modülü hiçbir şey olmamış gibi
kullanmaya devam ediyordu; yalnızca bayat önbellek sayesinde geçiyordu.
Depo düzelince test kırıldı ve kendi kaydını taze oluşturacak şekilde
düzeltildi.

### Reklam görselleri: yönetici GUR'un kendi alanlarını değiştirir (`lib/adcontent.js`)

Tüketici uygulamasındaki GUR'a ait reklam alanlarının görselleri koda
gömülü picsum adresleriydi. Şimdi yönetici panelinde **Reklam Görselleri**
sayfasından (`AdImagesPage`) yükleniyor, uygulama sayfa yenilenmeden yeni
görseli çiziyor. Altı yerleşim: Keşfet banner'ının **marka slaytı** (`brand`),
**iki ev reklamı** (`ad-1`, `ad-2`) ve ödüllü reklamın **üç ev havuzu
kaydı** (`rw-1…3`).

**İşletmenin satın aldığı yayın DEĞİL.** Satın alınan banner'ın görseli
işletmenin yükleyip Moderasyon'un onayladığı dosyadır (`lib/media.js`);
burası o yokken dönen GUR içeriği. Onay kuyruğu yok: yetkili merci zaten
bu panel. Sponsorlu destede kartları (kampanya) bu sayfadan değişmez —
görselleri restoranın kendi fotoğrafı.

- **Katalog tek yerde** (`PLACEMENTS`); kimlik = `GurApp.jsx` içindeki
  `BANNER_ADS` / `REWARD_ADS` kaydının kimliği. Yeni ev reklamı eklerken
  hem diziye hem kataloğa yazın, yoksa yönetici onu göremez.
- **Yalnızca DEĞİŞTİRİLENLER saklanıyor** (`gur.adcontent`); "Varsayılana
  dön" kaydı siliyor, katalog varsayılanı güncellenince dokunulmamışlar
  yenisini alır.
- Görsel yazılmadan önce küçültülüyor (`fileToFittedDataUrl`: banner 1600,
  ödüllü 1280); görsel olmayan dosya ve 6 MB üstü depoya girmeden
  reddediliyor; kota taşarsa `setAdImage` HATA FIRLATIYOR.
- **AÇIK EKSİK:** depo localStorage — CANLI modda da cihazlar arası
  paylaşılmıyor (platform kapılarıyla aynı sınır; sunucuda nesne deposu +
  tablo gerekir). Mobil paket (`mobile/`) bu depoyu okumuyor. Ölçüldü:
  yönetici sekmesinde yükleme, açık uygulama sekmesinde sayfa
  yenilenmeden görünüyor; sıfırlayınca varsayılana dönüyor.

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
Havuz Bakırköy listesidir (bkz. "Bakırköy listesi: ANA DATA"). Tarayıcıdan
Overpass'e artık gidilmiyor. Sunucu tarafında Google Places + Foursquare +
Tripadvisor + OSM beslemesi (`server/src/ingestion`) duruyor ama VARSAYILAN
KAPALI (`GUR_INGESTION=1`) ve kapsama ızgarası yalnızca Bakırköy.

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
  kapalı ağda yalnızca Bakırköy listesi kalır (besleme zaten varsayılan kapalı).
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
- Artifact önizlemesi tanımı gereği YEREL modda çalışır: statik dosyalar,
  arkasında sunucu yok. Birleşik önizlemede mobil uygulama da YEREL'de:
  kendi kumbarası (AsyncStorage yerine tarayıcı deposu) web sekmelerinin
  deposundan ayrı, yani sekmeler arası veri paylaşımı yalnızca CANLI
  modda olur.
