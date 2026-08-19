import { ensureDefaultFollowUpTemplates, createAppointmentWithReminders, addDaysToToday } from '../lib/lineIntegration.js';
import { PAYMENT_METHODS } from '../lib/paymentMethods.js';

// 新增預約 + 一次勾選要建立的「預約前提醒」與「術後追蹤」,一個按鈕全部建立完成
export async function openAppointmentModal(app, client, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-height:85vh;overflow-y:auto;">
      <div class="modal-title">為「${escapeHtml(client.name)}」新增預約</div>
      <div id="appt-modal-body">${loadingHtml()}</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const body = document.getElementById('appt-modal-body');
  let templates;
  try {
    templates = await ensureDefaultFollowUpTemplates(app.salon.id);
  } catch (err) {
    body.innerHTML = `<div class="empty-body">模板讀取失敗:${escapeHtml(err.message)}</div>`;
    return;
  }

  const reminderTemplates = templates.filter((t) => t.kind === 'appointment_reminder' && t.enabled !== false);
  const aftercareTemplates = templates.filter((t) => t.kind === 'aftercare_followup' && t.enabled !== false);

  let customRows = [];

  function render() {
    body.innerHTML = `
      <div class="field">
        <div class="field-label">預約日期</div>
        <input type="date" id="appt-date" value="${addDaysToToday(1)}" />
      </div>
      <div class="field">
        <div class="field-label">預約時間(選填)</div>
        <input type="time" id="appt-time" />
      </div>
      <div class="field">
        <div class="field-label">服務項目</div>
        <input type="text" id="appt-service" placeholder="例如:深層清潔" />
      </div>

      <div class="row-2">
        <div class="field">
          <div class="field-label">訂金金額(選填)</div>
          <input type="number" id="appt-deposit-amount" min="0" step="1" placeholder="0" />
        </div>
        <div class="field">
          <div class="field-label">付款方式</div>
          <select id="appt-deposit-method">
            <option value="">未指定</option>
            ${PAYMENT_METHODS.filter((m) => m.id !== 'balance')
              .map((m) => `<option value="${m.id}">${m.name}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin:0 0 10px;">
        <input type="checkbox" id="appt-deposit-paid" />
        <span>訂金已付款</span>
      </label>

      <div class="field-label" style="margin-top:14px;">預約前提醒</div>
      ${reminderTemplates
        .map(
          (t) => `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <input type="checkbox" class="appt-reminder-check" data-days="${t.days_after}" />
          <span>${escapeHtml(t.label)}</span>
        </label>`
        )
        .join('')}
      <div id="appt-custom-rows">
        ${customRows
          .map(
            (r) => `
          <div class="field" style="border-top:1px dashed #E5DCC8;padding-top:10px;margin-top:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div class="field-label">自訂:提前幾天提醒</div>
              <button type="button" class="appt-custom-remove" data-key="${r.key}" style="background:none;border:none;color:#B5533C;cursor:pointer;font-size:13px;">移除</button>
            </div>
            <input type="number" min="1" class="appt-custom-days" data-key="${r.key}" value="${r.days}" />
            <textarea class="appt-custom-message" data-key="${r.key}" placeholder="訊息內容(可用 {date} {time} {service})" style="margin-top:6px;">${escapeHtml(r.message)}</textarea>
          </div>`
          )
          .join('')}
      </div>
      <button type="button" class="secondary-btn" id="appt-add-custom-btn" style="margin-top:10px;">＋ 自訂提前天數</button>

      ${
        aftercareTemplates.length
          ? `<div class="field-label" style="margin-top:16px;">同時建立術後追蹤(選填)</div>
             ${aftercareTemplates
               .map(
                 (t) => `
               <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                 <input type="checkbox" class="appt-aftercare-check" data-template-id="${t.id}" />
                 <span>${escapeHtml(t.label)}(${t.days_after} 天後)</span>
               </label>`
               )
               .join('')}`
          : ''
      }

      <button class="primary-btn" id="appt-create-btn" style="margin-top:14px;">建立預約</button>
      <button class="secondary-btn" id="appt-cancel-btn">取消</button>
    `;
    bind();
  }

  function bind() {
    document.getElementById('appt-cancel-btn').onclick = () => overlay.remove();
    document.getElementById('appt-add-custom-btn').onclick = () => {
      customRows.push({ key: Date.now(), days: 1, message: reminderTemplates[0]?.message || '' });
      render();
    };
    body.querySelectorAll('.appt-custom-remove').forEach((btn) => {
      btn.onclick = () => {
        customRows = customRows.filter((r) => String(r.key) !== btn.dataset.key);
        render();
      };
    });
    body.querySelectorAll('.appt-custom-days').forEach((input) => {
      input.onchange = () => {
        const row = customRows.find((r) => String(r.key) === input.dataset.key);
        if (row) row.days = Number(input.value) || 1;
      };
    });
    body.querySelectorAll('.appt-custom-message').forEach((textarea) => {
      textarea.oninput = () => {
        const row = customRows.find((r) => String(r.key) === textarea.dataset.key);
        if (row) row.message = textarea.value;
      };
    });

    const createBtn = document.getElementById('appt-create-btn');
    createBtn.onclick = async () => {
      const appointment_date = document.getElementById('appt-date').value;
      const appointment_time = document.getElementById('appt-time').value || null;
      const service_note = document.getElementById('appt-service').value.trim();
      const depositAmountRaw = document.getElementById('appt-deposit-amount').value;
      const deposit_amount = depositAmountRaw ? Number(depositAmountRaw) : null;
      const deposit_payment_method = document.getElementById('appt-deposit-method').value || null;
      const deposit_paid = document.getElementById('appt-deposit-paid').checked;
      if (!appointment_date) {
        alert('請選擇預約日期');
        return;
      }
      const reminderOffsets = Array.from(body.querySelectorAll('.appt-reminder-check:checked')).map(
        (el) => Number(el.dataset.days)
      );
      const validCustom = customRows.filter((r) => r.days && r.message.trim());
      const aftercareTemplateIds = Array.from(body.querySelectorAll('.appt-aftercare-check:checked')).map(
        (el) => el.dataset.templateId
      );

      createBtn.disabled = true;
      createBtn.textContent = '建立中...';
      try {
        await createAppointmentWithReminders(app.salon.id, client.id, app.session.user.id, {
          appointment_date,
          appointment_time,
          service_note,
          deposit_amount,
          deposit_paid,
          deposit_payment_method,
          reminderOffsets,
          customReminders: validCustom.map((r) => ({ offset_days: r.days, message: r.message.trim() })),
          aftercareTemplateIds,
        });
        overlay.remove();
        if (onDone) onDone();
      } catch (err) {
        console.error(err);
        alert('建立預約失敗:' + err.message);
        createBtn.disabled = false;
        createBtn.textContent = '建立預約';
      }
    };
  }

  render();
}

function loadingHtml() {
  return `<div style="text-align:center;color:#9B8F7F;padding:20px 0;">載入中...</div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
