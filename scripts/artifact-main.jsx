// ═══════════════════════════════════════════════════════════════════════
// Artifact giriş noktası.
//
// Yayınlanan önizleme TEK bir HTML dosyası: ayrı bir chunk yükleyemez ve
// yol tabanlı yönlendirme kullanamaz. Bu yüzden burada
//   • GurAdmin STATİK olarak içe aktarılır (React.lazy YOK — tembel yükleme
//     ayrı dosya üretir, artifact onu bulamaz ve panel açılmaz),
//   • yönlendirme hash tabanlıdır,
//   • sol üstte müşteri/işletme/yönetici geçişi vardır.
//
// Depodaki src/main.jsx'e dokunulmaz; derleme sırasında geçici olarak
// bununla değiştirilir (scripts/build-artifact.mjs).
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { TuketiciLanding } from '../src/app/site.jsx';
import GurAdmin from '../src/admin/GurAdmin.jsx';
import GurBusiness from '../src/business/GurBusiness.jsx';

const router = createHashRouter([
  { path: '/', element: <TuketiciLanding /> },
  { path: '/isletme/*', element: <GurBusiness /> },
  { path: '/admin', element: <GurAdmin /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function ArtifactSwitcher() {
  // Yönlendiriciye abone oluruz, hash'e değil: React Router hash'i
  // pushState ile değiştirdiği için 'hashchange' olayı çıkmaz ve
  // uygulama içinden gelen geçişlerde sekme yanlış yerde kalırdı.
  const [path, setPath] = useState(() => router.state.location.pathname);
  useEffect(() => router.subscribe((state) => setPath(state.location.pathname)), []);
  // ÜÇ WEB YÜZEYİ, ÜÇ SEKME. Dördüncü parça olan MOBİL UYGULAMA bu
  // derlemenin içinde değil: o ayrı bir paket (mobile/, Expo) ve App
  // Store / Google Play'e çıkıyor.
  const sekmeler = [
    ['Tanıtım', '/', (y) => y === '/'],
    ['İşletme', '/isletme', (y) => y.startsWith('/isletme')],
    ['Yönetici', '/admin', (y) => y.startsWith('/admin')],
  ];
  const go = (to) => { router.navigate(to); };
  const style = (active) => ({
    border: 'none', cursor: 'pointer', borderRadius: 999, padding: '6px 14px',
    fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 12.5, fontWeight: 700,
    background: active ? '#FF6600' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.65)',
  });
  return (
    <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 99999, display: 'flex', gap: 4, background: 'rgba(20,18,26,0.82)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: 4 }}>
      {sekmeler.map(([ad, yol, aktifMi]) => (
        <button key={yol} style={style(aktifMi(path))} onClick={() => go(yol)}>{ad}</button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <ArtifactSwitcher />
      <RouterProvider router={router} />
    </MotionConfig>
  </React.StrictMode>
);
