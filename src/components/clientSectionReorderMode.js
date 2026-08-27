import { updateSalon } from '../lib/data.js';
import { CLIENT_SECTION_TITLES, computeClientSectionOrder } from '../lib/clientSectionOrder.js';

// 客戶欄位/區塊排序畫面,「新增客戶」與「客戶詳情頁」共用同一份(比照 settings.js 的排序系統)。
// returnTo = { view, params } 決定取消/儲存完成後要導回哪一頁——
// 詳情頁傳 { view: 'clientDetail', params: { clientId } },新增客戶頁傳 { view: 'clientForm', params: app.params }。
export function renderClientSectionReorderMode(app, { returnTo }) {
  let workingOrder = computeClientSectionOrder(app);

  function render() {
    app.root.innerHTML = `
      <div class="screen">
        <div class="form-header">
          <button class="icon-btn" id="cdreorder-cancel-btn">←</button>
          <div class="form-header-title">調整欄位順序</div>
          <div style="width:38px;"></div>
        </div>
        <div class="list-scroll" style="padding-top:16px;">
          <div class="field-hint" style="margin-bottom:12px;">拖曳 ☰ 或用上下箭頭調整順序,完成後記得按【儲存排序】。這個順序全店共用,新增客戶頁面跟客戶詳情頁、所有裝置都會套用同一份。</div>
          <div id="cdreorder-list">
            ${workingOrder.map((key, idx) => reorderRowHtml(key, idx, workingOrder.length)).join('')}
          </div>
          <button type="button" class="primary-btn" id="cdreorder-save-btn" style="margin-top:16px;">儲存排序</button>
          <button type="button" class="secondary-btn" id="cdreorder-cancel-btn2">取消</button>
          <button type="button" class="secondary-btn" id="cdreorder-reset-btn">恢復預設排序</button>
        </div>
      </div>
    `;
    bind();
  }

  function bind() {
    document.getElementById('cdreorder-cancel-btn').onclick = () => app.navigate(returnTo.view, returnTo.params);
    document.getElementById('cdreorder-cancel-btn2').onclick = () => app.navigate(returnTo.view, returnTo.params);

    document.getElementById('cdreorder-save-btn').onclick = async () => {
      const saveBtn = document.getElementById('cdreorder-save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = '儲存中...';
      try {
        const updated = await updateSalon(app.salon.id, { client_detail_section_order: workingOrder });
        app.salon = updated;
        app.navigate(returnTo.view, returnTo.params);
      } catch (err) {
        alert('儲存失敗:' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存排序';
      }
    };

    document.getElementById('cdreorder-reset-btn').onclick = async () => {
      if (!confirm('確定要恢復預設順序嗎?')) return;
      try {
        const updated = await updateSalon(app.salon.id, { client_detail_section_order: null });
        app.salon = updated;
        app.navigate(returnTo.view, returnTo.params);
      } catch (err) {
        alert('操作失敗:' + err.message);
      }
    };

    const listEl = document.getElementById('cdreorder-list');

    listEl.querySelectorAll('.cdreorder-up-btn').forEach((btn) => {
      btn.onclick = () => {
        const idx = workingOrder.indexOf(btn.dataset.key);
        if (idx <= 0) return;
        [workingOrder[idx - 1], workingOrder[idx]] = [workingOrder[idx], workingOrder[idx - 1]];
        render();
      };
    });
    listEl.querySelectorAll('.cdreorder-down-btn').forEach((btn) => {
      btn.onclick = () => {
        const idx = workingOrder.indexOf(btn.dataset.key);
        if (idx < 0 || idx >= workingOrder.length - 1) return;
        [workingOrder[idx + 1], workingOrder[idx]] = [workingOrder[idx], workingOrder[idx + 1]];
        render();
      };
    });

    // 電腦滑鼠拖曳:原生 HTML5 drag
    listEl.querySelectorAll('.cdreorder-row').forEach((row) => {
      row.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', row.dataset.key);
        row.classList.add('dragging');
      };
      row.ondragend = () => row.classList.remove('dragging');
      row.ondragover = (e) => {
        e.preventDefault();
        const draggingEl = listEl.querySelector('.dragging');
        if (!draggingEl) return;
        const draggingKey = draggingEl.dataset.key;
        if (draggingKey === row.dataset.key) return;
        const fromIdx = workingOrder.indexOf(draggingKey);
        const toIdx = workingOrder.indexOf(row.dataset.key);
        if (fromIdx < 0 || toIdx < 0) return;
        workingOrder.splice(fromIdx, 1);
        workingOrder.splice(toIdx, 0, draggingKey);
        render();
      };
    });

    // 手機觸控拖曳:只在 ☰ 圖示上監聽,不影響整頁捲動
    listEl.querySelectorAll('.cdreorder-handle').forEach((handle) => {
      handle.onpointerdown = (e) => {
        const row = handle.closest('.cdreorder-row');
        const draggingKey = row.dataset.key;
        handle.setPointerCapture(e.pointerId);

        function onMove(ev) {
          const rows = Array.from(listEl.querySelectorAll('.cdreorder-row'));
          const hovered = rows.find((r) => {
            const rect = r.getBoundingClientRect();
            return ev.clientY >= rect.top && ev.clientY <= rect.bottom;
          });
          if (!hovered || hovered.dataset.key === draggingKey) return;
          const fromIdx = workingOrder.indexOf(draggingKey);
          const toIdx = workingOrder.indexOf(hovered.dataset.key);
          if (fromIdx < 0 || toIdx < 0) return;
          workingOrder.splice(fromIdx, 1);
          workingOrder.splice(toIdx, 0, draggingKey);
          render();
        }
        function onUp() {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
        }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      };
    });
  }

  render();
}

function reorderRowHtml(key, idx, total) {
  return `
    <div class="card cdreorder-row" draggable="true" data-key="${key}" style="cursor:default;align-items:center;gap:10px;margin-bottom:8px;">
      <span class="cdreorder-handle" style="touch-action:none;cursor:grab;font-size:20px;color:#9B8F7F;padding:4px;">☰</span>
      <div style="flex:1;">${escapeHtml(CLIENT_SECTION_TITLES[key] || key)}</div>
      <button type="button" class="btn-ghost cdreorder-up-btn" data-key="${key}" ${idx === 0 ? 'disabled' : ''} style="padding:4px 10px;">↑</button>
      <button type="button" class="btn-ghost cdreorder-down-btn" data-key="${key}" ${idx === total - 1 ? 'disabled' : ''} style="padding:4px 10px;">↓</button>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
