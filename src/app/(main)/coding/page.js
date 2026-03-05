'use client';

import EmptyState from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HiCheckCircle, HiChevronRight, HiCode, HiFilter, HiSearch } from 'react-icons/hi';

const DIFFICULTIES = ['All', 'easy', 'medium', 'hard'];
const DIFF_COLORS = { easy: 'var(--success)', medium: 'var(--warning)', hard: 'var(--danger)' };

export default function CodingPracticePage() {
  const supabase = createClient();
  const router = useRouter();

  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [solvedMap, setSolvedMap] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Fetch problems
      let q = supabase.from('coding_problems').select('*').order('order_index');
      if (difficulty !== 'All') q = q.eq('difficulty', difficulty);
      if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);

      const { data: probs } = await q;
      setProblems(probs || []);

      // Fetch user's accepted submissions
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: subs } = await supabase
          .from('submissions')
          .select('problem_id')
          .eq('user_id', user.id)
          .eq('status', 'accepted');
        const map = {};
        (subs || []).forEach((s) => { map[s.problem_id] = true; });
        setSolvedMap(map);
      }

      setLoading(false);
    }
    load();
  }, [difficulty, search, supabase]);

  return (
    <div className="coding animate-fade-in">
      <div className="coding__header">
        <div>
          <h1><HiCode size={28} /> Coding Practice</h1>
          <p className="text-muted">Sharpen your skills with curated challenges</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="flex gap-md" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="input-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <div style={{ position: 'relative' }}>
              <HiSearch size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                placeholder="Search problems..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 38 }}
              />
            </div>
          </div>
          <div className="flex gap-sm">
            <HiFilter size={18} className="text-muted" />
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                className={`btn btn--sm ${difficulty === d ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setDifficulty(d)}
                style={d !== 'All' && difficulty === d ? { background: DIFF_COLORS[d] } : {}}
              >
                {d === 'All' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
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
            <span style={{ width: 40 }}>#</span>
            <span style={{ flex: 1 }}>Title</span>
            <span style={{ width: 100, textAlign: 'center' }}>Difficulty</span>
            <span style={{ width: 100, textAlign: 'center' }}>Status</span>
            <span style={{ width: 40 }}></span>
          </div>

          {problems.map((p, i) => (
            <div
              key={p.id}
              className="problem-row"
              onClick={() => router.push(`/coding/${p.id}`)}
              role="button"
              tabIndex={0}
            >
              <span style={{ width: 40, color: 'var(--text-muted)' }}>{i + 1}</span>
              <span style={{ flex: 1 }}>
                <strong>{p.title}</strong>
                {p.tags?.length > 0 && (
                  <div className="flex gap-xs" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                    {p.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="badge" style={{ fontSize: '0.65rem' }}>{tag}</span>
                    ))}
                  </div>
                )}
              </span>
              <span style={{ width: 100, textAlign: 'center' }}>
                <span className="badge" style={{
                  background: `${DIFF_COLORS[p.difficulty]}22`,
                  color: DIFF_COLORS[p.difficulty],
                  border: `1px solid ${DIFF_COLORS[p.difficulty]}44`,
                }}>
                  {p.difficulty?.charAt(0).toUpperCase() + p.difficulty?.slice(1)}
                </span>
              </span>
              <span style={{ width: 100, textAlign: 'center' }}>
                {solvedMap[p.id] ? (
                  <HiCheckCircle size={20} color="var(--success)" />
                ) : (
                  <span className="text-muted text-sm">—</span>
                )}
              </span>
              <span style={{ width: 40, color: 'var(--text-muted)' }}>
                <HiChevronRight size={18} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
