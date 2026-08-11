// 固定服務項目(沿用原型),v1 不做自訂服務項目管理
export const SERVICES = [
  { id: 'milia', name: '肉芽處理', color: '#B8886B' },
  { id: 'hydra', name: '素顏水光肌', color: '#8FA688' },
  { id: 'acne', name: '痘痘調理', color: '#C4756B' },
  { id: 'pore', name: '粉刺調理', color: '#A88B6F' },
  { id: 'scar', name: '凹疤調理', color: '#8B7D9B' },
  { id: 'spot', name: '斑點調理', color: '#B39456' },
];

export function serviceById(id) {
  return SERVICES.find((s) => s.id === id);
}
