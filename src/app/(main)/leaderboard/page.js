'use client';

import EmptyState from '@/components/ui/EmptyState';
import { useRealtimeLeaderboard } from '@/hooks/useRealtime';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState } from 'react';
import { HiFire, HiLightningBolt, HiStar } from 'react-icons/hi';
import { HiTrophy } from 'react-icons/hi2';

export default function LeaderboardPage() {
  const supabase = createClient();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('total_points'); // total_points | problems_solved | current_streak

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, total_points, problems_solved, current_streak, badges')
        .order(sortBy, { ascending: false })
        .limit(100);

      setUsers(data || []);
      setLoading(false);
    }
    load();
  }, [sortBy, supabase]);

  // Live leaderboard updates
  useRealtimeLeaderboard(useCallback((payload) => {
    if (payload.eventType === 'UPDATE' && payload.new) {
      setUsers((prev) => {
        const updated = prev.map((u) => u.id === payload.new.id ? { ...u, ...payload.new } : u);
        return updated.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
      });
    }
  }, [sortBy]));

  const podium = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <div className="leaderboard animate-fade-in">
      <div className="leaderboard__header">
        <h1><HiTrophy size={28} /> Leaderboard</h1>
        <p className="text-muted">Top performers in the community</p>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-sm" style={{ marginBottom: 'var(--space-xl)' }}>
        {[
          { key: 'total_points', label: 'Points', icon: HiStar },
          { key: 'problems_solved', label: 'Solved', icon: HiLightningBolt },
          { key: 'current_streak', label: 'Streak', icon: HiFire },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`btn btn--sm ${sortBy === key ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setSortBy(key)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : users.length === 0 ? (
        <EmptyState icon={<HiTrophy size={48} />} title="No users yet" message="Be the first to earn points!" />
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="leaderboard__podium">
            {[1, 0, 2].map((idx) => {
              const u = podium[idx];
              if (!u) return <div key={idx} />;
              const rank = idx + 1;
              const heights = { 1: 180, 2: 140, 3: 120 };
              const medals = ['🥇', '🥈', '🥉'];

              return (
                <div key={u.id} className="podium-card" style={{ alignSelf: 'flex-end' }}>
                  <div className="podium-avatar" style={{
                    width: rank === 1 ? 80 : 64,
                    height: rank === 1 ? 80 : 64,
                    borderRadius: '50%',
                    background: 'var(--accent-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: rank === 1 ? '1.5rem' : '1.2rem',
                    margin: '0 auto var(--space-sm)',
                    border: rank === 1 ? '3px solid var(--warning)' : '2px solid var(--border)',
                    overflow: 'hidden',
                  }}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (u.full_name || u.username || 'U')[0].toUpperCase()
                    )}
                  </div>
                  <span style={{ fontSize: '1.5rem' }}>{medals[idx]}</span>
                  <h4 style={{ marginBottom: 2 }}>{u.full_name || u.username}</h4>
                  <p className="text-sm" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    {sortBy === 'total_points' && `${u.total_points} pts`}
                    {sortBy === 'problems_solved' && `${u.problems_solved} solved`}
                    {sortBy === 'current_streak' && `${u.current_streak} day streak`}
                  </p>
                  <div className="podium-bar" style={{ height: heights[rank], background: `linear-gradient(180deg, var(--accent) 0%, transparent 100%)`, opacity: 0.15, borderRadius: 'var(--radius-md) var(--radius-md) 0 0', marginTop: 'var(--space-sm)' }} />
                </div>
              );
            })}
          </div>

          {/* Rest of leaderboard */}
          <div className="leaderboard__table" style={{ marginTop: 'var(--space-xl)' }}>
            <div className="leaderboard__row leaderboard__row--header">
              <span style={{ width: 50 }}>Rank</span>
              <span style={{ flex: 1 }}>User</span>
              <span style={{ width: 100, textAlign: 'center' }}>Points</span>
              <span style={{ width: 100, textAlign: 'center' }}>Solved</span>
              <span style={{ width: 100, textAlign: 'center' }}>Streak</span>
              <span style={{ width: 80, textAlign: 'center' }}>Badges</span>
            </div>
            {rest.map((u, i) => (
              <div key={u.id} className="leaderboard__row">
                <span style={{ width: 50, fontWeight: 600 }}>{i + 4}</span>
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden',
                  }}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (u.full_name || u.username || 'U')[0].toUpperCase()
                    )}
                  </div>
                  <strong>{u.full_name || u.username}</strong>
                </span>
                <span style={{ width: 100, textAlign: 'center', fontWeight: 600, color: 'var(--accent)' }}>{u.total_points}</span>
                <span style={{ width: 100, textAlign: 'center' }}>{u.problems_solved}</span>
                <span style={{ width: 100, textAlign: 'center' }}>
                  {u.current_streak > 0 ? <><HiFire size={14} color="var(--warning)" /> {u.current_streak}</> : '—'}
                </span>
                <span style={{ width: 80, textAlign: 'center' }}>{u.badges?.length || 0}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
