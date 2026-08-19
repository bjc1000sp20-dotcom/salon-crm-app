import { getSignedUrl } from '../lib/data.js';
import { updateArchivePhotoLabel, deleteArchivePhoto } from '../lib/clientArchive.js';

// 紙本歷史資料的大圖檢視器:上一張/下一張、雙擊或雙指縮放、縮放後可拖曳、關閉。
// onChange 在改名/刪除後呼叫,把最新的照片陣列丟回去,讓客戶頁的縮圖網格跟著更新。
export function openArchivePhotoViewer(photos, startIndex, onChange) {
  let index = startIndex;
  let currentPhotos = photos;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  const urlCache = new Map();

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:2000;display:flex;flex-direction:column;';
  document.body.appendChild(overlay);

  async function render() {
    const photo = currentPhotos[index];
    if (!photo) {
      overlay.remove();
      return;
    }
    scale = 1;
    translateX = 0;
    translateY = 0;

    let url = urlCache.get(photo.storage_path);
    if (!url) {
      overlay.innerHTML = `<div style="color:#fff;text-align:center;margin:auto;">載入中...</div>`;
      url = await getSignedUrl('client-archive', photo.storage_path);
      urlCache.set(photo.storage_path, url);
    }

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;color:#fff;">
        <button type="button" id="av-close" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>
        <div style="font-size:13px;color:#D9CFBB;">${index + 1} / ${currentPhotos.length}</div>
        <div style="width:22px;"></div>
      </div>
      <div id="av-image-wrap" style="flex:1;position:relative;overflow:hidden;touch-action:none;display:flex;align-items:center;justify-content:center;">
        <img id="av-image" src="${url}" style="max-width:100%;max-height:100%;transform:scale(${scale}) translate(${translateX}px, ${translateY}px);transition:transform 0.05s;user-select:none;" draggable="false" />
        ${
          currentPhotos.length > 1
            ? `<button type="button" id="av-prev" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.4);border:none;color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;cursor:pointer;">‹</button>
               <button type="button" id="av-next" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.4);border:none;color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;cursor:pointer;">›</button>`
            : ''
        }
      </div>
      <div style="padding:14px;color:#fff;background:rgba(0,0,0,0.5);">
        <div style="font-size:14px;margin-bottom:2px;">${escapeHtml(photo.label || '(未命名)')}</div>
        <div style="font-size:12px;color:#B8AE9A;margin-bottom:10px;">${formatDateTime(photo.created_at)}</div>
        <div style="display:flex;gap:8px;">
          <button type="button" id="av-rename" class="secondary-btn" style="margin-top:0;">重新命名</button>
          <button type="button" id="av-delete" class="secondary-btn" style="margin-top:0;color:#E29B8A;">刪除</button>
        </div>
      </div>
    `;
    bind();
  }

  function bind() {
    document.getElementById('av-close').onclick = () => overlay.remove();

    if (currentPhotos.length > 1) {
      document.getElementById('av-prev').onclick = () => {
        index = (index - 1 + currentPhotos.length) % currentPhotos.length;
        render();
      };
      document.getElementById('av-next').onclick = () => {
        index = (index + 1) % currentPhotos.length;
        render();
      };
    }

    document.getElementById('av-rename').onclick = async () => {
      const current = currentPhotos[index];
      const newLabel = prompt('輸入這張照片的名稱／備註', current.label || '');
      if (newLabel === null) return;
      await updateArchivePhotoLabel(current.id, newLabel);
      currentPhotos = currentPhotos.map((p) => (p.id === current.id ? { ...p, label: newLabel } : p));
      onChange(currentPhotos);
      render();
    };

    document.getElementById('av-delete').onclick = async () => {
      if (!confirm('確定要刪除這張照片嗎?')) return;
      const current = currentPhotos[index];
      await deleteArchivePhoto(current.id, current.storage_path);
      currentPhotos = currentPhotos.filter((p) => p.id !== current.id);
      onChange(currentPhotos);
      if (!currentPhotos.length) {
        overlay.remove();
        return;
      }
      index = Math.min(index, currentPhotos.length - 1);
      render();
    };

    const img = document.getElementById('av-image');
    const wrap = document.getElementById('av-image-wrap');

    function applyTransform() {
      img.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
    }

    img.ondblclick = () => {
      scale = scale === 1 ? 2.5 : 1;
      translateX = 0;
      translateY = 0;
      applyTransform();
    };

    // 單指拖曳:放大後平移,沒放大時當成上一張/下一張的滑動判斷
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startTX = 0;
    let startTY = 0;
    img.onpointerdown = (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTX = translateX;
      startTY = translateY;
      img.setPointerCapture(e.pointerId);
    };
    img.onpointermove = (e) => {
      if (!dragging || scale === 1) return;
      translateX = startTX + (e.clientX - startX) / scale;
      translateY = startTY + (e.clientY - startY) / scale;
      applyTransform();
    };
    img.onpointerup = (e) => {
      if (dragging && scale === 1 && currentPhotos.length > 1) {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 60) {
          index = dx > 0 ? (index - 1 + currentPhotos.length) % currentPhotos.length : (index + 1) % currentPhotos.length;
          render();
        }
      }
      dragging = false;
    };

    // 雙指縮放(手機)
    let pinchStartDist = null;
    let pinchStartScale = 1;
    wrap.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          pinchStartDist = touchDist(e.touches);
          pinchStartScale = scale;
        }
      },
      { passive: true }
    );
    wrap.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && pinchStartDist) {
          e.preventDefault();
          const dist = touchDist(e.touches);
          scale = Math.min(4, Math.max(1, pinchStartScale * (dist / pinchStartDist)));
          applyTransform();
        }
      },
      { passive: false }
    );
    wrap.addEventListener(
      'touchend',
      (e) => {
        if (e.touches.length < 2) pinchStartDist = null;
      },
      { passive: true }
    );
  }

  render();
}

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
