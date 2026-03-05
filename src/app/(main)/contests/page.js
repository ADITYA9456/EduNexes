'use client';

import CountdownTimer from '@/components/ui/CountdownTimer';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiCalendar, HiChevronRight, HiClock, HiUsers } from 'react-icons/hi';
import { HiTrophy } from 'react-icons/hi2';

function getContestStatus(contest) {
  const now = new Date();
  const start = new Date(contest.start_time);
  const end = new Date(contest.end_time);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'active';
  return 'ended';
}

const STATUS_LABELS = {
  upcoming: { label: 'Upcoming', color: 'var(--warning)', icon: HiClock },
  active: { label: 'Live', color: 'var(--success)', icon: HiTrophy },
  ended: { label: 'Ended', color: 'var(--text-muted)', icon: HiCalendar },
};

export default function ContestsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuth();

  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | active | upcoming | ended

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('contests')
        .select('*, contest_participants(count)')
        .order('start_time', { ascending: false });

      setContests(data || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = contests.filter((c) => {
    if (filter === 'all') return true;
    return getContestStatus(c) === filter;
  });

  const handleJoin = async (contestId) => {
    if (!user) return toast.error('Sign in to join');
    try {
      const { error } = await supabase
        .from('contest_participants')
        .insert({ contest_id: contestId, user_id: user.id });
      if (error) throw error;
      toast.success('Joined contest!');
      router.push(`/contests/${contestId}`);
    } catch (err) {
      if (err.code === '23505') {
        // Already joined
        router.push(`/contests/${contestId}`);
      } else {
        toast.error(err.message);
      }
    }
  };

  return (
    <div className="contests animate-fade-in">
      <div className="contests__header">
        <div>
          <h1><HiTrophy size={28} /> Contests</h1>
          <p className="text-muted">Compete with others and climb the leaderboard</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-sm" style={{ marginBottom: 'var(--space-xl)' }}>
        {['all', 'active', 'upcoming', 'ended'].map((f) => (
          <button
            key={f}
            className={`btn btn--sm ${filter === f ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<HiTrophy size={48} />}
          title="No contests found"
          message={filter === 'all' ? 'No contests have been created yet.' : `No ${filter} contests at the moment.`}
        />
      ) : (
        <div className="contests__grid">
          {filtered.map((contest) => {
            const status = getContestStatus(contest);
            const info = STATUS_LABELS[status];
            const Icon = info.icon;
            const participantCount = contest.contest_participants?.[0]?.count || 0;

            return (
              <div key={contest.id} className="card contest-card" style={{ cursor: 'pointer' }}
                onClick={() => status === 'ended' ? router.push(`/contests/${contest.id}`) : handleJoin(contest.id)}
              >
                <div className="flex-between" style={{ marginBottom: 'var(--space-md)' }}>
                  <span className="badge" style={{
                    background: `${info.color}22`,
                    color: info.color,
                    border: `1px solid ${info.color}44`,
                  }}>
                    <Icon size={12} /> {info.label}
                  </span>
                  <span className="text-sm text-muted">
                    <HiUsers size={14} /> {participantCount}
                  </span>
                </div>

                <h3 style={{ marginBottom: 'var(--space-sm)' }}>{contest.title}</h3>
                <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-md)' }}>
                  {contest.description?.slice(0, 120) || 'No description'}
                </p>

                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p><strong>Duration:</strong> {contest.duration_minutes} min</p>
                  <p><strong>Start:</strong> {new Date(contest.start_time).toLocaleString()}</p>
                </div>

                {status === 'upcoming' && (
                  <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
                    <p className="text-sm text-muted" style={{ marginBottom: 4 }}>Starts in</p>
                    <CountdownTimer targetDate={contest.start_time} />
                  </div>
                )}

                {status === 'active' && (
                  <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
                    <p className="text-sm text-muted" style={{ marginBottom: 4 }}>Ends in</p>
                    <CountdownTimer targetDate={contest.end_time} />
                  </div>
                )}

                <div style={{ marginTop: 'var(--space-md)' }}>
                  <button className={`btn btn--sm ${status === 'active' ? 'btn--primary' : 'btn--secondary'}`} style={{ width: '100%' }}>
                    {status === 'active' ? 'Join Now' : status === 'upcoming' ? 'Register' : 'View Results'}
                    <HiChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
