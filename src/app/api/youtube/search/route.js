import { createAdminSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Free API instances (fallback when YouTube quota exceeded)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.leptons.xyz',
];
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacyredirect.com',
  'https://vid.puffyan.us',
];

// In-memory cache to reduce YouTube API quota usage
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
// Track if YouTube quota is exhausted to skip it and go straight to Piped
let quotaExhausted = false;
let quotaExhaustedAt = 0;
const QUOTA_COOLDOWN = 60 * 60 * 1000; // 1 hour

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

    // Check cache first
    const cacheKey = `${searchQuery}|${pageToken}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Reset quota flag after cooldown
    if (quotaExhausted && Date.now() - quotaExhaustedAt > QUOTA_COOLDOWN) {
      quotaExhausted = false;
    }

    // Try YouTube API first (if quota not exhausted and key exists)
    if (YOUTUBE_API_KEY && !quotaExhausted) {
      const ytResult = await fetchFromYouTube(searchQuery, category, pageToken, maxResults);
      if (ytResult) {
        cache.set(cacheKey, { data: ytResult, time: Date.now() });
        return NextResponse.json(ytResult);
      }
    }

    // Fallback 1: Piped API (free, no API key needed)
    const pipedResult = await fetchFromPiped(searchQuery, category);
    if (pipedResult && pipedResult.videos.length > 0) {
      cache.set(cacheKey, { data: pipedResult, time: Date.now() });
      return NextResponse.json(pipedResult);
    }

    // Fallback 2: Invidious API (another free YouTube mirror)
    const invResult = await fetchFromInvidious(searchQuery, category);
    if (invResult && invResult.videos.length > 0) {
      cache.set(cacheKey, { data: invResult, time: Date.now() });
      return NextResponse.json(invResult);
    }

    // Last resort: database
    const dbResult = await fallbackToDatabase(query.trim(), category);
    return dbResult;
  } catch (err) {
    console.error('YouTube search route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── YouTube Data API v3 ───
async function fetchFromYouTube(searchQuery, category, pageToken, maxResults) {
  try {
    const searchUrl = new URL(`${BASE_URL}/search`);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('q', searchQuery);
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY);
    searchUrl.searchParams.set('relevanceLanguage', 'en');
    searchUrl.searchParams.set('safeSearch', 'strict');
    searchUrl.searchParams.set('videoCategoryId', '27');
    if (pageToken) {
      searchUrl.searchParams.set('pageToken', pageToken);
    }

    const searchRes = await fetch(searchUrl.toString(), { next: { revalidate: 300 } });
    if (!searchRes.ok) {
      const errBody = await searchRes.json().catch(() => ({}));
      console.error('YouTube API error:', errBody);
      if (searchRes.status === 403) {
        quotaExhausted = true;
        quotaExhaustedAt = Date.now();
      }
      return null;
    }

    const searchData = await searchRes.json();
    const videoIds = searchData.items?.map((item) => item.id.videoId).filter(Boolean) || [];

    if (videoIds.length === 0) return { videos: [], nextPageToken: null };

    const detailsUrl = new URL(`${BASE_URL}/videos`);
    detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
    detailsUrl.searchParams.set('id', videoIds.join(','));
    detailsUrl.searchParams.set('key', YOUTUBE_API_KEY);

    const detailsRes = await fetch(detailsUrl.toString(), { next: { revalidate: 300 } });
    const detailsData = detailsRes.ok ? await detailsRes.json() : { items: [] };

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

    return { videos, nextPageToken: searchData.nextPageToken || null };
  } catch (err) {
    console.error('fetchFromYouTube error:', err);
    return null;
  }
}

// ─── Piped API (free YouTube mirror, no key needed) ───
function formatPipedDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `PT${h}H${m}M${s}S`;
  return `PT${m}M${s}S`;
}

function safeDateString(uploaded) {
  try {
    if (typeof uploaded === 'number' && uploaded > 0) {
      return new Date(uploaded).toISOString();
    }
  } catch { /* ignore */ }
  return '';
}

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromPiped(searchQuery, category) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(searchQuery)}&filter=videos`;
      const res = await fetchWithTimeout(url, 8000);

      if (!res.ok) continue;

      const data = await res.json();
      const items = data.items || data;

      if (!Array.isArray(items) || items.length === 0) continue;

      const videos = items
        .filter((item) => item.url || item.videoId)
        .slice(0, 12)
        .map((item) => {
          const videoId = item.url
            ? item.url.replace('/watch?v=', '')
            : item.videoId || '';
          return {
            youtube_id: videoId,
            title: item.title || '',
            description: item.shortDescription || item.description || '',
            channel_title: item.uploaderName || item.uploader || '',
            thumbnail_url: item.thumbnail || '',
            published_at: safeDateString(item.uploaded) || item.uploadedDate || '',
            duration: formatPipedDuration(item.duration),
            view_count: item.views || 0,
            like_count: 0,
            category: category !== 'All' ? category : '',
          };
        });

      if (videos.length > 0) {
        console.log(`Piped fallback success via ${instance} — ${videos.length} results`);
        return { videos, nextPageToken: null };
      }
    } catch (err) {
      console.error(`Piped instance ${instance} failed:`, err.message);
      continue;
    }
  }

  return null;
}

// ─── Invidious API (another free YouTube mirror) ───
async function fetchFromInvidious(searchQuery, category) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video&sort_by=relevance`;
      const res = await fetchWithTimeout(url, 8000);

      if (!res.ok) continue;

      const items = await res.json();

      if (!Array.isArray(items) || items.length === 0) continue;

      const videos = items
        .filter((item) => item.type === 'video' && item.videoId)
        .slice(0, 12)
        .map((item) => ({
          youtube_id: item.videoId,
          title: item.title || '',
          description: item.description || item.descriptionHtml || '',
          channel_title: item.author || '',
          thumbnail_url: item.videoThumbnails?.[0]?.url || '',
          published_at: item.published ? new Date(item.published * 1000).toISOString() : '',
          duration: formatPipedDuration(item.lengthSeconds),
          view_count: item.viewCount || 0,
          like_count: 0,
          category: category !== 'All' ? category : '',
        }));

      if (videos.length > 0) {
        console.log(`Invidious fallback success via ${instance} — ${videos.length} results`);
        return { videos, nextPageToken: null };
      }
    } catch (err) {
      console.error(`Invidious instance ${instance} failed:`, err.message);
      continue;
    }
  }

  return null;
}

// ─── Database fallback (last resort) ───
async function fallbackToDatabase(searchQuery, category) {
  try {
    const supabase = createAdminSupabase();
    let dbQuery = supabase
      .from('videos')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(12);

    if (category && category !== 'All') {
      dbQuery = dbQuery.eq('category', category);
    }

    if (searchQuery) {
      dbQuery = dbQuery.or(
        `title.ilike.%${searchQuery}%,channel_title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
      );
    }

    const { data: dbVideos } = await dbQuery;

    const videos = (dbVideos || []).map((v) => ({
      youtube_id: v.youtube_id,
      title: v.title,
      description: v.description || '',
      channel_title: v.channel_title || '',
      thumbnail_url: v.thumbnail_url || '',
      published_at: v.created_at || '',
      duration: v.duration || '',
      view_count: v.view_count || 0,
      like_count: 0,
      category: v.category || '',
    }));

    return NextResponse.json({ videos, nextPageToken: null });
  } catch (err) {
    console.error('Database fallback error:', err);
    return NextResponse.json({ videos: [], nextPageToken: null });
  }
}
