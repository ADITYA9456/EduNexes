'use client';

import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
    HiBan,
    HiCheckCircle,
    HiClock,
    HiCode,
    HiExclamation,
    HiEye,
    HiRefresh,
    HiShieldCheck,
    HiTrendingUp,
    HiUsers,
    HiVideoCamera,
    HiXCircle
} from 'react-icons/hi';

const TABS = [
  { key: 'overview', label: 'Overview', icon: HiTrendingUp },
  { key: 'videos', label: 'Pending Videos', icon: HiVideoCamera },
  { key: 'reports', label: 'Reports', icon: HiExclamation },
  { key: 'users', label: 'Users', icon: HiUsers },
  { key: 'ai-logs', label: 'AI Logs', icon: HiShieldCheck },
];

export default function AdminPage() {
  const supabase = createClient();
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState({});
  const [pendingVideos, setPendingVideos] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [aiLogs, setAiLogs] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Stats
    const [
      { count: totalUsers },
      { count: totalVideos },
      { count: pendingCount },
      { count: totalProblems },
      { count: totalSubs },
      { count: openReports },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('videos').select('*', { count: 'exact', head: true }),
      supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('coding_problems').select('*', { count: 'exact', head: true }),
      supabase.from('submissions').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    setStats({ totalUsers, totalVideos, pendingCount, totalProblems, totalSubs, openReports });

    // Pending Videos
    const { data: pv } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingVideos(pv || []);

    // Reports
    const { data: reps } = await supabase
      .from('reports')
      .select('*, videos(title, youtube_id), profiles(full_name, username)')
      .order('created_at', { ascending: false })
      .limit(50);
    setReports(reps || []);

    // Users
    const { data: u } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setUsers(u || []);

    // AI Logs
    const { data: logs } = await supabase
      .from('ai_verification_logs')
      .select('*, videos(title, youtube_id)')
      .order('created_at', { ascending: false })
      .limit(50);
    setAiLogs(logs || []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/home');
      return;
    }
    loadData();
  }, [isAdmin, router, loadData]);

  const handleVideoAction = async (videoId, action) => {
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase.from('videos').update({ status }).eq('id', videoId);
      if (error) throw error;
      toast.success(`Video ${status}`);
      setPendingVideos((prev) => prev.filter((v) => v.id !== videoId));
      setStats((s) => ({ ...s, pendingCount: Math.max(0, (s.pendingCount || 0) - 1) }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleReportAction = async (reportId, action) => {
    try {
      const { error } = await supabase.from('reports').update({ status: action }).eq('id', reportId);
      if (error) throw error;
      toast.success(`Report ${action}`);
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: action } : r));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleBanUser = async (userId, banned) => {
    try {
      const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
      if (error) throw error;
      toast.success(banned ? 'User banned' : 'User unbanned');
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, banned } : u));
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="admin animate-fade-in">
      <div className="admin__header">
        <h1><HiShieldCheck size={28} /> Admin Panel</h1>
        <button className="btn btn--ghost btn--sm" onClick={loadData}>
          <HiRefresh size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-sm" style={{ marginBottom: 'var(--space-xl)', overflowX: 'auto' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`btn btn--sm ${tab === key ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setTab(key)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <>
          {/* Overview */}
          {tab === 'overview' && (
            <div className="admin__stats" style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--space-md)',
            }}>
              {[
                { icon: HiUsers, label: 'Total Users', value: stats.totalUsers || 0, color: 'var(--accent)' },
                { icon: HiVideoCamera, label: 'Total Videos', value: stats.totalVideos || 0, color: 'var(--success)' },
                { icon: HiClock, label: 'Pending Videos', value: stats.pendingCount || 0, color: 'var(--warning)' },
                { icon: HiCode, label: 'Problems', value: stats.totalProblems || 0, color: 'var(--info)' },
                { icon: HiTrendingUp, label: 'Submissions', value: stats.totalSubs || 0, color: 'var(--secondary-accent)' },
                { icon: HiExclamation, label: 'Open Reports', value: stats.openReports || 0, color: 'var(--danger)' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="card text-center">
                  <Icon size={28} color={color} />
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color, marginTop: 'var(--space-xs)' }}>{value}</div>
                  <div className="text-sm text-muted">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pending Videos */}
          {tab === 'videos' && (
            pendingVideos.length === 0 ? (
              <EmptyState icon={<HiCheckCircle size={48} />} title="All clear!" message="No pending videos to review." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {pendingVideos.map((v) => (
                  <div key={v.id} className="card">
                    <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
                      {v.thumbnail_url && (
                        <img
                          src={v.thumbnail_url}
                          alt=""
                          style={{ width: 180, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <h4 style={{ marginBottom: 'var(--space-xs)' }}>{v.title}</h4>
                        <p className="text-sm text-muted">{v.channel_title} • {v.category}</p>
                        <p className="text-sm" style={{ marginTop: 'var(--space-xs)', color: 'var(--text-secondary)' }}>
                          {v.description?.slice(0, 200)}
                        </p>
                        <div className="flex gap-sm" style={{ marginTop: 'var(--space-md)' }}>
                          <a
                            href={`https://youtube.com/watch?v=${v.youtube_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn--ghost btn--sm"
                          >
                            <HiEye size={14} /> Preview
                          </a>
                          <button className="btn btn--primary btn--sm" onClick={() => handleVideoAction(v.id, 'approve')}>
                            <HiCheckCircle size={14} /> Approve
                          </button>
                          <button className="btn btn--danger btn--sm" onClick={() => handleVideoAction(v.id, 'reject')}>
                            <HiXCircle size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Reports */}
          {tab === 'reports' && (
            reports.length === 0 ? (
              <EmptyState icon={<HiCheckCircle size={48} />} title="No reports" message="All clear!" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {reports.map((r) => (
                  <div key={r.id} className="card" style={{ padding: 'var(--space-md)' }}>
                    <div className="flex-between" style={{ flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                      <div>
                        <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                          <span className="badge" style={{
                            background: r.status === 'pending' ? 'var(--warning)22' : 'var(--success)22',
                            color: r.status === 'pending' ? 'var(--warning)' : 'var(--success)',
                          }}>
                            {r.status}
                          </span>
                          <strong>{r.videos?.title || 'Video'}</strong>
                        </div>
                        <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                          Reason: {r.reason} • By: {r.profiles?.full_name || 'User'} • {new Date(r.created_at).toLocaleDateString()}
                        </p>
                        {r.description && <p className="text-sm" style={{ marginTop: 4 }}>{r.description}</p>}
                      </div>
                      {r.status === 'pending' && (
                        <div className="flex gap-sm">
                          <button className="btn btn--ghost btn--sm" onClick={() => handleReportAction(r.id, 'dismissed')}>Dismiss</button>
                          <button className="btn btn--danger btn--sm" onClick={() => handleReportAction(r.id, 'resolved')}>Resolve</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Users */}
          {tab === 'users' && (
            <div className="leaderboard__table">
              <div className="leaderboard__row leaderboard__row--header">
                <span style={{ flex: 1 }}>User</span>
                <span style={{ width: 100 }}>Role</span>
                <span style={{ width: 80 }}>Points</span>
                <span style={{ width: 120 }}>Joined</span>
                <span style={{ width: 100 }}>Actions</span>
              </div>
              {users.map((u) => (
                <div key={u.id} className="leaderboard__row">
                  <span style={{ flex: 1 }}>
                    <strong>{u.full_name || u.username || 'User'}</strong>
                    {u.banned && <span className="badge" style={{ marginLeft: 8, background: 'var(--danger)22', color: 'var(--danger)' }}>Banned</span>}
                  </span>
                  <span style={{ width: 100 }}>
                    <span className="badge">{u.role || 'user'}</span>
                  </span>
                  <span style={{ width: 80 }}>{u.total_points || 0}</span>
                  <span style={{ width: 120, fontSize: '0.8rem' }}>{new Date(u.created_at).toLocaleDateString()}</span>
                  <span style={{ width: 100 }}>
                    <button
                      className={`btn btn--sm ${u.banned ? 'btn--ghost' : 'btn--danger'}`}
                      onClick={() => handleBanUser(u.id, !u.banned)}
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    >
                      <HiBan size={12} /> {u.banned ? 'Unban' : 'Ban'}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* AI Logs */}
          {tab === 'ai-logs' && (
            aiLogs.length === 0 ? (
              <EmptyState icon={<HiShieldCheck size={48} />} title="No logs" message="No AI verification logs yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {aiLogs.map((log) => (
                  <div key={log.id} className="card" style={{ padding: 'var(--space-md)' }}>
                    <div className="flex-between">
                      <div>
                        <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                          {log.is_educational ?
                            <HiCheckCircle size={16} color="var(--success)" /> :
                            <HiXCircle size={16} color="var(--danger)" />
                          }
                          <strong>{log.videos?.title || log.video_title || 'Video'}</strong>
                        </div>
                        <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                          Confidence: {Math.round((log.confidence_score || 0) * 100)}%
                          • Provider: {log.ai_provider || 'mock'}
                          • {new Date(log.created_at).toLocaleString()}
                        </p>
                        {log.reason && <p className="text-sm" style={{ marginTop: 4 }}>{log.reason}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
