'use client';

import CountdownTimer from '@/components/ui/CountdownTimer';
import { useAuth } from '@/context/AuthProvider';
import { CODING } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
    HiCheckCircle,
    HiChevronLeft,
    HiClock,
    HiCode,
    HiLightningBolt,
    HiPlay,
    HiXCircle
} from 'react-icons/hi';
import { HiTrophy } from 'react-icons/hi2';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const DIFF_COLORS = { easy: 'var(--success)', medium: 'var(--warning)', hard: 'var(--danger)' };

export default function ContestDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();

  const [contest, setContest] = useState(null);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  // Problem solving state
  const [activeProblem, setActiveProblem] = useState(null);
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [view, setView] = useState('problems'); // problems | leaderboard

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Fetch contest
      const { data: c } = await supabase
        .from('contests')
        .select('*')
        .eq('id', id)
        .single();

      if (c) {
        setContest(c);

        // Fetch contest problems
        const { data: cp } = await supabase
          .from('contest_problems')
          .select('*, coding_problems(*)')
          .eq('contest_id', id)
          .order('order_index');

        setProblems((cp || []).map((item) => ({
          ...item.coding_problems,
          points: item.points,
          order_index: item.order_index,
        })));

        // Fetch leaderboard
        const { data: lb } = await supabase
          .from('leaderboard_entries')
          .select('*, profiles(full_name, username, avatar_url)')
          .eq('contest_id', id)
          .order('score', { ascending: false })
          .order('last_submission_at', { ascending: true });

        setLeaderboard(lb || []);
      }
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  const isActive = contest && new Date() >= new Date(contest.start_time) && new Date() <= new Date(contest.end_time);
  const isEnded = contest && new Date() > new Date(contest.end_time);

  const handleSelectProblem = (prob) => {
    setActiveProblem(prob);
    setCode(prob.starter_code?.[language] || `// Solve: ${prob.title}\n`);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!user) return toast.error('Sign in to submit');
    if (!code.trim()) return toast.error('Write some code first');

    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/coding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: activeProblem.id,
          contestId: id,
          language,
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setResult(data);
      if (data.status === 'accepted') toast.success('Accepted!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!contest) return <div className="loading-container"><p>Contest not found</p></div>;

  return (
    <div className="contest-detail animate-fade-in">
      <button className="btn btn--ghost btn--sm" onClick={() => router.push('/contests')} style={{ marginBottom: 'var(--space-md)' }}>
        <HiChevronLeft size={16} /> Back to Contests
      </button>

      {/* Contest Header */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <h1 style={{ marginBottom: 'var(--space-xs)' }}><HiTrophy size={24} /> {contest.title}</h1>
            <p className="text-muted">{contest.description}</p>
            <div className="flex gap-md text-sm" style={{ marginTop: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
              <span><HiClock size={14} /> {contest.duration_minutes} min</span>
              <span><HiCode size={14} /> {problems.length} problems</span>
            </div>
          </div>
          <div>
            {isActive && (
              <div style={{ textAlign: 'center' }}>
                <p className="text-sm text-muted">Time Remaining</p>
                <CountdownTimer targetDate={contest.end_time} />
              </div>
            )}
            {isEnded && <span className="badge">Ended</span>}
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-sm" style={{ marginBottom: 'var(--space-lg)' }}>
        <button className={`btn btn--sm ${view === 'problems' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setView('problems')}>
          <HiCode size={16} /> Problems
        </button>
        <button className={`btn btn--sm ${view === 'leaderboard' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setView('leaderboard')}>
          <HiTrophy size={16} /> Leaderboard
        </button>
      </div>

      {view === 'leaderboard' ? (
        /* Leaderboard View */
        <div className="leaderboard__table">
          <div className="leaderboard__row leaderboard__row--header">
            <span style={{ width: 50 }}>Rank</span>
            <span style={{ flex: 1 }}>User</span>
            <span style={{ width: 100, textAlign: 'center' }}>Score</span>
            <span style={{ width: 140, textAlign: 'center' }}>Last Submission</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-muted" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>No submissions yet</p>
          ) : (
            leaderboard.map((entry, i) => (
              <div key={entry.id} className="leaderboard__row">
                <span style={{ width: 50, fontWeight: 700 }}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </span>
                <span style={{ flex: 1 }}>
                  <strong>{entry.profiles?.full_name || entry.profiles?.username || 'User'}</strong>
                </span>
                <span style={{ width: 100, textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>
                  {entry.score}
                </span>
                <span style={{ width: 140, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(entry.last_submission_at).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Problems View */
        <div style={{ display: 'grid', gridTemplateColumns: activeProblem ? '300px 1fr' : '1fr', gap: 'var(--space-lg)' }}>
          {/* Problem list sidebar */}
          <div>
            {problems.map((p, i) => (
              <div
                key={p.id}
                className={`card ${activeProblem?.id === p.id ? 'card--active' : ''}`}
                style={{
                  cursor: 'pointer',
                  marginBottom: 'var(--space-sm)',
                  border: activeProblem?.id === p.id ? '1px solid var(--accent)' : undefined,
                }}
                onClick={() => handleSelectProblem(p)}
              >
                <div className="flex-between">
                  <div>
                    <span className="text-sm text-muted">Problem {i + 1}</span>
                    <h4 style={{ margin: '4px 0' }}>{p.title}</h4>
                    <span className="badge" style={{
                      background: `${DIFF_COLORS[p.difficulty]}22`,
                      color: DIFF_COLORS[p.difficulty],
                      fontSize: '0.65rem',
                    }}>
                      {p.difficulty}
                    </span>
                  </div>
                  <span className="text-sm" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    {p.points} pts
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Editor (if problem selected) */}
          {activeProblem && (
            <div>
              <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
                <h3>{activeProblem.title}</h3>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 'var(--space-sm)' }}>{activeProblem.description}</p>
                {activeProblem.examples?.length > 0 && (
                  <div style={{ marginTop: 'var(--space-md)' }}>
                    {activeProblem.examples.map((ex, i) => (
                      <div key={i} style={{ background: 'var(--surface-secondary)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-xs)' }}>
                        <p className="text-sm"><strong>Input:</strong> <code>{ex.input}</code></p>
                        <p className="text-sm"><strong>Output:</strong> <code>{ex.output}</code></p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Editor toolbar */}
              <div className="editor-toolbar">
                <select
                  className="input"
                  value={language}
                  onChange={(e) => { setLanguage(e.target.value); setCode(activeProblem.starter_code?.[e.target.value] || ''); }}
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem' }}
                >
                  {CODING.LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <button className="btn btn--primary btn--sm" onClick={handleSubmit} disabled={submitting || !isActive}>
                  {submitting ? <><HiLightningBolt className="spin" size={14} /> Running...</> : <><HiPlay size={14} /> Submit</>}
                </button>
              </div>

              <div style={{ height: 350, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <MonacoEditor
                  height="100%"
                  language={language === 'cpp' ? 'cpp' : language}
                  value={code}
                  onChange={(val) => setCode(val || '')}
                  theme="vs-dark"
                  options={{
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    padding: { top: 12 },
                    automaticLayout: true,
                    readOnly: !isActive,
                  }}
                />
              </div>

              {/* Result */}
              {result && (
                <div className="card" style={{ marginTop: 'var(--space-md)', border: `1px solid ${result.status === 'accepted' ? 'var(--success)' : 'var(--danger)'}` }}>
                  <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                    {result.status === 'accepted' ? <HiCheckCircle size={20} color="var(--success)" /> : <HiXCircle size={20} color="var(--danger)" />}
                    <strong style={{ color: result.status === 'accepted' ? 'var(--success)' : 'var(--danger)', textTransform: 'capitalize' }}>
                      {result.status}
                    </strong>
                    {result.testResults && (
                      <span className="text-sm text-muted" style={{ marginLeft: 'auto' }}>
                        {result.testResults.passed}/{result.testResults.total} passed
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
