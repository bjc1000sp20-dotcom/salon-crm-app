import { supabase } from '../supabaseClient.js';

export const BIRTHDAY_VARS = [
  { token: '{{客戶姓名}}', desc: '客戶姓名' },
  { token: '{{生日月份}}', desc: '生日月份(數字)' },
  { token: '{{生日日期}}', desc: '生日當月的日期(數字)' },
  { token: '{{優惠內容}}', desc: '設定頁「優惠內容」欄位的文字' },
];

export function renderBirthdayVars(template, { clientName, birthdayMonth, birthdayDate, offerText }) {
  const map = {
    '{{客戶姓名}}': clientName || '',
    '{{生日月份}}': birthdayMonth != null ? String(birthdayMonth) : '',
    '{{生日日期}}': birthdayDate != null ? String(birthdayDate) : '',
    '{{優惠內容}}': offerText || '',
  };
  let result = template || '';
  for (const [token, value] of Object.entries(map)) {
    result = result.replaceAll(token, value);
  }
  return result;
}

async function sendLineMessageNow(to, message) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('請重新登入後再試');

  const res = await fetch('/api/line/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, message }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || '發送失敗');
}

// 這個月生日的所有客戶(不限有沒有開提醒/綁 LINE),外加今年的生日 follow_up 狀態,給首頁/名單頁用
export async function listThisMonthBirthdayClients(salonId) {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name, birth_date, line_user_id, birthday_reminder_enabled')
    .eq('salon_id', salonId)
    .not('birth_date', 'is', null);
  if (clientsErr) throw clientsErr;

  const eligible = (clients || []).filter((c) => Number(c.birth_date.slice(5, 7)) === month);
  if (!eligible.length) return [];

  const { data: followUps, error: fuErr } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('kind', 'birthday')
    .eq('birthday_year', year)
    .in('client_id', eligible.map((c) => c.id));
  if (fuErr) throw fuErr;

  const byClient = Object.fromEntries((followUps || []).map((f) => [f.client_id, f]));

  return eligible.map((c) => ({ ...c, birthdayFollowUp: byClient[c.id] || null }));
}

export async function getBirthdayFollowUpForClient(clientId, year = new Date().getFullYear()) {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('client_id', clientId)
    .eq('kind', 'birthday')
    .eq('birthday_year', year)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// 補發(客戶頁「立即發送」)或重新發送(失敗那筆)共用:立即呼叫 LINE,成功/失敗都寫回 follow_ups
export async function sendBirthdayNow(app, client, followUp) {
  let row = followUp;
  const salon = app.salon;
  const year = new Date().getFullYear();

  if (!row) {
    const message = renderBirthdayVars(salon.birthday_message_template || '', {
      clientName: client.name,
      birthdayMonth: Number(client.birth_date.slice(5, 7)),
      birthdayDate: Number(client.birth_date.slice(8, 10)),
      offerText: salon.birthday_offer_text,
    });
    const { data, error } = await supabase
      .from('follow_ups')
      .insert({
        salon_id: salon.id,
        client_id: client.id,
        kind: 'birthday',
        birthday_year: year,
        label: `${year}生日訊息`,
        message,
        scheduled_at: new Date().toISOString().slice(0, 10),
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    row = data;
  }

  try {
    await sendLineMessageNow(client.line_user_id, row.message);
    await supabase
      .from('follow_ups')
      .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
      .eq('id', row.id);
  } catch (err) {
    await supabase.from('follow_ups').update({ status: 'failed', error_message: err.message }).eq('id', row.id);
    throw err;
  }
}

// 「不補發,今年略過」:建立一筆 skipped 的紀錄,擋掉之後的補發提示,不會真的發送
export async function skipBirthdayThisYear(salonId, client) {
  const year = new Date().getFullYear();
  const { error } = await supabase.from('follow_ups').insert({
    salon_id: salonId,
    client_id: client.id,
    kind: 'birthday',
    birthday_year: year,
    label: `${year}生日訊息`,
    message: '(今年已選擇不發送)',
    scheduled_at: new Date().toISOString().slice(0, 10),
    status: 'skipped',
  });
  if (error) throw error;
}

export async function sendTestBirthdayMessage(clientLineUserId, message) {
  await sendLineMessageNow(clientLineUserId, message);
}
