import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { TuketiciLanding } from './app/site.jsx';

// ═══════════════════════════════════════════════════════════════════════
// GUR DÖRT PARÇADAN OLUŞUR — üçü burada, biri ayrı depo klasöründe:
//
//   /          → TANITIM WEB SİTESİ (tüketici; mağazaya yönlendirir)
//   /isletme/* → RESTORAN KAYIT WEB SİTESİ (Doyurucu: tanıtım + kayıt + panel)
//   /admin     → YÖNETİCİ PANELİ
//   mobile/    → MOBİL UYGULAMA (Expo/React Native, App Store + Google Play)
//
// Tüketicinin kullandığı uygulama MOBİL UYGULAMADIR. Tarayıcıda ikinci
// bir tüketici uygulaması YOK: iki kabuk aynı işi yapınca hangisinin
// gerçek ürün olduğu okunmuyordu ve genişliğe göre dallanan bir kök yol
// (`/`) bunu iyice karıştırıyordu. Şimdi tek bir cevap var — site
// anlatır, mağaza indirtir, uygulama çalışır.
//
// Ortak olan ekranlar değil VERİ: `src/lib/*` depoları, `src/data/
// restaurants.js` ve `shared/*` dört parçayı birbirine bağlıyor.
// ═══════════════════════════════════════════════════════════════════════
const GurAdmin = lazy(() => import('./admin/GurAdmin.jsx'));
const GurBusiness = lazy(() => import('./business/GurBusiness.jsx'));

// Panel indirilirken beyaz ekran kalmasın diye paneli anımsatan koyu bir zemin
const AdminFallback = () => (
  <div style={{ height: '100vh', background: '#0B0B0D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B72', fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 13 }}>
    Yükleniyor…
  </div>
);

const router = createBrowserRouter([
  { path: '/', element: <TuketiciLanding /> },
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
