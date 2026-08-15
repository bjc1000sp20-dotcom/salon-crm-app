// 沿用原型 setupSignaturePad() 的手繪簽名邏輯,改成回傳 Blob(給 Supabase Storage 上傳用)
// 而不是 base64 dataURL。
// 支援用 prefix 參數區分多組簽名板(例如客戶簽名 + 同意書簽名要同時出現在同一頁時)。
export function signaturePadHtml(prefix = 'sig') {
  return `
    <div class="sig-wrap" id="${prefix}-wrap">
      <canvas id="${prefix}-canvas"></canvas>
      <div class="sig-placeholder" id="${prefix}-placeholder">請在此手指簽名</div>
    </div>
    <div class="sig-actions">
      <button type="button" class="sig-clear" id="${prefix}-clear">清除重簽</button>
      <span class="sig-status" id="${prefix}-status"></span>
    </div>
  `;
}

export function setupSignaturePad(prefix = 'sig') {
  const canvas = document.getElementById(`${prefix}-canvas`);
  const placeholder = document.getElementById(`${prefix}-placeholder`);
  const clearBtn = document.getElementById(`${prefix}-clear`);
  const statusEl = document.getElementById(`${prefix}-status`);
  const ctx = canvas.getContext('2d');

  let hasStroke = false;
  let drawing = false;
  let last = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2E2820';
  }
  resize();

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing = true;
    last = pointFromEvent(e);
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
    if (!hasStroke) {
      hasStroke = true;
      placeholder.classList.add('hidden');
      statusEl.textContent = '已簽名';
    }
  }
  function end() {
    drawing = false;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke = false;
    placeholder.classList.remove('hidden');
    statusEl.textContent = '';
  });

  return {
    hasStroke: () => hasStroke,
    getBlob: () =>
      new Promise((resolve) => {
        if (!hasStroke) return resolve(null);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
      }),
  };
}
