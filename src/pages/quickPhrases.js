import {
  listAllQuickPhrases,
  createQuickPhrase,
  updateQuickPhrase,
  deleteQuickPhrase,
  reorderQuickPhrases,
} from '../lib/quickPhrases.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';

export async function renderQuickPhrases(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">常用話語管理</div>
        ${homeButtonHtml()}
      </div>
      <div class="list-scroll" id="qp-list" style="padding-top:16px;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="qp-add-btn">＋ 新增常用話語</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('settings');
  bindHomeButton(app);

  document.getElementById('qp-add-btn').onclick = () =>
    openQuickPhraseModal(null, async (fields) => {
      await createQuickPhrase(app.salon.id, fields.name, fields.content);
      await loadList(app);
    });

  await loadList(app);
}

async function loadList(app) {
  const listEl = document.getElementById('qp-list');
  if (!listEl) return;

  let phrases;
  try {
    phrases = await listAllQuickPhrases(app.salon.id);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  listEl.innerHTML = phrases.length
    ? phrases.map((p, idx) => rowHtml(p, idx, phrases.length)).join('')
    : `<div class="empty-state"><div class="empty-body">還沒有任何常用話語</div></div>`;

  listEl.querySelectorAll('.qp-up-btn').forEach((btn) => {
    btn.onclick = async () => {
      const idx = phrases.findIndex((p) => p.id === btn.dataset.id);
      if (idx <= 0) return;
      [phrases[idx - 1], phrases[idx]] = [phrases[idx], phrases[idx - 1]];
      await reorderQuickPhrases(phrases.map((p) => p.id));
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.qp-down-btn').forEach((btn) => {
    btn.onclick = async () => {
      const idx = phrases.findIndex((p) => p.id === btn.dataset.id);
      if (idx < 0 || idx >= phrases.length - 1) return;
      [phrases[idx + 1], phrases[idx]] = [phrases[idx], phrases[idx + 1]];
      await reorderQuickPhrases(phrases.map((p) => p.id));
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.qp-edit-btn').forEach((btn) => {
    btn.onclick = () => {
      const p = phrases.find((x) => x.id === btn.dataset.id);
      openQuickPhraseModal(p, async (fields) => {
        await updateQuickPhrase(p.id, fields);
        await loadList(app);
      });
    };
  });
  listEl.querySelectorAll('.qp-toggle-btn').forEach((btn) => {
    btn.onclick = async () => {
      const p = phrases.find((x) => x.id === btn.dataset.id);
      await updateQuickPhrase(p.id, { enabled: !p.enabled });
      await loadList(app);
    };
  });
  listEl.querySelectorAll('.qp-delete-btn').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('確定要刪除這則常用話語嗎?')) return;
      await deleteQuickPhrase(btn.dataset.id);
      await loadList(app);
    };
  });
}

function rowHtml(p, idx, total) {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-bottom:10px;opacity:${p.enabled ? 1 : 0.55};">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;">
          <div class="card-name">${escapeHtml(p.name)}</div>
          <div class="card-sub">${p.enabled ? '啟用中' : '已停用'}</div>
        </div>
        <button type="button" class="btn-ghost qp-up-btn" data-id="${p.id}" ${idx === 0 ? 'disabled' : ''} style="padding:4px 10px;">↑</button>
        <button type="button" class="btn-ghost qp-down-btn" data-id="${p.id}" ${idx === total - 1 ? 'disabled' : ''} style="padding:4px 10px;">↓</button>
      </div>
      <div class="visit-note" style="margin:8px 0;">${escapeHtml(p.content)}</div>
      <div class="visit-tags">
        <button type="button" class="tag qp-edit-btn" data-id="${p.id}" style="cursor:pointer;border:none;background:#F0EADA;">編輯</button>
        <button type="button" class="tag qp-toggle-btn" data-id="${p.id}" style="cursor:pointer;border:none;background:${p.enabled ? '#F5E3DC' : '#E7EFE4'};color:${p.enabled ? '#B5533C' : '#4E8B5C'};">${p.enabled ? '停用' : '啟用'}</button>
        <button type="button" class="tag qp-delete-btn" data-id="${p.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">刪除</button>
      </div>
    </div>
  `;
}

function openQuickPhraseModal(phrase, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">${phrase ? '編輯常用話語' : '新增常用話語'}</div>
      <div class="field">
        <div class="field-label">話語名稱</div>
        <input type="text" id="qp-name" value="${escapeAttr(phrase?.name || '')}" placeholder="例如:不需提早到" />
      </div>
      <div class="field">
        <div class="field-label">話語內容</div>
        <textarea id="qp-content" rows="3" placeholder="例如:不用提早到,依照預約時間到就可以囉～">${escapeHtml(phrase?.content || '')}</textarea>
      </div>
      <button class="primary-btn" id="qp-save">儲存</button>
      <button class="secondary-btn" id="qp-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('qp-cancel').onclick = () => overlay.remove();
  document.getElementById('qp-save').onclick = async () => {
    const name = document.getElementById('qp-name').value.trim();
    const content = document.getElementById('qp-content').value.trim();
    if (!name || !content) {
      alert('請填寫話語名稱與內容');
      return;
    }
    const saveBtn = document.getElementById('qp-save');
    saveBtn.disabled = true;
    try {
      await onSave({ name, content });
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
