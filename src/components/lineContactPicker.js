import { listAllLineContactsWithStatus, matchLineContact, syncLineContacts } from '../lib/lineIntegration.js';

// 選擇一位 LINE 聯絡人綁定到指定客戶。列出全部聯絡人(含已綁定的,標示狀態防止選錯),
// 選擇前先跳確認彈窗。onDone 在配對成功後呼叫,方便重新整理畫面。
export async function openLineContactPicker(app, client, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-height:85vh;overflow-y:auto;">
      <div class="modal-title">選擇 LINE 聯絡人 —— ${escapeHtml(client.name)}</div>
      <div class="field" style="margin-bottom:10px;">
        <input type="text" id="picker-search" placeholder="搜尋 LINE 名稱或已綁定的客戶姓名" />
      </div>
      <button type="button" class="btn-ghost" id="picker-sync-btn" style="margin-bottom:10px;">🔄 重新同步 LINE 聯絡人</button>
      <div id="contact-list">${loadingHtml()}</div>
      <button class="secondary-btn" id="picker-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('picker-cancel').onclick = () => overlay.remove();

  const listEl = document.getElementById('contact-list');
  let contacts = [];

  async function loadContacts() {
    listEl.innerHTML = loadingHtml();
    try {
      contacts = await listAllLineContactsWithStatus(app.salon.id);
      renderList(document.getElementById('picker-search').value.trim());
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `<div class="empty-body">讀取失敗:${escapeHtml(err.message)}</div>`;
    }
  }

  function renderList(search) {
    const q = (search || '').toLowerCase();
    const filtered = q
      ? contacts.filter(
          (c) =>
            (c.display_name || '').toLowerCase().includes(q) ||
            (c.matchedClientName || '').toLowerCase().includes(q)
        )
      : contacts;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-body">${
        contacts.length ? '找不到符合的聯絡人' : '目前沒有任何 LINE 互動紀錄。請先請這位客人加官方帳號好友、傳一句話,幾秒後這裡就會出現。'
      }</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((c) => contactRowHtml(c)).join('');

    listEl.querySelectorAll('.picker-select-row').forEach((row) => {
      row.onclick = () => {
        const contact = contacts.find((c) => c.id === row.dataset.id);
        if (!contact) return;
        openConfirmMatchModal(client, contact, async () => {
          try {
            await matchLineContact(contact.id, contact.line_user_id, client.id, app.salon.id);
            overlay.remove();
            if (onDone) onDone();
          } catch (err) {
            console.error(err);
            alert('配對失敗:' + err.message);
          }
        });
      };
    });
  }

  document.getElementById('picker-sync-btn').onclick = async () => {
    const btn = document.getElementById('picker-sync-btn');
    btn.disabled = true;
    btn.textContent = '同步中...';
    try {
      await syncLineContacts();
      await loadContacts();
    } catch (err) {
      alert('同步失敗:' + err.message);
    }
    btn.disabled = false;
    btn.textContent = '🔄 重新同步 LINE 聯絡人';
  };

  let debounceTimer;
  document.getElementById('picker-search').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const value = e.target.value;
    debounceTimer = setTimeout(() => renderList(value.trim()), 200);
  });

  await loadContacts();
}

function contactRowHtml(c) {
  const isMatched = !!c.matched_client_id;
  const name = c.display_name || c.last_message_text || '(尚未取得名稱)';
  const avatarHtml = c.picture_url
    ? `<img src="${c.picture_url}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;" />`
    : `<div style="width:44px;height:44px;border-radius:50%;background:#D9CFBB;display:flex;align-items:center;justify-content:center;font-weight:700;color:#3A332B;flex-shrink:0;">${escapeHtml((name || '?').slice(0, 1))}</div>`;

  const inner = `
    ${avatarHtml}
    <div style="flex:1;text-align:left;">
      <div class="card-name">${escapeHtml(name)}</div>
      <div class="card-sub">最近互動:${formatDateTime(c.last_event_at)}</div>
    </div>
  `;

  if (isMatched) {
    return `
      <div class="card" style="width:100%;cursor:default;gap:10px;margin-bottom:8px;">
        ${inner}
        <span class="tag" style="background:#EDE7DA;color:#9B8F7F;white-space:nowrap;">已綁定:${escapeHtml(c.matchedClientName || '其他客戶')}</span>
      </div>
    `;
  }

  return `
    <div class="card picker-select-row" data-id="${c.id}" style="width:100%;gap:10px;cursor:pointer;margin-bottom:8px;">
      ${inner}
      <button type="button" class="secondary-btn" style="width:auto;margin-top:0;padding:8px 14px;pointer-events:none;">選擇</button>
    </div>
  `;
}

function openConfirmMatchModal(client, contact, onConfirm) {
  const name = contact.display_name || contact.last_message_text || '(尚未取得名稱)';
  const avatarHtml = contact.picture_url
    ? `<img src="${contact.picture_url}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;margin:0 auto 6px;display:block;" />`
    : `<div style="width:56px;height:56px;border-radius:50%;background:#D9CFBB;display:flex;align-items:center;justify-content:center;font-weight:700;color:#3A332B;margin:0 auto 6px;">${escapeHtml((name || '?').slice(0, 1))}</div>`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">確認綁定</div>
      <div class="field-hint" style="margin-bottom:16px;">確定要將這個 LINE 聯絡人綁定到「${escapeHtml(client.name)}」嗎?</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:18px;">
        <div style="text-align:center;">
          <div class="card-sub" style="margin-bottom:4px;">CRM 客戶</div>
          <div class="card-name">${escapeHtml(client.name)}</div>
        </div>
        <div style="font-size:20px;color:#B8AE9A;">→</div>
        <div style="text-align:center;">
          ${avatarHtml}
          <div class="card-name">${escapeHtml(name)}</div>
        </div>
      </div>
      <button class="primary-btn" id="confirm-match-btn">確認綁定</button>
      <button class="secondary-btn" id="cancel-match-btn">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('cancel-match-btn').onclick = () => overlay.remove();
  document.getElementById('confirm-match-btn').onclick = async () => {
    const btn = document.getElementById('confirm-match-btn');
    btn.disabled = true;
    btn.textContent = '綁定中...';
    await onConfirm();
    overlay.remove();
  };
}

function loadingHtml() {
  return `<div style="text-align:center;color:#9B8F7F;padding:20px 0;">載入中...</div>`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
