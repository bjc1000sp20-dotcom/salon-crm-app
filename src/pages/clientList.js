import { getBirthdayClients } from '../lib/data.js';
import { listClientsWithMeta } from '../lib/clientDirectory.js';
import { ensureDefaultTags } from '../lib/tags.js';
import { calcAge } from '../lib/calcAge.js';
import { tabBarHtml, bindTabBar } from '../components/tabBar.js';
import { birthdayBannerHtml } from '../components/birthdayBanner.js';
import { SERVICES } from '../lib/services.js';
import { SOURCES } from '../lib/sources.js';

const EMPTY_FILTERS = {
  serviceIds: [],
  tagIds: [],
  source: '',
  onlyHasPackage: false,
  needsFollowUp: false,
  lastVisitBucket: 'all', // all | 30 | 60 | 90 | 180
  minSpend: '',
  lineStatus: 'all', // all | bound | unbound
};

export async function renderClientList(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="header">
        <div>
          <div class="header-eyebrow">${escapeHtml(app.salon.salon_name || 'CLIENT RECORDS')}</div>
          <h1 class="header-title">客戶資料卡</h1>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn-ghost" id="logout-btn" style="height:38px;">登出</button>
          <button class="add-btn" id="add-client-btn">＋</button>
        </div>
      </div>
      <div class="search-wrap" style="display:flex;gap:8px;align-items:center;">
        <div style="flex:1;display:flex;align-items:center;gap:6px;">
          <span>🔍</span>
          <input id="search-input" type="text" placeholder="搜尋姓名/電話/LINE/備註/標籤" value="${escapeHtml(app.params.search || '')}" style="flex:1;" />
        </div>
        <button class="btn-ghost" id="filter-btn" style="height:38px;white-space:nowrap;">篩選<span id="filter-count"></span></button>
      </div>
      <div class="list-scroll" id="list-scroll">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      ${tabBarHtml('clients')}
    </div>
  `;

  bindTabBar(app);
  document.getElementById('logout-btn').onclick = () => app.signOut();
  document.getElementById('add-client-btn').onclick = () => app.navigate('clientForm', { mode: 'create' });

  let allClients = [];
  let allTags = [];
  let filters = { ...EMPTY_FILTERS };
  let search = app.params.search || '';

  try {
    [allClients, allTags] = await Promise.all([listClientsWithMeta(app.salon.id), ensureDefaultTags(app.salon.id)]);
  } catch (err) {
    console.error(err);
    document.getElementById('list-scroll').innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  const birthdayClients = await getBirthdayClients(app.salon.id, new Date().getMonth() + 1).catch(() => []);

  function updateFilterCount() {
    const count =
      filters.serviceIds.length +
      filters.tagIds.length +
      (filters.source ? 1 : 0) +
      (filters.onlyHasPackage ? 1 : 0) +
      (filters.needsFollowUp ? 1 : 0) +
      (filters.lastVisitBucket !== 'all' ? 1 : 0) +
      (filters.minSpend ? 1 : 0) +
      (filters.lineStatus !== 'all' ? 1 : 0);
    document.getElementById('filter-count').textContent = count ? `(${count})` : '';
  }
  updateFilterCount();

  function renderList() {
    const listEl = document.getElementById('list-scroll');
    if (!listEl) return;

    const filtered = allClients.filter((c) => matchesSearch(c, search) && matchesFilters(c, filters));
    const showBanner = !search && isEmptyFilters(filters);

    if (!filtered.length) {
      listEl.innerHTML =
        (showBanner ? birthdayBannerHtml(birthdayClients) : '') +
        `<div class="empty-state">
          <div class="empty-icon">◐</div>
          <div class="empty-title">${allClients.length ? '找不到符合的客戶' : '還沒有任何客戶資料'}</div>
          <div class="empty-body">${allClients.length ? '試試看其他關鍵字或調整篩選條件' : '點右上角「＋」建立第一張客戶卡'}</div>
        </div>`;
      return;
    }

    const cardsHtml = filtered
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
              <div class="card-sub">${escapeHtml(c.phone || '未留電話')}${c.lastVisitDate ? ` ・ 最近到店 ${c.lastVisitDate}` : ''}</div>
              <div style="margin-top:4px;">
                ${
                  c.line_user_id
                    ? `<span class="tag" style="background:#E7EFE4;color:#4E8B5C;">LINE ✓</span>`
                    : `<span class="tag" style="background:#F0EADA;color:#9B8F7F;">尚未綁定 LINE</span>`
                }
              </div>
            </div>
          </button>
        `;
      })
      .join('');

    listEl.innerHTML = (showBanner ? birthdayBannerHtml(birthdayClients) : '') + cardsHtml;

    listEl.querySelectorAll('.card').forEach((card) => {
      card.onclick = () => app.navigate('clientDetail', { clientId: card.dataset.id });
    });
  }

  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      search = searchInput.value.trim();
      renderList();
    }, 200);
  });

  document.getElementById('filter-btn').onclick = () => {
    openFilterModal(filters, allTags, (newFilters) => {
      filters = newFilters;
      updateFilterCount();
      renderList();
    });
  };

  renderList();
}

function isEmptyFilters(f) {
  return (
    f.serviceIds.length === 0 &&
    f.tagIds.length === 0 &&
    !f.source &&
    !f.onlyHasPackage &&
    !f.needsFollowUp &&
    f.lastVisitBucket === 'all' &&
    !f.minSpend &&
    f.lineStatus === 'all'
  );
}

function matchesSearch(c, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  if (c.name?.toLowerCase().includes(q)) return true;
  if (c.phone?.includes(q)) return true;
  if (c.line_id?.toLowerCase().includes(q)) return true;
  if (c.tags.some((t) => t.name.toLowerCase().includes(q))) return true;
  if (c.noteBodies.some((b) => b.toLowerCase().includes(q))) return true;
  return false;
}

function matchesFilters(c, f) {
  if (f.serviceIds.length && !f.serviceIds.some((id) => c.serviceIds.includes(id))) return false;
  if (f.tagIds.length && !f.tagIds.some((id) => c.tags.some((t) => t.id === id))) return false;
  if (f.source && c.source !== f.source) return false;
  if (f.onlyHasPackage && !c.hasPackage) return false;
  if (f.needsFollowUp && !c.needsFollowUp) return false;
  if (f.lastVisitBucket !== 'all') {
    const threshold = Number(f.lastVisitBucket);
    if (c.daysSinceLastVisit == null || c.daysSinceLastVisit < threshold) return false;
  }
  if (f.minSpend && c.totalSpend < Number(f.minSpend)) return false;
  if (f.lineStatus === 'bound' && !c.line_user_id) return false;
  if (f.lineStatus === 'unbound' && c.line_user_id) return false;
  return true;
}

function openFilterModal(currentFilters, allTags, onApply) {
  const f = { ...currentFilters, serviceIds: [...currentFilters.serviceIds], tagIds: [...currentFilters.tagIds] };
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-height:85vh;overflow-y:auto;">
      <div class="modal-title">篩選客戶</div>

      <div class="field-label">LINE 綁定狀態</div>
      <div class="service-grid" style="margin-bottom:14px;">
        ${[
          { v: 'all', l: '全部客戶' },
          { v: 'bound', l: 'LINE 已綁定' },
          { v: 'unbound', l: 'LINE 尚未綁定' },
        ]
          .map((o) => `<button type="button" class="service-chip fm-line-status${f.lineStatus === o.v ? ' on' : ''}" data-v="${o.v}">${o.l}</button>`)
          .join('')}
      </div>

      <div class="field-label">最後消費時間(沉睡客戶)</div>
      <div class="service-grid" style="margin-bottom:14px;">
        ${[
          { v: 'all', l: '全部' },
          { v: '30', l: '30 天以上未回訪' },
          { v: '60', l: '60 天以上' },
          { v: '90', l: '90 天以上' },
          { v: '180', l: '180 天以上' },
        ]
          .map((o) => `<button type="button" class="service-chip fm-bucket${f.lastVisitBucket === o.v ? ' on' : ''}" data-v="${o.v}">${o.l}</button>`)
          .join('')}
      </div>

      <div class="field-label">服務項目</div>
      <div class="service-grid" style="margin-bottom:14px;">
        ${SERVICES.map((s) => `<button type="button" class="service-chip fm-service${f.serviceIds.includes(s.id) ? ' on' : ''}" data-v="${s.id}">${escapeHtml(s.name)}</button>`).join('')}
      </div>

      <div class="field-label">標籤</div>
      <div class="service-grid" style="margin-bottom:14px;">
        ${
          allTags.length
            ? allTags.map((t) => `<button type="button" class="service-chip fm-tag${f.tagIds.includes(t.id) ? ' on' : ''}" data-v="${t.id}">${escapeHtml(t.name)}</button>`).join('')
            : `<div class="field-hint">還沒有標籤</div>`
        }
      </div>

      <div class="field">
        <div class="field-label">客戶來源</div>
        <select id="fm-source">
          <option value="">全部</option>
          ${SOURCES.map((s) => `<option value="${s.id}" ${f.source === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <div class="field-label">最低累積消費(選填)</div>
        <input type="number" id="fm-min-spend" min="0" step="1" value="${f.minSpend || ''}" placeholder="例如 5000" />
      </div>

      <label style="display:flex;align-items:center;gap:8px;margin:6px 0;">
        <input type="checkbox" id="fm-has-package" ${f.onlyHasPackage ? 'checked' : ''} />
        <span>只顯示有進行中療程的客戶</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;margin:6px 0 14px;">
        <input type="checkbox" id="fm-needs-followup" ${f.needsFollowUp ? 'checked' : ''} />
        <span>只顯示有待發送 LINE 追蹤的客戶</span>
      </label>

      <button class="primary-btn" id="fm-apply">套用篩選</button>
      <button class="secondary-btn" id="fm-clear">清除篩選</button>
      <button class="secondary-btn" id="fm-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.fm-line-status').forEach((btn) => {
    btn.onclick = () => {
      f.lineStatus = btn.dataset.v;
      overlay.querySelectorAll('.fm-line-status').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
    };
  });
  overlay.querySelectorAll('.fm-bucket').forEach((btn) => {
    btn.onclick = () => {
      f.lastVisitBucket = btn.dataset.v;
      overlay.querySelectorAll('.fm-bucket').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
    };
  });
  overlay.querySelectorAll('.fm-service').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.v;
      if (f.serviceIds.includes(id)) {
        f.serviceIds = f.serviceIds.filter((x) => x !== id);
        btn.classList.remove('on');
      } else {
        f.serviceIds.push(id);
        btn.classList.add('on');
      }
    };
  });
  overlay.querySelectorAll('.fm-tag').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.v;
      if (f.tagIds.includes(id)) {
        f.tagIds = f.tagIds.filter((x) => x !== id);
        btn.classList.remove('on');
      } else {
        f.tagIds.push(id);
        btn.classList.add('on');
      }
    };
  });

  document.getElementById('fm-cancel').onclick = () => overlay.remove();
  document.getElementById('fm-clear').onclick = () => {
    overlay.remove();
    onApply({ ...EMPTY_FILTERS });
  };
  document.getElementById('fm-apply').onclick = () => {
    f.source = document.getElementById('fm-source').value;
    f.minSpend = document.getElementById('fm-min-spend').value;
    f.onlyHasPackage = document.getElementById('fm-has-package').checked;
    f.needsFollowUp = document.getElementById('fm-needs-followup').checked;
    overlay.remove();
    onApply(f);
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
