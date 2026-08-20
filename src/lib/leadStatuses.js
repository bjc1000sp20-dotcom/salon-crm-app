import { supabase } from '../supabaseClient.js';

const DEFAULT_STATUSES = ['剛詢問', '已報價', '等待回覆', '待付訂金', '待確認預約時間', '考慮中', '之後再聯絡', '其他'];

export async function listAllLeadStatuses(salonId) {
  const { data, error } = await supabase
    .from('lead_statuses')
    .select('*')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listEnabledLeadStatuses(salonId) {
  const all = await listAllLeadStatuses(salonId);
  return all.filter((s) => s.enabled !== false);
}

// 第一次使用時幫這家店建立預設的目前進度選項,做法比照既有的 ensureDefaultServices
export async function ensureDefaultLeadStatuses(salonId) {
  const existing = await listAllLeadStatuses(salonId);
  if (existing.length > 0) return existing;

  const rows = DEFAULT_STATUSES.map((name, idx) => ({ salon_id: salonId, name, sort_order: idx + 1 }));
  const { data, error } = await supabase.from('lead_statuses').insert(rows).select().order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createLeadStatus(salonId, name) {
  const existing = await listAllLeadStatuses(salonId);
  const { data, error } = await supabase
    .from('lead_statuses')
    .insert({ salon_id: salonId, name, sort_order: existing.length + 1 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLeadStatus(id, fields) {
  const { error } = await supabase.from('lead_statuses').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteLeadStatus(id) {
  const { error } = await supabase.from('lead_statuses').delete().eq('id', id);
  if (error) throw error;
}

// 把整批目前進度選項的排序寫回去,orderedIds 是重新排序後的 id 陣列
export async function reorderLeadStatuses(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('lead_statuses').update({ sort_order: i + 1 }).eq('id', orderedIds[i]);
    if (error) throw error;
  }
}
