import { signIn, requestPasswordReset } from '../lib/auth.js';
import { ensureSalon } from '../lib/auth.js';
import { passwordFieldHtml, bindPasswordToggle } from '../lib/passwordToggle.js';

export function renderLogin(app) {
  app.root.innerHTML = `
    <main class="auth-page">
      <form id="login-form" class="auth-card">
        <h1>客戶管理系統</h1>
        <p class="auth-subtitle">請輸入帳號密碼登入</p>

        <div class="field">
          <label class="field-label" for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="username" required />
        </div>
        <div class="field">
          ${passwordFieldHtml('password', '密碼', 'current-password')}
          <div style="text-align:right;margin-top:6px;">
            <button type="button" id="forgot-password-btn" class="link-btn">忘記密碼?</button>
          </div>
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
  document.getElementById('forgot-password-btn').onclick = () => openForgotPasswordModal();
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
    app.navigate('dashboard');
  });
}

function openForgotPasswordModal() {
  const prefillEmail = document.getElementById('email')?.value.trim() || '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">忘記密碼</div>
      <div class="field">
        <div class="field-label">請輸入你的 Email,我們會寄送重設密碼的連結</div>
        <input type="email" id="forgot-email" value="${prefillEmail}" placeholder="you@example.com" />
      </div>
      <p id="forgot-msg" class="field-hint" hidden></p>
      <button class="primary-btn" id="forgot-confirm">寄送重設密碼信</button>
      <button class="secondary-btn" id="forgot-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('forgot-cancel').onclick = () => overlay.remove();

  const confirmBtn = document.getElementById('forgot-confirm');
  const msgEl = document.getElementById('forgot-msg');
  confirmBtn.onclick = async () => {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) {
      alert('請輸入 Email');
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = '寄送中...';
    const { error } = await requestPasswordReset(email);
    if (error) {
      msgEl.textContent = '寄送失敗:' + error.message;
      msgEl.hidden = false;
      confirmBtn.disabled = false;
      confirmBtn.textContent = '寄送重設密碼信';
      return;
    }
    msgEl.textContent = '已寄出重設密碼信,請去信箱收信並點裡面的連結。';
    msgEl.hidden = false;
    confirmBtn.hidden = true;
  };
}
