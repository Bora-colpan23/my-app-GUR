import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import GurApp from './app/GurApp.jsx';
import GurAdmin from './admin/GurAdmin.jsx';

// İki ayrı arayüz:
//   /          → Tüketici mobil uygulaması (telefon çerçevesi içinde)
//   /admin     → Yönetici paneli (tam ekran masaüstü)
const router = createBrowserRouter([
  { path: '/', element: <GurApp /> },
  { path: '/admin', element: <GurAdmin /> },
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
