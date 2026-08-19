export const PAYMENT_METHODS = [
  { id: 'cash', name: '現金' },
  { id: 'balance', name: '儲值金扣款' },
  { id: 'transfer', name: '轉帳' },
  { id: 'credit_card', name: '信用卡' },
  { id: 'mobile_payment', name: '行動支付' },
  { id: 'other', name: '其他' },
];

export function paymentMethodName(id) {
  return PAYMENT_METHODS.find((m) => m.id === id)?.name || id || '未指定';
}
