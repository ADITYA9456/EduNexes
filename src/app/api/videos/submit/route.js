import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Submit a new video for review
export async function POST(request) {
  try {
    const { supabase } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      videoId, title, description, category, tags,
      channelTitle, thumbnailUrl, duration,
    } = await request.json();

    if (!videoId || !title || !category) {
      return NextResponse.json({ error: 'videoId, title, and category are required' }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('videos')
      .select('id')
      .eq('youtube_id', videoId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This video has already been submitted' }, { status: 409 });
    }

    // Insert video
    const { data: video, error } = await supabase
      .from('videos')
      .insert({
        youtube_id: videoId,
        title,
        description: description || '',
        category,
        tags: tags || [],
        channel_title: channelTitle || '',
        thumbnail_url: thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        duration: duration || '',
        status: 'pending',
        submitted_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, video });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
