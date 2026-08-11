export function tabBarHtml(activeTab) {
  return `
    <div class="tab-bar">
      <button class="tab-item${activeTab === 'clients' ? ' active' : ''}" id="tabClients"><span class="tab-icon">◐</span>客戶資料卡</button>
      <button class="tab-item${activeTab === 'revenue' ? ' active' : ''}" id="tabRevenue"><span class="tab-icon">¥</span>營收總覽</button>
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
}
