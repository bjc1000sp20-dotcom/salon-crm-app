// 密碼欄位旁邊「眼睛」按鈕:點一下切換顯示/隱藏密碼文字,方便使用者確認有沒有打錯
const EYE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const EYE_OFF_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

export function passwordFieldHtml(id, labelText, autocomplete, extraAttrs = '') {
  return `
    <label class="field-label" for="${id}">${labelText}</label>
    <div style="position:relative;">
      <input id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" required style="padding-right:44px;" ${extraAttrs} />
      <button type="button" id="${id}-toggle" class="icon-btn" style="position:absolute;right:2px;top:50%;transform:translateY(-50%);width:34px;height:34px;color:var(--text-muted);" aria-label="顯示/隱藏密碼">${EYE_ICON}</button>
    </div>
  `;
}

export function bindPasswordToggle(id) {
  const input = document.getElementById(id);
  const btn = document.getElementById(`${id}-toggle`);
  btn.onclick = () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
  };
}
