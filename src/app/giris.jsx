// ═══════════════════════════════════════════════════════════════════════
// `/` — TELEFONDA UYGULAMA, MASAÜSTÜNDE SİTE
//
// Müşteri telefonda UYGULAMAYI kullanıyor; pazarlama sayfası onun önüne
// çıkmamalı. Masaüstünde ise tam tersi: GUR mobil bir ürün, masaüstünden
// gelen ziyaretçinin işi uygulamayı kullanmak değil, ne olduğunu okuyup
// mağazadan indirmek.
//
//   /           telefonda GurApp      · masaüstünde TuketiciLanding
//   /site       her genişlikte site   (telefonda da gezilebilsin diye)
//   /uygulama   her genişlikte uygulama
//
// KARAR BİR KEZ, İLK ÇİZİMDE VERİLİYOR. `useMediaQuery` ile canlı
// dinlenseydi masaüstünde pencereyi daraltan kullanıcının altından
// pazarlama sayfası çekilir, yerine uygulama (ve açılış ekranı) konurdu
// — kimsenin istemediği bir takla. Eşik `GENIS` (900 px), projenin her
// yerinde kullanılan ayrım.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { GENIS } from '../ui/kit.jsx';
import GurApp from './GurApp.jsx';
import { TuketiciLanding } from './site.jsx';

export default function TuketiciGiris() {
  const [telefon] = useState(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? !window.matchMedia(GENIS).matches
      : false
  ));
  return telefon ? <GurApp /> : <TuketiciLanding />;
}
