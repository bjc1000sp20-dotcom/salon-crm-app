import { createClient } from '../lib/data.js';
import { createAppointmentWithReminders, addDaysToToday } from '../lib/lineIntegration.js';
import { openAppointmentConfirmCopyModal } from './appointmentConfirmCopy.js';

// 首頁「＋新增預約」快速建立:姓名/電話/日期/時間,一次建立新客戶+新預約,不比對是否已有相同電話的客戶
export function openQuickAppointmentModal(app, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">快速新增預約</div>
      <div class="field">
        <div class="field-label">姓名</div>
        <input type="text" id="qa-name" placeholder="客戶姓名" />
      </div>
      <div class="field">
        <div class="field-label">電話(選填)</div>
        <input type="tel" id="qa-phone" placeholder="09xx-xxx-xxx" />
      </div>
      <div class="field">
        <div class="field-label">預約日期</div>
        <input type="date" id="qa-date" value="${addDaysToToday(1)}" />
      </div>
      <div class="field">
        <div class="field-label">預約時間(選填)</div>
        <input type="time" id="qa-time" />
      </div>
      <div class="field-hint">會直接建立一位新客戶,不會比對是否已有相同電話的客戶。</div>
      <button class="primary-btn" id="qa-create-btn" style="margin-top:10px;">建立預約</button>
      <button class="secondary-btn" id="qa-cancel-btn">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('qa-cancel-btn').onclick = () => overlay.remove();

  const createBtn = document.getElementById('qa-create-btn');
  createBtn.onclick = async () => {
    const name = document.getElementById('qa-name').value.trim();
    const phone = document.getElementById('qa-phone').value.trim();
    const appointment_date = document.getElementById('qa-date').value;
    const appointment_time = document.getElementById('qa-time').value || null;
    if (!name) {
      alert('請輸入姓名');
      return;
    }
    if (!appointment_date) {
      alert('請選擇預約日期');
      return;
    }

    createBtn.disabled = true;
    createBtn.textContent = '建立中...';
    try {
      const client = await createClient(app.salon.id, app.session.user.id, { name, phone });
      await createAppointmentWithReminders(app.salon.id, client.id, app.session.user.id, {
        appointment_date,
        appointment_time,
        service_note: '',
        reminderOffsets: [],
        customReminders: [],
        aftercareTemplateIds: [],
      });
      overlay.remove();
      openAppointmentConfirmCopyModal(app, {
        clientName: name,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time ? appointment_time.slice(0, 5) : '',
        serviceNames: '',
      });
      if (onDone) onDone();
    } catch (err) {
      console.error(err);
      alert('建立失敗:' + err.message);
      createBtn.disabled = false;
      createBtn.textContent = '建立預約';
    }
  };
}
