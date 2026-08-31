import { getMonthlySummary, getMonthlyAnalytics, listRecentVisits, listUpcomingRepurchases } from '../lib/data.js';
import { listLowRemainingPackages, listExpiringPackages } from '../lib/packages.js';
import { listClientsWithMeta } from '../lib/clientDirectory.js';
import {
  listTodayAppointments,
  listTodayCreatedAppointments,
  listTodayFollowUps,
  listRecentLineContacts,
  countClientsWithoutLine,
  countFailedFollowUps,
  addDaysToDate,
} from '../lib/lineIntegration.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';
import { listThisMonthBirthdayClients } from '../lib/birthdays.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';
import { openQuickAppointmentModal } from '../components/quickAppointmentModal.js';
import { openAppointmentDetailModal } from '../components/appointmentDetailModal.js';
import { openDeleteAppointmentModal } from '../components/deleteAppointmentModal.js';
import { listTodayAndOverdueLeadFollowUps, completeLeadFollowUp, snoozeLeadFollowUp, buildInstagramUrl } from '../lib/leads.js';
import { openLeadFollowUpModal } from '../components/leadFollowUpModal.js';
import { openLeadDetailModal } from '../components/leadDetailModal.js';

const SLEEPING_THRESHOLD_DAYS = 60;

export async function renderDashboard(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="header">
        <div>
          <div class="header-eyebrow">${escapeHtml(app.salon.salon_name || 'TODAY')}</div>
          <h1 class="header-title">今日工作台</h1>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${homeButtonHtml()}
        </div>
      </div>
      <div class="list-scroll" id="dashboard-content" style="padding-top:0;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      ${tabBarHtml('dashboard')}
    </div>
  `;
  bindTabBar(app);
  bindHomeButton(app);
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
      todayCreatedAppointments,
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
      leadFollowUps,
    ] = await Promise.all([
      listTodayAppointments(salonId),
      listTodayCreatedAppointments(salonId),
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
      listTodayAndOverdueLeadFollowUps(salonId),
    ]);
    const sleepingClients = clientsWithMeta.filter(
      (c) => c.daysSinceLastVisit != null && c.daysSinceLastVisit >= SLEEPING_THRESHOLD_DAYS
    );
    data = {
      todayAppointments,
      todayCreatedAppointments,
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
      leadFollowUps,
    };
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  content.innerHTML = `
    ${todoCountsHtml(data)}
    ${quickActionsHtml()}
    ${todayCreatedAppointmentsHtml(app, data.todayCreatedAppointments)}
    ${todayAppointmentsHtml(app, data.todayAppointments)}
    ${contactTodayHtml(app, data)}
    ${monthSummaryHtml(app, data.summary, data.analytics)}
    ${recentActivityHtml(app, data.recentVisits, data.recentLineContacts)}
  `;

  bindEvents(app, content, data);
}

// 統一線性 icon 組:同一套 stroke 粗細/線頭樣式(比照 passwordToggle.js 的眼睛 icon),
// 不混用實心/線條,顏色一律用 currentColor,由外層依重要程度決定顏色,不在 icon 本身寫死顏色。
const TILE_ICONS = {
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><line x1="3.5" y1="9.5" x2="20.5" y2="9.5"/><line x1="8" y1="3" x2="8" y2="6.5"/><line x1="16" y1="3" x2="16" y2="6.5"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 4.2 1.4 5.5 1.4 5.5h-13.8s1.4-1.3 1.4-5.5z"/><path d="M10.2 18.5a1.8 1.8 0 0 0 3.6 0"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5M19.5 12a7.5 7.5 0 0 1-12.6 5.5"/><polyline points="17 3.5 17.1 6.5 14.1 6.6"/><polyline points="7 20.5 6.9 17.5 9.9 17.4"/></svg>`,
  hourglass: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h11M6.5 20.5h11M7.5 3.5c0 5 4 5.8 4.5 5.8s4.5-.8 4.5-5.8M7.5 20.5c0-5 4-5.8 4.5-5.8s4.5.8 4.5 5.8"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.2a8 8 0 1 1-10.2-10A6.5 6.5 0 0 0 20 14.2z"/></svg>`,
  alertCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><line x1="12" y1="7.8" x2="12" y2="12.8"/><line x1="12" y1="16" x2="12" y2="16.01"/></svg>`,
  cake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="7.5"/><path d="M11.3 3c0-.8.7-1.3.7-1.3s.7.5.7 1.3-.3 1-.7 1-.7-.2-.7-1z"/><rect x="4" y="11" width="16" height="8.5" rx="1.5"/><path d="M4 14.8c1.4.9 2.4-.8 3.8 0s2.4.9 3.8 0 2.4-.8 3.8 0 2.4.9 3.8 0"/></svg>`,
  messageCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5a8 8 0 0 1-8.5 8 8 8 0 0 1-3.6-.85L3.5 20l1.4-4.9A8 8 0 1 1 20.5 11.5z"/></svg>`,
};

function tileIconColor(t) {
  if (t.urgent) return 'var(--red)';
  if (t.count > 0) return 'var(--accent)';
  return 'var(--text-tertiary)';
}

function todoCountsHtml(d) {
  const birthdayNoLine = d.birthdayClients.filter((c) => c.birthday_reminder_enabled && !c.line_user_id).length;
  const birthdayFailed = d.birthdayClients.filter((c) => c.birthdayFollowUp?.status === 'failed').length;

  const tiles = [
    { label: '今日預約', count: d.todayAppointments.length, urgent: d.todayAppointments.length > 0, icon: 'calendar' },
    { label: '今日待追蹤', count: d.todayFollowUps.length, urgent: d.todayFollowUps.length > 0, icon: 'bell' },
    { label: '即將回購', count: d.repurchases.length, urgent: false, icon: 'refresh' },
    { label: '療程即將用完/到期', count: d.lowPackages.length + d.expiringPackages.length, urgent: false, icon: 'hourglass' },
    { label: '沉睡客戶', count: d.sleepingClients.length, urgent: false, icon: 'moon' },
    { label: '注意事項', count: d.noLineCount + d.failedCount, urgent: d.failedCount > 0, icon: 'alertCircle' },
    { label: '本月壽星', count: d.birthdayClients.length, urgent: false, id: 'dash-birthday-tile', icon: 'cake' },
    { label: '待追蹤', count: d.leadFollowUps.length, urgent: d.leadFollowUps.length > 0, id: 'dash-lead-tile', icon: 'messageCircle' },
  ];
  return `
    <div class="analytics-block">
      <div class="analytics-title">今日待處理</div>
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;">
        ${tiles
          .map(
            (t) => `
          <div ${t.id ? `id="${t.id}"` : ''} style="background:${t.urgent ? 'var(--red-bg)' : '#F7F1E4'};border-left:3px solid ${t.urgent ? 'var(--red)' : 'transparent'};border-radius:10px;padding:12px 14px 12px ${t.urgent ? '11px' : '14px'};${t.id ? 'cursor:pointer;' : ''}">
            <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-tertiary);">
              <span style="display:inline-flex;width:15px;height:15px;color:${tileIconColor(t)};flex-shrink:0;">${TILE_ICONS[t.icon]}</span>
              <span>${t.label}</span>
            </div>
            <div style="font-size:22px;font-weight:700;color:var(--text);margin-top:4px;">${t.count}</div>
          </div>`
          )
          .join('')}
      </div>
      ${
        birthdayNoLine || birthdayFailed
          ? `<div style="margin-top:10px;font-size:12px;color:var(--red);">
               ${birthdayNoLine ? `${birthdayNoLine} 位本月壽星尚未綁定 LINE　` : ''}${birthdayFailed ? `${birthdayFailed} 位生日訊息發送失敗` : ''}
             </div>`
          : ''
      }
    </div>
  `;
}

function quickActionsHtml() {
  return `
    <div style="display:flex;gap:8px;margin:14px 0;flex-wrap:wrap;">
      <button class="secondary-btn" id="dash-add-client-btn" style="margin-top:0;">＋新增客戶</button>
      <button class="secondary-btn" id="dash-add-appointment-btn" style="margin-top:0;">＋新增預約</button>
      <button class="secondary-btn" id="dash-add-followup-btn" style="margin-top:0;">＋新增 LINE 追蹤</button>
      <button class="secondary-btn" id="dash-add-lead-btn" style="margin-top:0;">＋提醒追蹤客戶</button>
    </div>
  `;
}

function todayCreatedAppointmentsHtml(app, appointments) {
  return `
    <div class="section-label">今日已建立預約</div>
    <div class="analytics-block">
      ${
        appointments.length
          ? appointments.map((a) => todayCreatedAppointmentRowHtml(a)).join('')
          : `<div class="empty-body">今天尚未建立預約</div>`
      }
    </div>
  `;
}

function todayCreatedAppointmentRowHtml(a) {
  const client = a.clients || {};
  const hasReminder = (a.follow_ups || []).some((f) => f.kind === 'appointment_reminder');
  const timeLabel = a.appointment_time ? a.appointment_time.slice(0, 5) : '時間未定';
  const createdLabel = formatTime(a.created_at);
  return `
    <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-bottom:10px;">
      <div class="card-name">${escapeHtml(a.appointment_date)} ${timeLabel}・${escapeHtml(client.name || '未知客戶')}</div>
      <div class="card-sub">${escapeHtml(a.service_note || '(未填寫項目)')}</div>
      <div class="visit-tags" style="margin-top:8px;">
        <span class="tag" style="background:${client.line_user_id ? '#E7EFE4' : '#F0EADA'};color:${client.line_user_id ? '#4E8B5C' : '#9B8F7F'};">${client.line_user_id ? 'LINE 已綁定 ✓' : 'LINE 未綁定'}</span>
        ${hasReminder ? `<span class="tag" style="background:#E7EFE4;color:#4E8B5C;">預約提醒 ✓</span>` : ''}
      </div>
      <div class="field-hint" style="margin-top:6px;">建立於:${createdLabel}</div>
      <div class="visit-tags" style="margin-top:8px;">
        <button type="button" class="tag dash-appt-view-btn" data-id="${a.id}" style="cursor:pointer;border:none;background:#F0EADA;">查看</button>
        <button type="button" class="tag dash-appt-edit-btn" data-id="${a.id}" style="cursor:pointer;border:none;background:#F0EADA;">編輯</button>
        <button type="button" class="tag dash-appt-delete-btn" data-id="${a.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">刪除</button>
      </div>
    </div>
  `;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

const LEAD_CHANNEL_LABEL = { instagram: 'Instagram', line: 'LINE', facebook: 'Facebook', threads: 'Threads', phone: '電話', other: '其他' };

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

  const todayStr = new Date().toISOString().slice(0, 10);

  return `
    <div class="section-label">今天該聯絡誰</div>
    <div class="analytics-block">
      ${
        items.length || d.leadFollowUps.length
          ? items
              .map(
                (it) => `
          <div class="visit-list-row dash-client-row" data-client-id="${it.clientId || ''}" style="cursor:${it.clientId ? 'pointer' : 'default'};">
            <div class="vlr-left"><div class="vlr-name">${it.label}</div></div>
          </div>`
              )
              .join('') + d.leadFollowUps.map((f) => leadRowHtml(f, todayStr)).join('')
          : `<div class="empty-body">目前沒有需要聯絡的客戶</div>`
      }
    </div>
  `;
}

function leadRowHtml(f, todayStr) {
  const lead = f.leads;
  const overdueDays = f.remind_date < todayStr ? Math.round((new Date(todayStr) - new Date(f.remind_date)) / 86400000) : 0;
  const igUrl = buildInstagramUrl(lead.channel, lead.contact_handle);
  return `
    <div class="card dash-lead-row" style="cursor:default;flex-direction:column;align-items:stretch;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="tag" style="background:#EDE7F5;color:#6B5C9B;">${escapeHtml(LEAD_CHANNEL_LABEL[lead.channel] || lead.channel)}</span>
        ${overdueDays > 0 ? `<span style="color:#B5533C;font-size:12px;">⚠️ 已逾期 ${overdueDays} 天</span>` : ''}
      </div>
      <div class="card-name" style="margin-top:6px;">${escapeHtml(lead.name || lead.contact_handle || '未命名')}</div>
      ${lead.contact_handle ? `<div class="card-sub">${escapeHtml(lead.contact_handle)}</div>` : ''}
      ${lead.lead_statuses?.name ? `<div class="card-sub">${escapeHtml(lead.lead_statuses.name)}</div>` : ''}
      <div class="visit-note" style="margin-top:6px;">今天提醒:${escapeHtml(f.content)}</div>
      <div class="field-hint">提醒日期:${formatMD(f.remind_date)}</div>
      <div class="visit-tags" style="margin-top:8px;">
        ${igUrl ? `<button type="button" class="tag dash-lead-open-ig" data-url="${escapeAttr(igUrl)}" style="cursor:pointer;border:none;background:#F0EADA;">開啟 Instagram</button>` : ''}
        <button type="button" class="tag dash-lead-view" data-lead-id="${lead.id}" style="cursor:pointer;border:none;background:#F0EADA;">查看</button>
        <button type="button" class="tag dash-lead-complete" data-id="${f.id}" style="cursor:pointer;border:none;background:#E7EFE4;color:#4E8B5C;">完成</button>
        <button type="button" class="tag dash-lead-snooze-toggle" data-id="${f.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">延後</button>
      </div>
      <div class="dash-lead-snooze-choices" data-id="${f.id}" style="display:none;margin-top:8px;gap:6px;flex-wrap:wrap;align-items:center;">
        <button type="button" class="tag dash-lead-snooze-opt" data-id="${f.id}" data-date="${f.remind_date}" data-days="1" style="cursor:pointer;border:none;background:#F0EADA;">延後1天</button>
        <button type="button" class="tag dash-lead-snooze-opt" data-id="${f.id}" data-date="${f.remind_date}" data-days="3" style="cursor:pointer;border:none;background:#F0EADA;">延後3天</button>
        <button type="button" class="tag dash-lead-snooze-opt" data-id="${f.id}" data-date="${f.remind_date}" data-days="7" style="cursor:pointer;border:none;background:#F0EADA;">延後7天</button>
        <input type="date" class="dash-lead-snooze-custom-date" data-id="${f.id}" value="${f.remind_date}" style="font-size:12px;padding:4px 6px;" />
        <button type="button" class="tag dash-lead-snooze-custom-btn" data-id="${f.id}" style="cursor:pointer;border:none;background:#F0EADA;">套用</button>
      </div>
    </div>
  `;
}

function formatMD(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
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

function bindEvents(app, content, data) {
  content.querySelectorAll('.dash-appt-view-btn').forEach((btn) => {
    btn.onclick = () => {
      const appt = data.todayCreatedAppointments.find((a) => a.id === btn.dataset.id);
      if (!appt) return;
      openAppointmentDetailModal(app, appt, () => openEditAppointment(app, appt));
    };
  });
  content.querySelectorAll('.dash-appt-edit-btn').forEach((btn) => {
    btn.onclick = () => {
      const appt = data.todayCreatedAppointments.find((a) => a.id === btn.dataset.id);
      if (!appt) return;
      openEditAppointment(app, appt);
    };
  });
  content.querySelectorAll('.dash-appt-delete-btn').forEach((btn) => {
    btn.onclick = () => {
      const appt = data.todayCreatedAppointments.find((a) => a.id === btn.dataset.id);
      if (!appt) return;
      openDeleteAppointmentModal(app, appt, () => loadContent(app));
    };
  });

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
  const leadTile = document.getElementById('dash-lead-tile');
  if (leadTile) leadTile.onclick = () => app.navigate('leadTracking');

  document.getElementById('dash-add-client-btn').onclick = () => app.navigate('clientForm', { mode: 'create' });
  document.getElementById('dash-add-appointment-btn').onclick = () => {
    openQuickAppointmentModal(app, () => loadContent(app));
  };
  // LINE 追蹤需要先挑客戶,導去客戶列表,選好客戶後再從客戶詳情頁操作(沿用既有流程,不重做一份客戶搜尋元件)
  document.getElementById('dash-add-followup-btn').onclick = () => app.navigate('clientList');
  document.getElementById('dash-add-lead-btn').onclick = () => {
    openLeadFollowUpModal(app, () => loadContent(app));
  };

  content.querySelectorAll('.dash-lead-open-ig').forEach((btn) => {
    btn.onclick = () => window.open(btn.dataset.url, '_blank');
  });
  content.querySelectorAll('.dash-lead-view').forEach((btn) => {
    btn.onclick = () => openLeadDetailModal(app, btn.dataset.leadId, () => loadContent(app));
  });
  content.querySelectorAll('.dash-lead-complete').forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await completeLeadFollowUp(btn.dataset.id);
        await loadContent(app);
      } catch (err) {
        alert('操作失敗:' + err.message);
        btn.disabled = false;
      }
    };
  });
  content.querySelectorAll('.dash-lead-snooze-toggle').forEach((btn) => {
    btn.onclick = () => {
      const choices = content.querySelector(`.dash-lead-snooze-choices[data-id="${btn.dataset.id}"]`);
      if (choices) choices.style.display = choices.style.display === 'none' ? 'flex' : 'none';
    };
  });
  content.querySelectorAll('.dash-lead-snooze-opt').forEach((btn) => {
    btn.onclick = async () => {
      try {
        await snoozeLeadFollowUp(btn.dataset.id, addDaysToDate(btn.dataset.date, Number(btn.dataset.days)));
        await loadContent(app);
      } catch (err) {
        alert('操作失敗:' + err.message);
      }
    };
  });
  content.querySelectorAll('.dash-lead-snooze-custom-btn').forEach((btn) => {
    btn.onclick = async () => {
      const dateInput = content.querySelector(`.dash-lead-snooze-custom-date[data-id="${btn.dataset.id}"]`);
      if (!dateInput || !dateInput.value) return;
      try {
        await snoozeLeadFollowUp(btn.dataset.id, dateInput.value);
        await loadContent(app);
      } catch (err) {
        alert('操作失敗:' + err.message);
      }
    };
  });
}

function openEditAppointment(app, appt) {
  const client = appt.clients || {};
  openQuickAppointmentModal(app, () => loadContent(app), {
    client_id: client.id,
    appointment_id: appt.id,
    name: client.name || '',
    phone: client.phone || '',
    appointment_date: appt.appointment_date,
    appointment_time: appt.appointment_time,
    service_note: appt.service_note,
  });
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
