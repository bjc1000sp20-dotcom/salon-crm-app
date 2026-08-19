const SETTINGS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
const HOME_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M3 9.5 12 3l9 6.5"></path><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"></path></svg>`;
const LINE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`;

export function tabBarHtml(activeTab) {
  return `
    <div class="tab-bar">
      <button class="tab-item${activeTab === 'dashboard' ? ' active' : ''}" id="tabDashboard"><span class="tab-icon">${HOME_ICON}</span>首頁</button>
      <button class="tab-item${activeTab === 'clients' ? ' active' : ''}" id="tabClients"><span class="tab-icon">◐</span>客戶資料卡</button>
      <button class="tab-item${activeTab === 'lineHub' ? ' active' : ''}" id="tabLineHub"><span class="tab-icon">${LINE_ICON}</span>LINE</button>
      <button class="tab-item${activeTab === 'revenue' ? ' active' : ''}" id="tabRevenue"><span class="tab-icon">¥</span>營收總覽</button>
      <button class="tab-item${activeTab === 'settings' ? ' active' : ''}" id="tabSettings"><span class="tab-icon">${SETTINGS_ICON}</span>設定</button>
    </div>
  `;
}

export function bindTabBar(app) {
  document.getElementById('tabDashboard').onclick = () => {
    app.tab = 'dashboard';
    app.navigate('dashboard');
  };
  document.getElementById('tabClients').onclick = () => {
    app.tab = 'clients';
    app.navigate('clientList');
  };
  document.getElementById('tabLineHub').onclick = () => {
    app.tab = 'lineHub';
    app.navigate('lineHub');
  };
  document.getElementById('tabRevenue').onclick = () => {
    app.tab = 'revenue';
    app.navigate('revenue');
  };
  document.getElementById('tabSettings').onclick = () => {
    app.tab = 'settings';
    app.navigate('settings');
  };
}
