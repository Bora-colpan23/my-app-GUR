# GUR — sunucu tarafı

Tüketici uygulaması (`/src/app`) ve yönetici paneli (`/src/admin`) bu servisin
üzerinde çalışır. Faz ayrımı yoktur: aşağıdaki her parça sistemin kalıcı
bileşenidir.

## Dizin

```
server/
├── db/
│   ├── schema.sql              # tam şema (tek migration)
│   └── queries/cohorts.sql     # retention, kohort, LTV/ARPU toplama sorguları
└── src/
    ├── ingestion/              # Google Places + Foursquare + OSM + Tripadvisor
    │   ├── providers.js        # sağlayıcı adaptörleri (ham yanıt)
    │   ├── normalize.js        # tek şemaya indirgeme + aynı mekânı eşleştirme
    │   └── worker.js           # ızgara taraması ve upsert
    ├── swipe/deck.js           # deste üretimi, kota, sponsorlu kart ücretlendirme
    ├── visits/tracker.js       # konum doğrulamalı ziyaret ve yorum kilidi
    ├── notifications/
    │   ├── queue.js            # tavan, sessiz saat, tekrar engelleme, gönderim
    │   └── jobs.js             # ziyaret sonrası anket + 30 günlük re-engagement
    ├── analytics/
    │   ├── events.js           # olay kaydı, gelir bağlama (ARPU girdisi)
    │   └── rollup.js           # gecelik LTV/kohort toplaması
    ├── auth/social.js          # Google / Apple id_token doğrulaması
    └── cron.js                 # zamanlama + çoklu örnek kilidi
```

`shared/` altındaki `deeplink.js` ve `deck.js` hem sunucu hem istemci
tarafından kullanılır — yerleşim hissi ve harita bağlantı formatı iki yerde
ayrı ayrı tutulmasın diye.

## Kurulum

```bash
npm install                       # pg ve node-cron package.json'da
npm run db:setup                  # rol + veritabanı + eklentiler + şema
npm run db:seed                   # 15 mekan, 3 kampanya, yönetici, demo kullanıcı
cp .env.example .env              # DATABASE_URL ve SESSION_SECRET
```

`db:setup` eklentileri (pgcrypto, citext, cube, earthdistance) süper
kullanıcı olarak kurar, şemayı ise uygulama rolüyle çalıştırır — uygulama
rolü hiçbir zaman süper kullanıcı olmuyor. Sıfırdan kurmak için
`npm run db:reset`.

## Çalıştırma

```bash
npm run dev:api    # API — http://localhost:8787
npm run dev        # arayüz — http://localhost:5173 (/api oraya proxy'lenir)
npm run dev:all    # ikisi birden (kurulum + tohumlama dahil)
```

Sağlık kontrolü:

```bash
curl localhost:8787/api/health
# {"ok":true,"restaurants":15,"users":2,"active_campaigns":3}
```

Tohumlanan hesaplar: yönetici `admin` / `gur2026`, tüketici
`demo@gur.app` / `gur1234`. İkisi de `.env` ile değiştirilebilir.

Ortam değişkenleri:

| Değişken | Zorunlu | Ne için |
| --- | --- | --- |
| `DATABASE_URL` | evet | PostgreSQL bağlantısı |
| `GOOGLE_PLACES_API_KEY` | hayır | mekan havuzu (yoksa atlanır) |
| `FOURSQUARE_API_KEY` | hayır | mekan havuzu |
| `TRIPADVISOR_API_KEY` | hayır | puan zenginleştirme |
| `GOOGLE_OAUTH_CLIENT_ID` | Google girişi için | id_token audience |
| `APPLE_SERVICE_ID` | Apple girişi için | id_token audience |

Hiçbir mekan anahtarı yoksa besleme yalnızca OpenStreetMap ile çalışır;
anahtarsız ve ücretsizdir, havuz daha sığ olur ama sistem ayakta kalır.

## API uçları

| Uç | Yetki | Ne yapar |
| --- | --- | --- |
| `POST /api/auth/password` | — | Giriş ya da kayıt (aynı uç) |
| `POST /api/auth/social` | — | Google/Apple id_token doğrulama |
| `POST /api/auth/admin` | — | Yönetici girişi, `admin` rollü belirteç |
| `GET /api/deck` | kullanıcı | Sponsorlu enjeksiyonlu deste + kota baskısı |
| `POST /api/swipes` | kullanıcı | Kaydırma, kota düşümü, CPE ücretlendirme |
| `POST /api/visits/sample` | kullanıcı | Konum örneği → ziyaret durumu |
| `GET /api/visits/permission/:id` | kullanıcı | Yorum kilidi açık mı |
| `POST /api/reviews` | kullanıcı | Yalnızca doğrulanmış ziyaretle |
| `POST /api/claims` | kullanıcı | İşletme sahiplenme başvurusu |
| `PATCH /api/restaurants/:id/owner` | işletme | Kendi alanlarını yazar |
| `GET /api/admin/growth` | yönetici | Kohort, retention, ARPU/LTV |
| `GET /api/admin/campaigns` | yönetici | Kampanya envanteri |
| `POST /api/admin/jobs/:name` | yönetici | Cron'u elle tetikler |

Kullanıcı kimliği daima imzalı belirteçten okunur; istemcinin gönderdiği
bir `user_id` hiçbir yerde kullanılmaz.

## Programatik kullanım

```js
import pg from "pg";
import { registerJobs, bootstrap } from "./server/src/cron.js";

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await bootstrap(db);                       // havuz boşsa ilk besleme
registerJobs(db, { push: sendPush });      // sendPush: APNs/FCM sarmalayıcınız
```

## İş takvimi

| İş | Sıklık | Ne yapar |
| --- | --- | --- |
| `ingestion` | 03:15 | Mekan havuzunu tazeler |
| `closeVisits` | 10 dk | Örnek gelmeyen ziyaretleri kapatır |
| `visitPrompts` | 10 dk | Ziyaretten ~90 dk sonra "nasıldı?" bildirimi |
| `reengagement` | 16:00 | Pro mekânlar için 30 günlük hatırlatma |
| `drainQueue` | 2 dk | Kuyruğu push sağlayıcısına verir |
| `rollups` | 04:00 | LTV/ARPU, retention ve kohort tablolarını yazar |

## Kararlar

**Kota sunucuda tutulur, sayı istemciye gönderilmez.** `shared/deck.js`
yalnızca `pressure: "free" | "near" | "exhausted"` döndürür. Arayüzde
"kalan hakkınız: 12" gibi bir ibare bilinçli olarak yoktur.

**Sponsorlu kart organik kartla aynı nesnedir.** `buildDeck` yalnızca
`sponsored` alanını ekler; kart bileşeni iki durumu ayırt etmez, yalnızca
mikro rozeti çizer. Aralık 5-7 arasında rastgeledir — sabit aralık
kullanıcı tarafından fark ediliyor.

**Açık artırma yalnız teklife bakmaz.** Skor = teklif × kalite × ilgi.
Yalnız paraya bakan sıralama deneyimi bozarak uzun vadede geliri de düşürür.

**Ham konum saklanmaz.** `visits` tablosunda yalnızca en yakın mesafe,
hassasiyet ve süre özeti tutulur; koordinat dizisi hiç yazılmaz.

**Yorum kilidi doğrulanmış ziyarete bağlıdır.** 120 m yarıçapta 15 dakika
kalış + 100 m'den iyi konum hassasiyeti. Bu olmadan yorum yazılamaz;
yazılan yorum `is_verified` rozetini alır.

**Push taşıması bağlanmadı.** Kuyruk, tavan, sessiz saat ve tekrar
engelleme çalışıyor; `server/index.js` içindeki `push` fonksiyonu şimdilik
konsola yazıyor. APNs/FCM sarmalayıcınızı oraya vermek yeterli.

**Besleme dış ağa çıkabilmeli.** Anahtarsız OpenStreetMap yolu bile giden
HTTPS gerektirir; kapalı ağda `runIngestion` sıfır kayıt yazar ve tohum
listesi devreye girer. Bu bir hata değil, tasarlanmış geri düşüş.
