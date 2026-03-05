'use client';

import { useAuth } from '@/context/AuthProvider';
import { CODING } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiCheckCircle, HiChevronLeft, HiClock, HiCode, HiLightningBolt, HiPlay, HiXCircle } from 'react-icons/hi';

// Lazy-load Monaco so it doesn't break SSR
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const DIFF_COLORS = { easy: 'var(--success)', medium: 'var(--warning)', hard: 'var(--danger)' };

const DEFAULT_CODE = {
  javascript: '// Write your solution here\nfunction solution(input) {\n  \n}\n',
  python: '# Write your solution here\ndef solution(input):\n    pass\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n',
};

const LANG_MONACO = {
  javascript: 'javascript',
  python: 'python',
  cpp: 'cpp',
  java: 'java',
};

export default function ProblemPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(DEFAULT_CODE.javascript);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('description'); // description | submissions
  const [submissions, setSubmissions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('coding_problems')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setProblem(data);
        // Use starter code if available
        if (data.starter_code?.[language]) {
          setCode(data.starter_code[language]);
        }
      }
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  // When language changes, update editor code
  const handleLangChange = (lang) => {
    setLanguage(lang);
    if (problem?.starter_code?.[lang]) {
      setCode(problem.starter_code[lang]);
    } else {
      setCode(DEFAULT_CODE[lang] || '');
    }
    setResult(null);
  };

  // Load user submissions for this problem
  const loadSubmissions = useCallback(async () => {
    if (!user) return;
    setSubsLoading(true);
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('problem_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setSubmissions(data || []);
    setSubsLoading(false);
  }, [id, user, supabase]);

  useEffect(() => {
    if (activeTab === 'submissions') loadSubmissions();
  }, [activeTab, loadSubmissions]);

  const handleSubmit = async () => {
    if (!user) return toast.error('Sign in to submit');
    if (!code.trim()) return toast.error('Write some code first');

    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/coding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: id, language, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setResult(data);
      if (data.status === 'accepted') {
        toast.success('All tests passed!');
      } else {
        toast('Some tests failed', { icon: '⚠️' });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!problem) return <div className="loading-container"><p>Problem not found</p></div>;

  return (
    <div className="problem-detail animate-fade-in">
      {/* Left Panel — Problem */}
      <div className="problem-detail__left">
        <button className="btn btn--ghost btn--sm" onClick={() => router.push('/coding')} style={{ marginBottom: 'var(--space-md)' }}>
          <HiChevronLeft size={16} /> Back to Problems
        </button>

        {/* Tabs */}
        <div className="flex gap-sm" style={{ borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-lg)', paddingBottom: 'var(--space-sm)' }}>
          <button
            className={`btn btn--sm ${activeTab === 'description' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setActiveTab('description')}
          >
            Description
          </button>
          <button
            className={`btn btn--sm ${activeTab === 'submissions' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setActiveTab('submissions')}
          >
            My Submissions
          </button>
        </div>

        {activeTab === 'description' ? (
          <>
            <div className="flex gap-sm" style={{ alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2 style={{ margin: 0 }}>{problem.title}</h2>
              <span className="badge" style={{
                background: `${DIFF_COLORS[problem.difficulty]}22`,
                color: DIFF_COLORS[problem.difficulty],
                border: `1px solid ${DIFF_COLORS[problem.difficulty]}44`,
              }}>
                {problem.difficulty?.charAt(0).toUpperCase() + problem.difficulty?.slice(1)}
              </span>
            </div>

            <div className="problem-description" style={{ lineHeight: 1.8, marginBottom: 'var(--space-xl)' }}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{problem.description}</p>
            </div>

            {/* Examples */}
            {problem.examples?.length > 0 && (
              <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h4>Examples</h4>
                {problem.examples.map((ex, i) => (
                  <div key={i} className="card" style={{ marginBottom: 'var(--space-md)', background: 'var(--surface-secondary)' }}>
                    <p className="text-sm"><strong>Input:</strong> <code>{ex.input}</code></p>
                    <p className="text-sm"><strong>Output:</strong> <code>{ex.output}</code></p>
                    {ex.explanation && <p className="text-sm text-muted"><strong>Explanation:</strong> {ex.explanation}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Constraints */}
            {problem.constraints?.length > 0 && (
              <div>
                <h4>Constraints</h4>
                <ul style={{ paddingLeft: 'var(--space-lg)', color: 'var(--text-secondary)' }}>
                  {problem.constraints.map((c, i) => (
                    <li key={i} className="text-sm" style={{ marginBottom: 4 }}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tags */}
            {problem.tags?.length > 0 && (
              <div className="flex gap-xs" style={{ marginTop: 'var(--space-lg)', flexWrap: 'wrap' }}>
                {problem.tags.map((t) => (
                  <span key={t} className="badge badge--accent">{t}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Submissions tab */
          <div>
            {subsLoading ? (
              <div className="loading-container"><div className="spinner" /></div>
            ) : submissions.length === 0 ? (
              <p className="text-muted">No submissions yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {submissions.map((s) => (
                  <div key={s.id} className="card" style={{ padding: 'var(--space-md)' }}>
                    <div className="flex-between">
                      <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                        {s.status === 'accepted' ?
                          <HiCheckCircle size={18} color="var(--success)" /> :
                          <HiXCircle size={18} color="var(--danger)" />
                        }
                        <strong style={{ color: s.status === 'accepted' ? 'var(--success)' : 'var(--danger)', textTransform: 'capitalize' }}>
                          {s.status}
                        </strong>
                      </div>
                      <div className="flex gap-sm text-sm text-muted">
                        <span>{s.language}</span>
                        <span>•</span>
                        <span>{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {s.execution_time && (
                      <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                        <HiClock size={14} /> {s.execution_time}ms
                        {s.test_results && ` • ${s.test_results.passed || 0}/${s.test_results.total || 0} tests passed`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Panel — Editor */}
      <div className="problem-detail__right">
        {/* Editor toolbar */}
        <div className="editor-toolbar">
          <div className="flex gap-sm" style={{ alignItems: 'center' }}>
            <HiCode size={18} />
            <select
              className="input"
              value={language}
              onChange={(e) => handleLangChange(e.target.value)}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem' }}
            >
              {CODING.LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <><HiLightningBolt className="spin" size={14} /> Running...</>
            ) : (
              <><HiPlay size={14} /> Submit</>
            )}
          </button>
        </div>

        {/* Monaco Editor */}
        <div className="editor-container">
          <MonacoEditor
            height="100%"
            language={LANG_MONACO[language] || 'javascript'}
            value={code}
            onChange={(val) => setCode(val || '')}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 16 },
              lineNumbers: 'on',
              tabSize: 2,
              automaticLayout: true,
              wordWrap: 'on',
            }}
          />
        </div>

        {/* Results Panel */}
        {result && (
          <div className="editor-results">
            <div className="flex-between" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                {result.status === 'accepted' ?
                  <HiCheckCircle size={22} color="var(--success)" /> :
                  <HiXCircle size={22} color="var(--danger)" />
                }
                <strong style={{
                  color: result.status === 'accepted' ? 'var(--success)' : 'var(--danger)',
                  textTransform: 'capitalize', fontSize: '1.1rem',
                }}>
                  {result.status === 'accepted' ? 'Accepted' : 'Wrong Answer'}
                </strong>
              </div>
              {result.executionTime && (
                <span className="text-sm text-muted"><HiClock size={14} /> {result.executionTime}ms</span>
              )}
            </div>

            {/* Test case results */}
            {result.testResults && (
              <div className="text-sm">
                <p style={{ marginBottom: 'var(--space-sm)' }}>
                  <strong>{result.testResults.passed}</strong> / <strong>{result.testResults.total}</strong> tests passed
                </p>
                {result.testResults.details?.map((t, i) => (
                  <div key={i} className="card" style={{ padding: 'var(--space-sm)', marginBottom: 'var(--space-xs)', background: 'var(--surface-secondary)' }}>
                    <div className="flex gap-xs" style={{ alignItems: 'center' }}>
                      {t.passed ?
                        <HiCheckCircle size={14} color="var(--success)" /> :
                        <HiXCircle size={14} color="var(--danger)" />
                      }
                      <span>Test {i + 1}</span>
                    </div>
                    {!t.passed && t.expected !== undefined && (
                      <div style={{ marginTop: 4 }}>
                        <p className="text-muted">Expected: <code>{JSON.stringify(t.expected)}</code></p>
                        <p className="text-muted">Got: <code>{JSON.stringify(t.actual)}</code></p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
