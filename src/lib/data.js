import { supabase } from '../supabaseClient.js';
import { compressImage } from './photoCompress.js';

// ---------------- 客戶 ----------------

// 輕量查詢:已綁定 LINE 的客戶,給「發送測試訊息」這種小型選擇器用
export async function listClientsWithLine(salonId) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, line_user_id')
    .eq('salon_id', salonId)
    .eq('archived', false)
    .not('line_user_id', 'is', null)
    .order('name');
  if (error) throw error;
  return data;
}

// 輕量的姓名搜尋,給「從 LINE 聯絡人反向挑客戶」這種小型選擇器用,不用抓每位客戶的完整統計資料
export async function searchClientsByName(salonId, query) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone')
    .eq('salon_id', salonId)
    .eq('archived', false)
    .ilike('name', `%${query}%`)
    .limit(20);
  if (error) throw error;
  return data;
}

export async function getClient(clientId) {
  const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
  if (error) throw error;
  return data;
}

export async function createClient(salonId, userId, fields) {
  const { data, error } = await supabase
    .from('clients')
    .insert({ salon_id: salonId, created_by: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(clientId, fields) {
  const { data, error } = await supabase.from('clients').update(fields).eq('id', clientId).select().single();
  if (error) throw error;
  return data;
}

// 封存/恢復:不刪除任何資料,只是不再出現在一般客戶列表
export async function archiveClient(clientId) {
  return updateClient(clientId, { archived: true, archived_at: new Date().toISOString() });
}

export async function unarchiveClient(clientId) {
  return updateClient(clientId, { archived: false, archived_at: null });
}

// 永久刪除:先清掉這位客戶的紙本歷史資料照片(避免留下孤兒檔案),
// 其餘資料表(到店紀錄、儲值、療程、備註、標籤、預約、LINE 追蹤)交給資料庫既有的 cascade 外鍵處理
export async function deleteClientPermanently(clientId) {
  const { data: photos, error: photosErr } = await supabase
    .from('client_archive_photos')
    .select('storage_path')
    .eq('client_id', clientId);
  if (photosErr) throw photosErr;
  if (photos && photos.length) {
    await supabase.storage.from('client-archive').remove(photos.map((p) => p.storage_path));
  }

  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw error;
}

// 簽名圖檔上傳(只在新增客戶時呼叫一次)
export async function uploadSignature(salonId, clientId, blob) {
  const path = `${salonId}/${clientId}/signature.jpg`;
  const { error: uploadErr } = await supabase.storage.from('signatures').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (uploadErr) throw uploadErr;
  return path;
}

export async function getSignedUrl(bucket, path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------- 到店紀錄 ----------------

export async function listVisitsForClient(clientId) {
  const { data, error } = await supabase
    .from('visits')
    .select('*, visit_services(service_id), visit_photos(id, storage_path)')
    .eq('client_id', clientId)
    .order('visit_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getVisit(visitId) {
  const { data, error } = await supabase
    .from('visits')
    .select('*, visit_services(service_id), visit_photos(id, storage_path)')
    .eq('id', visitId)
    .single();
  if (error) throw error;
  return data;
}

export async function createVisit(salonId, clientId, userId, fields, serviceIds) {
  const { data: visit, error } = await supabase
    .from('visits')
    .insert({ salon_id: salonId, client_id: clientId, created_by: userId, ...fields })
    .select()
    .single();
  if (error) throw error;

  if (serviceIds && serviceIds.length) {
    const rows = serviceIds.map((service_id) => ({ visit_id: visit.id, service_id }));
    const { error: svcErr } = await supabase.from('visit_services').insert(rows);
    if (svcErr) throw svcErr;
  }
  return visit;
}

export async function updateVisit(visitId, fields, serviceIds) {
  const { data: visit, error } = await supabase.from('visits').update(fields).eq('id', visitId).select().single();
  if (error) throw error;

  if (serviceIds) {
    const { error: delErr } = await supabase.from('visit_services').delete().eq('visit_id', visitId);
    if (delErr) throw delErr;
    if (serviceIds.length) {
      const rows = serviceIds.map((service_id) => ({ visit_id: visitId, service_id }));
      const { error: insErr } = await supabase.from('visit_services').insert(rows);
      if (insErr) throw insErr;
    }
  }
  return visit;
}

export async function deleteVisit(visitId) {
  const { error } = await supabase.from('visits').delete().eq('id', visitId);
  if (error) throw error;
}

// 上傳到店照片,先在瀏覽器壓縮(900px / JPEG 0.6),回傳存好的 storage path
export async function uploadVisitPhoto(salonId, clientId, visitId, file) {
  const blob = await compressImage(file, 900, 0.6);
  const path = `${salonId}/${clientId}/${visitId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadErr } = await supabase.storage.from('visit-photos').upload(path, blob, {
    contentType: 'image/jpeg',
  });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase.from('visit_photos').insert({ visit_id: visitId, storage_path: path }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteVisitPhoto(photoId, storagePath) {
  await supabase.storage.from('visit-photos').remove([storagePath]);
  const { error } = await supabase.from('visit_photos').delete().eq('id', photoId);
  if (error) throw error;
}

// ---------------- 儲值 / 帳本 ----------------

export async function getClientBalance(clientId) {
  const { data, error } = await supabase.from('client_balances').select('balance').eq('client_id', clientId).single();
  if (error) throw error;
  return Number(data.balance);
}

export async function listTopups(clientId) {
  const { data, error } = await supabase
    .from('topups')
    .select('*')
    .eq('client_id', clientId)
    .order('topup_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTopup(salonId, clientId, userId, amount, topupDate) {
  const { data, error } = await supabase
    .from('topups')
    .insert({ salon_id: salonId, client_id: clientId, created_by: userId, amount, topup_date: topupDate })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTopup(topupId, userId, { amount, topup_date }) {
  const { data, error } = await supabase
    .from('topups')
    .update({ amount, topup_date, updated_at: new Date().toISOString(), updated_by: userId })
    .eq('id', topupId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------- 租金 / 月營收 ----------------

export async function getRent(salonId, month) {
  const { data, error } = await supabase
    .from('monthly_rent')
    .select('rent')
    .eq('salon_id', salonId)
    .eq('month', month)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.rent) : 0;
}

export async function setRent(salonId, month, rent) {
  const { error } = await supabase.from('monthly_rent').upsert({ salon_id: salonId, month, rent });
  if (error) throw error;
}

export async function getMonthlySummary(salonId, month) {
  const { data, error } = await supabase.rpc('get_monthly_summary', { p_salon_id: salonId, p_month: month });
  if (error) throw error;
  return data[0];
}

export async function getMonthlyAnalytics(salonId, month) {
  const { data, error } = await supabase.rpc('get_monthly_analytics', { p_salon_id: salonId, p_month: month });
  if (error) throw error;
  return data[0];
}

export async function listMonthlyVisits(salonId, month) {
  const [y, m] = month.split('-').map(Number);
  const nextMonth = new Date(y, m, 1); // JS month 是 0-based,這裡剛好等於下個月 1 號
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('visits')
    .select('*, clients(name)')
    .eq('salon_id', salonId)
    .gte('visit_date', `${month}-01`)
    .lt('visit_date', nextMonthStr) // 用「小於下個月 1 號」取代「小於等於 XX-31」,避免 2 月等短月份出現無效日期
    .order('visit_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function countAllClients(salonId) {
  const { count, error } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('salon_id', salonId)
    .eq('archived', false);
  if (error) throw error;
  return count || 0;
}

export async function countNewClientsInMonth(salonId, month) {
  const [y, m] = month.split('-').map(Number);
  const nextMonth = new Date(y, m, 1);
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const { count, error } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('salon_id', salonId)
    .gte('created_at', `${month}-01`)
    .lt('created_at', nextMonthStr);
  if (error) throw error;
  return count || 0;
}

// ---------------- 生日提醒 ----------------

export async function getBirthdayClients(salonId, month) {
  const { data, error } = await supabase.rpc('get_birthday_clients', { p_salon_id: salonId, p_month: month });
  if (error) throw error;
  return data;
}

// ---------------- 店家設定(同意書範本等) ----------------

export async function updateSalon(salonId, fields) {
  const { data, error } = await supabase.from('salons').update(fields).eq('id', salonId).select().single();
  if (error) throw error;
  return data;
}

// ---------------- 同意書 / 消費確認簽名 ----------------
// 存在獨立的 client-signatures bucket,跟客戶卡建立時的 signatures bucket 分開,避免混淆用途

export async function uploadConsentSignature(salonId, clientId, blob) {
  const path = `${salonId}/${clientId}/consent.jpg`;
  const { error } = await supabase.storage.from('client-signatures').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function uploadConfirmationSignature(salonId, clientId, visitId, blob) {
  const path = `${salonId}/${clientId}/${visitId}/confirmation.jpg`;
  const { error } = await supabase.storage.from('client-signatures').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

// ---------------- 服務項目佔比 ----------------

export async function getServiceMix(salonId, month) {
  const { data, error } = await supabase.rpc('get_service_mix', { p_salon_id: salonId, p_month: month });
  if (error) throw error;
  return data;
}

// ---------------- 客戶來源佔比 ----------------

export async function getSourceMix(salonId, month) {
  const { data, error } = await supabase.rpc('get_source_mix', { p_salon_id: salonId, p_month: month });
  if (error) throw error;
  return data;
}

// ---------------- 產品銷售 ----------------

export async function listProductSalesForClient(clientId) {
  const { data, error } = await supabase
    .from('product_sales')
    .select('*')
    .eq('client_id', clientId)
    .order('sale_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listRecentVisits(salonId, limit = 5) {
  const { data, error } = await supabase
    .from('visits')
    .select('*, clients(id, name)')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function listAllProductSales(salonId) {
  const { data, error } = await supabase
    .from('product_sales')
    .select('*, clients(name)')
    .eq('salon_id', salonId)
    .order('sale_date', { ascending: false });
  if (error) throw error;
  return data;
}

// 有填「預估可用天數」的商品銷售,算出預計用完日期,回傳「已經用完或 7 天內會用完」的,依用完日期排序
export async function listUpcomingRepurchases(salonId, withinDays = 7) {
  const { data, error } = await supabase
    .from('product_sales')
    .select('*, clients(id, name)')
    .eq('salon_id', salonId)
    .not('estimated_days_supply', 'is', null);
  if (error) throw error;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  return data
    .map((s) => {
      const depleteDate = new Date(s.sale_date + 'T00:00:00');
      depleteDate.setDate(depleteDate.getDate() + Number(s.estimated_days_supply));
      return { ...s, deplete_date: depleteDate.toISOString().slice(0, 10) };
    })
    .filter((s) => new Date(s.deplete_date + 'T00:00:00') <= cutoff)
    .sort((a, b) => (a.deplete_date < b.deplete_date ? -1 : 1));
}

export async function listMonthlyProductSales(salonId, month) {
  const [y, m] = month.split('-').map(Number);
  const nextMonth = new Date(y, m, 1);
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('product_sales')
    .select('*, clients(name)')
    .eq('salon_id', salonId)
    .gte('sale_date', `${month}-01`)
    .lt('sale_date', nextMonthStr)
    .order('sale_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createProductSale(salonId, clientId, userId, fields) {
  const { data, error } = await supabase
    .from('product_sales')
    .insert({ salon_id: salonId, client_id: clientId || null, created_by: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProductSale(saleId) {
  const { error } = await supabase.from('product_sales').delete().eq('id', saleId);
  if (error) throw error;
}

export async function updateProductSale(saleId, userId, fields) {
  const { data, error } = await supabase
    .from('product_sales')
    .update({ ...fields, updated_at: new Date().toISOString(), updated_by: userId })
    .eq('id', saleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
