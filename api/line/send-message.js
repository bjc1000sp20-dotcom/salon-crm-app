import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { pushMessage } from '../_lib/lineClient.js';

// 給後台「立即發送」「重新發送」「發送測試訊息」用的小端點。
// 店主本人在操作,不是機器排程,所以驗證方式跟「重新同步 LINE 聯絡人」一樣:
// 檢查前端帶來的登入者 Supabase token,不用共用密鑰。
// 這支端點只負責把訊息送到 LINE,資料庫的狀態更新(已發送/失敗)由前端呼叫完之後自己處理。
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

  const { to, message } = req.body || {};
  if (!to || !message) {
    res.status(400).json({ error: '需要提供 to(LINE userId)與 message' });
    return;
  }

  try {
    await pushMessage(to, message);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[LINE send-message] 失敗', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
