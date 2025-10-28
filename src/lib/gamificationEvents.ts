import { supabase } from './supabase';

export type GamificationEventType =
  | 'replay_review'
  | 'journal_entry';

interface AwardXpOptions {
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function awardXpEvent(
  userId: string,
  eventType: GamificationEventType,
  xpValue: number,
  options: AwardXpOptions = {}
): Promise<void> {
  if (!userId || xpValue <= 0) {
    return;
  }

  const { referenceId = null, metadata = {} } = options;

  try {
    if (referenceId) {
      const { data: existing, error: lookupError } = await supabase
        .from('gamification_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', eventType)
        .eq('reference_id', referenceId)
        .maybeSingle();

      if (lookupError && lookupError.code !== 'PGRST116') {
        console.error('Failed to verify existing gamification event:', lookupError);
        return;
      }

      if (existing) {
        return;
      }
    }

    const { error } = await supabase.from('gamification_events').insert({
      user_id: userId,
      event_type: eventType,
      xp_value: xpValue,
      reference_id: referenceId,
      metadata,
    });

    if (error) {
      console.error('Failed to record gamification event:', error);
    }
  } catch (err) {
    console.error('Unexpected error awarding XP event:', err);
  }
}
