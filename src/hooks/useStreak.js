'use client';

import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for tracking daily streaks.
 * Reads from profiles and writes to streaks table.
 */
export function useStreak(userId) {
  const supabase = createClient();
  const [streak, setStreak] = useState({ current: 0, longest: 0 });

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('current_streak, longest_streak')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setStreak({ current: data.current_streak, longest: data.longest_streak });
      });
  }, [userId, supabase]);

  const recordActivity = useCallback(async () => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];

    // Upsert today's activity
    await supabase
      .from('streaks')
      .upsert({ user_id: userId, activity_date: today, activity_type: 'solve' }, { onConflict: 'user_id,activity_date' });

    // Recalculate streak
    const { data: activities } = await supabase
      .from('streaks')
      .select('activity_date')
      .eq('user_id', userId)
      .order('activity_date', { ascending: false })
      .limit(365);

    if (!activities || activities.length === 0) return;

    let currentStreak = 1;
    for (let i = 1; i < activities.length; i++) {
      const prev = new Date(activities[i - 1].activity_date);
      const curr = new Date(activities[i].activity_date);
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (diff === 1) currentStreak++;
      else break;
    }

    const longestStreak = Math.max(currentStreak, streak.longest);

    await supabase
      .from('profiles')
      .update({ current_streak: currentStreak, longest_streak: longestStreak, last_active_date: new Date().toISOString() })
      .eq('id', userId);

    setStreak({ current: currentStreak, longest: longestStreak });
  }, [userId, supabase, streak.longest]);

  return { ...streak, recordActivity };
}
