import { getClient, listTopups, listVisitsForClient, updateTopup } from '../lib/data.js';

export async function renderLedger(app) {
  const { clientId } = app.params;
  app.root.innerHTML = `<div class="screen"><div style="padding:40px;text-align:center;color:#9B8F7F;">載入中...</div></div>`;

  const client = await getClient(clientId);

  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">${escapeHtml(client.name)} · 儲值/扣款帳本</div>
        <div style="width:38px;"></div>
      </div>
      <div class="list-scroll" style="padding-top:16px;" id="ledger-list"></div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('clientDetail', { clientId });

  await loadLedger(app, client);
}

async function loadLedger(app, client) {
  const listEl = document.getElementById('ledger-list');
  if (!listEl) return;

  const [topups, visits] = await Promise.all([listTopups(client.id), listVisitsForClient(client.id)]);
  const balanceVisits = visits.filter((v) => v.payment_method === 'balance');

  const entries = [
    ...topups.map((t) => ({ type: 'topup', date: t.topup_date, amount: Number(t.amount), id: t.id, raw: t })),
    ...balanceVisits.map((v) => ({ type: 'visit', date: v.visit_date, amount: -Number(v.amount), id: v.id })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // 由舊到新算出每一筆之後的餘額
  let running = 0;
  const withRunning = entries.map((e) => {
    running += e.amount;
    return { ...e, runningBalance: running };
  });
  withRunning.reverse(); // 畫面上新的在上面

  listEl.innerHTML = withRunning.length
    ? withRunning.map((e) => rowHtml(e)).join('')
    : `<div class="empty-state"><div class="empty-body">還沒有任何儲值或扣款紀錄</div></div>`;

  listEl.querySelectorAll('.ledger-edit-btn').forEach((btn) => {
    btn.onclick = () => {
      const topup = withRunning.find((e) => e.id === btn.dataset.id)?.raw;
      if (topup) openEditTopupModal(app, client, topup);
    };
  });
}

function rowHtml(e) {
  const isTopup = e.type === 'topup';
  return `
    <div class="ledger-row">
      <div class="ledger-left">
        <div class="ledger-type">${isTopup ? '儲值' : '消費扣除(儲值付款)'}</div>
        <div class="ledger-date">${e.date}</div>
      </div>
      <div class="ledger-right" style="display:flex;align-items:center;gap:10px;">
        <div>
          <div class="ledger-amount ${isTopup ? 'plus' : 'minus'}">${isTopup ? '+' : '−'}$${formatMoney(Math.abs(e.amount))}</div>
          <div class="ledger-running">餘額 $${formatMoney(e.runningBalance)}</div>
        </div>
        ${isTopup ? `<button type="button" class="btn-ghost ledger-edit-btn" data-id="${e.id}">編輯</button>` : ''}
      </div>
    </div>
  `;
}

function openEditTopupModal(app, client, topup) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">編輯儲值紀錄</div>
      <div class="field">
        <div class="field-label">儲值金額</div>
        <input type="number" id="edit-topup-amount" min="0" step="1" value="${topup.amount}" />
      </div>
      <div class="field">
        <div class="field-label">日期</div>
        <input type="date" id="edit-topup-date" value="${topup.topup_date}" />
      </div>
      <button class="primary-btn" id="edit-topup-confirm" style="margin-top:10px;">儲存修改</button>
      <button class="secondary-btn" id="edit-topup-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('edit-topup-cancel').onclick = () => overlay.remove();
  document.getElementById('edit-topup-confirm').onclick = async () => {
    const amount = Number(document.getElementById('edit-topup-amount').value);
    const topup_date = document.getElementById('edit-topup-date').value;
    if (!amount || amount <= 0) {
      alert('請輸入正確的儲值金額');
      return;
    }
    await updateTopup(topup.id, app.session.user.id, { amount, topup_date });
    overlay.remove();
    await loadLedger(app, client);
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
