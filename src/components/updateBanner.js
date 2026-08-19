// 偵測到新版本時,在畫面最上方顯示一條提示,使用者自己按「立即更新」才套用新版本、重新整理,
// 不會在使用者沒注意的時候突然被強制重新整理。
export function showUpdateBanner(onUpdate) {
  if (document.getElementById('app-update-banner')) return; // 已經顯示過,不要重複疊加

  const banner = document.createElement('div');
  banner.id = 'app-update-banner';
  banner.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:3000;background:#3A332B;color:#fff;padding:10px 14px;' +
    'display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
  banner.innerHTML = `
    <span>系統已有新版本</span>
    <button type="button" id="app-update-btn" style="background:#fff;color:#3A332B;border:none;border-radius:8px;padding:6px 14px;font-weight:600;cursor:pointer;">立即更新</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('app-update-btn').onclick = () => {
    const btn = document.getElementById('app-update-btn');
    btn.disabled = true;
    btn.textContent = '更新中...';
    onUpdate();
  };
}
