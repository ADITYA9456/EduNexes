'use client';

import CategoryPills from '@/components/video/CategoryPills';
import VideoGrid from '@/components/video/VideoGrid';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function HomePage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState('All');
  const [nextPageToken, setNextPageToken] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Ref for infinite scroll sentinel
  const sentinelRef = useRef(null);
  // Prevent duplicate fetches
  const fetchingRef = useRef(false);
  // Scroll container ref
  const scrollContainerRef = useRef(null);

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

      const res = await fetch(`/api/youtube/search?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.videos) {
        setVideos((prev) => reset ? data.videos : [...prev, ...data.videos]);
        setNextPageToken(data.nextPageToken || null);
        setHasMore(!!data.nextPageToken);
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
    fetchVideos(true);
  }, [category, searchQuery, fetchVideos]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Find the actual scroll container (.layout__content)
    if (!scrollContainerRef.current) {
      scrollContainerRef.current = sentinel.closest('.layout__content') || null;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !fetchingRef.current && nextPageToken) {
          fetchVideos(false, nextPageToken);
        }
      },
      {
        root: scrollContainerRef.current,
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
      {/* Hero */}
      {!searchQuery && (
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

      {/* Video Grid */}
      <div style={{ marginTop: 'var(--space-lg)' }}>
        <VideoGrid videos={videos} loading={loading && videos.length === 0} />
      </div>

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="loading-container" style={{ minHeight: 80 }}>
          <div className="spinner" />
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && <div ref={sentinelRef} style={{ height: 10 }} />}
    </div>
  );
}
