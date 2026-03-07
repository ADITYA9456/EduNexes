'use client';

import { formatCount, parseDuration, timeAgo, truncate } from '@/lib/utils';
import { useState } from 'react';

export default function VideoListItem({ video, isSelected, onSelect }) {
  const thumbnail = video.thumbnail_url || video.thumbnail || '';
  const title = video.title || '';
  const channel = video.channel_title || video.channel_name || '';
  const duration = parseDuration(video.duration);
  const category = video.category || '';
  const videoId = video.youtube_id || video.id;
  const createdAt = video.published_at || video.created_at;
  const views = video.view_count || 0;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`vlist-item ${isSelected ? 'vlist-item--active' : ''}`}
      onClick={() => onSelect(video)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(video); }}
    >
      <div className="vlist-item__thumb">
        {thumbnail && !imgError ? (
          <img
            src={thumbnail}
            alt={title}
            onError={() => setImgError(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div className="vlist-item__no-thumb">No Thumbnail</div>
        )}
        {duration && <span className="vlist-item__duration">{duration}</span>}
      </div>
      <div className="vlist-item__info">
        <h4 className="vlist-item__title">{truncate(title, 70)}</h4>
        <p className="vlist-item__channel">{channel}</p>
        <div className="vlist-item__meta">
          {views > 0 && <span>{formatCount(views)} views</span>}
          {createdAt && <span>{timeAgo(createdAt)}</span>}
          {category && category !== 'other' && (
            <span className="badge badge--accent">{category}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function VideoListItemSkeleton() {
  return (
    <div className="vlist-item vlist-item--skeleton">
      <div className="vlist-item__thumb skeleton" />
      <div className="vlist-item__info">
        <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '50%', marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '40%' }} />
      </div>
    </div>
  );
}
