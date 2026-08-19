import { supabase } from '../supabaseClient.js';

const DEFAULT_TAGS = [
  '易敏感',
  '修復能力弱',
  '曾使用藥物',
  '曾做雷射',
  '容易泛紅',
  '容易反黑',
  '怕痛',
  '不適合高刺激療程',
  '居家照護配合度低',
  '特別注意',
];

export async function listTags(salonId) {
  const { data, error } = await supabase.from('tags').select('*').eq('salon_id', salonId).order('name');
  if (error) throw error;
  return data;
}

// 第一次使用時,幫這家店建立預設的常用風險標籤,之後可以自己新增/刪除
export async function ensureDefaultTags(salonId) {
  const existing = await listTags(salonId);
  if (existing.length > 0) return existing;

  const rows = DEFAULT_TAGS.map((name) => ({ salon_id: salonId, name }));
  const { data, error } = await supabase.from('tags').insert(rows).select();
  if (error) throw error;
  return data;
}

export async function createTag(salonId, name) {
  const { data, error } = await supabase
    .from('tags')
    .insert({ salon_id: salonId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTag(id) {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
}

export async function listTagIdsForClient(clientId) {
  const { data, error } = await supabase.from('client_tags').select('tag_id').eq('client_id', clientId);
  if (error) throw error;
  return data.map((r) => r.tag_id);
}

// 直接用「這位客戶現在應該有哪些標籤」整批覆蓋,不用一個個比對新增/刪除
export async function setClientTags(salonId, clientId, tagIds) {
  const { error: delErr } = await supabase.from('client_tags').delete().eq('client_id', clientId);
  if (delErr) throw delErr;

  if (tagIds.length > 0) {
    const rows = tagIds.map((tagId) => ({ salon_id: salonId, client_id: clientId, tag_id: tagId }));
    const { error: insErr } = await supabase.from('client_tags').insert(rows);
    if (insErr) throw insErr;
  }
}
