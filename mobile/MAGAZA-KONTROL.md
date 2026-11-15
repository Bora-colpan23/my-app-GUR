# Mağaza formları ve kurallar — kontrol listesi

**Bu bir garanti değil.** Apple ve Google kurallarını sık değiştirir, son karar insan
inceleyiciye aittir. Aşağıdakiler (1) kodda doğrulanabilenler, (2) mağaza panellerinde
sizin dolduracağınız formlar ve (3) ürün/hukuk kararları. Her formun cevabı uygulamanın
**gerçekte** yaptığıyla ve `shared/legal.js` metniyle aynı olmalı; tutarsızlık, en sık
ret/kaldırma sebebidir.

## 1. Gönderimden önce (kod ve yapılandırma)

```bash
npm run magaza:kontrol     # HATA varsa gönderme
```

Yakaladıkları: yasal bilgiler doğrulanmış mı, simge 1024×1024 ve **alfa kanalsız** mı
(App Store Connect alfa'lı simgeyi reddeder), Supabase bağlı mı (yoksa inceleyici boş
uygulama görür), arayüzde "yakında" var mı (Apple 2.1), hesap silme ve yasal metinlere
erişim var mı, konum beyanı kodla tutarlı mı, arka plan konumu kapalı mı, pakette servis
anahtarı var mı, kullanıcı içeriği varsa bildir/engelle var mı.

Yakalamadıkları: mağaza formları, ekran görüntüleri, gerçek cihaz davranışı, inceleyicinin yorumu.

Elle yapılacaklar (kontrol betiğinin HATA verdiği üç şey):

1. `shared/legal.js` → gerçek ticari unvan, **açık adres**, okunan e-posta kutuları; sonra `dogrulandi: true`.
2. `npm run supabase:kur` (mobile/.env + eas.json bağlantısı).
3. Bundle ID kararı (`app.json` → `ios.bundleIdentifier`, `android.package`): yayından sonra **değişmez**.

## 2. App Store Connect

| Alan | Değer |
|---|---|
| Gizlilik Politikası URL | `https://<alanadınız>/gizlilik` |
| Destek URL | `https://<alanadınız>/destek` |
| Yaş derecesi | Anketi dürüst doldurun: mekân listesinde alkollü mekânlar var ("Alkollü" kategorisi). Alkol satışı/sipariş yok. Koşullarımız alkollü mekânlar için 18+ diyor |
| İhracat uyumu | Yalnızca HTTPS (muaf). `usesNonExemptEncryption: false` zaten yazılı |
| iPad | Kapalı (`supportsTablet: false`): iPad ekran görüntüsü istenmez |

**App Privacy (gizlilik etiketi)** — `app.json` → `privacyManifests` ile AYNI olmalı:

| Veri | Bağlı mı | Amaç |
|---|---|---|
| E-posta, Ad | evet | Uygulama işlevi |
| Kullanıcı kimliği | evet | Uygulama işlevi |
| Ürün etkileşimi (kaydırma kararları) | evet | Uygulama işlevi; rıza varsa analitik |
| Diğer kullanıcı içeriği (masa talebi notu) | evet | Uygulama işlevi |
| Konum | **toplanmıyor** | mesafe cihazda hesaplanır, ham koordinat gönderilmez |

"Veri sizi izlemek için kullanılıyor mu?" → **Hayır** (IDFA yok, reklam SDK'sı yok, ATT gerekmez).

**İnceleme notu (App Review Information)** — şunları yazın:

- Test hesabı (e-posta + parola; silinebilir bir hesap oluşturun).
- Uygulama konum izni vermeden de çalışır (ilçe seçimi).
- "Sponsorlu" etiketli kartlar işletmelerin satın aldığı yerleşimlerdir; ödeme uygulama içinde yapılmaz.
- Masa talebi ücretsizdir, uygulama içinde ödeme/komisyon yoktur.
- Hesap silme: Profil → "Hesabımı sil".
- Mekân verileri üçüncü taraf kaynaklardan derlenir; işletmeler kaydını sahiplenip düzeltebilir.
- Mobil uygulamada yönetici/işletme araçları yoktur (varsa burada belirtin: Apple 2.3.1 gizli özelliği sevmez).

## 3. Google Play Console

| Alan | Değer |
|---|---|
| Gizlilik politikası | `https://<alanadınız>/gizlilik` |
| Hesap silme talebi URL (Veri güvenliği → Veri silme) | `https://<alanadınız>/hesap-silme` — Play, uygulama içi yola EK OLARAK web adresi ister |
| "Uygulama reklam içeriyor mu?" | **Evet** (Sponsorlu kartlar uygulama içi reklamdır) |
| Hedef kitle | 18+ / çocuklara yönelik DEĞİL (Aile politikaları tetiklenmez) |
| İçerik derecelendirme (IARC) | Alkol referansını işaretleyin |
| Konum | Yalnızca uygulama kullanılırken; arka plan konumu YOK (ek beyan formu gerekmez) |

**Veri güvenliği formu:** Toplanan: Kişisel bilgi (ad, e-posta), Uygulama etkinliği (etkileşimler),
Kullanıcı içeriği (masa notu). Konum: toplanmıyor. Üçüncü taraflarla **paylaşım yok**
(barındırma sağlayıcısı hizmet sağlayıcıdır). Aktarımda şifreleme: evet. Silme talebi: evet.

**Yeni kişisel geliştirici hesapları:** Google, üretime çıkmadan önce kapalı testte belirli sayıda
test kullanıcısıyla belirli süre test şartı koyuyor (şu an 12 kişi, 14 gün). Kuralı Play Console'da
doğrulayın; takvimi buna göre kurun. Kurumsal hesaplarda bu şart yok.

## 4. Sizin vermeniz gereken kararlar

1. **Puan ve yorum sayısı (en büyük hukuki risk).** Tablo Google Maps taramasından geliyor. Google
   Maps Platform şartları taramayı ve puan/yorumun saklanıp gösterilmesini kısıtlar. İnceleyici bunu
   görmeyebilir, ama hak sahibinin şikâyetiyle uygulama kaldırılabilir (Apple 5.2, Play fikri mülkiyet).
   Seçenekler: lisanslı veri (Places API + atıf), yalnızca GUR kullanıcılarının puanı, ya da puanı
   şimdilik göstermemek.
2. **Kullanıcı yorumu yazma eklenirse:** Apple 1.2 ve Play UGC politikası bildir + engelle + filtre +
   iletişim ister. Eklemeden önce yapılmalı (`magaza:kontrol` bunu denetler).
3. **GUR Plus aboneliği eklenirse:** dijital abonelik için Apple uygulama içi satın alma / Google Play
   Faturalandırma **zorunlu** (iyzico/Stripe olmaz). İşletmelere web'de satılan reklam bundan ayrıdır;
   uygulama içinde işletme satın alması yoktur.
4. **Google/Apple ile giriş eklenirse:** Apple ile giriş zorunlu olur.
5. **Reklam SDK'sı (AdMob) eklenirse:** ATT izni + `NSUserTrackingUsageDescription`, manifest, veri
   güvenliği formu ve `shared/legal.js` güncellenir; alan adı köküne `app-ads.txt` konur.
6. **Bildirim eklenirse:** izin metni, gizlilik metni ve veri güvenliği formu güncellenir.
7. **Bundle ID** (yukarıda) ve **yaş derecesi** (alkol).
