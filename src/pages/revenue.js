import {
  getMonthlySummary,
  getMonthlyAnalytics,
  listMonthlyVisits,
  setRent,
  getServiceMix,
  getSourceMix,
  countAllClients,
  countNewClientsInMonth,
} from '../lib/data.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';
import { SERVICES } from '../lib/services.js';
import { SOURCES, sourceName } from '../lib/sources.js';
import { listLowRemainingPackages, listExpiringPackages } from '../lib/packages.js';

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}
function monthKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

export async function renderRevenue(app) {
  const month = app.params.month || monthKey(new Date());

  app.root.innerHTML = `
    <div class="screen">
      <div class="header">
        <div>
          <div class="header-eyebrow">REVENUE OVERVIEW</div>
          <h1 class="header-title">營收總覽</h1>
        </div>
      </div>
      <div class="list-scroll" id="revenue-content" style="padding-top:0;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      ${tabBarHtml('revenue')}
    </div>
  `;

  bindTabBar(app);
  await loadContent(app, month);
}

async function loadContent(app, month) {
  const [summary, analytics, visits, serviceMix, sourceMix, lowRemainingPackages, expiringPackages, totalClients, newClientsThisMonth] =
    await Promise.all([
      getMonthlySummary(app.salon.id, month),
      getMonthlyAnalytics(app.salon.id, month),
      listMonthlyVisits(app.salon.id, month),
      getServiceMix(app.salon.id, month),
      getSourceMix(app.salon.id, month),
      listLowRemainingPackages(app.salon.id),
      listExpiringPackages(app.salon.id),
      countAllClients(app.salon.id),
      countNewClientsInMonth(app.salon.id, month),
    ]);

  const content = document.getElementById('revenue-content');
  content.innerHTML = `
    <div class="revenue-summary">
      <div class="month-nav">
        <button class="month-nav-btn" id="prev-month">‹</button>
        <div class="month-nav-label">${monthLabel(month)}</div>
        <button class="month-nav-btn" id="next-month">›</button>
      </div>
      <div class="revenue-nums">
        <div class="revenue-num-block">
          <div class="revenue-num-label">本月來客數</div>
          <div class="revenue-num-value">${analytics.total_clients || 0} 位</div>
        </div>
        <div class="revenue-num-block">
          <div class="revenue-num-label">總營業額</div>
          <div class="revenue-num-value">$${formatMoney(summary.total_revenue)}</div>
        </div>
        <div class="revenue-num-block">
          <div class="revenue-num-label">材料費</div>
          <div class="revenue-num-value">$${formatMoney(summary.material_cost)}</div>
        </div>
        <div class="revenue-num-block">
          <div class="revenue-num-label">淨利潤</div>
          <div class="revenue-num-value profit">$${formatMoney(summary.profit)}</div>
        </div>
      </div>
      <div style="font-size:11px;color:#B8AE9A;margin-top:10px;">服務 $${formatMoney(summary.revenue)} ・ 商品 $${formatMoney(summary.product_revenue)}</div>
    </div>

    <div class="rent-row">
      <div>
        <div class="rent-label">本月租金</div>
        <div class="rent-value">$${formatMoney(summary.rent)}</div>
      </div>
      <button class="rent-edit-btn" id="edit-rent-btn">編輯</button>
    </div>

    ${clientStatsHtml(analytics, totalClients, newClientsThisMonth, summary)}
    ${analyticsHtml(analytics)}
    ${serviceMixHtml(serviceMix)}
    ${sourceMixHtml(sourceMix)}
    ${productSalesHtml(summary)}
    ${packagesReminderHtml(lowRemainingPackages, expiringPackages)}

    <div class="section-label" style="margin:0 20px 8px;">當月消費明細</div>
    ${
      visits.length
        ? visits.map((v) => `
          <div class="visit-list-row">
            <div class="vlr-left">
              <div class="vlr-name">${escapeHtml(v.clients?.name || '未知客戶')}</div>
              <div class="vlr-date">${v.visit_date}</div>
            </div>
            <div class="vlr-amount">$${formatMoney(v.amount)}</div>
          </div>
        `).join('')
        : `<div class="empty-state"><div class="empty-body">這個月還沒有消費紀錄</div></div>`
    }
  `;

  document.getElementById('prev-month').onclick = () => {
    app.params.month = shiftMonth(month, -1);
    loadContent(app, app.params.month);
  };
  document.getElementById('next-month').onclick = () => {
    app.params.month = shiftMonth(month, 1);
    loadContent(app, app.params.month);
  };
  document.getElementById('edit-rent-btn').onclick = () => openRentModal(app, month, summary.rent);

  document.getElementById('manage-product-sales-btn').onclick = () => app.navigate('productSales');
  document.getElementById('manage-packages-btn').onclick = () => app.navigate('packages');
}

function clientStatsHtml(a, totalClients, newClientsThisMonth, summary) {
  const avgTicket = a.total_clients ? summary.total_revenue / a.total_clients : 0;
  const conversionRate = a.consultation_count
    ? Math.round((a.consultation_converted_count / a.consultation_count) * 100)
    : null;

  const rows = [
    { label: '客戶總數', value: `${totalClients} 位` },
    { label: '本月新增客戶', value: `${newClientsThisMonth} 位` },
    { label: '本月諮詢人數', value: `${a.consultation_count || 0} 位` },
    { label: '本月來客人數', value: `${a.total_clients || 0} 位` },
    { label: '本月消費人次', value: `${a.visit_count || 0} 次` },
    { label: '本月營收', value: `$${formatMoney(summary.total_revenue)}` },
    { label: '平均客單價', value: `$${formatMoney(avgTicket)}` },
  ];

  return `
    <div class="analytics-block">
      <div class="analytics-title">客戶與來客統計</div>
      ${rows.map((r) => `<div class="detail-row">${r.label}:${r.value}</div>`).join('')}
      ${
        conversionRate != null
          ? `<div class="detail-row" style="margin-top:6px;"><strong>諮詢成交率:${conversionRate}%</strong>(本月諮詢 ${a.consultation_count} 位,其中 ${a.consultation_converted_count} 位後續有消費)</div>`
          : ''
      }
      <div class="field-hint" style="margin-top:8px;">「本月來客人數」只計算有實際消費紀錄的不重複客戶,單純建立客戶資料或到店諮詢不計入。</div>
    </div>
  `;
}

function analyticsHtml(a) {
  const total = a.total_clients || 0;
  if (!total) {
    return `<div class="analytics-block"><div class="analytics-title">客戶分析</div><div class="empty-body">這個月還沒有客戶到店</div></div>`;
  }
  const malePct = Math.round((a.male_count / total) * 100);
  const femalePct = Math.round((a.female_count / total) * 100);
  const unknownPct = 100 - malePct - femalePct;
  const newPct = Math.round((a.new_count / total) * 100);
  const repeatPct = 100 - newPct;

  return `
    <div class="analytics-block">
      <div class="analytics-title">性別比例(當月不重複到店客戶,共 ${total} 位)</div>
      <div class="stack-bar">
        <div class="stack-seg" style="width:${femalePct}%;background:#B8886B;"></div>
        <div class="stack-seg" style="width:${malePct}%;background:#8B7D9B;"></div>
        <div class="stack-seg" style="width:${unknownPct}%;background:#D9CFBB;"></div>
      </div>
      <div class="legend-row"><span><span class="legend-dot" style="background:#B8886B;"></span>女 ${a.female_count} 位(${femalePct}%)</span><span><span class="legend-dot" style="background:#8B7D9B;"></span>男 ${a.male_count} 位(${malePct}%)</span></div>

      <div class="analytics-title" style="margin-top:16px;">新客／熟客比例(熟客 = 終身到店 ≥ 3 次)</div>
      <div class="stack-bar">
        <div class="stack-seg" style="width:${newPct}%;background:#B39456;"></div>
        <div class="stack-seg" style="width:${repeatPct}%;background:#8FA688;"></div>
      </div>
      <div class="legend-row"><span><span class="legend-dot" style="background:#B39456;"></span>新客 ${a.new_count} 位(${newPct}%)</span><span><span class="legend-dot" style="background:#8FA688;"></span>熟客 ${a.repeat_count} 位(${repeatPct}%)</span></div>
    </div>
  `;
}

function serviceMixHtml(mix) {
  const total = mix.reduce((sum, m) => sum + Number(m.visit_count), 0);
  if (!total) {
    return `<div class="analytics-block"><div class="analytics-title">服務項目佔比</div><div class="empty-body">這個月還沒有到店紀錄</div></div>`;
  }
  const byId = Object.fromEntries(mix.map((m) => [m.service_id, m]));
  const segs = SERVICES.map((s) => {
    const m = byId[s.id];
    const count = m ? Number(m.visit_count) : 0;
    const pct = total ? Math.round((count / total) * 100) : 0;
    return { ...s, count, pct };
  }).filter((s) => s.count > 0);

  return `
    <div class="analytics-block">
      <div class="analytics-title">服務項目佔比(依到店次數,共 ${total} 人次)</div>
      <div class="stack-bar">
        ${segs.map((s) => `<div class="stack-seg" style="width:${s.pct}%;background:${s.color};"></div>`).join('')}
      </div>
      ${segs
        .map(
          (s) =>
            `<div class="legend-row"><span><span class="legend-dot" style="background:${s.color};"></span>${s.name} ${s.count} 人次(${s.pct}%)</span></div>`
        )
        .join('')}
      <div class="field-hint" style="margin-top:8px;">一筆到店如果選了多個服務項目,金額會平均分攤計算,這裡佔比是依到店次數統計。</div>
    </div>
  `;
}

function sourceMixHtml(mix) {
  const total = mix.reduce((sum, m) => sum + Number(m.client_count), 0);
  if (!total) {
    return `<div class="analytics-block"><div class="analytics-title">客戶來源佔比</div><div class="empty-body">這個月還沒有新建立的客戶</div></div>`;
  }
  const byId = Object.fromEntries(mix.map((m) => [m.source, m]));
  const allIds = [...SOURCES.map((s) => s.id), 'unknown'];
  const segs = allIds
    .map((id) => {
      const m = byId[id];
      const count = m ? Number(m.client_count) : 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      const name = id === 'unknown' ? '未填' : sourceName(id);
      const color = id === 'unknown' ? '#D9CFBB' : SOURCES.find((s) => s.id === id).color;
      return { id, name, color, count, pct };
    })
    .filter((s) => s.count > 0);

  return `
    <div class="analytics-block">
      <div class="analytics-title">客戶來源佔比(當月新建立客戶,共 ${total} 位)</div>
      <div class="stack-bar">
        ${segs.map((s) => `<div class="stack-seg" style="width:${s.pct}%;background:${s.color};"></div>`).join('')}
      </div>
      ${segs
        .map(
          (s) =>
            `<div class="legend-row"><span><span class="legend-dot" style="background:${s.color};"></span>${s.name} ${s.count} 位(${s.pct}%)</span></div>`
        )
        .join('')}
    </div>
  `;
}

function productSalesHtml(summary) {
  const revenuePct = summary.total_revenue ? Math.round((summary.product_revenue / summary.total_revenue) * 100) : 0;
  const profitPct = summary.profit ? Math.round((summary.product_profit / summary.profit) * 100) : 0;

  return `
    <div class="analytics-block">
      <div class="analytics-title">商品銷售(本月)</div>
      <div class="revenue-nums" style="margin-top:0;">
        <div class="revenue-num-block">
          <div class="revenue-num-label">商品營收</div>
          <div class="revenue-num-value" style="color:var(--text);font-size:16px;">$${formatMoney(summary.product_revenue)}</div>
        </div>
        <div class="revenue-num-block">
          <div class="revenue-num-label">商品成本</div>
          <div class="revenue-num-value" style="color:var(--text);font-size:16px;">$${formatMoney(summary.product_cost)}</div>
        </div>
        <div class="revenue-num-block">
          <div class="revenue-num-label">商品淨利</div>
          <div class="revenue-num-value" style="color:var(--accent);font-size:16px;">$${formatMoney(summary.product_profit)}</div>
        </div>
      </div>
      <div class="field-hint" style="margin:10px 0 14px;">佔總營業額 ${revenuePct}% ・ 佔總淨利潤 ${profitPct}%</div>
      <button class="secondary-btn" id="manage-product-sales-btn" style="margin-top:0;">商品銷售明細 / 新增</button>
    </div>
  `;
}

function packagesReminderHtml(lowRemaining, expiring) {
  return `
    <div class="analytics-block">
      <div class="analytics-title">療程管理</div>
      <div class="revenue-nums" style="margin-top:0;">
        <div class="revenue-num-block">
          <div class="revenue-num-label">即將用完</div>
          <div class="revenue-num-value" style="color:${lowRemaining.length ? '#B5533C' : 'var(--text)'};font-size:16px;">${lowRemaining.length} 位</div>
        </div>
        <div class="revenue-num-block">
          <div class="revenue-num-label">即將到期</div>
          <div class="revenue-num-value" style="color:${expiring.length ? '#B5533C' : 'var(--text)'};font-size:16px;">${expiring.length} 位</div>
        </div>
      </div>
      <button class="secondary-btn" id="manage-packages-btn" style="margin-top:14px;">查看療程明細</button>
    </div>
  `;
}

function openRentModal(app, month, currentRent) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">編輯 ${monthLabel(month)} 租金</div>
      <div class="field">
        <input type="number" id="rent-input" min="0" step="1" value="${currentRent || ''}" placeholder="0" />
      </div>
      <button class="primary-btn" id="rent-confirm">儲存</button>
      <button class="secondary-btn" id="rent-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('rent-cancel').onclick = () => overlay.remove();
  document.getElementById('rent-confirm').onclick = async () => {
    const rent = Number(document.getElementById('rent-input').value) || 0;
    await setRent(app.salon.id, month, rent);
    overlay.remove();
    loadContent(app, month);
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
