import { getRawBody } from '../_lib/rawBody.js';
import { verifyLineSignature } from '../_lib/verifySignature.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Phase 2:安全接收 + 驗證簽章。
// Phase 3:再加上把「傳過訊息的人」存進 line_contacts,等店家在 CRM 後台配對到客戶。
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
    const userId = event.source?.userId;
    console.log(`[LINE webhook] type=${event.type} userId=${userId || '(無 userId)'}`);

    if (!userId) continue; // 群組/聊天室事件等沒有個人 userId 的情況,先略過

    if (event.type === 'follow') {
      console.log('[LINE webhook] 使用者加了官方帳號好友');
      await upsertContact(userId, '(加入好友)');
    } else if (event.type === 'unfollow') {
      console.log('[LINE webhook] 使用者封鎖/取消追蹤官方帳號');
      // Phase 3 先不自動解除綁定,避免使用者之後重新加回來又要重新配對一次
    } else if (event.type === 'message' && event.message?.type === 'text') {
      console.log(`[LINE webhook] message text="${event.message.text}"`);
      await upsertContact(userId, event.message.text);
    }
  }

  // LINE 要求盡快回 200,避免逾時重送
  res.status(200).send('OK');
}

async function upsertContact(lineUserId, lastMessageText) {
  const { error } = await supabaseAdmin
    .from('line_contacts')
    .upsert(
      {
        line_user_id: lineUserId,
        last_message_text: lastMessageText,
        last_event_at: new Date().toISOString(),
      },
      { onConflict: 'line_user_id' }
    );
  if (error) {
    console.error('[LINE webhook] 寫入 line_contacts 失敗', error);
  }
}
