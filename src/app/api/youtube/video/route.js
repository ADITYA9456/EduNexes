import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export async function GET(request) {
  try {
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';

    if (!id) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Fetch video details
    const videoUrl = new URL(`${BASE_URL}/videos`);
    videoUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
    videoUrl.searchParams.set('id', id);
    videoUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const videoRes = await fetch(videoUrl.toString(), { cache: 'no-store' });
    if (!videoRes.ok) {
      return NextResponse.json({ error: 'YouTube API error' }, { status: videoRes.status });
    }

    const videoData = await videoRes.json();
    const item = videoData.items?.[0];

    if (!item) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const snippet = item.snippet || {};
    const stats = item.statistics || {};
    const content = item.contentDetails || {};

    const video = {
      youtube_id: item.id,
      title: snippet.title || '',
      description: snippet.description || '',
      channel_title: snippet.channelTitle || '',
      thumbnail_url: snippet.thumbnails?.high?.url || '',
      published_at: snippet.publishedAt || '',
      duration: content.duration || '',
      view_count: parseInt(stats.viewCount, 10) || 0,
      like_count: parseInt(stats.likeCount, 10) || 0,
      tags: snippet.tags?.slice(0, 10) || [],
      category: '',
    };

    // Fetch related videos
    const relatedUrl = new URL(`${BASE_URL}/search`);
    relatedUrl.searchParams.set('part', 'snippet');
    relatedUrl.searchParams.set('type', 'video');
    relatedUrl.searchParams.set('relatedToVideoId', id);
    relatedUrl.searchParams.set('maxResults', '10');
    relatedUrl.searchParams.set('key', YOUTUBE_API_KEY);
    relatedUrl.searchParams.set('safeSearch', 'strict');

    const relatedRes = await fetch(relatedUrl.toString(), { cache: 'no-store' });
    let relatedVideos = [];

    if (relatedRes.ok) {
      const relatedData = await relatedRes.json();
      const relIds = relatedData.items
        ?.map((i) => i.id?.videoId)
        .filter(Boolean) || [];

      if (relIds.length > 0) {
        // Fetch details for related videos
        const relDetailsUrl = new URL(`${BASE_URL}/videos`);
        relDetailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
        relDetailsUrl.searchParams.set('id', relIds.join(','));
        relDetailsUrl.searchParams.set('key', YOUTUBE_API_KEY);

        const relDetailsRes = await fetch(relDetailsUrl.toString(), { cache: 'no-store' });
        if (relDetailsRes.ok) {
          const relDetailsData = await relDetailsRes.json();
          relatedVideos = (relDetailsData.items || []).map((r) => ({
            youtube_id: r.id,
            title: r.snippet?.title || '',
            channel_title: r.snippet?.channelTitle || '',
            thumbnail_url: r.snippet?.thumbnails?.medium?.url || '',
            published_at: r.snippet?.publishedAt || '',
            duration: r.contentDetails?.duration || '',
            view_count: parseInt(r.statistics?.viewCount, 10) || 0,
          }));
        }
      }
    }

    return NextResponse.json({ video, related: relatedVideos });
  } catch (err) {
    console.error('YouTube video route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
