import { SERVICES } from '../lib/services.js';

export function serviceGridHtml(selectedIds) {
  return `
    <div class="service-grid" id="service-grid">
      ${SERVICES.map(
        (s) => `
        <button type="button" class="service-chip${selectedIds.includes(s.id) ? ' on' : ''}"
          data-id="${s.id}" style="${selectedIds.includes(s.id) ? `background:${s.color};` : ''}">
          ${s.name}
        </button>`
      ).join('')}
    </div>
  `;
}

// 呼叫後綁定 chip 點擊事件,selectedIds 是外部傳入、會被就地修改的陣列
export function bindServiceGrid(selectedIds, onChange) {
  const grid = document.getElementById('service-grid');
  grid.querySelectorAll('.service-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      const service = SERVICES.find((s) => s.id === id);
      const idx = selectedIds.indexOf(id);
      if (idx >= 0) {
        selectedIds.splice(idx, 1);
        chip.classList.remove('on');
        chip.style.background = '';
      } else {
        selectedIds.push(id);
        chip.classList.add('on');
        chip.style.background = service.color;
      }
      if (onChange) onChange(selectedIds);
    });
  });
}
