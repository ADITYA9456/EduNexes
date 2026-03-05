import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found__code">404</div>
      <h2 style={{ marginBottom: '1rem' }}>Page Not Found</h2>
      <p style={{ marginBottom: '2rem' }}>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      <Link href="/" className="btn btn--primary">Go Home</Link>
    </div>
  );
}
