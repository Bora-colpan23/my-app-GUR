// ═══════════════════════════════════════════════════════════════════════
// Bakırköy kafe/restoran tablosunu → shared/bakirkoy.js
//
//   node scripts/bakirkoy-iceri-al.mjs <dosya.xlsx>
//   npm run leads:import -- <dosya.xlsx>
//
// Çıktı İSTEMCİ VE SUNUCUNUN ortak okuduğu saf bir modül: tarayıcı havuzu,
// yönetici paneli, işletme sahiplenme listesi ve PostgreSQL tohumu aynı
// 218 kaydı buradan alıyor. Tabloyu elle üç yere kopyalamak, üçünün
// ayrışması demekti.
//
// KURAL: tabloda olmayan hiçbir şey uydurulmaz. Koordinat, saat, fiyat
// düzeyi, açıklama, fotoğraf ve menü tabloda yok; kayıtlarda boş kalır.
// Tablodaki "Tür" sütunu ise yazarının kendi notuna göre İSİMDEN TAHMİN
// edilmiş — bu yüzden kategori eşlemesi de tahmin ve `tur` alanı ham hâliyle
// saklanıyor, ileride düzeltilebilsin.
// ═══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as X from 'xlsx';

const girdi = process.argv[2];
if (!girdi) {
  console.error('Kullanım: node scripts/bakirkoy-iceri-al.mjs <dosya.xlsx>');
  process.exit(1);
}

const cikti = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shared', 'bakirkoy.js');

// Tablodaki "Tür" → GUR kategorisi (src/data/restaurants.js → CATEGORIES).
const KATEGORI = {
  'kafe / kahve': 'Kafe',
  'çay bahçesi': 'Kafe',
  'kafe / bar': 'Kafe',
  'pastane / fırın': 'Tatlıcı',
  'restoran / lokanta': 'Türk Mutfağı',
  'ev yemekleri': 'Türk Mutfağı',
  'kebap / dürüm': 'Türk Mutfağı',
  'pizza': 'İtalyan',
  'burger': 'Fast Food',
  'burger / fast food': 'Fast Food',
  'balık': 'Deniz Ürünleri',
  'meyhane': 'Alkollü',
};

// Adreste geçen mahalle adları. Adres alanı serbest metin ("Kartaltepe Mah.
// Pelinli sokak", "4, Cevizlik, …") olduğu için ilk parçayı bölmek yerine
// bilinen adı arıyoruz.
const MAHALLELER = [
  'Ataköy', 'Zeytinlik', 'Kartaltepe', 'Zuhuratbaba', 'Cevizlik', 'Yeşilyurt',
  'Yenimahalle', 'Osmaniye', 'Sakızağacı', 'Basınköy', 'Şenlikköy', 'Florya',
  'Yeşilköy', 'Bahçelievler',
];

const trKucuk = (s) => String(s ?? '').trim().toLocaleLowerCase('tr');

const slug = (s) => trKucuk(s)
  .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
  .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "05370245343" / "(0212)5431653" / "5431653" → "+90 537 024 53 43". */
function telefon(ham) {
  let d = String(ham ?? '').replace(/\D/g, '');
  if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  // Yedi haneli yerel numara: alan kodu yazılmamış. Bakırköy Avrupa yakası,
  // alan kodu 212.
  if (d.length === 7) d = '212' + d;
  if (d.length !== 10) return null;
  return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

const adres = (s) => { const t = String(s ?? '').trim(); return t || null; };

function url(ham) {
  const t = String(ham ?? '').trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

const wb = X.read(fs.readFileSync(girdi));
const satirlar = X.utils
  .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', blankrows: false })
  .slice(1);

const kayitlar = [];
const kullanilan = new Set();
const atlanan = [];

for (const s of satirlar) {
  const [ad, tur, tel, web, eposta, ig, fb, , adr, puan, yorum] = s;
  const isim = String(ad).trim();
  // Tablonun son satırı bir kaynak notu ("Kaynak: …"), mekân değil.
  if (!isim || /^kaynak\s*:/i.test(isim)) { if (isim) atlanan.push(isim.slice(0, 40) + '…'); continue; }

  // Tablodaki tür isimden tahmin edilmiş ve anahtar sözcük bulamayınca
  // "Restoran / Lokanta"ya düşüyor: "Espressolab" bir restoran değil.
  // Yalnızca o varsayılana düşenler ve yalnızca açık kahve/kafe sözcüğü
  // geçenler düzeltiliyor; diğer tahminlere dokunulmuyor.
  const turDuzeltilmis = /^restoran \/ lokanta$/i.test(String(tur).trim()) &&
    /espresso|coffee|kahve|kafe|cafe/i.test(isim) ? 'Kafe / Kahve' : String(tur).trim();

  const kategori = KATEGORI[trKucuk(turDuzeltilmis)];
  if (!kategori) { atlanan.push(`${isim} (tür tanınmadı: “${tur}”)`); continue; }

  let anahtar = slug(isim) || 'mekan';
  for (let n = 2; kullanilan.has(anahtar); n++) anahtar = `${slug(isim)}-${n}`;
  kullanilan.add(anahtar);

  const adresMetni = adres(adr);
  const mahalle = MAHALLELER.find(m => trKucuk(adresMetni).includes(trKucuk(m))) || null;

  const kayit = {
    anahtar,
    ad: isim,
    kategori,
    tur: turDuzeltilmis,
    mahalle,
    adres: adresMetni,
    telefon: telefon(tel),
    web: url(web),
    eposta: String(eposta).trim() || null,
    instagram: url(ig),
    facebook: url(fb),
    puan: Number.isFinite(Number(puan)) && String(puan).trim() !== '' ? Number(puan) : null,
    yorum: Number.isFinite(Number(yorum)) && String(yorum).trim() !== '' ? Number(yorum) : 0,
  };
  kayitlar.push(kayit);
}

const govde = `// ═══════════════════════════════════════════════════════════════════════
// BAKIRKÖY MEKAN LİSTESİ — ÜRETİLMİŞ DOSYA, ELLE DÜZENLEMEYİN
//
//   npm run leads:import -- <dosya.xlsx>      (scripts/bakirkoy-iceri-al.mjs)
//
// Kaynak: Google Maps taraması, 18.10.2026, Bakırköy merkez, 4 km yarıçap.
// ${kayitlar.length} kayıt. Tabloda OLMAYAN alanlar (koordinat, saat, fiyat düzeyi, fotoğraf,
// menü, açıklama) bilerek boş: uydurulmuyor.
//
// "tur" tablonun kendi notuna göre İSİMDEN TAHMİN edilmiş; "kategori" o
// tahminin GUR kategorisine eşlemesi. İkisi de kesin bilgi değil.
//
// Tüketici uygulaması, yönetici paneli, işletme sahiplenme listesi ve
// sunucu tohumu (server/db/seed.js) bu tek listeyi okuyor.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Bakırköy İLÇE merkezi. Bir mekânın konumu DEĞİL — mekânların koordinatı
 * tabloda yok. Yalnızca deste sıralamasında "bu kayıt Bakırköy'de" demek
 * için kullanılır; mesafe gösterilmez, yol tarifi ve ziyaret doğrulaması
 * bu noktayı hiç görmez.
 */
export const BAKIRKOY_ILCE = { ad: 'Bakırköy', lat: 40.9819, lng: 28.8772 };

export const BAKIRKOY = ${JSON.stringify(kayitlar, null, 1)};
`;

fs.writeFileSync(cikti, govde);

const sayim = {};
kayitlar.forEach(k => { sayim[k.kategori] = (sayim[k.kategori] || 0) + 1; });
console.log(`✓ ${kayitlar.length} kayıt → shared/bakirkoy.js`);
console.log('  kategori:', Object.entries(sayim).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`  telefon ${kayitlar.filter(k => k.telefon).length} · web ${kayitlar.filter(k => k.web).length} · instagram ${kayitlar.filter(k => k.instagram).length} · mahalle ${kayitlar.filter(k => k.mahalle).length}`);
if (atlanan.length) console.log('  atlanan:', atlanan);
