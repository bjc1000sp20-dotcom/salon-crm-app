import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { pushMessage } from '../_lib/lineClient.js';
import { renderBirthdayMessage } from '../_lib/renderBirthdayMessage.js';

// 每天由 Vercel Cron 觸發(見 vercel.json 的 crons 設定)。
// 找出「今天(或更早)該發送、還沒發送」的追蹤,一筆一筆處理,互不影響。
export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await seedBirthdayFollowUps();

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

// 台灣是 UTC+8,沒有夏令時間,直接固定加 8 小時換算,不用依賴系統時區設定
function taipeiNow() {
  const utc = new Date();
  return new Date(utc.getTime() + 8 * 60 * 60 * 1000);
}

// 每月 1~3 號(給 Cron 抓不準留緩衝)自動幫「本月生日、已開啟提醒、已綁 LINE」的客戶
// 建立今年的生日 follow_up。超過 3 號才符合資格的客戶(例如月中才補設定)刻意不處理,
// 交給客戶頁「立即發送／不補發」讓店主自己決定,不會在不知情的狀況下被自動補發。
async function seedBirthdayFollowUps() {
  const now = taipeiNow();
  const day = now.getUTCDate();
  if (day > 3) return;

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const { data: clients, error: clientsErr } = await supabaseAdmin
    .from('clients')
    .select('id, salon_id, name, birth_date, line_user_id, salons(birthday_message_template, birthday_offer_text)')
    .eq('birthday_reminder_enabled', true)
    .not('line_user_id', 'is', null)
    .not('birth_date', 'is', null);
  if (clientsErr) {
    console.error('[cron send-follow-ups] 讀取生日客戶失敗', clientsErr);
    return;
  }

  const eligible = (clients || []).filter((c) => Number(c.birth_date.slice(5, 7)) === month);
  if (!eligible.length) return;

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('follow_ups')
    .select('client_id')
    .eq('kind', 'birthday')
    .eq('birthday_year', year)
    .in('client_id', eligible.map((c) => c.id));
  if (existingErr) {
    console.error('[cron send-follow-ups] 讀取既有生日紀錄失敗', existingErr);
    return;
  }
  const alreadyHas = new Set((existing || []).map((r) => r.client_id));

  for (const c of eligible) {
    if (alreadyHas.has(c.id)) continue;
    const template = c.salons?.birthday_message_template;
    if (!template) continue; // 這家店還沒設定生日話術,先跳過,不亂發預設訊息

    const message = renderBirthdayMessage(template, {
      clientName: c.name,
      birthdayMonth: month,
      birthdayDate: Number(c.birth_date.slice(8, 10)),
      offerText: c.salons?.birthday_offer_text,
    });

    const { error: insertErr } = await supabaseAdmin.from('follow_ups').insert({
      salon_id: c.salon_id,
      client_id: c.id,
      kind: 'birthday',
      birthday_year: year,
      label: `${year}生日訊息`,
      message,
      scheduled_at: todayStr,
      status: 'pending',
    });
    if (insertErr) {
      console.error(`[cron send-follow-ups] 建立生日 follow_up 失敗 client=${c.id}`, insertErr);
    }
  }
}
