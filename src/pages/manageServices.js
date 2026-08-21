import {
  listAllServices,
  createService,
  updateService,
  deleteService,
  listUsedServiceIds,
  reorderServices,
  loadServices,
} from '../lib/services.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';

export async function renderManageServices(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">服務項目管理</div>
        ${homeButtonHtml()}
      </div>
      <div class="field-hint" style="padding:14px 20px 0;">拖曳 ☰ 或用上下箭頭調整順序,新增預約、到店紀錄等所有選服務項目的地方都會依這個順序顯示。</div>
      <div class="list-scroll" id="services-list" style="padding-top:10px;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="add-service-btn">＋ 新增服務項目</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = async () => {
    await loadServices(app.salon.id, { force: true });
    if (app.params.returnTo) {
      app.navigate('visitForm', app.params.returnTo);
    } else {
      app.navigate('settings');
    }
  };

  bindHomeButton(app);

  document.getElementById('add-service-btn').onclick = () =>
    openServiceModal(null, async (fields) => {
      await createService(app.salon.id, fields.name);
      await loadList(app);
    });

  await loadList(app);
}

async function loadList(app) {
  const listEl = document.getElementById('services-list');
  if (!listEl) return;

  let services;
  let usedIds;
  try {
    services = await listAllServices(app.salon.id);
    usedIds = await listUsedServiceIds(services.map((s) => s.id));
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  function renderRows() {
    listEl.innerHTML = services.length
      ? services.map((s, idx) => rowHtml(s, idx, services.length, usedIds.has(s.id))).join('')
      : `<div class="empty-state"><div class="empty-body">還沒有任何服務項目</div></div>`;
    bindRowEvents();
  }

  async function persistOrder() {
    try {
      await reorderServices(services.map((s) => s.id));
      await loadServices(app.salon.id, { force: true });
    } catch (err) {
      alert('排序失敗:' + err.message);
    }
  }

  function bindRowEvents() {
    listEl.querySelectorAll('.svc-up-btn').forEach((btn) => {
      btn.onclick = async () => {
        const idx = services.findIndex((s) => s.id === btn.dataset.id);
        if (idx <= 0) return;
        [services[idx - 1], services[idx]] = [services[idx], services[idx - 1]];
        renderRows();
        await persistOrder();
      };
    });
    listEl.querySelectorAll('.svc-down-btn').forEach((btn) => {
      btn.onclick = async () => {
        const idx = services.findIndex((s) => s.id === btn.dataset.id);
        if (idx < 0 || idx >= services.length - 1) return;
        [services[idx + 1], services[idx]] = [services[idx], services[idx + 1]];
        renderRows();
        await persistOrder();
      };
    });
    listEl.querySelectorAll('.svc-rename-btn').forEach((btn) => {
      btn.onclick = () => {
        const s = services.find((x) => x.id === btn.dataset.id);
        openServiceModal(s, async (fields) => {
          await updateService(s.id, { name: fields.name });
          await loadList(app);
        });
      };
    });
    listEl.querySelectorAll('.svc-toggle-btn').forEach((btn) => {
      btn.onclick = async () => {
        const s = services.find((x) => x.id === btn.dataset.id);
        await updateService(s.id, { enabled: !s.enabled });
        await loadList(app);
      };
    });
    listEl.querySelectorAll('.svc-delete-btn').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('確定要刪除這個服務項目嗎?(這個項目從沒被到店紀錄使用過,可以直接刪除)')) return;
        await deleteService(btn.dataset.id);
        await loadList(app);
      };
    });

    // 電腦滑鼠拖曳:原生 HTML5 drag,拖動時只在記憶體裡重排+重畫,放開才真的存檔,避免拖曳過程中一直打 API
    listEl.querySelectorAll('.svc-row').forEach((row) => {
      row.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', row.dataset.id);
        row.classList.add('dragging');
      };
      row.ondragend = async () => {
        row.classList.remove('dragging');
        await persistOrder();
      };
      row.ondragover = (e) => {
        e.preventDefault();
        const draggingEl = listEl.querySelector('.dragging');
        if (!draggingEl || draggingEl === row) return;
        const fromIdx = services.findIndex((s) => s.id === draggingEl.dataset.id);
        const toIdx = services.findIndex((s) => s.id === row.dataset.id);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
        const [moved] = services.splice(fromIdx, 1);
        services.splice(toIdx, 0, moved);
        renderRows();
      };
    });

    // 手機觸控拖曳:只在 ☰ 圖示上監聽,不影響整頁捲動
    listEl.querySelectorAll('.svc-handle').forEach((handle) => {
      handle.onpointerdown = (e) => {
        const row = handle.closest('.svc-row');
        const draggingId = row.dataset.id;
        handle.setPointerCapture(e.pointerId);

        function onMove(ev) {
          const rows = Array.from(listEl.querySelectorAll('.svc-row'));
          const hovered = rows.find((r) => {
            const rect = r.getBoundingClientRect();
            return ev.clientY >= rect.top && ev.clientY <= rect.bottom;
          });
          if (!hovered || hovered.dataset.id === draggingId) return;
          const fromIdx = services.findIndex((s) => s.id === draggingId);
          const toIdx = services.findIndex((s) => s.id === hovered.dataset.id);
          if (fromIdx < 0 || toIdx < 0) return;
          const [moved] = services.splice(fromIdx, 1);
          services.splice(toIdx, 0, moved);
          renderRows();
        }
        async function onUp() {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          await persistOrder();
        }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      };
    });
  }

  renderRows();
}

function rowHtml(s, idx, total, isUsed) {
  return `
    <div class="card svc-row" draggable="true" data-id="${s.id}" style="cursor:default;flex-direction:column;align-items:stretch;margin-bottom:10px;opacity:${s.enabled ? 1 : 0.55};">
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="svc-handle" style="touch-action:none;cursor:grab;font-size:18px;color:#9B8F7F;padding:2px;">☰</span>
        <div style="width:16px;height:16px;border-radius:50%;background:${s.color};flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="card-name">${escapeHtml(s.name)}</div>
          <div class="card-sub">${s.enabled ? '啟用中' : '已停用'}${isUsed ? '・已有歷史紀錄' : '・尚未被使用過'}</div>
        </div>
        <button type="button" class="btn-ghost svc-up-btn" data-id="${s.id}" ${idx === 0 ? 'disabled' : ''} style="padding:4px 10px;">↑</button>
        <button type="button" class="btn-ghost svc-down-btn" data-id="${s.id}" ${idx === total - 1 ? 'disabled' : ''} style="padding:4px 10px;">↓</button>
      </div>
      ${isUsed ? `<div class="field-hint" style="margin-top:6px;">此服務項目已有歷史紀錄,建議改為停用,不提供刪除。</div>` : ''}
      <div class="visit-tags" style="margin-top:10px;">
        <button type="button" class="tag svc-rename-btn" data-id="${s.id}" style="cursor:pointer;border:none;background:#F0EADA;">編輯名稱</button>
        <button type="button" class="tag svc-toggle-btn" data-id="${s.id}" style="cursor:pointer;border:none;background:${s.enabled ? '#F5E3DC' : '#E7EFE4'};color:${s.enabled ? '#B5533C' : '#4E8B5C'};">${s.enabled ? '停用' : '啟用'}</button>
        ${
          isUsed
            ? ''
            : `<button type="button" class="tag svc-delete-btn" data-id="${s.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">刪除</button>`
        }
      </div>
    </div>
  `;
}

function openServiceModal(service, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">${service ? '編輯服務項目' : '新增服務項目'}</div>
      <div class="field">
        <div class="field-label">服務項目名稱</div>
        <input type="text" id="svc-name" value="${escapeAttr(service?.name || '')}" placeholder="例如:修復課程" />
      </div>
      <button class="primary-btn" id="svc-save">儲存</button>
      <button class="secondary-btn" id="svc-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('svc-cancel').onclick = () => overlay.remove();
  document.getElementById('svc-save').onclick = async () => {
    const name = document.getElementById('svc-name').value.trim();
    if (!name) {
      alert('請填寫服務項目名稱');
      return;
    }
    const saveBtn = document.getElementById('svc-save');
    saveBtn.disabled = true;
    try {
      await onSave({ name });
      overlay.remove();
    } catch (err) {
      alert('儲存失敗:' + err.message);
      saveBtn.disabled = false;
    }
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
