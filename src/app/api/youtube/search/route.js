import { NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

const CATEGORY_QUERIES = {
  All: 'programming tutorial OR coding tutorial OR computer science',
  Programming: 'programming tutorial',
  'Web Development': 'web development tutorial',
  'Data Science': 'data science tutorial',
  'Machine Learning': 'machine learning tutorial',
  Mathematics: 'mathematics lecture',
  Science: 'science education',
  DSA: 'data structures and algorithms',
  'System Design': 'system design interview',
  DevOps: 'devops tutorial',
  Design: 'UI UX design tutorial',
  Business: 'business education',
};

export async function GET(request) {
  try {
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'All';
    const pageToken = searchParams.get('pageToken') || '';
    const maxResults = 12;

    let searchQuery = query.trim();
    if (!searchQuery) {
      searchQuery = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.All;
    } else if (category && category !== 'All') {
      searchQuery = `${searchQuery} ${category}`;
    }

    const searchUrl = new URL(`${BASE_URL}/search`);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('q', searchQuery);
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY);
    searchUrl.searchParams.set('relevanceLanguage', 'en');
    searchUrl.searchParams.set('safeSearch', 'strict');
    searchUrl.searchParams.set('videoCategoryId', '27'); // Education category
    if (pageToken) {
      searchUrl.searchParams.set('pageToken', pageToken);
    }

    const searchRes = await fetch(searchUrl.toString(), { next: { revalidate: 300 } });
    if (!searchRes.ok) {
      const errBody = await searchRes.json().catch(() => ({}));
      console.error('YouTube search error:', errBody);
      return NextResponse.json({ error: 'YouTube API error' }, { status: searchRes.status });
    }

    const searchData = await searchRes.json();
    const videoIds = searchData.items?.map((item) => item.id.videoId).filter(Boolean) || [];

    if (videoIds.length === 0) {
      return NextResponse.json({ videos: [], nextPageToken: null });
    }

    const detailsUrl = new URL(`${BASE_URL}/videos`);
    detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
    detailsUrl.searchParams.set('id', videoIds.join(','));
    detailsUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const detailsRes = await fetch(detailsUrl.toString(), { next: { revalidate: 300 } });
    const detailsData = detailsRes.ok ? await detailsRes.json() : { items: [] };

    // Build a map of video details
    const detailsMap = {};
    for (const item of detailsData.items || []) {
      detailsMap[item.id] = item;
    }

    const videos = videoIds.map((id) => {
      const searchItem = searchData.items.find((i) => i.id.videoId === id);
      const detail = detailsMap[id];
      const snippet = detail?.snippet || searchItem?.snippet || {};
      const stats = detail?.statistics || {};
      const content = detail?.contentDetails || {};

      return {
        youtube_id: id,
        title: snippet.title || '',
        description: snippet.description || '',
        channel_title: snippet.channelTitle || '',
        thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
        published_at: snippet.publishedAt || '',
        duration: content.duration || '',
        view_count: parseInt(stats.viewCount, 10) || 0,
        like_count: parseInt(stats.likeCount, 10) || 0,
        category: category !== 'All' ? category : '',
      };
    });

    return NextResponse.json({
      videos,
      nextPageToken: searchData.nextPageToken || null,
    });
  } catch (err) {
    console.error('YouTube search route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
