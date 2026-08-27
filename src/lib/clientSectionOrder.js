// 客戶相關欄位/區塊的排序註冊表——「新增客戶」表單跟「客戶詳情頁」共用同一份,
// 存在 salons.client_detail_section_order(欄位名稱沿用舊的,實際涵蓋範圍已經擴大到兩個頁面)。
// 以後再新增欄位/區塊,只要在這裡多加一筆 key,computeClientSectionOrder 就會自動把它排進
// 「還沒存過順序」的店家清單最後面,不用另外寫遷移邏輯。
export const CLIENT_SECTION_KEYS = [
  'basicName',
  'basicPhone',
  'basicBirthday',
  'basicAddress',
  'basicGender',
  'basicSource',
  'preVisitSummary',
  'tags',
  'notes',
  'questionnaire',
  'intake',
  'skinTypeStaff',
  'signature',
  'balance',
  'packages',
  'productRecommendation',
  'lineTracking',
  'archive',
  'visits',
];

export const CLIENT_SECTION_TITLES = {
  basicName: '姓名',
  basicPhone: '電話',
  basicBirthday: '生日',
  basicAddress: '地址',
  basicGender: '性別',
  basicSource: '客戶來源',
  preVisitSummary: '服務前摘要',
  signature: '簽名',
  tags: '客戶標籤',
  notes: '客戶備註',
  questionnaire: '基本狀況問卷',
  intake: '問卷／聯絡資訊',
  skinTypeStaff: '皮膚類型(美容師填寫)',
  balance: '儲值餘額與快速操作',
  packages: '療程',
  productRecommendation: '產品搭配建議',
  lineTracking: 'LINE(綁定／預約／自動追蹤)',
  archive: '紙本歷史資料',
  visits: '到店紀錄',
};

export function computeClientSectionOrder(app) {
  const saved = Array.isArray(app.salon.client_detail_section_order) ? app.salon.client_detail_section_order : [];
  const known = saved.filter((k) => CLIENT_SECTION_KEYS.includes(k));
  const missing = CLIENT_SECTION_KEYS.filter((k) => !known.includes(k));
  return [...known, ...missing];
}
