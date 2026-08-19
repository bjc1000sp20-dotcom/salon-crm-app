import { listAllProductSales, deleteProductSale, listUpcomingRepurchases } from '../lib/data.js';
import { openProductSaleModal } from '../components/productSaleModal.js';

export async function renderProductSales(app) {
  app.root.innerHTML = `
    <div class="screen">
      <div class="form-header">
        <button class="icon-btn" id="back-btn">←</button>
        <div class="form-header-title">商品銷售</div>
        <div style="width:38px;"></div>
      </div>
      <div class="list-scroll" style="padding-top:16px;" id="product-sales-list">
        <div style="text-align:center;color:#9B8F7F;padding:40px 0;">載入中...</div>
      </div>
      <div class="form-footer">
        <button class="primary-btn" id="add-product-sale-btn">＋ 新增商品銷售</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').onclick = () => app.navigate('revenue');
  document.getElementById('add-product-sale-btn').onclick = () =>
    openProductSaleModal(app, null, () => loadList(app));

  await loadList(app);
}

async function loadList(app) {
  const listEl = document.getElementById('product-sales-list');
  if (!listEl) return;

  const [sales, repurchases] = await Promise.all([
    listAllProductSales(app.salon.id),
    listUpcomingRepurchases(app.salon.id),
  ]);

  listEl.innerHTML = `
    ${repurchaseSectionHtml(app, repurchases)}
    <div class="section-label">全部銷售紀錄</div>
    ${
      sales.length
        ? sales.map((s) => rowHtml(s)).join('')
        : `<div class="empty-state"><div class="empty-icon">¥</div><div class="empty-title">還沒有商品銷售紀錄</div><div class="empty-body">點下方「＋ 新增商品銷售」開始記錄</div></div>`
    }
  `;

  listEl.querySelectorAll('.ps-delete-btn').forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!window.confirm('確定要刪除這筆商品銷售紀錄嗎?')) return;
      await deleteProductSale(btn.dataset.id);
      await loadList(app);
    };
  });

  listEl.querySelectorAll('.repurchase-row').forEach((row) => {
    row.onclick = () => {
      if (row.dataset.clientId) app.navigate('clientDetail', { clientId: row.dataset.clientId });
    };
  });
}

function repurchaseSectionHtml(app, repurchases) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return `
    <div class="analytics-block">
      <div class="analytics-title">即將回購</div>
      ${
        repurchases.length
          ? repurchases
              .map((s) => {
                const overdue = s.deplete_date < todayStr;
                return `
              <div class="visit-list-row repurchase-row" data-client-id="${s.clients?.id || ''}" style="cursor:${s.clients?.id ? 'pointer' : 'default'};">
                <div class="vlr-left">
                  <div class="vlr-name">${escapeHtml(s.clients?.name || '未指定客戶')}・${escapeHtml(s.item_name)}</div>
                  <div class="vlr-date" style="${overdue ? 'color:#B5533C;' : ''}">${overdue ? '已超過預計用完日' : '預計用完'}:${s.deplete_date}</div>
                </div>
              </div>`;
              })
              .join('')
          : `<div class="empty-body">目前沒有快用完的商品</div>`
      }
    </div>
  `;
}

function rowHtml(s) {
  const profit = Number(s.amount) - Number(s.cost);
  return `
    <div class="visit-list-row" style="align-items:flex-start;">
      <div class="vlr-left">
        <div class="vlr-name">${escapeHtml(s.item_name)}${s.clients?.name ? ` · ${escapeHtml(s.clients.name)}` : ''}</div>
        <div class="vlr-date">${s.sale_date}　成本 $${formatMoney(s.cost)}　淨利 $${formatMoney(profit)}</div>
      </div>
      <div style="text-align:right;">
        <div class="vlr-amount">$${formatMoney(s.amount)}</div>
        <button type="button" class="btn-ghost ps-delete-btn" data-id="${s.id}" style="margin-top:4px;font-size:12px;padding:4px 10px;">刪除</button>
      </div>
    </div>
  `;
}

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('zh-TW');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
