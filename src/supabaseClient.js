import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY,請檢查 .env 設定');
}

// 「記住我」只是切換 Supabase session token 要存在哪裡,密碼本身從來不會被存起來。
// 勾選:存 localStorage,關掉瀏覽器/App 重開還在。不勾:存 sessionStorage,只在這個分頁活著,關掉就清空。
// 預設值刻意判斷成「已記住」(不是「沒設定=不記住」),避免上線後把既有已登入使用者的 session 憑空清掉。
const REMEMBER_KEY = 'salon-crm-remember-me';

function shouldRemember() {
  return localStorage.getItem(REMEMBER_KEY) !== 'false';
}

const authStorage = {
  getItem: (key) => (shouldRemember() ? localStorage : sessionStorage).getItem(key),
  setItem: (key, value) => (shouldRemember() ? localStorage : sessionStorage).setItem(key, value),
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export function setRememberMe(remember) {
  localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
}

export const supabase = createClient(url, anonKey, {
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true },
});
