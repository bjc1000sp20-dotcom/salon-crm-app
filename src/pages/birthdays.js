import { listThisMonthBirthdayClients, sendBirthdayNow } from '../lib/birthdays.js';

export async function renderBirthdays(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">本月壽星</div>
        <div style="width:38px;"></div>
      </div>
      <div class="list-scroll" id="birthdays-list" style="padding-top:16px;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
    </div>
  `;
  document.getElementById('back-btn').onclick = () => app.navigate('dashboard');
  await loadList(app);
}

async function loadList(app) {
  const listEl = document.getElementById('birthdays-list');
  if (!listEl) return;

  let clients;
  try {
    clients = await listThisMonthBirthdayClients(app.salon.id);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  clients.sort((a, b) => Number(a.birth_date.slice(8, 10)) - Number(b.birth_date.slice(8, 10)));

  listEl.innerHTML = clients.length
    ? clients.map((c) => rowHtml(c)).join('')
    : `<div class="empty-state"><div class="empty-body">這個月沒有客戶生日</div></div>`;

  listEl.querySelectorAll('.bd-client-row').forEach((row) => {
    row.onclick = () => app.navigate('clientDetail', { clientId: row.dataset.clientId });
  });
  listEl.querySelectorAll('.bd-resend-btn').forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const client = clients.find((c) => c.id === btn.dataset.id);
      if (!client) return;
      btn.disabled = true;
      btn.textContent = '發送中...';
      try {
        await sendBirthdayNow(app, client, client.birthdayFollowUp);
        await loadList(app);
      } catch (err) {
        alert('發送失敗:' + err.message);
        btn.disabled = false;
        btn.textContent = '重新發送';
      }
    };
  });
}

function rowHtml(c) {
  const monthDay = `${Number(c.birth_date.slice(5, 7))}/${Number(c.birth_date.slice(8, 10))}`;
  const lineLabel = c.line_user_id ? 'LINE ✓' : '未綁定 LINE';
  const reminderLabel = c.birthday_reminder_enabled ? '提醒開啟' : '提醒關閉';

  let statusLabel = '無法發送';
  let statusColor = '#B0A996';
  let resendBtn = '';
  if (c.birthday_reminder_enabled && c.line_user_id) {
    const f = c.birthdayFollowUp;
    if (!f) {
      statusLabel = '待處理';
      statusColor = '#9B8F7F';
    } else if (f.status === 'sent') {
      statusLabel = '已發送';
      statusColor = '#4E8B5C';
    } else if (f.status === 'failed') {
      statusLabel = '發送失敗';
      statusColor = '#B5533C';
      resendBtn = `<button type="button" class="tag bd-resend-btn" data-id="${c.id}" style="cursor:pointer;border:none;background:#F5E3DC;color:#B5533C;">重新發送</button>`;
    } else if (f.status === 'skipped') {
      statusLabel = '今年已略過';
      statusColor = '#B0A996';
    } else {
      statusLabel = '排程中';
      statusColor = '#9B8F7F';
    }
  }

  return `
    <div class="visit-list-row bd-client-row" data-client-id="${c.id}" style="cursor:pointer;align-items:flex-start;">
      <div class="vlr-left">
        <div class="vlr-name">${escapeHtml(c.name)}・${monthDay}</div>
        <div class="vlr-date">${lineLabel}・${reminderLabel}</div>
        ${resendBtn ? `<div style="margin-top:6px;">${resendBtn}</div>` : ''}
      </div>
      <div style="color:${statusColor};font-size:13px;font-weight:600;">${statusLabel}</div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
