#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// GUR → Supabase otomatik kurulum
//
//   npm run supabase:kur                    # kimlik bilgisi varsa kurar
//   npm run supabase:kur -- --kuru          # neyin çalışacağını yazar, dokunmaz
//   npm run supabase:kur -- --seed          # listeyi (218 mekân) yeniden yazar
//
// "Entegrasyonu verince Supabase otomatik açılsın": bu betik, kimlik
// bilgisini aldığı anda şemayı, güvenlik kurallarını, kovaları ve Bakırköy
// listesini kurar; yönetici hesabını açar; mobil uygulamanın bağlantı
// adresini ve genel anahtarını yazar. HER ÇALIŞTIRMADA GÜVENLİDİR:
// uygulanmış migration atlanır, seed kopya üretmez.
//
// ── KİMLİK BİLGİSİ (üç yoldan biri) ──────────────────────────────────
//  A) Yönetim API'si, MEVCUT proje          (önerilen)
//       SUPABASE_ACCESS_TOKEN   supabase.com → Account → Access Tokens (sbp_…)
//       SUPABASE_PROJECT_REF    proje adresindeki kısa kod (abcd1234…)
//  B) Yönetim API'si, YENİ proje (betik projeyi de açar; --proje-olustur)
//       SUPABASE_ACCESS_TOKEN, SUPABASE_ORG_ID (kuruluş "slug"ı),
//       SUPABASE_DB_PASSWORD (güçlü, yeni), [SUPABASE_REGION=eu-central-1],
//       [SUPABASE_PROJECT_NAME=gur]
//  C) Doğrudan veritabanı
//       SUPABASE_DB_URL         postgres://postgres:…@db.<ref>.supabase.co:5432/postgres
//       [SUPABASE_DB_SSL=no-verify]  (sertifika zinciri hatası alırsanız, bilerek)
//
// ── İSTEĞE BAĞLI ─────────────────────────────────────────────────────
//   ADMIN_EMAIL + ADMIN_PASSWORD   yönetici hesabı (≥ 8 karakter; varsayılan YOK)
//   SUPABASE_AUTO_CONFIRM=1        e-posta doğrulamayı kapatır (yalnız geliştirme)
//   SITE_URL                       Auth site adresi
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   (C yolunda yönetici hesabı için)
//
// Değerler ortamdan ya da depo kökündeki `.env.supabase` dosyasından okunur
// (dosya .gitignore'da). SERVICE ANAHTARI HİÇBİR DOSYAYA YAZILMAZ; mobil
// uygulamaya yalnızca genel (anon) anahtar gider.
//
// BU BETİK GERÇEK Supabase'e KARŞI HENÜZ DENENMEDİ: yerel bir PostgreSQL
// üzerinde Yönetim API'sini taklit eden bir sunucuyla sınandı
// (supabase/tests/yonetim-api-taklit.mjs). Proje OLUŞTURMA, Auth ayarı ve
// api-keys uçları belgeden yazıldı; ilk gerçek çalıştırmada hata olursa
// çıktıyı olduğu gibi iletin.
// ═══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// GUR_SUPABASE_DIR / GUR_MOBILE_DIR: yalnızca TEST kancası (supabase/tests/kur.test.mjs
// betiği gerçek mobile/ dosyalarını ezmeden sınasın diye).
const SB = process.env.GUR_SUPABASE_DIR || path.join(KOK, 'supabase');
const MOBIL = process.env.GUR_MOBILE_DIR || path.join(KOK, 'mobile');
const PARCA = '-- @@gur-parca';

const args = new Set(process.argv.slice(2));
const KURU = args.has('--kuru') || args.has('--kuru-calistir');

// ─── Yapılandırma ─────────────────────────────────────────────────────

function envDosyasi(ad) {
  const yol = path.join(KOK, ad);
  if (!fs.existsSync(yol)) return;
  for (const satir of fs.readFileSync(yol, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(satir);
    if (!m || satir.trim().startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
envDosyasi('.env.supabase');

const E = (k) => (process.env[k] || '').trim();
const cfg = {
  token: E('SUPABASE_ACCESS_TOKEN'),
  ref: E('SUPABASE_PROJECT_REF'),
  org: E('SUPABASE_ORG_ID'),
  dbParola: E('SUPABASE_DB_PASSWORD'),
  bolge: E('SUPABASE_REGION') || 'eu-central-1',
  ad: E('SUPABASE_PROJECT_NAME') || 'gur',
  dbUrl: E('SUPABASE_DB_URL'),
  taban: (E('SUPABASE_API_BASE') || 'https://api.supabase.com').replace(/\/+$/, ''),
  url: E('SUPABASE_URL'),
  servis: E('SUPABASE_SERVICE_ROLE_KEY'),
  adminEposta: E('ADMIN_EMAIL'),
  adminParola: E('ADMIN_PASSWORD'),
  siteUrl: E('SITE_URL'),
  otoOnay: E('SUPABASE_AUTO_CONFIRM') === '1',
};

const log = (m = '') => console.log(m);
const adim = (m) => log(`› ${m}`);
const tamam = (m) => log(`  ✓ ${m}`);
const uyar = (m) => log(`  ! ${m}`);
const hata = (m) => { console.error(`\n✗ ${m}`); process.exit(1); };

const sqlStr = (v) => `'${String(v).replace(/'/g, "''")}'`;
const bekle = (ms) => new Promise(r => setTimeout(r, ms));

function yardim() {
  log(`GUR Supabase kurulumu — kimlik bilgisi bulunamadı.

Şunlardan birini verin (ortam değişkeni ya da depo kökünde .env.supabase):

  A) Mevcut proje:   SUPABASE_ACCESS_TOKEN=sbp_…  SUPABASE_PROJECT_REF=<proje kodu>
  B) Yeni proje:     SUPABASE_ACCESS_TOKEN=sbp_…  SUPABASE_ORG_ID=<kuruluş slug>
                     SUPABASE_DB_PASSWORD=<yeni güçlü parola>   (+ --proje-olustur)
  C) Doğrudan DB:    SUPABASE_DB_URL=postgres://postgres:…@db.<ref>.supabase.co:5432/postgres

İsteğe bağlı: ADMIN_EMAIL + ADMIN_PASSWORD (yönetici hesabı, ≥ 8 karakter).
Ayrıntı: bu dosyanın başındaki yorum, supabase/README.md.`);
}

// ─── Yönetim API'si ───────────────────────────────────────────────────

async function yonetim(yontem, yol, govde, { tekrar = 3 } = {}) {
  let son;
  for (let i = 0; i < tekrar; i++) {
    let r;
    try {
      r = await fetch(`${cfg.taban}${yol}`, {
        method: yontem,
        headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: govde === undefined ? undefined : JSON.stringify(govde),
      });
    } catch (e) {
      son = new Error(`Yönetim API'sine ulaşılamadı (${cfg.taban}): ${e.cause?.code || e.message}`);
      await bekle(800 * (i + 1));
      continue;
    }
    const metin = await r.text();
    let json = null;
    try { json = metin ? JSON.parse(metin) : null; } catch { /* metin kalır */ }
    if (r.ok) return json;
    const mesaj = json?.message || json?.error || metin.slice(0, 400) || r.statusText;
    son = Object.assign(new Error(`${yontem} ${yol} → ${r.status}: ${mesaj}`), { durum: r.status });
    if (r.status === 429 || r.status >= 500) { await bekle(1500 * (i + 1)); continue; }
    break;       // 4xx: tekrar denemenin anlamı yok
  }
  throw son;
}

// ─── Hedef: SQL çalıştırıcı ───────────────────────────────────────────

/** @returns {Promise<{mod:string, sql:(q:string)=>Promise<any[]>, kapat:()=>Promise<void>}>} */
async function baglan() {
  if (cfg.dbUrl && !(cfg.token && cfg.ref)) {
    const { default: pg } = await import('pg');
    const ssl = E('SUPABASE_DB_SSL') === 'no-verify' ? { rejectUnauthorized: false } : undefined;
    const istemci = new pg.Client({ connectionString: cfg.dbUrl, ssl });
    await istemci.connect().catch(e => hata(`Veritabanına bağlanılamadı: ${e.message}`));
    return {
      mod: 'db',
      // Basit sorgu protokolü: çok ifadeli metin TEK örtük işlemdir (biri
      // düşerse hepsi geri alınır) — migration'ların atomikliği buna dayanır.
      sql: async (q) => {
        const s = await istemci.query(q);
        const son = Array.isArray(s) ? s[s.length - 1] : s;
        return son?.rows || [];
      },
      kapat: () => istemci.end(),
    };
  }

  if (!cfg.token) hata('SUPABASE_ACCESS_TOKEN gerekli (Yönetim API\'si yolu).');

  if (!cfg.ref) {
    if (!args.has('--proje-olustur')) {
      hata('SUPABASE_PROJECT_REF yok. Yeni proje açmak için --proje-olustur verin (SUPABASE_ORG_ID + SUPABASE_DB_PASSWORD gerekir).');
    }
    if (!cfg.org || !cfg.dbParola) hata('Yeni proje için SUPABASE_ORG_ID ve SUPABASE_DB_PASSWORD gerekli.');
    adim(`Yeni proje açılıyor: ${cfg.ad} (${cfg.bolge})`);
    if (KURU) { log('  (kuru çalıştırma: proje açılmadı)'); return null; }
    let p;
    try {
      p = await yonetim('POST', '/v1/projects',
        { name: cfg.ad, organization_slug: cfg.org, db_pass: cfg.dbParola, region: cfg.bolge }, { tekrar: 1 });
    } catch (e) {
      if (e.durum !== 400) throw e;
      // Eski API adı
      p = await yonetim('POST', '/v1/projects',
        { name: cfg.ad, organization_id: cfg.org, db_pass: cfg.dbParola, region: cfg.bolge }, { tekrar: 1 });
    }
    cfg.ref = p.id || p.ref;
    if (!cfg.ref) hata('Proje açıldı ama yanıtta proje kodu yok: ' + JSON.stringify(p).slice(0, 300));
    tamam(`proje kodu: ${cfg.ref}`);
    log(`    SUPABASE_PROJECT_REF=${cfg.ref}   ← bunu .env.supabase dosyanıza yazın (sonraki çalıştırmalar için)`);
    for (let i = 0; i < 120; i++) {
      const d = await yonetim('GET', `/v1/projects/${cfg.ref}`).catch(() => null);
      if (d?.status === 'ACTIVE_HEALTHY') break;
      if (i === 119) hata('Proje 10 dakikada hazır olmadı; panelden durumuna bakın, sonra tekrar çalıştırın.');
      if (i % 6 === 0) log(`    hazırlanıyor… (${d?.status || 'bilinmiyor'})`);
      await bekle(5000);
    }
  }

  return {
    mod: 'api',
    // Yönetim API'si çok ifadeli metni tek istekte, tek örtük işlemde çalıştırır.
    // Açık BEGIN/COMMIT YAZILMAZ: bir ifade düşerse bağlantı "işlem iptal"
    // durumunda havuza dönebilir; örtük işlem ise kendiliğinden geri alınır.
    sql: async (q) => {
      const r = await yonetim('POST', `/v1/projects/${cfg.ref}/database/query`, { query: q });
      return Array.isArray(r) ? r : [];
    },
    kapat: async () => {},
  };
}

// ─── Migration'lar ────────────────────────────────────────────────────

const dosyalar = () => fs.readdirSync(path.join(SB, 'migrations')).filter(f => f.endsWith('.sql')).sort();

// Supabase CLI'ın kendi defteri: kurulumdan sonra `supabase db push` ile
// yeni migration eklemek aynı kayıtla tutarlı çalışsın.
const DEFTER = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version text not null primary key, statements text[], name text);`;

async function migrationlar(hedef) {
  adim('Migration defteri');
  // Kuru çalıştırma SALT OKUNUR: defteri bile oluşturmaz.
  const [{ var: defterVar }] = await hedef.sql(`select to_regclass('supabase_migrations.schema_migrations')::text as var`);
  if (!KURU) await hedef.sql(DEFTER);
  const uygulanan = new Set(defterVar || !KURU
    ? (await hedef.sql('select version from supabase_migrations.schema_migrations')).map(r => String(r.version))
    : []);
  const hepsi = dosyalar();
  const bilinmeyen = [...uygulanan].filter(v => !hepsi.some(f => f.startsWith(v + '_')));
  if (bilinmeyen.length) uyar(`Veritabanında olup depoda olmayan migration: ${bilinmeyen.join(', ')}`);

  const bekleyen = hepsi.filter(f => !uygulanan.has(f.split('_')[0]));
  if (!bekleyen.length) { tamam(`${hepsi.length} migration zaten uygulanmış`); return 0; }

  for (const f of bekleyen) {
    const [surum, ...ad] = f.replace(/\.sql$/, '').split('_');
    adim(`migration ${f}${KURU ? ' (kuru)' : ''}`);
    if (KURU) continue;
    const govde = fs.readFileSync(path.join(SB, 'migrations', f), 'utf8');
    try {
      await hedef.sql(`${govde}\n;\ninsert into supabase_migrations.schema_migrations (version, name)
        values (${sqlStr(surum)}, ${sqlStr(ad.join('_'))}) on conflict (version) do nothing;`);
    } catch (e) {
      hata(`${f} uygulanamadı (tümü geri alındı, veritabanı bu migration'dan ÖNCEKİ hâlde):\n  ${e.message}`);
    }
    tamam('uygulandı');
  }
  return bekleyen.length;
}

// ─── Seed ─────────────────────────────────────────────────────────────

async function seed(hedef) {
  adim('Bakırköy listesi');
  const yol = path.join(SB, 'seed.sql');
  if (!fs.existsSync(yol)) { uyar('supabase/seed.sql yok (npm run supabase:seed-uret)'); return; }
  const [{ n }] = await hedef.sql('select count(*)::int as n from public.restaurants');
  if (n > 0 && !args.has('--seed')) { tamam(`${n} mekân var, atlandı (yeniden yazmak için --seed)`); return; }
  if (KURU) { log(`  (kuru: ${n} mekân var; --seed ile yeniden yazılırdı)`); return; }
  const parcalar = fs.readFileSync(yol, 'utf8').split(PARCA).map(s => s.trim()).filter(Boolean);
  for (const p of parcalar) await hedef.sql(p);
  const [{ s }] = await hedef.sql('select count(*)::int as s from public.restaurants');
  tamam(`${s} mekân`);
}

// ─── Auth ayarı, anahtarlar, yönetici ─────────────────────────────────

async function authAyari() {
  adim('Auth ayarı');
  const yama = {
    external_email_enabled: true,
    password_min_length: 6,                       // uygulamadaki en az 6 karakter kuralıyla aynı
    uri_allow_list: 'gur://**',                   // mobil derin bağlantı (e-posta doğrulama dönüşü)
    ...(cfg.otoOnay ? { mailer_autoconfirm: true } : null),
    ...(cfg.siteUrl ? { site_url: cfg.siteUrl } : null),
  };
  if (KURU) { log(`  (kuru) PATCH config/auth ${JSON.stringify(yama)}`); return; }
  try {
    await yonetim('PATCH', `/v1/projects/${cfg.ref}/config/auth`, yama, { tekrar: 2 });
    tamam('e-posta/parola girişi açık, en az 6 karakter, gur:// dönüş adresi izinli' +
      (cfg.otoOnay ? ', e-posta doğrulama KAPALI (geliştirme)' : ', e-posta doğrulama AÇIK'));
  } catch (e) {
    uyar(`Auth ayarı yapılamadı (${e.message}). Elle: Authentication → Providers → Email açık olmalı.`);
  }
}

async function anahtarlar() {
  adim('Proje anahtarları');
  const liste = await yonetim('GET', `/v1/projects/${cfg.ref}/api-keys`, undefined, { tekrar: 2 });
  const bul = (...adlar) => liste.find(k => adlar.includes(k.name) || adlar.includes(k.type));
  const anon = bul('anon', 'publishable');
  const servis = bul('service_role', 'secret');
  if (!anon) hata('api-keys yanıtında anon/publishable anahtar yok.');
  tamam('genel (anon) anahtar alındı; servis anahtarı yalnızca bellekte, hiçbir yere yazılmaz');
  return { anon: anon.api_key, servis: servis?.api_key || null };
}

async function yonetici(hedef, url, servisAnahtari) {
  if (!cfg.adminEposta && !cfg.adminParola) {
    adim('Yönetici hesabı');
    uyar('ADMIN_EMAIL / ADMIN_PASSWORD verilmedi — yönetici hesabı AÇILMADI (varsayılan parola yok).');
    return;
  }
  adim('Yönetici hesabı');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.adminEposta)) { uyar('ADMIN_EMAIL geçerli bir e-posta değil, atlandı.'); return; }
  if (cfg.adminParola.length < 8) { uyar('ADMIN_PASSWORD en az 8 karakter olmalı, atlandı.'); return; }
  if (!url || !servisAnahtari) { uyar('Hesap açmak için servis anahtarı gerekli (API yolu ya da SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).'); return; }
  if (KURU) { log(`  (kuru) ${cfg.adminEposta} oluşturulup platform_admins'e eklenirdi`); return; }

  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: servisAnahtari, Authorization: `Bearer ${servisAnahtari}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cfg.adminEposta, password: cfg.adminParola, email_confirm: true,
      user_metadata: { name: 'GUR Yönetici' } }),
  }).catch(e => hata(`Auth sunucusuna ulaşılamadı: ${e.message}`));
  if (r.ok) tamam('hesap açıldı');
  else if (r.status === 422 || r.status === 409) tamam('hesap zaten var (parola DEĞİŞTİRİLMEDİ)');
  else hata(`Yönetici hesabı açılamadı: ${r.status} ${(await r.text()).slice(0, 200)}`);

  await hedef.sql(`insert into public.platform_admins (user_id)
    select id from auth.users where lower(email) = lower(${sqlStr(cfg.adminEposta)})
    on conflict do nothing`);
  const [{ n }] = await hedef.sql(`select count(*)::int as n from public.platform_admins pa
    join auth.users u on u.id = pa.user_id where lower(u.email) = lower(${sqlStr(cfg.adminEposta)})`);
  if (n !== 1) hata('Hesap açıldı ama platform_admins\'e eklenemedi.');
  tamam('yönetici olarak yetkilendirildi');
}

// ─── Doğrulama ────────────────────────────────────────────────────────

async function dogrula(hedef, url, anon) {
  adim('Doğrulama');
  const [{ rls }] = await hedef.sql(`
    select string_agg(c.relname, ', ') as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity and not c.relispartition`);
  if (rls) hata(`RLS'siz tablo var (herkese açık olabilir!): ${rls}`);
  tamam('public şemasındaki her tabloda RLS açık');

  const [{ saglik }] = await hedef.sql(`select public.gur_health()::text as saglik`);
  tamam(`gur_health: ${saglik}`);

  if (url && anon) {
    // Uçtan uca: uygulamanın gerçekte yapacağı çağrı (anon anahtar + REST).
    try {
      const r = await fetch(`${url}/rest/v1/rpc/gur_health`, {
        method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }, body: '{}',
      });
      if (r.ok) tamam(`REST ucu cevap veriyor (anon anahtarla gur_health → ${r.status})`);
      else uyar(`REST ucu ${r.status} döndü: ${(await r.text()).slice(0, 160)}`);
    } catch (e) { uyar(`REST ucuna ulaşılamadı (${e.cause?.code || e.message}); veritabanı tarafı doğrulandı.`); }
  }
}

// ─── Mobil uygulamaya bağlantı ────────────────────────────────────────

function mobilYaz(url, anon) {
  adim('Mobil uygulama bağlantısı');
  if (KURU) { log('  (kuru) mobile/.env ve mobile/eas.json yazılırdı'); return; }

  // Yerel geliştirme (expo start)
  fs.writeFileSync(path.join(MOBIL, '.env'),
    `# supabase:kur tarafından yazıldı. Genel (anon) anahtar istemcide durmak için tasarlandı;\n` +
    `# veriyi RLS korur. SERVICE ANAHTARINI buraya YAZMAYIN.\n` +
    `EXPO_PUBLIC_SUPABASE_URL=${url}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${anon}\n`);
  tamam('mobile/.env');

  // Mağaza derlemeleri (EAS): derleme ortamına env geçmenin tek bağımsız yolu eas.json
  const easYol = path.join(MOBIL, 'eas.json');
  const eas = JSON.parse(fs.readFileSync(easYol, 'utf8'));
  for (const profil of ['development', 'preview', 'production']) {
    const p = (eas.build[profil] ||= {});
    p.env = { ...(p.env || {}), EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: anon };
  }
  fs.writeFileSync(easYol, JSON.stringify(eas, null, 2) + '\n');
  tamam('mobile/eas.json (development / preview / production)');
}

// ─── Akış ─────────────────────────────────────────────────────────────

async function main() {
  const kimlikVar = cfg.dbUrl || (cfg.token && (cfg.ref || args.has('--proje-olustur')));
  if (!kimlikVar) {
    if (KURU) {
      adim('Kuru çalıştırma (kimlik bilgisi yok)');
      for (const f of dosyalar()) log(`  uygulanırdı: migrations/${f}`);
      log('  uygulanırdı: seed.sql (mekân yoksa)');
      return;
    }
    yardim();
    process.exit(2);
  }

  log(`GUR → Supabase kurulumu${KURU ? ' (KURU ÇALIŞTIRMA)' : ''}\n`);
  const hedef = await baglan();
  if (!hedef) return;
  try {
    adim(hedef.mod === 'api' ? `Bağlantı: Yönetim API'si, proje ${cfg.ref}` : 'Bağlantı: doğrudan veritabanı');
    await hedef.sql('select 1');
    tamam('bağlandı');

    const yeni = await migrationlar(hedef);
    if (KURU && yeni) {
      // Henüz uygulanmamış migration varken sonraki adımların okuyacağı tablolar yok.
      log(`\n(kuru çalıştırma) ${yeni} migration uygulanırdı; ardından seed, Auth ayarı, yönetici ve mobil bağlantı. Hiçbir şeye dokunulmadı.`);
      return;
    }
    await seed(hedef);

    let url = cfg.url || (cfg.ref ? `https://${cfg.ref}.supabase.co` : '');
    let anon = null, servis = cfg.servis || null;
    if (hedef.mod === 'api') {
      await authAyari();
      const k = await anahtarlar();
      anon = k.anon; servis = servis || k.servis;
    } else if (E('SUPABASE_ANON_KEY')) {
      anon = E('SUPABASE_ANON_KEY');
    }

    await yonetici(hedef, url, servis);
    await dogrula(hedef, url, anon);
    if (url && anon) mobilYaz(url, anon);
    else uyar('URL/anon anahtar bilinmiyor (doğrudan DB yolu): mobile/.env yazılmadı. SUPABASE_URL ve SUPABASE_ANON_KEY verin.');

    log(`\n✓ Hazır${yeni ? ` — ${yeni} migration uygulandı` : ''}.`);
    if (url) log(`  Proje: ${url}`);
    log('  Sıradaki: cd mobile && npm install && npx expo start');
  } finally {
    await hedef.kapat();
  }
}

main().catch(e => hata(e.message || String(e)));
