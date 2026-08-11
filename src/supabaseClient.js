import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY,請檢查 .env 設定');
}

export const supabase = createClient(url, anonKey);
