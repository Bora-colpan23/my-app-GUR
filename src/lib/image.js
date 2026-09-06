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
