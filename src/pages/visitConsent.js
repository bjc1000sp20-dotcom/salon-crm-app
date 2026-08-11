import { signaturePadHtml, setupSignaturePad } from '../components/signaturePad.js';

// 只有客戶「第一次到店」才會看到這一頁(visitForm.js 檢查過 consent_signature_url 是空的才會導來這裡)
export function renderVisitConsent(app) {
  const { clientId, draft } = app.params;

  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">課程前同意書</div>
        <div style="width:38px;"></div>
      </div>
      <div class="form-scroll">
        <div class="field-hint" style="margin-bottom:10px;">請客人閱讀以下內容,同意後在下方簽名。</div>
        <div class="note-box" style="margin-bottom:20px;">${escapeHtml(app.salon.consent_template)}</div>

        <div class="field">
          <div class="field-label">本人授權此店家可拍攝前後對比照或影片紀錄及宣傳</div>
          <div class="service-grid">
            <button type="button" class="service-chip photo-consent-chip" data-v="true">是</button>
            <button type="button" class="service-chip photo-consent-chip" data-v="false">否</button>
          </div>
        </div>

        <div class="field">
          <div class="field-label">客戶簽名<span class="req"> *</span></div>
          ${signaturePadHtml()}
        </div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="confirm-btn" disabled>同意並簽名</button>
      </div>
    </div>
  `;

  let photoConsent = null;
  document.querySelectorAll('.photo-consent-chip').forEach((chip) => {
    chip.onclick = () => {
      photoConsent = chip.dataset.v === 'true';
      document.querySelectorAll('.photo-consent-chip').forEach((c) => {
        c.classList.remove('on');
        c.style.background = '';
      });
      chip.classList.add('on');
      chip.style.background = '#3A332B';
    };
  });

  const sigPad = setupSignaturePad();
  const confirmBtn = document.getElementById('confirm-btn');

  const checkInterval = setInterval(() => {
    confirmBtn.disabled = !sigPad.hasStroke();
  }, 200);

  document.getElementById('back-btn').onclick = () => {
    clearInterval(checkInterval);
    app.navigate('visitForm', { mode: 'create', clientId, draft });
  };

  confirmBtn.onclick = async () => {
    if (!sigPad.hasStroke()) return;
    clearInterval(checkInterval);
    confirmBtn.disabled = true;
    confirmBtn.textContent = '處理中...';
    const blob = await sigPad.getBlob();
    const nextDraft = {
      ...draft,
      consentSignatureBlob: blob,
      consentTextSnapshot: app.salon.consent_template,
      photoConsent,
    };
    app.navigate('visitConfirm', { clientId, draft: nextDraft });
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
