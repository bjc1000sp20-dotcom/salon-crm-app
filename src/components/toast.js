// 短暫的成功提示條,自動消失,用來明確告知「這個動作真的成功寫進資料庫了」
export function showToast(message) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:4000;background:#3A6B4E;color:#fff;' +
    'padding:10px 20px;border-radius:10px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
