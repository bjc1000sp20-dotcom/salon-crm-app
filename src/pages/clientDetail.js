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

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('zh-TW');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
