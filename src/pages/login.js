import { signIn } from '../lib/auth.js';
import { ensureSalon } from '../lib/auth.js';
import { passwordFieldHtml, bindPasswordToggle } from '../lib/passwordToggle.js';

export function renderLogin(app) {
  app.root.innerHTML = `
    <main class="auth-page">
      <form id="login-form" class="auth-card">
        <h1>美容客戶管理系統</h1>
        <p class="auth-subtitle">請輸入帳號密碼登入</p>

        <div class="field">
          <label class="field-label" for="email">Email</label>
          <input id="email" type="email" autocomplete="username" required />
        </div>
        <div class="field">
          ${passwordFieldHtml('password', '密碼', 'current-password')}
        </div>

        <button type="submit" id="login-btn" class="primary-btn">登入</button>
        <button type="button" id="go-register" class="secondary-btn">還沒有帳號?建立新帳號</button>
        <p id="login-error" class="error-text" hidden></p>
      </form>
    </main>
  `;

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  document.getElementById('go-register').onclick = () => app.navigate('register');
  bindPasswordToggle('password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = '登入中...';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { data, error } = await signIn(email, password);
    if (error) {
      errorEl.textContent = error.message === 'Invalid login credentials' ? '帳號或密碼錯誤' : error.message;
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = '登入';
      return;
    }

    app.session = data.session;
    try {
      app.salon = await ensureSalon(data.user.id);
    } catch (err) {
      console.error(err);
    }
    app.navigate('clientList');
  });
}
