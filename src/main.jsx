import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import GurApp from './app/GurApp.jsx';

// Üç ayrı uygulama, tek ürün:
//   /          → Tüketici mobil uygulaması (telefon çerçevesi içinde)
//   /isletme   → Doyurucu: işletme uygulaması (kendi girişi, kendi oturumu)
//   /admin     → Yönetici paneli (tam ekran masaüstü)
//
// Ortak olan ekranlar değil VERİ: src/lib/* depoları ve src/data/restaurants.js
// üçünü birbirine bağlıyor; ortak arayüz parçaları src/ui/kit.jsx'te.
//
// İşletme ve yönetici uygulamaları ayrı parçaya alındı: tüketiciler asla
// açmayacağı hâlde ikisini de indiriyorlardı.
const GurAdmin = lazy(() => import('./admin/GurAdmin.jsx'));
const GurBusiness = lazy(() => import('./business/GurBusiness.jsx'));

// Panel indirilirken beyaz ekran kalmasın diye paneli anımsatan koyu bir zemin
const AdminFallback = () => (
  <div style={{ height: '100vh', background: '#0B0B0D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B72', fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 13 }}>
    Panel yükleniyor…
  </div>
);

const router = createBrowserRouter([
  { path: '/', element: <GurApp /> },
  { path: '/isletme', element: <Suspense fallback={<AdminFallback />}><GurBusiness /></Suspense> },
  { path: '/admin', element: <Suspense fallback={<AdminFallback />}><GurAdmin /></Suspense> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

// ─── ÇEVRİMDIŞI KABUK ───────────────────────────────────────────────
// Uçak modunda sayfa yenilenince uygulama ölüyordu (ERR_INTERNET_
// DISCONNECTED). GUR'un YEREL modu zaten sunucusuz çalışıyor; eksik olan
// yalnızca kabuğun kendisiydi. Ayrıntılar public/sw.js içinde.
//
// Tek dosyalık artifact önizlemesinde KAYIT YAPILMIYOR: sayfa claude.ai'den
// servis ediliyor, kendi kaynağı yok. Geliştirmede de yapılmıyor — HMR ile
// önbellek birbirini yer.
if (!__GUR_ARTIFACT__ && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* kayıt olmazsa uygulama yine çalışır */ });
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
