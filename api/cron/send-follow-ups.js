import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { pushMessage } from '../_lib/lineClient.js';

// 每天由 Vercel Cron 觸發(見 vercel.json 的 crons 設定)。
// 找出「今天(或更早)該發送、還沒發送」的追蹤,一筆一筆處理,互不影響。
export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: dueFollowUps, error } = await supabaseAdmin
    .from('follow_ups')
    .select('*, clients(line_user_id, name)')
    .eq('status', 'pending')
    .lte('scheduled_at', todayStr);

  if (error) {
    console.error('[cron send-follow-ups] 讀取 follow_ups 失敗', error);
    res.status(500).json({ error: error.message });
    return;
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const followUp of dueFollowUps || []) {
    const lineUserId = followUp.clients?.line_user_id;
    if (!lineUserId) {
      skipped++; // 這位客戶還沒綁定 LINE,先跳過,留在 pending,之後綁定了下次會再處理
      continue;
    }

    try {
      await pushMessage(lineUserId, followUp.message);
      await supabaseAdmin
        .from('follow_ups')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', followUp.id);
      sent++;
    } catch (err) {
      console.error(`[cron send-follow-ups] 發送失敗 follow_up=${followUp.id}`, err);
      await supabaseAdmin
        .from('follow_ups')
        .update({ status: 'failed', error_message: err.message })
        .eq('id', followUp.id);
      failed++;
    }
  }

  console.log(`[cron send-follow-ups] 完成:sent=${sent} failed=${failed} skipped=${skipped}`);
  res.status(200).json({ ok: true, sent, failed, skipped });
}
