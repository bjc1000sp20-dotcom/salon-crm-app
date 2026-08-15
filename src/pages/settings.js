import { updateSalon } from '../lib/data.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';

export function renderSettings(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="header">
        <div>
          <div class="header-eyebrow">SETTINGS</div>
          <h1 class="header-title">設定</h1>
        </div>
        <button class="btn-ghost" id="logout-btn" style="height:38px;">登出</button>
      </div>
      <div class="list-scroll" style="padding-top:0;">
        <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;">
          <div class="field">
            <div class="field-label">工作室名稱</div>
            <input type="text" id="f-salon-name" value="${escapeAttr(app.salon.salon_name)}" placeholder="工作室名稱" />
          </div>
          <div class="field" style="margin-bottom:0;">
            <div class="field-label">課程前同意書內容</div>
            <textarea id="f-consent-template" rows="10">${escapeHtml(app.salon.consent_template)}</textarea>
            <div class="field-hint">客戶第一次建立客戶卡時,會看到這段文字並簽名同意。之後修改不會影響客戶已經簽過的舊紀錄。</div>
          </div>
          <button class="primary-btn" id="save-btn" style="margin-top:18px;">儲存</button>
        </div>
      </div>
      ${tabBarHtml('settings')}
    </div>
  `;

  bindTabBar(app);
  document.getElementById('logout-btn').onclick = () => app.signOut();

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
      saveBtn.disabled = false;
      saveBtn.textContent = '已儲存';
      setTimeout(() => {
        saveBtn.textContent = '儲存';
      }, 1500);
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
