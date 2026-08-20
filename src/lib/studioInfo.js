import { supabase } from '../supabaseClient.js';
import { compressImage } from './photoCompress.js';

const BUCKET = 'studio-info';

export async function listAllStudioImages(salonId) {
  const { data, error } = await supabase
    .from('studio_info_images')
    .select('*')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listEnabledStudioImages(salonId) {
  const all = await listAllStudioImages(salonId);
  return all.filter((img) => img.enabled !== false);
}

// 每張圖片用隨機檔名上傳(跟 client-archive 的多照片做法一樣),可以放很多張,不像舊版只能放一張固定檔名的圖
export async function uploadStudioImage(salonId, file, name) {
  const blob = await compressImage(file, 1600, 0.75);
  const existing = await listAllStudioImages(salonId);
  const path = `${salonId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
  });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase
    .from('studio_info_images')
    .insert({ salon_id: salonId, name: name || '', storage_path: path, sort_order: existing.length + 1 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudioImage(id, fields) {
  const { error } = await supabase.from('studio_info_images').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteStudioImage(id, storagePath) {
  await supabase.storage.from(BUCKET).remove([storagePath]);
  const { error } = await supabase.from('studio_info_images').delete().eq('id', id);
  if (error) throw error;
}

// 把整批工作室圖片的排序寫回去,orderedIds 是重新排序後的 id 陣列
export async function reorderStudioImages(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('studio_info_images').update({ sort_order: i + 1 }).eq('id', orderedIds[i]);
    if (error) throw error;
  }
}
