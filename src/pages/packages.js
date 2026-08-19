import { listLowRemainingPackages, listExpiringPackages } from '../lib/packages.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';

export async function renderPackages(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">療程管理</div>
        ${homeButtonHtml()}
      </div>
      <div class="list-scroll" style="padding-top:16px;" id="packages-page-list">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('revenue');
  bindHomeButton(app);

  await loadList(app);
}

async function loadList(app) {
  const listEl = document.getElementById('packages-page-list');
  if (!listEl) return;

  const [lowRemaining, expiring] = await Promise.all([
    listLowRemainingPackages(app.salon.id),
    listExpiringPackages(app.salon.id),
  ]);

  listEl.innerHTML = `
    <div class="analytics-block">
      <div class="analytics-title">即將用完(剩餘 ≤ 2 堂)</div>
      ${
        lowRemaining.length
          ? lowRemaining.map((p) => rowHtml(p, `剩餘 ${p.remaining_sessions} 堂`)).join('')
          : `<div class="empty-body">目前沒有快用完的療程</div>`
      }
    </div>
    <div class="analytics-block">
      <div class="analytics-title">即將到期(30 天內)</div>
      ${
        expiring.length
          ? expiring.map((p) => rowHtml(p, `到期日:${p.expire_date}`)).join('')
          : `<div class="empty-body">目前沒有快到期的療程</div>`
      }
    </div>
  `;

  listEl.querySelectorAll('.pkg-list-row').forEach((row) => {
    row.onclick = () => app.navigate('clientDetail', { clientId: row.dataset.clientId });
  });
}

function rowHtml(p, subLabel) {
  return `
    <div class="visit-list-row pkg-list-row" data-client-id="${p.clients?.id || ''}" style="cursor:pointer;">
      <div class="vlr-left">
        <div class="vlr-name">${escapeHtml(p.clients?.name || '未知客戶')}・${escapeHtml(p.package_name)}</div>
        <div class="vlr-date">${subLabel}</div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
