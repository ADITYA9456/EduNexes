import { createAdminSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

// Track if YouTube quota is exhausted to skip it and go straight to Piped
let quotaExhausted = false;
let quotaExhaustedAt = 0;
const QUOTA_COOLDOWN = 60 * 60 * 1000; // 1 hour

// Multiple query variations per category for variety
const CATEGORY_QUERIES = {
  All: [
    'programming tutorial 2024',
    'coding tutorial for beginners',
    'computer science explained',
    'learn to code',
    'software engineering tutorial',
    'programming projects',
    'coding challenges explained',
    'tech tutorials',
  ],
  Programming: ['programming tutorial', 'learn programming', 'coding basics'],
  'Web Development': ['web development tutorial', 'frontend development', 'fullstack project'],
  'Data Science': ['data science tutorial', 'data analysis python', 'data science project'],
  'Machine Learning': ['machine learning tutorial', 'deep learning explained', 'AI projects'],
  Mathematics: ['mathematics lecture', 'math for programmers', 'discrete mathematics'],
  Science: ['science education', 'physics explained', 'science documentary'],
  DSA: ['data structures and algorithms', 'DSA tutorial', 'leetcode explained'],
  'System Design': ['system design interview', 'system architecture', 'scalable systems'],
  DevOps: ['devops tutorial', 'docker kubernetes', 'CI CD pipeline'],
  Design: ['UI UX design tutorial', 'web design', 'figma tutorial'],
  Business: ['business education', 'startup lessons', 'entrepreneurship'],
};

// Pick a random query from the category's list
function getRandomQuery(category) {
  const queries = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.All;
  return queries[Math.floor(Math.random() * queries.length)];
}

// Shuffle array (Fisher-Yates) for result variety
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// YouTube search order options for variety
const SEARCH_ORDERS = ['relevance', 'date', 'viewCount'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'All';
    const pageToken = searchParams.get('pageToken') || '';
    const maxResults = 12;

    // For explicit user searches, use the query as-is
    // For default browsing (no query), pick a random query for variety
    let searchQuery = query.trim();
    const isUserSearch = !!searchQuery;
    
    if (!searchQuery) {
      searchQuery = getRandomQuery(category);
    } else if (category && category !== 'All') {
      searchQuery = `${searchQuery} ${category}`;
    }

    // Pick a random search order for non-user searches
    const searchOrder = isUserSearch
      ? 'relevance'
      : SEARCH_ORDERS[Math.floor(Math.random() * SEARCH_ORDERS.length)];

    // Reset quota flag after cooldown
    if (quotaExhausted && Date.now() - quotaExhaustedAt > QUOTA_COOLDOWN) {
      quotaExhausted = false;
    }

    // Try YouTube API first (if quota not exhausted and key exists)
    if (YOUTUBE_API_KEY && !quotaExhausted) {
      const ytResult = await fetchFromYouTube(searchQuery, category, pageToken, maxResults, searchOrder);
      if (ytResult && ytResult.videos.length > 0) {
        // Shuffle results for non-user searches to add variety
        if (!isUserSearch) {
          ytResult.videos = shuffleArray(ytResult.videos);
        }
        return NextResponse.json(ytResult);
      }
    }

    // Fallback 1: Piped API (free, no API key needed)
    const pipedResult = await fetchFromPiped(searchQuery, category);
    if (pipedResult && pipedResult.videos.length > 0) {
      if (!isUserSearch) {
        pipedResult.videos = shuffleArray(pipedResult.videos);
      }
      return NextResponse.json(pipedResult);
    }

    // Fallback 2: Invidious API (another free YouTube mirror)
    const invResult = await fetchFromInvidious(searchQuery, category);
    if (invResult && invResult.videos.length > 0) {
      if (!isUserSearch) {
        invResult.videos = shuffleArray(invResult.videos);
      }
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
async function fetchFromYouTube(searchQuery, category, pageToken, maxResults, searchOrder = 'relevance') {
  try {
    const searchUrl = new URL(`${BASE_URL}/search`);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('q', searchQuery);
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY);
    searchUrl.searchParams.set('relevanceLanguage', 'en');
    searchUrl.searchParams.set('safeSearch', 'strict');
    searchUrl.searchParams.set('order', searchOrder);
    if (pageToken) {
      searchUrl.searchParams.set('pageToken', pageToken);
    }

    const searchRes = await fetch(searchUrl.toString(), { cache: 'no-store' });
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

    const detailsRes = await fetch(detailsUrl.toString(), { cache: 'no-store' });
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
      const sortOptions = ['relevance', 'date', 'views'];
      const sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video&sort_by=${sort}`;
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
