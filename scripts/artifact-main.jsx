// ═══════════════════════════════════════════════════════════════════════
// Artifact giriş noktası.
//
// Yayınlanan önizleme TEK bir HTML dosyası: ayrı bir chunk yükleyemez ve
// yol tabanlı yönlendirme kullanamaz. Bu yüzden burada
//   • GurAdmin STATİK olarak içe aktarılır (React.lazy YOK — tembel yükleme
//     ayrı dosya üretir, artifact onu bulamaz ve panel açılmaz),
//   • yönlendirme hash tabanlıdır,
//   • sol üstte uygulama/yönetici geçişi vardır.
//
// Depodaki src/main.jsx'e dokunulmaz; derleme sırasında geçici olarak
// bununla değiştirilir (scripts/build-artifact.mjs).
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import GurApp from '../src/app/GurApp.jsx';
import GurAdmin from '../src/admin/GurAdmin.jsx';

const router = createHashRouter([
  { path: '/', element: <GurApp /> },
  { path: '/admin', element: <GurAdmin /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function ArtifactSwitcher() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const admin = hash.startsWith('#/admin');
  const go = (to) => { window.location.hash = to; };
  const style = (active) => ({
    border: 'none', cursor: 'pointer', borderRadius: 999, padding: '6px 14px',
    fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 12.5, fontWeight: 700,
    background: active ? '#FF6600' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.65)',
  });
  return (
    <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 99999, display: 'flex', gap: 4, background: 'rgba(20,18,26,0.82)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: 4 }}>
      <button style={style(!admin)} onClick={() => go('/')}>Uygulama</button>
      <button style={style(admin)} onClick={() => go('/admin')}>Yönetici</button>
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
