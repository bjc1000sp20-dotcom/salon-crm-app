import { supabase } from '../supabaseClient.js';

function withRemaining(p) {
  const used_sessions = p.package_usage.length;
  return { ...p, used_sessions, remaining_sessions: p.total_sessions - used_sessions };
}

export async function listPackagesForClient(clientId) {
  const { data, error } = await supabase
    .from('client_packages')
    .select('*, package_usage(*)')
    .eq('client_id', clientId)
    .order('purchase_date', { ascending: false });
  if (error) throw error;
  return data.map(withRemaining);
}

export async function createPackage(salonId, clientId, userId, fields) {
  const { error } = await supabase
    .from('client_packages')
    .insert({ salon_id: salonId, client_id: clientId, created_by: userId, ...fields });
  if (error) throw error;
}

export async function updatePackage(id, fields) {
  const { error } = await supabase.from('client_packages').update(fields).eq('id', id);
  if (error) throw error;
}

export async function cancelPackage(id) {
  const { error } = await supabase.from('client_packages').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}

export async function addPackageUsage(salonId, packageId, userId, fields) {
  const { error } = await supabase
    .from('package_usage')
    .insert({ salon_id: salonId, package_id: packageId, created_by: userId, ...fields });
  if (error) throw error;
}

export async function deletePackageUsage(id) {
  const { error } = await supabase.from('package_usage').delete().eq('id', id);
  if (error) throw error;
}

async function listAllActivePackagesWithRemaining(salonId) {
  const { data, error } = await supabase
    .from('client_packages')
    .select('*, clients(id, name), package_usage(id)')
    .eq('salon_id', salonId)
    .eq('status', 'active');
  if (error) throw error;
  return data.map((p) => ({
    ...p,
    used_sessions: p.package_usage.length,
    remaining_sessions: p.total_sessions - p.package_usage.length,
  }));
}

// 剩餘堂數快用完(預設 <= 2 堂,還沒用完但快了)
export async function listLowRemainingPackages(salonId, threshold = 2) {
  const all = await listAllActivePackagesWithRemaining(salonId);
  return all
    .filter((p) => p.remaining_sessions > 0 && p.remaining_sessions <= threshold)
    .sort((a, b) => a.remaining_sessions - b.remaining_sessions);
}

// 有設到期日、還沒用完、且已經到期或快到期(預設 30 天內)的療程
export async function listExpiringPackages(salonId, withinDays = 30) {
  const all = await listAllActivePackagesWithRemaining(salonId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  return all
    .filter((p) => p.expire_date && p.remaining_sessions > 0 && new Date(p.expire_date + 'T00:00:00') <= cutoff)
    .sort((a, b) => (a.expire_date < b.expire_date ? -1 : 1));
}
