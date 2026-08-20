// 工作室資訊圖片的多張放大檢視器:上一張/下一張、雙擊或雙指縮放、縮放後可拖曳、關閉。
// images 是已經解析好簽名網址的陣列 [{ name, url }, ...],startIndex 是一開始要看第幾張。
export function openStudioInfoViewer(images, startIndex = 0) {
  let index = startIndex;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:2000;display:flex;flex-direction:column;';
  document.body.appendChild(overlay);

  function render() {
    const img0 = images[index];
    if (!img0) {
      overlay.remove();
      return;
    }
    scale = 1;
    translateX = 0;
    translateY = 0;

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px;color:#fff;">
        <button type="button" id="siv-close" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>
        <div style="font-size:13px;color:#D9CFBB;">${escapeHtml(img0.name || '')}${images.length > 1 ? `　${index + 1} / ${images.length}` : ''}</div>
        <div style="width:22px;"></div>
      </div>
      <div id="siv-image-wrap" style="flex:1;position:relative;overflow:hidden;touch-action:none;display:flex;align-items:center;justify-content:center;">
        <img id="siv-image" src="${img0.url}" style="max-width:100%;max-height:100%;transform:scale(${scale}) translate(${translateX}px, ${translateY}px);transition:transform 0.05s;user-select:none;" draggable="false" />
        ${
          images.length > 1
            ? `<button type="button" id="siv-prev" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.4);border:none;color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;cursor:pointer;">‹</button>
               <button type="button" id="siv-next" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.4);border:none;color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;cursor:pointer;">›</button>`
            : ''
        }
      </div>
    `;
    bind();
  }

  function bind() {
    document.getElementById('siv-close').onclick = () => overlay.remove();
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    if (images.length > 1) {
      document.getElementById('siv-prev').onclick = () => {
        index = (index - 1 + images.length) % images.length;
        render();
      };
      document.getElementById('siv-next').onclick = () => {
        index = (index + 1) % images.length;
        render();
      };
    }

    const img = document.getElementById('siv-image');
    const wrap = document.getElementById('siv-image-wrap');

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
      if (dragging && scale === 1 && images.length > 1) {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 60) {
          index = dx > 0 ? (index - 1 + images.length) % images.length : (index + 1) % images.length;
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
