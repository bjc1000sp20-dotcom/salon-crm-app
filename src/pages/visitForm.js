import {
  getVisit,
  getClient,
  updateVisit,
  deleteVisit,
  uploadVisitPhoto,
  deleteVisitPhoto,
  getSignedUrl,
  getClientBalance,
} from '../lib/data.js';
import { serviceGridHtml, bindServiceGrid } from '../components/serviceMultiSelect.js';

// 建立模式(新增到店紀錄)不會在這一頁直接存檔——填完基本資料後,
// 會先進「同意書」(只有第一次到店才會出現)、「消費確認簽名」,
// 最後才由店主在另一頁輸入材料費、真正寫進資料庫。
// 編輯模式(修改舊紀錄)維持原本單頁直接存檔的做法,不會重跑簽名流程。
export async function renderVisitForm(app) {
  const { mode, clientId, draft } = app.params;
  const isEdit = mode === 'edit';
  const visit = isEdit ? await getVisit(app.params.visitId) : null;

  const selectedServices = draft?.serviceIds ?? (visit ? visit.visit_services.map((vs) => vs.service_id) : []);
  const existingPhotos = visit ? visit.visit_photos : [];
  const removedPhotoIds = new Set();
  // newFiles: { file, previewUrl } — 如果是從下一步「上一步」回來的,把 draft 裡的 File 物件還原成縮圖
  const newFiles = (draft?.newFiles || []).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));

  const today = new Date().toISOString().slice(0, 10);

  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">${isEdit ? '編輯到店紀錄' : '新增到店紀錄'}</div>
        <div style="width:38px;"></div>
      </div>
      <div class="form-scroll">
        <div class="field">
          <div class="field-label">到店日期</div>
          <input type="date" id="f-date" value="${draft?.visit_date ?? visit?.visit_date ?? today}" />
        </div>

        <div class="field">
          <div class="field-label">服務項目(可複選)</div>
          ${serviceGridHtml(selectedServices)}
        </div>

        <div class="row-2">
          <div class="field">
            <div class="field-label">消費金額</div>
            <input type="number" id="f-amount" min="0" step="1" value="${draft?.amount ?? visit?.amount ?? ''}" placeholder="0" />
          </div>
          ${
            isEdit
              ? `<div class="field">
            <div class="field-label">材料費</div>
            <input type="number" id="f-cost" min="0" step="1" value="${visit?.material_cost ?? ''}" placeholder="0" />
          </div>`
              : ''
          }
        </div>
        ${!isEdit ? `<div class="field-hint" style="margin:-10px 0 18px;">材料費會在客人簽名確認之後,由店主另外輸入,這裡不會出現。</div>` : ''}

        <div class="field">
          <div class="field-label">付款方式</div>
          <div class="service-grid">
            <button type="button" class="service-chip pay-chip${(draft?.payment_method ?? visit?.payment_method ?? 'cash') === 'cash' ? ' on' : ''}" data-pm="cash" style="${(draft?.payment_method ?? visit?.payment_method ?? 'cash') === 'cash' ? 'background:#3A332B;' : ''}">現金／其他</button>
            <button type="button" class="service-chip pay-chip${(draft?.payment_method ?? visit?.payment_method) === 'balance' ? ' on' : ''}" data-pm="balance" style="${(draft?.payment_method ?? visit?.payment_method) === 'balance' ? 'background:#3A332B;' : ''}">儲值金扣款</button>
          </div>
          <div id="balance-warn"></div>
        </div>

        <div class="field">
          <div class="field-label">這次來的皮膚狀況</div>
          <textarea id="f-skin" rows="3" placeholder="這次觀察到的膚況">${draft?.skin_condition ?? visit?.skin_condition ?? ''}</textarea>
        </div>

        <div class="field">
          <div class="field-label">備註(下次要注意的事項)</div>
          <textarea id="f-note" rows="3" placeholder="下次要注意的事項">${draft?.next_visit_note ?? visit?.next_visit_note ?? ''}</textarea>
        </div>

        <div class="field">
          <div class="field-label">照片</div>
          <div class="photo-grid" id="photo-grid">
            <div class="photo-add" id="photo-add-btn">
              <span>📷</span>
              <span>新增照片</span>
            </div>
          </div>
          <input type="file" id="photo-input" accept="image/*" multiple class="hidden" />
        </div>

        ${isEdit ? `<div style="margin-top:8px;" id="delete-zone"></div>` : ''}
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="save-btn">${isEdit ? '儲存變更' : '下一步'}</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('clientDetail', { clientId });

  const selectedIds = [...selectedServices];
  bindServiceGrid(selectedIds);

  let paymentMethod = draft?.payment_method ?? visit?.payment_method ?? 'cash';
  let clientBalance = null;
  document.querySelectorAll('.pay-chip').forEach((chip) => {
    chip.onclick = () => {
      paymentMethod = chip.dataset.pm;
      document.querySelectorAll('.pay-chip').forEach((c) => {
        c.classList.remove('on');
        c.style.background = '';
      });
      chip.classList.add('on');
      chip.style.background = '#3A332B';
      checkBalanceWarning();
    };
  });

  const amountInput = document.getElementById('f-amount');
  amountInput.addEventListener('input', checkBalanceWarning);

  async function checkBalanceWarning() {
    const warnEl = document.getElementById('balance-warn');
    if (paymentMethod !== 'balance') {
      warnEl.innerHTML = '';
      return;
    }
    if (clientBalance === null) {
      clientBalance = await getClientBalance(clientId);
    }
    const amount = Number(amountInput.value) || 0;
    if (amount > clientBalance) {
      warnEl.innerHTML = `<div class="warn-box">⚠️ 目前儲值餘額只有 $${formatMoney(clientBalance)},這筆會超出餘額,仍可儲存,請自行確認。</div>`;
    } else {
      warnEl.innerHTML = '';
    }
  }
  if (paymentMethod === 'balance') checkBalanceWarning();

  // ---- 照片 ----
  const photoGrid = document.getElementById('photo-grid');
  const photoInput = document.getElementById('photo-input');
  document.getElementById('photo-add-btn').onclick = () => photoInput.click();

  async function renderExistingPhotoThumb(photo) {
    const url = await getSignedUrl('visit-photos', photo.storage_path);
    const wrap = document.createElement('div');
    wrap.className = 'photo-thumb-wrap';
    wrap.dataset.existingId = photo.id;
    wrap.innerHTML = `<img class="photo-thumb" src="${url}" /><div class="photo-remove">✕</div>`;
    wrap.querySelector('.photo-remove').onclick = () => {
      removedPhotoIds.add(photo.id);
      wrap.remove();
    };
    photoGrid.insertBefore(wrap, document.getElementById('photo-add-btn'));
  }
  existingPhotos.forEach((p) => {
    if (!removedPhotoIds.has(p.id)) renderExistingPhotoThumb(p);
  });

  newFiles.forEach((entry) => {
    const wrap = document.createElement('div');
    wrap.className = 'photo-thumb-wrap';
    wrap.innerHTML = `<img class="photo-thumb" src="${entry.previewUrl}" /><div class="photo-remove">✕</div>`;
    wrap.querySelector('.photo-remove').onclick = () => {
      const idx = newFiles.indexOf(entry);
      if (idx >= 0) newFiles.splice(idx, 1);
      wrap.remove();
    };
    photoGrid.insertBefore(wrap, document.getElementById('photo-add-btn'));
  });

  photoInput.addEventListener('change', () => {
    Array.from(photoInput.files).forEach((file) => {
      const previewUrl = URL.createObjectURL(file);
      const entry = { file, previewUrl };
      newFiles.push(entry);
      const wrap = document.createElement('div');
      wrap.className = 'photo-thumb-wrap';
      wrap.innerHTML = `<img class="photo-thumb" src="${previewUrl}" /><div class="photo-remove">✕</div>`;
      wrap.querySelector('.photo-remove').onclick = () => {
        const idx = newFiles.indexOf(entry);
        if (idx >= 0) newFiles.splice(idx, 1);
        wrap.remove();
      };
      photoGrid.insertBefore(wrap, document.getElementById('photo-add-btn'));
    });
    photoInput.value = '';
  });

  // ---- 刪除到店紀錄(僅編輯模式) ----
  if (isEdit) {
    const deleteZone = document.getElementById('delete-zone');
    deleteZone.innerHTML = `<button class="delete-btn" id="delete-visit-btn">刪除這筆到店紀錄</button>`;
    document.getElementById('delete-visit-btn').onclick = () => {
      deleteZone.innerHTML = `
        <div class="confirm-box">
          <div class="confirm-text">確定要刪除這筆到店紀錄嗎?此動作無法復原。</div>
          <div class="confirm-row">
            <button class="confirm-cancel" id="cancel-del">取消</button>
            <button class="confirm-delete" id="confirm-del">確定刪除</button>
          </div>
        </div>
      `;
      document.getElementById('cancel-del').onclick = () => {
        deleteZone.innerHTML = `<button class="delete-btn" id="delete-visit-btn2">刪除這筆到店紀錄</button>`;
        document.getElementById('delete-visit-btn2').onclick = () => document.getElementById('delete-visit-btn').click();
      };
      document.getElementById('confirm-del').onclick = async () => {
        await deleteVisit(visit.id);
        app.navigate('clientDetail', { clientId });
      };
    };
  }

  // ---- 儲存 / 下一步 ----
  const saveBtn = document.getElementById('save-btn');
  saveBtn.onclick = async () => {
    const commonFields = {
      visit_date: document.getElementById('f-date').value || today,
      amount: Number(amountInput.value) || 0,
      payment_method: paymentMethod,
      skin_condition: document.getElementById('f-skin').value.trim(),
      next_visit_note: document.getElementById('f-note').value.trim(),
    };

    saveBtn.disabled = true;

    if (isEdit) {
      saveBtn.textContent = '儲存中...';
      try {
        const fields = { ...commonFields, material_cost: Number(document.getElementById('f-cost').value) || 0 };
        await updateVisit(visit.id, fields, selectedIds);
        for (const photoId of removedPhotoIds) {
          const p = existingPhotos.find((ep) => ep.id === photoId);
          if (p) await deleteVisitPhoto(p.id, p.storage_path);
        }
        for (const entry of newFiles) {
          await uploadVisitPhoto(app.salon.id, clientId, visit.id, entry.file);
        }
        app.navigate('clientDetail', { clientId });
      } catch (err) {
        console.error(err);
        alert('儲存失敗:' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存變更';
      }
      return;
    }

    // 建立模式:不存檔,把目前填的內容當成 draft 帶到下一步
    saveBtn.textContent = '處理中...';
    try {
      const client = await getClient(clientId);
      const nextDraft = { ...commonFields, serviceIds: selectedIds, newFiles: newFiles.map((e) => e.file) };
      const nextView = client.consent_signature_url ? 'visitConfirm' : 'visitConsent';
      app.navigate(nextView, { clientId, draft: nextDraft });
    } catch (err) {
      console.error(err);
      alert('讀取客戶資料失敗:' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = '下一步';
    }
  };
}

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('zh-TW');
}
