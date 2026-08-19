import { supabase } from '../supabaseClient.js';

export const MESSAGE_TEMPLATE_CATEGORIES = ['服務後追蹤', '預約', '療程', '產品回購', '沉睡客戶', '一般關心'];

export const MESSAGE_TEMPLATE_VARS = [
  { token: '{{客戶姓名}}', desc: '客戶姓名' },
  { token: '{{服務項目}}', desc: '上次到店的服務項目' },
  { token: '{{上次服務日期}}', desc: '上次到店日期' },
  { token: '{{預約日期}}', desc: '這位客戶最近一筆預約的日期' },
  { token: '{{預約時間}}', desc: '這位客戶最近一筆預約的時間' },
  { token: '{{剩餘堂數}}', desc: '進行中療程的剩餘堂數' },
  { token: '{{產品名稱}}', desc: '最近一次購買的產品名稱' },
];

const DEFAULT_MESSAGE_TEMPLATES = [
  { category: '服務後追蹤', name: '做臉後關心', message: '嗨 {{客戶姓名}}～想關心一下妳做完 {{服務項目}} 後,目前皮膚狀況還好嗎?有沒有比較乾、紅或其他不舒服的地方呢?', is_favorite: true },
  { category: '服務後追蹤', name: '增生物處理後關心', message: '嗨 {{客戶姓名}}～想確認一下增生物處理的地方目前結痂/修復狀況如何?如果有任何不舒服都可以跟我說 😊', is_favorite: false },
  { category: '服務後追蹤', name: '痘痘調理追蹤', message: '嗨 {{客戶姓名}}～痘痘調理後這幾天狀況還好嗎?有沒有冒新的粉刺或痘痘呢?', is_favorite: false },
  { category: '療程', name: '療程提醒', message: '嗨 {{客戶姓名}}～提醒妳目前療程還剩 {{剩餘堂數}} 堂,要不要安排下一次時間呢?', is_favorite: true },
  { category: '產品回購', name: '產品回購提醒', message: '嗨 {{客戶姓名}}～妳之前購買的 {{產品名稱}} 應該快用完了,需要幫妳保留下一罐嗎?', is_favorite: true },
  { category: '沉睡客戶', name: '久未回訪', message: '嗨 {{客戶姓名}}～好一陣子沒看到妳了,最近皮膚狀況還好嗎?想安排保養的話都可以再跟我約時間 😊', is_favorite: false },
  { category: '預約', name: '預約提醒', message: '嗨 {{客戶姓名}}～提醒您 {{預約日期}} {{預約時間}} 有預約,記得準時前往,如需調整時間請提前告知,謝謝。', is_favorite: true },
  { category: '預約', name: '預約後未付訂金', message: '嗨 {{客戶姓名}}～您 {{預約日期}} 的預約還沒收到訂金,方便的話麻煩協助完成付款,謝謝 😊', is_favorite: false },
];

export async function listMessageTemplates(salonId) {
  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('salon_id', salonId)
    .order('is_favorite', { ascending: false })
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

// 第一次使用時幫這家店建立一批常用範例,之後都可以自己新增/編輯/刪除
export async function ensureDefaultMessageTemplates(salonId) {
  const existing = await listMessageTemplates(salonId);
  if (existing.length > 0) return existing;

  const rows = DEFAULT_MESSAGE_TEMPLATES.map((t) => ({ ...t, salon_id: salonId }));
  const { data, error } = await supabase.from('message_templates').insert(rows).select();
  if (error) throw error;
  return data;
}

export async function createMessageTemplate(salonId, userId, fields) {
  const { data, error } = await supabase
    .from('message_templates')
    .insert({ salon_id: salonId, created_by: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMessageTemplate(id, fields) {
  const { error } = await supabase
    .from('message_templates')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMessageTemplate(id) {
  const { error } = await supabase.from('message_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateMessageTemplate(salonId, userId, template) {
  return createMessageTemplate(salonId, userId, {
    name: `${template.name}(複製)`,
    category: template.category,
    message: template.message,
    is_favorite: false,
  });
}

// 把話術裡的 {{變數}} 換成真正的客戶資料,context 裡沒有的欄位就換成空字串,不會留下沒代換到的 {{...}}
export function renderMessageVars(message, context = {}) {
  const map = {
    '{{客戶姓名}}': context.clientName || '',
    '{{服務項目}}': context.serviceNames || '',
    '{{上次服務日期}}': context.lastVisitDate || '',
    '{{預約日期}}': context.appointmentDate || '',
    '{{預約時間}}': context.appointmentTime || '',
    '{{剩餘堂數}}': context.remainingSessions != null ? String(context.remainingSessions) : '',
    '{{產品名稱}}': context.productName || '',
  };
  let result = message || '';
  for (const [token, value] of Object.entries(map)) {
    result = result.replaceAll(token, value);
  }
  return result;
}
