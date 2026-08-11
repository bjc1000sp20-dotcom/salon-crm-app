// 密碼欄位旁邊「眼睛」按鈕:點一下切換顯示/隱藏密碼文字,方便使用者確認有沒有打錯
export function passwordFieldHtml(id, labelText, autocomplete, extraAttrs = '') {
  return `
    <label class="field-label" for="${id}">${labelText}</label>
    <div style="position:relative;">
      <input id="${id}" type="password" autocomplete="${autocomplete}" required style="padding-right:44px;" ${extraAttrs} />
      <button type="button" id="${id}-toggle" class="icon-btn" style="position:absolute;right:2px;top:50%;transform:translateY(-50%);width:34px;height:34px;font-size:16px;" aria-label="顯示/隱藏密碼">👁</button>
    </div>
  `;
}

export function bindPasswordToggle(id) {
  const input = document.getElementById(id);
  const btn = document.getElementById(`${id}-toggle`);
  btn.onclick = () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.style.opacity = showing ? '1' : '0.5';
  };
}
