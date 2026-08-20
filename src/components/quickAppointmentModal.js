import { createClient, updateClient } from '../lib/data.js';
import { createAppointmentWithReminders, updateAppointment, addDaysToToday } from '../lib/lineIntegration.js';
import { serviceGridHtml, bindServiceGrid } from './serviceMultiSelect.js';
import { SERVICES } from '../lib/services.js';
import { openAppointmentConfirmCopyModal } from './appointmentConfirmCopy.js';

// 首頁「＋新增預約」快速建立:姓名/電話/日期/時間/服務項目,一次建立新客戶+新預約,不比對是否已有相同電話的客戶
// editTarget 有傳的話代表是從「複製預約資訊」彈窗按【返回編輯】回來,改的是同一筆預約(client_id/appointment_id),不會多建立一筆
export function openQuickAppointmentModal(app, onDone, editTarget) {
  const isEdit = !!editTarget;
  const selectedServiceIds = isEdit
    ? SERVICES.filter((s) => (editTarget.service_note || '').split('、').map((x) => x.trim()).includes(s.name)).map((s) => s.id)
    : [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-height:85vh;overflow-y:auto;">
      <div class="modal-title">${isEdit ? '編輯預約' : '快速新增預約'}</div>
      <div class="field">
        <div class="field-label">姓名</div>
        <input type="text" id="qa-name" value="${escapeAttr(editTarget?.name || '')}" placeholder="客戶姓名" />
      </div>
      <div class="field">
        <div class="field-label">電話(選填)</div>
        <input type="tel" id="qa-phone" value="${escapeAttr(editTarget?.phone || '')}" placeholder="09xx-xxx-xxx" />
      </div>
      <div class="field">
        <div class="field-label">預約日期</div>
        <input type="date" id="qa-date" value="${editTarget?.appointment_date || addDaysToToday(1)}" />
      </div>
      <div class="field">
        <div class="field-label">預約時間(選填)</div>
        <input type="time" id="qa-time" value="${editTarget?.appointment_time ? editTarget.appointment_time.slice(0, 5) : ''}" />
      </div>
      <div class="field">
        <div class="field-label">預約項目(可複選,選填)</div>
        ${serviceGridHtml(selectedServiceIds)}
      </div>
      ${isEdit ? '' : '<div class="field-hint">會直接建立一位新客戶,不會比對是否已有相同電話的客戶。</div>'}
      <button class="primary-btn" id="qa-create-btn" style="margin-top:10px;">${isEdit ? '儲存修改' : '建立預約'}</button>
      <button class="secondary-btn" id="qa-cancel-btn">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);

  bindServiceGrid(selectedServiceIds);
  document.getElementById('qa-cancel-btn').onclick = () => overlay.remove();

  const createBtn = document.getElementById('qa-create-btn');
  createBtn.onclick = async () => {
    const name = document.getElementById('qa-name').value.trim();
    const phone = document.getElementById('qa-phone').value.trim();
    const appointment_date = document.getElementById('qa-date').value;
    const appointment_time = document.getElementById('qa-time').value || null;
    const service_note = selectedServiceIds
      .map((id) => SERVICES.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join('、');
    if (!name) {
      alert('請輸入姓名');
      return;
    }
    if (!appointment_date) {
      alert('請選擇預約日期');
      return;
    }

    createBtn.disabled = true;
    createBtn.textContent = isEdit ? '儲存中...' : '建立中...';
    try {
      let clientId, appointmentId;
      if (isEdit) {
        await updateClient(editTarget.client_id, { name, phone });
        await updateAppointment(editTarget.appointment_id, { appointment_date, appointment_time, service_note });
        clientId = editTarget.client_id;
        appointmentId = editTarget.appointment_id;
      } else {
        const client = await createClient(app.salon.id, app.session.user.id, { name, phone });
        const appt = await createAppointmentWithReminders(app.salon.id, client.id, app.session.user.id, {
          appointment_date,
          appointment_time,
          service_note,
          reminderOffsets: [],
          customReminders: [],
          aftercareTemplateIds: [],
        });
        clientId = client.id;
        appointmentId = appt.id;
      }
      overlay.remove();
      openConfirmStep(
        app,
        { client_id: clientId, appointment_id: appointmentId, name, phone, appointment_date, appointment_time, service_note },
        onDone,
        editTarget?.preservedPhraseIds
      );
      if (onDone) onDone();
    } catch (err) {
      console.error(err);
      alert((isEdit ? '儲存' : '建立') + '失敗:' + err.message);
      createBtn.disabled = false;
      createBtn.textContent = isEdit ? '儲存修改' : '建立預約';
    }
  };
}

function openConfirmStep(app, apptInfo, onDone, preservedPhraseIds) {
  openAppointmentConfirmCopyModal(
    app,
    {
      clientName: apptInfo.name,
      appointmentDate: apptInfo.appointment_date,
      appointmentTime: apptInfo.appointment_time ? apptInfo.appointment_time.slice(0, 5) : '',
      serviceNames: apptInfo.service_note || '',
    },
    {
      preselectedQuickPhraseIds: preservedPhraseIds,
      onEdit: (currentPhraseIds) =>
        openQuickAppointmentModal(app, onDone, { ...apptInfo, preservedPhraseIds: currentPhraseIds }),
    }
  );
}

function escapeAttr(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML.replace(/"/g, '&quot;');
}
