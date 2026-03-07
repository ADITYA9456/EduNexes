import { createAdminSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Support multiple YouTube API keys (comma-separated in env) for higher quota
const YOUTUBE_API_KEYS = (process.env.YOUTUBE_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Free API instances (fallback when YouTube quota exceeded)
// Only keep instances that are known to work reliably
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.leptons.xyz',
];
const INVIDIOUS_INSTANCES = [
  'https://invidious.materialio.us',
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
];

// Curated fallback videos when ALL APIs fail (verified working YouTube IDs)
const CURATED_VIDEOS = [
  { youtube_id: 'PkZNo7MFNFg', title: 'Learn JavaScript - Full Course for Beginners', channel_title: 'freeCodeCamp.org', thumbnail_url: 'https://i.ytimg.com/vi/PkZNo7MFNFg/hqdefault.jpg', duration: 'PT3H26M42S', view_count: 15000000, category: 'Programming' },
  { youtube_id: 'rfscVS0vtbw', title: 'Learn Python - Full Course for Beginners', channel_title: 'freeCodeCamp.org', thumbnail_url: 'https://i.ytimg.com/vi/rfscVS0vtbw/hqdefault.jpg', duration: 'PT4H26M52S', view_count: 42000000, category: 'Programming' },
  { youtube_id: 'eIrMbAQSU34', title: 'Java Tutorial for Beginners', channel_title: 'Programming with Mosh', thumbnail_url: 'https://i.ytimg.com/vi/eIrMbAQSU34/hqdefault.jpg', duration: 'PT2H30M', view_count: 18000000, category: 'Programming' },
  { youtube_id: 'SqcY0GlETPk', title: 'React Tutorial for Beginners', channel_title: 'Programming with Mosh', thumbnail_url: 'https://i.ytimg.com/vi/SqcY0GlETPk/hqdefault.jpg', duration: 'PT1H20M', view_count: 10000000, category: 'Web Development' },
  { youtube_id: 'UB1O30fR-EE', title: 'HTML Crash Course For Absolute Beginners', channel_title: 'Traversy Media', thumbnail_url: 'https://i.ytimg.com/vi/UB1O30fR-EE/hqdefault.jpg', duration: 'PT1H0M', view_count: 14000000, category: 'Web Development' },
  { youtube_id: 'HXV3zeQKqGY', title: 'SQL Tutorial - Full Database Course', channel_title: 'freeCodeCamp.org', thumbnail_url: 'https://i.ytimg.com/vi/HXV3zeQKqGY/hqdefault.jpg', duration: 'PT4H20M35S', view_count: 15000000, category: 'Data Science' },
  { youtube_id: 'i_LwzRVP7bg', title: 'Machine Learning for Everybody', channel_title: 'freeCodeCamp.org', thumbnail_url: 'https://i.ytimg.com/vi/i_LwzRVP7bg/hqdefault.jpg', duration: 'PT3H53M', view_count: 4000000, category: 'Machine Learning' },
  { youtube_id: '8hly31xKli0', title: 'Algorithms and Data Structures Tutorial', channel_title: 'freeCodeCamp.org', thumbnail_url: 'https://i.ytimg.com/vi/8hly31xKli0/hqdefault.jpg', duration: 'PT5H22M', view_count: 8500000, category: 'DSA' },
  { youtube_id: 'Oe421EPjeBE', title: 'Node.js and Express.js - Full Course', channel_title: 'freeCodeCamp.org', thumbnail_url: 'https://i.ytimg.com/vi/Oe421EPjeBE/hqdefault.jpg', duration: 'PT8H16M', view_count: 5000000, category: 'Web Development' },
  { youtube_id: 'jS4aFq5-91M', title: 'JavaScript Programming - Full Course', channel_title: 'freeCodeCamp.org', thumbnail_url: 'https://i.ytimg.com/vi/jS4aFq5-91M/hqdefault.jpg', duration: 'PT7H55M', view_count: 13000000, category: 'Programming' },
  { youtube_id: 'RBSGKlAvoiM', title: 'Data Structures Easy to Advanced Course', channel_title: 'freeCodeCamp.org', thumbnail_url: 'https://i.ytimg.com/vi/RBSGKlAvoiM/hqdefault.jpg', duration: 'PT8H3M', view_count: 5500000, category: 'DSA' },
  { youtube_id: 'fqMOX6JJhGo', title: 'Docker Tutorial for Beginners', channel_title: 'TechWorld with Nana', thumbnail_url: 'https://i.ytimg.com/vi/fqMOX6JJhGo/hqdefault.jpg', duration: 'PT2H46M', view_count: 2500000, category: 'DevOps' },
];

// Track exhausted API keys individually — use globalThis to survive hot reloads in dev
if (!globalThis.__ytExhaustedKeys) {
  globalThis.__ytExhaustedKeys = new Map();
}
const exhaustedKeys = globalThis.__ytExhaustedKeys;
const QUOTA_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours (YouTube quota resets daily at midnight PT)

function getWorkingApiKey() {
  const now = Date.now();
  for (const key of YOUTUBE_API_KEYS) {
    const exhaustedAt = exhaustedKeys.get(key);
    if (!exhaustedAt || now - exhaustedAt > QUOTA_COOLDOWN) {
      exhaustedKeys.delete(key);
      return key;
    }
  }
  return null;
}

function markKeyExhausted(key) {
  exhaustedKeys.set(key, Date.now());
}

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
    const page = parseInt(searchParams.get('page') || '0', 10);
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

    // Try YouTube API first (if we have a working key)
    const apiKey = getWorkingApiKey();
    if (apiKey) {
      const ytResult = await fetchFromYouTube(apiKey, searchQuery, category, pageToken, maxResults, searchOrder);
      if (ytResult && ytResult.videos.length > 0) {
        if (!isUserSearch) ytResult.videos = shuffleArray(ytResult.videos);
        return NextResponse.json(ytResult);
      }
    }

    // Fallback: Try ALL Piped and Invidious instances concurrently
    // Each page uses a different query from the category list for variety
    const queryIndex = page % (CATEGORY_QUERIES[category] || CATEGORY_QUERIES.All).length;
    const queries = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.All;
    const fallbackQuery = isUserSearch ? searchQuery : queries[queryIndex];
    // Invidious supports native pagination via page param
    const invidiousPage = Math.floor(page / queries.length) + 1;

    try {
      const pipedPromises = PIPED_INSTANCES.map((inst) =>
        fetchFromPiped(inst, fallbackQuery, category).catch(() => null)
      );
      const invidiousPromises = INVIDIOUS_INSTANCES.map((inst) =>
        fetchFromInvidious(inst, fallbackQuery, category, invidiousPage).catch(() => null)
      );

      const allResults = await Promise.allSettled([...pipedPromises, ...invidiousPromises]);

      for (const result of allResults) {
        if (result.status === 'fulfilled' && result.value && result.value.videos?.length > 0) {
          const data = result.value;
          if (!isUserSearch) data.videos = shuffleArray(data.videos);
          // Always provide next page token for infinite scroll
          data.nextPageToken = `fallback_page_${page + 1}`;
          return NextResponse.json(data);
        }
      }
    } catch (e) {
      console.error('Fallback APIs error:', e.message);
    }

    // Database fallback
    const dbResult = await fallbackToDatabase(query.trim(), category, page);
    const dbData = await dbResult.json();
    if (dbData.videos && dbData.videos.length > 0) {
      return NextResponse.json(dbData);
    }

    // Ultimate fallback: curated videos with pagination
    let curated = [...CURATED_VIDEOS];
    if (category && category !== 'All') {
      const filtered = curated.filter((v) => v.category === category);
      if (filtered.length > 0) curated = filtered;
    }
    const start = (page % Math.ceil(curated.length / maxResults)) * maxResults;
    curated = shuffleArray(curated).slice(start, start + maxResults).map((v) => ({
      ...v,
      description: '',
      published_at: '',
      like_count: 0,
    }));
    return NextResponse.json({
      videos: curated,
      nextPageToken: curated.length >= maxResults ? `curated_page_${page + 1}` : null,
    });
  } catch (err) {
    console.error('YouTube search route error:', err);
    return NextResponse.json({
      videos: shuffleArray([...CURATED_VIDEOS]).map((v) => ({ ...v, description: '', published_at: '', like_count: 0 })),
      nextPageToken: null,
    });
  }
}

// Extra query words per page to simulate pagination for APIs without pageToken
function getPageVariation(category, page) {
  const variations = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.All;
  return variations[page % variations.length] || '';
}

// ─── YouTube Data API v3 ───
async function fetchFromYouTube(apiKey, searchQuery, category, pageToken, maxResults, searchOrder = 'relevance') {
  try {
    const searchUrl = new URL(`${BASE_URL}/search`);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('q', searchQuery);
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('relevanceLanguage', 'en');
    searchUrl.searchParams.set('safeSearch', 'strict');
    searchUrl.searchParams.set('order', searchOrder);
    if (pageToken && !pageToken.startsWith('fallback_') && !pageToken.startsWith('curated_')) {
      searchUrl.searchParams.set('pageToken', pageToken);
    }

    const ytController = new AbortController();
    const ytTimer = setTimeout(() => ytController.abort(), 8000);
    let searchRes;
    try {
      searchRes = await fetch(searchUrl.toString(), { cache: 'no-store', signal: ytController.signal });
    } catch (e) {
      console.error('YouTube API timeout/network error:', e.message);
      return null;
    } finally {
      clearTimeout(ytTimer);
    }
    if (!searchRes.ok) {
      if (searchRes.status === 403) {
        // Quota exceeded — silently mark key and skip to fallbacks
        markKeyExhausted(apiKey);
      } else {
        const errBody = await searchRes.json().catch(() => ({}));
        console.error('YouTube API error:', searchRes.status, errBody);
      }
      return null;
    }

    const searchData = await searchRes.json();
    const videoIds = searchData.items?.map((item) => item.id.videoId).filter(Boolean) || [];

    if (videoIds.length === 0) return { videos: [], nextPageToken: null };

    const detailsUrl = new URL(`${BASE_URL}/videos`);
    detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
    detailsUrl.searchParams.set('id', videoIds.join(','));
    detailsUrl.searchParams.set('key', apiKey);

    const detController = new AbortController();
    const detTimer = setTimeout(() => detController.abort(), 8000);
    let detailsRes;
    try {
      detailsRes = await fetch(detailsUrl.toString(), { cache: 'no-store', signal: detController.signal });
    } catch {
      detailsRes = null;
    } finally {
      clearTimeout(detTimer);
    }
    const detailsData = detailsRes?.ok ? await detailsRes.json() : { items: [] };

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

async function fetchWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromPiped(instance, searchQuery, category) {
  try {
    const url = `${instance}/search?q=${encodeURIComponent(searchQuery)}&filter=videos`;
    const res = await fetchWithTimeout(url, 6000);

    if (!res.ok) return null;

    // Guard against HTML responses
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const data = await res.json();
    const items = data.items || data;

    if (!Array.isArray(items) || items.length === 0) return null;

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
  }

  return null;
}

// ─── Invidious API (another free YouTube mirror) ───
async function fetchFromInvidious(instance, searchQuery, category, page = 1) {
  try {
    const sortOptions = ['relevance', 'date', 'views'];
    const sort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
    const url = `${instance}/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video&sort_by=${sort}&page=${page}`;
    const res = await fetchWithTimeout(url, 6000);

    if (!res.ok) return null;

    // Guard against HTML responses (when instance returns error page)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) return null;

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
  }

  return null;
}

// ─── Database fallback (last resort) ───
async function fallbackToDatabase(searchQuery, category, page = 0) {
  try {
    const supabase = createAdminSupabase();
    const limit = 12;
    const offset = page * limit;
    let dbQuery = supabase
      .from('videos')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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

    return NextResponse.json({
      videos,
      nextPageToken: videos.length >= 12 ? `db_page_${page + 1}` : null,
    });
  } catch (err) {
    console.error('Database fallback error:', err);
    return NextResponse.json({ videos: [], nextPageToken: null });
  }
}
