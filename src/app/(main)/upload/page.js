'use client';

import { useAuth } from '@/context/AuthProvider';
import { CATEGORIES } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { HiCheckCircle, HiLightningBolt, HiLink, HiUpload, HiXCircle } from 'react-icons/hi';

const STEPS = ['Enter URL', 'Details', 'Submit'];

export default function UploadPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');

  // AI verification result
  const [verification, setVerification] = useState(null);
  const [verifying, setVerifying] = useState(false);

  // Extract YouTube video ID from URL
  const extractVideoId = (url) => {
    const patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  };

  const handleUrlSubmit = async () => {
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) return toast.error('Please enter a valid YouTube URL');

    setVerifying(true);
    try {
      const res = await fetch('/api/videos/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl, videoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setVerification(data);
      // Pre-fill from YouTube metadata
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description.slice(0, 500));
      if (data.tags?.length) setTags(data.tags.join(', '));
      setStep(1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Title is required');
    if (!category) return toast.error('Please select a category');

    const videoId = extractVideoId(youtubeUrl);
    setSubmitting(true);

    try {
      const res = await fetch('/api/videos/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl,
          videoId,
          title: title.trim(),
          description: description.trim(),
          category,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          channelTitle: verification?.channelTitle || '',
          thumbnailUrl: verification?.thumbnailUrl || '',
          duration: verification?.duration || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      setStep(2);
      toast.success('Video submitted for review!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="upload animate-fade-in">
        <div className="upload__header">
          <h1>Upload Video</h1>
          <p className="text-muted">Sign in to submit educational videos</p>
        </div>
        <button className="btn btn--primary" onClick={() => router.push('/login')}>Sign In</button>
      </div>
    );
  }

  return (
    <div className="upload animate-fade-in">
      <div className="upload__header">
        <h1><HiUpload size={28} /> Submit a Video</h1>
        <p className="text-muted">Share educational content with the community</p>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-md" style={{ marginBottom: 'var(--space-xl)', justifyContent: 'center' }}>
        {STEPS.map((label, i) => (
          <div key={label} className="flex gap-sm" style={{ alignItems: 'center', opacity: step >= i ? 1 : 0.4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: step > i ? 'var(--success)' : step === i ? 'var(--accent)' : 'var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 600, fontSize: '0.85rem',
            }}>
              {step > i ? <HiCheckCircle size={18} /> : i + 1}
            </div>
            <span className="text-sm" style={{ fontWeight: step === i ? 600 : 400 }}>{label}</span>
            {i < STEPS.length - 1 && <div style={{ width: 40, height: 2, background: step > i ? 'var(--success)' : 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* Step 0 - URL */}
      {step === 0 && (
        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>
            <HiLink size={20} /> Paste YouTube URL
          </h3>
          <div className="input-group">
            <label className="input-label">YouTube URL</label>
            <input
              className="input"
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={handleUrlSubmit}
            disabled={verifying || !youtubeUrl.trim()}
            style={{ marginTop: 'var(--space-md)', width: '100%' }}
          >
            {verifying ? (
              <><HiLightningBolt className="spin" size={16} /> Verifying with AI...</>
            ) : (
              <>Verify & Continue</>
            )}
          </button>

          {verification === false && (
            <div className="card" style={{ marginTop: 'var(--space-md)', border: '1px solid var(--danger)' }}>
              <p style={{ color: 'var(--danger)' }}><HiXCircle size={18} /> AI verification failed. The content may not be educational.</p>
            </div>
          )}
        </div>
      )}

      {/* Step 1 - Details */}
      {step === 1 && (
        <form className="card" style={{ maxWidth: 700, margin: '0 auto' }} onSubmit={handleSubmit}>
          {/* Verification result banner */}
          {verification && (
            <div className="card" style={{
              border: `1px solid ${verification.isEducational ? 'var(--success)' : 'var(--warning)'}`,
              marginBottom: 'var(--space-lg)',
              background: verification.isEducational ? 'rgba(0,206,201,0.05)' : 'rgba(253,203,110,0.05)',
            }}>
              <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                {verification.isEducational ?
                  <HiCheckCircle size={20} color="var(--success)" /> :
                  <HiXCircle size={20} color="var(--warning)" />
                }
                <strong>{verification.isEducational ? 'Educational Content Detected' : 'Warning: May Not Be Educational'}</strong>
              </div>
              <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                Confidence: {Math.round((verification.confidence || 0) * 100)}%
                {verification.reason && ` — ${verification.reason}`}
              </p>
            </div>
          )}

          {/* Thumbnail preview */}
          {verification?.thumbnailUrl && (
            <div style={{ marginBottom: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <img src={verification.thumbnailUrl} alt="Thumbnail" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Title *</label>
            <input className="input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
          </div>

          <div className="input-group">
            <label className="input-label">Category *</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} required>
              <option value="">Select a category</option>
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Tags (comma-separated)</label>
            <input className="input" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="react, javascript, tutorial" />
          </div>

          <div className="flex gap-sm" style={{ marginTop: 'var(--space-lg)' }}>
            <button type="button" className="btn btn--ghost" onClick={() => setStep(0)}>Back</button>
            <button type="submit" className="btn btn--primary" disabled={submitting} style={{ flex: 1 }}>
              {submitting ? 'Submitting...' : 'Submit Video'}
            </button>
          </div>
        </form>
      )}

      {/* Step 2 - Success */}
      {step === 2 && (
        <div className="card text-center" style={{ maxWidth: 500, margin: '0 auto', padding: 'var(--space-2xl)' }}>
          <HiCheckCircle size={64} color="var(--success)" style={{ margin: '0 auto var(--space-lg)' }} />
          <h2>Video Submitted!</h2>
          <p className="text-muted" style={{ marginTop: 'var(--space-sm)' }}>
            Your video has been submitted for review. An admin will approve it shortly.
          </p>
          <div className="flex gap-sm" style={{ justifyContent: 'center', marginTop: 'var(--space-xl)' }}>
            <button className="btn btn--primary" onClick={() => router.push('/home')}>Go Home</button>
            <button className="btn btn--secondary" onClick={() => { setStep(0); setYoutubeUrl(''); setVerification(null); setTitle(''); setDescription(''); setCategory(''); setTags(''); }}>
              Submit Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
