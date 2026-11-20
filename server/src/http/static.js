// ═══════════════════════════════════════════════════════════════════════
// Derlenmiş arayüzü (dist/) servis eder — tek servisle yayın için.
//
// Geliştirmede Vite, üretimde bu dosya: aynı origin'den hem arayüz hem /api
// gelince uygulama CANLI moda geçer ve CORS derdi olmaz. Çerçevesiz router'ın
// kalıbına uygun, bağımlılıksız.
//
// Kurallar:
//   • Dosya varsa onu ver; yoksa ve yol bir DOSYA adı değilse index.html
//     (SPA: /isletme/panel, /admin, /uygulama sunucuda gerçek dosya değil).
//   • Hash'li varlıklar (assets/) bir yıl önbelleklenir: ad içeriğin hash'ini
//     taşıyor. HTML ve sw.js ASLA — yeni dağıtım hemen görünmeli, yoksa
//     kullanıcı haftalarca eski sürümü görür (bkz. CLAUDE.md, çevrimdışı kabuk).
//   • Yol dist/ dışına çıkamaz (.. ve mutlak yol reddedilir).
// ═══════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".map": "application/json",
};

export function createStaticHandler(root) {
  const base = path.resolve(root);
  if (!fs.existsSync(path.join(base, "index.html"))) return null;

  const dosya = (p) => {
    try { return fs.statSync(p).isFile() ? p : null; } catch { return null; }
  };

  return function serve(req, res, pathname) {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return false; }
    const hedef = path.join(base, path.normalize(rel));
    if (hedef !== base && !hedef.startsWith(base + path.sep)) return false;

    let yol = dosya(hedef);
    // Uzantılı bir yol (örn. /assets/eski.js) bulunamadıysa index.html'e
    // düşmek 404'ü HTML ile maskelerdi: tarayıcı betik yerine sayfa alırdı.
    if (!yol && path.extname(rel)) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Bulunamadı"); return true; }
    if (!yol) yol = path.join(base, "index.html");

    const ext = path.extname(yol).toLowerCase();
    const hashli = yol.startsWith(path.join(base, "assets") + path.sep);
    res.writeHead(200, {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Cache-Control": hashli ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") { res.end(); return true; }
    fs.createReadStream(yol).pipe(res);
    return true;
  };
}
