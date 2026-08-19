// 把「到店/購買產品/療程購買與使用/預約/已發送追蹤/備註」全部依日期合併成一條時間軸,
// 純資料合併,不含任何 HTML——排版由呼叫端(clientDetail.js)自己決定怎麼顯示每種事件。
export function buildClientTimeline({ client, visits, productSales, packages, appointments, followUps, notes }) {
  const events = [];

  if (client?.created_at) {
    events.push({ date: client.created_at.slice(0, 10), type: 'client_created' });
  }
  for (const v of visits || []) {
    events.push({ date: v.visit_date, type: 'visit', visit: v });
  }
  for (const p of productSales || []) {
    events.push({ date: p.sale_date, type: 'product', sale: p });
  }
  for (const pkg of packages || []) {
    events.push({ date: pkg.purchase_date, type: 'package_purchase', pkg });
    for (const u of pkg.package_usage || []) {
      events.push({ date: u.used_date, type: 'package_usage', pkg, usage: u });
    }
  }
  for (const a of appointments || []) {
    events.push({ date: a.appointment_date, type: 'appointment', appointment: a });
  }
  for (const f of followUps || []) {
    if (f.status === 'sent' && f.sent_at) {
      events.push({ date: f.sent_at.slice(0, 10), type: 'followup_sent', followUp: f });
    }
  }
  for (const n of notes || []) {
    events.push({ date: n.created_at.slice(0, 10), type: 'note', note: n });
  }

  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
