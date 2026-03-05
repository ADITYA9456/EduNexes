import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// AI Video Verification — called from upload page
export async function POST(request) {
  try {
    const { youtubeUrl, videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Fetch YouTube metadata via oEmbed (no API key needed)
    let title = '';
    let description = '';
    let channelTitle = '';
    let thumbnailUrl = '';
    let tags = [];

    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        title = oembed.title || '';
        channelTitle = oembed.author_name || '';
        thumbnailUrl = oembed.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    } catch {
      // Fallback thumbnail
      thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    // If YouTube API key is available, get richer metadata
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      try {
        const ytRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${apiKey}`
        );
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          const item = ytData.items?.[0];
          if (item) {
            title = item.snippet.title || title;
            description = item.snippet.description || '';
            channelTitle = item.snippet.channelTitle || channelTitle;
            thumbnailUrl = item.snippet.thumbnails?.high?.url || thumbnailUrl;
            tags = item.snippet.tags || [];
          }
        }
      } catch {
        // Continue with oEmbed data
      }
    }

    // Run AI verification (Gemini or mock)
    const aiProvider = process.env.AI_PROVIDER || 'mock';
    let verificationResult;

    if (aiProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      verificationResult = await geminiVerify(title, description, tags);
    } else {
      verificationResult = mockVerify(title, description, tags);
    }

    // Log to DB
    const { supabaseAdmin } = createServerSupabase();
    await supabaseAdmin.from('ai_verification_logs').insert({
      youtube_id: videoId,
      video_title: title,
      is_educational: verificationResult.isEducational,
      confidence_score: verificationResult.confidence,
      reason: verificationResult.reason,
      ai_provider: aiProvider,
      raw_response: verificationResult,
    });

    return NextResponse.json({
      isEducational: verificationResult.isEducational,
      confidence: verificationResult.confidence,
      reason: verificationResult.reason,
      title,
      description,
      channelTitle,
      thumbnailUrl,
      tags,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Mock AI verification logic
const EDUCATIONAL_KEYWORDS = [
  'tutorial', 'learn', 'course', 'lecture', 'education', 'programming',
  'coding', 'algorithm', 'data structure', 'web development', 'machine learning',
  'mathematics', 'science', 'engineering', 'how to', 'explained', 'introduction',
  'beginner', 'advanced', 'lesson', 'class', 'study', 'training', 'workshop',
  'bootcamp', 'certification', 'guide', 'framework', 'library', 'api',
  'database', 'frontend', 'backend', 'fullstack', 'devops', 'cloud',
  'deployment', 'testing', 'debugging', 'react', 'javascript', 'python',
  'java', 'c++', 'node', 'nextjs', 'typescript',
];

const NON_EDUCATIONAL_KEYWORDS = [
  'prank', 'funny', 'meme', 'vlog', 'unboxing', 'reaction', 'drama',
  'gossip', 'celebrity', 'entertainment', 'music video', 'movie trailer',
  'gaming walkthrough', 'asmr', 'mukbang', 'challenge',
];

function mockVerify(title, description, tags) {
  const text = `${title} ${description} ${(tags || []).join(' ')}`.toLowerCase();
  let score = 0;
  let matchedKeywords = [];

  for (const kw of EDUCATIONAL_KEYWORDS) {
    if (text.includes(kw)) {
      score += 1;
      matchedKeywords.push(kw);
    }
  }
  for (const kw of NON_EDUCATIONAL_KEYWORDS) {
    if (text.includes(kw)) score -= 2;
  }

  const maxScore = 10;
  const confidence = Math.min(Math.max(score / maxScore, 0), 1);
  const isEducational = confidence >= 0.3;

  return {
    isEducational,
    confidence,
    reason: isEducational
      ? `Matched educational keywords: ${matchedKeywords.slice(0, 5).join(', ')}`
      : 'Did not match enough educational keywords',
    matchedKeywords,
  };
}

// Gemini AI verification using Google Generative AI REST API
async function geminiVerify(title, description, tags) {
  const apiKey = process.env.GEMINI_API_KEY;
  const tagStr = (tags || []).join(', ');

  const prompt = `You are a content moderator for an educational platform called EduNexes. Analyze this YouTube video and determine if it is educational content suitable for a learning platform.

Video Title: ${title}
Description: ${description || 'No description available'}
Tags: ${tagStr || 'No tags available'}

Respond ONLY in this exact JSON format (no markdown, no extra text):
{"isEducational": true/false, "confidence": 0.0-1.0, "reason": "brief explanation", "category": "suggested category"}

Categories: Programming, Web Development, Data Science, Mathematics, Science, Engineering, Design, DevOps, Mobile Development, Cybersecurity, AI/ML, General Education, Other

Rules:
- Educational = tutorials, courses, lectures, coding guides, tech talks, documentation walkthroughs
- NOT educational = vlogs, pranks, entertainment, gaming (non-educational), music videos, reactions
- Be strict: confidence below 0.5 if unsure`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!res.ok) {
      console.error('Gemini API error:', res.status, await res.text());
      return mockVerify(title, description, tags); // Fallback to mock
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Gemini returned non-JSON:', text);
      return mockVerify(title, description, tags);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      isEducational: Boolean(parsed.isEducational),
      confidence: Math.min(Math.max(Number(parsed.confidence) || 0, 0), 1),
      reason: parsed.reason || 'AI analysis complete',
      category: parsed.category || 'Other',
      provider: 'gemini',
    };
  } catch (err) {
    console.error('Gemini verification failed:', err.message);
    return mockVerify(title, description, tags); // Fallback to mock
  }
}
