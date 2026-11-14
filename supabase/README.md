# GUR — Supabase arka ucu

Mobil uygulama (`mobile/`, Expo) Supabase ile çalışır: kimlik **Supabase Auth**,
veri **PostgreSQL + RLS**, sunucu kuralları **SQL fonksiyonları (RPC)**. Ayrı bir
sunucu yok. Bu klasör tüm bunları tarif eder ve tek komutla kurar.

```
supabase/
├── migrations/        şema, RPC, güvenlik (RLS), depolama — sırayla uygulanır
├── seed.sql           Bakırköy listesi, 218 mekân (ÜRETİLMİŞ: npm run supabase:seed-uret)
├── config.toml        Supabase CLI (yerel geliştirme için; kurulum buna bağlı değil)
└── tests/             SQL testleri + kurulum betiği testi + mobil uçtan uca test
scripts/supabase-kur.mjs   otomatik kurulum (aşağıda)
```

## Entegrasyon verilince ne olur

```bash
npm run supabase:kur
```

Betik, kimlik bilgisini aldığı anda — **her çalıştırmada güvenle, tekrarlanabilir**:

1. Migration'ları sırayla uygular (hata olursa o migration **tümüyle geri alınır**;
   Supabase CLI'ın kendi defterine yazar, sonradan `supabase db push` ile tutarlı).
2. Bakırköy listesini yazar (kopya üretmez; sahiplenilmiş kaydı ezmez).
3. Auth'u ayarlar: e-posta/parola açık, en az 6 karakter, `gur://` dönüş adresi izinli.
4. İstenirse yönetici hesabını açar (`ADMIN_EMAIL` + `ADMIN_PASSWORD`; varsayılan parola **yok**).
5. Doğrular: `public` şemasında RLS'siz tablo varsa **hata verir**; REST ucunu dener.
6. `mobile/.env` ve `mobile/eas.json`'a adres + **genel** anahtarı yazar.

Sonra: `cd mobile && npm install && npx expo start`.

### Kimlik bilgisini vermek

| Yol | Ne gerekir |
|---|---|
| **A. Mevcut proje** (önerilen) | `SUPABASE_ACCESS_TOKEN` (supabase.com → Account → Access Tokens) + `SUPABASE_PROJECT_REF` |
| **B. Yeni proje** | `--proje-olustur` + `SUPABASE_ACCESS_TOKEN`, `SUPABASE_ORG_ID`, `SUPABASE_DB_PASSWORD` |
| **C. Doğrudan DB** | `SUPABASE_DB_URL` (Yönetim API'si kullanılmaz; Auth ayarı ve yönetici hesabı atlanır) |

Değerleri ortama ya da depo kökündeki `.env.supabase` dosyasına yazın
(`.env.supabase.example` şablon; dosya `.gitignore`'da). **Service anahtarı hiçbir
dosyaya yazılmaz**; mobil uygulamaya yalnızca genel (anon) anahtar gider.

`npm run supabase:kur -- --kuru` hiçbir şeye dokunmadan neyin çalışacağını yazar.
`-- --seed` listeyi yeniden yazar.

**Claude Code bulut oturumunda:** token'ı sohbete yapıştırmayın; oturum güvenli
kimlik formunu açar (`request_credential`, host `api.supabase.com`) ve ortamın ağ izin
listesine `api.supabase.com` ile `<proje-kodu>.supabase.co` eklenmelidir. Bu ortamda
`api.supabase.com` varsayılan olarak **kapalıdır**.

**Sonraki şema değişiklikleri:** yeni dosya ekleyin
`supabase/migrations/<YYYYMMDDHHMMSS>_ad.sql`, `npm run supabase:kur`. `main`'e itince
`.github/workflows/supabase.yml` aynısını yapar (yalnızca `SUPABASE_ACCESS_TOKEN` ve
`SUPABASE_PROJECT_REF` gizli anahtarları tanımlıysa).

## Güvenlik modeli

* **Her tablo RLS ile kapalı doğar.** İstemci yalnızca açıkça verilen satırlara dokunur;
  yazma yolları RPC'dir. Yeni tabloda `enable row level security` unutulursa kurulum
  betiği **hata verir**.
* **İstemciye kapalı:** `swipe_quota` (ham kota sayısı sızmaz), `restaurant_sources`
  (sağlayıcı ham yanıtı), `platform_admins`, gelir/analitik/kohort tabloları (yalnızca yönetici okur).
* **Yönetici** = `platform_admins` tablosu (yalnızca `service_role`/postgres yazar). JWT'deki
  `user_metadata`'ya güvenilmez: kullanıcı onu kendi yazabilir.
* **İstemciden gelmeyen şeyler:** kullanıcı kimliği (`auth.uid()`), plan, gelir tutarı,
  iştirak geliri. Sponsorlu kart ücreti yalnızca *o mekâna ait, aktif, bütçesi kalmış*
  kampanya için ve kullanıcı başına **bir kez** tahsil edilir (istemci rakibin bütçesini eritemez).
* **Konum:** ham koordinat saklanmaz; ilçe merkezli kayıtlar (`location_exact=false`)
  ziyaret doğrulamasına hiç girmez ve kartta koordinat olarak verilmez.
* **Hesap silme:** `gur_delete_me()` — profil ve kullanıcıya ait her şey silinir; gelir/reklam
  satırları kalır, kişi bağı kopar.

## Şema kararları (server/db/schema.sql'den farklar)

* **Kimlik Supabase Auth'ta**; `users` yerine `auth.users`'a bağlı `profiles`.
* **`restaurants.id` metin** (`bkr-<anahtar>`): web ve mobil favorileri zaten bu kimlikle
  tutuyor; uuid'ye geçmek YEREL moddaki favorileri sunucuya geçerken yetim bırakırdı.
* **Eklenti yok**: cube/earthdistance yerine düz haversine (`gur_distance_m`).
* **İşletme planı yok** (işletme aboneliği ürün kararıyla kaldırıldı); kullanıcı planı `free | plus`.
* **Kota günü İstanbul gününe göre** başlar (UTC değil).

## Testler

| Komut | Ne sınar | Gerekir |
|---|---|---|
| `npm run supabase:test` | 145 SQL doğrulaması: RLS, RPC'ler, kota, ücretlendirme, ziyaret, masa talebi, hesap silme | yerel PostgreSQL (`su postgres` ya da `GUR_TEST_PG`) |
| `GUR_TEST_PG=… npm run supabase:kur-test` | kurulum betiği, Yönetim API'sini taklit eden sunucuya karşı: idempotanlık, atomiklik, kuru çalıştırma, sızıntı yok (19) | süper kullanıcı bağlantısı |
| `GUR_TEST_PG=… npm run supabase:mobil-test` | gerçek `supabase-js` ile derlenmiş mobil uygulama akışı (20) | + Playwright/Chromium, `mobile/` bağımlılıkları |

**Bu testlerin SINIRI:** hiçbiri gerçek bir Supabase projesine karşı çalışmadı (bu ortamda
`api.supabase.com` kapalı). PostgreSQL gerçek; Auth/REST/Yönetim API katmanları taklit. Taklit ile gerçek arasındaki fark
ölçülmedi. **İlk gerçek çalıştırmada** özellikle şunlara bakın: proje oluşturma, Auth ayarı
(`PATCH config/auth` alan adları), `api-keys` yanıt biçimi, enum parametrelerin REST üzerinden
dönüşümü. Hata olursa betiğin çıktısını olduğu gibi iletin.

## Bilinen eksikler

* **Yalnızca mobil uygulama** Supabase'e bağlı. Web sitesi, işletme paneli (Doyurucu) ve
  yönetici paneli hâlâ Node sunucusuna (`server/`) ve localStorage'a bakıyor; onlar için
  moderasyon kuyruğu, İkinci Şans paketi, işletme alan düzenleme, fiyat/teklif/reklam takvimi
  tabloları **taşınmadı**.
* **Mobil uygulamada 22 bileşen yok** (GUR Match, ödüllü reklam, GUR Plus, yorum yazma, ziyaret
  doğrulama arayüzü…). SQL tarafı hazır (`gur_visit_sample`, `gur_submit_review`,
  `gur_rewarded_ad_done`…) ama ekranları yazılmadı.
* **Kota sunucuda sayılır ama ENGELLENMEZ**: ödüllü reklam ekranı mobilde yok; kapıyı kapatmak
  kullanıcıyı 40. kaydırmada çıkışsız bırakırdı. `gur_record_swipe` içinde işaretli.
* **Çevrimdışı birikme kuyruğu yok**: düşen çağrı kaybolur; açılışta favoriler birleştirilir
  (çevrimdışıyken kaldırılan favori sunucuda duruyorsa geri gelebilir).
* **Push bildirimi, ödeme (GUR Plus), Google/Apple girişi, dosya yükleme arayüzü** bağlı değil.
  Kovalar (`restaurant-media`, `review-photos`) ve politikaları hazır.
* **Koordinat yok** (218 kaydın hiçbirinde): mesafe ve ziyaret doğrulaması bu liste için çalışmaz.
* **YEREL'de açılan hesap sunucuya taşınmaz**: Supabase bağlı değilken oluşturulan kullanıcı
  yalnızca cihazdadır; sunucu bağlanınca yeniden kayıt gerekir (favoriler eşitlenir).
* **Kaynak koşulları:** liste bir Google Maps taramasından geliyor; puan/yorum sayısının kalıcı
  saklanması koşullarca kısıtlı olabilir — yayına almadan teyit edin.
