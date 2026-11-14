// ═══════════════════════════════════════════════════════════════════════
// supabase-kur.mjs UÇTAN UCA TESTİ — Yönetim API'sini taklit eden sunucuyla.
//
//   GUR_TEST_PG="postgres://postgres:…@127.0.0.1:5432" npm run supabase:kur-test
//
// GERÇEK Supabase'e dokunmaz. Taklit sunucu (aşağıda) şu uçları sunar ve
// SQL'i yerel, temiz bir PostgreSQL'de çalıştırır:
//   POST  /v1/projects/:ref/database/query     (SQL çalıştır)
//   GET   /v1/projects/:ref/api-keys            (anon + servis anahtarı)
//   PATCH /v1/projects/:ref/config/auth         (Auth ayarı, gövdeyi kaydeder)
//   POST  /v1/projects , GET /v1/projects/:ref  (proje açma + hazır olma)
//   POST  /auth/v1/admin/users                  (yönetici hesabı)
//   POST  /rest/v1/rpc/gur_health               (uçtan uca REST ping)
//
// SINIRI: taklidin uç yolları ve alan adları Supabase belgesinden yazıldı;
// taklit ile gerçek API arasındaki fark bu testle ÖLÇÜLEMEZ. Yalnızca
// betiğin KENDİ mantığı (sıra, idempotanlık, atomiklik, kuru çalıştırma,
// sızıntı yok) kanıtlanır.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PG = process.env.GUR_TEST_PG;
if (!PG) {
  console.error('GUR_TEST_PG gerekli: süper kullanıcı bağlantısı, veritabanı adı OLMADAN (postgres://…@127.0.0.1:5432)');
  process.exit(1);
}
const DB = 'gur_kur_test';
const TOKEN = 'sbp_test_token';
const ANON = 'anon-test-key';
const SERVIS = 'service-test-key';

const shim = fs.readFileSync(path.join(KOK, 'supabase', 'tests', 'shim.sql'), 'utf8');

// ─── Temiz veritabanı ─────────────────────────────────────────────────
let db;                                   // taklit sunucunun kullandığı bağlantı
async function yeniDb() {
  if (db) await db.end();
  const yonetici = new pg.Client({ connectionString: `${PG}/postgres` });
  await yonetici.connect();
  await yonetici.query(`drop database if exists ${DB} with (force)`);
  await yonetici.query(`create database ${DB}`);
  await yonetici.end();
  db = new pg.Client({ connectionString: `${PG}/${DB}` });
  await db.connect();
  await db.query(shim);
}
const sorgu = async (q) => { const s = await db.query(q); return (Array.isArray(s) ? s.at(-1) : s).rows; };

// ─── Taklit Yönetim API'si ────────────────────────────────────────────
const kayit = { authYamalari: [], istekler: [] };
const sunucu = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const govde = await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b ? JSON.parse(b) : {})); });
  kayit.istekler.push(`${req.method} ${url.pathname}`);
  const yanit = (kod, nesne) => { res.writeHead(kod, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(nesne)); };

  try {
    if (url.pathname.startsWith('/v1/')) {
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return yanit(401, { message: 'Invalid access token' });
      let m;
      if ((m = /^\/v1\/projects\/([^/]+)\/database\/query$/.exec(url.pathname)) && req.method === 'POST') {
        try { return yanit(201, await sorgu(govde.query)); }
        catch (e) { return yanit(400, { message: e.message }); }
      }
      if (/^\/v1\/projects\/[^/]+\/api-keys$/.test(url.pathname))
        return yanit(200, [{ name: 'anon', api_key: ANON }, { name: 'service_role', api_key: SERVIS }]);
      if (/^\/v1\/projects\/[^/]+\/config\/auth$/.test(url.pathname) && req.method === 'PATCH') {
        kayit.authYamalari.push(govde); return yanit(200, {});
      }
      if (url.pathname === '/v1/projects' && req.method === 'POST') {
        if (!govde.organization_slug && !govde.organization_id) return yanit(400, { message: 'organization required' });
        return yanit(201, { id: 'yeniproje123', name: govde.name, status: 'COMING_UP' });
      }
      if ((m = /^\/v1\/projects\/([^/]+)$/.exec(url.pathname)) && req.method === 'GET')
        return yanit(200, { id: m[1], status: 'ACTIVE_HEALTHY' });
      return yanit(404, { message: 'bilinmeyen uç ' + url.pathname });
    }
    if (url.pathname === '/auth/v1/admin/users' && req.method === 'POST') {
      if (req.headers.apikey !== SERVIS) return yanit(401, { message: 'servis anahtarı gerekli' });
      const var_ = await sorgu(`select 1 from auth.users where email = '${govde.email.replace(/'/g, "''")}'`);
      if (var_.length) return yanit(422, { msg: 'email_exists' });
      await db.query('insert into auth.users (email, raw_user_meta_data) values ($1, $2)', [govde.email, govde.user_metadata || {}]);
      return yanit(200, { email: govde.email });
    }
    if (url.pathname === '/rest/v1/rpc/gur_health' && req.method === 'POST') {
      if (req.headers.apikey !== ANON) return yanit(401, { message: 'anon anahtar gerekli' });
      return yanit(200, (await sorgu('select public.gur_health() as j'))[0].j);
    }
    yanit(404, { message: 'yok' });
  } catch (e) { yanit(500, { message: e.message }); }
});
await new Promise(r => sunucu.listen(0, '127.0.0.1', r));
const TABAN = `http://127.0.0.1:${sunucu.address().port}`;

// ─── Betiği çalıştır ──────────────────────────────────────────────────
function mobilDizini() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gur-mobil-'));
  fs.copyFileSync(path.join(KOK, 'mobile', 'eas.json'), path.join(d, 'eas.json'));
  return d;
}
// ASENKRON spawn: spawnSync ana döngüyü kilitler ve aynı süreçteki taklit
// sunucu cevap veremez (betik sonsuza dek bekler).
function kur(ek = {}, argumanlar = []) {
  return new Promise((coz) => {
    const c = spawn('node', [path.join(KOK, 'scripts', 'supabase-kur.mjs'), ...argumanlar], {
      env: {
        PATH: process.env.PATH, HOME: os.tmpdir(),
        SUPABASE_API_BASE: TABAN, SUPABASE_URL: TABAN, SUPABASE_ACCESS_TOKEN: TOKEN,
        SUPABASE_PROJECT_REF: 'abcd1234', ...ek,
      },
    });
    let cikti = '';
    c.stdout.on('data', d => { cikti += d; });
    c.stderr.on('data', d => { cikti += d; });
    const zamanAsimi = setTimeout(() => { c.kill(); cikti += '\n[test] 90 sn zaman aşımı'; }, 90000);
    c.on('close', kod => { clearTimeout(zamanAsimi); coz({ kod, cikti }); });
  });
}

let gecen = 0;
const ok = (m) => { gecen++; console.log(`ok - ${m}`); };

try {
  // 1 ─ Temiz projeye ilk kurulum
  await yeniDb();
  let mobil = mobilDizini();
  let r = await kur({ GUR_MOBILE_DIR: mobil, ADMIN_EMAIL: 'yonetici@gur.test', ADMIN_PASSWORD: 'uzun-parola-1', SUPABASE_AUTO_CONFIRM: '1' });
  assert.equal(r.kod, 0, r.cikti);
  ok('ilk kurulum: çıkış 0');
  assert.equal((await sorgu('select count(*)::int n from supabase_migrations.schema_migrations'))[0].n, 4);
  ok('4 migration Supabase CLI defterine yazıldı');
  assert.equal((await sorgu('select count(*)::int n from public.restaurants'))[0].n, 218);
  ok('218 mekân yazıldı (seed parça parça)');
  assert.equal((await sorgu(`select count(*)::int n from public.platform_admins pa join auth.users u on u.id=pa.user_id where u.email='yonetici@gur.test'`))[0].n, 1);
  ok('yönetici hesabı açıldı ve platform_admins\'e eklendi');
  assert.equal((await sorgu(`select display_name from public.profiles p join auth.users u on u.id=p.id where u.email='yonetici@gur.test'`))[0].display_name, 'GUR Yönetici');
  ok('yönetici için profil tetikleyiciyle oluştu');
  assert.equal(kayit.authYamalari.length, 1);
  assert.deepEqual(kayit.authYamalari[0], {
    external_email_enabled: true, password_min_length: 6, uri_allow_list: 'gur://**', mailer_autoconfirm: true });
  ok('Auth ayarı gönderildi (e-posta açık, ≥6 karakter, gur:// izinli, otomatik onay istendiği için açık)');
  const env = fs.readFileSync(path.join(mobil, '.env'), 'utf8');
  assert.match(env, new RegExp(`EXPO_PUBLIC_SUPABASE_URL=${TABAN.replace(/[.]/g, '\\.')}`));
  assert.match(env, /EXPO_PUBLIC_SUPABASE_ANON_KEY=anon-test-key/);
  ok('mobile/.env: URL + anon anahtar');
  const eas = JSON.parse(fs.readFileSync(path.join(mobil, 'eas.json'), 'utf8'));
  for (const p of ['development', 'preview', 'production']) {
    assert.equal(eas.build[p].env.EXPO_PUBLIC_SUPABASE_ANON_KEY, ANON);
    assert.equal(eas.build[p].env.EXPO_PUBLIC_SUPABASE_URL, TABAN);
  }
  ok('eas.json: üç profile de bağlantı yazıldı');
  const sizinti = [env, JSON.stringify(eas), r.cikti].filter(x => x.includes(SERVIS) || x.includes('uzun-parola-1'));
  assert.equal(sizinti.length, 0, 'servis anahtarı ya da parola sızdı');
  ok('SERVİS ANAHTARI ve yönetici parolası hiçbir dosyaya/çıktıya sızmadı');
  assert.match(r.cikti, /REST ucu cevap veriyor/);
  ok('uçtan uca REST ping (anon anahtarla gur_health) geçti');

  // 2 ─ İkinci çalıştırma: idempotent
  r = await kur({ GUR_MOBILE_DIR: mobil, ADMIN_EMAIL: 'yonetici@gur.test', ADMIN_PASSWORD: 'uzun-parola-1' });
  assert.equal(r.kod, 0, r.cikti);
  assert.match(r.cikti, /4 migration zaten uygulanmış/);
  assert.match(r.cikti, /218 mekân var, atlandı/);
  assert.match(r.cikti, /hesap zaten var/);
  assert.equal((await sorgu('select count(*)::int n from public.restaurants'))[0].n, 218);
  assert.equal((await sorgu('select count(*)::int n from auth.users'))[0].n, 1);
  ok('ikinci çalıştırma: migration/seed/hesap tekrarlanmadı (idempotent)');

  // 3 ─ --seed kopya üretmez, sahiplenen kaydı ezmez
  await sorgu(`insert into public.organizations (id, legal_name) values ('00000000-0000-0000-0000-00000000000f', 'X')`);
  const [{ id: sahipli }] = await sorgu(`select id from public.restaurants order by id limit 1`);
  await sorgu(`update public.restaurants set claimed_by_org='00000000-0000-0000-0000-00000000000f', name='Elle Değişti' where id='${sahipli}'`);
  r = await kur({ GUR_MOBILE_DIR: mobil }, ['--seed']);
  assert.equal(r.kod, 0, r.cikti);
  assert.equal((await sorgu('select count(*)::int n from public.restaurants'))[0].n, 218);
  assert.equal((await sorgu(`select name from public.restaurants where id='${sahipli}'`))[0].name, 'Elle Değişti');
  ok('--seed: kopya yok, sahiplenilmiş kayıt ezilmedi');

  // 4 ─ Kuru çalıştırma temiz veritabanına DOKUNMAZ
  await yeniDb();
  r = await kur({ GUR_MOBILE_DIR: mobil }, ['--kuru']);
  assert.equal(r.kod, 0, r.cikti);
  assert.match(r.cikti, /4 migration uygulanırdı/);
  assert.equal((await sorgu(`select to_regclass('supabase_migrations.schema_migrations')::text v`))[0].v, null);
  assert.equal((await sorgu(`select to_regclass('public.restaurants')::text v`))[0].v, null);
  ok('--kuru: defter bile oluşmadı, hiçbir tablo yok (salt okunur)');

  // 5 ─ Yanlış erişim anahtarı
  r = await kur({ SUPABASE_ACCESS_TOKEN: 'yanlis', GUR_MOBILE_DIR: mobil });
  assert.notEqual(r.kod, 0);
  assert.match(r.cikti, /401/);
  ok('yanlış token: anlaşılır hatayla durdu (401)');

  // 6 ─ Bozuk migration: tümü geri alınır, deftere yazılmaz
  await yeniDb();
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'gur-sb-'));
  fs.cpSync(path.join(KOK, 'supabase'), gecici, { recursive: true });
  fs.writeFileSync(path.join(gecici, 'migrations', '20261114009999_boz.sql'),
    'create table public.yari_kalan (a int);\nselect 1/0;\n');
  r = await kur({ GUR_SUPABASE_DIR: gecici, GUR_MOBILE_DIR: mobil });
  assert.notEqual(r.kod, 0);
  assert.match(r.cikti, /tümü geri alındı/);
  assert.equal((await sorgu(`select to_regclass('public.yari_kalan')::text v`))[0].v, null);
  const surumler = (await sorgu('select version from supabase_migrations.schema_migrations order by 1')).map(x => x.version);
  assert.deepEqual(surumler, ['20261114000100', '20261114000200', '20261114000300', '20261114000400']);
  ok('bozuk migration: yarım kalan tablo YOK (atomik), deftere yazılmadı, önceki 4 sağlam');
  // Düzeltilince kaldığı yerden devam eder
  fs.unlinkSync(path.join(gecici, 'migrations', '20261114009999_boz.sql'));
  r = await kur({ GUR_SUPABASE_DIR: gecici, GUR_MOBILE_DIR: mobil });
  assert.equal(r.kod, 0, r.cikti);
  ok('düzeltilince tekrar çalıştırma sorunsuz');

  // 7 ─ Yeni proje açma yolu
  await yeniDb();
  r = await kur({ SUPABASE_PROJECT_REF: '', SUPABASE_ORG_ID: 'org-slug', SUPABASE_DB_PASSWORD: 'gecici-guclu-parola', GUR_MOBILE_DIR: mobil }, ['--proje-olustur']);
  assert.equal(r.kod, 0, r.cikti);
  assert.match(r.cikti, /proje kodu: yeniproje123/);
  assert.ok(kayit.istekler.includes('POST /v1/projects') && kayit.istekler.some(i => i.includes('database/query')));
  ok('--proje-olustur: proje açıldı, hazır olması beklendi, kurulum sürdü');

  // 8 ─ Proje kodu yok ve --proje-olustur da yok
  r = await kur({ SUPABASE_PROJECT_REF: '', GUR_MOBILE_DIR: mobil });
  assert.notEqual(r.kod, 0);
  assert.match(r.cikti, /--proje-olustur/);
  ok('proje kodu yoksa yanlışlıkla yeni proje AÇILMAZ (açık bayrak ister)');

  // 9 ─ Yönetici parolası kısaysa hesap açılmaz ama kurulum sürer
  await yeniDb();
  r = await kur({ ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD: 'kisa', GUR_MOBILE_DIR: mobil });
  assert.equal(r.kod, 0, r.cikti);
  assert.match(r.cikti, /en az 8 karakter/);
  assert.equal((await sorgu('select count(*)::int n from public.platform_admins'))[0].n, 0);
  ok('kısa yönetici parolası: hesap AÇILMADI, varsayılan parola yok');

  console.log(`\n✓ ${gecen} doğrulama geçti`);
} catch (e) {
  console.error('\n✗ BAŞARISIZ:', e.message);
  process.exitCode = 1;
} finally {
  if (db) await db.end().catch(() => {});
  sunucu.close();
}
