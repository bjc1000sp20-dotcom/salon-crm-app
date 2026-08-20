// 工作室資訊圖片的全螢幕放大檢視,保持原比例;分享按鈕只在瀏覽器支援分享圖片檔案時才顯示
export function openStudioInfoViewer(url) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:20px;';
  overlay.innerHTML = `
    <img src="${url}" style="max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px;" />
    <div style="display:flex;gap:10px;">
      <button type="button" class="secondary-btn" id="studio-info-share-btn" style="display:none;">分享圖片</button>
      <button type="button" class="secondary-btn" id="studio-info-viewer-close-btn">關閉</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  document.getElementById('studio-info-viewer-close-btn').onclick = () => overlay.remove();

  const shareBtn = document.getElementById('studio-info-share-btn');
  if (navigator.share) {
    shareBtn.style.display = '';
    shareBtn.onclick = async () => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], 'studio-info.jpg', { type: blob.type || 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          alert('這個瀏覽器不支援分享圖片檔案');
        }
      } catch (err) {
        if (err.name !== 'AbortError') alert('分享失敗:' + err.message);
      }
    };
  }
}
