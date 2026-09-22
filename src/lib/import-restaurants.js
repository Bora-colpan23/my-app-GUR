/**
 * Excel / CSV ile toplu restoran yükleme.
 *
 * Moderasyon sayfasındaki "Restoran oluştur" tek tek çalışıyor; havuzu
 * elle doldurmak için yüzlerce kayıt girmek gerekiyordu. Burası aynı
 * kaydı bir tabloyla açıyor.
 *
 * ÜÇ KARAR:
 *
 * 1. SheetJS DİNAMİK yükleniyor (`await import('xlsx')`). Kütüphane
 *    küçültülmüş hâlde ~490 kB — yönetici panelinin tamamından üç kat
 *    büyük. Statik import olsaydı paneli açan herkes onu indirirdi;
 *    böyle yalnızca içe aktarma kutusunu açan indiriyor. Tek dosyalık
 *    artifact derlemesinde `inlineDynamicImports` zaten hepsini tek
 *    parçaya katıyor, orada davranış değişmiyor.
 *
 * 2. Doğrulama satır satır ve YÜKLEMEDEN ÖNCE. Yarısı hatalı bir dosyayı
 *    yarıya kadar işleyip bırakmak, yöneticiyi hangi satırın girdiğini
 *    elle aramaya zorlardı. Önizlemede her satırın durumu yazılı,
 *    yalnızca geçerli olanlar yazılıyor.
 *
 * 3. Başlıklar TÜRKÇE ve eşleme gevşek: büyük/küçük harf, baştaki/sondaki
 *    boşluk ve yıldız (zorunlu işareti) yok sayılıyor. Şablonu Excel'de
 *    açıp başlığa dokunan bir kullanıcı dosyayı bozmuş olmuyor.
 *
 * CSV de aynı yoldan geçiyor: SheetJS biçimi kendisi tanıyor, ayrı bir
 * ayrıştırıcı yazmak iki ayrı hata kaynağı demekti.
 */

export const TEMPLATE_COLUMNS = [
  { key: 'name',     header: 'Restoran adı', required: true,  example: 'Çiya Sofrası' },
  { key: 'cat',      header: 'Kategori',     required: true,  example: 'Anadolu' },
  { key: 'district', header: 'İlçe',         required: true,  example: 'Kadıköy' },
  { key: 'addr',     header: 'Adres',        required: false, example: 'Caferağa Mah. Güneşlibahçe Sok. 43' },
  { key: 'phone',    header: 'Telefon',      required: false, example: '+90 216 330 31 90' },
  { key: 'desc',     header: 'Kısa açıklama',required: false, example: 'Anadolu mutfağı, mevsim otları' },
];

/** Başlık eşlemesi için: küçült, boşlukları ve yıldızı at. */
const anahtarla = (s) => String(s == null ? '' : s)
  .replace(/\*/g, '')
  .trim()
  .toLocaleLowerCase('tr')
  .replace(/\s+/g, ' ');

const BASLIK_HARITASI = new Map(
  TEMPLATE_COLUMNS.map(c => [anahtarla(c.header), c.key]));

/** Şablonun ilk satırı — indirme engellenirse ekranda gösterilir. */
export function templateHeaderLine() {
  return TEMPLATE_COLUMNS.map(c => c.header + (c.required ? '*' : '')).join('\t');
}

/**
 * Şablonu .xlsx olarak indirir.
 *
 * Artifact önizlemesi kum havuzunda sayfanın kendi başlattığı indirmeler
 * engelli. Bu yüzden sonuç bir boolean: arayüz başarısızlıkta başlık
 * satırını ekranda gösterip kopyalatıyor, sessizce hiçbir şey olmaması
 * yerine.
 */
export async function downloadTemplate() {
  try {
    const X = await import('xlsx');
    const aoa = [
      TEMPLATE_COLUMNS.map(c => c.header + (c.required ? '*' : '')),
      TEMPLATE_COLUMNS.map(c => c.example),
    ];
    const sheet = X.utils.aoa_to_sheet(aoa);
    sheet['!cols'] = TEMPLATE_COLUMNS.map(c => ({ wch: Math.max(14, c.header.length + 4) }));
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, sheet, 'Restoranlar');
    const buf = X.write(wb, { type: 'array', bookType: 'xlsx' });
    const url = URL.createObjectURL(new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gur-restoran-sablonu.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dosyayı okur, satırları doğrular.
 *
 * Döndürdüğü her satır: { line, data, errors }. `errors` boşsa satır
 * yazılabilir. Hiçbir şey yazılmaz — bu saf bir okuma.
 *
 * `mevcutAdlar`: havuzda zaten olan restoran adları. Aynı adı ikinci kez
 * eklemek sessiz bir kopya üretirdi; satır hatalı sayılır ve yönetici
 * neyin çakıştığını görür.
 */
export async function parseRestaurantFile(file, mevcutAdlar = []) {
  const X = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = X.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Dosyada sayfa yok.');
  const matris = X.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: '' });
  if (!matris.length) throw new Error('Dosya boş.');

  const basliklar = matris[0].map(anahtarla);
  const sutunlar = basliklar.map(b => BASLIK_HARITASI.get(b) || null);
  if (!sutunlar.includes('name')) {
    throw new Error('“Restoran adı” sütunu bulunamadı. Şablonu indirip onun üzerine yazın.');
  }

  const varOlan = new Set(mevcutAdlar.map(n => anahtarla(n)));
  const dosyada = new Set();
  const satirlar = [];

  for (let i = 1; i < matris.length; i++) {
    const ham = matris[i];
    const data = {};
    sutunlar.forEach((k, j) => { if (k) data[k] = String(ham[j] == null ? '' : ham[j]).trim(); });
    // Tamamen boş satır: Excel'de silinen satırlar böyle geliyor, hata değil.
    if (!TEMPLATE_COLUMNS.some(c => data[c.key])) continue;

    const errors = [];
    TEMPLATE_COLUMNS.filter(c => c.required).forEach(c => {
      if (!data[c.key]) errors.push(`${c.header} boş`);
    });
    const ad = anahtarla(data.name);
    if (ad && varOlan.has(ad)) errors.push('bu ad havuzda zaten var');
    else if (ad && dosyada.has(ad)) errors.push('dosyada iki kez geçiyor');
    if (ad) dosyada.add(ad);

    satirlar.push({ line: i + 1, data, errors });
  }

  if (!satirlar.length) throw new Error('Dosyada veri satırı yok — yalnızca başlıklar var.');
  return satirlar;
}
