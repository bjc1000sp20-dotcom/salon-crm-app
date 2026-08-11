import {
  createVisit,
  updateVisit,
  uploadVisitPhoto,
  uploadConsentSignature,
  uploadConfirmationSignature,
  updateClient,
} from '../lib/data.js';
import { serviceById } from '../lib/services.js';

// 店主自己看的最後一步,客人不用在場。按下「完成並儲存」才會真正把資料寫進資料庫
// (包含到店紀錄、照片、簽名檔案,以及如果是第一次到店的話同時把同意書簽名存進客戶卡)。
// 在這之前中途離開,不會留下任何資料庫紀錄。
export function renderVisitMaterialCost(app) {
  const { clientId, draft } = app.params;
  const services = (draft.serviceIds || []).map((id) => serviceById(id)).filter(Boolean);

  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">材料費結算</div>
        <div style="width:38px;"></div>
      </div>
      <div class="form-scroll">
        <div class="card" style="cursor:default;flex-direction:column;align-items:stretch;margin-bottom:18px;">
          <div class="detail-row"><strong>日期:</strong>&nbsp;${draft.visit_date}</div>
          <div class="visit-tags" style="margin:8px 0;">
            ${services.map((s) => `<span class="tag" style="background:${s.color}22;color:${s.color};">${s.name}</span>`).join('')}
          </div>
          <div class="detail-row"><strong>消費金額:</strong>&nbsp;$${formatMoney(draft.amount)}</div>
          <div class="detail-row"><strong>付款方式:</strong>&nbsp;${draft.payment_method === 'balance' ? '儲值金扣款' : '現金／其他'}</div>
        </div>

        <div class="field">
          <div class="field-label">材料費</div>
          <input type="number" id="f-cost" min="0" step="1" placeholder="0" />
        </div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="save-btn">完成並儲存</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('clientDetail', { clientId });

  const saveBtn = document.getElementById('save-btn');
  saveBtn.onclick = async () => {
    const material_cost = Number(document.getElementById('f-cost').value) || 0;
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';
    try {
      const fields = {
        visit_date: draft.visit_date,
        amount: draft.amount,
        payment_method: draft.payment_method,
        skin_condition: draft.skin_condition,
        next_visit_note: draft.next_visit_note,
        material_cost,
      };
      const visit = await createVisit(app.salon.id, clientId, app.session.user.id, fields, draft.serviceIds);

      for (const file of draft.newFiles || []) {
        await uploadVisitPhoto(app.salon.id, clientId, visit.id, file);
      }

      if (draft.confirmationSignatureBlob) {
        const path = await uploadConfirmationSignature(app.salon.id, clientId, visit.id, draft.confirmationSignatureBlob);
        await updateVisit(visit.id, { confirmation_signature_url: path });
      }

      if (draft.consentSignatureBlob) {
        const path = await uploadConsentSignature(app.salon.id, clientId, draft.consentSignatureBlob);
        await updateClient(clientId, {
          consent_signature_url: path,
          consent_text_snapshot: draft.consentTextSnapshot,
          consent_signed_at: new Date().toISOString(),
          photo_consent: draft.photoConsent,
        });
      }

      app.navigate('clientDetail', { clientId });
    } catch (err) {
      console.error(err);
      alert('儲存失敗:' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = '完成並儲存';
    }
  };
}

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('zh-TW');
}
