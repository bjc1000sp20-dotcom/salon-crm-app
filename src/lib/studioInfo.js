import { supabase } from '../supabaseClient.js';
import { updateSalon } from './data.js';
import { compressImage } from './photoCompress.js';

const BUCKET = 'studio-info';

// 工作室資訊圖片每家店只有一張,固定檔名 + upsert 直接覆蓋舊圖,不用另外開資料表管理
export async function uploadStudioInfoImage(salonId, file) {
  const blob = await compressImage(file, 1600, 0.75);
  const path = `${salonId}/studio-info.jpg`;
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (uploadErr) throw uploadErr;
  return updateSalon(salonId, { studio_info_image_path: path });
}

export async function deleteStudioInfoImage(salonId, path) {
  await supabase.storage.from(BUCKET).remove([path]);
  return updateSalon(salonId, { studio_info_image_path: null });
}
