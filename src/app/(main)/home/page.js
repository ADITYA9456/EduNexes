'use client';

import AISummaryPanel from '@/components/video/AISummaryPanel';
import CategoryPills from '@/components/video/CategoryPills';
import VideoListItem, { VideoListItemSkeleton } from '@/components/video/VideoListItem';
import { useAuth } from '@/context/AuthProvider';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function HomePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState('All');
  const [nextPageToken, setNextPageToken] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Ref for infinite scroll sentinel
  const sentinelRef = useRef(null);
  // Prevent duplicate fetches
  const fetchingRef = useRef(false);

  const fetchVideos = useCallback(async (reset = false, pageToken = '') => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (category && category !== 'All') params.set('category', category);
      if (pageToken) params.set('pageToken', pageToken);

      const res = await fetch(`/api/youtube/search?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();

      if (res.ok && data.videos) {
        setVideos(reset ? data.videos : (prev) => [...prev, ...data.videos]);
        setNextPageToken(data.nextPageToken || null);
        setHasMore(!!data.nextPageToken);
        // Auto-select first video on fresh load
        if (reset && data.videos.length > 0) {
          setSelectedVideo(data.videos[0]);
        }
      } else {
        if (reset) setVideos([]);
        setHasMore(false);
      }
    } catch {
      if (reset) setVideos([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [searchQuery, category]);

  // Reset on category or search change
  useEffect(() => {
    setNextPageToken(null);
    setHasMore(true);
    setSelectedVideo(null);
    fetchVideos(true);
  }, [category, searchQuery, fetchVideos]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !fetchingRef.current && nextPageToken) {
          fetchVideos(false, nextPageToken);
        }
      },
      {
        root: null,
        rootMargin: '600px',
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, nextPageToken, fetchVideos]);

  const handleCategoryChange = (cat) => {
    setCategory(cat);
  };

  return (
    <div className="animate-fade-in">
      {/* Hero — only for guests */}
      {!searchQuery && !user && (
        <section className="hero">
          <h1>Learn. Code. <span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Level Up.</span></h1>
          <p>AI-curated educational videos and a competitive coding platform — all in one place.</p>
        </section>
      )}

      {searchQuery && (
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>
          Results for &quot;{searchQuery}&quot;
        </h2>
      )}

      {/* Category Filter */}
      <CategoryPills active={category} onChange={handleCategoryChange} />

      {/* Split Layout: Video List + AI Summary */}
      <div className="home-split" style={{ marginTop: 'var(--space-lg)' }}>
        {/* Video List */}
        <div className="vlist">
          {loading && videos.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <VideoListItemSkeleton key={i} />
            ))
          ) : videos.length === 0 ? (
            <div className="loading-container" style={{ minHeight: 200 }}>
              <p className="text-muted">No videos found</p>
            </div>
          ) : (
            videos.map((video) => (
              <VideoListItem
                key={video.id || video.youtube_id}
                video={video}
                isSelected={(selectedVideo?.youtube_id || selectedVideo?.id) === (video.youtube_id || video.id)}
                onSelect={setSelectedVideo}
              />
            ))
          )}

          {/* Loading more indicator */}
          {loadingMore && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-md)' }}>
              <div className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {hasMore && <div ref={sentinelRef} style={{ height: 10 }} />}
        </div>

        {/* AI Summary Panel */}
        <AISummaryPanel video={selectedVideo} />
      </div>
    </div>
  );
}
