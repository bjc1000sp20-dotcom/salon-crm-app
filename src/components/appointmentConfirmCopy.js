import { renderAppointmentConfirmVars } from '../lib/appointmentConfirm.js';
import { listEnabledQuickPhrases } from '../lib/quickPhrases.js';
import { listEnabledStudioImages } from '../lib/studioInfo.js';
import { getSignedUrl } from '../lib/data.js';
import { openStudioInfoViewer } from './studioInfoViewer.js';

// 剪貼簿沒有辦法把「文字＋多張圖片」當一個東西一起貼到 LINE(瀏覽器只能穩定寫入單一種內容),
// 所以誠實拆成兩顆按鈕:【複製文字】一定會成功;【分享到 LINE】只在裝置真的支援分享圖片檔案時才顯示,
// 用系統分享面板把文字+勾選的圖片一起交給 LINE,不會假裝「複製」了圖片。
const SUPPORTS_FILE_SHARE = !!(
  navigator.canShare && navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })
);

// 預約建立/修改後彈出的「複製預約資訊」小視窗,共用給:首頁快速新增、客戶頁新增預約、客戶頁修改預約
// options.onEdit(currentSelectedPhraseIds, currentSelectedImageIds):只有快速新增預約流程會傳,傳了才會多顯示「返回編輯」按鈕
// options.preselectedQuickPhraseIds / options.preselectedStudioImageIds:從「返回編輯」回來時,把上次勾選的內容帶回來繼續勾著
export function openAppointmentConfirmCopyModal(app, { clientName, appointmentDate, appointmentTime, serviceNames }, options = {}) {
  const template = app.salon.appointment_confirm_template || '';
  const baseMessage = renderAppointmentConfirmVars(template, { clientName, appointmentDate, appointmentTime, serviceNames });
  let quickPhrases = [];
  let studioImages = [];
  const selectedPhraseIds = new Set(options.preselectedQuickPhraseIds || []);
  const selectedImageIds = new Set(options.preselectedStudioImageIds || []);
  const imageUrlCache = new Map();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">預約已完成</div>
      <div class="field">
        <div class="field-label">【預約確認訊息】(可直接修改,再複製)</div>
        <textarea id="appt-confirm-preview" rows="6" placeholder="尚未設定話術,可到設定頁「預約確認話術設定」新增,或直接在這裡打字">${escapeHtml(baseMessage)}</textarea>
      </div>
      <div class="field">
        <div class="field-label">加入常用話語</div>
        <div id="appt-quick-phrases-list" class="field-hint">載入中...</div>
      </div>
      <div class="field">
        <div class="field-label">工作室資訊圖片(這次要一起傳的打勾)</div>
        <div id="appt-studio-images-list" class="field-hint">載入中...</div>
      </div>
      ${options.onEdit ? `<button type="button" class="secondary-btn" id="appt-confirm-edit-btn" style="margin-top:6px;">返回編輯</button>` : ''}
      <button class="primary-btn" id="appt-confirm-copy-btn" style="margin-top:6px;">【複製文字】</button>
      <div id="appt-confirm-copied" style="display:none;color:#4E8B5C;font-size:13px;margin-top:8px;text-align:center;">文字已複製,可以直接貼到 LINE</div>
      ${
        SUPPORTS_FILE_SHARE
          ? `<button type="button" class="secondary-btn" id="appt-confirm-share-btn" style="margin-top:8px;">分享到 LINE</button>
             <div id="appt-confirm-shared" style="display:none;color:#4E8B5C;font-size:13px;margin-top:8px;text-align:center;"></div>`
          : `<div class="field-hint" style="margin-top:8px;">此裝置無法一次分享圖片,請點下方縮圖個別查看/儲存後手動傳送。</div>`
      }
      <button class="secondary-btn" id="appt-confirm-close-btn" style="margin-top:10px;">關閉</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const textarea = document.getElementById('appt-confirm-preview');

  function rebuildMessage() {
    const extras = quickPhrases.filter((p) => selectedPhraseIds.has(p.id)).map((p) => p.content);
    textarea.value = [baseMessage, ...extras].filter(Boolean).join('\n');
  }
  if (selectedPhraseIds.size) rebuildMessage();

  document.getElementById('appt-confirm-close-btn').onclick = () => overlay.remove();
  document.getElementById('appt-confirm-copy-btn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      document.getElementById('appt-confirm-copied').style.display = 'block';
    } catch (err) {
      alert('複製失敗:' + err.message);
    }
  };

  const shareBtn = document.getElementById('appt-confirm-share-btn');
  if (shareBtn) {
    shareBtn.onclick = async () => {
      const selectedImages = studioImages
        .filter((im) => selectedImageIds.has(im.id))
        .sort((a, b) => a.sort_order - b.sort_order);
      shareBtn.disabled = true;
      shareBtn.textContent = '準備中...';
      try {
        const files = await Promise.all(
          selectedImages.map(async (im) => {
            const url = imageUrlCache.get(im.id) || (await getSignedUrl('studio-info', im.storage_path));
            const res = await fetch(url);
            const blob = await res.blob();
            return new File([blob], `${im.name || 'studio-info'}.jpg`, { type: blob.type || 'image/jpeg' });
          })
        );
        const shareData = { text: textarea.value };
        if (files.length) shareData.files = files;
        await navigator.share(shareData);
        const sharedEl = document.getElementById('appt-confirm-shared');
        sharedEl.textContent = files.length ? '文字與圖片已準備完成,已透過分享送出' : '文字已透過分享送出';
        sharedEl.style.display = 'block';
      } catch (err) {
        if (err.name !== 'AbortError') alert('分享失敗:' + err.message);
      }
      shareBtn.disabled = false;
      shareBtn.textContent = '分享到 LINE';
    };
  }

  const editBtn = document.getElementById('appt-confirm-edit-btn');
  if (editBtn) {
    editBtn.onclick = () => {
      overlay.remove();
      options.onEdit(Array.from(selectedPhraseIds), Array.from(selectedImageIds));
    };
  }

  listEnabledQuickPhrases(app.salon.id)
    .then((phrases) => {
      quickPhrases = phrases;
      const listEl = document.getElementById('appt-quick-phrases-list');
      if (!phrases.length) {
        listEl.textContent = '尚未設定常用話語,可到設定頁「常用話語管理」新增';
        return;
      }
      listEl.innerHTML = phrases
        .map(
          (p) => `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <input type="checkbox" class="appt-quick-phrase-check" data-id="${p.id}" ${selectedPhraseIds.has(p.id) ? 'checked' : ''} />
          <span>${escapeHtml(p.name)}</span>
        </label>`
        )
        .join('');
      listEl.querySelectorAll('.appt-quick-phrase-check').forEach((cb) => {
        cb.onchange = () => {
          if (cb.checked) selectedPhraseIds.add(cb.dataset.id);
          else selectedPhraseIds.delete(cb.dataset.id);
          rebuildMessage();
        };
      });
      if (selectedPhraseIds.size) rebuildMessage();
    })
    .catch((err) => {
      document.getElementById('appt-quick-phrases-list').textContent = '常用話語讀取失敗:' + err.message;
    });

  listEnabledStudioImages(app.salon.id)
    .then((images) => {
      studioImages = images;
      if (!options.preselectedStudioImageIds) {
        images.filter((im) => im.default_selected).forEach((im) => selectedImageIds.add(im.id));
      }
      const listEl = document.getElementById('appt-studio-images-list');
      if (!images.length) {
        listEl.textContent = '尚未在設定頁上傳工作室資訊圖片';
        return;
      }
      listEl.innerHTML = images
        .map(
          (im) => `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <input type="checkbox" class="appt-studio-image-check" data-id="${im.id}" ${selectedImageIds.has(im.id) ? 'checked' : ''} />
          <img class="appt-studio-image-thumb" data-id="${im.id}" src="" style="width:44px;height:44px;border-radius:8px;object-fit:cover;background:#EFE9DA;cursor:pointer;flex-shrink:0;" />
          <span>${escapeHtml(im.name || '(未命名)')}</span>
        </label>`
        )
        .join('');
      listEl.querySelectorAll('.appt-studio-image-check').forEach((cb) => {
        cb.onchange = () => {
          if (cb.checked) selectedImageIds.add(cb.dataset.id);
          else selectedImageIds.delete(cb.dataset.id);
        };
      });
      images.forEach((im) => {
        getSignedUrl('studio-info', im.storage_path)
          .then((url) => {
            imageUrlCache.set(im.id, url);
            const thumb = listEl.querySelector(`.appt-studio-image-thumb[data-id="${im.id}"]`);
            if (thumb) thumb.src = url;
          })
          .catch(() => {});
      });
      listEl.querySelectorAll('.appt-studio-image-thumb').forEach((thumbEl) => {
        thumbEl.onclick = async () => {
          const resolved = await Promise.all(
            images.map(async (im) => ({
              name: im.name,
              url: imageUrlCache.get(im.id) || (await getSignedUrl('studio-info', im.storage_path)),
            }))
          );
          const idx = images.findIndex((im) => im.id === thumbEl.dataset.id);
          openStudioInfoViewer(resolved, idx);
        };
      });
    })
    .catch((err) => {
      document.getElementById('appt-studio-images-list').textContent = '工作室圖片讀取失敗:' + err.message;
    });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
