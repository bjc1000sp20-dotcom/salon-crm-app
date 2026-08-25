import {
  ensureDefaultMessageTemplates,
  listMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  duplicateMessageTemplate,
  MESSAGE_TEMPLATE_CATEGORIES,
  MESSAGE_TEMPLATE_VARS,
} from '../lib/messageTemplates.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';

export async function renderMessageTemplates(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">LINE 話術管理</div>
        ${homeButtonHtml()}
      </div>
      <div class="list-scroll" id="mt-list" style="padding-top:16px;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="mt-add-btn">＋ 新增話術</button>
      </div>
    </div>
  `;
  document.getElementById('back-btn').onclick = () => app.navigate('lineHub');
  bindHomeButton(app);
  document.getElementById('mt-add-btn').onclick = () =>
    openTemplateModal(null, async (fields) => {
      await createMessageTemplate(app.salon.id, app.session.user.id, fields);
      await loadList(app);
    });

  await loadList(app);
}

async function loadList(app) {
  const listEl = document.getElementById('mt-list');
  if (!listEl) return;

  let templates;
  try {
    templates = await ensureDefaultMessageTemplates(app.salon.id);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  listEl.innerHTML = templates.length
    ? templates.map((t) => templateRowHtml(t)).join('')
    : `<div class="empty-state"><div class="empty-body">還沒有任何話術模板</div></div>`;

  listEl.querySelectorAll('.mt-star-btn').forEach((btn) => {
    btn.onclick = async () => {
      const t = templates.find((x) => x.id === btn.dataset.id);
      await updateMessageTemplate(t.id, { is_favorite: !t.is_favorite });
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.mt-edit-btn').forEach((btn) => {
    btn.onclick = () => {
      const t = templates.find((x) => x.id === btn.dataset.id);
      openTemplateModal(t, async (fields) => {
        await updateMessageTemplate(t.id, fields);
        await loadList(app);
      });
    };
  });
  listEl.querySelectorAll('.mt-dup-btn').forEach((btn) => {
    btn.onclick = async () => {
      const t = templates.find((x) => x.id === btn.dataset.id);
      await duplicateMessageTemplate(app.salon.id, app.session.user.id, t);
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.mt-toggle-btn').forEach((btn) => {
    btn.onclick = async () => {
      const t = templates.find((x) => x.id === btn.dataset.id);
      await updateMessageTemplate(t.id, { enabled: t.enabled === false });
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.mt-delete-btn').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('確定要刪除這則話術嗎?')) return;
      await deleteMessageTemplate(btn.dataset.id);
      await loadList(app);
    };
  });
}

function templateRowHtml(t) {
  const preview = t.message.length > 40 ? t.message.slice(0, 40) + '…' : t.message;
  const lastModified = (t.updated_at || t.created_at || '').slice(0, 10);
  const enabled = t.enabled !== false;
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-bottom:10px;opacity:${enabled ? 1 : 0.55};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="card-name">${t.is_favorite ? '⭐ ' : ''}${escapeHtml(t.name)}${enabled ? '' : '(已停用)'}</div>
          <div class="card-sub">${escapeHtml(t.category)}</div>
        </div>
        <button type="button" class="btn-ghost mt-star-btn" data-id="${t.id}" style="font-size:18px;padding:4px 8px;">${t.is_favorite ? '★' : '☆'}</button>
      </div>
      <div class="visit-note" style="margin:8px 0;">${escapeHtml(preview)}</div>
      <div class="field-hint" style="margin-bottom:8px;">最後修改:${lastModified}</div>
      <div class="visit-tags">
        <button type="button" class="tag mt-edit-btn" data-id="${t.id}" style="cursor:pointer;border:none;background:#F0EADA;">編輯</button>
        <button type="button" class="tag mt-dup-btn" data-id="${t.id}" style="cursor:pointer;border:none;background:#EDE7F5;">複製</button>
        <button type="button" class="tag mt-toggle-btn" data-id="${t.id}" style="cursor:pointer;border:none;background:${enabled ? '#F5E3DC' : '#E7EFE4'};color:${enabled ? '#B5533C' : '#4E8B5C'};">${enabled ? '停用' : '啟用'}</button>
        <button type="button" class="tag mt-delete-btn" data-id="${t.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">刪除</button>
      </div>
    </div>
  `;
}

function openTemplateModal(template, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-height:85vh;overflow-y:auto;">
      <div class="modal-title">${template ? '編輯話術' : '新增話術'}</div>
      <div class="field">
        <div class="field-label">模板名稱</div>
        <input type="text" id="mt-name" value="${escapeAttr(template?.name || '')}" placeholder="例如:做臉後第 3 天追蹤" />
      </div>
      <div class="field">
        <div class="field-label">分類</div>
        <input type="text" id="mt-category" list="mt-category-options" value="${escapeAttr(template?.category || MESSAGE_TEMPLATE_CATEGORIES[0])}" />
        <datalist id="mt-category-options">
          ${MESSAGE_TEMPLATE_CATEGORIES.map((c) => `<option value="${escapeAttr(c)}"></option>`).join('')}
        </datalist>
      </div>
      <div class="field">
        <div class="field-label">訊息內容</div>
        <textarea id="mt-message" rows="4">${escapeHtml(template?.message || '')}</textarea>
        <div class="field-hint" style="margin-top:6px;">可用變數(發送時自動代入):${MESSAGE_TEMPLATE_VARS.map((v) => v.token).join('、')}</div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin:6px 0 10px;">
        <input type="checkbox" id="mt-favorite" ${template?.is_favorite ? 'checked' : ''} />
        <span>設為常用(排在列表最前面)</span>
      </label>
      <button class="primary-btn" id="mt-save">儲存</button>
      <button class="secondary-btn" id="mt-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('mt-cancel').onclick = () => overlay.remove();
  document.getElementById('mt-save').onclick = async () => {
    const name = document.getElementById('mt-name').value.trim();
    const category = document.getElementById('mt-category').value.trim() || MESSAGE_TEMPLATE_CATEGORIES[0];
    const message = document.getElementById('mt-message').value.trim();
    const is_favorite = document.getElementById('mt-favorite').checked;
    if (!name || !message) {
      alert('請填寫模板名稱與訊息內容');
      return;
    }
    const saveBtn = document.getElementById('mt-save');
    saveBtn.disabled = true;
    try {
      await onSave({ name, category, message, is_favorite });
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
