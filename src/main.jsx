import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import GurApp from './app/GurApp.jsx';

// İki ayrı arayüz:
//   /          → Tüketici mobil uygulaması (telefon çerçevesi içinde)
//   /admin     → Yönetici paneli (tam ekran masaüstü)
//
// Yönetici paneli ayrı bir parçaya alındı: tüketiciler asla açmayacağı hâlde
// paneli de indiriyordu. Artık yalnızca /admin açıldığında yükleniyor.
const GurAdmin = lazy(() => import('./admin/GurAdmin.jsx'));

// Panel indirilirken beyaz ekran kalmasın diye paneli anımsatan koyu bir zemin
const AdminFallback = () => (
  <div style={{ height: '100vh', background: '#0B0B0D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B72', fontFamily: 'Poppins, system-ui, sans-serif', fontSize: 13 }}>
    Panel yükleniyor…
  </div>
);

const router = createBrowserRouter([
  { path: '/', element: <GurApp /> },
  { path: '/admin', element: <Suspense fallback={<AdminFallback />}><GurAdmin /></Suspense> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* reducedMotion="user" — sistem "Hareketi Azalt" ayarını tüm spring/tap animasyonlarına otomatik uygular */}
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </React.StrictMode>
);
