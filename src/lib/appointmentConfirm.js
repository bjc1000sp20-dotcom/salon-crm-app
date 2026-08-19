export const APPOINTMENT_CONFIRM_VARS = [
  { token: '{{客戶姓名}}', desc: '客戶姓名' },
  { token: '{{預約日期}}', desc: '預約日期(M/D)' },
  { token: '{{預約時間}}', desc: '預約時間' },
  { token: '{{服務項目}}', desc: '服務項目(選填,目前系統尚無服務項目選擇,先保留供未來使用)' },
];

// 把 YYYY-MM-DD 轉成 M/D(不補零、不顯示年份),沒有值就回傳空字串
export function formatAppointmentDate(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  if (!m || !d) return '';
  return `${Number(m)}/${Number(d)}`;
}

// appointmentTime 預期已經是 HH:MM 格式(呼叫端自行 slice(0,5)),這裡不處理 Postgres time 原始格式
export function renderAppointmentConfirmVars(template, { clientName, appointmentDate, appointmentTime, serviceNames }) {
  const map = {
    '{{客戶姓名}}': clientName || '',
    '{{預約日期}}': formatAppointmentDate(appointmentDate),
    '{{預約時間}}': appointmentTime || '',
    '{{服務項目}}': serviceNames || '',
  };
  let result = template || '';
  for (const [token, value] of Object.entries(map)) {
    result = result.replaceAll(token, value);
  }
  return result;
}
