import { listUnmatchedLineContacts, matchLineContact } from '../lib/lineIntegration.js';

// 選擇一個「還沒配對的 LINE 聯絡人」綁定到指定客戶。onDone 在配對成功後呼叫,方便重新整理畫面。
export async function openLineContactPicker(app, client, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-height:80vh;overflow-y:auto;">
      <div class="modal-title">選擇 LINE 聯絡人 —— ${escapeHtml(client.name)}</div>
      <div id="contact-list">${loadingHtml()}</div>
      <button class="secondary-btn" id="picker-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('picker-cancel').onclick = () => overlay.remove();

  const listEl = document.getElementById('contact-list');
  try {
    const contacts = await listUnmatchedLineContacts();
    if (!contacts.length) {
      listEl.innerHTML = `<div class="empty-body">目前沒有還沒配對的 LINE 聯絡人。請先請這位客人加官方帳號好友、傳一句話,幾秒後這裡就會出現。</div>`;
      return;
    }
    listEl.innerHTML = contacts
      .map(
        (c) => `
        <button type="button" class="card" data-id="${c.id}" data-uid="${escapeAttr(c.line_user_id)}" style="width:100%;flex-direction:column;align-items:flex-start;gap:4px;">
          <div class="card-name">${escapeHtml(c.last_message_text || '(尚未傳訊息)')}</div>
          <div class="card-sub">最近互動:${formatDateTime(c.last_event_at)}</div>
        </button>`
      )
      .join('');

    listEl.querySelectorAll('.card').forEach((btn) => {
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          await matchLineContact(btn.dataset.id, btn.dataset.uid, client.id, app.salon.id);
          overlay.remove();
          if (onDone) onDone();
        } catch (err) {
          console.error(err);
          alert('配對失敗:' + err.message);
          btn.disabled = false;
        }
      };
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="empty-body">讀取失敗:${escapeHtml(err.message)}</div>`;
  }
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

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
