import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/daily-challenge — get today's daily challenge
export async function GET() {
  try {
    const { supabase } = createServerSupabase();
    const today = new Date().toISOString().split('T')[0];

    // Try to get today's challenge
    const { data: challenge } = await supabase
      .from('daily_challenges')
      .select('*, coding_problems(*)')
      .eq('challenge_date', today)
      .single();

    if (challenge) {
      return NextResponse.json({ challenge: challenge.coding_problems, date: today });
    }

    // No challenge set for today — pick a random one
    const { data: allProblems } = await supabase
      .from('coding_problems')
      .select('id')
      .eq('type', 'code');

    if (!allProblems || allProblems.length === 0) {
      return NextResponse.json({ challenge: null, date: today });
    }

    const randomProblem = allProblems[Math.floor(Math.random() * allProblems.length)];

    // Insert as today's challenge (ignore if already exists from race condition)
    await supabase
      .from('daily_challenges')
      .upsert(
        { question_id: randomProblem.id, challenge_date: today },
        { onConflict: 'challenge_date' }
      );

    const { data: problem } = await supabase
      .from('coding_problems')
      .select('*')
      .eq('id', randomProblem.id)
      .single();

    return NextResponse.json({ challenge: problem, date: today });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
