// 把生日話術裡的 {{變數}} 換成真正的客戶資料,跟前端 src/lib/messageTemplates.js 的邏輯一樣,
// 但 api/ 這邊是獨立的 Vercel Serverless Function 執行環境,不會、也不能 import 前端 src/ 的程式碼,
// 所以這裡自己保留一份小小的、不依賴任何外部套件的版本。
export function renderBirthdayMessage(template, { clientName, birthdayMonth, birthdayDate, offerText }) {
  const map = {
    '{{客戶姓名}}': clientName || '',
    '{{生日月份}}': birthdayMonth != null ? String(birthdayMonth) : '',
    '{{生日日期}}': birthdayDate != null ? String(birthdayDate) : '',
    '{{優惠內容}}': offerText || '',
  };
  let result = template || '';
  for (const [token, value] of Object.entries(map)) {
    result = result.replaceAll(token, value);
  }
  return result;
}
