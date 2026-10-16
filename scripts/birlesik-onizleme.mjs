// ═══════════════════════════════════════════════════════════════════════
// Birleşik önizleme derleyici — DÖRT PARÇA TEK YERDE.
//
//   cd mobile && npx expo export --platform web --output-dir dist-web
//   npm run artifact
//   npm run onizleme
//
// Çıktı: dist/onizleme/
//   index.html   → kabuk (dört sekme)
//   web/         → üç web yüzeyi (tek dosyalık Vite derlemesi)
//   app/         → mobil uygulamanın web dışa aktarımı (Expo)
//
// Neden iki ayrı derleme: web yüzeyleri Vite + React DOM, mobil paket
// Expo + React Native Web. Tek belgeye koymak iki react kopyası ve
// çakışan global stil demekti; ayrı iframe'ler bunu ayırıyor.
// ═══════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KABUK = path.join(ROOT, "scripts", "onizleme-kabuk.html");
const WEB = path.join(ROOT, "dist", "gur-preview.html");
const APP = path.join(ROOT, "mobile", "dist-web");
const OUT = path.join(ROOT, "dist", "onizleme");

const log = (...a) => console.log("›", ...a);

function gerekli(yol, komut) {
  if (!fs.existsSync(yol)) {
    throw new Error(`${path.relative(ROOT, yol)} yok. Önce: ${komut}`);
  }
}

gerekli(WEB, "npm run artifact");
gerekli(APP, "cd mobile && npx expo export --platform web --output-dir dist-web");

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "web"), { recursive: true });

// ── 1. WEB YÜZEYLERİ ──────────────────────────────────────────────────
// gur-preview.html bir PARÇA: artifact servisi onu kendi belge
// iskeletine sarıyor. Burada iframe'e doğrudan veriliyor, yani kendi
// doctype'ı olmak zorunda — olmazsa tarayıcı quirks moduna düşer.
let web = fs.readFileSync(WEB, "utf8");

// Kabuğun kendi mod notu var; iki not üst üste binerdi.
web = web.replace(/<div class="gur-preview-note">[\s\S]*?<\/div>\n?/, "");
if (web.includes('<div class="gur-preview-note">')) throw new Error("Önizleme notu kaldırılamadı.");

fs.writeFileSync(
  path.join(OUT, "web", "index.html"),
  `<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8" />\n${web}</body>\n</html>\n`,
);

// ── 2. MOBİL UYGULAMA ─────────────────────────────────────────────────
// Expo dışa aktarımı MUTLAK yol yazıyor ("/assets/…", "/_expo/…") ve
// artifact alt yolda servis ediliyor; ayrıca servis "_" ile başlayan
// yolları ayırıyor, bu yüzden klasör adı da değişiyor.
fs.cpSync(APP, path.join(OUT, "app"), { recursive: true });
fs.renameSync(path.join(OUT, "app", "_expo"), path.join(OUT, "app", "expo"));

let sayac = 0;
const bagilYap = (dosya) => {
  const s = fs.readFileSync(dosya, "utf8");
  const y = s.replace(/"\/_expo\//g, '"expo/').replace(/"\/assets\//g, '"assets/')
             .replace(/src="\/_expo\//g, 'src="expo/').replace(/href="\/favicon\.ico"/g, 'href="favicon.ico"');
  if (y !== s) { fs.writeFileSync(dosya, y); sayac++; }
};

bagilYap(path.join(OUT, "app", "index.html"));
for (const f of fs.readdirSync(path.join(OUT, "app", "expo", "static", "js", "web"))) {
  if (f.endsWith(".js")) bagilYap(path.join(OUT, "app", "expo", "static", "js", "web", f));
}

// Doğrulama: tek bir mutlak yol kalırsa uygulama alt yolda 404 alır ve
// beyaz ekran açılır — sessizce.
const kalan = [];
const tara = (dizin) => {
  for (const g of fs.readdirSync(dizin, { withFileTypes: true })) {
    const tam = path.join(dizin, g.name);
    if (g.isDirectory()) tara(tam);
    else if (/\.(html|js|json)$/.test(g.name)) {
      const s = fs.readFileSync(tam, "utf8");
      if (/"\/(assets|_expo)\//.test(s)) kalan.push(path.relative(OUT, tam));
    }
  }
};
tara(path.join(OUT, "app"));
if (kalan.length) throw new Error(`Mutlak yol kaldı: ${kalan.join(", ")}`);

// ── 3. KABUK ──────────────────────────────────────────────────────────
fs.copyFileSync(KABUK, path.join(OUT, "index.html"));

const say = (d) => fs.readdirSync(d, { withFileTypes: true })
  .reduce((n, g) => n + (g.isDirectory() ? say(path.join(d, g.name)) : 1), 0);
log(`${sayac} dosyanın yolları bağıllandı`);
log(`hazır: ${path.relative(ROOT, OUT)} (${say(OUT)} dosya)`);
