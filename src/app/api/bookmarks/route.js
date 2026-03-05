import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/bookmarks — get user's bookmarks
export async function GET(request) {
  try {
    const { supabase } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select('*, coding_problems(id, title, slug, category, difficulty, tags, type, points)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookmarks: bookmarks || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/bookmarks — toggle bookmark
export async function POST(request) {
  try {
    const { supabase } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { questionId } = await request.json();

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    // Check if already bookmarked
    const { data: existing } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .single();

    if (existing) {
      // Remove bookmark
      await supabase
        .from('bookmarks')
        .delete()
        .eq('id', existing.id);

      return NextResponse.json({ bookmarked: false });
    } else {
      // Add bookmark
      await supabase
        .from('bookmarks')
        .insert({ user_id: user.id, question_id: questionId });

      return NextResponse.json({ bookmarked: true });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
