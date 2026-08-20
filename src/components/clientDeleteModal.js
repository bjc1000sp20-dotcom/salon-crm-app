import { archiveClient, deleteClientPermanently } from '../lib/data.js';

// 兩步驟的封存/永久刪除彈窗,客戶列表卡片跟客戶詳情頁的危險區域都共用這一份邏輯與文案。
// onDone 在成功封存或刪除後呼叫,由呼叫端決定接下來畫面怎麼更新。
// skipToDelete:已封存客戶清單裡「永久刪除」不需要再選一次「封存或刪除」,直接跳到刪除確認步驟。
export function openClientDeleteModal(app, client, onDone, { skipToDelete = false } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  document.body.appendChild(overlay);

  function renderChoice() {
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">「${escapeHtml(client.name)}」</div>
        <button type="button" class="secondary-btn" id="cdm-archive-btn" style="margin-top:0;">封存客戶(建議,可以恢復)</button>
        <button type="button" class="delete-btn" id="cdm-delete-btn" style="margin-top:10px;">永久刪除(無法復原)</button>
        <button type="button" class="secondary-btn" id="cdm-cancel-btn" style="margin-top:10px;">取消</button>
      </div>
    `;
    document.getElementById('cdm-cancel-btn').onclick = () => overlay.remove();
    document.getElementById('cdm-archive-btn').onclick = () => renderConfirm('archive');
    document.getElementById('cdm-delete-btn').onclick = () => renderConfirm('delete');
  }

  function renderConfirm(action) {
    const isArchive = action === 'archive';
    const text = isArchive
      ? `確定要封存「${escapeHtml(client.name)}」嗎?封存後不會出現在客戶列表,但所有到店紀錄、消費紀錄、備註、照片、LINE 綁定都會完整保留,之後可以隨時恢復。`
      : `確定要永久刪除「${escapeHtml(client.name)}」嗎?此動作無法復原,會一併刪除所有到店紀錄、消費紀錄、療程紀錄、備註、照片、紙本歷史資料、LINE 綁定與自動追蹤設定。`;
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="confirm-box">
          <div class="confirm-text">${text}</div>
          <div class="confirm-row">
            <button type="button" class="confirm-cancel" id="cdm-back-btn">取消</button>
            <button type="button" class="confirm-delete" id="cdm-confirm-btn">${isArchive ? '確定封存' : '確定永久刪除'}</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('cdm-back-btn').onclick = () => (skipToDelete ? overlay.remove() : renderChoice());
    document.getElementById('cdm-confirm-btn').onclick = async () => {
      const btn = document.getElementById('cdm-confirm-btn');
      btn.disabled = true;
      btn.textContent = isArchive ? '封存中...' : '刪除中...';
      try {
        if (isArchive) {
          await archiveClient(client.id);
        } else {
          await deleteClientPermanently(client.id);
        }
        overlay.remove();
        if (onDone) onDone();
      } catch (err) {
        alert((isArchive ? '封存' : '刪除') + '失敗:' + err.message);
        btn.disabled = false;
        btn.textContent = isArchive ? '確定封存' : '確定永久刪除';
      }
    };
  }

  if (skipToDelete) {
    renderConfirm('delete');
  } else {
    renderChoice();
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
