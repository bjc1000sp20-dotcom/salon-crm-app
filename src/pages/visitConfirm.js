import { getClientBalance } from '../lib/data.js';
import { serviceById } from '../lib/services.js';
import { signaturePadHtml, setupSignaturePad } from '../components/signaturePad.js';
import { paymentMethodName } from '../lib/paymentMethods.js';
import { homeButtonHtml } from '../components/homeButton.js';

// 每次到店都會看到這一頁(不只第一次)。刻意不接收、不顯示材料費——
// 這個階段材料費根本還沒被輸入(draft 裡沒有這個欄位),不是只用 CSS 藏起來。
export async function renderVisitConfirm(app) {
  const { clientId, draft } = app.params;

  app.root.innerHTML = `<div class="screen"><div style="padding:40px;text-align:center;color:#9B8F7F;">載入中...</div></div>`;

  let balanceBefore = null;
  if (draft.payment_method === 'balance') {
    balanceBefore = await getClientBalance(clientId);
  }
  const balanceAfter = balanceBefore != null ? balanceBefore - draft.amount : null;

  const services = (draft.serviceIds || []).map((id) => serviceById(id)).filter(Boolean);

  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">本次消費確認</div>
        ${homeButtonHtml()}
      </div>
      <div class="form-scroll">
        <div class="field-hint" style="margin-bottom:10px;">請客人確認以下今天的消費內容,確認無誤後在下方簽名。</div>

        <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;">
          <div class="detail-row"><strong>日期:</strong>&nbsp;${draft.visit_date}</div>
          <div class="visit-tags" style="margin:8px 0;">
            ${services.map((s) => `<span class="tag" style="background:${s.color}22;color:${s.color};">${s.name}</span>`).join('') || '<span class="visit-note">未選擇服務項目</span>'}
          </div>
          <div class="detail-row"><strong>消費金額:</strong>&nbsp;$${formatMoney(draft.amount)}</div>
          <div class="detail-row"><strong>付款方式:</strong>&nbsp;${paymentMethodName(draft.payment_method)}</div>
          ${
            balanceBefore != null
              ? `<div class="detail-row"><strong>扣款前餘額:</strong>&nbsp;$${formatMoney(balanceBefore)}</div>
                 <div class="detail-row"><strong>扣款後餘額:</strong>&nbsp;$${formatMoney(balanceAfter)}</div>`
              : ''
          }
          ${
            (draft.checkoutProducts || []).length
              ? `<div class="detail-row"><strong>另購買產品:</strong>&nbsp;${draft.checkoutProducts.map((p) => `${escapeHtml(p.item_name)}×${p.quantity}($${formatMoney(p.amount)})`).join('、')}</div>`
              : ''
          }
        </div>

        <div class="field" style="margin-top:20px;">
          <div class="field-label">客戶簽名確認<span class="req"> *</span></div>
          ${signaturePadHtml()}
        </div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="confirm-btn" disabled>確認簽名</button>
      </div>
    </div>
  `;

  const sigPad = setupSignaturePad();
  const confirmBtn = document.getElementById('confirm-btn');

  const checkInterval = setInterval(() => {
    confirmBtn.disabled = !sigPad.hasStroke();
  }, 200);

  document.getElementById('back-btn').onclick = () => {
    clearInterval(checkInterval);
    // 回上一步:如果剛剛簽過同意書(draft 裡有 consentSignatureBlob),代表這是第一次到店流程,退回同意書頁;
    // 否則(已簽過同意書的老客戶)退回到店資料填寫頁
    if (draft.consentSignatureBlob) {
      app.navigate('visitConsent', { clientId, draft: stripConfirmDraft(draft) });
    } else {
      app.navigate('visitForm', { mode: 'create', clientId, draft: stripConfirmDraft(draft) });
    }
  };
  document.getElementById('home-btn').onclick = () => {
    clearInterval(checkInterval);
    app.navigate('dashboard');
  };

  confirmBtn.onclick = async () => {
    if (!sigPad.hasStroke()) return;
    clearInterval(checkInterval);
    confirmBtn.disabled = true;
    confirmBtn.textContent = '處理中...';
    const blob = await sigPad.getBlob();
    const nextDraft = { ...draft, confirmationSignatureBlob: blob };
    app.navigate('visitMaterialCost', { clientId, draft: nextDraft });
  };
}

function stripConfirmDraft(draft) {
  const { confirmationSignatureBlob, ...rest } = draft;
  return rest;
}

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('zh-TW');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
