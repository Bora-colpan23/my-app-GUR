// ═══════════════════════════════════════════════════════════════════════
// GUR — çevrimdışı kabuk (uçak modu testi)
//
// Önceden uçak modunda SAYFA YENİLENİNCE uygulama ölüyordu: tarayıcının
// ERR_INTERNET_DISCONNECTED ekranı geliyordu. Oysa GUR'un YEREL modu tam
// da bunun için var — veriler zaten localStorage'da, eksik olan tek şey
// kabuğun kendisiydi.
//
// İKİ AYRI STRATEJİ, bilinçli:
//   • BELGE (HTML) → önce ağ. Yeni bir dağıtım çıktığında kullanıcı onu
//     hemen almalı; ağ yoksa önbellekteki kabuk devreye giriyor.
//   • VARLIK (hash'li js/css/font) → önce önbellek. Dosya adı içeriğin
//     hash'ini taşıyor, yani aynı ad = aynı içerik; ağa sormak boşuna.
//
// Tersini yapmak (belgeyi önbellekten vermek) en klasik hatayı doğururdu:
// dağıtım yapılır, kullanıcı haftalarca eski sürümü görür.
// ═══════════════════════════════════════════════════════════════════════
const SURUM = 'gur-v1';
const KABUK = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  // skipWaiting: yeni sürüm bir sonraki açılışı beklemesin.
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Eski sürümlerin önbelleği silinir, yoksa kota zamanla dolar.
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== SURUM).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET') return;
  const url = new URL(istek.url);
  if (url.origin !== self.location.origin) return;   // dış kaynak bize ait değil
  if (url.pathname.startsWith('/api/')) return;      // API'yi önbelleğe almıyoruz

  if (istek.mode === 'navigate') {
    e.respondWith(
      fetch(istek)
        .then(y => { const kopya = y.clone(); caches.open(SURUM).then(c => c.put('/index.html', kopya)); return y; })
        .catch(() => caches.match('/index.html').then(y => y || caches.match('/')))
    );
    return;
  }

  e.respondWith(
    caches.match(istek).then(onbellek => onbellek || fetch(istek).then(y => {
      // Yalnızca başarılı ve aynı kaynaklı yanıtlar saklanıyor; hata
      // sayfasını önbelleğe almak onu kalıcı hâle getirirdi.
      if (y && y.ok && y.type === 'basic') {
        const kopya = y.clone();
        caches.open(SURUM).then(c => c.put(istek, kopya));
      }
      return y;
    }).catch(() => onbellek))
  );
});
