import { updateSalon } from '../lib/data.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';
import { ensureDefaultFollowUpTemplates, updateFollowUpTemplate } from '../lib/lineIntegration.js';

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

        <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
          <div class="field-label" style="margin-bottom:10px;">LINE 自動追蹤訊息模板</div>
          <div class="field-hint" style="margin-bottom:12px;">這些是客戶頁面「LINE 自動追蹤」勾選清單裡的預設選項,可以自己修改標籤、天數與訊息內容。修改後不會影響已經建立好的排程。</div>
          <div id="templates-list">載入中...</div>
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

  loadTemplates(app);
}

async function loadTemplates(app) {
  const listEl = document.getElementById('templates-list');
  let templates;
  try {
    templates = await ensureDefaultFollowUpTemplates(app.salon.id);
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `讀取失敗:${escapeHtml(err.message)}`;
    return;
  }

  listEl.innerHTML = templates
    .map(
      (t) => `
    <div class="field" style="border-top:1px dashed #E5DCC8;padding-top:12px;margin-top:12px;">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <div class="field-label">標籤</div>
          <input type="text" class="tpl-label" data-id="${t.id}" value="${escapeAttr(t.label)}" />
        </div>
        <div style="width:90px;">
          <div class="field-label">天數</div>
          <input type="number" class="tpl-days" data-id="${t.id}" min="1" value="${t.days_after}" />
        </div>
      </div>
      <div class="field-label" style="margin-top:8px;">訊息內容</div>
      <textarea class="tpl-message" data-id="${t.id}" rows="3">${escapeHtml(t.message)}</textarea>
      <label style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <input type="checkbox" class="tpl-enabled" data-id="${t.id}" ${t.enabled ? 'checked' : ''} />
        <span style="font-size:13px;color:#6B6355;">啟用(關閉後客戶頁面不會顯示這個選項)</span>
      </label>
      <button type="button" class="secondary-btn tpl-save-btn" data-id="${t.id}" style="margin-top:8px;">儲存這則模板</button>
    </div>`
    )
    .join('');

  listEl.querySelectorAll('.tpl-save-btn').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const label = listEl.querySelector(`.tpl-label[data-id="${id}"]`).value.trim();
      const days_after = Number(listEl.querySelector(`.tpl-days[data-id="${id}"]`).value);
      const message = listEl.querySelector(`.tpl-message[data-id="${id}"]`).value.trim();
      const enabled = listEl.querySelector(`.tpl-enabled[data-id="${id}"]`).checked;
      if (!label || !days_after || !message) {
        alert('標籤、天數、訊息內容都不能是空的');
        return;
      }
      btn.disabled = true;
      btn.textContent = '儲存中...';
      try {
        await updateFollowUpTemplate(id, { label, days_after, message, enabled });
        btn.textContent = '已儲存';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '儲存這則模板';
        }, 1200);
      } catch (err) {
        console.error(err);
        alert('儲存失敗:' + err.message);
        btn.disabled = false;
        btn.textContent = '儲存這則模板';
      }
    };
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
