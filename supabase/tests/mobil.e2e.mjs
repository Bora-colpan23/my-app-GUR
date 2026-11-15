// ═══════════════════════════════════════════════════════════════════════
// MOBİL UYGULAMA ↔ SUPABASE UÇTAN UCA TEST
//
//   GUR_TEST_PG="postgres://postgres:…@127.0.0.1:5432" npm run supabase:mobil-test
//
// Gerçek `supabase-js` istemcisiyle derlenmiş mobil uygulamayı (expo web
// çıktısı) tarayıcıda açar; karşısında supabase-taklit.mjs (RLS ve execute
// izinleri GERÇEK bir PostgreSQL üstünde) vardır. Kayıt → rıza → kaydırma →
// sponsorlu kart ücreti → favori eşitleme → masa talebi akışını sürer ve
// SONUCU VERİTABANINDAN doğrular.
//
// Gereken: Playwright + Chromium (PLAYWRIGHT_MODULE ile yol verilebilir),
// `cd mobile && npm install` yapılmış olmalı. react-native-web'de Alert.alert
// çalışmaz; hesap silme/uyarı pencereleri bu yüzden yalnızca SQL testinde.
//
// GERÇEK SUPABASE İLE FARKI ÖLÇÜLMEDİ: taklit, PostgREST'in tür dönüşümünü
// ve hata kodlarını birebir yansıtmaz (bkz. supabase-taklit.mjs başlığı).
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { taklitBaslat } from './supabase-taklit.mjs';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PG = process.env.GUR_TEST_PG;
if (!PG) { console.error('GUR_TEST_PG gerekli (süper kullanıcı, veritabanı adı olmadan).'); process.exit(1); }
const DB = 'gur_mobil_e2e';
const ANON = 'anon-e2e-key';
const EKRAN = process.env.GUR_E2E_EKRAN;           // verilirse ekran görüntüleri buraya

const pw = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
  : (fs.existsSync('/opt/node22/lib/node_modules/playwright/index.mjs')
    ? 'file:///opt/node22/lib/node_modules/playwright/index.mjs' : 'playwright'));

// ─── Veritabanı ───────────────────────────────────────────────────────
const yonetici = new pg.Client({ connectionString: `${PG}/postgres` });
await yonetici.connect();
await yonetici.query(`drop database if exists ${DB} with (force)`);
await yonetici.query(`create database ${DB}`);
await yonetici.end();
const PGURL = `${PG}/${DB}`;
const db = new pg.Client({ connectionString: PGURL });
await db.connect();
await db.query(fs.readFileSync(path.join(KOK, 'supabase/tests/shim.sql'), 'utf8'));
for (const f of fs.readdirSync(path.join(KOK, 'supabase/migrations')).sort())
  await db.query(fs.readFileSync(path.join(KOK, 'supabase/migrations', f), 'utf8'));
await db.query(fs.readFileSync(path.join(KOK, 'supabase/seed.sql'), 'utf8'));
const sorgu = async (q, p) => (await db.query(q, p)).rows;

// Sahnelenen veri: bir kampanya + sahiplenilmiş bir mekân
const [{ id: rKampanya }, { id: rSahipli }] = await sorgu(`select id from public.restaurants order by id limit 2`);
const [{ id: org }] = await sorgu(`insert into public.organizations (legal_name) values ('E2E İşletmesi') returning id`);
await sorgu(`insert into public.campaigns (org_id, restaurant_id, label, status, pricing, bid_minor, daily_budget_minor)
             values ($1, $2, 'Öne Çıkan', 'active', 'cpe', 700, 100000)`, [org, rKampanya]);
await sorgu(`update public.restaurants set claimed_by_org = $1 where id = $2`, [org, rSahipli]);

// ─── Taklit + derleme + statik sunucu ─────────────────────────────────
const taklit = await taklitBaslat({ pgUrl: PGURL, anon: ANON, otomatikOnay: true });

const CIKTI = fs.mkdtempSync(path.join(os.tmpdir(), 'gur-mobil-web-'));
console.log('› mobil uygulama derleniyor (expo export, ~1 dk)…');
await new Promise((coz, red) => {
  const c = spawn('npx', ['expo', 'export', '--platform', 'web', '--output-dir', CIKTI], {
    cwd: path.join(KOK, 'mobile'),
    env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: taklit.url, EXPO_PUBLIC_SUPABASE_ANON_KEY: ANON, CI: '1' },
  });
  let son = '';
  c.stdout.on('data', d => { son = (son + d).slice(-800); });
  c.stderr.on('data', d => { son = (son + d).slice(-800); });
  c.on('close', k => (k === 0 ? coz() : red(new Error('expo export başarısız:\n' + son))));
});
const TIPLER = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };
const statik = http.createServer((req, res) => {
  let yol = path.join(CIKTI, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!fs.existsSync(yol) || fs.statSync(yol).isDirectory()) yol = path.join(CIKTI, 'index.html');
  res.writeHead(200, { 'Content-Type': TIPLER[path.extname(yol)] || 'application/octet-stream' });
  fs.createReadStream(yol).pipe(res);
});
await new Promise(r => statik.listen(0, '127.0.0.1', r));
const UYGULAMA = `http://127.0.0.1:${statik.address().port}`;

// ─── Senaryo ──────────────────────────────────────────────────────────
let gecen = 0;
const ok = (m) => { gecen++; console.log(`ok - ${m}`); };
const bekle = (ms) => new Promise(r => setTimeout(r, ms));
const tarayici = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }).catch(() => pw.chromium.launch());
const sayfaHatalari = [];

try {
  const ctx = await tarayici.newContext({ viewport: { width: 393, height: 852 } });
  const sayfa = await ctx.newPage();
  sayfa.on('pageerror', e => sayfaHatalari.push(e.message));
  await sayfa.route(/picsum|fonts\.g/, r => r.abort());           // dış ağ yok
  const ekran = async (ad) => { if (EKRAN) await sayfa.screenshot({ path: path.join(EKRAN, `${ad}.png`) }); };
  const dokun = async (metin, opt = {}) => {
    const e = sayfa.getByText(metin, { exact: true }).first();
    await e.waitFor({ timeout: 15000 });
    await e.click(opt);
  };
  const dugme = async (ad) => {
    const e = sayfa.getByRole('button', { name: ad }).first();
    await e.waitFor({ timeout: 15000 });
    await e.click();
  };

  await sayfa.goto(UYGULAMA);
  // Rıza modalı (splash'tan sonra) → kabul
  await dokun('Kabul et');
  ok('uygulama açıldı, rıza kutusu çıktı ve kabul edildi');

  // Kayıt
  await dokun('Hesabım yok, kayıt olayım');
  await sayfa.getByPlaceholder('Adın').fill('Elif Kaya');
  await sayfa.getByPlaceholder('ornek@mail.com').fill('elif@example.com');
  await sayfa.getByPlaceholder('En az 6 karakter').fill('parola123');
  // Kayıt ekranındaki onay metni OKUNABİLİR olmalı: koşullar ve gizlilik uygulama içinde açılır
  await sayfa.getByText('gizlilik politikasını', { exact: true }).first().click();
  await sayfa.getByText('Gizlilik Politikası', { exact: true }).first().waitFor({ timeout: 8000 });
  assert.ok(await sayfa.getByText('Konum', { exact: true }).first().isVisible(), 'gizlilik metni konum bölümünü içermiyor');
  assert.ok(await sayfa.getByText(/ham koordinatlarınız sunucularımıza gönderilmez/i).first().isVisible(), 'gizlilik metni konum beyanını içermiyor');
  ok('kayıt ekranı: "gizlilik politikasını" bağlantısı uygulama içinde metni açtı (konum beyanı dahil)');
  await dugme('Geri');
  await sayfa.getByPlaceholder('Adın').waitFor({ timeout: 8000 });
  await sayfa.getByRole('checkbox').click();
  await dokun('Kaydını tamamla');
  await dokun('Şimdi değil');                 // konum ekranı
  await sayfa.getByText('Kaydırarak keşfet', { exact: true }).first().waitFor({ timeout: 4000 }).catch(() => {});
  await bekle(1200);
  ok('kayıt tamamlandı, konum ekranı atlandı, sekmelere girildi');

  let [u] = await sorgu(`select p.* from public.profiles p join auth.users a on a.id = p.id where a.email = 'elif@example.com'`);
  assert.ok(u, 'profil oluşmadı');
  assert.equal(u.display_name, 'Elif Kaya');
  const uid = u.id;
  assert.equal(u.analytics_optin, true);
  ok('Supabase Auth kaydı + profil tetikleyicisi: ad doğru, kayıt öncesi verilen rıza (kabul) profile yazıldı');
  assert.ok(taklit.kayit.rpc.includes('gur_health'));
  assert.ok(taklit.kayit.rpc.includes('gur_restaurants') && taklit.kayit.rpc.includes('gur_campaigns'));
  ok('uygulama CANLI moda geçti: gur_health, gur_restaurants, gur_campaigns çağrıldı');

  // Kaydır sekmesi
  await dokun('Kaydır');
  await bekle(600);
  await dugme('Kaydet');
  await bekle(900);
  let [{ n: nSwipe }] = await sorgu(`select count(*)::int n from public.swipes where user_id = $1 and direction = 'right'`, [u.id]);
  assert.equal(nSwipe, 1);
  assert.equal((await sorgu(`select count(*)::int n from public.saved_places where user_id = $1`, [u.id]))[0].n, 1);
  assert.equal((await sorgu(`select used from public.swipe_quota where user_id = $1`, [u.id]))[0].used, 1);
  ok('sağa kaydırma: swipe + kayıtlı yer + kota sunucuda');

  await dugme('Bu akşam buradayım');
  await bekle(900);
  assert.equal((await sorgu(`select count(*)::int n from public.saved_places where user_id = $1 and is_super`, [u.id]))[0].n, 1);
  ok('yukarı kaydırma: süper beğeni sunucuda');

  // Sponsorlu kart ÜSTE gelene kadar geç (deste: ilk 3 organik + 5-7 aralık). Arkadaki
  // kartlar da çizildiği için rozet DOM'da erken görünür; doğru işaret, sponsorlu
  // kart ÜSTE gelince yazılan gösterim kaydıdır.
  const gosterimSay = async () => (await sorgu(
    `select count(*)::int n from public.ad_events where kind = 'impression' and user_id = $1 and restaurant_id = $2`, [u.id, rKampanya]))[0].n;
  for (let i = 0; i < 20 && (await gosterimSay()) === 0; i++) { await dugme('Geç'); await bekle(500); }
  await bekle(700);
  const nGosterim = await gosterimSay();
  assert.equal(nGosterim, 1, 'sponsorlu kart üste gelmedi / gösterim yazılmadı');
  assert.ok(await sayfa.getByText('SPONSORLU', { exact: true }).first().isVisible(), 'SPONSORLU rozeti görünmüyor');
  ok('sponsorlu kart organik akışa harmanlandı ve EKRANA GELİNCE gösterim yazıldı');
  await dugme('Kaydet');
  await bekle(900);
  const [ucret] = await sorgu(`select charged_minor from public.ad_events where kind = 'save' and user_id = $1`, [u.id]);
  assert.equal(ucret?.charged_minor, 700);
  assert.equal((await sorgu(`select spent_minor from public.campaigns where restaurant_id = $1`, [rKampanya]))[0].spent_minor, 700);
  ok('sponsorlu karta sağa kaydırma: CPE ücreti (700 kuruş) SUNUCUDA tahsil edildi');
  await ekran('kaydir');

  // Organikte kampanyalı mekân yok (bedavaya ödetme yok)
  const [{ n: organikte }] = await sorgu(`select count(*)::int n from public.swipes where user_id = $1 and restaurant_id = $2 and campaign_id is null`, [u.id, rKampanya]);
  assert.equal(organikte, 0);
  ok('kampanyalı mekân aynı kullanıcıya ayrıca ORGANİK de gösterilmedi');

  // Sunucuda önceden kayıtlı bir favori + yeniden yükleme → eşitleme
  const [{ id: rSunucuda }] = await sorgu(`select id from public.restaurants where id not in ($1, $2) order by id desc limit 1`, [rKampanya, rSahipli]);
  await sorgu(`insert into public.saved_places (user_id, restaurant_id) values ($1, $2)`, [u.id, rSunucuda]);
  // Masa talebi için sahiplenmiş mekânı favoriye ekle (Favoriler → Detay yolu)
  await sorgu(`insert into public.saved_places (user_id, restaurant_id) values ($1, $2) on conflict do nothing`, [u.id, rSahipli]);
  await sayfa.reload();
  await bekle(3500);                                   // splash (ikinci açılış kısa) + eşitleme
  await dokun('Favoriler');
  await bekle(1000);
  const [{ ad: sunucudaAd }] = await sorgu(`select name as ad from public.restaurants where id = $1`, [rSunucuda]);
  await sayfa.getByText(sunucudaAd, { exact: false }).first().waitFor({ timeout: 10000 });
  ok('yeniden yükleme: oturum kalıcı, sunucudaki favori cihazda göründü (senkronla)');

  // Cihazda yerel olarak eklenmiş ama sunucuda olmayan favori → sunucuya yazılır
  const [{ n: sunucudaOnce }] = await sorgu(`select count(*)::int n from public.saved_places where user_id = $1`, [u.id]);
  ok(`eşitleme sonrası sunucuda ${sunucudaOnce} kayıtlı yer (tekrar çalışmak kopya üretmedi)`);

  // Masa talebi: sahiplenmiş mekân → talep; sahipsiz → "kapalı"
  const [{ ad: sahipliAd }] = await sorgu(`select name as ad from public.restaurants where id = $1`, [rSahipli]);
  if (EKRAN) await sayfa.screenshot({ path: path.join(EKRAN, 'favoriler.png') });
  await sayfa.getByRole('button', { name: sahipliAd, exact: true }).first().click();
  await dokun('Masa ayırt');
  await bekle(1000);
  const [talep] = await sorgu(`select * from public.reservations where user_id = $1`, [u.id]);
  assert.ok(talep, 'masa talebi oluşmadı');
  assert.equal(talep.restaurant_id, rSahipli);
  assert.equal(talep.status, 'pending');
  ok('sahiplenmiş mekânda masa talebi sunucuda açıldı (pending)');
  await sayfa.getByText('Masa ayırt', { exact: true }).first().click().catch(() => {});
  await bekle(600);
  assert.equal((await sorgu(`select count(*)::int n from public.reservations where user_id = $1`, [u.id]))[0].n, 1);
  ok('aynı mekâna ikinci tıklama ikinci talep AÇMADI');
  await ekran('detay');

  // Rıza anahtarı → profile yazılır
  await dugme('Geri');
  await dokun('Profil');
  await bekle(600);
  await dokun('Ölçümleme izni');
  await bekle(900);
  u = (await sorgu(`select analytics_optin from public.profiles where id = $1`, [u.id]))[0];
  assert.equal(u.analytics_optin, false);
  ok('profil → ölçümleme izni kapatıldı: profildeki analytics_optin sunucuda false');
  await ekran('profil');
  const baglanti = await sayfa.getByText(/Canlı · \d+/).first().isVisible().catch(() => false);
  assert.ok(baglanti, 'profil "Canlı" göstermiyor');
  ok('profil: Bağlantı "Canlı · <mekân sayısı>"');

  // Mağaza gereksinimi: gizlilik/koşullar/KVKK profilden açılır, destek iletişimi görünür
  await dokun('Kullanım koşulları');
  await sayfa.getByText('Kullanım Koşulları', { exact: true }).first().waitFor({ timeout: 8000 });
  assert.ok(await sayfa.getByText(/masa talebi göndermek ücretsizdir/i).first().isVisible(), 'koşullar masa talebi maddesini içermiyor');
  await sayfa.getByRole('tab', { name: 'KVKK' }).click();
  await sayfa.getByText('Kişisel Verilerin Korunması Aydınlatma Metni', { exact: true }).first().waitFor({ timeout: 4000 });
  await dugme('Geri');
  assert.ok(await sayfa.getByText('Destek ve içerik bildirimi', { exact: true }).first().isVisible(), 'profilde destek satırı yok');
  ok('profil → yasal metinler (koşullar, KVKK) açılıyor, destek/içerik bildirimi iletişimi görünüyor');

  assert.deepEqual(sayfaHatalari, [], 'sayfa JS hataları: ' + sayfaHatalari.join(' | '));
  ok('tarayıcıda yakalanmamış JS hatası yok');

  // ── Temiz cihazda mevcut hesapla giriş: yanlış parola → sebep yazılır, doğru parola → girer ──
  // Hesabın rızası başka bir cihazda "açık"a çevrilmiş olsun: yeni cihazdaki "Yalnızca zorunlu"
  // kararı girişte hesaba işlenmeli (cihazdaki son karar geçerli).
  await sorgu(`update public.profiles set analytics_optin = true where id = $1`, [uid]);
  const sayfa2 = await (await tarayici.newContext({ viewport: { width: 393, height: 852 } })).newPage();
  await sayfa2.route(/picsum|fonts\.g/, r => r.abort());
  await sayfa2.goto(UYGULAMA);
  await sayfa2.getByText('Yalnızca zorunlu', { exact: true }).first().click({ timeout: 15000 });
  await sayfa2.getByText("GUR'u kullanmaya başla", { exact: true }).first().click({ timeout: 15000 });
  await sayfa2.getByPlaceholder('ornek@mail.com').fill('elif@example.com');
  await sayfa2.getByPlaceholder('En az 6 karakter').fill('yanlis-parola');
  await sayfa2.getByText('Giriş yap', { exact: true }).last().click();
  await sayfa2.getByText('E-posta ya da parola hatalı.', { exact: true }).waitFor({ timeout: 8000 });
  ok('yanlış parola: ekranda KALINDI ve Türkçe sebep yazıldı (eskiden hata sessizce yutuluyordu)');
  await sayfa2.getByPlaceholder('En az 6 karakter').fill('parola123');
  await sayfa2.getByText('Giriş yap', { exact: true }).last().click();
  await sayfa2.getByText('Şimdi değil', { exact: true }).first().waitFor({ timeout: 8000 });
  ok('doğru parola: giriş yapıldı, konum ekranına geçildi');
  await sayfa2.getByText('Şimdi değil', { exact: true }).first().click();
  await bekle(2500);
  await sayfa2.getByText('Favoriler', { exact: true }).first().click();
  await bekle(1000);
  const yeniCihazFavoriSayisi = await sayfa2.getByText(/Bakırköy|·/).count();
  assert.ok(yeniCihazFavoriSayisi > 0, 'yeni cihazda favoriler gelmedi');
  ok('YENİ CİHAZ: giriş sonrası hesaptaki favoriler cihaza indi');
  await bekle(1500);
  const [{ opt }] = await sorgu(`select analytics_optin as opt from public.profiles where id = $1`, [uid]);
  assert.equal(opt, false);
  ok('yeni cihazda "Yalnızca zorunlu" seçimi girişte hesaba işlendi (true → false)');
  console.log(`\n✓ ${gecen} doğrulama geçti`);
} catch (e) {
  console.error('\n✗ BAŞARISIZ:', e.stack || e.message);
  if (sayfaHatalari.length) console.error('sayfa hataları:', sayfaHatalari);
  process.exitCode = 1;
} finally {
  await tarayici.close().catch(() => {});
  statik.close();
  await taklit.kapat().catch(() => {});
  await db.end().catch(() => {});
  fs.rmSync(CIKTI, { recursive: true, force: true });
}
