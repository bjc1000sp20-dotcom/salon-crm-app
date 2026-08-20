import { updateSalon, listClientsWithLine, getSignedUrl } from '../lib/data.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';
import { ensureDefaultFollowUpTemplates, updateFollowUpTemplate } from '../lib/lineIntegration.js';
import { ensureDefaultMessageTemplates, renderMessageVars } from '../lib/messageTemplates.js';
import { BIRTHDAY_VARS, renderBirthdayVars, sendTestBirthdayMessage } from '../lib/birthdays.js';
import { APPOINTMENT_CONFIRM_VARS, renderAppointmentConfirmVars } from '../lib/appointmentConfirm.js';
import { uploadStudioInfoImage, deleteStudioInfoImage } from '../lib/studioInfo.js';
import { openStudioInfoViewer } from '../components/studioInfoViewer.js';

export function renderSettings(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="header">
        <div>
          <div class="header-eyebrow">SETTINGS</div>
          <h1 class="header-title">設定</h1>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn-ghost" id="logout-btn" style="height:38px;">登出</button>
          ${homeButtonHtml()}
        </div>
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
          <div class="field-label" style="margin-bottom:6px;">工作室資訊圖片</div>
          <div class="field-hint" style="margin-bottom:12px;">可以放工作室位置、地址、交通方式、停車資訊、門口照片或到店注意事項,新增預約完成後會自動顯示,方便一起傳給客戶。</div>
          <div id="studio-info-image-preview"></div>
          <input type="file" id="studio-info-image-input" accept="image/*" class="hidden" />
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button type="button" class="secondary-btn" id="studio-info-upload-btn" style="margin-top:0;">上傳/更換圖片</button>
            <button type="button" class="secondary-btn" id="studio-info-delete-btn" style="margin-top:0;">刪除圖片</button>
          </div>
        </div>

        <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
          <div class="field-label" style="margin-bottom:10px;">LINE 自動追蹤訊息模板</div>
          <div class="field-hint" style="margin-bottom:12px;">這些是客戶頁面「LINE 自動追蹤」勾選清單裡的預設選項,可以自己修改標籤、天數與訊息內容。修改後不會影響已經建立好的排程。</div>
          <div id="templates-list">載入中...</div>
        </div>

        <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
          <div class="field-label" style="margin-bottom:6px;">LINE 話術管理</div>
          <div class="field-hint" style="margin-bottom:12px;">集中管理常用的固定話術(分類、常用標記),追蹤客戶時可以直接選一則帶入,不用每次重新打字。</div>
          <button class="secondary-btn" id="open-message-templates-btn" style="margin-top:0;">前往話術管理</button>
        </div>

        <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
          <div class="field-label" style="margin-bottom:6px;">生日 LINE 話術</div>
          <div class="field-hint" style="margin-bottom:12px;">客戶生日當月會自動用這則訊息發送(需要客戶有開啟生日提醒、已綁定 LINE)。發送時間沿用系統既有的每日排程(約台灣時間早上10點),不支援自訂到分鐘。</div>
          <div class="field">
            <div class="field-label">訊息模板</div>
            <textarea id="f-birthday-template" rows="5" placeholder="例如:嗨 {{客戶姓名}}～生日月快樂🎂">${escapeHtml(app.salon.birthday_message_template || '')}</textarea>
            <div class="field-hint" style="margin-top:6px;">可用變數:${BIRTHDAY_VARS.map((v) => v.token).join('、')}</div>
          </div>
          <div class="field">
            <div class="field-label">優惠內容(選填,對應 {{優惠內容}})</div>
            <input type="text" id="f-birthday-offer" value="${escapeAttr(app.salon.birthday_offer_text || '')}" placeholder="例如:生日折價券 $200,消費滿 $2,000 即可使用" />
          </div>
          <div class="field">
            <div class="field-label">預覽(用範例資料)</div>
            <div id="birthday-preview" class="note-box" style="white-space:pre-wrap;"></div>
          </div>
          <button class="primary-btn" id="save-birthday-btn" style="margin-top:6px;">儲存生日話術</button>

          <div class="field" style="margin-top:16px;border-top:1px dashed #E5DCC8;padding-top:14px;">
            <div class="field-label">發送測試訊息</div>
            <select id="birthday-test-client">
              <option value="">選擇一位已綁定 LINE 的客戶...</option>
            </select>
            <button class="secondary-btn" id="send-birthday-test-btn" style="margin-top:8px;">發送測試訊息</button>
          </div>
        </div>

        <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
          <div class="field-label" style="margin-bottom:6px;">預約確認話術設定</div>
          <div class="field-hint" style="margin-bottom:12px;">新增/修改預約後,會用這則模板產生「複製預約資訊」的內容,方便直接貼到 LINE 給客人確認。</div>
          <div class="field">
            <div class="field-label">訊息模板</div>
            <textarea id="f-appt-confirm-template" rows="5" placeholder="例如:${escapeAttr('您好 {{客戶姓名}},已為您預約 {{預約日期}} {{預約時間}},期待您的光臨!')}">${escapeHtml(app.salon.appointment_confirm_template || '')}</textarea>
            <div class="field-hint" style="margin-top:6px;">可用變數:${APPOINTMENT_CONFIRM_VARS.map((v) => v.token).join('、')}</div>
          </div>
          <div class="field">
            <div class="field-label">預覽(用範例資料)</div>
            <div id="appt-confirm-template-preview" class="note-box" style="white-space:pre-wrap;"></div>
          </div>
          <button class="primary-btn" id="save-appt-confirm-template-btn" style="margin-top:6px;">儲存預約確認話術</button>
        </div>

        <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
          <div class="field-label" style="margin-bottom:6px;">常用話語管理</div>
          <div class="field-hint" style="margin-bottom:12px;">先設定好常用的提醒句子(例如:不需提早到、停車提醒),預約完成後可以直接勾選加入預約確認訊息,不用每次重新打字。</div>
          <button class="secondary-btn" id="open-quick-phrases-btn" style="margin-top:0;">前往常用話語管理</button>
        </div>

        <div style="text-align:center;color:#B8AE9A;font-size:12px;margin:20px 0 90px;">版本 ${__APP_VERSION__.slice(0, 16).replace('T', ' ')}</div>
      </div>
      ${tabBarHtml('settings')}
    </div>
  `;

  bindTabBar(app);
  bindHomeButton(app);
  document.getElementById('logout-btn').onclick = () => app.signOut();
  document.getElementById('open-message-templates-btn').onclick = () => app.navigate('messageTemplates');
  document.getElementById('open-quick-phrases-btn').onclick = () => app.navigate('quickPhrases');

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
  setupBirthdaySettings(app);
  setupAppointmentConfirmSettings(app);
  setupStudioInfoImage(app);
}

function setupStudioInfoImage(app) {
  const previewEl = document.getElementById('studio-info-image-preview');
  const uploadBtn = document.getElementById('studio-info-upload-btn');
  const deleteBtn = document.getElementById('studio-info-delete-btn');
  const inputEl = document.getElementById('studio-info-image-input');

  async function renderPreview() {
    if (!app.salon.studio_info_image_path) {
      previewEl.innerHTML = `<div class="field-hint">尚未上傳圖片</div>`;
      deleteBtn.style.display = 'none';
      return;
    }
    deleteBtn.style.display = '';
    previewEl.innerHTML = `<div class="field-hint">載入中...</div>`;
    try {
      const url = await getSignedUrl('studio-info', app.salon.studio_info_image_path);
      previewEl.innerHTML = `<img src="${url}" style="max-width:160px;max-height:160px;border-radius:10px;object-fit:contain;cursor:pointer;" id="studio-info-preview-img" />`;
      document.getElementById('studio-info-preview-img').onclick = () => openStudioInfoViewer(url);
    } catch (err) {
      previewEl.innerHTML = `<div class="field-hint">圖片讀取失敗:${escapeHtml(err.message)}</div>`;
    }
  }

  uploadBtn.onclick = () => inputEl.click();
  inputEl.onchange = async () => {
    const file = inputEl.files[0];
    inputEl.value = '';
    if (!file) return;
    uploadBtn.disabled = true;
    uploadBtn.textContent = '上傳中...';
    try {
      const updated = await uploadStudioInfoImage(app.salon.id, file);
      app.salon = updated;
      await renderPreview();
    } catch (err) {
      alert('上傳失敗:' + err.message);
    }
    uploadBtn.disabled = false;
    uploadBtn.textContent = '上傳/更換圖片';
  };

  deleteBtn.onclick = async () => {
    if (!confirm('確定要刪除工作室資訊圖片嗎?')) return;
    try {
      const updated = await deleteStudioInfoImage(app.salon.id, app.salon.studio_info_image_path);
      app.salon = updated;
      await renderPreview();
    } catch (err) {
      alert('刪除失敗:' + err.message);
    }
  };

  renderPreview();
}

function setupAppointmentConfirmSettings(app) {
  const templateEl = document.getElementById('f-appt-confirm-template');
  const previewEl = document.getElementById('appt-confirm-template-preview');

  function updatePreview() {
    previewEl.textContent =
      renderAppointmentConfirmVars(templateEl.value, {
        clientName: '王小姐',
        appointmentDate: '2026-08-25',
        appointmentTime: '14:30',
        serviceNames: '深層清潔',
      }) || '(尚未填寫模板)';
  }
  templateEl.addEventListener('input', updatePreview);
  updatePreview();

  const saveBtn = document.getElementById('save-appt-confirm-template-btn');
  saveBtn.onclick = async () => {
    const appointment_confirm_template = templateEl.value.trim();
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';
    try {
      const updated = await updateSalon(app.salon.id, { appointment_confirm_template });
      app.salon = updated;
      saveBtn.textContent = '已儲存';
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存預約確認話術';
      }, 1200);
    } catch (err) {
      alert('儲存失敗:' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存預約確認話術';
    }
  };
}

function setupBirthdaySettings(app) {
  const templateEl = document.getElementById('f-birthday-template');
  const offerEl = document.getElementById('f-birthday-offer');
  const previewEl = document.getElementById('birthday-preview');

  function updatePreview() {
    previewEl.textContent = renderBirthdayVars(templateEl.value, {
      clientName: '王小姐',
      birthdayMonth: 8,
      birthdayDate: 25,
      offerText: offerEl.value,
    }) || '(尚未填寫模板)';
  }
  templateEl.addEventListener('input', updatePreview);
  offerEl.addEventListener('input', updatePreview);
  updatePreview();

  const saveBtn = document.getElementById('save-birthday-btn');
  saveBtn.onclick = async () => {
    const birthday_message_template = templateEl.value.trim();
    const birthday_offer_text = offerEl.value.trim();
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';
    try {
      const updated = await updateSalon(app.salon.id, { birthday_message_template, birthday_offer_text });
      app.salon = updated;
      saveBtn.textContent = '已儲存';
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存生日話術';
      }, 1200);
    } catch (err) {
      alert('儲存失敗:' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = '儲存生日話術';
    }
  };

  const testSelect = document.getElementById('birthday-test-client');
  listClientsWithLine(app.salon.id)
    .then((clients) => {
      testSelect.innerHTML =
        `<option value="">選擇一位已綁定 LINE 的客戶...</option>` +
        clients.map((c) => `<option value="${c.line_user_id}" data-name="${escapeAttr(c.name)}">${escapeHtml(c.name)}</option>`).join('');
    })
    .catch((err) => console.error(err));

  document.getElementById('send-birthday-test-btn').onclick = async () => {
    const option = testSelect.selectedOptions[0];
    if (!testSelect.value) {
      alert('請先選擇一位客戶');
      return;
    }
    const btn = document.getElementById('send-birthday-test-btn');
    btn.disabled = true;
    btn.textContent = '發送中...';
    try {
      const message = renderBirthdayVars(templateEl.value, {
        clientName: option.dataset.name,
        birthdayMonth: 8,
        birthdayDate: 25,
        offerText: offerEl.value,
      });
      await sendTestBirthdayMessage(testSelect.value, message);
      alert('測試訊息已送出,請確認對方 LINE 有沒有收到。');
    } catch (err) {
      alert('發送失敗:' + err.message);
    }
    btn.disabled = false;
    btn.textContent = '發送測試訊息';
  };
}

async function loadTemplates(app) {
  const listEl = document.getElementById('templates-list');
  let templates;
  let messageTemplates;
  try {
    [templates, messageTemplates] = await Promise.all([
      ensureDefaultFollowUpTemplates(app.salon.id),
      ensureDefaultMessageTemplates(app.salon.id),
    ]);
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `讀取失敗:${escapeHtml(err.message)}`;
    return;
  }

  const aftercare = templates.filter((t) => (t.kind || 'aftercare_followup') === 'aftercare_followup');
  const appointmentReminder = templates.filter((t) => t.kind === 'appointment_reminder');
  const others = templates.filter((t) => t.kind && t.kind !== 'aftercare_followup' && t.kind !== 'appointment_reminder');

  listEl.innerHTML = `
    <div class="field-label" style="margin-top:4px;">術後追蹤模板</div>
    ${aftercare.map((t) => templateRowHtml(t, true, messageTemplates)).join('') || `<div class="empty-body">沒有模板</div>`}
    <div class="field-label" style="margin-top:18px;">預約提醒模板(可用 {date}／{time}／{service} 帶入預約的日期/時間/項目)</div>
    ${appointmentReminder.map((t) => templateRowHtml(t, false, messageTemplates)).join('') || `<div class="empty-body">沒有模板</div>`}
    ${
      others.length
        ? `<div class="field-label" style="margin-top:18px;">其他模板</div>${others.map((t) => templateRowHtml(t, true, messageTemplates)).join('')}`
        : ''
    }
  `;

  listEl.querySelectorAll('.tpl-template-select').forEach((select) => {
    select.onchange = () => {
      const template = messageTemplates.find((t) => t.id === select.value);
      if (!template) return;
      const textarea = listEl.querySelector(`.tpl-message[data-id="${select.dataset.id}"]`);
      if (textarea) textarea.value = renderMessageVars(template.message, { clientName: '' });
    };
  });

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

function templateRowHtml(t, isAftercare, messageTemplates) {
  return `
    <div class="field" style="border-top:1px dashed #E5DCC8;padding-top:12px;margin-top:12px;">
      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <div class="field-label">標籤</div>
          <input type="text" class="tpl-label" data-id="${t.id}" value="${escapeAttr(t.label)}" />
        </div>
        <div style="width:110px;">
          <div class="field-label">${isAftercare ? '幾天後' : '提前幾天'}</div>
          <input type="number" class="tpl-days" data-id="${t.id}" min="1" value="${t.days_after}" />
        </div>
      </div>
      ${
        messageTemplates && messageTemplates.length
          ? `<div class="field-label" style="margin-top:8px;">從話術庫套用(選填)</div>
             <select class="tpl-template-select" data-id="${t.id}">
               <option value="">選擇固定話術...</option>
               ${messageTemplates.map((mt) => `<option value="${mt.id}">${mt.is_favorite ? '⭐ ' : ''}${escapeHtml(mt.category)} - ${escapeHtml(mt.name)}</option>`).join('')}
             </select>`
          : ''
      }
      <div class="field-label" style="margin-top:8px;">訊息內容</div>
      <textarea class="tpl-message" data-id="${t.id}" rows="3">${escapeHtml(t.message)}</textarea>
      <label style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        <input type="checkbox" class="tpl-enabled" data-id="${t.id}" ${t.enabled ? 'checked' : ''} />
        <span style="font-size:13px;color:#6B6355;">啟用(關閉後客戶頁面不會顯示這個選項)</span>
      </label>
      <button type="button" class="secondary-btn tpl-save-btn" data-id="${t.id}" style="margin-top:8px;">儲存這則模板</button>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
