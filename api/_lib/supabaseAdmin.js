import { createClient } from '@supabase/supabase-js';

// 只給後端(webhook、Cron)用的高權限連線,會繞過 RLS,絕對不能被前端引用。
// SUPABASE_URL 不是機密(跟前端用的 VITE_SUPABASE_URL 是同一個值),
// 但 SUPABASE_SECRET_KEY 是伺服器專用的高權限金鑰,只能設定成不带 VITE_ 前綴的環境變數。
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SECRET_KEY 環境變數(伺服器端專用)');
}

export const supabaseAdmin = createClient(url, secretKey, {
  auth: { persistSession: false },
});
