'use client';

import VideoCard from '@/components/video/VideoCard';
import { formatCount, timeAgo } from '@/lib/utils';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HiChevronDown, HiChevronUp, HiExternalLink } from 'react-icons/hi';

export default function VideoPage() {
  const { id } = useParams();

  const [video, setVideo] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/youtube/video?id=${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          setVideo(data.video);
          setRelated(data.related || []);
        } else {
          // Fallback: just embed the video
          setVideo({
            youtube_id: id,
            title: 'Video',
            description: '',
            channel_title: '',
            tags: [],
            category: '',
            view_count: 0,
          });
        }
      } catch {
        setVideo({
          youtube_id: id,
          title: 'Video',
          description: '',
          channel_title: '',
          tags: [],
          category: '',
          view_count: 0,
        });
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!video) return <div className="loading-container"><p>Video not found</p></div>;

  return (
    <div className="video-player animate-fade-in">
      {/* Main Column */}
      <div className="video-player__main">
        {/* Embedded Player */}
        <div className="video-player__iframe-wrap">
          <iframe
            src={`https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={video.title}
          />
        </div>

        {/* Info */}
        <div className="video-player__info">
          <h1 className="video-player__title">{video.title}</h1>

          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div className="video-player__channel">
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                {(video.channel_title || 'C')[0]}
              </div>
              <div>
                <div className="video-player__channel-name">{video.channel_title}</div>
                <div className="text-muted text-sm">{formatCount(video.view_count)} views • {timeAgo(video.published_at)}</div>
              </div>
            </div>

            <div className="flex gap-sm">
              <a
                href={`https://youtube.com/watch?v=${video.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--secondary btn--sm"
              >
                <HiExternalLink size={16} /> YouTube
              </a>
            </div>
          </div>

          {/* Description */}
          {video.description && (
            <div className="card" style={{ cursor: 'pointer' }} onClick={() => setDescExpanded(!descExpanded)}>
              <div className={`video-player__description ${descExpanded ? 'video-player__description--expanded' : ''}`}>
                {video.description}
              </div>
              <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }}>
                {descExpanded ? <><HiChevronUp size={16} /> Show less</> : <><HiChevronDown size={16} /> Show more</>}
              </button>
            </div>
          )}

          {/* Tags */}
          {video.tags?.length > 0 && (
            <div className="video-player__tags">
              {video.tags.map((tag) => (
                <span key={tag} className="badge badge--accent">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar — Related */}
      <div className="video-player__sidebar">
        <h3>Related Videos</h3>
        {related.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {related.map((v) => (
              <VideoCard key={v.youtube_id} video={v} compact />
            ))}
          </div>
        ) : (
          <p className="text-muted">No related videos found</p>
        )}
      </div>
    </div>
  );
}
