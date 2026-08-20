import { listLeadsWithLatestFollowUp } from '../lib/leads.js';
import { openLeadDetailModal } from '../components/leadDetailModal.js';
import { openLeadFollowUpModal } from '../components/leadFollowUpModal.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';

const CHANNEL_LABEL = { instagram: 'Instagram', line: 'LINE', facebook: 'Facebook', threads: 'Threads', phone: '電話', other: '其他' };
const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'today', label: '今天待追蹤' },
  { id: 'overdue', label: '逾期未追蹤' },
  { id: 'future', label: '未來待追蹤' },
  { id: 'done', label: '已完成' },
  { id: 'converted', label: '已成交' },
  { id: 'not_tracking', label: '不再追蹤' },
];

export async function renderLeadTracking(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">追蹤客戶</div>
        ${homeButtonHtml()}
      </div>
      <div class="search-wrap" style="display:flex;gap:8px;align-items:center;padding:14px 20px 0;">
        <div style="flex:1;display:flex;align-items:center;gap:6px;">
          <span>🔍</span>
          <input id="lt-search-input" type="text" placeholder="搜尋姓名/IG帳號/聯絡方式/備註" style="flex:1;" />
        </div>
      </div>
      <div class="service-grid" id="lt-filters" style="padding:10px 20px 0;">
        ${FILTERS.map((f) => `<button type="button" class="service-chip lt-filter-chip${f.id === 'all' ? ' on' : ''}" data-v="${f.id}">${f.label}</button>`).join('')}
      </div>
      <div class="list-scroll" id="lt-list" style="padding-top:14px;">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="lt-add-btn">＋ 提醒追蹤客戶</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('dashboard');
  bindHomeButton(app);

  let allLeads = [];
  let search = '';
  let filter = 'all';

  document.getElementById('lt-add-btn').onclick = () => openLeadFollowUpModal(app, () => loadLeads());

  const searchInput = document.getElementById('lt-search-input');
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      search = searchInput.value.trim().toLowerCase();
      renderList();
    }, 200);
  });

  document.querySelectorAll('.lt-filter-chip').forEach((chip) => {
    chip.onclick = () => {
      filter = chip.dataset.v;
      document.querySelectorAll('.lt-filter-chip').forEach((c) => c.classList.remove('on'));
      chip.classList.add('on');
      renderList();
    };
  });

  async function loadLeads() {
    const listEl = document.getElementById('lt-list');
    try {
      allLeads = await listLeadsWithLatestFollowUp(app.salon.id);
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-title">讀取失敗</div><div class="empty-body">${escapeHtml(err.message)}</div></div>`;
      return;
    }
    renderList();
  }

  function computeBucket(lead) {
    if (lead.state === 'converted') return 'converted';
    if (lead.state === 'not_tracking') return 'not_tracking';
    if (lead.pendingFollowUp) {
      const today = new Date().toISOString().slice(0, 10);
      if (lead.pendingFollowUp.remind_date < today) return 'overdue';
      if (lead.pendingFollowUp.remind_date === today) return 'today';
      return 'future';
    }
    return 'done';
  }

  function renderList() {
    const listEl = document.getElementById('lt-list');
    const filtered = allLeads.filter((lead) => {
      const bucket = computeBucket(lead);
      if (filter !== 'all' && bucket !== filter) return false;
      if (!search) return true;
      const haystack = [lead.name, lead.contact_handle, lead.notes].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search);
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-body">${allLeads.length ? '找不到符合的追蹤客戶' : '還沒有任何追蹤客戶'}</div></div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((lead) => {
        const bucket = computeBucket(lead);
        const info = lead.pendingFollowUp || lead.latestFollowUp;
        return `
        <div class="card lt-row" data-id="${lead.id}" style="cursor:pointer;flex-direction:column;align-items:stretch;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="card-name">${escapeHtml(lead.name || lead.contact_handle || '未命名')}</div>
            ${bucketTagHtml(bucket)}
          </div>
          <div class="card-sub">${CHANNEL_LABEL[lead.channel] || lead.channel}${lead.contact_handle ? ` ・ ${escapeHtml(lead.contact_handle)}` : ''}${lead.lead_statuses?.name ? ` ・ ${escapeHtml(lead.lead_statuses.name)}` : ''}</div>
          ${info ? `<div class="visit-note" style="margin-top:6px;">${escapeHtml(info.content)}</div>` : ''}
        </div>
      `;
      })
      .join('');

    listEl.querySelectorAll('.lt-row').forEach((row) => {
      row.onclick = () => openLeadDetailModal(app, row.dataset.id, () => loadLeads());
    });
  }

  await loadLeads();
}

function bucketTagHtml(bucket) {
  const map = {
    today: { text: '今天待追蹤', bg: '#F5E3DC', color: '#B5533C' },
    overdue: { text: '已逾期', bg: '#F5E3DC', color: '#B5533C' },
    future: { text: '未來待追蹤', bg: '#F0EADA', color: '#9B8F7F' },
    done: { text: '已完成', bg: '#E7EFE4', color: '#4E8B5C' },
    converted: { text: '已成交', bg: '#EDE7F5', color: '#6B5C9B' },
    not_tracking: { text: '不再追蹤', bg: '#F0EADA', color: '#9B8F7F' },
  };
  const t = map[bucket];
  if (!t) return '';
  return `<span class="tag" style="background:${t.bg};color:${t.color};">${t.text}</span>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
