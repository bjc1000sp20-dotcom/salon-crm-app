import {
  ensureDefaultLeadStatuses,
  createLeadStatus,
  updateLeadStatus,
  deleteLeadStatus,
  reorderLeadStatuses,
} from '../lib/leadStatuses.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';

export async function renderLeadStatuses(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">追蹤狀態管理</div>
        ${homeButtonHtml()}
      </div>
      <div class="list-scroll" id="ls-list" style="padding-top:16px;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="ls-add-btn">＋ 新增追蹤狀態</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('settings');
  bindHomeButton(app);

  document.getElementById('ls-add-btn').onclick = () =>
    openLeadStatusModal(null, async (fields) => {
      await createLeadStatus(app.salon.id, fields.name);
      await loadList(app);
    });

  await loadList(app);
}

async function loadList(app) {
  const listEl = document.getElementById('ls-list');
  if (!listEl) return;

  let statuses;
  try {
    statuses = await ensureDefaultLeadStatuses(app.salon.id);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  listEl.innerHTML = statuses.length
    ? statuses.map((s, idx) => rowHtml(s, idx, statuses.length)).join('')
    : `<div class="empty-state"><div class="empty-body">還沒有任何追蹤狀態</div></div>`;

  listEl.querySelectorAll('.ls-up-btn').forEach((btn) => {
    btn.onclick = async () => {
      const idx = statuses.findIndex((s) => s.id === btn.dataset.id);
      if (idx <= 0) return;
      [statuses[idx - 1], statuses[idx]] = [statuses[idx], statuses[idx - 1]];
      await reorderLeadStatuses(statuses.map((s) => s.id));
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.ls-down-btn').forEach((btn) => {
    btn.onclick = async () => {
      const idx = statuses.findIndex((s) => s.id === btn.dataset.id);
      if (idx < 0 || idx >= statuses.length - 1) return;
      [statuses[idx + 1], statuses[idx]] = [statuses[idx], statuses[idx + 1]];
      await reorderLeadStatuses(statuses.map((s) => s.id));
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.ls-edit-btn').forEach((btn) => {
    btn.onclick = () => {
      const s = statuses.find((x) => x.id === btn.dataset.id);
      openLeadStatusModal(s, async (fields) => {
        await updateLeadStatus(s.id, fields);
        await loadList(app);
      });
    };
  });
  listEl.querySelectorAll('.ls-toggle-btn').forEach((btn) => {
    btn.onclick = async () => {
      const s = statuses.find((x) => x.id === btn.dataset.id);
      await updateLeadStatus(s.id, { enabled: !s.enabled });
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.ls-delete-btn').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('確定要刪除這個追蹤狀態嗎?')) return;
      await deleteLeadStatus(btn.dataset.id);
      await loadList(app);
    };
  });
}

function rowHtml(s, idx, total) {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-bottom:10px;opacity:${s.enabled ? 1 : 0.55};">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;">
          <div class="card-name">${escapeHtml(s.name)}</div>
          <div class="card-sub">${s.enabled ? '啟用中' : '已停用'}</div>
        </div>
        <button type="button" class="btn-ghost ls-up-btn" data-id="${s.id}" ${idx === 0 ? 'disabled' : ''} style="padding:4px 10px;">↑</button>
        <button type="button" class="btn-ghost ls-down-btn" data-id="${s.id}" ${idx === total - 1 ? 'disabled' : ''} style="padding:4px 10px;">↓</button>
      </div>
      <div class="visit-tags" style="margin-top:10px;">
        <button type="button" class="tag ls-edit-btn" data-id="${s.id}" style="cursor:pointer;border:none;background:#F0EADA;">編輯</button>
        <button type="button" class="tag ls-toggle-btn" data-id="${s.id}" style="cursor:pointer;border:none;background:${s.enabled ? '#F5E3DC' : '#E7EFE4'};color:${s.enabled ? '#B5533C' : '#4E8B5C'};">${s.enabled ? '停用' : '啟用'}</button>
        <button type="button" class="tag ls-delete-btn" data-id="${s.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">刪除</button>
      </div>
    </div>
  `;
}

function openLeadStatusModal(status, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">${status ? '編輯追蹤狀態' : '新增追蹤狀態'}</div>
      <div class="field">
        <div class="field-label">狀態名稱</div>
        <input type="text" id="ls-name" value="${escapeAttr(status?.name || '')}" placeholder="例如:待付訂金" />
      </div>
      <button class="primary-btn" id="ls-save">儲存</button>
      <button class="secondary-btn" id="ls-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('ls-cancel').onclick = () => overlay.remove();
  document.getElementById('ls-save').onclick = async () => {
    const name = document.getElementById('ls-name').value.trim();
    if (!name) {
      alert('請填寫狀態名稱');
      return;
    }
    const saveBtn = document.getElementById('ls-save');
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
