'use client';

import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthProvider';
import { useRealtimeProgress } from '@/hooks/useRealtime';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
    HiBookmark,
    HiCheckCircle,
    HiChevronRight,
    HiCode,
    HiFilter,
    HiFire,
    HiLightningBolt,
    HiSearch,
    HiStar,
} from 'react-icons/hi';

const CATEGORIES = ['All', 'DSA', 'Python', 'Java', 'SQL', 'WebDev'];
const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const TYPES = ['All', 'code', 'mcq', 'sql', 'project'];
const TYPE_LABELS = { code: 'Code', mcq: 'MCQ', sql: 'SQL', project: 'Project' };
const DIFF_COLORS = { Easy: 'var(--success)', Medium: 'var(--warning)', Hard: 'var(--danger)' };
const CAT_ICONS = { DSA: '🧮', Python: '🐍', Java: '☕', SQL: '🗄️', WebDev: '🌐' };

export default function CodingPracticePage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [type, setType] = useState('All');
  const [solvedMap, setSolvedMap] = useState({});
  const [bookmarkSet, setBookmarkSet] = useState(new Set());
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [stats, setStats] = useState({ totalSolved: 0, totalScore: 0, byDifficulty: {} });

  const loadData = useCallback(async () => {
    setLoading(true);

    // Fetch all problems — use select('*') for schema flexibility
    let q = supabase
      .from('coding_problems')
      .select('*')
      .order('order_index', { ascending: true });

    if (category !== 'All') q = q.eq('category', category);
    if (difficulty !== 'All') q = q.eq('difficulty', difficulty);
    if (type !== 'All') q = q.eq('type', type);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);

    const { data: probs, error: probsError } = await q;
    if (probsError) console.warn('Error loading problems:', probsError.message);
    setProblems(probs || []);

    // Fetch user data (gracefully handle missing tables)
    if (user) {
      const [progressRes, bookmarkRes] = await Promise.all([
        supabase
          .from('user_progress')
          .select('question_id, status, score')
          .eq('user_id', user.id)
          .then(r => r)
          .catch(() => ({ data: [] })),
        supabase
          .from('bookmarks')
          .select('question_id')
          .eq('user_id', user.id)
          .then(r => r)
          .catch(() => ({ data: [] })),
      ]);

      const map = {};
      const byDiff = { Easy: 0, Medium: 0, Hard: 0 };
      let totalScore = 0;
      let totalSolved = 0;

      (progressRes.data || []).forEach((p) => {
        if (p.status === 'solved') {
          map[p.question_id] = 'solved';
          totalSolved++;
          totalScore += p.score || 0;
        } else if (!map[p.question_id]) {
          map[p.question_id] = 'attempted';
        }
      });

      // Count difficulty breakdown from solved
      (probs || []).forEach((prob) => {
        if (map[prob.id] === 'solved') {
          byDiff[prob.difficulty] = (byDiff[prob.difficulty] || 0) + 1;
        }
      });

      setSolvedMap(map);
      setStats({ totalSolved, totalScore, byDifficulty: byDiff });
      setBookmarkSet(new Set((bookmarkRes.data || []).map((b) => b.question_id)));
    }

    setLoading(false);
  }, [supabase, category, difficulty, type, search, user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load daily challenge (skip if API not ready)
  useEffect(() => {
    fetch('/api/daily-challenge')
      .then((r) => { if (r.ok) return r.json(); return null; })
      .then((data) => { if (data?.challenge) setDailyChallenge(data.challenge); })
      .catch(() => {});
  }, []);

  // Realtime progress updates
  useRealtimeProgress(user?.id, useCallback(() => {
    loadData();
  }, [loadData]));

  const toggleBookmark = async (e, questionId) => {
    e.stopPropagation();
    if (!user) return toast.error('Sign in to bookmark');

    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId }),
    });
    const data = await res.json();
    if (data.bookmarked) {
      setBookmarkSet((prev) => new Set([...prev, questionId]));
      toast.success('Bookmarked!');
    } else {
      setBookmarkSet((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
      toast.success('Bookmark removed');
    }
  };

  const totalProblems = problems.length;
  const completionPct = totalProblems > 0
    ? Math.round((stats.totalSolved / totalProblems) * 100)
    : 0;

  return (
    <div className="coding animate-fade-in">
      {/* Header */}
      <div className="coding__header">
        <div>
          <h1><HiCode size={28} /> Coding Practice</h1>
          <p className="text-muted">Sharpen your skills with curated challenges across multiple categories</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={`coding__stats-row ${dailyChallenge ? 'coding__stats-row--with-daily' : ''}`}>
        {[
          { icon: HiCheckCircle, label: 'Solved', value: stats.totalSolved, color: 'var(--success)' },
          { icon: HiStar, label: 'Score', value: stats.totalScore, color: 'var(--warning)' },
          { icon: HiFire, label: 'Streak', value: `${profile?.current_streak || 0}d`, color: 'var(--danger)' },
          { icon: HiLightningBolt, label: 'Completion', value: `${completionPct}%`, color: 'var(--accent-primary)' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card coding__stat-card">
            <Icon size={20} color={color} />
            <div className="coding__stat-value" style={{ color }}>{value}</div>
            <div className="coding__stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Daily Challenge (only if available) */}
      {dailyChallenge && (
        <Link href={`/coding/${dailyChallenge.slug || dailyChallenge.id}`} className="card coding__daily-card">
          <div className="coding__daily-badge">🔥 Daily Challenge</div>
          <h3 style={{ margin: '8px 0 4px' }}>{dailyChallenge.title}</h3>
          <div className="flex gap-sm" style={{ alignItems: 'center' }}>
            <span className="badge" style={{
              background: `${DIFF_COLORS[dailyChallenge.difficulty]}22`,
              color: DIFF_COLORS[dailyChallenge.difficulty],
            }}>
              {dailyChallenge.difficulty}
            </span>
            <span className="text-sm text-muted">{dailyChallenge.category}</span>
            <span className="text-sm" style={{ color: 'var(--warning)' }}>+{dailyChallenge.points || 10} pts</span>
          </div>
        </Link>
      )}

      {/* Difficulty Breakdown */}
      {user && stats.totalSolved > 0 && (
        <div className="card coding__progress-bar-card">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <span className="text-sm" style={{ fontWeight: 600 }}>Progress by Difficulty</span>
            <span className="text-sm text-muted">{stats.totalSolved} solved</span>
          </div>
          <div className="coding__progress-bar">
            {stats.byDifficulty.Easy > 0 && (
              <div
                className="coding__progress-segment coding__progress-segment--easy"
                style={{ flex: stats.byDifficulty.Easy }}
                title={`Easy: ${stats.byDifficulty.Easy}`}
              />
            )}
            {stats.byDifficulty.Medium > 0 && (
              <div
                className="coding__progress-segment coding__progress-segment--medium"
                style={{ flex: stats.byDifficulty.Medium }}
                title={`Medium: ${stats.byDifficulty.Medium}`}
              />
            )}
            {stats.byDifficulty.Hard > 0 && (
              <div
                className="coding__progress-segment coding__progress-segment--hard"
                style={{ flex: stats.byDifficulty.Hard }}
                title={`Hard: ${stats.byDifficulty.Hard}`}
              />
            )}
          </div>
          <div className="flex gap-md" style={{ marginTop: 6 }}>
            <span className="text-sm" style={{ color: 'var(--success)' }}>● Easy: {stats.byDifficulty.Easy || 0}</span>
            <span className="text-sm" style={{ color: 'var(--warning)' }}>● Medium: {stats.byDifficulty.Medium || 0}</span>
            <span className="text-sm" style={{ color: 'var(--danger)' }}>● Hard: {stats.byDifficulty.Hard || 0}</span>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="coding__category-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`coding__category-tab ${category === cat ? 'coding__category-tab--active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat !== 'All' && <span>{CAT_ICONS[cat]}</span>}
            {cat}
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="card coding__filters">
        <div className="flex gap-md" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <HiSearch size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
            <input
              className="input"
              placeholder="Search problems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38 }}
            />
          </div>
          <div className="flex gap-sm" style={{ alignItems: 'center' }}>
            <HiFilter size={16} className="text-muted" />
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                className={`btn btn--sm ${difficulty === d ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setDifficulty(d)}
                style={d !== 'All' && difficulty === d ? { background: DIFF_COLORS[d] } : {}}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex gap-sm">
            {TYPES.map((t) => (
              <button
                key={t}
                className={`btn btn--sm ${type === t ? 'btn--secondary' : 'btn--ghost'}`}
                onClick={() => setType(t)}
                style={type === t ? { borderColor: 'var(--accent-primary)' } : {}}
              >
                {TYPE_LABELS[t] || 'All Types'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Problem List */}
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : problems.length === 0 ? (
        <EmptyState
          icon={<HiCode size={48} />}
          title="No problems found"
          message="Try a different search term or filter."
        />
      ) : (
        <div className="coding__problems">
          {/* Table header */}
          <div className="problem-row problem-row--header">
            <span className="problem-row__num">#</span>
            <span className="problem-row__title">Title</span>
            <span className="problem-row__cat">Category</span>
            <span className="problem-row__type">Type</span>
            <span className="problem-row__diff">Difficulty</span>
            <span className="problem-row__pts">Points</span>
            <span className="problem-row__status">Status</span>
            <span className="problem-row__actions"></span>
          </div>

          {problems.map((p, i) => {
            const status = solvedMap[p.id];
            return (
              <div
                key={p.id}
                className={`problem-row ${status === 'solved' ? 'problem-row--solved' : ''}`}
                onClick={() => router.push(`/coding/${p.slug || p.id}`)}
                role="button"
                tabIndex={0}
              >
                <span className="problem-row__num">{i + 1}</span>
                <span className="problem-row__title">
                  <strong>{p.title}</strong>
                  {p.tags?.length > 0 && (
                    <div className="flex gap-xs" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                      {p.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="badge badge--tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </span>
                <span className="problem-row__cat">
                  <span className="badge badge--cat">
                    {CAT_ICONS[p.category] || '📁'} {p.category}
                  </span>
                </span>
                <span className="problem-row__type">
                  <span className="text-sm text-muted">{TYPE_LABELS[p.type] || p.type}</span>
                </span>
                <span className="problem-row__diff">
                  <span className="badge" style={{
                    background: `${DIFF_COLORS[p.difficulty]}22`,
                    color: DIFF_COLORS[p.difficulty],
                    border: `1px solid ${DIFF_COLORS[p.difficulty]}44`,
                  }}>
                    {p.difficulty}
                  </span>
                </span>
                <span className="problem-row__pts">
                  <span className="text-sm" style={{ color: 'var(--warning)', fontWeight: 600 }}>
                    {p.points || 10}
                  </span>
                </span>
                <span className="problem-row__status">
                  {status === 'solved' ? (
                    <HiCheckCircle size={20} color="var(--success)" />
                  ) : status === 'attempted' ? (
                    <span style={{ color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 600 }}>Tried</span>
                  ) : (
                    <span className="text-muted text-sm">—</span>
                  )}
                </span>
                <span className="problem-row__actions">
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={(e) => toggleBookmark(e, p.id)}
                    title={bookmarkSet.has(p.id) ? 'Remove bookmark' : 'Bookmark'}
                    style={{ padding: 4, minWidth: 0 }}
                  >
                    <HiBookmark size={16} color={bookmarkSet.has(p.id) ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                  </button>
                  <HiChevronRight size={16} color="var(--text-muted)" />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
