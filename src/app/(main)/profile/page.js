'use client';

import { useAuth } from '@/context/AuthProvider';
import { useStreak } from '@/hooks/useStreak';
import { BADGES } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
    HiCalendar, HiCheckCircle,
    HiCode,
    HiFire,
    HiPencil, HiSave,
    HiStar,
    HiX,
    HiXCircle
} from 'react-icons/hi';
import { HiTrophy } from 'react-icons/hi2';

export default function ProfilePage() {
  const supabase = createClient();
  const { user, profile, updateProfile } = useAuth();
  const { current: currentStreak, longest: longestStreak } = useStreak(user?.id);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '', username: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [recentSubs, setRecentSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [streakDates, setStreakDates] = useState([]);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    async function loadRecent() {
      setSubsLoading(true);
      const { data } = await supabase
        .from('submissions')
        .select('*, coding_problems(title, difficulty)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentSubs(data || []);
      setSubsLoading(false);

      // Load streak dates
      const { data: streaks } = await supabase
        .from('streaks')
        .select('activity_date')
        .eq('user_id', user.id)
        .order('activity_date', { ascending: false })
        .limit(30);
      setStreakDates((streaks || []).map((s) => s.activity_date));
    }
    loadRecent();
  }, [user, supabase]);

  const handleSave = async () => {
    if (!form.full_name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      await updateProfile({
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        bio: form.bio.trim(),
      });
      toast.success('Profile updated');
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="profile animate-fade-in">
        <div className="loading-container"><p>Please sign in to view your profile.</p></div>
      </div>
    );
  }

  const userBadges = profile?.badges || [];
  const allBadges = BADGES.ALL.map((b) => ({ ...b, earned: userBadges.includes(b.id) }));

  // Generate streak calendar (last 30 days)
  const today = new Date();
  const calendarDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().split('T')[0];
    const active = streakDates.includes(dateStr);
    return { date: d, dateStr, active };
  });

  return (
    <div className="profile animate-fade-in">
      {/* Header Card */}
      <div className="card profile__hero">
        <div className="flex gap-lg" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="profile__avatar" style={{
            width: 96, height: 96, borderRadius: '50%',
            background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '2rem',
            overflow: 'hidden', flexShrink: 0,
          }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (profile?.full_name || 'U')[0].toUpperCase()
            )}
          </div>

          <div style={{ flex: 1 }}>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <input className="input" placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                <input className="input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                <textarea className="input" placeholder="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={2} />
                <div className="flex gap-sm">
                  <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
                    <HiSave size={14} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}><HiX size={14} /> Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                  <h2 style={{ margin: 0 }}>{profile?.full_name || 'User'}</h2>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}><HiPencil size={14} /></button>
                </div>
                {profile?.username && <p className="text-muted">@{profile.username}</p>}
                {profile?.bio && <p className="text-sm" style={{ marginTop: 'var(--space-xs)', color: 'var(--text-secondary)' }}>{profile.bio}</p>}
                <p className="text-sm text-muted" style={{ marginTop: 'var(--space-xs)' }}>{user.email}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="profile__stats" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'var(--space-md)', marginBottom: 'var(--space-xl)',
      }}>
        {[
          { icon: HiStar, label: 'Total Points', value: profile?.total_points || 0, color: 'var(--warning)' },
          { icon: HiCode, label: 'Solved', value: profile?.problems_solved || 0, color: 'var(--accent)' },
          { icon: HiFire, label: 'Current Streak', value: `${profile?.current_streak || 0}d`, color: 'var(--danger)' },
          { icon: HiTrophy, label: 'Longest Streak', value: `${profile?.longest_streak || 0}d`, color: 'var(--success)' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card text-center">
            <Icon size={24} color={color} style={{ marginBottom: 'var(--space-xs)' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
            <div className="text-sm text-muted">{label}</div>
          </div>
        ))}
      </div>

      {/* Streak Calendar */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)' }}><HiCalendar size={18} /> Activity (Last 30 Days)</h3>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 28px)',
          gap: 4, justifyContent: 'center',
        }}>
          {calendarDays.map(({ dateStr, active, date }) => (
            <div
              key={dateStr}
              title={`${date.toLocaleDateString()} ${active ? '✓' : ''}`}
              style={{
                width: 24, height: 24, borderRadius: 4,
                background: active ? 'var(--success)' : 'var(--surface-secondary)',
                opacity: active ? 1 : 0.3,
                cursor: 'default',
              }}
            />
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <h3 style={{ marginBottom: 'var(--space-md)' }}><HiTrophy size={18} /> Badges</h3>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 'var(--space-md)',
        }}>
          {allBadges.map((b) => (
            <div
              key={b.id}
              className="text-center"
              style={{ opacity: b.earned ? 1 : 0.3, padding: 'var(--space-sm)' }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 4 }}>{b.icon}</div>
              <div className="text-sm" style={{ fontWeight: b.earned ? 600 : 400 }}>{b.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}><HiCode size={18} /> Recent Submissions</h3>
        {subsLoading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : recentSubs.length === 0 ? (
          <p className="text-muted">No submissions yet. Start solving!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {recentSubs.map((s) => (
              <div key={s.id} className="flex-between" style={{ padding: 'var(--space-sm)', borderBottom: '1px solid var(--border)' }}>
                <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                  {s.status === 'accepted' ?
                    <HiCheckCircle size={16} color="var(--success)" /> :
                    <HiXCircle size={16} color="var(--danger)" />
                  }
                  <span>{s.coding_problems?.title || 'Problem'}</span>
                </div>
                <div className="flex gap-sm text-sm text-muted">
                  <span>{s.language}</span>
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
