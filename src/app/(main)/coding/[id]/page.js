'use client';

import { useAuth } from '@/context/AuthProvider';
import { useRealtimeSubmissions } from '@/hooks/useRealtime';
import { useStreak } from '@/hooks/useStreak';
import { CODING } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
    HiBookmark,
    HiCheckCircle,
    HiChevronLeft,
    HiClock,
    HiCode,
    HiLightBulb,
    HiLightningBolt,
    HiPlay,
    HiXCircle,
} from 'react-icons/hi';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const DIFF_COLORS = { Easy: 'var(--success)', Medium: 'var(--warning)', Hard: 'var(--danger)' };

const DEFAULT_CODE = {
  javascript: '// Write your solution here\nfunction solution(input) {\n  \n}\n',
  python: '# Write your solution here\ndef solution(input):\n    pass\n',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n',
  sql: '-- Write your SQL query here\nSELECT ',
};

const LANG_MONACO = {
  javascript: 'javascript',
  python: 'python',
  java: 'java',
  sql: 'sql',
};

const AI_HINTS = [
  'Think about the data structure that gives you O(1) lookup time.',
  'Consider using a hash map to store previously seen values.',
  'Try breaking the problem into smaller subproblems.',
  'Consider edge cases: empty input, single element, duplicates.',
  'Think about whether a two-pointer approach could work here.',
  'Consider using recursion with memoization.',
  'Draw it out on paper first — visualize the algorithm step by step.',
  'Ask yourself: what is the brute force approach? Can you optimize it?',
];

export default function ProblemPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();
  const { recordActivity } = useStreak(user?.id);

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(DEFAULT_CODE.javascript);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('description');
  const [submissions, setSubmissions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState('');
  const [mcqAnswer, setMcqAnswer] = useState('');
  const [mcqResult, setMcqResult] = useState(null);
  const [testOutput, setTestOutput] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Try slug first, fallback to id
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(id);
      let query;
      if (isUUID) {
        query = supabase.from('coding_problems').select('*').eq('id', id);
      } else {
        query = supabase.from('coding_problems').select('*').eq('slug', id);
      }

      const { data } = await query.single();

      if (data) {
        setProblem(data);
        // Determine available languages
        const starterKeys = Object.keys(data.starter_code || {});
        const defaultLang = starterKeys[0] || (data.type === 'sql' ? 'sql' : 'javascript');
        setLanguage(defaultLang);
        setCode(data.starter_code?.[defaultLang] || DEFAULT_CODE[defaultLang] || '');
      }

      // Check bookmark status
      if (user && data) {
        const { data: bm } = await supabase
          .from('bookmarks')
          .select('id')
          .eq('user_id', user.id)
          .eq('question_id', data.id)
          .single();
        setBookmarked(!!bm);
      }

      setLoading(false);
    }
    load();
  }, [id, supabase, user]);

  const handleLangChange = (lang) => {
    setLanguage(lang);
    if (problem?.starter_code?.[lang]) {
      setCode(problem.starter_code[lang]);
    } else {
      setCode(DEFAULT_CODE[lang] || '');
    }
    setResult(null);
    setTestOutput(null);
  };

  const loadSubmissions = useCallback(async () => {
    if (!user || !problem) return;
    setSubsLoading(true);
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('problem_id', problem.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setSubmissions(data || []);
    setSubsLoading(false);
  }, [problem, user, supabase]);

  useEffect(() => {
    if (activeTab === 'submissions') loadSubmissions();
  }, [activeTab, loadSubmissions]);

  // Realtime submission updates
  useRealtimeSubmissions(user?.id, useCallback((payload) => {
    if (payload.eventType === 'INSERT' && payload.new?.problem_id === problem?.id) {
      setSubmissions((prev) => [payload.new, ...prev]);
    }
  }, [problem?.id]));

  const handleRunCode = async () => {
    if (!code.trim()) return toast.error('Write some code first');
    setRunning(true);
    setTestOutput(null);

    // Mock run — test against first 2 test cases only
    const testCases = (problem?.test_cases || []).slice(0, 2);
    const mockResults = testCases.map((tc) => ({
      input: tc.input,
      expected: tc.expectedOutput || tc.expected_output,
      passed: code.length > 30,
    }));

    await new Promise((r) => setTimeout(r, 800));
    setTestOutput(mockResults);
    setRunning(false);
  };

  const handleSubmit = async () => {
    if (!user) return toast.error('Sign in to submit');
    if (!code.trim() && problem?.type !== 'mcq') return toast.error('Write some code first');

    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/coding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: problem.id, language, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      setResult(data);

      // Update progress
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: problem.id,
          status: data.status === 'accepted' ? 'solved' : 'attempted',
          languageUsed: language,
          score: data.pointsEarned || 0,
          submittedCode: code,
        }),
      });

      if (data.status === 'accepted') {
        toast.success(`All tests passed! +${data.pointsEarned} pts`);
        recordActivity();
      } else {
        toast('Some tests failed', { icon: '⚠️' });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMCQSubmit = async () => {
    if (!user) return toast.error('Sign in to submit');
    if (!mcqAnswer) return toast.error('Select an answer');

    const isCorrect = mcqAnswer === problem.correct_answer;
    setMcqResult({ correct: isCorrect, answer: mcqAnswer, expected: problem.correct_answer });

    const score = isCorrect ? (problem.points || 5) : 0;

    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: problem.id,
        status: isCorrect ? 'solved' : 'attempted',
        languageUsed: 'mcq',
        score,
        submittedCode: mcqAnswer,
      }),
    });

    if (isCorrect) {
      toast.success(`Correct! +${score} pts`);
      recordActivity();
    } else {
      toast.error('Incorrect answer');
    }
  };

  const toggleBookmark = async () => {
    if (!user) return toast.error('Sign in to bookmark');
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: problem.id }),
    });
    const data = await res.json();
    setBookmarked(data.bookmarked);
    toast.success(data.bookmarked ? 'Bookmarked!' : 'Bookmark removed');
  };

  const showAIHint = () => {
    setHint(AI_HINTS[Math.floor(Math.random() * AI_HINTS.length)]);
    setShowHint(true);
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!problem) return <div className="loading-container"><p>Problem not found</p></div>;

  // Get available languages from starter_code
  const availableLangs = Object.keys(problem.starter_code || {});
  const langOptions = availableLangs.length > 0
    ? CODING.LANGUAGES.filter((l) => availableLangs.includes(l.id))
    : CODING.LANGUAGES;

  // MCQ Rendering
  if (problem.type === 'mcq') {
    return (
      <div className="problem-detail--mcq animate-fade-in">
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--space-lg)' }}>
          <button className="btn btn--ghost btn--sm" onClick={() => router.push('/coding')} style={{ marginBottom: 'var(--space-md)' }}>
            <HiChevronLeft size={16} /> Back to Problems
          </button>

          <div className="flex gap-sm" style={{ alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
            <h2 style={{ margin: 0 }}>{problem.title}</h2>
            <span className="badge" style={{
              background: `${DIFF_COLORS[problem.difficulty]}22`,
              color: DIFF_COLORS[problem.difficulty],
            }}>
              {problem.difficulty}
            </span>
            <span className="badge badge--cat">MCQ</span>
            <button className="btn btn--ghost btn--sm" onClick={toggleBookmark} style={{ marginLeft: 'auto' }}>
              <HiBookmark size={18} color={bookmarked ? 'var(--accent-primary)' : 'var(--text-muted)'} />
            </button>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{problem.description}</div>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <h4 style={{ marginBottom: 'var(--space-md)' }}>Choose your answer:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {(problem.mcq_options || []).map((option, i) => {
                const isSelected = mcqAnswer === option;
                const showResult = mcqResult !== null;
                const isCorrect = showResult && option === mcqResult.expected;
                const isWrong = showResult && isSelected && !mcqResult.correct;

                return (
                  <button
                    key={i}
                    className={`mcq-option ${isSelected ? 'mcq-option--selected' : ''} ${isCorrect ? 'mcq-option--correct' : ''} ${isWrong ? 'mcq-option--wrong' : ''}`}
                    onClick={() => { if (!mcqResult) setMcqAnswer(option); }}
                    disabled={!!mcqResult}
                  >
                    <span className="mcq-option__letter">{String.fromCharCode(65 + i)}</span>
                    <span>{option}</span>
                    {isCorrect && <HiCheckCircle size={18} color="var(--success)" style={{ marginLeft: 'auto' }} />}
                    {isWrong && <HiXCircle size={18} color="var(--danger)" style={{ marginLeft: 'auto' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {!mcqResult ? (
            <button className="btn btn--primary" onClick={handleMCQSubmit} disabled={!mcqAnswer}>
              Submit Answer
            </button>
          ) : (
            <div className={`card ${mcqResult.correct ? 'card--success' : 'card--error'}`}>
              <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                {mcqResult.correct ? (
                  <><HiCheckCircle size={22} color="var(--success)" /> <strong style={{ color: 'var(--success)' }}>Correct!</strong></>
                ) : (
                  <><HiXCircle size={22} color="var(--danger)" /> <strong style={{ color: 'var(--danger)' }}>Incorrect</strong> <span className="text-muted">— Answer: {mcqResult.expected}</span></>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Code / SQL / Project Rendering
  return (
    <div className="problem-detail animate-fade-in">
      {/* Left Panel — Problem */}
      <div className="problem-detail__left">
        <button className="btn btn--ghost btn--sm" onClick={() => router.push('/coding')} style={{ marginBottom: 'var(--space-md)' }}>
          <HiChevronLeft size={16} /> Back to Problems
        </button>

        {/* Tabs */}
        <div className="flex gap-sm" style={{ borderBottom: '1px solid var(--border-color)', marginBottom: 'var(--space-lg)', paddingBottom: 'var(--space-sm)' }}>
          {['description', 'submissions'].map((tab) => (
            <button
              key={tab}
              className={`btn btn--sm ${activeTab === tab ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'description' ? 'Description' : 'My Submissions'}
            </button>
          ))}
        </div>

        {activeTab === 'description' ? (
          <>
            <div className="flex gap-sm" style={{ alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>{problem.title}</h2>
              <span className="badge" style={{
                background: `${DIFF_COLORS[problem.difficulty]}22`,
                color: DIFF_COLORS[problem.difficulty],
                border: `1px solid ${DIFF_COLORS[problem.difficulty]}44`,
              }}>
                {problem.difficulty}
              </span>
              <span className="badge badge--cat">{problem.category}</span>
              <span className="text-sm" style={{ color: 'var(--warning)' }}>+{problem.points || 10} pts</span>
              <button className="btn btn--ghost btn--sm" onClick={toggleBookmark} style={{ marginLeft: 'auto', padding: 4 }}>
                <HiBookmark size={18} color={bookmarked ? 'var(--accent-primary)' : 'var(--text-muted)'} />
              </button>
            </div>

            <div className="problem-description" style={{ lineHeight: 1.8, marginBottom: 'var(--space-xl)' }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{problem.description}</div>
            </div>

            {/* Examples */}
            {problem.examples?.length > 0 && (
              <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h4>Examples</h4>
                {problem.examples.map((ex, i) => (
                  <div key={i} className="card" style={{ marginBottom: 'var(--space-md)', background: 'var(--bg-tertiary)' }}>
                    <p className="text-sm"><strong>Input:</strong> <code>{ex.input}</code></p>
                    <p className="text-sm"><strong>Output:</strong> <code>{ex.output}</code></p>
                    {ex.explanation && <p className="text-sm text-muted"><strong>Explanation:</strong> {ex.explanation}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Constraints */}
            {problem.constraints?.length > 0 && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
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
              <div className="flex gap-xs" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
                {problem.tags.map((t) => (
                  <span key={t} className="badge badge--accent">{t}</span>
                ))}
              </div>
            )}

            {/* AI Hint */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <button className="btn btn--secondary btn--sm" onClick={showAIHint}>
                <HiLightBulb size={16} /> AI Hint
              </button>
              {showHint && (
                <div className="card" style={{ marginTop: 'var(--space-sm)', background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent-primary)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>💡 {hint}</p>
                </div>
              )}
            </div>
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
                          {s.status?.replace('_', ' ')}
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
                    {s.points_earned > 0 && (
                      <div className="text-sm" style={{ marginTop: 4, color: 'var(--warning)' }}>
                        +{s.points_earned} points
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
              {langOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-sm">
            <button
              className="btn btn--secondary btn--sm"
              onClick={handleRunCode}
              disabled={running}
            >
              {running ? (
                <><HiLightningBolt className="spin" size={14} /> Running...</>
              ) : (
                <><HiPlay size={14} /> Run Code</>
              )}
            </button>
            <button
              className="btn btn--primary btn--sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <><HiLightningBolt className="spin" size={14} /> Submitting...</>
              ) : (
                <><HiCheckCircle size={14} /> Submit</>
              )}
            </button>
          </div>
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

        {/* Test Output (Run Code) */}
        {testOutput && (
          <div className="editor-results">
            <h4 style={{ marginBottom: 'var(--space-sm)' }}>Test Results (Run)</h4>
            {testOutput.map((t, i) => (
              <div key={i} className="flex gap-sm" style={{ alignItems: 'center', marginBottom: 4 }}>
                {t.passed ? <HiCheckCircle size={16} color="var(--success)" /> : <HiXCircle size={16} color="var(--danger)" />}
                <span className="text-sm">Test {i + 1}: <code>{t.input}</code></span>
                <span className="text-sm text-muted">→ Expected: <code>{t.expected}</code></span>
              </div>
            ))}
          </div>
        )}

        {/* Submit Results */}
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
              <div className="flex gap-md text-sm text-muted">
                {result.executionTime && <span><HiClock size={14} /> {result.executionTime}ms</span>}
                {result.testResults && <span>{result.testResults.passed}/{result.testResults.total} passed</span>}
                {result.pointsEarned > 0 && <span style={{ color: 'var(--warning)', fontWeight: 600 }}>+{result.pointsEarned} pts</span>}
              </div>
            </div>

            {result.testResults?.details?.map((t, i) => (
              <div key={i} className="flex gap-sm" style={{ alignItems: 'center', marginBottom: 4 }}>
                {t.passed ?
                  <HiCheckCircle size={16} color="var(--success)" /> :
                  <HiXCircle size={16} color="var(--danger)" />
                }
                <span className="text-sm">
                  Test {i + 1}: {t.passed ? 'Passed' : 'Failed'}
                </span>
                {!t.passed && t.expected && (
                  <span className="text-sm text-muted"> — Expected: <code>{t.expected}</code></span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
