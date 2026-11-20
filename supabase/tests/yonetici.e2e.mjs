// ═══════════════════════════════════════════════════════════════════════
// YÖNETİCİ PANELİ ↔ SUPABASE UÇTAN UCA TEST
//
//   GUR_TEST_PG="postgres://postgres:…@127.0.0.1:5432" npm run supabase:yonetici-test
//
// Web uygulamasını VITE_SUPABASE_URL ile DERLER (gerçek supabase-js), tarayıcıda
// /admin'i açar ve karşısında supabase-taklit.mjs vardır: RLS ve execute izinleri
// GERÇEK bir PostgreSQL üstünde. Yönetici e-posta+parola ile girer, sonra
// Gastro / görünürlük / moderasyon / ilçe / kampanya / sahiplenme kararlarını
// verir ve SONUCU VERİTABANINDAN doğrular. Yönetici olmayan hesap kapıdan döner.
//
// GERÇEK SUPABASE İLE FARKI ÖLÇÜLMEDİ (bkz. supabase-taklit.mjs başlığı).
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
const DB = 'gur_yonetici_e2e';
const ANON = 'anon-e2e-key';
const EKRAN = process.env.GUR_E2E_EKRAN;

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

const taklit = await taklitBaslat({ pgUrl: PGURL, anon: ANON, otomatikOnay: true });
const kayitOl = async (email, parola) => {
  const r = await fetch(`${taklit.url}/auth/v1/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email, password: parola, data: {} }) });
  assert.ok(r.ok, `kayıt başarısız: ${r.status}`);
  await r.json();
};
const ADMIN = { email: 'yonetici@example.com', parola: 'yonetici-parola-1' };
const KULLANICI = { email: 'kullanici@example.com', parola: 'kullanici-parola-1' };
await kayitOl(ADMIN.email, ADMIN.parola);
await kayitOl(KULLANICI.email, KULLANICI.parola);
const [{ id: adminId }] = await sorgu(`select id from auth.users where email = $1`, [ADMIN.email]);
const [{ id: kullaniciId }] = await sorgu(`select id from auth.users where email = $1`, [KULLANICI.email]);
await sorgu(`insert into public.platform_admins (user_id) values ($1)`, [adminId]);

// Sahnelenen veri
const [r1, r2, r3, r4, r5] = (await sorgu(`select id, name from public.restaurants order by name limit 5`));
const [{ id: org }] = await sorgu(`insert into public.organizations (legal_name) values ('E2E Sahiplenen Ltd.') returning id`);
await sorgu(`insert into public.restaurant_claims (restaurant_id, org_id, requested_by, evidence)
             values ($1, $2, $3, '{"contactName":"Test Kişi"}')`, [r3.id, org, kullaniciId]);
await sorgu(`insert into public.campaigns (org_id, restaurant_id, label, status, pricing, bid_minor, daily_budget_minor)
             values ($1, $2, 'E2E Kampanya', 'active', 'cpe', 700, 100000)`, [org, r4.id]);
await sorgu(`update public.restaurants set review_status = 'pending' where id = $1`, [r5.id]);   // moderasyon bekliyor

// ─── Web derlemesi (Supabase'li) + statik sunucu ──────────────────────
const CIKTI = fs.mkdtempSync(path.join(os.tmpdir(), 'gur-web-'));
console.log('› web uygulaması derleniyor (vite build, Supabase tanımlı)…');
await new Promise((coz, red) => {
  const c = spawn('npx', ['vite', 'build', '--outDir', CIKTI, '--emptyOutDir'], {
    cwd: KOK,
    env: { ...process.env, VITE_SUPABASE_URL: taklit.url, VITE_SUPABASE_ANON_KEY: ANON },
  });
  let son = '';
  c.stdout.on('data', d => { son = (son + d).slice(-800); });
  c.stderr.on('data', d => { son = (son + d).slice(-800); });
  c.on('close', k => (k === 0 ? coz() : red(new Error('vite build başarısız:\n' + son))));
});
const TIPLER = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const statik = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x').pathname;
  if (u.startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"yok"}'); }
  let yol = path.join(CIKTI, decodeURIComponent(u));
  if (!fs.existsSync(yol) || fs.statSync(yol).isDirectory()) yol = path.join(CIKTI, 'index.html');
  res.writeHead(200, { 'Content-Type': TIPLER[path.extname(yol)] || 'application/octet-stream' });
  fs.createReadStream(yol).pipe(res);
});
await new Promise(r => statik.listen(0, '127.0.0.1', r));
const WEB = `http://127.0.0.1:${statik.address().port}`;

// ─── Senaryo ──────────────────────────────────────────────────────────
let gecen = 0;
const ok = (m) => { gecen++; console.log(`ok - ${m}`); };
const bekle = (ms) => new Promise(r => setTimeout(r, ms));
async function kadar(fn, ad, ms = 8000) {              // bir koşul gerçekleşene kadar bekle
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`zaman aşımı: ${ad}`);
    await bekle(150);
  }
}
const tarayici = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }).catch(() => pw.chromium.launch());
const sayfaHatalari = [];

try {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  const sayfa = await ctx.newPage();
  sayfa.on('pageerror', e => sayfaHatalari.push(e.message));
  await sayfa.route(/picsum|fonts\.g/, r => r.abort());
  const ekran = async (ad) => { if (EKRAN) await sayfa.screenshot({ path: path.join(EKRAN, `${ad}.png`) }); };
  const sol = (ad) => sayfa.getByRole('button', { name: ad }).first();
  const git = async (menu) => { await sol(menu).click(); await bekle(300); };
  // Mekan Havuzu'nda adı ara, TAM eşleşen satırın "Detay" düğmesine bas.
  const ac = async (ad) => {
    await git('Mekan Havuzu');
    await sayfa.locator('input[aria-label]').first().fill(ad);
    const satir = sayfa.getByText(ad, { exact: true }).first()
      .locator('xpath=ancestor::div[.//button[normalize-space()="Detay"]][1]');
    await satir.getByRole('button', { name: 'Detay' }).click();
  };

  // ── 1. Kapı: yönetici olmayan hesap girişi YAPAMAZ, yönetici yapar ──
  await sayfa.goto(`${WEB}/admin`);
  await sayfa.getByLabel('E-posta').fill(KULLANICI.email);
  await sayfa.getByLabel('Parola').fill(KULLANICI.parola);
  await sayfa.getByRole('button', { name: /Giriş yap/ }).click();
  await sayfa.getByText('Bu hesap yönetici değil.').waitFor({ timeout: 8000 });
  ok('yönetici OLMAYAN hesap (geçerli parolayla bile) panele giremedi');

  await sayfa.getByLabel('E-posta').fill(ADMIN.email);
  await sayfa.getByLabel('Parola').fill('yanlis-parola');
  await sayfa.getByRole('button', { name: /Giriş yap/ }).click();
  await sayfa.getByText('E-posta ya da parola hatalı.').waitFor({ timeout: 8000 });
  ok('yanlış parola reddedildi, sebep yazıldı');

  await sayfa.getByLabel('Parola').fill(ADMIN.parola);
  await sayfa.getByLabel('E-posta').fill(ADMIN.email);
  await sayfa.getByRole('button', { name: /Giriş yap/ }).click();
  await sol('Mekan Havuzu').waitFor({ timeout: 15000 });
  ok('yönetici e-posta + parolayla girdi (Supabase Auth + is_admin kapısı)');
  assert.ok(taklit.kayit.rpc.includes('gur_admin_me'));

  // ── 2. Sunucu durumu panele yansır: moderasyonda bekleyen mekân ──
  await kadar(async () => taklit.kayit.rpc.includes('gur_admin_restaurants'), 'hydrate');
  await git('Moderasyon');
  await sayfa.getByText(r5.name, { exact: false }).first().waitFor({ timeout: 8000 });
  ok('sunucuda "pending" olan mekân panelin moderasyon kuyruğunda göründü (hydrate)');
  await ekran('moderasyon');

  // ── 3. Moderasyon kararı sunucuya yazılır ──
  const satir = sayfa.locator('div', { hasText: r5.name }).filter({ has: sayfa.getByRole('button', { name: 'Yayınla' }) }).last();
  await satir.getByRole('button', { name: 'Yayınla' }).click();
  await kadar(async () => (await sorgu(`select review_status from public.restaurants where id = $1`, [r5.id]))[0].review_status === 'approved',
    'review_status=approved');
  ok('"Yayınla" kararı veritabanına yazıldı: review_status = approved');

  // ── 4. Gastro + görünürlük (mekân detayı) ──
  await ac(r1.name);
  await sayfa.getByRole('button', { name: 'Rozet Ver' }).click();
  await kadar(async () => (await sorgu(`select gastro_approved from public.restaurants where id = $1`, [r1.id]))[0].gastro_approved === true,
    'gastro_approved');
  ok('"Rozet Ver" → gastro_approved = true (veritabanında)');

  // Görünürlük anahtarı: "Uygulamada görünürlük" bölümündeki Toggle
  const bolum = sayfa.locator('section', { hasText: 'Uygulamada görünürlük' }).first();
  await bolum.getByRole('switch').click();
  await kadar(async () => (await sorgu(`select is_active from public.restaurants where id = $1`, [r1.id]))[0].is_active === false,
    'is_active=false');
  ok('görünürlük anahtarı kapatıldı → is_active = false (tüketici listesinden düştü)');
  await bolum.getByText('GİZLİ').waitFor({ timeout: 4000 });

  // Tüketici tarafı gerçekten göremiyor mu? (anon, taklit üstünden)
  const anonListe = await (await fetch(`${taklit.url}/rest/v1/rpc/gur_restaurants`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ p_limit: 500 }) })).json();
  assert.ok(!anonListe.some(x => x.id === r1.id), 'gizlenen mekân tüketici listesinde');
  assert.ok(!anonListe.some(x => x.id === r5.id) === false, 'yayınlanan mekân listede olmalı');
  ok('anon (tüketici) gur_restaurants: gizlenen mekân YOK, yeni yayınlanan VAR');

  // ── 5. Sayfa yenilenince oturum + sunucu durumu geri gelir ──
  await sayfa.reload();
  await sol('Mekan Havuzu').waitFor({ timeout: 15000 });
  ok('sayfa yenilendi: kayıtlı Supabase oturumu yöneticiyi içeride tuttu (yeniden giriş yok)');
  await ac(r1.name);
  const bolum2 = sayfa.locator('section', { hasText: 'Uygulamada görünürlük' }).first();
  await bolum2.getByText('GİZLİ').waitFor({ timeout: 8000 });
  await sayfa.getByText('Gastro Onaylı', { exact: true }).first().waitFor({ timeout: 4000 });
  ok('yenilemeden sonra da mekân GİZLİ ve Gastro Onaylı görünüyor (durum sunucudan geldi, yerelden değil)');

  // ── 6. İlçe aç/kapat ──
  await git('Ayarlar');
  await sayfa.getByRole('switch', { name: 'Bakırköy' }).click();
  await kadar(async () => (await sorgu(`select value from public.platform_settings where key = 'districts_open'`))[0]?.value?.['Bakırköy'] === false,
    'districts_open');
  ok('Ayarlar → Bölgeler: Bakırköy kapatıldı → platform_settings.districts_open');
  const anonKapali = await (await fetch(`${taklit.url}/rest/v1/rpc/gur_restaurants`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ p_limit: 500 }) })).json();
  assert.equal(anonKapali.filter(x => x.district === 'Bakırköy').length, 0);
  ok('kapalı ilçenin mekânları tüketiciye gitmiyor');
  await sayfa.getByRole('switch', { name: 'Bakırköy' }).click();
  await kadar(async () => (await sorgu(`select value from public.platform_settings where key = 'districts_open'`))[0]?.value?.['Bakırköy'] === undefined,
    'varsayılana dönüş');
  ok('ilçe varsayılana döndürülünce sunucudaki karar silindi');

  // ── 7. Sahiplenme başvurusu ──
  await git('Başvurular');
  await sayfa.getByText('E2E Sahiplenen Ltd.', { exact: false }).first().waitFor({ timeout: 8000 });
  ok('Supabase\'teki bekleyen sahiplenme başvurusu panelde göründü');
  await sayfa.getByRole('button', { name: 'Onayla' }).first().click();
  await kadar(async () => (await sorgu(`select claimed_by_org from public.restaurants where id = $1`, [r3.id]))[0].claimed_by_org === org,
    'claimed_by_org');
  ok('başvuru onaylandı → mekânın sahipliği bağlandı (claimed_by_org)');
  const [{ reviewer_id }] = await sorgu(`select reviewer_id from public.restaurant_claims where restaurant_id = $1`, [r3.id]);
  assert.equal(reviewer_id, adminId);
  ok('karar veren yönetici kayda yazıldı');

  // ── 8. Kampanya ──
  await git('Kampanyalar');
  await sayfa.getByText('E2E Kampanya', { exact: false }).first().waitFor({ timeout: 8000 });
  ok('kampanya listesi Supabase\'ten geldi');
  const kart = sayfa.getByText('E2E Kampanya', { exact: false }).first()
    .locator('xpath=ancestor::*[.//button[normalize-space()="Duraklat"]][1]');
  await kart.getByRole('button', { name: 'Duraklat' }).click();
  await kadar(async () => (await sorgu(`select status from public.campaigns where label = 'E2E Kampanya'`))[0].status === 'paused',
    'campaign paused');
  ok('kampanya duraklatıldı → campaigns.status = paused');

  // ── 9. Büyüme sayfası ──
  await git('Büyüme & Kohort');
  await kadar(async () => taklit.kayit.rpc.includes('gur_admin_growth'), 'growth çağrısı');
  await bekle(500);
  ok('büyüme sayfası gur_admin_growth ile yüklendi');

  // ── 10. Denetim kaydı ──
  const denetim = await sorgu(`select action from public.admin_audit order by id`);
  const eylemler = new Set(denetim.map(d => d.action));
  for (const e of ['restaurant.update', 'claim.approved', 'district.set', 'campaign.update'])
    assert.ok(eylemler.has(e), `denetim kaydı yok: ${e}`);
  ok(`her karar denetim kaydına düştü (${denetim.length} satır: ${[...eylemler].join(', ')})`);

  // ── 11. Çıkış ──
  await sayfa.getByTitle('Çıkış yap').click();
  await sayfa.getByLabel('E-posta').waitFor({ timeout: 8000 });
  await sayfa.reload();
  await sayfa.getByLabel('E-posta').waitFor({ timeout: 8000 });
  ok('çıkış yapılınca yenilemede de giriş ekranı (oturum kapandı)');

  assert.deepEqual(sayfaHatalari, [], 'tarayıcıda yakalanmamış hata: ' + sayfaHatalari.join(' | '));
  ok('tarayıcıda yakalanmamış JS hatası yok');
  console.log(`\n✓ Yönetici paneli ↔ Supabase: ${gecen} doğrulama geçti`);
} catch (e) {
  console.error('\n✗ BAŞARISIZ:', e.message);
  if (sayfaHatalari.length) console.error('sayfa hataları:', sayfaHatalari);
  process.exitCode = 1;
} finally {
  await tarayici.close();
  statik.close();
  await taklit.kapat();
  fs.rmSync(CIKTI, { recursive: true, force: true });
}
