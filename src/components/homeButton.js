export function homeButtonHtml() {
  return `<button type="button" class="icon-btn" id="home-btn" title="回首頁" aria-label="回首頁">🏠</button>`;
}

export function bindHomeButton(app) {
  const btn = document.getElementById('home-btn');
  if (btn) btn.onclick = () => app.navigate('dashboard');
}
