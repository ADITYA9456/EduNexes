'use client';

import { formatCount, timeAgo } from '@/lib/utils';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { HiExternalLink, HiPlay } from 'react-icons/hi';
import { HiSparkles } from 'react-icons/hi2';

function generateSummary(video) {
  if (!video) return null;

  const desc = video.description || '';
  const title = video.title || '';
  const tags = video.tags || [];

  // Extract meaningful sentences from description
  const sentences = desc
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 300 && !s.startsWith('http'));

  const summaryLines = sentences.slice(0, 4);

  // Extract timestamps from description
  const timestamps = [];
  const tsRegex = /(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+)/g;
  let match;
  while ((match = tsRegex.exec(desc)) !== null && timestamps.length < 8) {
    timestamps.push({ time: match[1], label: match[2].trim().slice(0, 60) });
  }

  // Extract key topics from title and tags
  const topics = [];
  if (tags.length > 0) {
    topics.push(...tags.slice(0, 6));
  } else {
    // Extract meaningful words from title
    const words = title
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);
    topics.push(...words.slice(0, 5));
  }

  return { summaryLines, timestamps, topics };
}

export default function AISummaryPanel({ video }) {
  const summary = useMemo(() => generateSummary(video), [video]);
  const [imgError, setImgError] = useState(false);

  // Reset imgError when video changes
  const videoId = video?.youtube_id || video?.id;
  const prevVideoIdRef = useMemo(() => ({ current: null }), []);
  if (videoId !== prevVideoIdRef.current) {
    prevVideoIdRef.current = videoId;
    if (imgError) setImgError(false);
  }

  if (!video) {
    return (
      <div className="ai-panel ai-panel--empty">
        <div className="ai-panel__empty-icon">
          <HiSparkles size={48} />
        </div>
        <h3>AI Video Summary</h3>
        <p>Select a video from the list to see its AI-powered summary and key insights.</p>
      </div>
    );
  }

  const thumbnail = video.thumbnail_url || video.thumbnail || '';
  const views = video.view_count || 0;

  return (
    <div className="ai-panel animate-fade-in">
      {/* Preview */}
      <Link href={`/video/${videoId}`} className="ai-panel__preview">
        {thumbnail && !imgError ? (
          <img
            src={thumbnail}
            alt={video.title}
            onError={() => setImgError(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
        <div className="ai-panel__play-overlay">
          <div className="ai-panel__play-btn">
            <HiPlay size={32} />
          </div>
        </div>
      </Link>

      {/* Title & info */}
      <div className="ai-panel__header">
        <h3 className="ai-panel__title">{video.title}</h3>
        <div className="ai-panel__meta">
          {video.channel_title && <span className="ai-panel__channel">{video.channel_title}</span>}
          {views > 0 && <span>{formatCount(views)} views</span>}
          {video.published_at && <span>{timeAgo(video.published_at)}</span>}
        </div>
      </div>

      {/* AI Summary */}
      <div className="ai-panel__section">
        <div className="ai-panel__section-header">
          <HiSparkles size={16} />
          <span>AI Summary</span>
        </div>
        <div className="ai-panel__summary">
          {summary?.summaryLines?.length > 0 ? (
            summary.summaryLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))
          ) : (
            <p className="text-muted">
              This video covers &ldquo;{video.title}&rdquo;
              {video.channel_title ? ` by ${video.channel_title}` : ''}.
              Watch the full video for detailed content and explanations.
            </p>
          )}
        </div>
      </div>

      {/* Timestamps */}
      {summary?.timestamps?.length > 0 && (
        <div className="ai-panel__section">
          <div className="ai-panel__section-header">
            <span>📋</span>
            <span>Chapters</span>
          </div>
          <div className="ai-panel__timestamps">
            {summary.timestamps.map((ts, i) => (
              <div key={i} className="ai-panel__ts-item">
                <span className="ai-panel__ts-time">{ts.time}</span>
                <span className="ai-panel__ts-label">{ts.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Topics */}
      {summary?.topics?.length > 0 && (
        <div className="ai-panel__section">
          <div className="ai-panel__section-header">
            <span>🏷️</span>
            <span>Key Topics</span>
          </div>
          <div className="ai-panel__topics">
            {summary.topics.map((topic, i) => (
              <span key={i} className="ai-panel__topic-tag">{topic}</span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="ai-panel__actions">
        <Link href={`/video/${videoId}`} className="btn btn--primary btn--sm" style={{ flex: 1 }}>
          <HiPlay size={16} /> Watch Now
        </Link>
        <a
          href={`https://youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--secondary btn--sm"
        >
          <HiExternalLink size={16} /> YouTube
        </a>
      </div>
    </div>
  );
}
