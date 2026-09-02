import { createLead } from '../lib/leads.js';
import { ensureDefaultLeadStatuses } from '../lib/leadStatuses.js';
import { addDaysToToday } from '../lib/lineIntegration.js';
import { showToast } from './toast.js';

const CHANNELS = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'line', name: 'LINE' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'threads', name: 'Threads' },
  { id: 'phone', name: '電話' },
  { id: 'other', name: '其他' },
];

// 首頁「＋提醒追蹤客戶」用:記錄還不是正式客戶的 IG/LINE 詢問對象,不強迫先建立完整客戶資料
export async function openLeadFollowUpModal(app, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-height:85vh;overflow-y:auto;">
      <div class="modal-title">提醒追蹤客戶</div>
      <div id="lfu-body">載入中...</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const body = document.getElementById('lfu-body');
  let statuses;
  try {
    statuses = await ensureDefaultLeadStatuses(app.salon.id);
  } catch (err) {
    body.innerHTML = `<div class="empty-body">讀取失敗:${escapeHtml(err.message)}</div>`;
    return;
  }

  body.innerHTML = `
    <div class="field">
      <div class="field-label">對方名稱／暱稱(選填)</div>
      <input type="text" id="lfu-name" placeholder="例如:王小姐 / IG 小美" />
    </div>
    <div class="field">
      <div class="field-label">聯絡來源</div>
      <select id="lfu-channel">
        ${CHANNELS.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <div class="field-label">IG帳號／聯絡帳號(選填)</div>
      <input type="text" id="lfu-handle" placeholder="例如:@xxxxx 或 IG 個人檔案網址" />
    </div>
    <div class="field">
      <div class="field-label">目前進度</div>
      <select id="lfu-status">
        <option value="">未設定</option>
        ${statuses.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <div class="field-label">我要提醒自己的內容<span class="req"> *</span></div>
      <textarea id="lfu-content" rows="3" placeholder="例如:提醒她付訂金"></textarea>
    </div>
    <div class="row-2">
      <div class="field">
        <div class="field-label">提醒日期<span class="req"> *</span></div>
        <input type="date" id="lfu-date" value="${addDaysToToday(1)}" />
      </div>
      <div class="field">
        <div class="field-label">提醒時間(選填)</div>
        <input type="time" id="lfu-time" />
      </div>
    </div>
    <div class="field">
      <div class="field-label">備註(選填)</div>
      <textarea id="lfu-notes" rows="3" placeholder="例如:她說發薪水後再決定"></textarea>
    </div>
    <button class="primary-btn" id="lfu-save">儲存</button>
    <button class="secondary-btn" id="lfu-cancel">取消</button>
  `;

  document.getElementById('lfu-cancel').onclick = () => overlay.remove();
  document.getElementById('lfu-save').onclick = async () => {
    const name = document.getElementById('lfu-name').value.trim();
    const channel = document.getElementById('lfu-channel').value;
    const contact_handle = document.getElementById('lfu-handle').value.trim();
    const status_id = document.getElementById('lfu-status').value || null;
    const content = document.getElementById('lfu-content').value.trim();
    const remind_date = document.getElementById('lfu-date').value;
    const remind_time = document.getElementById('lfu-time').value || null;
    const notes = document.getElementById('lfu-notes').value.trim();

    if (!content) {
      alert('請填寫要提醒自己的內容');
      return;
    }
    if (!remind_date) {
      alert('請選擇提醒日期');
      return;
    }

    const saveBtn = document.getElementById('lfu-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';
    try {
      await createLead(
        app.salon.id,
        app.session.user.id,
        { name: name || null, channel, contact_handle: contact_handle || null, status_id, notes: notes || null },
        { content, remind_date, remind_time }
      );
      overlay.remove();
      showToast('追蹤提醒已建立 ✓');
      if (onDone) onDone();
    } catch (err) {
      alert('儲存失敗:' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存';
    }
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
