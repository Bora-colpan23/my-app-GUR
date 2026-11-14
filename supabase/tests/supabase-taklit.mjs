// ═══════════════════════════════════════════════════════════════════════
// SUPABASE TAKLİDİ — yalnızca test: PostgREST + GoTrue'nun mobil uygulamanın
// kullandığı küçük yüzeyi, gerçek bir PostgreSQL'in ÜSTÜNDE.
//
//   /rest/v1/rpc/<fn>              SQL fonksiyonunu çağıran rolle çalıştırır
//   DELETE /rest/v1/saved_places   RLS altında (çağıran rolle)
//   /auth/v1/{signup,token,user,logout}
//
// RLS ve execute izinleri GERÇEK: her istek `SET LOCAL ROLE anon|authenticated`
// ve `request.jwt.claims` ile çalışır — yani istemci gerçekte neye erişebiliyorsa
// burada da onu görür. TAKLİT olan: JWT imzalanmaz, e-posta gönderilmez, hız
// sınırı yok. Gerçek PostgREST'in tür dönüşümü/hata kodlarıyla bire bir
// aynı olduğu İDDİA EDİLMEZ.
// ═══════════════════════════════════════════════════════════════════════

import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.taklit-imza`;
const jwtCoz = (t) => { try { return JSON.parse(Buffer.from(String(t).split('.')[1], 'base64url').toString()); } catch { return null; } };

const lit = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `array(select jsonb_array_elements_text(${lit(JSON.stringify(v))}::jsonb))`;
  if (typeof v === 'object') return `${lit(JSON.stringify(v))}::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

export async function taklitBaslat({ pgUrl, anon, otomatikOnay = true }) {
  const db = new pg.Pool({ connectionString: pgUrl, max: 4 });
  const kullanicilar = new Map();           // e-posta → { id, parola, meta }
  const kayit = { rpc: [], auth: [] };

  const oturum = (u) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return {
      access_token: jwt({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp }),
      token_type: 'bearer', expires_in: 3600, expires_at: exp,
      refresh_token: crypto.randomUUID(),
      user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
              user_metadata: u.meta, app_metadata: {}, created_at: new Date().toISOString() },
    };
  };
  const rolBilgisi = (auth) => {
    const t = (auth || '').replace(/^Bearer\s+/i, '');
    if (!t || t === anon) return { rol: 'anon', claims: { role: 'anon' } };
    const p = jwtCoz(t);
    return p?.sub ? { rol: 'authenticated', claims: p } : { rol: 'anon', claims: { role: 'anon' } };
  };

  // Çağıran rolle, tek işlemde.
  async function rolle(auth, sql) {
    const { rol, claims } = rolBilgisi(auth);
    const c = await db.connect();
    try {
      await c.query('begin');
      await c.query(`set local role ${rol}`);
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      const r = await c.query(sql);
      await c.query('commit');
      return r;
    } catch (e) { await c.query('rollback').catch(() => {}); throw e; }
    finally { c.release(); }
  }

  const sunucu = http.createServer(async (req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      // `*` Authorization'ı KAPSAMAZ (CORS belirtimi): açıkça listelenmeli.
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, accept-profile, content-profile',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Expose-Headers': '*',
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const url = new URL(req.url, 'http://x');
    const govde = await new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b ? JSON.parse(b) : {})); });
    const yanit = (kod, nesne) => {
      res.writeHead(kod, { ...cors, 'Content-Type': 'application/json' });
      res.end(nesne === undefined ? '' : JSON.stringify(nesne));
    };

    try {
      if (req.headers.apikey !== anon) return yanit(401, { message: 'No API key found in request' });

      // ── Auth ──
      if (url.pathname === '/auth/v1/signup') {
        kayit.auth.push(['signup', govde.email]);
        if (kullanicilar.has(govde.email)) return yanit(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
        if ((govde.password || '').length < 6) return yanit(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
        const id = crypto.randomUUID();
        await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [id, govde.email, govde.data || {}]);
        const u = { id, email: govde.email, parola: govde.password, meta: govde.data || {} };
        kullanicilar.set(govde.email, u);
        return otomatikOnay ? yanit(200, oturum(u))
          : yanit(200, { id, email: u.email, user_metadata: u.meta, aud: 'authenticated', role: '' });
      }
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
        kayit.auth.push(['giris', govde.email]);
        const u = kullanicilar.get(govde.email);
        if (!u || u.parola !== govde.password) return yanit(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return yanit(200, oturum(u));
      }
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
        const u = [...kullanicilar.values()][0];
        return u ? yanit(200, oturum(u)) : yanit(400, { msg: 'Invalid Refresh Token' });
      }
      if (url.pathname === '/auth/v1/user') {
        const p = jwtCoz((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
        const u = [...kullanicilar.values()].find(x => x.id === p?.sub);
        return u ? yanit(200, oturum(u).user) : yanit(401, { msg: 'invalid JWT' });
      }
      if (url.pathname === '/auth/v1/logout') return yanit(204);

      // ── REST: RPC ──
      let m = /^\/rest\/v1\/rpc\/([a-z_0-9]+)$/.exec(url.pathname);
      if (m) {
        kayit.rpc.push(m[1]);
        const args = Object.entries(govde).map(([k, v]) => `${k} := ${lit(v)}`).join(', ');
        const r = await rolle(req.headers.authorization, `select public.${m[1]}(${args}) as r`);
        const v = r.rows[0]?.r;
        // void fonksiyon pg'de '' döner; PostgREST bunu 204 yapar (data: null).
        return v === '' || v === undefined ? yanit(204) : yanit(200, v);
      }
      // ── REST: tablo (yalnızca uygulamanın kullandığı) ──
      m = /^\/rest\/v1\/saved_places$/.exec(url.pathname);
      if (m && req.method === 'DELETE') {
        const id = (url.searchParams.get('restaurant_id') || '').replace(/^eq\./, '');
        kayit.rpc.push('DELETE saved_places');
        await rolle(req.headers.authorization, `delete from public.saved_places where restaurant_id = ${lit(id)}`);
        return yanit(204);
      }
      yanit(404, { message: 'taklitte yok: ' + url.pathname });
    } catch (e) {
      // PostgREST biçimi: { code, message, details, hint }
      yanit(/permission denied/.test(e.message) ? 403 : /does not exist/.test(e.message) ? 404 : 400,
        { code: e.code, message: e.message, details: e.detail || null, hint: e.hint || null });
    }
  });
  await new Promise(r => sunucu.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${sunucu.address().port}`,
    kayit, db,
    kapat: async () => { sunucu.close(); await db.end(); },
  };
}
