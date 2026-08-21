import { supabase } from '../supabaseClient.js';

export function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOutUser() {
  return supabase.auth.signOut();
}

// 寄送重設密碼信,信裡的連結點開會導回這個網站並觸發 PASSWORD_RECOVERY 事件(見 main.js)
export function requestPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
}

export function updatePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword });
}

// 已登入狀態下自行修改密碼:先用「目前密碼」重新驗證身分,驗證通過才真的換新密碼,
// 避免裝置沒鎖、有人趁機打開 CRM 就能直接改密碼把原本使用者鎖在外面
export async function changePassword(email, currentPassword, newPassword) {
  const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyErr) {
    return { error: { message: '目前密碼不正確' } };
  }
  return updatePassword(newPassword);
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// 未登入會導回 login.html,回傳目前的 session
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.replace('/login.html');
    return null;
  }
  return session;
}

// 確保這個登入者有對應的 salons 列,沒有就自動建一個(第一次登入時)
export async function ensureSalon(userId) {
  const { data: existing, error: selectErr } = await supabase
    .from('salons')
    .select('*')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (selectErr) throw selectErr;
  if (existing) return existing;

  const { data: created, error: insertErr } = await supabase
    .from('salons')
    .insert({ owner_user_id: userId })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return created;
}
