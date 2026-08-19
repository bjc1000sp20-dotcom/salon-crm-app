import { supabase } from '../supabaseClient.js';

export async function listNotesForClient(clientId) {
  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createNote(salonId, clientId, userId, body) {
  const { error } = await supabase
    .from('client_notes')
    .insert({ salon_id: salonId, client_id: clientId, created_by: userId, body });
  if (error) throw error;
}

export async function updateNote(id, body) {
  const { error } = await supabase
    .from('client_notes')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteNote(id) {
  const { error } = await supabase.from('client_notes').delete().eq('id', id);
  if (error) throw error;
}
