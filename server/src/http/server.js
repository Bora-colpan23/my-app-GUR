// ═══════════════════════════════════════════════════════════════════════
// HTTP sunucusu — çerçevesiz, node:http üzerine ince bir yönlendirici.
//
// Express eklemek yerine küçük bir router yazıldı: uç sayısı sınırlı ve
// bağımlılık yüzeyini dar tutmak, üretime giderken denetlenecek kod
// miktarını da dar tutuyor.
// ═══════════════════════════════════════════════════════════════════════

import http from "node:http";
import { userFromRequest } from "../auth/session.js";

const MAX_BODY = 1_000_000;   // 1 MB — yorum fotoğrafı URL listesi bile bunun altında

// Handler'lar normalde doğrudan gövdeyi döndürür. Farklı bir HTTP kodu
// gerekiyorsa reply() ile sarar; böylece gövdedeki "status" alanı HTTP
// koduyla karışmaz.
const HTTP_STATUS = Symbol("http.status");
export const reply = (status, body) => ({ [HTTP_STATUS]: status, body });

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler, { auth = false, role = null } = {}) {
    // "/api/restaurants/:id" → /^\/api\/restaurants\/([^/]+)$/
    const names = [];
    const regex = new RegExp("^" + pattern.replace(/:([A-Za-z0-9_]+)/g, (_, n) => {
      names.push(n); return "([^/]+)";
    }) + "$");
    this.routes.push({ method, regex, names, handler, auth, role });
    return this;
  }
  get(p, h, o)   { return this.add("GET", p, h, o); }
  post(p, h, o)  { return this.add("POST", p, h, o); }
  patch(p, h, o) { return this.add("PATCH", p, h, o); }
  del(p, h, o)   { return this.add("DELETE", p, h, o); }

  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = regexExec(r.regex, pathname);
      if (m) return { route: r, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
}

function regexExec(re, s) { re.lastIndex = 0; return re.exec(s); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Gövde çok büyük"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(Object.assign(new Error("Geçersiz JSON"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function send(res, status, payload) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    // Tarayıcı içerik türünü tahmin etmeye çalışmasın
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

export function createServer(router, { db, origin = "*" } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    // Geliştirmede Vite başka porttan servis ediyor; CORS olmadan hiçbir
    // istek geçmez. Üretimde origin ortamdan sabitlenir.
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      });
      return res.end();
    }

    const hit = router.match(req.method, url.pathname);
    if (!hit) return send(res, 404, { error: "Bulunamadı" });

    const claims = userFromRequest(req);
    if (hit.route.auth && !claims) return send(res, 401, { error: "Oturum gerekli" });
    if (hit.route.role && claims?.role !== hit.route.role) return send(res, 403, { error: "Yetki yok" });

    try {
      const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req);
      const out = await hit.route.handler({
        db, params: hit.params, query: Object.fromEntries(url.searchParams), body,
        user: claims, req, res,
      });
      if (res.writableEnded) return;
      // Gövdenin kendi "status" alanı olabilir (ziyaret durumu gibi); HTTP
      // kodunu ondan okumak alan adı çakışması demekti. Açık zarf kullanıyoruz.
      if (out && typeof out === "object" && HTTP_STATUS in out) {
        send(res, out[HTTP_STATUS], out.body ?? {});
      } else {
        send(res, 200, out ?? {});
      }
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(`[http] ${req.method} ${url.pathname}:`, err.stack);
      // İç hata ayrıntısı istemciye sızmaz; 4xx'te mesaj kullanıcıya yönelik.
      send(res, status, { error: status >= 500 ? "Sunucu hatası" : err.message });
    }
  });
}

export { send };
