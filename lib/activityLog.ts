import { getSupabaseBrowserClient } from '@/utils/supabase';

export type ActivityActionType =
  | 'expense_added'
  | 'payment_sent'
  | 'payment_received'
  | 'split_equally'
  | 'split_customized'
  | 'receipt_scanned'
  | 'participant_added'
  | 'participant_removed'
  | 'room_created'
  | string;

export type ActivityLogRecord = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  action_type: string;
  description: string;
  created_at: string;
};

export async function logActivity(
  userId: string | null,
  sessionId: string | null,
  actionType: ActivityActionType,
  description: string
): Promise<void> {
  const normalizedType = String(actionType ?? '').trim();
  const normalizedDescription = String(description ?? '').trim();
  if (!normalizedType || !normalizedDescription) return;

  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from('activity_logs').insert({
      user_id: userId,
      session_id: sessionId,
      action_type: normalizedType,
      description: normalizedDescription
    });

    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn('Unable to write activity log:', error);
  }
}
