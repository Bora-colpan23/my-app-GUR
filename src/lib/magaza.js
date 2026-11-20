// ═══════════════════════════════════════════════════════════════════════
// MAĞAZA BAĞLANTILARI — TEK YER
//
// GUR'un tüketici ürünü MOBİL UYGULAMA: App Store ve Google Play'e çıkan
// paket (`mobile/`). Web tarafındaki her yüzey ona yollar — tanıtım
// sayfasındaki rozetler, işletme sitesinin alt bilgisi. İki adres BURADA,
// başka hiçbir yerde yazılı değil: yayına çıkarken yalnızca bu iki satır
// doldurulacak, arayüzün geri kalanı kendiliğinden gerçek bağlantıya döner.
//
// Kendi modülünde duruyor, tanıtım sayfasının içinde değil: işletme
// sitesi de aynı adresleri okuyor ve `src/app/site.jsx`ten içe aktarsaydı
// 400 satırlık tanıtım sayfası işletme parçasına da girerdi.
//
// BOŞKEN SAHTE BAĞLANTI ÜRETİLMİYOR. Olmayan bir mağaza sayfasına götüren
// bir rozet, rozetin hiç olmamasından kötü: kullanıcı tıklar, 404 görür ve
// ürünün var olmadığını düşünür. Adres boşken rozet TIKLANAMAZ bir
// "yakında" çipi olarak çiziliyor.
// ═══════════════════════════════════════════════════════════════════════
export const MAGAZA = {
  ios: "",        // örn. https://apps.apple.com/tr/app/gur/id000000000
  android: "",    // örn. https://play.google.com/store/apps/details?id=app.gur
};
export const MAGAZA_HAZIR = !!(MAGAZA.ios || MAGAZA.android);
