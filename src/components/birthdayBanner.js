export function birthdayBannerHtml(clients) {
  if (!clients || !clients.length) return '';
  const items = clients
    .map((c) => {
      const d = new Date(c.birth_date);
      return `<div class="birthday-item"><span class="birthday-name">${escapeHtml(c.name)}</span><span class="birthday-date">${d.getMonth() + 1}月${d.getDate()}日</span></div>`;
    })
    .join('');
  return `
    <div class="birthday-banner">
      <div class="birthday-banner-title">🎂 本月壽星</div>
      ${items}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
