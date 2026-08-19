import { listRecentLineContacts, matchLineContact, listUpcomingFollowUps } from '../lib/lineIntegration.js';
import { searchClientsByName } from '../lib/data.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';

export async function renderLineHub(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="header">
        <div>
          <div class="header-eyebrow">LINE</div>
          <h1 class="header-title">LINE 客戶與追蹤</h1>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn-ghost" id="templates-btn" style="height:38px;">話術管理</button>
          ${homeButtonHtml()}
        </div>
      </div>
      <div class="list-scroll" id="linehub-content" style="padding-top:0;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      ${tabBarHtml('lineHub')}
    </div>
  `;
  bindTabBar(app);
  bindHomeButton(app);
  document.getElementById('templates-btn').onclick = () => app.navigate('messageTemplates');
  await loadContent(app);
}

async function loadContent(app) {
  const content = document.getElementById('linehub-content');
  try {
    const [contacts, followUps] = await Promise.all([
      listRecentLineContacts(app.salon.id, 30),
      listUpcomingFollowUps(app.salon.id),
    ]);

    content.innerHTML = `
      <div class="analytics-block">
        <div class="analytics-title">近期 LINE 客戶</div>
        ${
          contacts.length
            ? contacts.map((c) => contactRowHtml(c)).join('')
            : `<div class="empty-body">目前沒有 LINE 互動紀錄,請客人先加官方帳號好友、傳一句話</div>`
        }
      </div>

      <div class="section-label">LINE 追蹤排程</div>
      <div class="analytics-block">
        ${
          followUps.length
            ? followUps.map((f) => followUpRowHtml(f)).join('')
            : `<div class="empty-body">目前沒有排程中的追蹤</div>`
        }
      </div>
    `;

    content.querySelectorAll('.lh-client-row').forEach((row) => {
      row.onclick = () => app.navigate('clientDetail', { clientId: row.dataset.clientId });
    });
    content.querySelectorAll('.lh-match-btn').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const contact = contacts.find((c) => c.id === btn.dataset.id);
        if (contact) openMatchClientModal(app, contact, () => loadContent(app));
      };
    });
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
  }
}

function contactRowHtml(c) {
  const matched = !!c.clients?.id;
  return `
    <div class="visit-list-row ${matched ? 'lh-client-row' : ''}" data-client-id="${c.clients?.id || ''}" style="cursor:${matched ? 'pointer' : 'default'};align-items:flex-start;">
      <div class="vlr-left">
        <div class="vlr-name">${matched ? escapeHtml(c.clients.name) : '尚未配對'}</div>
        <div class="vlr-date">${escapeHtml(c.last_message_text || '')}(${formatDateTime(c.last_event_at)})</div>
      </div>
      ${!matched ? `<button type="button" class="secondary-btn lh-match-btn" data-id="${c.id}" style="width:auto;margin-top:0;padding:8px 14px;">配對客戶</button>` : ''}
    </div>
  `;
}

function followUpRowHtml(f) {
  const statusMap = {
    pending: { text: '待發送', color: '#9B8F7F' },
    sent: { text: '已發送', color: '#4E8B5C' },
    failed: { text: '發送失敗', color: '#B5533C' },
  };
  const s = statusMap[f.status] || statusMap.pending;
  return `
    <div class="visit-list-row lh-client-row" data-client-id="${f.clients?.id || ''}" style="cursor:pointer;">
      <div class="vlr-left">
        <div class="vlr-name">${f.scheduled_at}・${escapeHtml(f.clients?.name || '未知客戶')}・${escapeHtml(f.label)}</div>
        <div class="vlr-date" style="color:${s.color};">${s.text}</div>
      </div>
    </div>
  `;
}

function openMatchClientModal(app, contact, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-height:80vh;overflow-y:auto;">
      <div class="modal-title">配對客戶</div>
      <div class="field-hint" style="margin-bottom:10px;">最後一則訊息:${escapeHtml(contact.last_message_text || '')}</div>
      <div class="field">
        <input type="text" id="lh-search-input" placeholder="搜尋客戶姓名" />
      </div>
      <div id="lh-search-results" style="margin-top:10px;"></div>
      <button class="secondary-btn" id="lh-match-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('lh-match-cancel').onclick = () => overlay.remove();

  const input = document.getElementById('lh-search-input');
  const resultsEl = document.getElementById('lh-search-results');
  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const q = input.value.trim();
      if (!q) {
        resultsEl.innerHTML = '';
        return;
      }
      const results = await searchClientsByName(app.salon.id, q);
      resultsEl.innerHTML = results.length
        ? results
            .map(
              (c) => `<button type="button" class="card lh-pick-btn" data-id="${c.id}" style="width:100%;">
              <div class="card-main"><div class="card-name">${escapeHtml(c.name)}</div><div class="card-sub">${escapeHtml(c.phone || '未留電話')}</div></div>
            </button>`
            )
            .join('')
        : `<div class="empty-body">找不到符合的客戶</div>`;
      resultsEl.querySelectorAll('.lh-pick-btn').forEach((btn) => {
        btn.onclick = async () => {
          btn.disabled = true;
          try {
            await matchLineContact(contact.id, contact.line_user_id, btn.dataset.id, app.salon.id);
            overlay.remove();
            onDone();
          } catch (err) {
            alert('配對失敗:' + err.message);
            btn.disabled = false;
          }
        };
      });
    }, 250);
  });
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
