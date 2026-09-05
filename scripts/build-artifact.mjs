// ═══════════════════════════════════════════════════════════════════════
// Artifact derleyici.
//
//   npm run artifact
//
// Tek dosyalık önizleme üretir: dist/gur-preview.html
//
// Bu betik elle yapılan adımların yerini alıyor. Elle yapıldığında
// src/main.jsx'i yamalamak yetmiyordu — depodaki sürüm yönetici panelini
// React.lazy ile yüklüyor, bu da ayrı bir chunk demek ve tek dosyalık
// artifact o dosyayı bulamıyor. Panel sessizce açılmıyordu. Aşağıdaki
// doğrulama tam olarak bunu yakalıyor.
// ═══════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN = path.join(ROOT, "src", "main.jsx");
const BACKUP = path.join(ROOT, "node_modules", ".gur-main-backup.jsx");
const ENTRY = path.join(ROOT, "scripts", "artifact-main.jsx");
const SHELL = path.join(ROOT, "scripts", "artifact-shell.html");
const OUT = path.join(ROOT, "dist", "gur-preview.html");

const log = (...a) => console.log("›", ...a);

function restore() {
  if (fs.existsSync(BACKUP)) {
    fs.copyFileSync(BACKUP, MAIN);
    fs.rmSync(BACKUP);
  }
}

try {
  log("src/main.jsx yedekleniyor");
  fs.copyFileSync(MAIN, BACKUP);

  // Artifact girişi src/ dışında duruyor; içe aktarma yolları bir seviye
  // yukarıyı gösteriyor, kopyalarken düzeltiliyor.
  const entry = fs.readFileSync(ENTRY, "utf8").replace(/\.\.\/src\//g, "./");
  fs.writeFileSync(MAIN, entry);

  log("derleniyor (tek parça)");
  fs.rmSync(path.join(ROOT, "dist"), { recursive: true, force: true });
  execFileSync("npx", ["vite", "build"], {
    cwd: ROOT, stdio: "inherit",
    env: { ...process.env, GUR_ARTIFACT: "1" },
  });

  const assets = path.join(ROOT, "dist", "assets");
  const js = fs.readdirSync(assets).filter(f => f.endsWith(".js"));

  // Asıl kontrol: birden çok JS parçası varsa artifact bozuk demektir.
  if (js.length !== 1) {
    throw new Error(
      `Tek JS dosyası bekleniyordu, ${js.length} bulundu: ${js.join(", ")}\n` +
      `Dinamik import tek parçaya alınamamış — vite.config.js içindeki ` +
      `GUR_ARTIFACT dalını kontrol edin.`);
  }

  const bundle = fs.readFileSync(path.join(assets, js[0]), "utf8");
  if (bundle.includes("</script")) {
    throw new Error("Paket içinde </script kapanışı var; satır içine gömülemez.");
  }

  const shell = fs.readFileSync(SHELL, "utf8");
  const html = `${shell}<script type="module">\n${bundle}\n</script>\n`;
  fs.writeFileSync(OUT, html);

  // İkinci kontrol: gömülü HTML hiçbir yerel dosyaya atıfta bulunmamalı.
  const stray = html.match(/["'`](?:\.\/|\/)?assets\/[A-Za-z0-9._-]+\.js/g);
  if (stray) throw new Error(`HTML hâlâ yerel dosyaya atıf yapıyor: ${stray.join(", ")}`);

  log(`hazır: ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(1)} KB)`);
} finally {
  restore();
  log("src/main.jsx geri alındı");
}
