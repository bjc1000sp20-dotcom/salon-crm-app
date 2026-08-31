import { cancelAppointment, cancelAllAppointmentsForClient, listAppointmentsForClient } from '../lib/lineIntegration.js';
import { openClientDeleteModal } from './clientDeleteModal.js';

// 首頁「今日已建立預約」的【刪除】:不直接刪,先問清楚要「只刪這筆預約」還是「連同客戶資料一起刪除」,
// 後者是高風險操作,直接沿用既有的 openClientDeleteModal(封存/永久刪除兩層確認),不重做一次。
export function openDeleteAppointmentModal(app, appointment, onDone) {
  const client = appointment.clients || {};
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  function renderChoice() {
    let choice = 'appointment';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">請選擇要刪除的內容</div>
        <div class="field-hint" style="margin-bottom:10px;">
          客戶:${escapeHtml(client.name || '未知客戶')}<br />
          預約日期:${escapeHtml(appointment.appointment_date || '')}<br />
          預約時間:${appointment.appointment_time ? escapeHtml(appointment.appointment_time.slice(0, 5)) : '時間未定'}<br />
          預約項目:${escapeHtml(appointment.service_note || '(未填寫)')}
        </div>

        <label class="dam-choice-row" style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;cursor:pointer;">
          <input type="radio" name="dam-scope" value="appointment" checked style="margin-top:3px;" />
          <span><strong>只刪除這筆預約</strong><br /><span class="field-hint">保留客戶資料</span></span>
        </label>
        <label class="dam-choice-row" style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;cursor:pointer;">
          <input type="radio" name="dam-scope" value="client" style="margin-top:3px;" />
          <span><strong>連同客戶資料一起刪除</strong><br /><span class="field-hint">刪除客戶及相關資料</span></span>
        </label>

        <button type="button" class="primary-btn" id="dam-next-btn" style="margin-top:14px;">下一步</button>
        <button type="button" class="secondary-btn" id="dam-cancel-btn">取消</button>
      </div>
    `;
    document.getElementById('dam-cancel-btn').onclick = () => overlay.remove();
    overlay.querySelectorAll('input[name="dam-scope"]').forEach((r) => {
      r.onchange = () => {
        choice = r.value;
      };
    });
    document.getElementById('dam-next-btn').onclick = () => {
      if (choice === 'appointment') renderConfirmAppointmentOnly();
      else renderCheckOtherAppointments();
    };
  }

  function renderConfirmAppointmentOnly() {
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="confirm-box">
          <div class="confirm-text">確定要刪除這筆預約嗎?客戶資料(姓名、電話、LINE 綁定、備註、療程、到店紀錄、消費紀錄、照片、簽名、產品搭配建議等)完全不受影響,只會取消這筆預約與尚未發送的預約提醒。</div>
          <div class="confirm-row">
            <button type="button" class="confirm-cancel" id="dam-back-btn">返回</button>
            <button type="button" class="confirm-delete" id="dam-confirm-btn">確定刪除</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('dam-back-btn').onclick = () => renderChoice();
    document.getElementById('dam-confirm-btn').onclick = async () => {
      const btn = document.getElementById('dam-confirm-btn');
      btn.disabled = true;
      btn.textContent = '刪除中...';
      try {
        await cancelAppointment(appointment.id);
        overlay.remove();
        if (onDone) onDone();
      } catch (err) {
        alert('刪除失敗:' + err.message);
        btn.disabled = false;
        btn.textContent = '確定刪除';
      }
    };
  }

  async function renderCheckOtherAppointments() {
    overlay.innerHTML = `<div class="modal-box"><div style="text-align:center;color:#9B8F7F;padding:20px 0;">確認中...</div></div>`;
    let others = [];
    try {
      const all = await listAppointmentsForClient(appointment.client_id);
      others = all.filter((a) => a.id !== appointment.id && a.status !== 'cancelled');
    } catch (err) {
      overlay.innerHTML = `<div class="modal-box"><div class="empty-body">讀取失敗:${escapeHtml(err.message)}</div></div>`;
      return;
    }

    if (others.length) {
      overlay.innerHTML = `
        <div class="modal-box">
          <div class="confirm-box">
            <div class="confirm-text">此客戶目前還有其他預約紀錄(共 ${others.length} 筆),是否仍要一起刪除?</div>
            <div class="confirm-row">
              <button type="button" class="confirm-cancel" id="dam-back-btn">返回</button>
              <button type="button" class="confirm-delete" id="dam-continue-btn">仍要繼續</button>
            </div>
          </div>
        </div>
      `;
      document.getElementById('dam-back-btn').onclick = () => renderChoice();
      document.getElementById('dam-continue-btn').onclick = () => openClientStep();
    } else {
      openClientStep();
    }
  }

  function openClientStep() {
    overlay.remove();
    openClientDeleteModal(app, client, async () => {
      try {
        await cancelAllAppointmentsForClient(appointment.client_id);
      } catch (err) {
        console.error(err);
      }
      if (onDone) onDone();
    });
  }

  renderChoice();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
