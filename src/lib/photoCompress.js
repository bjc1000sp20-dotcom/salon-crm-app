// 沿用原型 compressImage() 的壓縮邏輯(長邊壓到 maxSize、JPEG quality),
// 但改成回傳 Blob(Promise 版本),方便直接上傳到 Supabase Storage,而不是存 base64 字串。
export function compressImage(file, maxSize = 900, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxSize) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        } else if (h > maxSize) {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('壓縮失敗'))), 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('圖片讀取失敗'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsDataURL(file);
  });
}
