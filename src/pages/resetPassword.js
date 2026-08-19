import { updatePassword, ensureSalon } from '../lib/auth.js';
import { passwordFieldHtml, bindPasswordToggle } from '../lib/passwordToggle.js';

// 使用者點了重設密碼信裡的連結後,Supabase 會導回這個網站並觸發 PASSWORD_RECOVERY
// 事件(main.js 監聽到之後會導來這一頁),在這裡輸入新密碼即可。
export function renderResetPassword(app) {
  app.root.innerHTML = `
    <main class="auth-page">
      <form id="reset-form" class="auth-card">
        <h1>設定新密碼</h1>
        <p class="auth-subtitle">請輸入你要使用的新密碼</p>

        <div class="field">
          ${passwordFieldHtml('new-password', '新密碼', 'new-password', 'minlength="6"')}
          <p class="field-hint">至少 6 個字元</p>
        </div>

        <button type="submit" id="reset-btn" class="primary-btn">更新密碼</button>
        <p id="reset-error" class="error-text" hidden></p>
      </form>
    </main>
  `;

  bindPasswordToggle('new-password');

  const form = document.getElementById('reset-form');
  const errorEl = document.getElementById('reset-error');
  const btn = document.getElementById('reset-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = '更新中...';

    const password = document.getElementById('new-password').value;
    const { error } = await updatePassword(password);
    if (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = '更新密碼';
      return;
    }

    try {
      app.salon = await ensureSalon(app.session.user.id);
    } catch (err) {
      console.error(err);
    }
    app.navigate('dashboard');
  });
}
