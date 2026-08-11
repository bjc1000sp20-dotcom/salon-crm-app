import { updateSalon } from '../lib/data.js';

export function renderSettings(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">設定</div>
        <div style="width:38px;"></div>
      </div>
      <div class="form-scroll">
        <div class="field">
          <div class="field-label">工作室名稱</div>
          <input type="text" id="f-salon-name" value="${escapeAttr(app.salon.salon_name)}" placeholder="工作室名稱" />
        </div>
        <div class="field">
          <div class="field-label">課程前同意書內容</div>
          <textarea id="f-consent-template" rows="10">${escapeHtml(app.salon.consent_template)}</textarea>
          <div class="field-hint">客戶第一次到店時,會看到這段文字並簽名同意。之後修改不會影響客戶已經簽過的舊紀錄。</div>
        </div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="save-btn">儲存</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('clientList');

  const saveBtn = document.getElementById('save-btn');
  saveBtn.onclick = async () => {
    const salon_name = document.getElementById('f-salon-name').value.trim();
    const consent_template = document.getElementById('f-consent-template').value.trim();
    if (!consent_template) {
      alert('同意書內容不能是空的');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';
    try {
      const updated = await updateSalon(app.salon.id, { salon_name, consent_template });
      app.salon = updated;
      app.navigate('clientList');
    } catch (err) {
      console.error(err);
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

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
