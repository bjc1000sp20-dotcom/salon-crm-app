// 從原型 客戶管理系統.html 的 calcAge() 原樣搬過來,已正確處理「今年生日還沒到」的情況。
export function calcAge(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const hasHadBirthdayThisYear =
    t.getMonth() > b.getMonth() ||
    (t.getMonth() === b.getMonth() && t.getDate() >= b.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return age;
}
