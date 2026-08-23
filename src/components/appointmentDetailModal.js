import { openAppointmentConfirmCopyModal } from './appointmentConfirmCopy.js';

// 首頁「今日已建立預約」的【查看】彈窗:純顯示,不查資料庫——appointment 物件已經帶著
// listTodayCreatedAppointments 內嵌好的 clients / follow_ups,直接拿來畫就好。
export function openAppointmentDetailModal(app, appointment, onEdit) {
  const client = appointment.clients || {};
  const hasReminder = (appointment.follow_ups || []).some((f) => f.kind === 'appointment_reminder');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">預約詳情</div>

      <div class="field">
        <div class="field-label">姓名</div>
        <div>${escapeHtml(client.name || '未知客戶')}</div>
      </div>
      <div class="field">
        <div class="field-label">電話</div>
        <div>${escapeHtml(client.phone || '(未填寫)')}</div>
      </div>
      <div class="field">
        <div class="field-label">預約日期</div>
        <div>${escapeHtml(formatDate(appointment.appointment_date))}</div>
      </div>
      <div class="field">
        <div class="field-label">預約時間</div>
        <div>${appointment.appointment_time ? escapeHtml(appointment.appointment_time.slice(0, 5)) : '時間未定'}</div>
      </div>
      <div class="field">
        <div class="field-label">預約項目</div>
        <div>${escapeHtml(appointment.service_note || '(未填寫)')}</div>
      </div>
      <div class="field">
        <div class="field-label">LINE 綁定狀態</div>
        <div>${client.line_user_id ? 'LINE 已綁定 ✓' : 'LINE 未綁定'}</div>
      </div>
      <div class="field">
        <div class="field-label">預約提醒</div>
        <div>${hasReminder ? '已建立提醒 ✓' : '未建立提醒'}</div>
      </div>
      <div class="field" style="margin-bottom:0;">
        <div class="field-label">建立時間</div>
        <div>${escapeHtml(formatDateTime(appointment.created_at))}</div>
      </div>

      <button type="button" class="primary-btn" id="appt-detail-edit-btn" style="margin-top:14px;">編輯預約</button>
      <button type="button" class="secondary-btn" id="appt-detail-copy-btn">複製預約資訊</button>
      <button type="button" class="secondary-btn" id="appt-detail-close-btn">關閉</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('appt-detail-close-btn').onclick = () => overlay.remove();
  document.getElementById('appt-detail-edit-btn').onclick = () => {
    overlay.remove();
    onEdit();
  };
  document.getElementById('appt-detail-copy-btn').onclick = () => {
    overlay.remove();
    openAppointmentConfirmCopyModal(app, {
      clientName: client.name || '',
      appointmentDate: appointment.appointment_date,
      appointmentTime: appointment.appointment_time ? appointment.appointment_time.slice(0, 5) : '',
      serviceNames: appointment.service_note || '',
    });
  };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}/${Number(m)}/${Number(d)}`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
