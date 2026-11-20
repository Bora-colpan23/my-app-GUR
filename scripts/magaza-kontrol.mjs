#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// MAĞAZA ÖN KONTROLÜ — gönderimden ÖNCE çalıştırın:  npm run magaza:kontrol
//
// Apple / Google'ın incelemede en sık reddettiği şeyleri, gönderim yapmadan
// (ve haftalarca ret beklemeden) yakalar. Bu bir GARANTİ DEĞİL: mağazalar
// kurallarını değiştirir ve insan inceleyici yoruma bağlı karar verir. Burada
// yalnızca KOD ve YAPILANDIRMA'dan doğrulanabilenler var; mağaza panellerinde
// doldurulacak formlar (gizlilik etiketi, veri güvenliği, yaş derecesi,
// ekran görüntüleri) için bkz. mobile/MAGAZA-KONTROL.md.
//
// Çıkış kodu: HATA varsa 1, yalnızca uyarı varsa 0.
// ═══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBIL = path.join(KOK, 'mobile');
const hatalar = [], uyarilar = [], tamam = [];
const hata = (m) => hatalar.push(m), uyar = (m) => uyarilar.push(m), ok = (m) => tamam.push(m);
const oku = (...p) => fs.readFileSync(path.join(...p), 'utf8');

const app = JSON.parse(oku(MOBIL, 'app.json')).expo;

// ─── 1. Yasal bilgiler ────────────────────────────────────────────────
const { legalEksikleri, LEGAL } = await import(pathToFileURL(path.join(KOK, 'shared/legal.js')).href);
const eksik = legalEksikleri();
eksik.length ? eksik.forEach(m => hata(`Yasal bilgi: ${m}`)) : ok('yasal metinlerdeki işletme bilgileri doğrulanmış');

// ─── 2. Kimlik ve izinler ─────────────────────────────────────────────
/^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/i.test(app.ios?.bundleIdentifier || '')
  ? ok(`iOS bundle ID: ${app.ios.bundleIdentifier} (gönderdikten sonra DEĞİŞTİRİLEMEZ)`)
  : hata('ios.bundleIdentifier geçersiz');
app.android?.package ? ok(`Android paketi: ${app.android.package} (yayından sonra DEĞİŞTİRİLEMEZ)`) : hata('android.package yok');
if (app.ios?.bundleIdentifier === 'app.gur.mobile' || app.android?.package === 'app.gur.mobile')
  uyar('Bundle ID hâlâ varsayılan "app.gur.mobile": sahibi olduğunuz bir alan adına göre (ör. com.<alanadınız>.gur) karar verin — yayından sonra değişmez');

app.ios?.config?.usesNonExemptEncryption === false ? ok('ihracat uyumu (şifreleme) beyanı var') : hata('ios.config.usesNonExemptEncryption tanımlı değil (her gönderimde soru çıkar)');
app.ios?.supportsTablet === false ? ok('iPad desteği kapalı (iPad ekran görüntüsü istenmez)') : uyar('supportsTablet açık: iPad ekran görüntüleri ve iPad düzeni gerekir');

const konumMetni = app.ios?.infoPlist?.NSLocationWhenInUseUsageDescription || '';
konumMetni.length >= 40 ? ok('konum izni gerekçesi açık ve uzun') : hata('NSLocationWhenInUseUsageDescription kısa/boş (Apple 5.1.1 — gerekçe somut olmalı)');
const arka = app.plugins?.find?.(p => Array.isArray(p) && p[0] === 'expo-location')?.[1] || {};
(!arka.isIosBackgroundLocationEnabled && !arka.isAndroidBackgroundLocationEnabled)
  ? ok('arka plan konumu KAPALI (Play\'in ek formu ve Apple\'ın ek gerekçesi gerekmez)')
  : hata('Arka plan konumu açık: Play Console\'da ayrı bir beyan formu + Apple\'da gerekçe ister');
if (/ACCESS_BACKGROUND_LOCATION/.test(JSON.stringify(app.android?.permissions || []))) hata('ACCESS_BACKGROUND_LOCATION tanımlı');

const gizlilik = app.ios?.privacyManifests;
if (!gizlilik) hata('ios.privacyManifests yok (Apple gizlilik manifestosu zorunlu)');
else {
  gizlilik.NSPrivacyTracking === false ? ok('gizlilik manifestosu: takip YOK') : hata('NSPrivacyTracking false olmalı (aksi hâlde ATT izni ve alan adı listesi gerekir)');
  (gizlilik.NSPrivacyCollectedDataTypes || []).length ? ok(`gizlilik manifestosu: ${gizlilik.NSPrivacyCollectedDataTypes.length} veri türü beyan edilmiş`) : uyar('NSPrivacyCollectedDataTypes boş');
}
// Konum beyan edilmediyse kod da konumu sunucuya göndermemeli.
const apiKodu = ['api.js', 'veri.js', 'senkron.js'].map(f => oku(MOBIL, 'src', f)).join('\n');
/p_lat|p_lng/.test(apiKodu)
  ? hata('Kod sunucuya konum (p_lat/p_lng) gönderiyor ama gizlilik metni/manifest "gönderilmez" diyor — ikisini hizalayın')
  : ok('kod sunucuya konum göndermiyor (gizlilik metni ve manifestoyla tutarlı)');

// ─── 3. Simgeler ──────────────────────────────────────────────────────
function png(dosya) {
  const b = fs.readFileSync(path.join(MOBIL, dosya));
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), alfa: [4, 6].includes(b[25]) };
}
try {
  const i = png(app.icon.replace(/^\.\//, ''));
  if (!i) hata('icon PNG değil');
  else {
    (i.w === 1024 && i.h === 1024) ? ok('uygulama simgesi 1024×1024') : hata(`icon ${i.w}×${i.h}: App Store 1024×1024 ister`);
    i.alfa ? hata('icon ŞEFFAFLIK (alfa) kanalı içeriyor: App Store Connect yüklemeyi reddeder — düz zeminli PNG kullanın') : ok('uygulama simgesi alfa kanalı içermiyor');
  }
} catch (e) { hata(`icon okunamadı: ${e.message}`); }

// ─── 4. Sunucu bağlantısı: inceleyici BOŞ uygulama görmemeli ──────────
const envDosyalari = [path.join(MOBIL, '.env'), path.join(MOBIL, 'eas.json')].filter(fs.existsSync).map(f => fs.readFileSync(f, 'utf8')).join('\n');
if (/EXPO_PUBLIC_SUPABASE_URL\s*[=:]\s*"?https?:\/\/\S+/.test(envDosyalari) && /EXPO_PUBLIC_SUPABASE_ANON_KEY/.test(envDosyalari))
  ok('Supabase adresi + anon anahtar tanımlı (uygulama CANLI modda açılacak)');
else hata('Supabase bağlantısı tanımsız: uygulama YEREL modda açılır ve inceleyici boş/yerel bir uygulama görür. Önce `npm run supabase:kur`.');
/service_role|SERVICE_ROLE/.test(envDosyalari) ? hata('Pakete SERVİS ANAHTARI girmiş görünüyor!') : ok('pakette servis anahtarı yok');

// ─── 5. Arayüzde "yakında" / yer tutucu ───────────────────────────────
// Apple 2.1: eksik/yer tutucu özellik gösteren uygulama reddedilir.
const ekranlar = fs.readdirSync(path.join(MOBIL, 'src/ekran')).map(f => [f, oku(MOBIL, 'src/ekran', f)]);
const yer = [];
for (const [f, kod] of ekranlar) {
  kod.split('\n').forEach((s, i) => {
    if (/^\s*(\/\/|\*|\{?\/\*)/.test(s)) return;                 // yorum satırları
    if (/['"`>][^'"`]*\b(yakında|coming soon|lorem ipsum|TODO)\b/i.test(s)) yer.push(`${f}:${i + 1}`);
  });
}
yer.length ? hata(`Arayüz metninde yer tutucu/"yakında": ${yer.join(', ')} (Apple 2.1)`) : ok('arayüzde "yakında"/yer tutucu metin yok');

// ─── 6. Hesap silme ve yasal erişim ───────────────────────────────────
const profil = oku(MOBIL, 'src/ekran/Profil.js');
/hesabiSil/.test(profil) && /Hesabımı sil/.test(profil) ? ok('uygulama içi hesap silme var (Apple 5.1.1(v), Play)') : hata('uygulama içi hesap silme yok');
/navigate\('yasal'/.test(profil) && /navigate\('yasal'/.test(oku(MOBIL, 'src/ekran/Giris.js'))
  ? ok('gizlilik/koşullara kayıt ekranından ve profilden ulaşılıyor') : hata('yasal metinlere kayıt ekranından veya profilden ulaşılamıyor');
/Sunucuya ulaşılamıyor|silinemedi/.test(profil) ? ok('silme sunucuda başarısızsa yerel veri korunuyor (yarım silme yok)') : uyar('silme hata yolu bulunamadı');

// ─── 7. Kullanıcı içeriği (UGC) ───────────────────────────────────────
// Yorum YAZMA mobilde yok → Apple 1.2 şu an tetiklenmiyor. Eklendiği anda
// "bildir + engelle + filtre + iletişim" olmadan reddedilir.
const yorumYaziyor = ekranlar.some(([, k]) => /gur_submit_review|yorumGonder|yorumYaz/.test(k)) || /gur_submit_review/.test(apiKodu);
yorumYaziyor
  ? (/bildir|engelle|report|block/i.test(ekranlar.map(([, k]) => k).join('\n'))
      ? ok('kullanıcı içeriği var ve bildir/engelle yolu görünüyor')
      : hata('Kullanıcı yorumu yazılabiliyor ama içeriği BİLDİRME/ENGELLEME yolu yok (Apple 1.2, Play UGC politikası)'))
  : ok('mobilde kullanıcı içeriği (yorum yazma) yok — Apple 1.2 şu an geçerli değil (eklenince bildir/engelle ŞART)');

// ─── Rapor ────────────────────────────────────────────────────────────
const yaz = (b, l) => l.forEach(m => console.log(`${b} ${m}`));
console.log(`\nGUR mağaza ön kontrolü — iletişim: ${LEGAL.destek}\n`);
yaz('✓', tamam); yaz('⚠', uyarilar); yaz('✗', hatalar);
console.log(`\n${tamam.length} geçti · ${uyarilar.length} uyarı · ${hatalar.length} HATA`);
if (hatalar.length) console.log('Gönderimden önce HATA satırları giderilmeli. Kalan formlar için: mobile/MAGAZA-KONTROL.md');
process.exit(hatalar.length ? 1 : 0);
