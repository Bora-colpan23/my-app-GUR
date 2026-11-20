# GUR — mobil uygulama (App Store / Google Play)

Bu klasör **gerçek bir mağaza uygulaması**: React Native (Expo SDK 58),
yerli ekranlar, yerli dokunma hareketleri ve yerli konum izni. Web
sitesini saran bir `WebView` kabuğu **değil** — Apple'ın 4.2 "Minimum
Functionality" kuralı öyle bir paketi zaten reddediyor.

```
mobile/
├── app.json              # mağaza kimliği: ad, bundle id, simgeler, izin metinleri
├── eas.json              # derleme profilleri (development / preview / production)
├── babel.config.js       # worklets eklentisi (Reanimated 4)
├── metro.config.js       # depo kökündeki shared/ ve data/ dosyalarını görür
├── assets/               # simge, uyarlanabilir simge, açılış görseli (GUR markası)
├── App.js                # kök: fontlar, gezinme, rıza, açılış sırası
└── src/
    ├── tema.js           # renk/tipografi/gölge jetonları (web GurStyles'ın eşi)
    ├── supabase.js       # Supabase istemcisi (adres/anahtar yoksa null → YEREL mod)
    ├── api.js            # Supabase RPC/Auth taşıması + CANLI/YEREL mod ölçümü
    ├── senkron.js        # yerel durum ↔ sunucu (ekranların çağırdığı tek yer)
    ├── depo.js           # AsyncStorage üstünde tek durum
    ├── veri.js           # mekan havuzu + deste (shared/deck.js ORTAK)
    ├── konum.js          # expo-location + elle ilçe seçimi
    ├── bilesen/          # Logo, Ikon, Hap, Alan, KonumCipi, KaydirmaKarti
    └── ekran/            # Acilis, Riza, Karsilama, Giris, Konum,
                          # Kesfet, Kaydir, Favoriler, Profil, Detay
```

## Çalıştırma

```bash
cd mobile
npm install
npx expo start              # QR kodu Expo Go ile okut
npx expo start --ios        # simülatör (macOS)
npx expo start --android    # emülatör
```

Sunucu **Supabase**. Adres ve genel (anon) anahtar derleme ortamından
geliyor; tanımsızken uygulama **YEREL** modda çalışır (hiçbir ekran
kilitlenmez). Depo kökünden tek komutla kurulur ve bağlanır:

```bash
npm run supabase:kur          # şema + güvenlik + Bakırköy listesi, sonra
                              # mobile/.env ve mobile/eas.json'a bağlantıyı yazar
cd mobile && npx expo start
```

Kimlik bilgisi nasıl verilir: `supabase/README.md`. Elle bağlamak isterseniz
`mobile/.env.example` dosyasını `.env` olarak kopyalayıp doldurun (yalnızca
**genel** anahtar; service anahtarı mağaza paketine ASLA girmez).

Telefon ile aynı ağdaki bilgisayarın **IP adresi** gerekiyor —
`localhost` telefonun kendisini gösterir.

## Mağazaya çıkarma

```bash
npm i -g eas-cli && eas login
eas build:configure
eas build -p ios      --profile production   # .ipa
eas build -p android  --profile production   # .aab
eas submit -p ios     --latest
eas submit -p android --latest
```

Yayına çıkmadan önce doldurulacaklar:

| Ne | Nerede |
|---|---|
| Supabase adresi + genel anahtar | `npm run supabase:kur` `eas.json` (3 profil) ve `.env`'e yazar |
| Bundle id / package | `app.json` (`app.gur.mobile` — kendi hesabınızın kimliğiyle değiştirin) |
| Apple Team / ASC App ID | `eas.json` → `submit.production` |
| Gizlilik politikası adresi | App Store Connect + Play Console |
| Veri güvenliği formu | Play Console (konum: "yalnızca cihazda işlenir") |

## Web ile ilişkisi

**Sunucu kuralları SQL'de.** Kota, sponsorlu kart ücretlendirmesi, ziyaret
doğrulama, masa talebi kapısı `supabase/migrations/…_gur_rpc.sql` içinde;
istemci (`src/api.js`) yalnızca taşır. Saf kurgu modülleri weble ortak:
`shared/deck.js` (deste + yakınlık sıralaması) ve `shared/deeplink.js`
(harita bağlantıları) depo kökünden okunuyor, kopyalanmıyor. Metro bunu
`metro.config.js` içindeki `watchFolders` ile yapıyor.

Tasarım jetonları (`src/tema.js`) web'deki `GurStyles` değerlerinin
birebir aynısı: aynı turuncu, aynı kremsi kâğıt, aynı üç katmanlı gölge
ölçeği, aynı Poppins + Outfit.

## Ürün kuralları (web ile aynı)

- **Üç yön, üç karar** — sağa kaydet, sola geç, yukarı "bu akşam".
- **Üç yol da eşit ağırlıkta** — konum ekranında reddetmek kabul etmek
  kadar kolay; hiçbir hap diğerinden küçük değil.
- **Rıza bir modal** — karar verilmeden geçilmiyor, iki seçenek aynı
  görsel ağırlıkta.
- **Doğrulama her iki modda** — yerel modda da boş formla giriş yok.
- **Ham koordinat gönderilmiyor** — mesafe cihazda hesaplanıyor.
- **Dokunma hedefi ≥ 44 px**, pasif durum `opacity` ile kurulmuyor.
- **Masa ayırtma ücretsiz** ve yalnızca sahiplenilmiş mekanlarda açık.

## Henüz bağlanmamış olanlar

Dürüst liste — bunlar "var gibi" gösterilmiyor, arayüzde de yazıyor:

- **Google / Apple ile giriş.** Mağaza kuralı gereği başka sosyal giriş
  sunulursa iOS'ta Apple ile giriş de sunulmak zorunda; ikisi de anahtar
  istiyor. Bu yüzden şimdilik hiç gösterilmiyor — çalışmayan bir düğme
  koymaktansa.
- **Konum doğrulamalı yorum yazma.** Kapı duruyor ve NEDEN kapalı olduğu
  detay ekranında yazılı; arka plan konum takibi ayrı bir izin ve ayrı
  bir mağaza gerekçesi istiyor.
- **Push bildirimi.** Sunucu kuyruğu hazır, cihaz tarafı (APNs/FCM)
  bağlanmadı.
- **Ödüllü video ve GUR Plus.** Reklam birimi ve mağaza içi satın alma
  entegrasyonu yok.
- **Çevrimdışı görsel önbelleği.** `expo-image` kendi önbelleğini
  kullanıyor; kalıcı bir çevrimdışı deste yok.

## Ölçüm

Gerçek cihaz/simülatör bu geliştirme ortamında yok; doğrulama
`npx expo export --platform web` çıktısı üzerinden yapıldı (aynı bileşen
ağacı, aynı düzen kodu). Ölçülenler, 393×852'de:

- On ekranın onu da çiziliyor; yatay taşma **0 px**, 44 px altında
  dokunma hedefi **yok**.
- Boş formla giriş engelleniyor (uyarı `role="alert"`).
- **Sürükleme gerçekten çalışıyor**: sağa sürükleme kartı ilerletiyor ve
  mekanı favorilere yazıyor, sola sürükleme geçiyor.
- Kart düğmeleri (geç / bu akşam / kaydet) aynı kararı veriyor.

Dokunsal geri bildirim (`expo-haptics`), konum izni ve mağaza paketleme
yalnızca gerçek cihazda doğrulanabilir.
