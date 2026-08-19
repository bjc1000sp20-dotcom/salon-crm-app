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
      <div class="row-2">
        <div class="field">
          <div class="field-label">數量</div>
          <input type="number" id="ps-quantity" min="1" step="1" value="1" />
        </div>
        <div class="field">
          <div class="field-label">預估可用天數(選填)</div>
          <input type="number" id="ps-days-supply" min="1" step="1" placeholder="例如 30" />
        </div>
      </div>
      <div class="field">
        <div class="field-label">日期</div>
        <input type="date" id="ps-date" value="${today}" />
      </div>
      <div class="field-hint">填「預估可用天數」後,快用完時會出現在「商品銷售」頁的「即將回購」提醒裡。</div>
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
    const quantity = Number(document.getElementById('ps-quantity').value) || 1;
    const daysSupplyRaw = document.getElementById('ps-days-supply').value;
    const estimated_days_supply = daysSupplyRaw ? Number(daysSupplyRaw) : null;
    const sale_date = document.getElementById('ps-date').value || today;
    if (!item_name) {
      alert('請輸入品項名稱');
      return;
    }
    await createProductSale(app.salon.id, clientId, app.session.user.id, {
      item_name,
      amount,
      cost,
      quantity,
      estimated_days_supply,
      sale_date,
    });
    overlay.remove();
    if (onDone) onDone();
  };
}
