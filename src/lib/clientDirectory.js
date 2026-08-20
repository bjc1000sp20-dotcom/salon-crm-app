import { supabase } from '../supabaseClient.js';

// 全站搜尋／客戶列表篩選用:一次把這家店所有客戶 + 到店/購買/療程/標籤/備註/待追蹤狀態抓回來,
// 在前端組成每位客戶的統計摘要。小型工作室資料量不大,這樣做比為每個篩選條件各寫一支 RPC 簡單很多。
export async function listClientsWithMeta(salonId, { archived = false } = {}) {
  const [
    { data: clients, error: clientsErr },
    { data: visits, error: visitsErr },
    { data: productSales, error: psErr },
    { data: clientTagRows, error: ctErr },
    { data: tags, error: tagsErr },
    { data: pkgRows, error: pkgErr },
    { data: pendingFollowUps, error: fuErr },
    { data: noteRows, error: noteErr },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('salon_id', salonId).eq('archived', archived),
    supabase.from('visits').select('client_id, visit_date, amount, visit_services(service_id)').eq('salon_id', salonId),
    supabase.from('product_sales').select('client_id, amount').eq('salon_id', salonId),
    supabase.from('client_tags').select('client_id, tag_id').eq('salon_id', salonId),
    supabase.from('tags').select('*').eq('salon_id', salonId),
    supabase
      .from('client_packages')
      .select('client_id, status, total_sessions, package_usage(id)')
      .eq('salon_id', salonId),
    supabase.from('follow_ups').select('client_id').eq('salon_id', salonId).eq('status', 'pending'),
    supabase.from('client_notes').select('client_id, body').eq('salon_id', salonId),
  ]);
  const firstError = [clientsErr, visitsErr, psErr, ctErr, tagsErr, pkgErr, fuErr, noteErr].find(Boolean);
  if (firstError) throw firstError;

  const currentYear = new Date().getFullYear();
  const { data: birthdayFollowUps, error: bfuErr } = await supabase
    .from('follow_ups')
    .select('client_id, status')
    .eq('salon_id', salonId)
    .eq('kind', 'birthday')
    .eq('birthday_year', currentYear);
  if (bfuErr) throw bfuErr;

  const thisMonth = new Date().getMonth() + 1;
  const nextMonth = (thisMonth % 12) + 1;
  const tagById = Object.fromEntries(tags.map((t) => [t.id, t]));

  return clients.map((c) => {
    const cVisits = visits.filter((v) => v.client_id === c.id);
    const cProducts = productSales.filter((p) => p.client_id === c.id);
    const cTags = clientTagRows
      .filter((ct) => ct.client_id === c.id)
      .map((ct) => tagById[ct.tag_id])
      .filter(Boolean);
    const cPackages = pkgRows.filter((p) => p.client_id === c.id);
    const activePackages = cPackages.filter(
      (p) => p.status === 'active' && p.total_sessions - p.package_usage.length > 0
    );
    const lastVisitDate = cVisits.reduce((max, v) => (!max || v.visit_date > max ? v.visit_date : max), null);
    const totalSpend =
      cVisits.reduce((sum, v) => sum + Number(v.amount), 0) + cProducts.reduce((sum, p) => sum + Number(p.amount), 0);
    const serviceIds = [...new Set(cVisits.flatMap((v) => (v.visit_services || []).map((vs) => vs.service_id)))];
    const birthMonth = c.birth_date ? Number(c.birth_date.slice(5, 7)) : null;
    const thisYearBirthdayFollowUp = birthdayFollowUps.find((f) => f.client_id === c.id) || null;

    return {
      ...c,
      lastVisitDate,
      daysSinceLastVisit: lastVisitDate
        ? Math.round((Date.now() - new Date(lastVisitDate + 'T00:00:00').getTime()) / 86400000)
        : null,
      totalSpend,
      tags: cTags,
      serviceIds,
      hasPackage: activePackages.length > 0,
      packageRemaining: activePackages.reduce((sum, p) => sum + (p.total_sessions - p.package_usage.length), 0),
      needsFollowUp: pendingFollowUps.some((f) => f.client_id === c.id),
      noteBodies: noteRows.filter((n) => n.client_id === c.id).map((n) => n.body),
      isBirthdayThisMonth: birthMonth === thisMonth,
      isBirthdayNextMonth: birthMonth === nextMonth,
      birthdaySentThisYear: thisYearBirthdayFollowUp?.status === 'sent',
    };
  });
}
