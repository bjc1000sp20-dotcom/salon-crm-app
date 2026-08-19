import { supabase } from '../supabaseClient.js';

const DEFAULT_TEMPLATES = [
  { kind: 'aftercare_followup', days_after: 3, label: '3 天後・修復追蹤', message: '嗨～想關心一下這幾天的修復狀況還好嗎?如果有任何狀況,也可以直接傳照片給我看看 😊', sort_order: 1 },
  { kind: 'aftercare_followup', days_after: 7, label: '7 天後・膚況追蹤', message: '嗨～這幾天膚況還好嗎?如果方便的話,可以傳張目前的照片給我,我幫妳看看修復狀況 😊', sort_order: 2 },
  { kind: 'aftercare_followup', days_after: 30, label: '30 天後・回訪提醒', message: '嗨～距離上次保養一段時間了,最近皮膚狀況還穩定嗎?如果想安排下一次保養,也可以直接回覆我 😊', sort_order: 3 },
  { kind: 'appointment_reminder', days_after: 1, label: '預約前 1 天提醒', message: '提醒您即將有預約 😊\n日期:{date}\n時間:{time}\n項目:{service}\n記得準時前往,如需調整時間請提前告知,謝謝。', sort_order: 4 },
  { kind: 'appointment_reminder', days_after: 2, label: '預約前 2 天提醒', message: '提醒您即將有預約 😊\n日期:{date}\n時間:{time}\n項目:{service}\n記得準時前往,如需調整時間請提前告知,謝謝。', sort_order: 5 },
  { kind: 'appointment_reminder', days_after: 3, label: '預約前 3 天提醒', message: '提醒您即將有預約 😊\n日期:{date}\n時間:{time}\n項目:{service}\n記得準時前往,如需調整時間請提前告知,謝謝。', sort_order: 6 },
];

// ---------------- LINE 聯絡人配對 ----------------

export async function listUnmatchedLineContacts() {
  const { data, error } = await supabase
    .from('line_contacts')
    .select('*')
    .is('matched_client_id', null)
    .order('last_event_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function matchLineContact(contactId, lineUserId, clientId, salonId) {
  const { error: clientErr } = await supabase
    .from('clients')
    .update({ line_user_id: lineUserId, line_linked_at: new Date().toISOString() })
    .eq('id', clientId);
  if (clientErr) throw clientErr;

  const { error: contactErr } = await supabase
    .from('line_contacts')
    .update({ matched_client_id: clientId, matched_salon_id: salonId })
    .eq('id', contactId);
  if (contactErr) throw contactErr;
}

export async function getLineContactForClient(lineUserId) {
  if (!lineUserId) return null;
  const { data, error } = await supabase.from('line_contacts').select('*').eq('line_user_id', lineUserId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function unlinkClientLine(clientId) {
  const { error } = await supabase
    .from('clients')
    .update({ line_user_id: null, line_linked_at: null })
    .eq('id', clientId);
  if (error) throw error;
}

// ---------------- 追蹤訊息模板 ----------------

export async function listFollowUpTemplates(salonId) {
  const { data, error } = await supabase
    .from('follow_up_templates')
    .select('*')
    .eq('salon_id', salonId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

// 第一次使用時,幫這家店建立預設的 3 個模板(3/7/30 天),之後都可以自己編輯
export async function ensureDefaultFollowUpTemplates(salonId) {
  const existing = await listFollowUpTemplates(salonId);
  if (existing.length > 0) return existing;

  const rows = DEFAULT_TEMPLATES.map((t) => ({ ...t, salon_id: salonId }));
  const { data, error } = await supabase.from('follow_up_templates').insert(rows).select();
  if (error) throw error;
  return data;
}

export async function updateFollowUpTemplate(id, fields) {
  const { error } = await supabase.from('follow_up_templates').update(fields).eq('id', id);
  if (error) throw error;
}

// ---------------- 追蹤排程(follow_ups) ----------------

export async function listFollowUpsForClient(clientId) {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createFollowUp(salonId, clientId, userId, fields) {
  const { error } = await supabase.from('follow_ups').insert({
    salon_id: salonId,
    client_id: clientId,
    created_by: userId,
    ...fields,
  });
  if (error) throw error;
}

export async function updateFollowUp(id, fields) {
  const { error } = await supabase.from('follow_ups').update(fields).eq('id', id);
  if (error) throw error;
}

export async function cancelFollowUp(id) {
  const { error } = await supabase.from('follow_ups').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}

export function addDaysToToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

export function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

// ---------------- 預約(未來排定的到店時間,獨立於 visits,只用來觸發提醒) ----------------

export async function listAppointmentsForClient(clientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('client_id', clientId)
    .order('appointment_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createAppointment(salonId, clientId, userId, fields) {
  const { data, error } = await supabase
    .from('appointments')
    .insert({ salon_id: salonId, client_id: clientId, created_by: userId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function renderReminderMessage(template, { date, time, service }) {
  return (template || '')
    .replaceAll('{date}', date || '')
    .replaceAll('{time}', time || '')
    .replaceAll('{service}', service || '');
}

// 改期時:把這筆預約底下所有「還沒發送」的預約提醒,依各自的 offset_days 重新算發送日期,
// 並用當初存下的 message_template 重新代入新的日期/時間/項目,避免訊息內容日期沒跟著更新
export async function updateAppointment(id, fields) {
  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (apptErr) throw apptErr;

  if (fields.appointment_date !== undefined || fields.appointment_time !== undefined || fields.service_note !== undefined) {
    const { data: pendingReminders, error: listErr } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('appointment_id', id)
      .eq('status', 'pending');
    if (listErr) throw listErr;

    for (const reminder of pendingReminders || []) {
      if (reminder.offset_days == null) continue;
      const newScheduledAt = addDaysToDate(appt.appointment_date, -reminder.offset_days);
      const newMessage = reminder.message_template
        ? renderReminderMessage(reminder.message_template, {
            date: appt.appointment_date,
            time: appt.appointment_time || '',
            service: appt.service_note || '',
          })
        : reminder.message;
      const { error: updErr } = await supabase
        .from('follow_ups')
        .update({ scheduled_at: newScheduledAt, message: newMessage })
        .eq('id', reminder.id);
      if (updErr) throw updErr;
    }
  }

  return appt;
}

// 取消預約時,把還沒發送的預約提醒一起取消,避免客人收到「明天記得前往」這種已經作廢的訊息
export async function cancelAppointment(id) {
  const { error: apptErr } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
  if (apptErr) throw apptErr;
  const { error: followErr } = await supabase
    .from('follow_ups')
    .update({ status: 'cancelled' })
    .eq('appointment_id', id)
    .eq('status', 'pending');
  if (followErr) throw followErr;
}

// 一次建立:1 筆預約 + 勾選的預約前提醒 + 勾選的既有術後追蹤,每一筆各自獨立寫入 follow_ups,
// 其中一筆失敗或之後被取消,不會影響其他筆
export async function createAppointmentWithReminders(
  salonId,
  clientId,
  userId,
  {
    appointment_date,
    appointment_time,
    service_note,
    deposit_amount,
    deposit_paid,
    deposit_payment_method,
    reminderOffsets = [],
    customReminders = [],
    aftercareTemplateIds = [],
  }
) {
  const appt = await createAppointment(salonId, clientId, userId, {
    appointment_date,
    appointment_time,
    service_note,
    deposit_amount: deposit_amount ?? null,
    deposit_paid: deposit_paid ?? false,
    deposit_payment_method: deposit_payment_method ?? null,
    deposit_paid_at: deposit_paid ? new Date().toISOString() : null,
  });

  const templates = await listFollowUpTemplates(salonId);
  const appointmentTemplates = templates.filter((t) => t.kind === 'appointment_reminder');
  const fallbackMessage =
    '提醒您即將有預約 😊\n日期:{date}\n時間:{time}\n項目:{service}\n記得準時前往,如需調整時間請提前告知,謝謝。';

  for (const days of reminderOffsets) {
    const tpl = appointmentTemplates.find((t) => Number(t.days_after) === Number(days));
    const messageTemplate = tpl ? tpl.message : fallbackMessage;
    const label = tpl ? tpl.label : `預約前 ${days} 天提醒`;
    await createFollowUp(salonId, clientId, userId, {
      kind: 'appointment_reminder',
      appointment_id: appt.id,
      template_id: tpl ? tpl.id : null,
      offset_days: Number(days),
      label,
      message_template: messageTemplate,
      message: renderReminderMessage(messageTemplate, {
        date: appointment_date,
        time: appointment_time || '',
        service: service_note || '',
      }),
      scheduled_at: addDaysToDate(appointment_date, -Number(days)),
    });
  }

  for (const custom of customReminders) {
    const days = Number(custom.offset_days);
    const messageTemplate = custom.message || fallbackMessage;
    await createFollowUp(salonId, clientId, userId, {
      kind: 'appointment_reminder',
      appointment_id: appt.id,
      template_id: null,
      offset_days: days,
      label: `自訂(前 ${days} 天)`,
      message_template: messageTemplate,
      message: renderReminderMessage(messageTemplate, {
        date: appointment_date,
        time: appointment_time || '',
        service: service_note || '',
      }),
      scheduled_at: addDaysToDate(appointment_date, -days),
    });
  }

  for (const templateId of aftercareTemplateIds) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) continue;
    await createFollowUp(salonId, clientId, userId, {
      kind: 'aftercare_followup',
      template_id: tpl.id,
      label: tpl.label,
      message: tpl.message,
      scheduled_at: addDaysToToday(tpl.days_after),
    });
  }

  return appt;
}
