import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getBotInfo } from '../_lib/lineClient.js';

// 設定頁「測試 LINE 綁定」用:實際呼叫 LINE Messaging API 驗證目前的 Channel Access Token
// 是否有效,並回傳目前綁定的官方帳號身分(displayName/basicId),不是只檢查環境變數有沒有設定。
// 驗證方式比照 send-message.js:檢查前端帶來的登入者 Supabase token。
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

  try {
    const info = await getBotInfo();
    res.status(200).json({
      ok: true,
      displayName: info.displayName,
      basicId: info.basicId,
      pictureUrl: info.pictureUrl || null,
    });
  } catch (err) {
    console.error('[LINE check-connection] 失敗', err);
    res.status(200).json({ ok: false, error: classifyLineError(err.message) });
  }
}

function classifyLineError(message) {
  if (!message) return 'API 連線失敗,請確認網路狀況或稍後再試';
  if (message.includes('缺少 LINE_CHANNEL_ACCESS_TOKEN')) return '尚未設定 Channel Access Token';
  if (message.includes('LINE API error 401')) return 'Channel Access Token 無效或已過期';
  if (message.includes('LINE API error 403')) return '權限不足,請確認 Channel Access Token 有 Messaging API 使用權限';
  if (message.includes('LINE API error')) return message;
  return 'API 連線失敗,請確認網路狀況或稍後再試';
}
