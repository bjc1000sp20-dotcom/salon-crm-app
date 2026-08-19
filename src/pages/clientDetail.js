import {
  getClient,
  getClientBalance,
  listVisitsForClient,
  getSignedUrl,
  createTopup,
} from '../lib/data.js';
import { calcAge } from '../lib/calcAge.js';
import { serviceById } from '../lib/services.js';
import { supabase } from '../supabaseClient.js';
import { openProductSaleModal } from '../components/productSaleModal.js';
import { sourceName } from '../lib/sources.js';
import { SKIN_TYPES } from '../lib/intakeOptions.js';
import { openLineContactPicker } from '../components/lineContactPicker.js';
import { openAppointmentModal } from '../components/appointmentModal.js';
import {
  unlinkClientLine,
  ensureDefaultFollowUpTemplates,
  listFollowUpsForClient,
  createFollowUp,
  updateFollowUp,
  cancelFollowUp,
  addDaysToToday,
  listAppointmentsForClient,
  updateAppointment,
  cancelAppointment,
  completeAppointment,
} from '../lib/lineIntegration.js';

export async function renderClientDetail(app) {
  const clientId = app.params.clientId;
  const root = app.root;

  root.innerHTML = `<div class="screen"><div style="padding:40px;text-align:center;color:#9B8F7F;">載入中...</div></div>`;

  const [client, balance, visits] = await Promise.all([
    getClient(clientId),
    getClientBalance(clientId),
    listVisitsForClient(clientId),
  ]);

  const age = calcAge(client.birth_date);
  const initial = (client.name || '?').slice(0, 1);
  const genderLabel = client.gender === 'F' ? '女' : client.gender === 'M' ? '男' : '未填';

  const signedSigUrl = client.signature_url ? await getSignedUrl('signatures', client.signature_url) : null;

  root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">客戶詳情</div>
        <button class="icon-btn" id="edit-btn">✎</button>
      </div>
      <div class="form-scroll">
        <div class="detail-name-row">
          <div class="detail-avatar">${escapeHtml(initial)}</div>
          <div>
            <div class="detail-name">${escapeHtml(client.name)}${age != null ? `<span style="font-size:13px;color:#9B8F7F;font-weight:400;margin-left:8px;">${age} 歲</span>` : ''}</div>
            <div class="detail-sub">${escapeHtml(client.phone || '未留電話')} · ${genderLabel}</div>
          </div>
        </div>

        ${signedSigUrl ? `<div class="field"><div class="field-label">簽名</div><img class="sig-static-img" src="${signedSigUrl}" alt="簽名" /></div>` : ''}

        ${intakeSummaryHtml(client)}

        <div class="balance-box">
          <div>
            <div class="balance-label">目前儲值餘額</div>
            <div class="balance-value">$${formatMoney(balance)}</div>
          </div>
          <button class="secondary-btn" style="width:auto;margin-top:0;padding:10px 16px;" id="topup-btn">儲值</button>
        </div>

        <button class="primary-btn" id="add-visit-btn" style="margin-bottom:10px;">＋ 新增到店紀錄</button>
        <button class="secondary-btn" id="ledger-btn" style="margin-top:0;margin-bottom:10px;">查看儲值/扣款帳本</button>
        <button class="secondary-btn" id="product-sale-btn" style="margin-top:0;margin-bottom:20px;">記錄商品銷售</button>

        <div id="line-section">
          <div class="analytics-block" style="text-align:center;color:#9B8F7F;">LINE 資訊載入中...</div>
        </div>

        <div class="section-label">到店紀錄</div>
        <div id="visits-list">
          ${
            visits.length
              ? visits.map((v) => visitCardHtml(v)).join('')
              : `<div class="empty-state"><div class="empty-body">還沒有到店紀錄</div></div>`
          }
        </div>

        <div style="margin-top:24px;" id="delete-zone"></div>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('clientList');
  document.getElementById('edit-btn').onclick = () => app.navigate('clientForm', { mode: 'edit', clientId: client.id });
  document.getElementById('add-visit-btn').onclick = () => app.navigate('visitForm', { mode: 'create', clientId: client.id });
  document.getElementById('ledger-btn').onclick = () => app.navigate('ledger', { clientId: client.id });
  document.getElementById('topup-btn').onclick = () => openTopupModal(app, client, balance);
  document.getElementById('product-sale-btn').onclick = () =>
    openProductSaleModal(app, client.id, () => app.navigate('clientDetail', { clientId: client.id }));

  loadLineSection(app, client);

  document.querySelectorAll('.visit-card').forEach((el) => {
    el.onclick = () => app.navigate('visitForm', { mode: 'edit', clientId: client.id, visitId: el.dataset.id });
  });

  const deleteZone = document.getElementById('delete-zone');
  deleteZone.innerHTML = `<button class="delete-btn" id="delete-client-btn">刪除這位客戶</button>`;
  document.getElementById('delete-client-btn').onclick = () => {
    deleteZone.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-text">確定要刪除「${escapeHtml(client.name)}」嗎?此動作無法復原,連同所有到店紀錄、儲值紀錄一起刪除。</div>
        <div class="confirm-row">
          <button class="confirm-cancel" id="cancel-del">取消</button>
          <button class="confirm-delete" id="confirm-del">確定刪除</button>
        </div>
      </div>
    `;
    document.getElementById('cancel-del').onclick = () => {
      deleteZone.innerHTML = `<button class="delete-btn" id="delete-client-btn2">刪除這位客戶</button>`;
      document.getElementById('delete-client-btn2').onclick = () => document.getElementById('delete-client-btn').click();
    };
    document.getElementById('confirm-del').onclick = async () => {
      await supabase.from('clients').delete().eq('id', client.id);
      app.navigate('clientList');
    };
  };
}

function intakeSummaryHtml(c) {
  const yn = (v) => (v === true ? '是' : v === false ? '否' : '未填');
  const skinTypeLabel = SKIN_TYPES.find((t) => t.id === c.skin_type)?.name || '未填';
  const contactLines = [];
  if (c.line_id) contactLines.push(`LINE:${escapeHtml(c.line_id)}`);
  if (c.address) contactLines.push(`地址:${escapeHtml(c.address)}`);
  if (c.source) contactLines.push(`來源:${sourceName(c.source)}${c.source_detail ? `(${escapeHtml(c.source_detail)})` : ''}`);

  return `
    <div class="analytics-block" style="margin:0 0 18px;">
      <div class="analytics-title">問卷 / 聯絡資訊</div>
      ${contactLines.length ? contactLines.map((l) => `<div class="detail-row">${l}</div>`).join('') : ''}
      <div class="detail-row">皮膚類型:${skinTypeLabel}</div>
      <div class="detail-row">用藥/酸類/手術/雷射病史:${yn(c.history_treatment)}</div>
      <div class="detail-row">營養補充品:${yn(c.history_supplement)}${c.history_supplement_brand ? `(${escapeHtml(c.history_supplement_brand)})` : ''}</div>
      <div class="detail-row">肌膚過敏史:${yn(c.history_allergy)}</div>
      <div class="detail-row">化妝習慣:${yn(c.makeup_habit)}</div>
      <div class="detail-row">使用保養品:${yn(c.uses_skincare)}${c.skincare_brand ? `(${escapeHtml(c.skincare_brand)})` : ''}</div>
      ${(c.skincare_types || []).length ? `<div class="detail-row">保養品類型:${c.skincare_types.map(escapeHtml).join('、')}</div>` : ''}
      ${c.daily_water_intake ? `<div class="detail-row">日常喝水量:${escapeHtml(c.daily_water_intake)}</div>` : ''}
      ${(c.skin_concerns || []).length ? `<div class="detail-row">想解決的肌膚問題:${c.skin_concerns.map(escapeHtml).join('、')}</div>` : ''}
      <div class="detail-row">授權拍照/影片宣傳:${yn(c.photo_consent)}</div>
    </div>
  `;
}

function visitCardHtml(v) {
  const services = (v.visit_services || []).map((vs) => serviceById(vs.service_id)).filter(Boolean);
  const photoCount = (v.visit_photos || []).length;
  return `
    <div class="visit-card" data-id="${v.id}">
      <div class="visit-date-row">
        <span class="visit-date">${v.visit_date}</span>
        <span class="visit-amount">$${formatMoney(v.amount)}</span>
      </div>
      <div class="visit-tags">
        ${services.map((s) => `<span class="tag" style="background:${s.color}22;color:${s.color};">${s.name}</span>`).join('')}
      </div>
      ${v.skin_condition ? `<div class="visit-note">膚況:${escapeHtml(v.skin_condition)}</div>` : ''}
      ${photoCount ? `<div class="visit-note">📷 ${photoCount} 張照片</div>` : ''}
    </div>
  `;
}

function openTopupModal(app, client, currentBalance) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">為「${escapeHtml(client.name)}」儲值</div>
      <div class="field">
        <div class="field-label">儲值金額</div>
        <input type="number" id="topup-amount" min="0" step="1" placeholder="例如 10000" />
      </div>
      <div class="field">
        <div class="field-label">日期</div>
        <input type="date" id="topup-date" value="${new Date().toISOString().slice(0, 10)}" />
      </div>
      <div class="field-hint">目前餘額 $${formatMoney(currentBalance)}</div>
      <button class="primary-btn" id="topup-confirm" style="margin-top:10px;">確認儲值</button>
      <button class="secondary-btn" id="topup-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('topup-cancel').onclick = () => overlay.remove();
  document.getElementById('topup-confirm').onclick = async () => {
    const amount = Number(document.getElementById('topup-amount').value);
    const date = document.getElementById('topup-date').value;
    if (!amount || amount <= 0) {
      alert('請輸入正確的儲值金額');
      return;
    }
    await createTopup(app.salon.id, client.id, app.session.user.id, amount, date);
    overlay.remove();
    app.navigate('clientDetail', { clientId: client.id });
  };
}

// ---------------- LINE 自動追蹤區塊 ----------------

async function loadLineSection(app, client) {
  const container = document.getElementById('line-section');
  if (!container) return;

  let templates, followUps, appointments;
  try {
    [templates, followUps, appointments] = await Promise.all([
      ensureDefaultFollowUpTemplates(app.salon.id),
      listFollowUpsForClient(client.id),
      listAppointmentsForClient(client.id),
    ]);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="analytics-block">LINE 資訊讀取失敗:${escapeHtml(err.message)}</div>`;
    return;
  }

  let customRows = [];

  function render() {
    container.innerHTML = lineSectionHtml(client, templates, followUps, customRows, appointments);
    bindEvents();
  }

  function bindEvents() {
    const addApptBtn = document.getElementById('add-appointment-btn');
    if (addApptBtn) {
      addApptBtn.onclick = () =>
        openAppointmentModal(app, client, async () => {
          appointments = await listAppointmentsForClient(client.id);
          followUps = await listFollowUpsForClient(client.id);
          render();
        });
    }
    container.querySelectorAll('.appt-edit-btn').forEach((btn) => {
      btn.onclick = () => {
        const a = appointments.find((x) => x.id === btn.dataset.id);
        if (a)
          openEditAppointmentModal(a, async (fields) => {
            await updateAppointment(a.id, fields);
            appointments = await listAppointmentsForClient(client.id);
            followUps = await listFollowUpsForClient(client.id);
            render();
          });
      };
    });
    container.querySelectorAll('.appt-cancel-btn').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('確定要取消這筆預約嗎?尚未發送的預約提醒也會一併取消。')) return;
        await cancelAppointment(btn.dataset.id);
        appointments = await listAppointmentsForClient(client.id);
        followUps = await listFollowUpsForClient(client.id);
        render();
      };
    });
    container.querySelectorAll('.appt-complete-btn').forEach((btn) => {
      btn.onclick = async () => {
        await completeAppointment(btn.dataset.id);
        appointments = await listAppointmentsForClient(client.id);
        render();
      };
    });

    const linkBtn = document.getElementById('line-link-btn');
    if (linkBtn) {
      linkBtn.onclick = () =>
        openLineContactPicker(app, client, () => app.navigate('clientDetail', { clientId: client.id }));
    }
    const unlinkBtn = document.getElementById('line-unlink-btn');
    if (unlinkBtn) {
      unlinkBtn.onclick = async () => {
        if (!confirm('確定要解除這位客戶的 LINE 綁定嗎?')) return;
        await unlinkClientLine(client.id);
        app.navigate('clientDetail', { clientId: client.id });
      };
    }

    const addCustomBtn = document.getElementById('add-custom-followup-btn');
    if (addCustomBtn) {
      addCustomBtn.onclick = () => {
        customRows.push({ key: Date.now(), date: addDaysToToday(1), message: '' });
        render();
      };
    }
    container.querySelectorAll('.custom-row-remove').forEach((btn) => {
      btn.onclick = () => {
        customRows = customRows.filter((r) => String(r.key) !== btn.dataset.key);
        render();
      };
    });
    container.querySelectorAll('.custom-row-date').forEach((input) => {
      input.onchange = () => {
        const row = customRows.find((r) => String(r.key) === input.dataset.key);
        if (row) row.date = input.value;
      };
    });
    container.querySelectorAll('.custom-row-message').forEach((textarea) => {
      textarea.oninput = () => {
        const row = customRows.find((r) => String(r.key) === textarea.dataset.key);
        if (row) row.message = textarea.value;
      };
    });

    const createBtn = document.getElementById('create-followups-btn');
    if (createBtn) {
      createBtn.onclick = async () => {
        const checked = Array.from(container.querySelectorAll('.followup-check:checked'));
        const validCustom = customRows.filter((r) => r.date && r.message.trim());
        if (!checked.length && !validCustom.length) {
          alert('請至少勾選一個追蹤時間,或新增一筆自訂日期並填寫訊息內容');
          return;
        }
        createBtn.disabled = true;
        createBtn.textContent = '建立中...';
        try {
          for (const el of checked) {
            await createFollowUp(app.salon.id, client.id, app.session.user.id, {
              template_id: el.dataset.templateId,
              label: el.dataset.label,
              message: el.dataset.message,
              scheduled_at: addDaysToToday(el.dataset.days),
            });
          }
          for (const row of validCustom) {
            await createFollowUp(app.salon.id, client.id, app.session.user.id, {
              template_id: null,
              label: '自訂日期',
              message: row.message.trim(),
              scheduled_at: row.date,
            });
          }
          followUps = await listFollowUpsForClient(client.id);
          customRows = [];
          render();
        } catch (err) {
          console.error(err);
          alert('建立追蹤失敗:' + err.message);
          createBtn.disabled = false;
          createBtn.textContent = '建立 LINE 追蹤';
        }
      };
    }

    container.querySelectorAll('.followup-cancel-btn').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('確定要取消這筆追蹤嗎?')) return;
        await cancelFollowUp(btn.dataset.id);
        followUps = await listFollowUpsForClient(client.id);
        render();
      };
    });

    container.querySelectorAll('.followup-edit-btn').forEach((btn) => {
      btn.onclick = () => {
        const f = followUps.find((x) => x.id === btn.dataset.id);
        if (f) openEditFollowUpModal(f, async (fields) => {
          await updateFollowUp(f.id, fields);
          followUps = await listFollowUpsForClient(client.id);
          render();
        });
      };
    });
  }

  render();
}

function lineSectionHtml(client, templates, followUps, customRows, appointments) {
  return `
    <div class="analytics-block">
      <div class="analytics-title">LINE</div>
      ${
        client.line_user_id
          ? `<div class="detail-row">✅ 已綁定${client.line_linked_at ? `(${formatDateTime(client.line_linked_at)})` : ''}</div>
             <button class="secondary-btn" id="line-unlink-btn" style="margin-top:8px;">解除綁定</button>`
          : `<div class="detail-row">尚未綁定 LINE</div>
             <button class="secondary-btn" id="line-link-btn" style="margin-top:8px;">選擇 LINE 聯絡人</button>`
      }
    </div>

    <div class="analytics-block">
      <div class="analytics-title">預約</div>
      ${
        appointments.length
          ? appointments.map((a) => appointmentRowHtml(a)).join('')
          : `<div class="empty-body">目前沒有預約</div>`
      }
      <button type="button" class="secondary-btn" id="add-appointment-btn" style="margin-top:10px;">＋ 新增預約</button>
    </div>

    <div class="analytics-block">
      <div class="analytics-title">LINE 自動追蹤</div>
      ${
        !client.line_user_id
          ? `<div class="field-hint">尚未綁定 LINE,建立的追蹤會等綁定後才會實際發送。</div>`
          : ''
      }
      ${templates
        .filter((t) => t.enabled !== false && (t.kind || 'aftercare_followup') === 'aftercare_followup')
        .map(
          (t) => `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <input type="checkbox" class="followup-check" data-template-id="${t.id}" data-days="${t.days_after}" data-label="${escapeAttr(t.label)}" data-message="${escapeAttr(t.message)}" />
          <span>${escapeHtml(t.label)}(${t.days_after} 天後)</span>
        </label>`
        )
        .join('')}
      <div id="custom-followup-rows">
        ${customRows
          .map(
            (r) => `
          <div class="field" style="border-top:1px dashed #E5DCC8;padding-top:10px;margin-top:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div class="field-label">自訂日期</div>
              <button type="button" class="custom-row-remove" data-key="${r.key}" style="background:none;border:none;color:#B5533C;cursor:pointer;font-size:13px;">移除</button>
            </div>
            <input type="date" class="custom-row-date" data-key="${r.key}" value="${r.date}" />
            <textarea class="custom-row-message" data-key="${r.key}" placeholder="訊息內容" style="margin-top:6px;">${escapeHtml(r.message)}</textarea>
          </div>`
          )
          .join('')}
      </div>
      <button type="button" class="secondary-btn" id="add-custom-followup-btn" style="margin-top:10px;">＋ 自訂日期</button>
      <button class="primary-btn" id="create-followups-btn" style="margin-top:12px;">建立 LINE 追蹤</button>
    </div>

    <div class="section-label">LINE 追蹤排程</div>
    <div id="followups-list">
      ${
        followUps.length
          ? followUps.map((f) => followUpRowHtml(f)).join('')
          : `<div class="empty-state"><div class="empty-body">還沒有排程</div></div>`
      }
    </div>
  `;
}

function appointmentRowHtml(a) {
  const statusMap = {
    scheduled: { text: '已排定', color: '#9B8F7F' },
    completed: { text: '已完成', color: '#4E8B5C' },
    cancelled: { text: '已取消', color: '#B0A996' },
  };
  const s = statusMap[a.status] || statusMap.scheduled;
  const timeLabel = a.appointment_time ? ` ${a.appointment_time.slice(0, 5)}` : '';
  return `
    <div class="visit-card" data-id="${a.id}">
      <div class="visit-date-row">
        <span class="visit-date">${a.appointment_date}${timeLabel}${a.service_note ? `・${escapeHtml(a.service_note)}` : ''}</span>
        <span style="color:${s.color};font-size:13px;font-weight:600;">${s.text}</span>
      </div>
      ${
        a.status === 'scheduled'
          ? `<div class="visit-tags" style="margin-top:8px;">
               <button type="button" class="tag appt-edit-btn" data-id="${a.id}" style="cursor:pointer;border:none;background:#F0EADA;">修改</button>
               <button type="button" class="tag appt-complete-btn" data-id="${a.id}" style="cursor:pointer;border:none;background:#E7EFE4;color:#4E8B5C;">標記完成</button>
               <button type="button" class="tag appt-cancel-btn" data-id="${a.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">取消</button>
             </div>`
          : ''
      }
    </div>
  `;
}

function openEditAppointmentModal(appt, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">修改預約</div>
      <div class="field">
        <div class="field-label">預約日期</div>
        <input type="date" id="edit-appt-date" value="${appt.appointment_date}" />
      </div>
      <div class="field">
        <div class="field-label">預約時間</div>
        <input type="time" id="edit-appt-time" value="${appt.appointment_time ? appt.appointment_time.slice(0, 5) : ''}" />
      </div>
      <div class="field">
        <div class="field-label">服務項目</div>
        <input type="text" id="edit-appt-service" value="${escapeAttr(appt.service_note || '')}" />
      </div>
      <div class="field-hint">改期後,還沒發送的預約提醒會自動改成對應的新日期。</div>
      <button class="primary-btn" id="edit-appt-save" style="margin-top:10px;">儲存</button>
      <button class="secondary-btn" id="edit-appt-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('edit-appt-cancel').onclick = () => overlay.remove();
  document.getElementById('edit-appt-save').onclick = async () => {
    const appointment_date = document.getElementById('edit-appt-date').value;
    const appointment_time = document.getElementById('edit-appt-time').value || null;
    const service_note = document.getElementById('edit-appt-service').value.trim();
    if (!appointment_date) {
      alert('請選擇預約日期');
      return;
    }
    await onSave({ appointment_date, appointment_time, service_note });
    overlay.remove();
  };
}

const FOLLOW_UP_KIND_LABEL = {
  appointment_reminder: '預約提醒',
  aftercare_followup: '術後追蹤',
  reengagement: '回訪關心',
  custom: '自訂',
};

function followUpRowHtml(f) {
  const statusMap = {
    pending: { text: '待發送', color: '#9B8F7F' },
    sent: { text: '已發送', color: '#4E8B5C' },
    failed: { text: '發送失敗', color: '#B5533C' },
    cancelled: { text: '已取消', color: '#B0A996' },
  };
  const s = statusMap[f.status] || statusMap.pending;
  const kindLabel = FOLLOW_UP_KIND_LABEL[f.kind] || '';
  return `
    <div class="visit-card" data-id="${f.id}">
      <div class="visit-date-row">
        <span class="visit-date">${f.scheduled_at}・${escapeHtml(f.label)}${kindLabel ? ` <span style="color:#B8AE9A;font-weight:400;">(${kindLabel})</span>` : ''}</span>
        <span style="color:${s.color};font-size:13px;font-weight:600;">${s.text}</span>
      </div>
      <div class="visit-note">${escapeHtml(f.message)}</div>
      ${f.sent_at ? `<div class="visit-note">發送時間:${formatDateTime(f.sent_at)}</div>` : ''}
      ${f.error_message ? `<div class="visit-note" style="color:#B5533C;">錯誤:${escapeHtml(f.error_message)}</div>` : ''}
      ${
        f.status === 'pending'
          ? `<div class="visit-tags" style="margin-top:8px;">
               <button type="button" class="tag followup-edit-btn" data-id="${f.id}" style="cursor:pointer;border:none;background:#F0EADA;">修改</button>
               <button type="button" class="tag followup-cancel-btn" data-id="${f.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">取消</button>
             </div>`
          : ''
      }
    </div>
  `;
}

function openEditFollowUpModal(followUp, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">修改追蹤</div>
      <div class="field">
        <div class="field-label">發送日期</div>
        <input type="date" id="edit-followup-date" value="${followUp.scheduled_at}" />
      </div>
      <div class="field">
        <div class="field-label">訊息內容</div>
        <textarea id="edit-followup-message">${escapeHtml(followUp.message)}</textarea>
      </div>
      <button class="primary-btn" id="edit-followup-save" style="margin-top:10px;">儲存</button>
      <button class="secondary-btn" id="edit-followup-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('edit-followup-cancel').onclick = () => overlay.remove();
  document.getElementById('edit-followup-save').onclick = async () => {
    const scheduled_at = document.getElementById('edit-followup-date').value;
    const message = document.getElementById('edit-followup-message').value.trim();
    if (!scheduled_at || !message) {
      alert('請填寫日期與訊息內容');
      return;
    }
    await onSave({ scheduled_at, message });
    overlay.remove();
  };
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('zh-TW');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
