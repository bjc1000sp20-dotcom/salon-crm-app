export const SOURCES = [
  { id: 'ig', name: 'IG', color: '#B8886B' },
  { id: 'threads', name: 'Threads', color: '#3A332B' },
  { id: 'friend_referral', name: '朋友介紹', color: '#8FA688' },
  { id: 'client_referral', name: '舊客介紹', color: '#B39456' },
];

export function sourceById(id) {
  return SOURCES.find((s) => s.id === id);
}

export function sourceName(id) {
  return sourceById(id)?.name || '未填';
}
