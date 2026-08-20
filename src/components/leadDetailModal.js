import {
  getLeadWithFollowUps,
  completeLeadFollowUp,
  snoozeLeadFollowUp,
  addNextFollowUp,
  setLeadNotTracking,
  updateLead,
  convertLeadToClient,
  buildInstagramUrl,
} from '../lib/leads.js';
import { listEnabledLeadStatuses } from '../lib/leadStatuses.js';
import { addDaysToDate, addDaysToToday } from '../lib/lineIntegration.js';

const CHANNEL_LABEL = { instagram: 'Instagram', line: 'LINE', facebook: 'Facebook', threads: 'Threads', phone: '電話', other: '其他' };
const FU_STATUS_LABEL = { pending: '待處理', done: '已完成', cancelled: '已取消' };

// 首頁「查看」跟「追蹤客戶」搜尋頁點擊都開這個彈窗:顯示 lead 詳情+全部歷史追蹤紀錄,並提供完成/延後/再次追蹤/不再追蹤/轉為正式客戶/編輯
export async function openLeadDetailModal(app, leadId, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box" style="max-height:85vh;overflow-y:auto;"><div id="ldm-body">載入中...</div></div>`;
  document.body.appendChild(overlay);

  let view = 'main';
  let lead, followUps;

  async function load() {
    const result = await getLeadWithFollowUps(leadId);
    lead = result.lead;
    followUps = result.followUps;
  }

  function render() {
    const body = document.getElementById('ldm-body');
    if (view === 'main') body.innerHTML = mainViewHtml();
    else if (view === 'snooze') body.innerHTML = snoozeViewHtml();
    else if (view === 'nextFollowUp') body.innerHTML = nextFollowUpViewHtml();
    else if (view === 'convert') body.innerHTML = convertViewHtml();
    else if (view === 'edit') body.innerHTML = editViewHtml();
    bind();
  }

  function mainViewHtml() {
    const pending = followUps.find((f) => f.status === 'pending');
    const igUrl = buildInstagramUrl(lead.channel, lead.contact_handle);
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueDays = pending ? Math.round((new Date(todayStr) - new Date(pending.remind_date)) / 86400000) : 0;

    return `
      <div class="modal-title">${escapeHtml(lead.name || lead.contact_handle || '未命名')}</div>
      <div class="detail-row">聯絡來源:${CHANNEL_LABEL[lead.channel] || lead.channel}</div>
      ${lead.contact_handle ? `<div class="detail-row">帳號:${escapeHtml(lead.contact_handle)}</div>` : ''}
      <div class="detail-row">目前進度:${escapeHtml(lead.lead_statuses?.name || '未設定')}</div>
      ${lead.notes ? `<div class="note-box" style="margin-top:8px;white-space:pre-wrap;">${escapeHtml(lead.notes)}</div>` : ''}
      ${
        lead.state === 'converted'
          ? `<div class="field-hint" style="color:#4E8B5C;margin-top:10px;">已成交,已轉為正式客戶</div>`
          : lead.state === 'not_tracking'
            ? `<div class="field-hint" style="margin-top:10px;">已標記不再追蹤</div>`
            : pending
              ? `
                <div class="field" style="margin-top:12px;border-top:1px dashed #E5DCC8;padding-top:12px;">
                  <div class="field-label">目前提醒</div>
                  <div class="detail-row">提醒日期:${formatMD(pending.remind_date)}${pending.remind_time ? ` ${pending.remind_time.slice(0, 5)}` : ''}${overdueDays > 0 ? ` <span style="color:#B5533C;">⚠️ 已逾期 ${overdueDays} 天</span>` : ''}</div>
                  <div class="detail-row">內容:${escapeHtml(pending.content)}</div>
                </div>
              `
              : `<div class="field-hint" style="margin-top:10px;">目前沒有待處理的提醒</div>`
      }

      ${igUrl ? `<button type="button" class="secondary-btn" id="ldm-open-ig" style="margin-top:12px;">開啟 Instagram</button>` : ''}
      ${
        lead.state === 'active'
          ? `
            ${pending ? `<button type="button" class="primary-btn" id="ldm-complete">完成</button>` : ''}
            ${pending ? `<button type="button" class="secondary-btn" id="ldm-snooze">延後</button>` : ''}
            <button type="button" class="secondary-btn" id="ldm-next">再次追蹤</button>
            <button type="button" class="secondary-btn" id="ldm-convert">轉為正式客戶</button>
            <button type="button" class="secondary-btn" id="ldm-not-tracking">不再追蹤</button>
            <button type="button" class="secondary-btn" id="ldm-edit">編輯</button>
          `
          : ''
      }
      <button type="button" class="secondary-btn" id="ldm-close" style="margin-top:10px;">關閉</button>

      <div class="field-label" style="margin-top:16px;">追蹤歷史</div>
      ${
        followUps.length
          ? followUps
              .map(
                (f) => `
              <div class="field" style="border-top:1px dashed #E5DCC8;padding-top:8px;margin-top:8px;">
                <div class="detail-row">${formatMD(f.remind_date)}${f.remind_time ? ` ${f.remind_time.slice(0, 5)}` : ''} ・ ${FU_STATUS_LABEL[f.status] || f.status}${f.snoozed ? '(曾延後)' : ''}</div>
                <div class="visit-note">${escapeHtml(f.content)}</div>
              </div>
            `
              )
              .join('')
          : `<div class="empty-body">還沒有任何追蹤紀錄</div>`
      }
    `;
  }

  function snoozeViewHtml() {
    return `
      <div class="modal-title">延後提醒</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="secondary-btn" id="ldm-snooze-1" style="margin-top:0;">延後 1 天</button>
        <button type="button" class="secondary-btn" id="ldm-snooze-3" style="margin-top:0;">延後 3 天</button>
        <button type="button" class="secondary-btn" id="ldm-snooze-7" style="margin-top:0;">延後 7 天</button>
      </div>
      <div class="field" style="margin-top:12px;">
        <div class="field-label">或自訂日期</div>
        <input type="date" id="ldm-snooze-date" value="${addDaysToToday(1)}" />
        <button type="button" class="secondary-btn" id="ldm-snooze-custom" style="margin-top:8px;">套用自訂日期</button>
      </div>
      <button type="button" class="secondary-btn" id="ldm-back" style="margin-top:10px;">返回</button>
    `;
  }

  function nextFollowUpViewHtml() {
    return `
      <div class="modal-title">再次追蹤</div>
      <div class="field">
        <div class="field-label">下一次提醒內容</div>
        <textarea id="ldm-next-content" rows="3" placeholder="例如:詢問是否要安排療程"></textarea>
      </div>
      <div class="row-2">
        <div class="field">
          <div class="field-label">下一次提醒日期</div>
          <input type="date" id="ldm-next-date" value="${addDaysToToday(3)}" />
        </div>
        <div class="field">
          <div class="field-label">提醒時間(選填)</div>
          <input type="time" id="ldm-next-time" />
        </div>
      </div>
      <button type="button" class="primary-btn" id="ldm-next-save">儲存</button>
      <button type="button" class="secondary-btn" id="ldm-back">返回</button>
    `;
  }

  function convertViewHtml() {
    return `
      <div class="modal-title">轉為正式客戶</div>
      <div class="field-hint" style="margin-bottom:10px;">名稱、聯絡帳號、備註、追蹤紀錄都會保留,轉換後可以在客戶詳情頁補上其他資料。</div>
      <div class="field">
        <div class="field-label">姓名<span class="req"> *</span></div>
        <input type="text" id="ldm-convert-name" value="${escapeAttr(lead.name || '')}" placeholder="客戶姓名" />
      </div>
      <div class="field">
        <div class="field-label">電話(選填)</div>
        <input type="tel" id="ldm-convert-phone" placeholder="09xx-xxx-xxx" />
      </div>
      <button type="button" class="primary-btn" id="ldm-convert-save">確定轉換</button>
      <button type="button" class="secondary-btn" id="ldm-back">返回</button>
    `;
  }

  function editViewHtml() {
    return `
      <div class="modal-title">編輯追蹤客戶</div>
      <div class="field">
        <div class="field-label">對方名稱／暱稱</div>
        <input type="text" id="ldm-edit-name" value="${escapeAttr(lead.name || '')}" />
      </div>
      <div class="field">
        <div class="field-label">聯絡來源</div>
        <select id="ldm-edit-channel">
          ${Object.entries(CHANNEL_LABEL).map(([id, name]) => `<option value="${id}" ${lead.channel === id ? 'selected' : ''}>${name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <div class="field-label">IG帳號／聯絡帳號</div>
        <input type="text" id="ldm-edit-handle" value="${escapeAttr(lead.contact_handle || '')}" />
      </div>
      <div class="field">
        <div class="field-label">目前進度</div>
        <select id="ldm-edit-status">
          <option value="">未設定</option>
        </select>
      </div>
      <div class="field">
        <div class="field-label">備註</div>
        <textarea id="ldm-edit-notes" rows="3">${escapeHtml(lead.notes || '')}</textarea>
      </div>
      <button type="button" class="primary-btn" id="ldm-edit-save">儲存</button>
      <button type="button" class="secondary-btn" id="ldm-back">返回</button>
    `;
  }

  function bind() {
    const closeBtn = document.getElementById('ldm-close');
    if (closeBtn) closeBtn.onclick = () => overlay.remove();
    const backBtn = document.getElementById('ldm-back');
    if (backBtn) backBtn.onclick = () => {
      view = 'main';
      render();
    };

    const openIgBtn = document.getElementById('ldm-open-ig');
    if (openIgBtn) openIgBtn.onclick = () => window.open(buildInstagramUrl(lead.channel, lead.contact_handle), '_blank');

    const completeBtn = document.getElementById('ldm-complete');
    if (completeBtn) {
      completeBtn.onclick = async () => {
        const pending = followUps.find((f) => f.status === 'pending');
        if (!pending) return;
        completeBtn.disabled = true;
        try {
          await completeLeadFollowUp(pending.id);
          await load();
          render();
          if (onDone) onDone();
        } catch (err) {
          alert('操作失敗:' + err.message);
          completeBtn.disabled = false;
        }
      };
    }

    const snoozeBtn = document.getElementById('ldm-snooze');
    if (snoozeBtn) {
      snoozeBtn.onclick = () => {
        view = 'snooze';
        render();
      };
    }
    ['1', '3', '7'].forEach((days) => {
      const btn = document.getElementById(`ldm-snooze-${days}`);
      if (btn) {
        btn.onclick = async () => {
          const pending = followUps.find((f) => f.status === 'pending');
          if (!pending) return;
          try {
            await snoozeLeadFollowUp(pending.id, addDaysToDate(pending.remind_date, Number(days)));
            view = 'main';
            await load();
            render();
            if (onDone) onDone();
          } catch (err) {
            alert('操作失敗:' + err.message);
          }
        };
      }
    });
    const snoozeCustomBtn = document.getElementById('ldm-snooze-custom');
    if (snoozeCustomBtn) {
      snoozeCustomBtn.onclick = async () => {
        const pending = followUps.find((f) => f.status === 'pending');
        const newDate = document.getElementById('ldm-snooze-date').value;
        if (!pending || !newDate) return;
        try {
          await snoozeLeadFollowUp(pending.id, newDate);
          view = 'main';
          await load();
          render();
          if (onDone) onDone();
        } catch (err) {
          alert('操作失敗:' + err.message);
        }
      };
    }

    const nextBtn = document.getElementById('ldm-next');
    if (nextBtn) {
      nextBtn.onclick = () => {
        view = 'nextFollowUp';
        render();
      };
    }
    const nextSaveBtn = document.getElementById('ldm-next-save');
    if (nextSaveBtn) {
      nextSaveBtn.onclick = async () => {
        const content = document.getElementById('ldm-next-content').value.trim();
        const remind_date = document.getElementById('ldm-next-date').value;
        const remind_time = document.getElementById('ldm-next-time').value || null;
        if (!content || !remind_date) {
          alert('請填寫提醒內容與日期');
          return;
        }
        nextSaveBtn.disabled = true;
        try {
          await addNextFollowUp(lead.id, app.salon.id, { content, remind_date, remind_time });
          view = 'main';
          await load();
          render();
          if (onDone) onDone();
        } catch (err) {
          alert('儲存失敗:' + err.message);
          nextSaveBtn.disabled = false;
        }
      };
    }

    const convertBtn = document.getElementById('ldm-convert');
    if (convertBtn) {
      convertBtn.onclick = () => {
        view = 'convert';
        render();
      };
    }
    const convertSaveBtn = document.getElementById('ldm-convert-save');
    if (convertSaveBtn) {
      convertSaveBtn.onclick = async () => {
        const name = document.getElementById('ldm-convert-name').value.trim();
        const phone = document.getElementById('ldm-convert-phone').value.trim();
        if (!name) {
          alert('請輸入姓名');
          return;
        }
        convertSaveBtn.disabled = true;
        try {
          const client = await convertLeadToClient(app.salon.id, app.session.user.id, lead, { name, phone });
          overlay.remove();
          if (onDone) onDone();
          app.navigate('clientDetail', { clientId: client.id });
        } catch (err) {
          alert('轉換失敗:' + err.message);
          convertSaveBtn.disabled = false;
        }
      };
    }

    const notTrackingBtn = document.getElementById('ldm-not-tracking');
    if (notTrackingBtn) {
      notTrackingBtn.onclick = async () => {
        if (!confirm('確定不再追蹤這位客戶嗎?之後不會再提醒。')) return;
        try {
          await setLeadNotTracking(lead.id);
          await load();
          render();
          if (onDone) onDone();
        } catch (err) {
          alert('操作失敗:' + err.message);
        }
      };
    }

    const editBtn = document.getElementById('ldm-edit');
    if (editBtn) {
      editBtn.onclick = async () => {
        view = 'edit';
        render();
        try {
          const statuses = await listEnabledLeadStatuses(app.salon.id);
          const select = document.getElementById('ldm-edit-status');
          if (select) {
            select.innerHTML =
              `<option value="">未設定</option>` +
              statuses.map((s) => `<option value="${s.id}" ${lead.status_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
          }
        } catch (err) {
          console.error(err);
        }
      };
    }
    const editSaveBtn = document.getElementById('ldm-edit-save');
    if (editSaveBtn) {
      editSaveBtn.onclick = async () => {
        const name = document.getElementById('ldm-edit-name').value.trim();
        const channel = document.getElementById('ldm-edit-channel').value;
        const contact_handle = document.getElementById('ldm-edit-handle').value.trim();
        const status_id = document.getElementById('ldm-edit-status').value || null;
        const notes = document.getElementById('ldm-edit-notes').value.trim();
        editSaveBtn.disabled = true;
        try {
          await updateLead(lead.id, { name: name || null, channel, contact_handle: contact_handle || null, status_id, notes: notes || null });
          view = 'main';
          await load();
          render();
          if (onDone) onDone();
        } catch (err) {
          alert('儲存失敗:' + err.message);
          editSaveBtn.disabled = false;
        }
      };
    }
  }

  try {
    await load();
  } catch (err) {
    document.getElementById('ldm-body').innerHTML = `<div class="empty-body">讀取失敗:${escapeHtml(err.message)}</div>`;
    return;
  }
  render();
}

function formatMD(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
