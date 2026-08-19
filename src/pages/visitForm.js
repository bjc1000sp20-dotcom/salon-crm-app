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
import { PAYMENT_METHODS } from '../lib/paymentMethods.js';
import { listPackagesForClient } from '../lib/packages.js';
import { loadServices } from '../lib/services.js';
import { homeButtonHtml, bindHomeButton } from '../components/homeButton.js';

const VISIT_TYPES = [
  { id: 'consumption', name: '消費' },
  { id: 'consultation', name: '單純諮詢' },
  { id: 'other', name: '其他' },
];

// 建立模式(新增到店紀錄)不會在這一頁直接存檔——填完基本資料後,
// 會先進「同意書」(只有第一次到店才會出現)、「消費確認簽名」,
// 最後才由店主在另一頁輸入材料費、真正寫進資料庫。
// 編輯模式(修改舊紀錄)維持原本單頁直接存檔的做法,不會重跑簽名流程。
export async function renderVisitForm(app) {
  const { mode, clientId, draft } = app.params;
  const isEdit = mode === 'edit';
  await loadServices(app.salon.id, { force: true });
  const visit = isEdit ? await getVisit(app.params.visitId) : null;

  const selectedServices = draft?.serviceIds ?? (visit ? visit.visit_services.map((vs) => vs.service_id) : []);
  const existingPhotos = visit ? visit.visit_photos : [];
  const removedPhotoIds = new Set();
  // newFiles: { file, previewUrl } — 如果是從下一步「上一步」回來的,把 draft 裡的 File 物件還原成縮圖
  const newFiles = (draft?.newFiles || []).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));

  // 順便購買產品/使用療程堂數只在「新增」流程提供(編輯舊紀錄維持原本單頁直接存檔的簡單做法,不重跑這些)
  const allPackages = isEdit ? [] : await listPackagesForClient(clientId);
  const clientPackages = allPackages.filter((p) => p.status === 'active' && p.remaining_sessions > 0);
  let checkoutProducts = draft?.checkoutProducts || [];

  const today = new Date().toISOString().slice(0, 10);

  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">${isEdit ? '編輯到店紀錄' : '新增到店紀錄'}</div>
        ${homeButtonHtml()}
      </div>
      <div class="form-scroll">
        <div class="field">
          <div class="field-label">本次到店類型</div>
          <div class="service-grid">
            ${VISIT_TYPES.map((t) => {
              const current = draft?.visit_type ?? visit?.visit_type ?? 'consumption';
              return `<button type="button" class="service-chip visit-type-chip${current === t.id ? ' on' : ''}" data-vt="${t.id}" style="${current === t.id ? 'background:#3A332B;' : ''}">${t.name}</button>`;
            }).join('')}
          </div>
          <div class="field-hint">選「單純諮詢」或「其他」不會算進本月來客數與營收,只會留下紀錄。</div>
        </div>

        <div class="field">
          <div class="field-label">到店日期</div>
          <input type="date" id="f-date" value="${draft?.visit_date ?? visit?.visit_date ?? today}" />
        </div>

        <div class="field">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="field-label" style="margin-bottom:0;">服務項目(可複選)</div>
            <button type="button" class="link-btn" id="manage-services-btn">管理項目</button>
          </div>
          ${serviceGridHtml(selectedServices)}
        </div>

        <div id="consumption-fields">
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
              ${PAYMENT_METHODS.map((m) => {
                const current = draft?.payment_method ?? visit?.payment_method ?? 'cash';
                return `<button type="button" class="service-chip pay-chip${current === m.id ? ' on' : ''}" data-pm="${m.id}" style="${current === m.id ? 'background:#3A332B;' : ''}">${m.name}</button>`;
              }).join('')}
            </div>
            <div id="balance-warn"></div>
          </div>

          ${
            !isEdit
              ? `<div class="field">
                  <div class="field-label">順便購買產品(選填)</div>
                  <div id="checkout-products-list"></div>
                  <button type="button" class="secondary-btn" id="add-checkout-product-btn" style="margin-top:0;">＋ 新增產品</button>
                </div>`
              : ''
          }

          ${
            !isEdit && clientPackages.length
              ? `<div class="field">
                  <div class="field-label">使用療程堂數(選填)</div>
                  <select id="f-package">
                    <option value="">不使用</option>
                    ${clientPackages.map((p) => `<option value="${p.id}" ${draft?.packageId === p.id ? 'selected' : ''}>${escapeHtml(p.package_name)}(剩餘 ${p.remaining_sessions} 堂)</option>`).join('')}
                  </select>
                </div>`
              : ''
          }
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
  bindHomeButton(app);
  document.getElementById('manage-services-btn').onclick = () =>
    app.navigate('manageServices', { returnTo: { mode, clientId, visitId: app.params.visitId, draft } });

  const selectedIds = [...selectedServices];
  bindServiceGrid(selectedIds);

  let visitType = draft?.visit_type ?? visit?.visit_type ?? 'consumption';
  const consumptionFieldsEl = document.getElementById('consumption-fields');
  function updateConsumptionFieldsVisibility() {
    consumptionFieldsEl.style.display = visitType === 'consumption' ? '' : 'none';
  }
  updateConsumptionFieldsVisibility();
  document.querySelectorAll('.visit-type-chip').forEach((chip) => {
    chip.onclick = () => {
      visitType = chip.dataset.vt;
      document.querySelectorAll('.visit-type-chip').forEach((c) => {
        c.classList.remove('on');
        c.style.background = '';
      });
      chip.classList.add('on');
      chip.style.background = '#3A332B';
      updateConsumptionFieldsVisibility();
    };
  });

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

  // ---- 順便購買產品 / 使用療程堂數(只在新增流程) ----
  if (!isEdit) {
    const productsListEl = document.getElementById('checkout-products-list');
    function renderCheckoutProducts() {
      productsListEl.innerHTML = checkoutProducts.length
        ? checkoutProducts
            .map(
              (p, idx) => `
        <div class="visit-list-row" data-idx="${idx}" style="align-items:flex-start;">
          <div class="vlr-left">
            <div class="vlr-name">${escapeHtml(p.item_name)} × ${p.quantity}</div>
            <div class="vlr-date">成本 $${formatMoney(p.cost)}</div>
          </div>
          <div style="text-align:right;">
            <div class="vlr-amount">$${formatMoney(p.amount)}</div>
            <button type="button" class="btn-ghost remove-checkout-product-btn" data-idx="${idx}" style="margin-top:4px;font-size:12px;padding:4px 10px;">移除</button>
          </div>
        </div>`
            )
            .join('')
        : `<div class="field-hint">還沒有加入產品</div>`;
      productsListEl.querySelectorAll('.remove-checkout-product-btn').forEach((btn) => {
        btn.onclick = () => {
          checkoutProducts.splice(Number(btn.dataset.idx), 1);
          renderCheckoutProducts();
        };
      });
    }
    renderCheckoutProducts();

    document.getElementById('add-checkout-product-btn').onclick = () => {
      openCheckoutProductModal((row) => {
        checkoutProducts.push(row);
        renderCheckoutProducts();
      });
    };
  }

  let selectedPackageId = draft?.packageId || null;
  const packageSelect = document.getElementById('f-package');
  if (packageSelect) {
    packageSelect.onchange = () => {
      selectedPackageId = packageSelect.value || null;
    };
  }

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
    const isConsumption = visitType === 'consumption';
    const commonFields = {
      visit_type: visitType,
      visit_date: document.getElementById('f-date').value || today,
      amount: isConsumption ? Number(amountInput.value) || 0 : 0,
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
      const nextDraft = {
        ...commonFields,
        serviceIds: selectedIds,
        newFiles: newFiles.map((e) => e.file),
        checkoutProducts: isConsumption ? checkoutProducts : [],
        packageId: isConsumption ? selectedPackageId : null,
      };
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

function openCheckoutProductModal(onAdd) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">新增產品</div>
      <div class="field">
        <div class="field-label">品項</div>
        <input type="text" id="cop-item" placeholder="例如:保濕精華液" />
      </div>
      <div class="row-2">
        <div class="field">
          <div class="field-label">售價</div>
          <input type="number" id="cop-amount" min="0" step="1" placeholder="0" />
        </div>
        <div class="field">
          <div class="field-label">成本</div>
          <input type="number" id="cop-cost" min="0" step="1" placeholder="0" />
        </div>
      </div>
      <div class="field">
        <div class="field-label">數量</div>
        <input type="number" id="cop-quantity" min="1" step="1" value="1" />
      </div>
      <button class="primary-btn" id="cop-confirm">加入</button>
      <button class="secondary-btn" id="cop-cancel">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('cop-cancel').onclick = () => overlay.remove();
  document.getElementById('cop-confirm').onclick = () => {
    const item_name = document.getElementById('cop-item').value.trim();
    const amount = Number(document.getElementById('cop-amount').value) || 0;
    const cost = Number(document.getElementById('cop-cost').value) || 0;
    const quantity = Number(document.getElementById('cop-quantity').value) || 1;
    if (!item_name) {
      alert('請輸入品項名稱');
      return;
    }
    onAdd({ item_name, amount, cost, quantity });
    overlay.remove();
  };
}

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('zh-TW');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
