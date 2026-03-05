'use client';

export default function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="loading-container" style={{ textAlign: 'center' }}>
      <span style={{ fontSize: '3rem' }}>{icon}</span>
      <h3 style={{ marginTop: '1rem' }}>{title}</h3>
      {message && <p className="text-muted" style={{ marginTop: '0.5rem' }}>{message}</p>}
      {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
    </div>
  );
}
