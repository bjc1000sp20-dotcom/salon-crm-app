import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getProfile } from '../_lib/lineClient.js';

// 給後台「重新同步 LINE 聯絡人」按鈕用,店主本人在操作,不是機器排程,
// 所以驗證方式改成檢查前端帶來的 Supabase 登入 token,確認是合法登入的使用者才能執行,
// 不用共用密鑰(共用密鑰比較適合 Cron 這種沒有「使用者」概念的機器對機器呼叫)。
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData?.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { data: contacts, error: listErr } = await supabaseAdmin.from('line_contacts').select('id, line_user_id');
  if (listErr) {
    res.status(500).json({ error: listErr.message });
    return;
  }

  let synced = 0;
  let failed = 0;
  for (const contact of contacts || []) {
    try {
      const profile = await getProfile(contact.line_user_id);
      await supabaseAdmin
        .from('line_contacts')
        .update({
          display_name: profile.displayName || null,
          picture_url: profile.pictureUrl || null,
          status_message: profile.statusMessage || null,
        })
        .eq('id', contact.id);
      synced++;
    } catch (err) {
      failed++; // 常見原因:對方已封鎖官方帳號,查不到個人資料,屬正常情況
    }
  }

  res.status(200).json({ ok: true, synced, failed, total: (contacts || []).length });
}
