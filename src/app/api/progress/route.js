import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/progress — get user's progress stats
export async function GET(request) {
  try {
    const { supabase } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user progress
    const { data: progress } = await supabase
      .from('user_progress')
      .select('*, coding_problems(id, title, slug, category, difficulty, points)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    // Compute stats
    const solved = (progress || []).filter((p) => p.status === 'solved');
    const attempted = (progress || []).filter((p) => p.status === 'attempted');

    const byCategory = {};
    const byDifficulty = { Easy: 0, Medium: 0, Hard: 0 };

    solved.forEach((p) => {
      const cat = p.coding_problems?.category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      const diff = p.coding_problems?.difficulty || 'Easy';
      byDifficulty[diff] = (byDifficulty[diff] || 0) + 1;
    });

    const totalScore = solved.reduce((sum, p) => sum + (p.score || 0), 0);

    return NextResponse.json({
      progress: progress || [],
      stats: {
        totalSolved: solved.length,
        totalAttempted: attempted.length,
        totalScore,
        byCategory,
        byDifficulty,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/progress — update user progress on a question
export async function POST(request) {
  try {
    const { supabase } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId, status, languageUsed, score, submittedCode } = await request.json();

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    // Check existing progress
    const { data: existing } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .single();

    if (existing) {
      // Update: only upgrade status (attempted → solved), update score if higher
      const newStatus = status === 'solved' ? 'solved' : existing.status;
      const newScore = Math.max(existing.score || 0, score || 0);

      const { data: updated, error } = await supabase
        .from('user_progress')
        .update({
          status: newStatus,
          score: newScore,
          language_used: languageUsed || existing.language_used,
          submitted_code: submittedCode || existing.submitted_code,
          attempts: (existing.attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ progress: updated });
    } else {
      // Insert new progress
      const { data: created, error } = await supabase
        .from('user_progress')
        .insert({
          user_id: user.id,
          question_id: questionId,
          status: status || 'attempted',
          language_used: languageUsed || 'javascript',
          score: score || 0,
          submitted_code: submittedCode || '',
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ progress: created });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
