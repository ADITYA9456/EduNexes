import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const REPORT_THRESHOLD = 10; // Auto-unpublish after this many reports

// Report a video
export async function POST(request) {
  try {
    const { supabase, supabaseAdmin } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId, reason, description } = await request.json();

    if (!videoId || !reason) {
      return NextResponse.json({ error: 'videoId and reason are required' }, { status: 400 });
    }

    // Check for duplicate report from same user
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('video_id', videoId)
      .eq('reporter_id', user.id)
      .single();

    if (existingReport) {
      return NextResponse.json({ error: 'You have already reported this video' }, { status: 409 });
    }

    // Insert report
    const { error } = await supabase.from('reports').insert({
      video_id: videoId,
      reporter_id: user.id,
      reason,
      description: description || '',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check total report count — auto-unpublish if threshold reached
    const { count } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', videoId)
      .eq('status', 'pending');

    if (count >= REPORT_THRESHOLD) {
      await supabaseAdmin
        .from('videos')
        .update({ status: 'rejected' })
        .eq('id', videoId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
