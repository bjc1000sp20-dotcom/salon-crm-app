import { signUp } from '../lib/auth.js';
import { ensureSalon } from '../lib/auth.js';
import { passwordFieldHtml, bindPasswordToggle } from '../lib/passwordToggle.js';

export function renderRegister(app) {
  app.root.innerHTML = `
    <main class="auth-page">
      <form id="register-form" class="auth-card">
        <h1>建立新帳號</h1>
        <p class="auth-subtitle">建立帳號後,你的客戶資料只有自己看得到</p>

        <div class="field">
          <label class="field-label" for="salon-name">工作室名稱(選填)</label>
          <input id="salon-name" type="text" placeholder="例如:涵美容工作室" />
        </div>
        <div class="field">
          <label class="field-label" for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="username" required />
        </div>
        <div class="field">
          ${passwordFieldHtml('password', '密碼', 'new-password', 'minlength="6"')}
          <p class="field-hint">至少 6 個字元</p>
        </div>

        <button type="submit" id="register-btn" class="primary-btn">建立帳號</button>
        <button type="button" id="go-login" class="secondary-btn">已經有帳號?回登入頁</button>
        <p id="register-error" class="error-text" hidden></p>
        <p id="register-success" class="field-hint" hidden></p>
      </form>
    </main>
  `;

  const form = document.getElementById('register-form');
  const errorEl = document.getElementById('register-error');
  const successEl = document.getElementById('register-success');
  const btn = document.getElementById('register-btn');

  document.getElementById('go-login').onclick = () => app.navigate('login');
  bindPasswordToggle('password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;
    btn.disabled = true;
    btn.textContent = '建立中...';

    const salonName = document.getElementById('salon-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { data, error } = await signUp(email, password);
    if (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = '建立帳號';
      return;
    }

    // 有些 Supabase 專案預設要求 email 驗證,這種情況下 session 會是 null
    if (!data.session) {
      successEl.textContent = '帳號已建立,請至信箱收信完成驗證後再回來登入。';
      successEl.hidden = false;
      btn.disabled = false;
      btn.textContent = '建立帳號';
      return;
    }

    app.session = data.session;
    try {
      app.salon = await ensureSalon(data.user.id);
      if (salonName) {
        const { supabase } = await import('../supabaseClient.js');
        await supabase.from('salons').update({ salon_name: salonName }).eq('id', app.salon.id);
        app.salon.salon_name = salonName;
      }
    } catch (err) {
      console.error(err);
    }
    app.navigate('dashboard');
  });
}
