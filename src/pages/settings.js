import { updateSalon, listClientsWithLine, getSignedUrl } from '../lib/data.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';
import {
  ensureDefaultFollowUpTemplates,
  updateFollowUpTemplate,
  checkLineConnection,
  sendLineTestMessage,
} from '../lib/lineIntegration.js';
import { ensureDefaultMessageTemplates, renderMessageVars } from '../lib/messageTemplates.js';
import { BIRTHDAY_VARS, renderBirthdayVars, sendTestBirthdayMessage } from '../lib/birthdays.js';
import { APPOINTMENT_CONFIRM_VARS, renderAppointmentConfirmVars } from '../lib/appointmentConfirm.js';
import {
  listAllStudioImages,
  uploadStudioImage,
  updateStudioImage,
  deleteStudioImage,
  reorderStudioImages,
} from '../lib/studioInfo.js';
import { openStudioInfoViewer } from '../components/studioInfoViewer.js';

// 設定頁區塊的排序註冊表:以後再新增設定區塊,只要在這裡多加一筆,
// computeSectionOrder 就會自動把它排進「還沒存過順序」的區塊裡,不用改排序邏輯。
const SECTION_KEYS = [
  'salonInfo',
  'lineConnection',
  'studioImages',
  'lineTemplates',
  'messageTemplates',
  'birthdaySettings',
  'appointmentConfirm',
  'quickPhrases',
  'leadStatuses',
];
const SECTION_TITLES = {
  salonInfo: '工作室名稱與同意書',
  lineConnection: 'LINE 設定',
  studioImages: '工作室資訊圖片',
  lineTemplates: 'LINE 自動追蹤訊息模板',
  messageTemplates: 'LINE 話術管理',
  birthdaySettings: '生日 LINE 話術',
  appointmentConfirm: '預約確認話術設定',
  quickPhrases: '常用話語管理',
  leadStatuses: '追蹤狀態管理',
};

function computeSectionOrder(app) {
  const saved = Array.isArray(app.salon.settings_section_order) ? app.salon.settings_section_order : [];
  const known = saved.filter((k) => SECTION_KEYS.includes(k));
  const missing = SECTION_KEYS.filter((k) => !known.includes(k));
  return [...known, ...missing];
}

export function renderSettings(app, { reorderMode = false } = {}) {
  if (reorderMode) {
    renderReorderMode(app);
    return;
  }

  const order = computeSectionOrder(app);
  const sectionHtml = {
    salonInfo: salonInfoSectionHtml(app),
    lineConnection: lineConnectionSectionHtml(),
    studioImages: studioImagesSectionHtml(),
    lineTemplates: lineTemplatesSectionHtml(),
    messageTemplates: messageTemplatesSectionHtml(),
    birthdaySettings: birthdaySectionHtml(app),
    appointmentConfirm: appointmentConfirmSectionHtml(app),
    quickPhrases: quickPhrasesSectionHtml(),
    leadStatuses: leadStatusesSectionHtml(),
  };

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
        <button type="button" class="secondary-btn" id="open-reorder-btn" style="margin-top:0;margin-bottom:6px;">調整順序</button>
        ${order.map((key) => sectionHtml[key] || '').join('')}
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
  document.getElementById('open-lead-statuses-btn').onclick = () => app.navigate('leadStatuses');
  document.getElementById('open-reorder-btn').onclick = () => renderSettings(app, { reorderMode: true });

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
  setupStudioInfoImages(app);
  setupLineConnectionSettings(app);
}

// ---------------- 排序模式 ----------------

function renderReorderMode(app) {
  let workingOrder = computeSectionOrder(app);

  function render() {
    app.root.innerHTML = `
      <div class="screen">
        <div class="form-header">
          <button class="icon-btn" id="reorder-cancel-btn">←</button>
          <div class="form-header-title">調整設定順序</div>
          <div style="width:38px;"></div>
        </div>
        <div class="list-scroll" style="padding-top:16px;">
          <div class="field-hint" style="margin-bottom:12px;">拖曳 ☰ 或用上下箭頭調整順序,完成後記得按【儲存排序】。</div>
          <div id="reorder-list">
            ${workingOrder.map((key, idx) => reorderRowHtml(key, idx, workingOrder.length)).join('')}
          </div>
          <button type="button" class="primary-btn" id="reorder-save-btn" style="margin-top:16px;">儲存排序</button>
          <button type="button" class="secondary-btn" id="reorder-cancel-btn2">取消</button>
          <button type="button" class="secondary-btn" id="reorder-reset-btn">恢復預設排序</button>
        </div>
      </div>
    `;
    bind();
  }

  function bind() {
    document.getElementById('reorder-cancel-btn').onclick = () => renderSettings(app);
    document.getElementById('reorder-cancel-btn2').onclick = () => renderSettings(app);

    document.getElementById('reorder-save-btn').onclick = async () => {
      const saveBtn = document.getElementById('reorder-save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = '儲存中...';
      try {
        const updated = await updateSalon(app.salon.id, { settings_section_order: workingOrder });
        app.salon = updated;
        renderSettings(app);
      } catch (err) {
        alert('儲存失敗:' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存排序';
      }
    };

    document.getElementById('reorder-reset-btn').onclick = async () => {
      if (!confirm('確定要恢復設定頁預設順序嗎?')) return;
      try {
        const updated = await updateSalon(app.salon.id, { settings_section_order: null });
        app.salon = updated;
        renderSettings(app);
      } catch (err) {
        alert('操作失敗:' + err.message);
      }
    };

    const listEl = document.getElementById('reorder-list');

    listEl.querySelectorAll('.reorder-up-btn').forEach((btn) => {
      btn.onclick = () => {
        const idx = workingOrder.indexOf(btn.dataset.key);
        if (idx <= 0) return;
        [workingOrder[idx - 1], workingOrder[idx]] = [workingOrder[idx], workingOrder[idx - 1]];
        render();
      };
    });
    listEl.querySelectorAll('.reorder-down-btn').forEach((btn) => {
      btn.onclick = () => {
        const idx = workingOrder.indexOf(btn.dataset.key);
        if (idx < 0 || idx >= workingOrder.length - 1) return;
        [workingOrder[idx + 1], workingOrder[idx]] = [workingOrder[idx], workingOrder[idx + 1]];
        render();
      };
    });

    // 電腦滑鼠拖曳:原生 HTML5 drag
    listEl.querySelectorAll('.reorder-row').forEach((row) => {
      row.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', row.dataset.key);
        row.classList.add('dragging');
      };
      row.ondragend = () => row.classList.remove('dragging');
      row.ondragover = (e) => {
        e.preventDefault();
        const draggingEl = listEl.querySelector('.dragging');
        if (!draggingEl) return;
        const draggingKey = draggingEl.dataset.key;
        if (draggingKey === row.dataset.key) return;
        const fromIdx = workingOrder.indexOf(draggingKey);
        const toIdx = workingOrder.indexOf(row.dataset.key);
        if (fromIdx < 0 || toIdx < 0) return;
        workingOrder.splice(fromIdx, 1);
        workingOrder.splice(toIdx, 0, draggingKey);
        render();
      };
    });

    // 手機觸控拖曳:只在 ☰ 圖示上監聽,不影響整頁捲動
    listEl.querySelectorAll('.reorder-handle').forEach((handle) => {
      handle.onpointerdown = (e) => {
        const row = handle.closest('.reorder-row');
        const draggingKey = row.dataset.key;
        handle.setPointerCapture(e.pointerId);

        function onMove(ev) {
          const rows = Array.from(listEl.querySelectorAll('.reorder-row'));
          const hovered = rows.find((r) => {
            const rect = r.getBoundingClientRect();
            return ev.clientY >= rect.top && ev.clientY <= rect.bottom;
          });
          if (!hovered || hovered.dataset.key === draggingKey) return;
          const fromIdx = workingOrder.indexOf(draggingKey);
          const toIdx = workingOrder.indexOf(hovered.dataset.key);
          if (fromIdx < 0 || toIdx < 0) return;
          workingOrder.splice(fromIdx, 1);
          workingOrder.splice(toIdx, 0, draggingKey);
          render();
        }
        function onUp() {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
        }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      };
    });
  }

  render();
}

function reorderRowHtml(key, idx, total) {
  return `
    <div class="card reorder-row" draggable="true" data-key="${key}" style="cursor:default;align-items:center;gap:10px;margin-bottom:8px;">
      <span class="reorder-handle" style="touch-action:none;cursor:grab;font-size:20px;color:#9B8F7F;padding:4px;">☰</span>
      <div style="flex:1;">${escapeHtml(SECTION_TITLES[key] || key)}</div>
      <button type="button" class="btn-ghost reorder-up-btn" data-key="${key}" ${idx === 0 ? 'disabled' : ''} style="padding:4px 10px;">↑</button>
      <button type="button" class="btn-ghost reorder-down-btn" data-key="${key}" ${idx === total - 1 ? 'disabled' : ''} style="padding:4px 10px;">↓</button>
    </div>
  `;
}

// ---------------- 各設定區塊的內容(順序由外部組裝,內容本身不受排序影響) ----------------

function salonInfoSectionHtml(app) {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
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
  `;
}

function lineConnectionSectionHtml() {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
      <div class="field-label" style="margin-bottom:6px;">LINE 設定</div>
      <div class="field-hint" style="margin-bottom:12px;">如果更換了 LINE 官方帳號、Channel Access Token 或 Channel Secret,請先到 Vercel 後台更新環境變數並重新部署,再回來點下面按鈕確認連線。Channel Secret 與 Webhook 是否正常無法用這個按鈕檢查,請到 LINE Developers 後台的 Webhook 設定頁按「Verify」確認。</div>

      <button type="button" class="primary-btn" id="line-check-btn" style="margin-top:0;">測試 LINE 綁定</button>
      <div id="line-check-result" style="margin-top:10px;"></div>

      <div class="field" style="margin-top:16px;border-top:1px dashed #E5DCC8;padding-top:14px;">
        <div class="field-label">發送測試訊息</div>
        <select id="line-test-client">
          <option value="">選擇一位已綁定 LINE 的客戶...</option>
        </select>
        <button type="button" class="secondary-btn" id="line-send-test-btn" style="margin-top:8px;">發送測試</button>
        <div id="line-send-result" style="margin-top:10px;"></div>
      </div>
    </div>
  `;
}

function studioImagesSectionHtml() {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
      <div class="field-label" style="margin-bottom:6px;">工作室資訊圖片</div>
      <div class="field-hint" style="margin-bottom:12px;">可以放工作室位置、地址、交通方式、停車資訊、門口照片、到店注意事項等,想放幾張就放幾張。每張可以命名、排序、設定是否預設勾選,新增預約完成後可以挑這次要用哪幾張一起傳給客戶。</div>
      <div id="studio-info-images-list">載入中...</div>
      <input type="file" id="studio-info-image-input" accept="image/*" class="hidden" />
      <button type="button" class="secondary-btn" id="studio-info-add-btn" style="margin-top:10px;">＋新增工作室圖片</button>
    </div>
  `;
}

function lineTemplatesSectionHtml() {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
      <div class="field-label" style="margin-bottom:10px;">LINE 自動追蹤訊息模板</div>
      <div class="field-hint" style="margin-bottom:12px;">這些是客戶頁面「LINE 自動追蹤」勾選清單裡的預設選項,可以自己修改標籤、天數與訊息內容。修改後不會影響已經建立好的排程。</div>
      <div id="templates-list">載入中...</div>
    </div>
  `;
}

function messageTemplatesSectionHtml() {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
      <div class="field-label" style="margin-bottom:6px;">LINE 話術管理</div>
      <div class="field-hint" style="margin-bottom:12px;">集中管理常用的固定話術(分類、常用標記),追蹤客戶時可以直接選一則帶入,不用每次重新打字。</div>
      <button class="secondary-btn" id="open-message-templates-btn" style="margin-top:0;">前往話術管理</button>
    </div>
  `;
}

function birthdaySectionHtml(app) {
  return `
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
  `;
}

function appointmentConfirmSectionHtml(app) {
  return `
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
  `;
}

function quickPhrasesSectionHtml() {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
      <div class="field-label" style="margin-bottom:6px;">常用話語管理</div>
      <div class="field-hint" style="margin-bottom:12px;">先設定好常用的提醒句子(例如:不需提早到、停車提醒),預約完成後可以直接勾選加入預約確認訊息,不用每次重新打字。</div>
      <button class="secondary-btn" id="open-quick-phrases-btn" style="margin-top:0;">前往常用話語管理</button>
    </div>
  `;
}

function leadStatusesSectionHtml() {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-top:16px;">
      <div class="field-label" style="margin-bottom:6px;">追蹤狀態管理</div>
      <div class="field-hint" style="margin-bottom:12px;">管理「提醒追蹤客戶」的目前進度選項(例如:待付訂金、考慮中),可以自己新增、修改、排序。</div>
      <button class="secondary-btn" id="open-lead-statuses-btn" style="margin-top:0;">前往追蹤狀態管理</button>
    </div>
  `;
}

function setupLineConnectionSettings(app) {
  const checkBtn = document.getElementById('line-check-btn');
  const checkResultEl = document.getElementById('line-check-result');
  checkBtn.onclick = async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = '測試中...';
    checkResultEl.innerHTML = '';
    try {
      const result = await checkLineConnection();
      if (result.ok) {
        checkResultEl.innerHTML = `
          <div class="note-box" style="color:#4E8B5C;">
            LINE 串接正常 ✓<br />
            目前綁定:${escapeHtml(result.displayName || '(無名稱)')}<br />
            Basic ID:${escapeHtml(result.basicId || '未知')}
          </div>
        `;
      } else {
        checkResultEl.innerHTML = `
          <div class="note-box" style="color:#B5533C;">
            LINE 測試失敗<br />
            原因:${escapeHtml(result.error || '未知錯誤')}
          </div>
        `;
      }
    } catch (err) {
      checkResultEl.innerHTML = `<div class="note-box" style="color:#B5533C;">LINE 測試失敗<br />原因:${escapeHtml(err.message)}</div>`;
    }
    checkBtn.disabled = false;
    checkBtn.textContent = '測試 LINE 綁定';
  };

  const testSelect = document.getElementById('line-test-client');
  listClientsWithLine(app.salon.id)
    .then((clients) => {
      testSelect.innerHTML =
        `<option value="">選擇一位已綁定 LINE 的客戶...</option>` +
        clients.map((c) => `<option value="${c.line_user_id}" data-name="${escapeAttr(c.name)}">${escapeHtml(c.name)}</option>`).join('');
    })
    .catch((err) => console.error(err));

  const sendBtn = document.getElementById('line-send-test-btn');
  const sendResultEl = document.getElementById('line-send-result');
  sendBtn.onclick = async () => {
    const option = testSelect.selectedOptions[0];
    if (!testSelect.value) {
      alert('請先選擇一位客戶');
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = '發送中...';
    sendResultEl.innerHTML = '';
    const clientName = option.dataset.name;
    try {
      await sendLineTestMessage(testSelect.value, 'CRM LINE 綁定測試成功');
      sendResultEl.innerHTML = `
        <div class="note-box" style="color:#4E8B5C;">
          LINE 測試成功 ✓<br />
          測試時間:${formatDateTime(new Date())}<br />
          發送對象:${escapeHtml(clientName)}<br />
          訊息狀態:發送成功
        </div>
      `;
    } catch (err) {
      sendResultEl.innerHTML = `
        <div class="note-box" style="color:#B5533C;">
          LINE 測試失敗<br />
          原因:${escapeHtml(classifySendError(err.message))}
        </div>
      `;
    }
    sendBtn.disabled = false;
    sendBtn.textContent = '發送測試';
  };
}

function classifySendError(message) {
  if (!message) return 'API 連線失敗,請確認網路狀況或稍後再試';
  if (/error 401/i.test(message)) return 'Channel Access Token 無效或已過期';
  if (/error 403/i.test(message)) return '權限不足';
  if (/userId/i.test(message) && /error 400/i.test(message)) return 'userId 無效';
  if (/(not.*friend|blocked|無法傳送)/i.test(message)) return '客戶可能已封鎖官方帳號或尚未加入好友';
  if (/error 400/i.test(message)) return `請求格式錯誤(${message})`;
  return message;
}

function formatDateTime(d) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function setupStudioInfoImages(app) {
  const listEl = document.getElementById('studio-info-images-list');
  const addBtn = document.getElementById('studio-info-add-btn');
  const inputEl = document.getElementById('studio-info-image-input');
  const urlCache = new Map();

  addBtn.onclick = () => inputEl.click();
  inputEl.onchange = async () => {
    const file = inputEl.files[0];
    inputEl.value = '';
    if (!file) return;
    const name = prompt('這張圖片的名稱(例如:工作室位置、停車資訊)') || '';
    addBtn.disabled = true;
    addBtn.textContent = '上傳中...';
    try {
      await uploadStudioImage(app.salon.id, file, name.trim());
      await loadList();
    } catch (err) {
      alert('上傳失敗:' + err.message);
    }
    addBtn.disabled = false;
    addBtn.textContent = '＋新增工作室圖片';
  };

  async function loadList() {
    let images;
    try {
      images = await listAllStudioImages(app.salon.id);
    } catch (err) {
      listEl.innerHTML = `<div class="field-hint">讀取失敗:${escapeHtml(err.message)}</div>`;
      return;
    }
    if (!images.length) {
      listEl.innerHTML = `<div class="field-hint">尚未上傳任何圖片</div>`;
      return;
    }
    listEl.innerHTML = images.map((img, idx) => studioImageRowHtml(img, idx, images.length)).join('');

    images.forEach((img) => {
      getSignedUrl('studio-info', img.storage_path)
        .then((url) => {
          urlCache.set(img.storage_path, url);
          const thumb = listEl.querySelector(`.studio-img-thumb[data-id="${img.id}"]`);
          if (thumb) thumb.src = url;
        })
        .catch(() => {});
    });

    listEl.querySelectorAll('.studio-img-thumb').forEach((thumbEl) => {
      thumbEl.onclick = async () => {
        const resolved = await Promise.all(
          images.map(async (im) => ({
            name: im.name,
            url: urlCache.get(im.storage_path) || (await getSignedUrl('studio-info', im.storage_path)),
          }))
        );
        const idx = images.findIndex((im) => im.id === thumbEl.dataset.id);
        openStudioInfoViewer(resolved, idx);
      };
    });
    listEl.querySelectorAll('.studio-img-up-btn').forEach((btn) => {
      btn.onclick = async () => {
        const idx = images.findIndex((im) => im.id === btn.dataset.id);
        if (idx <= 0) return;
        [images[idx - 1], images[idx]] = [images[idx], images[idx - 1]];
        await reorderStudioImages(images.map((im) => im.id));
        await loadList();
      };
    });
    listEl.querySelectorAll('.studio-img-down-btn').forEach((btn) => {
      btn.onclick = async () => {
        const idx = images.findIndex((im) => im.id === btn.dataset.id);
        if (idx < 0 || idx >= images.length - 1) return;
        [images[idx + 1], images[idx]] = [images[idx], images[idx + 1]];
        await reorderStudioImages(images.map((im) => im.id));
        await loadList();
      };
    });
    listEl.querySelectorAll('.studio-img-rename-btn').forEach((btn) => {
      btn.onclick = async () => {
        const im = images.find((x) => x.id === btn.dataset.id);
        const name = prompt('修改圖片名稱', im.name || '');
        if (name === null) return;
        await updateStudioImage(im.id, { name: name.trim() });
        await loadList();
      };
    });
    listEl.querySelectorAll('.studio-img-default-btn').forEach((btn) => {
      btn.onclick = async () => {
        const im = images.find((x) => x.id === btn.dataset.id);
        await updateStudioImage(im.id, { default_selected: !im.default_selected });
        await loadList();
      };
    });
    listEl.querySelectorAll('.studio-img-toggle-btn').forEach((btn) => {
      btn.onclick = async () => {
        const im = images.find((x) => x.id === btn.dataset.id);
        await updateStudioImage(im.id, { enabled: !im.enabled });
        await loadList();
      };
    });
    listEl.querySelectorAll('.studio-img-delete-btn').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('確定要刪除這張圖片嗎?')) return;
        const im = images.find((x) => x.id === btn.dataset.id);
        await deleteStudioImage(im.id, im.storage_path);
        await loadList();
      };
    });
  }

  loadList();
}

function studioImageRowHtml(img, idx, total) {
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-bottom:10px;opacity:${img.enabled ? 1 : 0.55};">
      <div style="display:flex;align-items:center;gap:10px;">
        <img class="studio-img-thumb" data-id="${img.id}" src="" style="width:56px;height:56px;border-radius:8px;object-fit:cover;background:#EFE9DA;cursor:pointer;flex-shrink:0;" />
        <div style="flex:1;">
          <div class="card-name">${escapeHtml(img.name || '(未命名)')}</div>
          <div class="card-sub">${img.enabled ? '啟用中' : '已停用'}${img.default_selected ? '・預設勾選' : ''}</div>
        </div>
        <button type="button" class="btn-ghost studio-img-up-btn" data-id="${img.id}" ${idx === 0 ? 'disabled' : ''} style="padding:4px 10px;">↑</button>
        <button type="button" class="btn-ghost studio-img-down-btn" data-id="${img.id}" ${idx === total - 1 ? 'disabled' : ''} style="padding:4px 10px;">↓</button>
      </div>
      <div class="visit-tags" style="margin-top:10px;">
        <button type="button" class="tag studio-img-rename-btn" data-id="${img.id}" style="cursor:pointer;border:none;background:#F0EADA;">改名</button>
        <button type="button" class="tag studio-img-default-btn" data-id="${img.id}" style="cursor:pointer;border:none;background:${img.default_selected ? '#EDE7F5' : '#F0EADA'};">${img.default_selected ? '取消預設勾選' : '設為預設勾選'}</button>
        <button type="button" class="tag studio-img-toggle-btn" data-id="${img.id}" style="cursor:pointer;border:none;background:${img.enabled ? '#F5E3DC' : '#E7EFE4'};color:${img.enabled ? '#B5533C' : '#4E8B5C'};">${img.enabled ? '停用' : '啟用'}</button>
        <button type="button" class="tag studio-img-delete-btn" data-id="${img.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">刪除</button>
      </div>
    </div>
  `;
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
