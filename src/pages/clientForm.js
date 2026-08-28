import { createClient, updateClient, getClient, uploadSignature, uploadConsentSignature } from '../lib/data.js';
import { signaturePadHtml, setupSignaturePad } from '../components/signaturePad.js';
import { SOURCES } from '../lib/sources.js';
import { SKINCARE_TYPES, SKIN_CONCERNS, SKIN_TYPES } from '../lib/intakeOptions.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';
import { computeClientSectionOrder } from '../lib/clientSectionOrder.js';
import { renderClientSectionReorderMode } from '../components/clientSectionReorderMode.js';

// 是/否 兩顆 chip 的固定樣式,name 是欄位名稱(用來做 id/data 屬性)
function yesNoHtml(name, label, value) {
  return `
    <div class="field">
      <div class="field-label">${label}</div>
      <div class="service-grid">
        <button type="button" class="service-chip yn-chip" data-field="${name}" data-v="true">是</button>
        <button type="button" class="service-chip yn-chip" data-field="${name}" data-v="false">否</button>
      </div>
    </div>
  `;
}

// iPad Safari 對 <input type="date"> 的原生日期選擇器實測仍然選不到「日」,
// 所以生日改用年/月/日三個獨立下拉選單,存檔時再合併成 YYYY-MM-DD,不依賴任何瀏覽器原生日期元件。
function parseBirthDate(str) {
  if (!str) return { year: '', month: '', day: '' };
  const [y, m, d] = str.split('-');
  return { year: y || '', month: m || '', day: d || '' };
}

function daysInMonth(year, month) {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

function birthYearOptionsHtml(selected) {
  const currentYear = new Date().getFullYear();
  let options = '<option value="">年</option>';
  for (let y = currentYear; y >= currentYear - 100; y--) {
    options += `<option value="${y}" ${String(y) === selected ? 'selected' : ''}>${y}</option>`;
  }
  return options;
}

function birthMonthOptionsHtml(selected) {
  let options = '<option value="">月</option>';
  for (let m = 1; m <= 12; m++) {
    const v = String(m).padStart(2, '0');
    options += `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`;
  }
  return options;
}

function birthDayOptionsHtml(maxDay, selected) {
  let options = '<option value="">日</option>';
  for (let d = 1; d <= maxDay; d++) {
    const v = String(d).padStart(2, '0');
    options += `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`;
  }
  return options;
}

function multiSelectHtml(name, options, selected) {
  const sel = selected || [];
  return `
    <div class="service-grid" id="ms-${name}">
      ${options
        .map(
          (opt) =>
            `<button type="button" class="service-chip ms-chip${sel.includes(opt) ? ' on' : ''}" data-field="${name}" data-v="${escapeAttr(opt)}" style="${sel.includes(opt) ? 'background:#B8886B;' : ''}">${opt}</button>`
        )
        .join('')}
    </div>
  `;
}

// ---------------- 各可排序欄位/區塊的內容(順序由 computeClientSectionOrder 決定,內容本身不受排序影響) ----------------

function basicNameFieldHtml(client) {
  return `
    <div class="field">
      <div class="field-label">姓名<span class="req"> *</span></div>
      <input type="text" id="f-name" value="${escapeAttr(client?.name)}" placeholder="客戶姓名" />
    </div>
  `;
}

function basicPhoneFieldHtml(client) {
  return `
    <div class="field">
      <div class="field-label">電話</div>
      <input type="tel" id="f-phone" value="${escapeAttr(client?.phone)}" placeholder="09xx-xxx-xxx" />
    </div>
  `;
}

function basicBirthdayFieldHtml(client) {
  const parsed = parseBirthDate(client?.birth_date);
  return `
    <div class="field">
      <div class="field-label">生日</div>
      <div style="display:flex;gap:8px;">
        <select id="f-birth-year" style="flex:1;">${birthYearOptionsHtml(parsed.year)}</select>
        <select id="f-birth-month" style="flex:1;">${birthMonthOptionsHtml(parsed.month)}</select>
        <select id="f-birth-day" style="flex:1;">${birthDayOptionsHtml(31, parsed.day)}</select>
      </div>
      <div class="field-hint">生日提醒開關移到客戶詳情頁的「LINE 自動追蹤」區塊設定。</div>
    </div>
  `;
}

function basicAddressFieldHtml(client) {
  return `
    <div class="field">
      <div class="field-label">地址</div>
      <input type="text" id="f-address" value="${escapeAttr(client?.address)}" placeholder="通訊地址" />
    </div>
  `;
}

function basicGenderFieldHtml(client) {
  return `
    <div class="row-2">
      <div class="field">
        <div class="field-label">性別</div>
        <div class="service-grid">
          <button type="button" class="service-chip gender-chip${client?.gender === 'F' ? ' on' : ''}" data-g="F" style="${client?.gender === 'F' ? 'background:#B8886B;' : ''}">女</button>
          <button type="button" class="service-chip gender-chip${client?.gender === 'M' ? ' on' : ''}" data-g="M" style="${client?.gender === 'M' ? 'background:#8B7D9B;' : ''}">男</button>
        </div>
      </div>
    </div>
  `;
}

function basicSourceFieldHtml(client) {
  return `
    <div class="field">
      <div class="field-label">客戶來源</div>
      <div class="service-grid">
        ${SOURCES.map(
          (s) => `<button type="button" class="service-chip source-chip${client?.source === s.id ? ' on' : ''}" data-s="${s.id}" style="${client?.source === s.id ? `background:${s.color};` : ''}">${s.name}</button>`
        ).join('')}
      </div>
    </div>
    <div class="field">
      <div class="field-label">來源詳細(介紹人姓名 / 平台名稱)</div>
      <input type="text" id="f-source-detail" value="${escapeAttr(client?.source_detail)}" placeholder="例如:王小姐介紹、Instagram 廣告" />
    </div>
  `;
}

function questionnaireFieldHtml(client) {
  return `
    <div class="section-label" style="margin-top:10px;">基本狀況問卷</div>
    ${yesNoHtml('history_treatment', '是否曾經有用藥、擦酸類、整形手術、雷射、任何其他皮膚課程')}
    ${yesNoHtml('history_supplement', '是否有額外補充營養食品')}
    <div class="field">
      <div class="field-label">營養食品品牌(選填)</div>
      <input type="text" id="f-supplement-brand" value="${escapeAttr(client?.history_supplement_brand)}" placeholder="品牌" />
    </div>
    ${yesNoHtml('history_allergy', '是否曾經有肌膚過敏史')}
    ${yesNoHtml('makeup_habit', '平時是否有化妝習慣')}
    ${yesNoHtml('uses_skincare', '平時是否有使用保養品')}
    <div class="field">
      <div class="field-label">保養品品牌(選填)</div>
      <input type="text" id="f-skincare-brand" value="${escapeAttr(client?.skincare_brand)}" placeholder="品牌" />
    </div>
    <div class="field">
      <div class="field-label">目前使用保養品類型(可複選)</div>
      ${multiSelectHtml('skincare_types', SKINCARE_TYPES, client?.skincare_types)}
    </div>
    <div class="field">
      <div class="field-label">日常一天喝水量</div>
      <input type="text" id="f-water" value="${escapeAttr(client?.daily_water_intake)}" placeholder="例如:1500ml" />
    </div>
    <div class="field">
      <div class="field-label">最想解決的肌膚問題(可複選)</div>
      ${multiSelectHtml('skin_concerns', SKIN_CONCERNS, client?.skin_concerns)}
    </div>
  `;
}

function skinTypeStaffFieldHtml(client) {
  return `
    <div class="section-label" style="margin-top:10px;">以下由美容師填寫</div>
    <div class="field">
      <div class="field-label">皮膚類型</div>
      <div class="service-grid">
        ${SKIN_TYPES.map(
          (t) => `<button type="button" class="service-chip skin-type-chip${client?.skin_type === t.id ? ' on' : ''}" data-t="${t.id}" style="${client?.skin_type === t.id ? 'background:#3A332B;' : ''}">${t.name}</button>`
        ).join('')}
      </div>
    </div>
  `;
}

// 簽名整合成一份:新增客戶時只簽一次,同一份簽名同時套用到「客戶簽名」與「同意書簽名」兩個既有欄位,
// 不會因為不同區塊要求客人重複簽名。編輯模式維持顯示既有簽名的靜態圖片,不用重簽。
function signatureFieldHtml(isEdit, client, app) {
  if (!isEdit) {
    return `
      <div class="section-label" style="margin-top:10px;">同意書與簽名</div>
      <div class="field-hint" style="margin-bottom:10px;">客戶第一次到店建卡,請在此一併確認同意書內容。</div>
      <div class="note-box" style="margin-bottom:16px;">${escapeHtml(app.salon.consent_template)}</div>

      <div class="field">
        <div class="field-label">照片拍攝與公開使用授權</div>
        <div class="field-hint" style="margin-bottom:10px;">本人同意工作室於服務過程中拍攝照片或影像,並同意將相關照片作為案例紀錄、教學或社群分享使用。</div>
        <div class="service-grid">
          <button type="button" class="service-chip photo-consent-chip" data-v="true">同意</button>
          <button type="button" class="service-chip photo-consent-chip" data-v="false">不同意</button>
        </div>
      </div>

      <div class="field">
        <div class="field-label">簽名<span class="req"> *</span></div>
        ${signaturePadHtml('sig-pad')}
      </div>
    `;
  }
  return client?.signature_url
    ? `
    <div class="field">
      <div class="field-label">客戶簽名</div>
      <img class="sig-static-img" id="sig-static-img" alt="簽名" />
    </div>`
    : '';
}

export async function renderClientForm(app) {
  const isEdit = app.params.mode === 'edit';
  const client = isEdit ? await getClient(app.params.clientId) : null;

  const sectionOrder = computeClientSectionOrder(app);
  const sectionHtml = {
    basicName: basicNameFieldHtml(client),
    basicPhone: basicPhoneFieldHtml(client),
    basicBirthday: basicBirthdayFieldHtml(client),
    basicAddress: basicAddressFieldHtml(client),
    basicGender: basicGenderFieldHtml(client),
    basicSource: basicSourceFieldHtml(client),
    questionnaire: questionnaireFieldHtml(client),
    skinTypeStaff: skinTypeStaffFieldHtml(client),
    signature: signatureFieldHtml(isEdit, client, app),
  };

  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">${isEdit ? '編輯客戶資料' : '新增客戶'}</div>
        ${homeButtonHtml()}
      </div>
      <div class="form-scroll">
        <button type="button" class="secondary-btn" id="cf-open-reorder-btn" style="margin-top:0;margin-bottom:6px;">調整欄位順序</button>

        ${sectionOrder.map((key) => sectionHtml[key] || '').join('')}
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="save-btn">${isEdit ? '儲存變更' : '建立客戶卡'}</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () =>
    isEdit ? app.navigate('clientDetail', { clientId: client.id }) : app.navigate('clientList');
  bindHomeButton(app);
  document.getElementById('cf-open-reorder-btn').onclick = () =>
    renderClientSectionReorderMode(app, { returnTo: { view: 'clientForm', params: app.params } });

  const birthYearSelect = document.getElementById('f-birth-year');
  const birthMonthSelect = document.getElementById('f-birth-month');
  const birthDaySelect = document.getElementById('f-birth-day');
  function refreshBirthDayOptions() {
    const currentDay = birthDaySelect.value;
    const maxDay = daysInMonth(birthYearSelect.value, birthMonthSelect.value);
    birthDaySelect.innerHTML = birthDayOptionsHtml(maxDay, Number(currentDay) <= maxDay ? currentDay : '');
  }
  birthYearSelect.onchange = refreshBirthDayOptions;
  birthMonthSelect.onchange = refreshBirthDayOptions;
  refreshBirthDayOptions();

  function buildBirthDate() {
    const y = birthYearSelect.value;
    const m = birthMonthSelect.value;
    const d = birthDaySelect.value;
    return y && m && d ? `${y}-${m}-${d}` : null;
  }

  let gender = client?.gender || '';
  document.querySelectorAll('.gender-chip').forEach((chip) => {
    chip.onclick = () => {
      gender = chip.dataset.g;
      document.querySelectorAll('.gender-chip').forEach((c) => {
        c.classList.remove('on');
        c.style.background = '';
      });
      chip.classList.add('on');
      chip.style.background = chip.dataset.g === 'F' ? '#B8886B' : '#8B7D9B';
    };
  });

  let source = client?.source || '';
  document.querySelectorAll('.source-chip').forEach((chip) => {
    chip.onclick = () => {
      const s = SOURCES.find((x) => x.id === chip.dataset.s);
      const alreadyOn = chip.classList.contains('on');
      document.querySelectorAll('.source-chip').forEach((c) => {
        c.classList.remove('on');
        c.style.background = '';
      });
      if (alreadyOn) {
        source = ''; // 再點一次取消選擇
      } else {
        source = s.id;
        chip.classList.add('on');
        chip.style.background = s.color;
      }
    };
  });

  let skinType = client?.skin_type || '';
  document.querySelectorAll('.skin-type-chip').forEach((chip) => {
    chip.onclick = () => {
      const alreadyOn = chip.classList.contains('on');
      document.querySelectorAll('.skin-type-chip').forEach((c) => {
        c.classList.remove('on');
        c.style.background = '';
      });
      if (alreadyOn) {
        skinType = '';
      } else {
        skinType = chip.dataset.t;
        chip.classList.add('on');
        chip.style.background = '#3A332B';
      }
    };
  });

  // 是/否 問卷欄位,用一個物件存目前的答案(true/false/undefined = 未填)
  const yesNoAnswers = {
    history_treatment: client?.history_treatment ?? null,
    history_supplement: client?.history_supplement ?? null,
    history_allergy: client?.history_allergy ?? null,
    makeup_habit: client?.makeup_habit ?? null,
    uses_skincare: client?.uses_skincare ?? null,
  };
  document.querySelectorAll('.yn-chip').forEach((chip) => {
    const field = chip.dataset.field;
    const v = chip.dataset.v === 'true';
    if (yesNoAnswers[field] === v) {
      chip.classList.add('on');
      chip.style.background = '#3A332B';
    }
    chip.onclick = () => {
      yesNoAnswers[field] = v;
      document.querySelectorAll(`.yn-chip[data-field="${field}"]`).forEach((c) => {
        c.classList.remove('on');
        c.style.background = '';
      });
      chip.classList.add('on');
      chip.style.background = '#3A332B';
    };
  });

  // 多選欄位(保養品類型、肌膚問題)
  const multiAnswers = {
    skincare_types: [...(client?.skincare_types || [])],
    skin_concerns: [...(client?.skin_concerns || [])],
  };
  document.querySelectorAll('.ms-chip').forEach((chip) => {
    chip.onclick = () => {
      const field = chip.dataset.field;
      const v = chip.dataset.v;
      const arr = multiAnswers[field];
      const idx = arr.indexOf(v);
      if (idx >= 0) {
        arr.splice(idx, 1);
        chip.classList.remove('on');
        chip.style.background = '';
      } else {
        arr.push(v);
        chip.classList.add('on');
        chip.style.background = '#B8886B';
      }
    };
  });

  let sigPad = null;
  let photoConsent = null;
  if (!isEdit) {
    sigPad = setupSignaturePad('sig-pad');
    document.querySelectorAll('.photo-consent-chip').forEach((chip) => {
      chip.onclick = () => {
        photoConsent = chip.dataset.v === 'true';
        document.querySelectorAll('.photo-consent-chip').forEach((c) => {
          c.classList.remove('on');
          c.style.background = '';
        });
        chip.classList.add('on');
        chip.style.background = '#3A332B';
      };
    });
  } else if (client?.signature_url) {
    import('../lib/data.js').then(({ getSignedUrl }) =>
      getSignedUrl('signatures', client.signature_url).then((url) => {
        const img = document.getElementById('sig-static-img');
        if (img && url) img.src = url;
      })
    );
  }

  const saveBtn = document.getElementById('save-btn');
  saveBtn.onclick = async () => {
    const name = document.getElementById('f-name').value.trim();
    if (!name) {
      alert('請輸入姓名');
      return;
    }
    const fields = {
      name,
      phone: document.getElementById('f-phone').value.trim(),
      address: document.getElementById('f-address').value.trim(),
      gender,
      birth_date: buildBirthDate(),
      source: source || null,
      source_detail: document.getElementById('f-source-detail').value.trim(),
      history_treatment: yesNoAnswers.history_treatment,
      history_supplement: yesNoAnswers.history_supplement,
      history_supplement_brand: document.getElementById('f-supplement-brand').value.trim(),
      history_allergy: yesNoAnswers.history_allergy,
      makeup_habit: yesNoAnswers.makeup_habit,
      uses_skincare: yesNoAnswers.uses_skincare,
      skincare_brand: document.getElementById('f-skincare-brand').value.trim(),
      skincare_types: multiAnswers.skincare_types,
      daily_water_intake: document.getElementById('f-water').value.trim(),
      skin_concerns: multiAnswers.skin_concerns,
      skin_type: skinType || null,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';
    try {
      if (isEdit) {
        await updateClient(client.id, fields);
        app.navigate('clientDetail', { clientId: client.id });
      } else {
        if (!sigPad || !sigPad.hasStroke()) {
          alert('請先完成簽名');
          saveBtn.disabled = false;
          saveBtn.textContent = '建立客戶卡';
          return;
        }
        const created = await createClient(app.salon.id, app.session.user.id, fields);
        const blob = await sigPad.getBlob();
        const signaturePath = await uploadSignature(app.salon.id, created.id, blob);
        const consentPath = await uploadConsentSignature(app.salon.id, created.id, blob);
        await updateClient(created.id, {
          signature_url: signaturePath,
          consent_signature_url: consentPath,
          consent_text_snapshot: app.salon.consent_template,
          consent_signed_at: new Date().toISOString(),
          photo_consent: photoConsent,
        });
        app.navigate('clientDetail', { clientId: created.id });
      }
    } catch (err) {
      console.error(err);
      alert('儲存失敗:' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? '儲存變更' : '建立客戶卡';
    }
  };
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
