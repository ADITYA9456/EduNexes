'use client';

import { formatCount, parseDuration, timeAgo, truncate } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';

export default function VideoCard({ video, compact = false }) {
  const thumbnail = video.thumbnail_url || video.thumbnail || '';
  const title = video.title || '';
  const channel = video.channel_title || video.channel_name || '';
  const duration = parseDuration(video.duration);
  const category = video.category || '';
  const videoId = video.youtube_id || video.id;
  const createdAt = video.published_at || video.created_at;
  const views = video.view_count || 0;

  return (
    <Link href={`/video/${videoId}`} className="video-card card-interactive">
      <div className="video-card__thumbnail">
        {thumbnail ? (
          <Image src={thumbnail} alt={title} fill sizes="(max-width: 768px) 100vw, 33vw" />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No Thumbnail
          </div>
        )}
        {duration && <span className="video-card__duration">{duration}</span>}
        {category && category !== 'other' && (
          <span className="video-card__category badge badge--accent">{category}</span>
        )}
      </div>
      <div className="video-card__body">
        <h3 className="video-card__title">{compact ? truncate(title, 60) : title}</h3>
        {channel && <p className="video-card__channel">{channel}</p>}
        <div className="video-card__meta">
          {views > 0 && <span>{formatCount(views)} views</span>}
          {createdAt && <span>{timeAgo(createdAt)}</span>}
        </div>
      </div>
    </Link>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="video-card video-card--skeleton">
      <div className="video-card__thumbnail skeleton" />
      <div className="video-card__body">
        <div className="skeleton skeleton-line" style={{ height: 14, marginBottom: 8 }} />
        <div className="skeleton skeleton-line skeleton-line--short" style={{ height: 12, width: '60%' }} />
      </div>
    </div>
  );
}
