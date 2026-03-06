'use client';

import { useAuth } from '@/context/AuthProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    HiChartBar,
    HiCode,
    HiHome,
    HiShieldCheck,
    HiUpload,
    HiUser,
    HiX
} from 'react-icons/hi';
import { HiTrophy } from 'react-icons/hi2';

const NAV_ITEMS = [
  { section: 'Main', links: [
    { href: '/home', label: 'Home', icon: HiHome },
    { href: '/coding', label: 'Coding Practice', icon: HiCode },
    { href: '/contests', label: 'Contests', icon: HiTrophy },
    { href: '/leaderboard', label: 'Leaderboard', icon: HiChartBar },
  ]},
  { section: 'You', links: [
    { href: '/profile', label: 'Profile', icon: HiUser, auth: true },
    { href: '/upload', label: 'Upload Video', icon: HiUpload, auth: true },
  ]},
];

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();

  // Only close sidebar on mobile (overlay mode), not on desktop
  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="sidebar__overlay" onClick={onClose} />}

      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        {/* Mobile close header */}
        <div className="sidebar__header">
          <div className="sidebar__title">
            <span>🎓</span> EduNexes
          </div>
          <button className="sidebar__close-btn" onClick={onClose} aria-label="Close sidebar">
            <HiX size={20} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map(({ section, links }) => (
            <div key={section} className="sidebar__section">
              <div className="sidebar__section-title">{section}</div>
              {links.map(({ href, label, icon: Icon, auth: requiresAuth }) => {
                if (requiresAuth && !user) return null;
                const isActive = pathname === href || (href !== '/home' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                    onClick={handleLinkClick}
                    title={label}
                  >
                    <Icon size={20} className="sidebar__link-icon" />
                    <span className="sidebar__link-text">{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}

          {isAdmin && (
            <div className="sidebar__section">
              <div className="sidebar__section-title">Admin</div>
              <Link
                href="/admin"
                className={`sidebar__link ${pathname === '/admin' ? 'sidebar__link--active' : ''}`}
                onClick={handleLinkClick}
                title="Admin Panel"
              >
                <HiShieldCheck size={20} className="sidebar__link-icon" />
                <span className="sidebar__link-text">Admin Panel</span>
              </Link>
            </div>
          )}
        </nav>

        <div className="sidebar__footer">
          <p className="sidebar__footer-text">© {new Date().getFullYear()} EduNexes</p>
          <p className="sidebar__footer-text">AI-Powered Learning</p>
        </div>
      </aside>
    </>
  );
}
