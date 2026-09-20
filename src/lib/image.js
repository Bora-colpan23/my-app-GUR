// ═══════════════════════════════════════════════════════════════════════
// GÖRSEL YARDIMCILARI
//
// Yüklenen logo hem işletme panelinde hem yönetici panelinde görünmeli.
// İki rota ayrı sayfa olarak açıldığı için blob URL'i (URL.createObjectURL)
// işe yaramaz: yalnızca onu üreten belgede geçerlidir ve sayfa yenilenince
// ölür. Bu yüzden logo küçültülüp data URL olarak saklanıyor — depoya
// sığacak kadar küçük, her yerde okunabilecek kadar taşınabilir.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Dosyayı kare bir tuvale ortalayıp küçültür ve data URL döndürür.
 * box: kenar uzunluğu (px). Şeffaflık korunsun diye PNG.
 */
export function fileToSquareDataUrl(file, box = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) {
      reject(new Error("Yalnızca görsel yüklenebilir"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = box;
        canvas.height = box;
        const ctx = canvas.getContext("2d");
        // Kısa kenardan kırp: logo kutuya sığsın ama ezilmesin
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, box, box);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Görsel okunamadı")); };
    img.src = url;
  });
}

/**
 * Dosyayı en-boy oranını KORUYARAK küçültür ve JPEG data URL döndürür.
 *
 * Logo karedir, menü sayfası dik, mekan fotoğrafı yatay — kare kırpma
 * ikisini de bozardı. Burada uzun kenar `maxEdge`e iniyor, oran duruyor.
 *
 * Neden küçültüyoruz: dosyalar data URL olarak localStorage'a yazılıyor
 * (sunucu yok) ve tarayıcı kotası ~5 MB. Küçültmeden üç telefon
 * fotoğrafı kotayı doldurup DÖRDÜNCÜ yüklemeyi hataya düşürüyordu.
 * Base64 ham boyutu ayrıca ~%33 şişiriyor.
 *
 * JPEG çünkü menü ve mekan fotoğrafı fotografik: aynı görsel PNG olarak
 * beş kat yer kaplıyordu. Şeffaflık gerektiren logo PNG yolunda kalıyor.
 */
export function fileToFittedDataUrl(file, maxEdge = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) {
      reject(new Error("Yalnızca görsel küçültülebilir"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const oran = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * oran));
        const h = Math.max(1, Math.round(img.height * oran));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        // JPEG'in saydamlık kanalı yok: boş bırakılırsa saydam pikseller
        // siyaha düşüyor. Beyaz zemin menü taramasında doğru olan.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) { reject(err); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Görsel okunamadı")); };
    img.src = url;
  });
}
