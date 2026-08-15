import { pushMessage } from '../_lib/lineClient.js';

// 純測試用端點,確認後端真的能成功呼叫 LINE Messaging API 的 Push Message。
// 用 INTERNAL_API_SECRET 這把共用密鑰保護,避免任何人都能打這支 API 亂發訊息、浪費你的 LINE 額度。
// 之後 Cron、後台「傳送測試訊息」按鈕等內部用途的 API,都可以沿用同一把密鑰保護。
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
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
    console.error('[LINE test-push] 失敗', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
