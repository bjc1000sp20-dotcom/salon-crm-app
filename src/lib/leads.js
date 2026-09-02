import { supabase } from '../supabaseClient.js';
import { createClient } from './data.js';
import { createNote } from './clientNotes.js';

// 貼的是完整網址就直接開,貼的是 @handle 就自動組成 instagram.com 網址;不是 IG 來源或看不出帳號就回傳 null
export function buildInstagramUrl(channel, handle) {
  if (channel !== 'instagram' || !handle) return null;
  const trimmed = handle.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const clean = trimmed.replace(/^@/, '');
  if (!clean) return null;
  return `https://instagram.com/${encodeURIComponent(clean)}`;
}

// 建立一筆潛在客戶追蹤,同時建立第一筆提醒(名稱/聯絡帳號都可以不填,不強迫先有正式客戶資料)
export async function createLead(salonId, userId, fields, firstFollowUp) {
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .insert({ salon_id: salonId, created_by: userId, ...fields })
    .select()
    .single();
  if (leadErr) throw leadErr;

  const { error: fuErr } = await supabase.from('lead_follow_ups').insert({
    lead_id: lead.id,
    salon_id: salonId,
    ...firstFollowUp,
  });
  if (fuErr) throw fuErr;

  return lead;
}

// 首頁「今天該聯絡誰」用:今天到期+已逾期、還沒處理的提醒
export async function listTodayAndOverdueLeadFollowUps(salonId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('lead_follow_ups')
    .select('*, leads!inner(id, name, channel, contact_handle, notes, state, status_id, lead_statuses(name))')
    .eq('salon_id', salonId)
    .eq('status', 'pending')
    .eq('leads.state', 'active')
    .lte('remind_date', todayStr)
    .order('remind_date', { ascending: true });
  if (error) throw error;
  return data;
}

// 首頁「今日已建立追蹤提醒」用:依 created_at 判斷今天,跟依 remind_date 判斷「今天該聯絡誰」是不同概念,
// 不特別過濾狀態——只是要確認「我今天有沒有成功新增」,不管這筆後來被完成/延後/取消都算今天有建立過。
export async function listTodayCreatedLeadFollowUps(salonId) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const { data, error } = await supabase
    .from('lead_follow_ups')
    .select('*, leads(id, name, channel, contact_handle, status_id, state, lead_statuses(name))')
    .eq('salon_id', salonId)
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', endOfDay.toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateLeadFollowUp(id, fields) {
  const { error } = await supabase.from('lead_follow_ups').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteLeadFollowUp(id) {
  const { error } = await supabase.from('lead_follow_ups').delete().eq('id', id);
  if (error) throw error;
}

export async function completeLeadFollowUp(id) {
  const { error } = await supabase
    .from('lead_follow_ups')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function snoozeLeadFollowUp(id, newDate) {
  const { error } = await supabase.from('lead_follow_ups').update({ remind_date: newDate, snoozed: true }).eq('id', id);
  if (error) throw error;
}

// 「再次追蹤」:把目前這筆標記完成,另外新增一筆新的提醒,歷史紀錄不會被覆蓋
export async function addNextFollowUp(leadId, salonId, { content, remind_date, remind_time }) {
  const { error: doneErr } = await supabase
    .from('lead_follow_ups')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('lead_id', leadId)
    .eq('status', 'pending');
  if (doneErr) throw doneErr;

  const { data, error } = await supabase
    .from('lead_follow_ups')
    .insert({ lead_id: leadId, salon_id: salonId, content, remind_date, remind_time: remind_time || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setLeadNotTracking(leadId) {
  const { error: leadErr } = await supabase.from('leads').update({ state: 'not_tracking' }).eq('id', leadId);
  if (leadErr) throw leadErr;
  const { error: fuErr } = await supabase
    .from('lead_follow_ups')
    .update({ status: 'cancelled' })
    .eq('lead_id', leadId)
    .eq('status', 'pending');
  if (fuErr) throw fuErr;
}

export async function updateLead(id, fields) {
  const { error } = await supabase.from('leads').update(fields).eq('id', id);
  if (error) throw error;
}

// 單筆 lead 的詳情+全部歷史追蹤紀錄,給查看視窗用
export async function getLeadWithFollowUps(leadId) {
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('*, lead_statuses(name)')
    .eq('id', leadId)
    .single();
  if (leadErr) throw leadErr;

  const { data: followUps, error: fuErr } = await supabase
    .from('lead_follow_ups')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (fuErr) throw fuErr;

  return { lead, followUps };
}

// 追蹤客戶搜尋頁用:全部 lead + 各自最新一筆提醒,前端依名稱/聯絡帳號/備註搜尋、依畫面狀態篩選
export async function listLeadsWithLatestFollowUp(salonId) {
  const [{ data: leads, error: leadsErr }, { data: followUps, error: fuErr }] = await Promise.all([
    supabase
      .from('leads')
      .select('*, lead_statuses(name)')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false }),
    supabase.from('lead_follow_ups').select('*').eq('salon_id', salonId).order('created_at', { ascending: false }),
  ]);
  if (leadsErr) throw leadsErr;
  if (fuErr) throw fuErr;

  return leads.map((lead) => {
    const leadFollowUps = followUps.filter((f) => f.lead_id === lead.id);
    const pending = leadFollowUps.find((f) => f.status === 'pending');
    const latest = leadFollowUps[0] || null;
    let displayState;
    if (lead.state === 'converted') displayState = 'converted';
    else if (lead.state === 'not_tracking') displayState = 'not_tracking';
    else if (pending) displayState = pending.snoozed ? 'delayed' : 'active';
    else displayState = 'done';
    return { ...lead, followUps: leadFollowUps, pendingFollowUp: pending || null, latestFollowUp: latest, displayState };
  });
}

// 轉為正式客戶:建立 clients 一筆,把 lead 的備註轉成一筆客戶備註,原本的 lead/追蹤歷史保留但標記已成交、停止提醒
export async function convertLeadToClient(salonId, userId, lead, clientFields) {
  const channelLabel = { instagram: 'Instagram', line: 'LINE', facebook: 'Facebook', threads: 'Threads', phone: '電話', other: '其他' }[lead.channel] || lead.channel;
  const source_detail = lead.contact_handle ? `來自 ${channelLabel}:${lead.contact_handle}` : `來自 ${channelLabel}`;

  const client = await createClient(salonId, userId, {
    name: clientFields.name,
    phone: clientFields.phone || '',
    source: lead.channel === 'instagram' ? 'ig' : lead.channel === 'threads' ? 'threads' : null,
    source_detail,
  });

  if (lead.notes) {
    await createNote(salonId, client.id, userId, `[追蹤客戶轉入的備註]\n${lead.notes}`);
  }

  const { error } = await supabase
    .from('leads')
    .update({ state: 'converted', converted_client_id: client.id, converted_at: new Date().toISOString() })
    .eq('id', lead.id);
  if (error) throw error;

  await supabase.from('lead_follow_ups').update({ status: 'cancelled' }).eq('lead_id', lead.id).eq('status', 'pending');

  return client;
}
