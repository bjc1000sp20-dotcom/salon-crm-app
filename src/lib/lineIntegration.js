import { supabase } from '../supabaseClient.js';

const DEFAULT_TEMPLATES = [
  { days_after: 3, label: '3 天後・修復追蹤', message: '嗨～想關心一下這幾天的修復狀況還好嗎?如果有任何狀況,也可以直接傳照片給我看看 😊', sort_order: 1 },
  { days_after: 7, label: '7 天後・膚況追蹤', message: '嗨～這幾天膚況還好嗎?如果方便的話,可以傳張目前的照片給我,我幫妳看看修復狀況 😊', sort_order: 2 },
  { days_after: 30, label: '30 天後・回訪提醒', message: '嗨～距離上次保養一段時間了,最近皮膚狀況還穩定嗎?如果想安排下一次保養,也可以直接回覆我 😊', sort_order: 3 },
];

// ---------------- LINE 聯絡人配對 ----------------

export async function listUnmatchedLineContacts() {
  const { data, error } = await supabase
    .from('line_contacts')
    .select('*')
    .is('matched_client_id', null)
    .order('last_event_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function matchLineContact(contactId, lineUserId, clientId, salonId) {
  const { error: clientErr } = await supabase
    .from('clients')
    .update({ line_user_id: lineUserId, line_linked_at: new Date().toISOString() })
    .eq('id', clientId);
  if (clientErr) throw clientErr;

  const { error: contactErr } = await supabase
    .from('line_contacts')
    .update({ matched_client_id: clientId, matched_salon_id: salonId })
    .eq('id', contactId);
  if (contactErr) throw contactErr;
}

export async function unlinkClientLine(clientId) {
  const { error } = await supabase
    .from('clients')
    .update({ line_user_id: null, line_linked_at: null })
    .eq('id', clientId);
  if (error) throw error;
}

// ---------------- 追蹤訊息模板 ----------------

export async function listFollowUpTemplates(salonId) {
  const { data, error } = await supabase
    .from('follow_up_templates')
    .select('*')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

// 第一次使用時,幫這家店建立預設的 3 個模板(3/7/30 天),之後都可以自己編輯
export async function ensureDefaultFollowUpTemplates(salonId) {
  const existing = await listFollowUpTemplates(salonId);
  if (existing.length > 0) return existing;

  const rows = DEFAULT_TEMPLATES.map((t) => ({ ...t, salon_id: salonId }));
  const { data, error } = await supabase.from('follow_up_templates').insert(rows).select();
  if (error) throw error;
  return data;
}

export async function updateFollowUpTemplate(id, fields) {
  const { error } = await supabase.from('follow_up_templates').update(fields).eq('id', id);
  if (error) throw error;
}

// ---------------- 追蹤排程(follow_ups) ----------------

export async function listFollowUpsForClient(clientId) {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createFollowUp(salonId, clientId, userId, fields) {
  const { error } = await supabase.from('follow_ups').insert({
    salon_id: salonId,
    client_id: clientId,
    created_by: userId,
    ...fields,
  });
  if (error) throw error;
}

export async function updateFollowUp(id, fields) {
  const { error } = await supabase.from('follow_ups').update(fields).eq('id', id);
  if (error) throw error;
}

export async function cancelFollowUp(id) {
  const { error } = await supabase.from('follow_ups').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}

export function addDaysToToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}
