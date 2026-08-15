import { getRawBody } from '../_lib/rawBody.js';
import { verifyLineSignature } from '../_lib/verifySignature.js';

// Phase 2:只負責「安全接收 + 驗證 + 記錄」,不寫入任何 CRM 資料、不自動回覆。
// 客戶綁定(依綁定碼寫入 clients.line_user_id)留到 Phase 3 再加在這個檔案裡。
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'];
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    console.error('[LINE webhook] signature 驗證失敗');
    res.status(401).send('Invalid signature');
    return;
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    res.status(400).send('Invalid JSON');
    return;
  }

  const events = body.events || [];
  for (const event of events) {
    const userId = event.source?.userId || '(無 userId)';
    console.log(`[LINE webhook] type=${event.type} userId=${userId}`);

    if (event.type === 'message' && event.message?.type === 'text') {
      console.log(`[LINE webhook] message text="${event.message.text}"`);
    } else if (event.type === 'follow') {
      console.log('[LINE webhook] 使用者加了官方帳號好友');
    } else if (event.type === 'unfollow') {
      console.log('[LINE webhook] 使用者封鎖/取消追蹤官方帳號');
    }
  }

  // LINE 要求盡快回 200,避免逾時重送
  res.status(200).send('OK');
}
