import {
  getClient,
  getClientBalance,
  listVisitsForClient,
  listProductSalesForClient,
  getSignedUrl,
  createTopup,
} from '../lib/data.js';
import { calcAge } from '../lib/calcAge.js';
import { serviceById } from '../lib/services.js';
import { supabase } from '../supabaseClient.js';
import { openProductSaleModal } from '../components/productSaleModal.js';
import { sourceName } from '../lib/sources.js';
import { SKIN_TYPES } from '../lib/intakeOptions.js';
import { PAYMENT_METHODS } from '../lib/paymentMethods.js';
import { openLineContactPicker } from '../components/lineContactPicker.js';
import { openAppointmentModal } from '../components/appointmentModal.js';
import { listNotesForClient, createNote, updateNote, deleteNote } from '../lib/clientNotes.js';
import { ensureDefaultTags, listTagIdsForClient, setClientTags, createTag } from '../lib/tags.js';
import {
  listPackagesForClient,
  createPackage,
  updatePackage,
  cancelPackage,
  addPackageUsage,
} from '../lib/packages.js';
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
  getLineContactForClient,
} from '../lib/lineIntegration.js';
import { buildClientTimeline } from '../lib/timeline.js';
import { listArchivePhotos, uploadArchivePhoto } from '../lib/clientArchive.js';
import { openArchivePhotoViewer } from '../components/archivePhotoViewer.js';
import { ensureDefaultMessageTemplates, renderMessageVars } from '../lib/messageTemplates.js';

export async function renderClientDetail(app) {
  const clientId = app.params.clientId;
  const root = app.root;

  root.innerHTML = `<div class="screen"><div style="padding:40px;text-align:center;color:#9B8F7F;">載入中...</div></div>`;

  const [client, balance, visits, initialNotes, initialAllTags, initialClientTagIds, initialPackages, productSales] =
    await Promise.all([
      getClient(clientId),
      getClientBalance(clientId),
      listVisitsForClient(clientId),
      listNotesForClient(clientId),
      ensureDefaultTags(app.salon.id),
      listTagIdsForClient(clientId),
      listPackagesForClient(clientId),
      listProductSalesForClient(clientId),
    ]);
  let notes = initialNotes;
  let allTags = initialAllTags;
  let clientTagIds = initialClientTagIds;
  let clientTags = allTags.filter((t) => clientTagIds.includes(t.id));
  let packages = initialPackages;
  const lineContact = client.line_user_id ? await getLineContactForClient(client.line_user_id) : null;

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

        <div id="tag-warning-banner">${clientTags.length ? warningBannerHtml(clientTags) : ''}</div>

        ${preVisitSummaryHtml({ visits, packages, productSales, clientTags, notes, lineContact })}

        ${signedSigUrl ? `<div class="field"><div class="field-label">簽名</div><img class="sig-static-img" src="${signedSigUrl}" alt="簽名" /></div>` : ''}

        <div id="tags-section">${tagsSectionHtml(clientTags)}</div>
        <div id="notes-section">${notesSectionHtml(notes)}</div>

        ${intakeSummaryHtml(client)}

        <div class="balance-box">
          <div>
            <div class="balance-label">目前儲值餘額</div>
            <div class="balance-value">$${formatMoney(balance)}</div>
          </div>
          <button class="secondary-btn" style="width:auto;margin-top:0;padding:10px 16px;" id="topup-btn">儲值</button>
        </div>

        <div id="packages-section">${packagesSectionHtml(packages)}</div>

        <button class="primary-btn" id="add-visit-btn" style="margin-bottom:10px;">＋ 新增到店紀錄</button>
        <button class="secondary-btn" id="ledger-btn" style="margin-top:0;margin-bottom:10px;">查看儲值/扣款帳本</button>
        <button class="secondary-btn" id="product-sale-btn" style="margin-top:0;margin-bottom:20px;">記錄商品銷售</button>

        <div id="line-section">
          <div class="analytics-block" style="text-align:center;color:#9B8F7F;">LINE 資訊載入中...</div>
        </div>

        <div id="archive-section">
          <div class="analytics-block" style="text-align:center;color:#9B8F7F;">紙本歷史資料載入中...</div>
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

  loadLineSection(app, client, { visits, notes, packages, productSales });
  loadArchiveSection(app, client);

  function renderTagsUI() {
    document.getElementById('tag-warning-banner').innerHTML = clientTags.length ? warningBannerHtml(clientTags) : '';
    document.getElementById('tags-section').innerHTML = tagsSectionHtml(clientTags);
    document.getElementById('manage-tags-btn').onclick = () =>
      openTagPickerModal(app, client, allTags, clientTagIds, (newAllTags, newTagIds) => {
        allTags = newAllTags;
        clientTagIds = newTagIds;
        clientTags = allTags.filter((t) => clientTagIds.includes(t.id));
        renderTagsUI();
      });
  }
  renderTagsUI();

  function renderNotesUI() {
    document.getElementById('notes-section').innerHTML = notesSectionHtml(notes);
    bindNotesEvents();
  }
  function bindNotesEvents() {
    document.getElementById('add-note-btn').onclick = () =>
      openNoteModal(null, async (body) => {
        await createNote(app.salon.id, client.id, app.session.user.id, body);
        notes = await listNotesForClient(client.id);
        renderNotesUI();
      });
    document.querySelectorAll('.note-edit-btn').forEach((btn) => {
      btn.onclick = () => {
        const n = notes.find((x) => x.id === btn.dataset.id);
        if (!n) return;
        openNoteModal(n.body, async (body) => {
          await updateNote(n.id, body);
          notes = await listNotesForClient(client.id);
          renderNotesUI();
        });
      };
    });
    document.querySelectorAll('.note-delete-btn').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('確定要刪除這筆備註嗎?')) return;
        await deleteNote(btn.dataset.id);
        notes = await listNotesForClient(client.id);
        renderNotesUI();
      };
    });
  }
  bindNotesEvents();

  function renderPackagesUI() {
    document.getElementById('packages-section').innerHTML = packagesSectionHtml(packages);
    bindPackagesEvents();
  }
  function bindPackagesEvents() {
    document.getElementById('add-package-btn').onclick = () =>
      openPackageModal(null, async (fields) => {
        await createPackage(app.salon.id, client.id, app.session.user.id, fields);
        packages = await listPackagesForClient(client.id);
        renderPackagesUI();
      });
    document.querySelectorAll('.pkg-use-btn').forEach((btn) => {
      btn.onclick = async () => {
        await addPackageUsage(app.salon.id, btn.dataset.id, app.session.user.id, {
          used_date: new Date().toISOString().slice(0, 10),
        });
        packages = await listPackagesForClient(client.id);
        renderPackagesUI();
      };
    });
    document.querySelectorAll('.pkg-edit-btn').forEach((btn) => {
      btn.onclick = () => {
        const p = packages.find((x) => x.id === btn.dataset.id);
        if (!p) return;
        openPackageModal(p, async (fields) => {
          await updatePackage(p.id, fields);
          packages = await listPackagesForClient(client.id);
          renderPackagesUI();
        });
      };
    });
    document.querySelectorAll('.pkg-cancel-btn').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('確定要取消這筆療程嗎?')) return;
        await cancelPackage(btn.dataset.id);
        packages = await listPackagesForClient(client.id);
        renderPackagesUI();
      };
    });
  }
  bindPackagesEvents();

  document.querySelectorAll('#visits-list .visit-card').forEach((el) => {
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

function daysBetween(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today - d) / (1000 * 60 * 60 * 24));
}

function preVisitSummaryHtml({ visits, packages, productSales, clientTags, notes, lineContact }) {
  const lastVisit = visits[0];
  const lastVisitServices = lastVisit
    ? (lastVisit.visit_services || []).map((vs) => serviceById(vs.service_id)?.name).filter(Boolean).join('、')
    : '';
  const activePackages = packages.filter((p) => p.status === 'active' && p.remaining_sessions > 0);
  const lastProduct = productSales[0];
  const lastNote = notes[0];

  return `
    <div class="analytics-block">
      <div class="analytics-title">服務前摘要</div>
      <div class="detail-row"><strong>上次服務:</strong>&nbsp;${lastVisit ? `${escapeHtml(lastVisitServices || '未選擇服務項目')}(${lastVisit.visit_date})` : '還沒有到店紀錄'}</div>
      ${lastVisit ? `<div class="detail-row"><strong>距離上次服務:</strong>&nbsp;${daysBetween(lastVisit.visit_date)} 天</div>` : ''}
      <div class="detail-row"><strong>剩餘療程:</strong>&nbsp;${
        activePackages.length ? activePackages.map((p) => `${escapeHtml(p.package_name)} ${p.remaining_sessions} 堂`).join('、') : '無進行中療程'
      }</div>
      <div class="detail-row"><strong>上次購買產品:</strong>&nbsp;${lastProduct ? `${escapeHtml(lastProduct.item_name)}(${lastProduct.sale_date})` : '無購買紀錄'}</div>
      <div class="detail-row"><strong>客戶標籤:</strong>&nbsp;${clientTags.length ? clientTags.map((t) => escapeHtml(t.name)).join('／') : '無'}</div>
      <div class="detail-row"><strong>最近備註:</strong>&nbsp;${lastNote ? escapeHtml(lastNote.body) : '無'}</div>
      ${
        lineContact?.last_message_text
          ? `<div class="detail-row"><strong>客人最新 LINE 訊息:</strong>&nbsp;${escapeHtml(lineContact.last_message_text)}(${formatDateTime(lineContact.last_event_at)})</div>`
          : ''
      }
    </div>
  `;
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

async function loadLineSection(app, client, { visits, notes, packages, productSales }) {
  const container = document.getElementById('line-section');
  if (!container) return;

  let templates, followUps, appointments, messageTemplates;
  try {
    [templates, followUps, appointments, messageTemplates] = await Promise.all([
      ensureDefaultFollowUpTemplates(app.salon.id),
      listFollowUpsForClient(client.id),
      listAppointmentsForClient(client.id),
      ensureDefaultMessageTemplates(app.salon.id),
    ]);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="analytics-block">LINE 資訊讀取失敗:${escapeHtml(err.message)}</div>`;
    return;
  }

  let customRows = [];

  function buildMessageContext() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcomingAppt = appointments.find((a) => a.appointment_date >= todayStr && a.status !== 'cancelled');
    const lastVisit = visits[0];
    const lastVisitServices = lastVisit
      ? (lastVisit.visit_services || []).map((vs) => serviceById(vs.service_id)?.name).filter(Boolean).join('、')
      : '';
    const activePackages = packages.filter((p) => p.status === 'active' && p.remaining_sessions > 0);
    return {
      clientName: client.name,
      serviceNames: lastVisitServices,
      lastVisitDate: lastVisit?.visit_date || '',
      appointmentDate: upcomingAppt?.appointment_date || '',
      appointmentTime: upcomingAppt?.appointment_time ? upcomingAppt.appointment_time.slice(0, 5) : '',
      remainingSessions: activePackages.length ? activePackages.reduce((sum, p) => sum + p.remaining_sessions, 0) : null,
      productName: productSales[0]?.item_name || '',
    };
  }

  function render() {
    const timelineEvents = buildClientTimeline({ client, visits, productSales, packages, appointments, followUps, notes });
    container.innerHTML =
      lineSectionHtml(client, templates, followUps, customRows, appointments, messageTemplates) + timelineSectionHtml(timelineEvents);
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
    container.querySelectorAll('.custom-row-template-select').forEach((select) => {
      select.onchange = () => {
        const template = messageTemplates.find((t) => t.id === select.value);
        if (!template) return;
        const row = customRows.find((r) => String(r.key) === select.dataset.key);
        if (!row) return;
        row.message = renderMessageVars(template.message, buildMessageContext());
        const textarea = container.querySelector(`.custom-row-message[data-key="${select.dataset.key}"]`);
        if (textarea) textarea.value = row.message;
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

// ---------------- 紙本歷史資料 ----------------

async function loadArchiveSection(app, client) {
  const container = document.getElementById('archive-section');
  if (!container) return;

  let photos;
  try {
    photos = await listArchivePhotos(client.id);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="analytics-block">紙本歷史資料讀取失敗:${escapeHtml(err.message)}</div>`;
    return;
  }

  const thumbUrls = {};

  async function render() {
    container.innerHTML = archiveSectionHtml(photos, thumbUrls);
    bindEvents();
    await loadMissingThumbs();
  }

  async function loadMissingThumbs() {
    const missing = photos.filter((p) => !thumbUrls[p.id]);
    if (!missing.length) return;
    const urls = await Promise.all(missing.map((p) => getSignedUrl('client-archive', p.storage_path)));
    missing.forEach((p, i) => {
      thumbUrls[p.id] = urls[i];
      const img = container.querySelector(`.archive-thumb[data-id="${p.id}"] img`);
      if (img) img.src = urls[i];
    });
  }

  function bindEvents() {
    document.getElementById('add-archive-photo-btn').onclick = () => document.getElementById('archive-photo-input').click();
    document.getElementById('archive-photo-input').onchange = async (e) => {
      const files = Array.from(e.target.files);
      e.target.value = '';
      if (!files.length) return;
      for (const file of files) {
        try {
          await uploadArchivePhoto(app.salon.id, client.id, app.session.user.id, file);
        } catch (err) {
          alert('上傳失敗:' + err.message);
        }
      }
      photos = await listArchivePhotos(client.id);
      render();
    };
    container.querySelectorAll('.archive-thumb').forEach((el) => {
      el.onclick = () => {
        const idx = photos.findIndex((p) => p.id === el.dataset.id);
        if (idx < 0) return;
        openArchivePhotoViewer(photos, idx, (newPhotos) => {
          photos = newPhotos;
          render();
        });
      };
    });
  }

  render();
}

function archiveSectionHtml(photos, thumbUrls) {
  return `
    <div class="analytics-block">
      <div class="analytics-title">紙本歷史資料</div>
      <div class="field-hint" style="margin-bottom:10px;">舊客戶以前的紙本紀錄,拍照保存就好,不用重新輸入一次。</div>
      <div class="photo-grid">
        ${photos
          .map(
            (p) => `
          <div class="photo-thumb-wrap archive-thumb" data-id="${p.id}" style="cursor:pointer;">
            <img class="photo-thumb" src="${thumbUrls[p.id] || ''}" />
          </div>`
          )
          .join('')}
        <div class="photo-add" id="add-archive-photo-btn">
          <span>📎</span>
          <span>新增照片</span>
        </div>
      </div>
      <input type="file" id="archive-photo-input" accept="image/*" multiple class="hidden" />
    </div>
  `;
}

function messageTemplateOptionsHtml(messageTemplates) {
  return `
    <option value="">選擇固定話術...</option>
    ${messageTemplates
      .map((t) => `<option value="${t.id}">${t.is_favorite ? '⭐ ' : ''}${escapeHtml(t.category)} - ${escapeHtml(t.name)}</option>`)
      .join('')}
  `;
}

function lineSectionHtml(client, templates, followUps, customRows, appointments, messageTemplates) {
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
            ${
              messageTemplates.length
                ? `<select class="custom-row-template-select" data-key="${r.key}" style="margin-top:6px;">${messageTemplateOptionsHtml(messageTemplates)}</select>`
                : ''
            }
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

function timelineSectionHtml(events) {
  return `
    <div class="section-label">客戶歷程</div>
    <div class="analytics-block">
      ${
        events.length
          ? events.map((e) => timelineEventHtml(e)).join('')
          : `<div class="empty-body">還沒有任何紀錄</div>`
      }
    </div>
  `;
}

function timelineEventHtml(e) {
  let label = '';
  switch (e.type) {
    case 'client_created':
      label = '建立客戶卡';
      break;
    case 'visit': {
      const names = (e.visit.visit_services || []).map((vs) => serviceById(vs.service_id)?.name).filter(Boolean).join('、');
      label = `到店服務${names ? `:${names}` : ''}(＄${formatMoney(e.visit.amount)})`;
      break;
    }
    case 'product':
      label = `購買產品:${escapeHtml(e.sale.item_name)}`;
      break;
    case 'package_purchase':
      label = `購買療程:${escapeHtml(e.pkg.package_name)}(共 ${e.pkg.total_sessions} 堂)`;
      break;
    case 'package_usage':
      label = `使用療程:${escapeHtml(e.pkg.package_name)}`;
      break;
    case 'appointment':
      label = `預約${e.appointment.service_note ? `:${escapeHtml(e.appointment.service_note)}` : ''}(${(APPOINTMENT_STATUS_LABEL[e.appointment.status] || {}).text || e.appointment.status})`;
      break;
    case 'followup_sent':
      label = `已發送 LINE 追蹤:${escapeHtml(e.followUp.label)}`;
      break;
    case 'note':
      label = `備註:${escapeHtml(e.note.body)}`;
      break;
    default:
      label = e.type;
  }
  return `
    <div class="detail-row"><strong>${e.date}</strong>&nbsp;${label}</div>
  `;
}

const APPOINTMENT_STATUS_LABEL = {
  scheduled: { text: '已預約', color: '#9B8F7F' },
  confirmed: { text: '已確認', color: '#6B8CAE' },
  checked_in: { text: '已到店', color: '#8FA688' },
  completed: { text: '已完成', color: '#4E8B5C' },
  cancelled: { text: '已取消', color: '#B0A996' },
  no_show: { text: '未到', color: '#B5533C' },
};
const ACTIVE_APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'checked_in'];

function appointmentRowHtml(a) {
  const s = APPOINTMENT_STATUS_LABEL[a.status] || APPOINTMENT_STATUS_LABEL.scheduled;
  const timeLabel = a.appointment_time ? ` ${a.appointment_time.slice(0, 5)}` : '';
  const isActive = ACTIVE_APPOINTMENT_STATUSES.includes(a.status);
  return `
    <div class="visit-card" data-id="${a.id}">
      <div class="visit-date-row">
        <span class="visit-date">${a.appointment_date}${timeLabel}${a.service_note ? `・${escapeHtml(a.service_note)}` : ''}</span>
        <span style="color:${s.color};font-size:13px;font-weight:600;">${s.text}</span>
      </div>
      ${
        a.deposit_amount
          ? `<div class="visit-note">訂金:$${formatMoney(a.deposit_amount)}(${a.deposit_paid ? '已付款' : '未付款'})</div>`
          : ''
      }
      ${
        isActive
          ? `<div class="visit-tags" style="margin-top:8px;">
               <button type="button" class="tag appt-edit-btn" data-id="${a.id}" style="cursor:pointer;border:none;background:#F0EADA;">修改</button>
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
      <div class="field">
        <div class="field-label">預約狀態</div>
        <select id="edit-appt-status">
          ${Object.entries(APPOINTMENT_STATUS_LABEL)
            .map(([value, s]) => `<option value="${value}" ${appt.status === value ? 'selected' : ''}>${s.text}</option>`)
            .join('')}
        </select>
      </div>
      <div class="row-2">
        <div class="field">
          <div class="field-label">訂金金額(選填)</div>
          <input type="number" id="edit-appt-deposit-amount" min="0" step="1" value="${appt.deposit_amount ?? ''}" />
        </div>
        <div class="field">
          <div class="field-label">付款方式</div>
          <select id="edit-appt-deposit-method">
            <option value="">未指定</option>
            ${PAYMENT_METHODS.filter((m) => m.id !== 'balance')
              .map((m) => `<option value="${m.id}" ${appt.deposit_payment_method === m.id ? 'selected' : ''}>${m.name}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin:6px 0 10px;">
        <input type="checkbox" id="edit-appt-deposit-paid" ${appt.deposit_paid ? 'checked' : ''} />
        <span>訂金已付款</span>
      </label>
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
    const status = document.getElementById('edit-appt-status').value;
    const depositAmountRaw = document.getElementById('edit-appt-deposit-amount').value;
    const deposit_amount = depositAmountRaw ? Number(depositAmountRaw) : null;
    const deposit_payment_method = document.getElementById('edit-appt-deposit-method').value || null;
    const deposit_paid = document.getElementById('edit-appt-deposit-paid').checked;
    if (!appointment_date) {
      alert('請選擇預約日期');
      return;
    }
    const fields = { appointment_date, appointment_time, service_note, status, deposit_amount, deposit_payment_method, deposit_paid };
    if (deposit_paid && !appt.deposit_paid) fields.deposit_paid_at = new Date().toISOString();
    if (!deposit_paid) fields.deposit_paid_at = null;
    await onSave(fields);
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

// ---------------- 客戶標籤 / 備註 ----------------

function warningBannerHtml(tags) {
  return `
    <div class="analytics-block" style="background:#FBEFE7;border-color:#E8C9AE;margin:0 0 18px;">
      <div style="font-weight:700;color:#B5533C;margin-bottom:6px;">⚠️ 此客戶有注意事項</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${tags.map((t) => `<span class="tag" style="background:#F5E3DC;color:#B5533C;">${escapeHtml(t.name)}</span>`).join('')}
      </div>
    </div>
  `;
}

function tagsSectionHtml(tags) {
  return `
    <div class="analytics-block" style="margin:0 0 18px;">
      <div class="analytics-title">客戶標籤</div>
      ${
        tags.length
          ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">${tags
              .map((t) => `<span class="tag">${escapeHtml(t.name)}</span>`)
              .join('')}</div>`
          : `<div class="empty-body" style="margin-bottom:10px;">還沒有標籤</div>`
      }
      <button type="button" class="secondary-btn" id="manage-tags-btn" style="margin-top:0;">管理標籤</button>
    </div>
  `;
}

function openTagPickerModal(app, client, allTags, selectedTagIds, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  let currentTags = allTags;
  let selected = new Set(selectedTagIds);

  function render() {
    overlay.innerHTML = `
      <div class="modal-box" style="max-height:80vh;overflow-y:auto;">
        <div class="modal-title">管理「${escapeHtml(client.name)}」的標籤</div>
        <div id="tag-picker-list">
          ${currentTags
            .map(
              (t) => `
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <input type="checkbox" class="tag-picker-check" data-id="${t.id}" ${selected.has(t.id) ? 'checked' : ''} />
              <span>${escapeHtml(t.name)}</span>
            </label>`
            )
            .join('')}
        </div>
        <div class="field" style="margin-top:10px;">
          <div class="field-label">新增標籤</div>
          <div style="display:flex;gap:8px;">
            <input type="text" id="new-tag-name" placeholder="例如:VIP" style="flex:1;" />
            <button type="button" class="secondary-btn" id="add-tag-btn" style="width:auto;margin-top:0;padding:10px 16px;">新增</button>
          </div>
        </div>
        <button class="primary-btn" id="tag-picker-save" style="margin-top:14px;">儲存</button>
        <button class="secondary-btn" id="tag-picker-cancel">取消</button>
      </div>
    `;
    bind();
  }

  function bind() {
    overlay.querySelectorAll('.tag-picker-check').forEach((cb) => {
      cb.onchange = () => {
        if (cb.checked) selected.add(cb.dataset.id);
        else selected.delete(cb.dataset.id);
      };
    });
    document.getElementById('add-tag-btn').onclick = async () => {
      const input = document.getElementById('new-tag-name');
      const name = input.value.trim();
      if (!name) return;
      try {
        const tag = await createTag(app.salon.id, name);
        currentTags = [...currentTags, tag];
        selected.add(tag.id);
        render();
      } catch (err) {
        alert('新增標籤失敗:' + err.message);
      }
    };
    document.getElementById('tag-picker-cancel').onclick = () => overlay.remove();
    document.getElementById('tag-picker-save').onclick = async () => {
      const saveBtn = document.getElementById('tag-picker-save');
      saveBtn.disabled = true;
      try {
        const tagIds = Array.from(selected);
        await setClientTags(app.salon.id, client.id, tagIds);
        overlay.remove();
        onDone(currentTags, tagIds);
      } catch (err) {
        alert('儲存失敗:' + err.message);
        saveBtn.disabled = false;
      }
    };
  }

  document.body.appendChild(overlay);
  render();
}

function notesSectionHtml(notes) {
  return `
    <div class="analytics-block" style="margin:0 0 18px;">
      <div class="analytics-title">客戶備註</div>
      <button type="button" class="secondary-btn" id="add-note-btn" style="margin-bottom:10px;">＋ 新增備註</button>
      ${notes.length ? notes.map((n) => noteRowHtml(n)).join('') : `<div class="empty-body">還沒有備註</div>`}
    </div>
  `;
}

function noteRowHtml(n) {
  return `
    <div class="visit-card" data-id="${n.id}" style="margin-bottom:8px;">
      <div class="visit-date-row">
        <span class="visit-date">${formatDateTime(n.created_at)}${n.updated_at ? '(已編輯)' : ''}</span>
      </div>
      <div class="visit-note">${escapeHtml(n.body)}</div>
      <div class="visit-tags" style="margin-top:8px;">
        <button type="button" class="tag note-edit-btn" data-id="${n.id}" style="cursor:pointer;border:none;background:#F0EADA;">編輯</button>
        <button type="button" class="tag note-delete-btn" data-id="${n.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">刪除</button>
      </div>
    </div>
  `;
}

function openNoteModal(initialBody, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">${initialBody != null ? '編輯備註' : '新增備註'}</div>
      <div class="field">
        <textarea id="note-body" rows="4" placeholder="輸入備註內容">${escapeHtml(initialBody || '')}</textarea>
      </div>
      <button class="primary-btn" id="note-save" style="margin-top:10px;">儲存</button>
      <button class="secondary-btn" id="note-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('note-cancel').onclick = () => overlay.remove();
  document.getElementById('note-save').onclick = async () => {
    const body = document.getElementById('note-body').value.trim();
    if (!body) {
      alert('請輸入備註內容');
      return;
    }
    await onSave(body);
    overlay.remove();
  };
}

// ---------------- 療程堂數 ----------------

function packagesSectionHtml(packages) {
  return `
    <div class="analytics-block" style="margin:0 0 18px;">
      <div class="analytics-title">療程</div>
      ${
        packages.filter((p) => p.status === 'active').length
          ? packages
              .filter((p) => p.status === 'active')
              .map((p) => packageRowHtml(p))
              .join('')
          : `<div class="empty-body" style="margin-bottom:10px;">目前沒有進行中的療程</div>`
      }
      <button type="button" class="secondary-btn" id="add-package-btn" style="margin-top:10px;">＋ 新增療程</button>
    </div>
  `;
}

function packageRowHtml(p) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const low = p.remaining_sessions > 0 && p.remaining_sessions <= 2;
  const expired = p.expire_date && p.expire_date < todayStr;
  const usageDates = (p.package_usage || [])
    .slice()
    .sort((a, b) => (a.used_date < b.used_date ? 1 : -1))
    .map((u) => u.used_date);
  return `
    <div class="visit-card" data-id="${p.id}" style="margin-bottom:8px;">
      <div class="visit-date-row">
        <span class="visit-date">${escapeHtml(p.package_name)}</span>
        <span style="color:${p.remaining_sessions <= 0 ? '#B0A996' : low ? '#B5533C' : '#4E8B5C'};font-size:13px;font-weight:600;">
          剩餘 ${p.remaining_sessions}／${p.total_sessions} 堂
        </span>
      </div>
      <div class="visit-note">
        購買日:${p.purchase_date}${p.expire_date ? ` ・ 到期日:<span style="${expired ? 'color:#B5533C;font-weight:600;' : ''}">${p.expire_date}${expired ? '(已到期)' : ''}</span>` : ''}
      </div>
      ${usageDates.length ? `<div class="visit-note">使用紀錄:${usageDates.join('、')}</div>` : ''}
      <div class="visit-tags" style="margin-top:8px;">
        ${
          p.remaining_sessions > 0
            ? `<button type="button" class="tag pkg-use-btn" data-id="${p.id}" style="cursor:pointer;border:none;background:#E7EFE4;color:#4E8B5C;">使用一堂</button>`
            : ''
        }
        <button type="button" class="tag pkg-edit-btn" data-id="${p.id}" style="cursor:pointer;border:none;background:#F0EADA;">編輯</button>
        <button type="button" class="tag pkg-cancel-btn" data-id="${p.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">取消療程</button>
      </div>
    </div>
  `;
}

function openPackageModal(pkg, onSave) {
  const today = new Date().toISOString().slice(0, 10);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">${pkg ? '修改療程' : '新增療程'}</div>
      <div class="field">
        <div class="field-label">療程名稱</div>
        <input type="text" id="pkg-name" value="${escapeAttr(pkg?.package_name || '')}" placeholder="例如:膠原課程" />
      </div>
      <div class="row-2">
        <div class="field">
          <div class="field-label">總堂數</div>
          <input type="number" id="pkg-total" min="1" step="1" value="${pkg?.total_sessions || ''}" />
        </div>
        <div class="field">
          <div class="field-label">價格(選填)</div>
          <input type="number" id="pkg-price" min="0" step="1" value="${pkg?.price ?? ''}" />
        </div>
      </div>
      <div class="row-2">
        <div class="field">
          <div class="field-label">購買日期</div>
          <input type="date" id="pkg-purchase-date" value="${pkg?.purchase_date || today}" />
        </div>
        <div class="field">
          <div class="field-label">到期日(選填)</div>
          <input type="date" id="pkg-expire-date" value="${pkg?.expire_date || ''}" />
        </div>
      </div>
      <div class="field">
        <div class="field-label">備註(選填)</div>
        <textarea id="pkg-notes" rows="2">${escapeHtml(pkg?.notes || '')}</textarea>
      </div>
      <button class="primary-btn" id="pkg-save" style="margin-top:10px;">儲存</button>
      <button class="secondary-btn" id="pkg-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('pkg-cancel').onclick = () => overlay.remove();
  document.getElementById('pkg-save').onclick = async () => {
    const package_name = document.getElementById('pkg-name').value.trim();
    const total_sessions = Number(document.getElementById('pkg-total').value);
    const priceRaw = document.getElementById('pkg-price').value;
    const price = priceRaw ? Number(priceRaw) : null;
    const purchase_date = document.getElementById('pkg-purchase-date').value;
    const expire_date = document.getElementById('pkg-expire-date').value || null;
    const notes = document.getElementById('pkg-notes').value.trim();
    if (!package_name || !total_sessions || !purchase_date) {
      alert('請填寫療程名稱、總堂數、購買日期');
      return;
    }
    const saveBtn = document.getElementById('pkg-save');
    saveBtn.disabled = true;
    try {
      await onSave({ package_name, total_sessions, price, purchase_date, expire_date, notes });
      overlay.remove();
    } catch (err) {
      alert('儲存失敗:' + err.message);
      saveBtn.disabled = false;
    }
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
