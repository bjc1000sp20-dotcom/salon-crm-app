const HOME_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M3 9.5 12 3l9 6.5"></path><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"></path></svg>`;

export function homeButtonHtml() {
  return `<button type="button" class="icon-btn" id="home-btn" title="回首頁" aria-label="回首頁">${HOME_ICON}</button>`;
}

export function bindHomeButton(app) {
  const btn = document.getElementById('home-btn');
  if (btn) btn.onclick = () => app.navigate('dashboard');
}
