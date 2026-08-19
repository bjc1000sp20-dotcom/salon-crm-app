import {
  listAllServices,
  createService,
  updateService,
  deleteService,
  listUsedServiceIds,
  reorderServices,
  loadServices,
} from '../lib/services.js';

export async function renderManageServices(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">編輯服務項目</div>
        <div style="width:38px;"></div>
      </div>
      <div class="list-scroll" id="services-list" style="padding-top:16px;">
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
      app.navigate('clientList');
    }
  };

  document.getElementById('add-service-btn').onclick = async () => {
    const name = prompt('輸入新服務項目的名稱');
    if (!name || !name.trim()) return;
    await createService(app.salon.id, name.trim());
    await loadList(app);
  };

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

  listEl.innerHTML = services.length
    ? services.map((s, idx) => rowHtml(s, idx, services.length, usedIds.has(s.id))).join('')
    : `<div class="empty-state"><div class="empty-body">還沒有任何服務項目</div></div>`;

  listEl.querySelectorAll('.svc-up-btn').forEach((btn) => {
    btn.onclick = async () => {
      const idx = services.findIndex((s) => s.id === btn.dataset.id);
      if (idx <= 0) return;
      [services[idx - 1], services[idx]] = [services[idx], services[idx - 1]];
      await reorderServices(services.map((s) => s.id));
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.svc-down-btn').forEach((btn) => {
    btn.onclick = async () => {
      const idx = services.findIndex((s) => s.id === btn.dataset.id);
      if (idx < 0 || idx >= services.length - 1) return;
      [services[idx + 1], services[idx]] = [services[idx], services[idx + 1]];
      await reorderServices(services.map((s) => s.id));
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.svc-rename-btn').forEach((btn) => {
    btn.onclick = async () => {
      const s = services.find((x) => x.id === btn.dataset.id);
      const name = prompt('修改服務項目名稱', s.name);
      if (!name || !name.trim() || name.trim() === s.name) return;
      await updateService(s.id, { name: name.trim() });
      await loadList(app);
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
}

function rowHtml(s, idx, total, isUsed) {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-bottom:10px;opacity:${s.enabled ? 1 : 0.55};">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:16px;height:16px;border-radius:50%;background:${s.color};flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="card-name">${escapeHtml(s.name)}</div>
          <div class="card-sub">${s.enabled ? '啟用中' : '已停用'}${isUsed ? '' : '・尚未被使用過'}</div>
        </div>
        <button type="button" class="btn-ghost svc-up-btn" data-id="${s.id}" ${idx === 0 ? 'disabled' : ''} style="padding:4px 10px;">↑</button>
        <button type="button" class="btn-ghost svc-down-btn" data-id="${s.id}" ${idx === total - 1 ? 'disabled' : ''} style="padding:4px 10px;">↓</button>
      </div>
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
