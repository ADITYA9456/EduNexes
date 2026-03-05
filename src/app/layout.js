import { AuthProvider } from '@/context/AuthProvider';
import { ThemeProvider } from '@/context/ThemeProvider';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'EduNexes — AI-Powered Learning & Coding Platform',
  description: 'Premium educational platform with AI-curated videos, coding practice, contests, and gamification.',
  keywords: ['education', 'coding', 'programming', 'AI', 'learning'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: 'toast-custom',
                style: {
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
