import { supabase } from '../supabaseClient.js';
import { compressImage } from './photoCompress.js';

// 舊客戶紙本歷史資料照片——跟到店紀錄的膚況照片是分開的兩件事,不會混在一起。
// 紙本掃描通常有文字,壓縮參數比一般照片留大一點、畫質高一點,確保之後看得清楚。

export async function listArchivePhotos(clientId) {
  const { data, error } = await supabase
    .from('client_archive_photos')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadArchivePhoto(salonId, clientId, userId, file, label = '') {
  const blob = await compressImage(file, 1600, 0.75);
  const path = `${salonId}/${clientId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadErr } = await supabase.storage.from('client-archive').upload(path, blob, {
    contentType: 'image/jpeg',
  });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase
    .from('client_archive_photos')
    .insert({ salon_id: salonId, client_id: clientId, created_by: userId, storage_path: path, label })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateArchivePhotoLabel(id, label) {
  const { error } = await supabase.from('client_archive_photos').update({ label }).eq('id', id);
  if (error) throw error;
}

export async function deleteArchivePhoto(id, storagePath) {
  await supabase.storage.from('client-archive').remove([storagePath]);
  const { error } = await supabase.from('client_archive_photos').delete().eq('id', id);
  if (error) throw error;
}
