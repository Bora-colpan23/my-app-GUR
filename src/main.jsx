import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { TuketiciLanding } from './app/site.jsx';

// ═══════════════════════════════════════════════════════════════════════
// GUR DÖRT PARÇADAN OLUŞUR — üçü burada, biri ayrı depo klasöründe:
//
//   /          → TANITIM WEB SİTESİ (tüketici; mağazaya yönlendirir)
//   /uygulama  → TÜKETİCİ UYGULAMASI (telefon çerçevesi içinde)
//   /isletme/* → RESTORAN KAYIT WEB SİTESİ (Doyurucu: tanıtım + kayıt + panel)
//   /admin     → YÖNETİCİ PANELİ
//   mobile/    → MAĞAZA PAKETİ (Expo/React Native, App Store + Google Play)
//
// `/uygulama` 5 Ekim'deki tüketici uygulaması (`app/GurApp.jsx`), 15 Ekim
// sürümüyle birebir aynı. Bir dönem kaldırılmıştı ve yerine Expo paketi
// geçmişti; Expo'ya yalnızca on ekran taşınmıştı (GUR Match, ödüllü
// reklam, GUR Plus, masa ayırtma, yorum yazma ve yasal metinler
// taşınmamıştı), bu yüzden tam sürüm geri getirildi.
//
// KÖK YOL GENİŞLİĞE GÖRE DALLANMIYOR. Eskiden `/` telefonda uygulamayı,
// masaüstünde siteyi açıyordu ve hangisinin gerçek ürün olduğu
// okunmuyordu. Artık iki ayrı adres: `/` anlatır, `/uygulama` çalışır.
//
// Ortak olan ekranlar değil VERİ: `src/lib/*` depoları, `src/data/
// restaurants.js` ve `shared/*` dört parçayı birbirine bağlıyor.
// ═══════════════════════════════════════════════════════════════════════
// Üçü de AYRI PARÇADA. Tanıtım sayfasını açan ziyaretçi ne paneli ne de
// tüketici uygulamasını indirsin: `/` yalnızca mağazaya yollayan bir
// sayfa, uygulamanın 4.476 satırı orada boşuna iner. Artifact derlemesi
// bunun TERSİNİ yapıyor (`scripts/artifact-main.jsx`): tek dosyalık
// önizleme ayrı bir parça yükleyemez, orada üçü de statik.
const GurAdmin = lazy(() => import('./admin/GurAdmin.jsx'));
const GurBusiness = lazy(() => import('./business/GurBusiness.jsx'));
const GurApp = lazy(() => import('./app/GurApp.jsx'));

// Panel indirilirken beyaz ekran kalmasın diye paneli anımsatan koyu bir zemin
const AdminFallback = () => (
  <div style={{ height: '100vh', background: '#0B0B0D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B72', fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 13 }}>
    Yükleniyor…
  </div>
);

const router = createBrowserRouter([
  { path: '/', element: <TuketiciLanding /> },
  { path: '/uygulama', element: <Suspense fallback={<AdminFallback />}><GurApp /></Suspense> },
  // Doyurucu'nun kendi alt yolları var (/isletme/kayit, /isletme/giris,
  // /isletme/panel …). Splat olmadan bu adresler "*" kuralına düşüp ana
  // sayfaya yönleniyordu.
  { path: '/isletme/*', element: <Suspense fallback={<AdminFallback />}><GurBusiness /></Suspense> },
  { path: '/admin', element: <Suspense fallback={<AdminFallback />}><GurAdmin /></Suspense> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

// ─── ÇEVRİMDIŞI KABUK ───────────────────────────────────────────────
// Uçak modunda sayfa yenilenince site ölüyordu (ERR_INTERNET_
// DISCONNECTED). Ayrıntılar public/sw.js içinde.
//
// Tek dosyalık artifact önizlemesinde KAYIT YAPILMIYOR: sayfa
// claude.ai'den servis ediliyor, kendi kaynağı yok. Geliştirmede de
// yapılmıyor — HMR ile önbellek birbirini yer.
if (!__GUR_ARTIFACT__ && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* kayıt olmazsa site yine çalışır */ });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* reducedMotion="user" — sistem "Hareketi Azalt" ayarını tüm spring/tap animasyonlarına otomatik uygular */}
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </React.StrictMode>
);
