const SETTINGS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

export function tabBarHtml(activeTab) {
  return `
    <div class="tab-bar">
      <button class="tab-item${activeTab === 'clients' ? ' active' : ''}" id="tabClients"><span class="tab-icon">◐</span>客戶資料卡</button>
      <button class="tab-item${activeTab === 'revenue' ? ' active' : ''}" id="tabRevenue"><span class="tab-icon">¥</span>營收總覽</button>
      <button class="tab-item${activeTab === 'settings' ? ' active' : ''}" id="tabSettings"><span class="tab-icon">${SETTINGS_ICON}</span>設定</button>
    </div>
  `;
}

export function bindTabBar(app) {
  document.getElementById('tabClients').onclick = () => {
    app.tab = 'clients';
    app.navigate('clientList');
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
