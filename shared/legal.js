// ═══════════════════════════════════════════════════════════════════════
// YASAL METİNLER — TEK KAYNAK
//
// Web uygulaması (GurApp), mağaza paketi (mobile/) ve web sitesindeki
// /gizlilik /kosullar /kvkk /hesap-silme /destek sayfaları BURADAN okur.
// Üç yerde üç ayrı metin olsaydı biri uygulamanın gerçekte yaptığından
// sapardı — ve mağaza incelemesinde en sık çıkan ret/kaldırma sebebi tam
// olarak budur: gizlilik politikasının, uygulamanın ve mağazadaki "veri
// güvenliği / gizlilik etiketi" formunun BİRBİRİNİ TUTMAMASI.
//
// KURAL: bu metindeki her cümle uygulamanın GERÇEKTE yaptığıyla örtüşmeli.
// Yeni bir veri toplanınca (bildirim izni, kamera, ödeme, reklam SDK'sı…)
// önce burası, sonra mağaza formları güncellenir. Olmayan bir özelliği
// "var" gibi yazmayın ("kamera izni" ve "ödeme" cümleleri bu yüzden
// kaldırıldı: uygulama şu an kamera istemiyor, tahsilat yapmıyor).
//
// Bu metinler hukuki tavsiye değildir; yayından önce bir hukuk danışmanına
// onaylatın. İŞLETME BİLGİLERİ YER TUTUCUDUR: aşağıdaki `dogrulandi`
// bayrağı gerçek bilgiler girilene kadar false kalır ve
// `npm run magaza:kontrol` mağaza gönderimini durdurur.
// ═══════════════════════════════════════════════════════════════════════

export const LEGAL = {
  unvan: "GUR Teknoloji A.Ş.",      // ticaret unvanı
  adres: "İstanbul, Türkiye",        // tebligat adresi (açık adres yazın)
  eposta: "kvkk@gur.app",            // veri sorumlusu / KVKK başvuruları
  destek: "destek@gur.app",          // kullanıcı desteği + içerik bildirimi
  guncelleme: "15 Kasım 2026",
  // Yukarıdaki dört bilgi GERÇEK ve erişilebilir olduğunda true yapın:
  // eposta/destek kutuları gerçekten okunuyor mu, unvan sicildeki ile aynı mı.
  dogrulandi: false,
};

export const LEGAL_OPERATOR = LEGAL.unvan;
export const LEGAL_ADDRESS = LEGAL.adres;
export const LEGAL_CONTACT = LEGAL.eposta;
export const LEGAL_UPDATED = LEGAL.guncelleme;

/** [başlık, metin] çiftleri. Tek biçim: web, mobil ve sayfalar aynı diziyi çizer. */
export const LEGAL_DOCS = [
  {
    id: "kvkk",
    label: "KVKK",
    title: "Kişisel Verilerin Korunması Aydınlatma Metni",
    body: [
      ["Veri sorumlusu", `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz, veri sorumlusu sıfatıyla ${LEGAL.unvan} (${LEGAL.adres}) tarafından aşağıda açıklanan kapsamda işlenmektedir.`],
      ["İşlenen veriler", "Hesap verileri (ad, e-posta); uygulama içi tercihleriniz ve kararlarınız (kaydırma kararları, kaydettiğiniz mekânlar); masa talepleriniz (mekân, kişi sayısı, zaman, notunuz); işletme sahibiyseniz sahiplenme başvurunuzdaki bilgiler (ticari unvan, vergi numarası, iletişim bilgisi); rızanız varsa kullanım istatistikleri; cihaz ve bağlantı verileri (cihaz türü, işletim sistemi, IP adresi)."],
      ["Konum", "Konumunuz yakınınızdaki mekânları sıralamak için YALNIZCA cihazınızda kullanılır; ham koordinatlarınız sunucularımıza gönderilmez. Konumla doğrulanan yorum özelliğinde mekâna yakınlığı doğrulamak için konum örnekleri gönderilir; ham konum saklanmaz, yalnızca mesafe ve kalış süresi özeti tutulur. Konum iznini istediğiniz an cihaz ayarlarından kapatabilirsiniz; uygulama ilçe seçerek de kullanılabilir."],
      ["İşleme amaçları", "Üyeliğin oluşturulması ve yürütülmesi, mekân önerilerinin sıralanması, kayıtlı mekânlarınızın ve masa taleplerinizin saklanması, işletme sahiplenme başvurularının değerlendirilmesi, hizmet güvenliğinin sağlanması, hataların giderilmesi ve — yalnızca rızanızla — ürünün geliştirilmesi için istatistik üretilmesi."],
      ["Hukuki sebepler", "Sözleşmenin kurulması ve ifası (m.5/2-c), hukuki yükümlülük (m.5/2-ç), meşru menfaat (m.5/2-f) ve açık rızanız (m.5/1). Kullanım istatistiği ve pazarlama iletişimi yalnızca açık rızaya dayanır; rıza vermemeniz hizmetin kullanımını engellemez."],
      ["Aktarım", "Veriler; barındırma ve veritabanı hizmeti aldığımız altyapı sağlayıcısına, talep hâlinde yetkili kamu kurumlarına ve — masa talebi gönderdiyseniz — yalnızca ilgili işletmeye aktarılır. Altyapı sağlayıcısının veri merkezleri yurt dışında olabilir; bu aktarım KVKK m.9 şartlarına uygun olarak yapılır."],
      ["Saklama süresi", "Hesap verileriniz hesabınız açık kaldığı sürece saklanır. Hesabınızı sildiğinizde profiliniz, kaydırma kararlarınız, kayıtlı mekânlarınız ve yorumlarınız silinir; muhasebe kayıtları gibi yasal zorunluluk gerektiren kayıtlar kişi bağı koparılarak saklanabilir."],
      ["Haklarınız", `KVKK m.11 kapsamında verilerinize erişme, düzeltme, silme, işlemeye itiraz etme ve veri taşınabilirliği haklarına sahipsiniz. Başvurularınızı ${LEGAL.eposta} adresine iletebilirsiniz; talepleriniz en geç 30 gün içinde yanıtlanır. Uygulamadaki "Hesabımı sil" seçeneği silme talebinizi doğrudan başlatır.`],
    ],
  },
  {
    id: "privacy",
    label: "Gizlilik",
    title: "Gizlilik Politikası",
    body: [
      ["Ne topluyoruz", "Yalnızca hizmeti sunmak için gerekli olanı: hesap bilgileriniz (ad, e-posta), kaydırma kararlarınız, kaydettiğiniz mekânlar ve gönderdiğiniz masa talepleri. Rehberinize, fotoğraflarınıza, mikrofonunuza veya kameranıza erişmiyoruz."],
      ["Konum", "Konum izni yalnızca yakınınızdaki restoranları sıralamak için, uygulamayı kullanırken (arka planda DEĞİL) istenir ve istemezseniz ilçe seçerek devam edebilirsiniz. Ham koordinatlarınız sunucularımıza gönderilmez; mesafe cihazınızda hesaplanır."],
      ["Takip yok", "Sizi diğer uygulama ve sitelerde izlemiyoruz, reklam amaçlı bir kimlik profili oluşturmuyoruz ve verilerinizi veri simsarlarına satmıyoruz."],
      ["Ölçümleme", "Kullanım istatistikleri yalnızca açık rızanızla ve kimliğinize bağlı olarak toplanır. Rıza vermezseniz olaylar kimliğinizden ayrı, yalnızca toplulaştırma için tutulur. Rızanızı profil ekranından istediğiniz an geri alabilirsiniz."],
      ["Reklamlar", "Bazı kartlar işletmelerce desteklenir ve \"Sponsorlu\" etiketiyle açıkça işaretlenir. Reklam gösterimi için kimliğiniz reklam verenle paylaşılmaz; yalnızca toplulaştırılmış gösterim ve etkileşim sayıları raporlanır."],
      ["Mekân bilgisi", "Mekân bilgileri üçüncü taraf kaynaklardan derlenir ve hatalı olabilir. İşletmeler kayıtlarını sahiplenip düzeltebilir. Hatalı bilgiyi veya uygunsuz içeriği bildirmek için " + LEGAL.destek + " adresine yazın."],
      ["Hesabı silme", "Hesabınızı uygulamada Profil → \"Hesabımı sil\" ile tek onayla silebilirsiniz. Uygulamaya erişemiyorsanız sitemizdeki hesap silme sayfasındaki adımları izleyin; talebiniz en geç 30 gün içinde sonuçlandırılır."],
      ["Güvenlik", "Veriler aktarımda TLS ile korunur, parolalar geri döndürülemez biçimde saklanır, her kullanıcı yalnızca kendi verisine erişebilir. Bir ihlal hâlinde KVKK m.12 uyarınca en kısa sürede Kurul'a ve size bildirim yapılır."],
      ["Çocuklar", "Uygulama 13 yaşın altındaki kullanıcılara yönelik değildir ve onlardan bilerek veri toplamayız."],
      ["Değişiklikler", "Veri uygulamalarımız değiştiğinde bu metni güncelleriz; önemli değişiklikleri uygulama içinde duyururuz."],
    ],
  },
  {
    id: "terms",
    label: "Koşullar",
    title: "Kullanım Koşulları",
    body: [
      ["Hizmet", `GUR, restoran keşfi sunan bir platformdur. ${LEGAL.unvan} restoranların işletmecisi değildir; yemek, servis ve hijyen sorumluluğu ilgili işletmeye aittir.`],
      ["Hesabınız", "Verdiğiniz bilgilerin doğruluğundan ve hesabınızın güvenliğinden siz sorumlusunuz. Hesabınızı istediğiniz zaman profil ekranından silebilirsiniz."],
      ["İçerik kuralları", `Yorumlarınız gerçek bir deneyime dayanmalıdır. Hakaret, ayrımcılık, gizli reklam, başkasına ait içerik ve yanıltıcı puanlama yasaktır; bu içerikler bildirim üzerine veya resen kaldırılabilir, kuralları tekrar tekrar ihlal eden hesaplar kapatılabilir. Uygunsuz içeriği ${LEGAL.destek} adresine bildirebilirsiniz.`],
      ["Gastro Onaylı", "Gastro rozeti bağımsız şef değerlendirmesine dayanır; puanla otomatik verilmez ve satın alınamaz."],
      ["Masa talebi", "Masa talebi göndermek ücretsizdir ve GUR bu talepten komisyon almaz. Talebin kabulü ve masanın tutulması ilgili işletmeye aittir; yalnızca kaydını sahiplenmiş işletmelere talep gönderilebilir."],
      ["Alkol", "Uygulamada alkol servisi yapan mekânlar da listelenir. GUR alkol satışı yapmaz ve alkol sipariş ettirmez; alkollü mekânları kullanmak 18 yaş ve üzeri içindir."],
      ["Ücretli hizmetler", "İşletmelere sunulan ücretli özellikler işletmeyle ayrıca kararlaştırılan koşullarla geçerlidir. Mağaza üzerinden yapılan satın alımlarda ilgili mağazanın ödeme ve iade koşulları uygulanır."],
      ["Sorumluluğun sınırı", "Puanlar, mesafeler ve çalışma saatleri bilgilendirme amaçlıdır ve hata içerebilir; gitmeden önce işletmeyle teyitleşmenizi öneririz."],
      ["Uygulanacak hukuk", `Bu koşullara Türk hukuku uygulanır; uyuşmazlıklarda İstanbul mahkemeleri ve icra daireleri yetkilidir. Sorularınız için ${LEGAL.destek}.`],
    ],
  },
];

/** /hesap-silme sayfası ve mağaza formlarındaki "silme talebi" adresi için. */
export const SILME_ADIMLARI = [
  "Uygulamayı açın, alt çubuktan Profil sekmesine gidin.",
  "En alttaki \"Hesabımı sil\" düğmesine dokunun ve onaylayın. Hesabınız ve ona bağlı veriler hemen silinir.",
  `Uygulamaya erişemiyorsanız ${LEGAL.destek} adresine, kayıtlı e-postanızdan "Hesabımı silin" başlıklı bir ileti gönderin; talebiniz en geç 30 gün içinde sonuçlandırılır.`,
];
export const SILINEN_VERI = [
  "Hesabınız ve profiliniz",
  "Kaydırma kararlarınız ve kaydettiğiniz mekânlar",
  "Yorumlarınız",
  "Cihaz kayıtlarınız",
];
export const KALAN_VERI =
  "Muhasebe gibi yasal saklama gerektiren kayıtlar kişi bağı koparılarak saklanabilir; hangi kullanıcıya ait olduğu artık anlaşılamaz.";

/** Gönderimden önce: işletme bilgileri doğrulanmadıysa sebebi döndürür. */
export function legalEksikleri() {
  const e = [];
  if (!LEGAL.dogrulandi) e.push("shared/legal.js → LEGAL.dogrulandi false: unvan, adres ve e-posta adresleri gerçek bilgilerle doldurulup true yapılmalı");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(LEGAL.eposta)) e.push("LEGAL.eposta geçerli bir e-posta değil");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(LEGAL.destek)) e.push("LEGAL.destek geçerli bir e-posta değil");
  if (!LEGAL.adres || /^İstanbul, Türkiye$/.test(LEGAL.adres)) e.push("LEGAL.adres açık adres değil (yalnızca şehir yazıyor)");
  return e;
}
