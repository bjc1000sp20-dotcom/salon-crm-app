import { supabase } from '../supabaseClient.js';

export async function listAllQuickPhrases(salonId) {
  const { data, error } = await supabase
    .from('quick_phrases')
    .select('*')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listEnabledQuickPhrases(salonId) {
  const all = await listAllQuickPhrases(salonId);
  return all.filter((p) => p.enabled !== false);
}

export async function createQuickPhrase(salonId, name, content) {
  const existing = await listAllQuickPhrases(salonId);
  const { data, error } = await supabase
    .from('quick_phrases')
    .insert({ salon_id: salonId, name, content, sort_order: existing.length + 1 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuickPhrase(id, fields) {
  const { error } = await supabase.from('quick_phrases').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteQuickPhrase(id) {
  const { error } = await supabase.from('quick_phrases').delete().eq('id', id);
  if (error) throw error;
}

// 把整批工作室常用話語的排序寫回去,orderedIds 是重新排序後的 id 陣列
export async function reorderQuickPhrases(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('quick_phrases').update({ sort_order: i + 1 }).eq('id', orderedIds[i]);
    if (error) throw error;
  }
}
