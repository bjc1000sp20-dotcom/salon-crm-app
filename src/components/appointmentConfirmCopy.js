import { renderAppointmentConfirmVars } from '../lib/appointmentConfirm.js';
import { listEnabledQuickPhrases } from '../lib/quickPhrases.js';
import { getSignedUrl } from '../lib/data.js';
import { openStudioInfoViewer } from './studioInfoViewer.js';

// 預約建立/修改後彈出的「複製預約資訊」小視窗,共用給:首頁快速新增、客戶頁新增預約、客戶頁修改預約
// options.onEdit(currentSelectedPhraseIds):只有快速新增預約流程會傳,傳了才會多顯示「返回編輯」按鈕
// options.preselectedQuickPhraseIds:從「返回編輯」回來時,把上次勾選的常用話語帶回來繼續勾著
export function openAppointmentConfirmCopyModal(app, { clientName, appointmentDate, appointmentTime, serviceNames }, options = {}) {
  const template = app.salon.appointment_confirm_template || '';
  const baseMessage = renderAppointmentConfirmVars(template, { clientName, appointmentDate, appointmentTime, serviceNames });
  let quickPhrases = [];
  const selectedIds = new Set(options.preselectedQuickPhraseIds || []);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">預約已完成</div>
      <div class="field">
        <div class="field-label">【預約確認訊息】(可直接修改,再複製)</div>
        <textarea id="appt-confirm-preview" rows="6" placeholder="尚未設定話術,可到設定頁「預約確認話術設定」新增,或直接在這裡打字">${escapeHtml(baseMessage)}</textarea>
      </div>
      <div class="field">
        <div class="field-label">加入常用話語</div>
        <div id="appt-quick-phrases-list" class="field-hint">載入中...</div>
      </div>
      <div class="field" id="appt-studio-info-field" style="display:none;">
        <div class="field-label">工作室資訊</div>
        <div id="appt-studio-info-thumb"></div>
        <button type="button" class="secondary-btn" id="appt-studio-info-view-btn" style="margin-top:6px;">查看工作室資訊圖片</button>
      </div>
      ${options.onEdit ? `<button type="button" class="secondary-btn" id="appt-confirm-edit-btn" style="margin-top:6px;">返回編輯</button>` : ''}
      <button class="primary-btn" id="appt-confirm-copy-btn" style="margin-top:6px;">【複製預約資訊】</button>
      <div id="appt-confirm-copied" style="display:none;color:#4E8B5C;font-size:13px;margin-top:8px;text-align:center;">已複製,可以直接貼到 LINE</div>
      <button class="secondary-btn" id="appt-confirm-close-btn" style="margin-top:10px;">關閉</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const textarea = document.getElementById('appt-confirm-preview');

  function rebuildMessage() {
    const extras = quickPhrases.filter((p) => selectedIds.has(p.id)).map((p) => p.content);
    textarea.value = [baseMessage, ...extras].filter(Boolean).join('\n');
  }
  if (selectedIds.size) rebuildMessage();

  document.getElementById('appt-confirm-close-btn').onclick = () => overlay.remove();
  document.getElementById('appt-confirm-copy-btn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      document.getElementById('appt-confirm-copied').style.display = 'block';
    } catch (err) {
      alert('複製失敗:' + err.message);
    }
  };

  const editBtn = document.getElementById('appt-confirm-edit-btn');
  if (editBtn) {
    editBtn.onclick = () => {
      overlay.remove();
      options.onEdit(Array.from(selectedIds));
    };
  }

  listEnabledQuickPhrases(app.salon.id)
    .then((phrases) => {
      quickPhrases = phrases;
      const listEl = document.getElementById('appt-quick-phrases-list');
      if (!phrases.length) {
        listEl.textContent = '尚未設定常用話語,可到設定頁「常用話語管理」新增';
        return;
      }
      listEl.innerHTML = phrases
        .map(
          (p) => `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <input type="checkbox" class="appt-quick-phrase-check" data-id="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''} />
          <span>${escapeHtml(p.name)}</span>
        </label>`
        )
        .join('');
      listEl.querySelectorAll('.appt-quick-phrase-check').forEach((cb) => {
        cb.onchange = () => {
          if (cb.checked) selectedIds.add(cb.dataset.id);
          else selectedIds.delete(cb.dataset.id);
          rebuildMessage();
        };
      });
      if (selectedIds.size) rebuildMessage();
    })
    .catch((err) => {
      document.getElementById('appt-quick-phrases-list').textContent = '常用話語讀取失敗:' + err.message;
    });

  if (app.salon.studio_info_image_path) {
    const field = document.getElementById('appt-studio-info-field');
    field.style.display = '';
    getSignedUrl('studio-info', app.salon.studio_info_image_path)
      .then((url) => {
        document.getElementById('appt-studio-info-thumb').innerHTML =
          `<img src="${url}" style="max-width:160px;max-height:160px;border-radius:10px;object-fit:contain;" />`;
        document.getElementById('appt-studio-info-view-btn').onclick = () => openStudioInfoViewer(url);
      })
      .catch((err) => {
        document.getElementById('appt-studio-info-thumb').textContent = '圖片讀取失敗:' + err.message;
      });
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
