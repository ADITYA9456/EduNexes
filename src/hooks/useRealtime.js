'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useRef } from 'react';

/**
 * Hook that subscribes to Supabase Realtime changes on a table.
 * Calls onChange when INSERT, UPDATE or DELETE events happen.
 *
 * @param {string} table - Table name to subscribe to
 * @param {function} onChange - Callback with (payload) on changes
 * @param {object} [filter] - Optional filter: { column, value }
 */
export function useRealtimeSubscription(table, onChange, filter = null) {
  const supabase = createClient();
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    let channelConfig = supabase
      .channel(`realtime-${table}-${filter?.value || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
        },
        (payload) => {
          callbackRef.current(payload);
        }
      );

    const channel = channelConfig.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter?.column, filter?.value, supabase]);
}

/**
 * Subscribe to leaderboard changes (profiles table).
 */
export function useRealtimeLeaderboard(onUpdate) {
  useRealtimeSubscription('profiles', onUpdate);
}

/**
 * Subscribe to submission results for a specific user.
 */
export function useRealtimeSubmissions(userId, onUpdate) {
  useRealtimeSubscription(
    'submissions',
    onUpdate,
    userId ? { column: 'user_id', value: userId } : null
  );
}

/**
 * Subscribe to progress updates for a specific user.
 */
export function useRealtimeProgress(userId, onUpdate) {
  useRealtimeSubscription(
    'user_progress',
    onUpdate,
    userId ? { column: 'user_id', value: userId } : null
  );
}
