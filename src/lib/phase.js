// ═══════════════════════════════════════════════════════════════════
// GELİR MODELİ FAZLARI
// ═══════════════════════════════════════════════════════════════════
// Ürün, gelir kalemlerini üç fazda açıyor. Aktif faz tek bir yerde
// tutulur; hem tüketici uygulaması hem yönetici paneli buradan okur.
// Yönetici panelindeki faz anahtarı değiştiğinde uygulama tarafındaki
// kartlar, fırsatlar ve satın alma akışları aynı anda açılıp kapanır.
//
// Kalıcılık localStorage'da: sekme yenilense de seçilen faz korunur.
// (Uygulamanın geri kalanı hâlâ mock veriyle çalışıyor — burada
// kalıcılık şart, çünkü faz demo boyunca sabit kalmalı.)

import { useSyncExternalStore } from 'react';

const KEY = 'gur.phase';
const MIN = 1;
const MAX = 3;

export const PHASES = [
  {
    id: 1,
    name: 'Temel Büyüme ve Monetizasyon',
    short: 'Faz 1',
    summary: 'Reklam envanteri ve gıda sponsorlukları ile hızlı nakit akışı.',
    existing: ['Uygulama içi banner/ekran reklamları', 'Push bildirim reklamları', 'Temel gıda sponsorlukları'],
    added: ['Swipe akışına gömülü “Sponsorlu Tarif” / “Şefin Seçimi” kartları'],
  },
  {
    id: 2,
    name: 'Etkileşim ve Performans Odaklı Ticaret',
    short: 'Faz 2',
    summary: 'Kullanıcı kitlesi büyüdü; performansa ve işleme dayalı gelir açılıyor.',
    existing: ['“İkinci Şans” kaydırma algoritması'],
    added: ['Konum bazlı anlık fırsat bildirimleri', 'Rezervasyon ve özel menü komisyonu'],
  },
  {
    id: 3,
    name: 'B2B Ekosistem ve VIP Marka Algısı',
    short: 'Faz 3',
    summary: 'Üç büyük semtte toplanan veri ve içerik, restorana ürün olarak satılıyor.',
    existing: ['“Gastro Onaylı” şefli video tanıtım paketi'],
    added: ['Gastro içerik lisanslama (15 sn dikey video)', 'Restoran Analiz Paneli (aylık SaaS)'],
  },
];

// Özellik → açıldığı faz. Tek kaynak: hem UI kapıları hem gelir sayfası
// bu haritadan besleniyor, böylece ikisi birbirinden kopamaz.
export const FEATURE_PHASE = {
  bannerAds: 1,        // uygulama içi banner/ekran reklamı
  pushAds: 1,          // push bildirim reklamı
  sponsoredCards: 1,   // swipe akışındaki sponsorlu kartlar
  secondChance: 2,     // geçilen restoranın desteye geri dönmesi
  instantDeals: 2,     // konum bazlı anlık indirim
  reservations: 2,     // rezervasyon + tadım menüsü komisyonu
  chefVideo: 3,        // şefli video tanıtım paketi
  contentLicense: 3,   // videonun restorana lisanslanması
  analyticsSaas: 3,    // B2B analiz paneli aboneliği
};

const clamp = (n) => Math.min(MAX, Math.max(MIN, Number(n) || MIN));

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw == null ? MIN : clamp(raw);
  } catch {
    return MIN; // gizli sekme / depolama kapalı — varsayılana düş
  }
}

let current = read();
const listeners = new Set();

function emit() {
  listeners.forEach(fn => fn());
}

export function getPhase() {
  return current;
}

export function setPhase(next) {
  const value = clamp(next);
  if (value === current) return;
  current = value;
  try { localStorage.setItem(KEY, String(value)); } catch { /* depolama yoksa bellekte kalır */ }
  emit();
}

function subscribe(fn) {
  listeners.add(fn);
  // Aynı origin'deki diğer sekme fazı değiştirirse burası da güncellensin
  const onStorage = (e) => { if (e.key === KEY) { current = read(); fn(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
}

/** Aktif faz numarası (1-3). */
export function usePhase() {
  return useSyncExternalStore(subscribe, getPhase, () => MIN);
}

/** Bir özelliğin aktif fazda açık olup olmadığı. */
export function useFeature(name) {
  const phase = usePhase();
  const need = FEATURE_PHASE[name];
  return need != null && phase >= need;
}

/** Hook dışında (örn. saf fonksiyonlarda) aynı kontrol. */
export function hasFeature(name, phase = current) {
  const need = FEATURE_PHASE[name];
  return need != null && phase >= need;
}
