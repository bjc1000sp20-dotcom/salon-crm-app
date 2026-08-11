import { listClients, getBirthdayClients } from '../lib/data.js';
import { calcAge } from '../lib/calcAge.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';
import { birthdayBannerHtml } from '../components/birthdayBanner.js';

export async function renderClientList(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="header">
        <div>
          <div class="header-eyebrow">CLIENT RECORDS</div>
          <h1 class="header-title">客戶資料卡</h1>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="icon-btn" id="settings-btn" title="設定">⚙</button>
          <button class="btn-ghost" id="logout-btn" style="height:38px;">登出</button>
          <button class="add-btn" id="add-client-btn">＋</button>
        </div>
      </div>
      <div class="search-wrap">
        <span>🔍</span>
        <input id="search-input" type="text" placeholder="搜尋姓名或電話" value="${escapeHtml(app.params.search || '')}" />
      </div>
      <div class="list-scroll" id="list-scroll">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      ${tabBarHtml('clients')}
    </div>
  `;

  bindTabBar(app);
  document.getElementById('settings-btn').onclick = () => app.navigate('settings');
  document.getElementById('logout-btn').onclick = () => app.signOut();
  document.getElementById('add-client-btn').onclick = () => app.navigate('clientForm', { mode: 'create' });

  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadList(app, searchInput.value.trim()), 250);
  });

  await loadList(app, app.params.search || '');
}

async function loadList(app, search) {
  const listEl = document.getElementById('list-scroll');
  if (!listEl) return; // 使用者可能已經切換畫面

  try {
    const [clients, birthdayClients] = await Promise.all([
      listClients(app.salon.id, search),
      search ? Promise.resolve([]) : getBirthdayClients(app.salon.id, new Date().getMonth() + 1),
    ]);

    if (!clients.length) {
      listEl.innerHTML =
        (search ? '' : birthdayBannerHtml(birthdayClients)) +
        `<div class="empty-state">
          <div class="empty-icon">◐</div>
          <div class="empty-title">${search ? '找不到符合的客戶' : '還沒有任何客戶資料'}</div>
          <div class="empty-body">${search ? '試試看其他關鍵字' : '點右上角「＋」建立第一張客戶卡'}</div>
        </div>`;
      return;
    }

    const cardsHtml = clients
      .map((c) => {
        const age = calcAge(c.birth_date);
        const initial = (c.name || '?').slice(0, 1);
        return `
          <button class="card" data-id="${c.id}">
            <div class="card-avatar">${escapeHtml(initial)}</div>
            <div class="card-main">
              <div class="card-name-row">
                <span class="card-name">${escapeHtml(c.name)}</span>
                ${age != null ? `<span class="card-age">${age} 歲</span>` : ''}
              </div>
              <div class="card-sub">${escapeHtml(c.phone || '未留電話')}</div>
            </div>
          </button>
        `;
      })
      .join('');

    listEl.innerHTML = (search ? '' : birthdayBannerHtml(birthdayClients)) + cardsHtml;

    listEl.querySelectorAll('.card').forEach((card) => {
      card.onclick = () => app.navigate('clientDetail', { clientId: card.dataset.id });
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
