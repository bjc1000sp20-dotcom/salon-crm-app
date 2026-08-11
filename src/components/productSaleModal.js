import { createProductSale } from '../lib/data.js';

// clientId 可以是 null(不綁定客戶的銷售)。onDone 在存檔成功後呼叫,方便呼叫端重新整理畫面。
export function openProductSaleModal(app, clientId, onDone) {
  const today = new Date().toISOString().slice(0, 10);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">記錄商品銷售</div>
      <div class="field">
        <div class="field-label">品項</div>
        <input type="text" id="ps-item" placeholder="例如:保濕精華液" />
      </div>
      <div class="row-2">
        <div class="field">
          <div class="field-label">售價</div>
          <input type="number" id="ps-amount" min="0" step="1" placeholder="0" />
        </div>
        <div class="field">
          <div class="field-label">成本</div>
          <input type="number" id="ps-cost" min="0" step="1" placeholder="0" />
        </div>
      </div>
      <div class="field">
        <div class="field-label">日期</div>
        <input type="date" id="ps-date" value="${today}" />
      </div>
      <button class="primary-btn" id="ps-confirm">儲存</button>
      <button class="secondary-btn" id="ps-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('ps-cancel').onclick = () => overlay.remove();
  document.getElementById('ps-confirm').onclick = async () => {
    const item_name = document.getElementById('ps-item').value.trim();
    const amount = Number(document.getElementById('ps-amount').value) || 0;
    const cost = Number(document.getElementById('ps-cost').value) || 0;
    const sale_date = document.getElementById('ps-date').value || today;
    if (!item_name) {
      alert('請輸入品項名稱');
      return;
    }
    await createProductSale(app.salon.id, clientId, app.session.user.id, { item_name, amount, cost, sale_date });
    overlay.remove();
    if (onDone) onDone();
  };
}
