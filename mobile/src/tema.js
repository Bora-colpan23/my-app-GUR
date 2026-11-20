// ═══════════════════════════════════════════════════════════════════════
// TEMA JETONLARI — webdeki GurStyles'ın React Native karşılığı
//
// Web tarafı renkleri CSS değişkenlerinden okuyor; React Native'de
// `var()` yok, bu yüzden jetonlar düz bir JS nesnesi (yönetici panelinin
// `C`si gibi). DEĞERLER BİREBİR AYNI: aynı ürünün iki kabuğu farklı
// turuncu kullanamaz.
//
// Yeni renk yazmayın — ailede zaten var (bkz. CLAUDE.md → "Tutarlı renk
// seçimi"). Yeni bir yeşil/kırmızı/amber tanımlamak yasak.
// ═══════════════════════════════════════════════════════════════════════

export const R = {
  // yüzeyler
  bg: '#FDFBF7',
  bg2: '#F4EFE7',
  kart: '#ffffff',
  ince: '#FBFAF8',
  gorselBg: '#e8e0d8',
  espresso: '#17130F',

  // mürekkep
  murekkep: '#1C1917',
  murekkep2: '#4A443E',
  solgun: '#6F6459',
  cizgi: '#E3DCD2',
  kenar: 'rgba(45,36,25,0.10)',

  // marka
  marka: '#FF6600',
  markaBas: '#FF7A1A',
  markaSon: '#F04E00',
  markaMurekkep: '#B4530A',        // kâğıt üstünde turuncu METİN (5.02:1)
  markaMurekkepYumusak: '#A84D09', // %8–10 turuncu tint üstünde (4.87:1)
  markaYumusak: 'rgba(255,102,0,0.08)',
  markaAcik: '#FF9A4D',            // KOYU zemin için

  // turuncu dolgu üstü
  uzeriMarka: '#ffffff',
  uzeriMarka2: 'rgba(255,255,255,0.86)',

  // durumlar — dolgu parlak, YAZI zemine göre ton değiştirir
  olumlu: '#13B364', olumluMurekkep: '#0A7C46', olumluAcik: '#4ADE80', olumluYumusak: 'rgba(19,179,100,0.12)',
  olumsuz: '#E5484D', olumsuzMurekkep: '#C2282D', olumsuzAcik: '#FF7A70', olumsuzYumusak: 'rgba(229,72,77,0.12)',
  uyari: '#F59E0B', uyariMurekkep: '#8A5200', uyariAcik: '#FFB454', uyariYumusak: '#FEF3C7',

  // tonlu griler (nötr gri kremsi kâğıdın yanında ölü duruyor)
  sicak1: '#F6F3EE', sicak2: '#E0D9D0', sicak3: '#D6CFC7', sicak4: '#BDB4AA',
  sicakMurekkep: '#2E2A26', sicakKoyu: '#1B1714',

  // GUR kelime markasının harfleri (logotype — palet kuralının dışında)
  logoG: '#FFA500', logoU: '#FF6600', logoR: '#FF0000',
};

// Marka gradyanının durakları: turuncunun kendi iki ucu. Tehlike
// kırmızısı karıştırmayın.
export const GRADYAN = [R.markaBas, R.marka, R.markaSon];

// ─── Yazı tipi ───────────────────────────────────────────────────────
// Poppins (başlık) + Outfit (gövde). Başka font kullanma kuralı burada
// da geçerli; aile adları App.js'te yüklenen anahtarların aynısı.
export const F = {
  baslikKara: 'Poppins_900Black',
  baslik: 'Poppins_800ExtraBold',
  baslikOrta: 'Poppins_600SemiBold',
  govdeKalin: 'Outfit_700Bold',
  govdeYari: 'Outfit_600SemiBold',
  govdeOrta: 'Outfit_500Medium',
  govde: 'Outfit_400Regular',
};

// ─── Gölge ───────────────────────────────────────────────────────────
// Web'deki üç katmanlı ölçeğin aynısı. React Native 0.76+ (yeni mimari)
// CSS söz dizimli `boxShadow` kabul ediyor, böylece KATMANLAR KORUNUYOR:
// tek katmanlı shadowRadius kartı kâğıda yapıştırılmış bir leke gibi
// gösteriyordu. `elevation` Android'de yedek olarak duruyor.
const t = '45, 36, 25';
export const G = {
  g1: {
    boxShadow: `0 1px 2px rgba(${t},0.04), 0 2px 6px rgba(${t},0.04), 0 5px 14px rgba(${t},0.035)`,
    elevation: 1,
  },
  g2: {
    boxShadow: `0 1px 2px rgba(${t},0.04), 0 3px 8px rgba(${t},0.045), 0 10px 24px rgba(${t},0.05)`,
    elevation: 3,
  },
  g3: {
    boxShadow: `0 2px 4px rgba(${t},0.04), 0 7px 18px rgba(${t},0.05), 0 18px 42px rgba(${t},0.06)`,
    elevation: 6,
  },
  g4: {
    boxShadow: `0 4px 8px rgba(${t},0.05), 0 14px 30px rgba(${t},0.07), 0 32px 70px rgba(${t},0.09)`,
    elevation: 12,
  },
  // Turuncu yüzeyin gölgesi de turuncu: nötr gri markanın altını kirletiyor.
  marka: {
    boxShadow: '0 1px 2px rgba(190,70,0,0.10), 0 4px 10px rgba(190,70,0,0.16), 0 10px 24px rgba(190,70,0,0.18)',
    elevation: 6,
  },
  // Fotoğraf ve koyu zemin üstünde sıcak-soluk gölge okunmaz.
  koyu3: {
    boxShadow: '0 3px 8px rgba(0,0,0,0.14), 0 10px 26px rgba(0,0,0,0.18), 0 24px 56px rgba(0,0,0,0.22)',
    elevation: 10,
  },
};

// ─── Ölçekler ────────────────────────────────────────────────────────
export const YARICAP = { hap: 999, kap: 26, kart: 18, parca: 12 };
export const BOSLUK = { xs: 6, s: 10, m: 14, l: 18, xl: 24, xxl: 32 };

// Dokunma hedefi: en az 44×44 (CLAUDE.md). Tek yerden okunsun ki
// "biraz küçük olsa da olur" diye bir karar verilmesin.
export const HEDEF = 44;
