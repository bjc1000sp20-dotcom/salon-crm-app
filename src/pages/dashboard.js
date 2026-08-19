import { getMonthlySummary, getMonthlyAnalytics, listRecentVisits, listUpcomingRepurchases } from '../lib/data.js';
import { listLowRemainingPackages, listExpiringPackages } from '../lib/packages.js';
import { listClientsWithMeta } from '../lib/clientDirectory.js';
import {
  listTodayAppointments,
  listTodayFollowUps,
  listRecentLineContacts,
  countClientsWithoutLine,
  countFailedFollowUps,
} from '../lib/lineIntegration.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';
import { listThisMonthBirthdayClients } from '../lib/birthdays.js';

const SLEEPING_THRESHOLD_DAYS = 60;

export async function renderDashboard(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="header">
        <div>
          <div class="header-eyebrow">${escapeHtml(app.salon.salon_name || 'TODAY')}</div>
          <h1 class="header-title">今日工作台</h1>
        </div>
      </div>
      <div class="list-scroll" id="dashboard-content" style="padding-top:0;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      ${tabBarHtml('dashboard')}
    </div>
  `;
  bindTabBar(app);
  await loadContent(app);
}

async function loadContent(app) {
  const content = document.getElementById('dashboard-content');
  const month = new Date().toISOString().slice(0, 7);
  const salonId = app.salon.id;

  let data;
  try {
    const [
      todayAppointments,
      todayFollowUps,
      repurchases,
      lowPackages,
      expiringPackages,
      recentLineContacts,
      noLineCount,
      failedCount,
      summary,
      analytics,
      recentVisits,
      clientsWithMeta,
      birthdayClients,
    ] = await Promise.all([
      listTodayAppointments(salonId),
      listTodayFollowUps(salonId),
      listUpcomingRepurchases(salonId),
      listLowRemainingPackages(salonId),
      listExpiringPackages(salonId),
      listRecentLineContacts(salonId, 5),
      countClientsWithoutLine(salonId),
      countFailedFollowUps(salonId),
      getMonthlySummary(salonId, month),
      getMonthlyAnalytics(salonId, month),
      listRecentVisits(salonId, 5),
      listClientsWithMeta(salonId),
      listThisMonthBirthdayClients(salonId),
    ]);
    const sleepingClients = clientsWithMeta.filter(
      (c) => c.daysSinceLastVisit != null && c.daysSinceLastVisit >= SLEEPING_THRESHOLD_DAYS
    );
    data = {
      todayAppointments,
      todayFollowUps,
      repurchases,
      lowPackages,
      expiringPackages,
      recentLineContacts,
      noLineCount,
      failedCount,
      summary,
      analytics,
      recentVisits,
      sleepingClients,
      birthdayClients,
    };
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  content.innerHTML = `
    ${todoCountsHtml(data)}
    ${quickActionsHtml()}
    ${todayAppointmentsHtml(app, data.todayAppointments)}
    ${contactTodayHtml(app, data)}
    ${monthSummaryHtml(app, data.summary, data.analytics)}
    ${recentActivityHtml(app, data.recentVisits, data.recentLineContacts)}
  `;

  bindEvents(app, content);
}

function todoCountsHtml(d) {
  const birthdayNoLine = d.birthdayClients.filter((c) => c.birthday_reminder_enabled && !c.line_user_id).length;
  const birthdayFailed = d.birthdayClients.filter((c) => c.birthdayFollowUp?.status === 'failed').length;

  const tiles = [
    { label: '今日預約', count: d.todayAppointments.length, urgent: d.todayAppointments.length > 0 },
    { label: '今日待追蹤', count: d.todayFollowUps.length, urgent: d.todayFollowUps.length > 0 },
    { label: '即將回購', count: d.repurchases.length, urgent: false },
    { label: '療程即將用完/到期', count: d.lowPackages.length + d.expiringPackages.length, urgent: false },
    { label: '沉睡客戶', count: d.sleepingClients.length, urgent: false },
    { label: '注意事項', count: d.noLineCount + d.failedCount, urgent: d.failedCount > 0 },
    { label: '🎂 本月壽星', count: d.birthdayClients.length, urgent: false, id: 'dash-birthday-tile' },
  ];
  return `
    <div class="analytics-block">
      <div class="analytics-title">今日待處理</div>
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;">
        ${tiles
          .map(
            (t) => `
          <div ${t.id ? `id="${t.id}"` : ''} style="background:#F7F1E4;border-radius:12px;padding:12px 14px;${t.id ? 'cursor:pointer;' : ''}">
            <div style="font-size:12px;color:#9B8F7F;">${t.urgent ? '🔴 ' : t.count > 0 ? '🟡 ' : '⚪ '}${t.label}</div>
            <div style="font-size:22px;font-weight:700;color:#3A332B;">${t.count}</div>
          </div>`
          )
          .join('')}
      </div>
      ${
        birthdayNoLine || birthdayFailed
          ? `<div style="margin-top:10px;font-size:12px;color:#B5533C;">
               ${birthdayNoLine ? `⚠️ ${birthdayNoLine} 位本月壽星尚未綁定 LINE　` : ''}${birthdayFailed ? `⚠️ ${birthdayFailed} 位生日訊息發送失敗` : ''}
             </div>`
          : ''
      }
    </div>
  `;
}

function quickActionsHtml() {
  return `
    <div style="display:flex;gap:8px;margin:14px 0;">
      <button class="secondary-btn" id="dash-add-client-btn" style="margin-top:0;">＋新增客戶</button>
      <button class="secondary-btn" id="dash-add-appointment-btn" style="margin-top:0;">＋新增預約</button>
      <button class="secondary-btn" id="dash-add-followup-btn" style="margin-top:0;">＋新增 LINE 追蹤</button>
    </div>
  `;
}

function todayAppointmentsHtml(app, appointments) {
  return `
    <div class="section-label">今日預約名單</div>
    <div class="analytics-block">
      ${
        appointments.length
          ? appointments
              .map(
                (a) => `
          <div class="visit-list-row dash-client-row" data-client-id="${a.clients?.id || ''}" style="cursor:pointer;">
            <div class="vlr-left">
              <div class="vlr-name">${a.appointment_time ? a.appointment_time.slice(0, 5) : '時間未定'}・${escapeHtml(a.clients?.name || '未知客戶')}</div>
              <div class="vlr-date">${escapeHtml(a.service_note || '')}</div>
            </div>
          </div>`
              )
              .join('')
          : `<div class="empty-body">今天沒有預約</div>`
      }
    </div>
  `;
}

function contactTodayHtml(app, d) {
  const items = [
    ...d.todayFollowUps.map((f) => ({
      clientId: f.clients?.id,
      label: `${escapeHtml(f.clients?.name || '未知客戶')} — ${escapeHtml(f.label)}(LINE 追蹤待發送)`,
    })),
    ...d.repurchases.map((r) => ({
      clientId: r.clients?.id,
      label: `${escapeHtml(r.clients?.name || '未指定客戶')} — ${escapeHtml(r.item_name)}即將用完`,
    })),
    ...d.lowPackages.map((p) => ({
      clientId: p.clients?.id,
      label: `${escapeHtml(p.clients?.name || '未知客戶')} — 療程「${escapeHtml(p.package_name)}」剩 ${p.remaining_sessions} 堂`,
    })),
    ...d.expiringPackages.map((p) => ({
      clientId: p.clients?.id,
      label: `${escapeHtml(p.clients?.name || '未知客戶')} — 療程「${escapeHtml(p.package_name)}」${p.expire_date} 到期`,
    })),
    ...d.sleepingClients.slice(0, 10).map((c) => ({
      clientId: c.id,
      label: `${escapeHtml(c.name)} — 已 ${c.daysSinceLastVisit} 天未回訪`,
    })),
  ];

  return `
    <div class="section-label">今天該聯絡誰</div>
    <div class="analytics-block">
      ${
        items.length
          ? items
              .map(
                (it) => `
          <div class="visit-list-row dash-client-row" data-client-id="${it.clientId || ''}" style="cursor:${it.clientId ? 'pointer' : 'default'};">
            <div class="vlr-left"><div class="vlr-name">${it.label}</div></div>
          </div>`
              )
              .join('')
          : `<div class="empty-body">目前沒有需要聯絡的客戶</div>`
      }
    </div>
  `;
}

function monthSummaryHtml(app, summary, analytics) {
  return `
    <div class="section-label">本月簡易數據</div>
    <div class="analytics-block">
      <div class="revenue-nums" style="margin-top:0;">
        <div class="revenue-num-block">
          <div class="revenue-num-label">本月營收</div>
          <div class="revenue-num-value" style="font-size:16px;">$${formatMoney(summary.total_revenue)}</div>
        </div>
        <div class="revenue-num-block">
          <div class="revenue-num-label">本月客數</div>
          <div class="revenue-num-value" style="font-size:16px;">${analytics.total_clients || 0} 位</div>
        </div>
        <div class="revenue-num-block">
          <div class="revenue-num-label">平均客單價</div>
          <div class="revenue-num-value" style="font-size:16px;">$${formatMoney(analytics.total_clients ? summary.total_revenue / analytics.total_clients : 0)}</div>
        </div>
      </div>
      <button class="secondary-btn" id="dash-view-revenue-btn" style="margin-top:14px;">查看完整營收分析</button>
    </div>
  `;
}

function recentActivityHtml(app, recentVisits, recentLineContacts) {
  return `
    <div class="section-label">最近客戶動態</div>
    <div class="analytics-block">
      <div class="field-label">最近到店</div>
      ${
        recentVisits.length
          ? recentVisits
              .map(
                (v) => `
          <div class="visit-list-row dash-client-row" data-client-id="${v.clients?.id || ''}" style="cursor:pointer;">
            <div class="vlr-left"><div class="vlr-name">${escapeHtml(v.clients?.name || '未知客戶')}</div><div class="vlr-date">${v.visit_date}</div></div>
          </div>`
              )
              .join('')
          : `<div class="empty-body">還沒有到店紀錄</div>`
      }
      <div class="field-label" style="margin-top:12px;">最近 LINE 互動</div>
      ${
        recentLineContacts.length
          ? recentLineContacts
              .map(
                (c) => `
          <div class="visit-list-row dash-client-row" data-client-id="${c.clients?.id || ''}" style="cursor:${c.clients?.id ? 'pointer' : 'default'};">
            <div class="vlr-left"><div class="vlr-name">${escapeHtml(c.clients?.name || '(尚未配對)')}</div><div class="vlr-date">${escapeHtml(c.last_message_text || '')}</div></div>
          </div>`
              )
              .join('')
          : `<div class="empty-body">還沒有 LINE 互動</div>`
      }
      <button class="secondary-btn" id="dash-view-linehub-btn" style="margin-top:14px;">查看全部 LINE 客戶</button>
    </div>
  `;
}

function bindEvents(app, content) {
  content.querySelectorAll('.dash-client-row').forEach((row) => {
    row.onclick = () => {
      if (row.dataset.clientId) app.navigate('clientDetail', { clientId: row.dataset.clientId });
    };
  });
  const revenueBtn = document.getElementById('dash-view-revenue-btn');
  if (revenueBtn) revenueBtn.onclick = () => app.navigate('revenue');
  const lineHubBtn = document.getElementById('dash-view-linehub-btn');
  if (lineHubBtn) lineHubBtn.onclick = () => app.navigate('lineHub');
  const birthdayTile = document.getElementById('dash-birthday-tile');
  if (birthdayTile) birthdayTile.onclick = () => app.navigate('birthdays');

  document.getElementById('dash-add-client-btn').onclick = () => app.navigate('clientForm', { mode: 'create' });
  // 新增預約/LINE 追蹤都需要先挑客戶,導去客戶列表,選好客戶後再從客戶詳情頁操作(沿用既有流程,不重做一份客戶搜尋元件)
  document.getElementById('dash-add-appointment-btn').onclick = () => app.navigate('clientList');
  document.getElementById('dash-add-followup-btn').onclick = () => app.navigate('clientList');
}

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('zh-TW');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
