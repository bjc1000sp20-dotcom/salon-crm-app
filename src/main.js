import './styles/theme.css';
import { supabase } from './supabaseClient.js';
import { ensureSalon, signOutUser } from './lib/auth.js';

import { renderLogin } from './pages/login.js';
import { renderRegister } from './pages/register.js';
import { renderResetPassword } from './pages/resetPassword.js';
import { renderClientList } from './pages/clientList.js';
import { renderClientDetail } from './pages/clientDetail.js';
import { renderClientForm } from './pages/clientForm.js';
import { renderVisitForm } from './pages/visitForm.js';
import { renderVisitConsent } from './pages/visitConsent.js';
import { renderVisitConfirm } from './pages/visitConfirm.js';
import { renderVisitMaterialCost } from './pages/visitMaterialCost.js';
import { renderLedger } from './pages/ledger.js';
import { renderRevenue } from './pages/revenue.js';
import { renderProductSales } from './pages/productSales.js';
import { renderPackages } from './pages/packages.js';
import { renderSettings } from './pages/settings.js';

const root = document.getElementById('app');

// 整個 App 唯一的狀態機,沿用原型的手刻路由風格,只是拆成多個檔案。
const app = {
  root,
  session: null,
  salon: null,
  view: 'loading', // loading | login | register | clientList | clientDetail | clientForm | visitForm | ledger | revenue
  params: {},
  tab: 'clients', // clients | revenue

  navigate(view, params = {}) {
    this.view = view;
    this.params = params;
    this.render();
  },

  async signOut() {
    await signOutUser();
    this.session = null;
    this.salon = null;
    this.navigate('login');
  },

  render() {
    root.innerHTML = '';
    switch (this.view) {
      case 'login':
        return renderLogin(this);
      case 'register':
        return renderRegister(this);
      case 'resetPassword':
        return renderResetPassword(this);
      case 'clientList':
        return renderClientList(this);
      case 'clientDetail':
        return renderClientDetail(this);
      case 'clientForm':
        return renderClientForm(this);
      case 'visitForm':
        return renderVisitForm(this);
      case 'visitConsent':
        return renderVisitConsent(this);
      case 'visitConfirm':
        return renderVisitConfirm(this);
      case 'visitMaterialCost':
        return renderVisitMaterialCost(this);
      case 'ledger':
        return renderLedger(this);
      case 'revenue':
        return renderRevenue(this);
      case 'productSales':
        return renderProductSales(this);
      case 'packages':
        return renderPackages(this);
      case 'settings':
        return renderSettings(this);
      default:
        root.innerHTML = '<div style="padding:40px;text-align:center;color:#9B8F7F;">載入中...</div>';
    }
  },
};

window.app = app; // 方便除錯用,production 不影響功能

async function bootstrap() {
  const { data } = await supabase.auth.getSession();
  app.session = data.session;

  supabase.auth.onAuthStateChange((event, session) => {
    app.session = session;
    if (event === 'PASSWORD_RECOVERY') {
      app.navigate('resetPassword');
      return;
    }
    if (!session) {
      app.salon = null;
      app.navigate('login');
    }
  });

  if (!app.session) {
    app.navigate('login');
    return;
  }

  try {
    app.salon = await ensureSalon(app.session.user.id);
  } catch (err) {
    console.error('建立/讀取 salon 失敗', err);
  }
  app.navigate('clientList');
}

bootstrap();
