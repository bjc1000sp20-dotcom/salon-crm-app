import { supabase } from '../supabaseClient.js';

// SERVICES/serviceById 對外介面維持跟以前一模一樣(其他 6 個檔案 import 這兩個東西的寫法完全不用改),
// 只是內容從寫死改成資料庫載入、原地更新陣列內容(陣列是參照傳遞,import 進去的地方會自動看到最新值)。
// SERVICES 只放「啟用中」的項目,給複選格子用;serviceById 可以查到啟用+停用全部,給顯示舊紀錄用。
export const SERVICES = [];
let allServicesCache = [];

const DEFAULT_SERVICES = [
  { id: 'milia', name: '肉芽處理', color: '#B8886B', sort_order: 1 },
  { id: 'hydra', name: '素顏水光肌', color: '#8FA688', sort_order: 2 },
  { id: 'acne', name: '痘痘調理', color: '#C4756B', sort_order: 3 },
  { id: 'pore', name: '粉刺調理', color: '#A88B6F', sort_order: 4 },
  { id: 'scar', name: '凹疤調理', color: '#8B7D9B', sort_order: 5 },
  { id: 'spot', name: '斑點調理', color: '#B39456', sort_order: 6 },
];

const COLOR_PALETTE = ['#B8886B', '#8FA688', '#C4756B', '#A88B6F', '#8B7D9B', '#B39456', '#6B8CAE', '#B5533C'];

export function serviceById(id) {
  return allServicesCache.find((s) => s.id === id);
}

// App 開機時呼叫一次填快取;visitForm.js 每次進入時用 force:true 強制重新抓最新的
export async function loadServices(salonId, { force = false } = {}) {
  if (allServicesCache.length && !force) return;
  const list = await ensureDefaultServices(salonId);
  allServicesCache = list;
  SERVICES.length = 0;
  SERVICES.push(...list.filter((s) => s.enabled !== false));
}

export async function listAllServices(salonId) {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

// 第一次使用時幫這家店建立預設的 6 個服務項目,id 跟舊系統寫死的一樣,舊紀錄不用搬資料
export async function ensureDefaultServices(salonId) {
  const existing = await listAllServices(salonId);
  if (existing.length > 0) return existing;

  const rows = DEFAULT_SERVICES.map((s) => ({ ...s, salon_id: salonId }));
  const { data, error } = await supabase.from('services').insert(rows).select().order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createService(salonId, name) {
  const existingCount = allServicesCache.length || (await listAllServices(salonId)).length;
  const color = COLOR_PALETTE[existingCount % COLOR_PALETTE.length];
  const { data, error } = await supabase
    .from('services')
    .insert({ salon_id: salonId, name, color, sort_order: existingCount + 1 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateService(id, fields) {
  const { error } = await supabase.from('services').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteService(id) {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
}

export async function isServiceUsed(id) {
  const { count, error } = await supabase
    .from('visit_services')
    .select('visit_id', { count: 'exact', head: true })
    .eq('service_id', id);
  if (error) throw error;
  return (count || 0) > 0;
}

// 批次查詢:這批服務 id 裡,哪些曾經被到店紀錄用過(給管理頁一次判斷可不可以刪除,不用一筆一筆查)
export async function listUsedServiceIds(serviceIds) {
  if (!serviceIds.length) return new Set();
  const { data, error } = await supabase.from('visit_services').select('service_id').in('service_id', serviceIds);
  if (error) throw error;
  return new Set(data.map((r) => r.service_id));
}

// 把整批服務的排序寫回去,orderedIds 是重新排序後的 id 陣列
export async function reorderServices(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('services').update({ sort_order: i + 1 }).eq('id', orderedIds[i]);
    if (error) throw error;
  }
}
