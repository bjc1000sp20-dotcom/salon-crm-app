import { renderAppointmentConfirmVars } from '../lib/appointmentConfirm.js';

// 預約建立/修改後彈出的「複製預約資訊」小視窗,共用給:首頁快速新增、客戶頁新增預約、客戶頁修改預約
export function openAppointmentConfirmCopyModal(app, { clientName, appointmentDate, appointmentTime, serviceNames }) {
  const template = app.salon.appointment_confirm_template || '';
  const message = renderAppointmentConfirmVars(template, { clientName, appointmentDate, appointmentTime, serviceNames });

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">預約已完成</div>
      <div class="field">
        <div class="field-label">【預約確認訊息】(可直接修改,再複製)</div>
        <textarea id="appt-confirm-preview" rows="6" placeholder="尚未設定話術,可到設定頁「預約確認話術設定」新增,或直接在這裡打字">${escapeHtml(message)}</textarea>
      </div>
      <button class="primary-btn" id="appt-confirm-copy-btn" style="margin-top:6px;">【複製預約資訊】</button>
      <div id="appt-confirm-copied" style="display:none;color:#4E8B5C;font-size:13px;margin-top:8px;text-align:center;">已複製,可以直接貼到 LINE</div>
      <button class="secondary-btn" id="appt-confirm-close-btn" style="margin-top:10px;">關閉</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('appt-confirm-close-btn').onclick = () => overlay.remove();
  document.getElementById('appt-confirm-copy-btn').onclick = async () => {
    const currentText = document.getElementById('appt-confirm-preview').value;
    try {
      await navigator.clipboard.writeText(currentText);
      document.getElementById('appt-confirm-copied').style.display = 'block';
    } catch (err) {
      alert('複製失敗:' + err.message);
    }
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
