import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Code submission — runs tests and saves result
export async function POST(request) {
  try {
    const { supabase } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { problemId, contestId, language, code } = await request.json();

    if (!problemId || !code) {
      return NextResponse.json({ error: 'problemId and code are required' }, { status: 400 });
    }

    // Fetch problem
    const { data: problem } = await supabase
      .from('coding_problems')
      .select('*')
      .eq('id', problemId)
      .single();

    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    // If contest submission, verify contest is active
    if (contestId) {
      const { data: contest } = await supabase
        .from('contests')
        .select('start_time, end_time')
        .eq('id', contestId)
        .single();

      if (!contest) {
        return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
      }

      const now = new Date();
      if (now < new Date(contest.start_time) || now > new Date(contest.end_time)) {
        return NextResponse.json({ error: 'Contest is not active' }, { status: 400 });
      }
    }

    // Mock execution
    const startTime = Date.now();
    const testCases = problem.test_cases || [];
    const testResults = mockExecute(code, language, testCases);
    const executionTime = Date.now() - startTime + Math.floor(Math.random() * 50);

    const allPassed = testResults.passed === testResults.total && testResults.total > 0;
    const status = allPassed ? 'accepted' : 'wrong_answer';

    // Points
    const pointsMap = { easy: 10, medium: 25, hard: 50 };
    const pointsEarned = allPassed ? (pointsMap[problem.difficulty] || 10) : 0;

    // Save submission
    const { data: submission } = await supabase
      .from('submissions')
      .insert({
        user_id: user.id,
        problem_id: problemId,
        contest_id: contestId || null,
        language: language || 'javascript',
        code,
        status,
        execution_time: executionTime,
        test_results: testResults,
        points_earned: pointsEarned,
      })
      .select()
      .single();

    // Conditionally update profile stats on first accepted solve
    if (allPassed) {
      const { count } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('problem_id', problemId)
        .eq('status', 'accepted')
        .neq('id', submission.id);

      if (count === 0) {
        // First solve — update profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('total_points, problems_solved')
          .eq('id', user.id)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({
              total_points: (profile.total_points || 0) + pointsEarned,
              problems_solved: (profile.problems_solved || 0) + 1,
            })
            .eq('id', user.id);
        }

        // Award badges based on problems solved
        const newSolved = (profile?.problems_solved || 0) + 1;
        const badgesToAward = [];
        if (newSolved >= 1) badgesToAward.push('first_solve');
        if (newSolved >= 10) badgesToAward.push('ten_solver');
        if (newSolved >= 50) badgesToAward.push('fifty_solver');
        if (newSolved >= 100) badgesToAward.push('hundred_solver');

        if (badgesToAward.length > 0) {
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('badges')
            .eq('id', user.id)
            .single();

          const currentBadges = currentProfile?.badges || [];
          const newBadges = [...new Set([...currentBadges, ...badgesToAward])];

          if (newBadges.length > currentBadges.length) {
            await supabase.from('profiles').update({ badges: newBadges }).eq('id', user.id);
          }
        }
      }

      // Update contest leaderboard
      if (contestId) {
        const { data: existing } = await supabase
          .from('leaderboard_entries')
          .select('*')
          .eq('contest_id', contestId)
          .eq('user_id', user.id)
          .single();

        if (existing) {
          await supabase
            .from('leaderboard_entries')
            .update({
              score: existing.score + pointsEarned,
              problems_solved: existing.problems_solved + 1,
              last_submission_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('leaderboard_entries').insert({
            contest_id: contestId,
            user_id: user.id,
            score: pointsEarned,
            problems_solved: 1,
            last_submission_at: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      status,
      executionTime,
      testResults,
      pointsEarned,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Mock code execution
function mockExecute(code, language, testCases) {
  const results = [];
  let passed = 0;

  for (const tc of testCases) {
    // Simple heuristic: check if the code contains relevant logic
    // In production, use Judge0 or a sandboxed executor
    const codeNorm = code.toLowerCase().replace(/\s+/g, ' ');
    let testPassed = false;

    // Check if code is non-trivial (more than just a template)
    const hasLogic = codeNorm.length > 50 &&
      (codeNorm.includes('return') || codeNorm.includes('print') || codeNorm.includes('console.log'));

    if (hasLogic) {
      // Randomly pass tests based on code quality heuristic
      // This is purely for demo — real execution needed in production
      const hasLoop = /for|while|map|reduce|filter/.test(codeNorm);
      const hasCondition = /if|switch|ternary|\?/.test(codeNorm);
      const complexity = (hasLoop ? 0.3 : 0) + (hasCondition ? 0.3 : 0) + 0.2;
      testPassed = Math.random() < complexity;
    }

    results.push({
      input: tc.input,
      expected: tc.expected_output,
      actual: testPassed ? tc.expected_output : null,
      passed: testPassed,
    });

    if (testPassed) passed++;
  }

  return { passed, total: testCases.length, details: results };
}
