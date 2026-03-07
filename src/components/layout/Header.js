'use client';

import { useAuth } from '@/context/AuthProvider';
import { useTheme } from '@/context/ThemeProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
    HiLogout,
    HiMenu,
    HiMoon,
    HiSearch,
    HiShieldCheck,
    HiSun,
    HiUpload,
    HiUser
} from 'react-icons/hi';

export default function Header({ onToggleSidebar }) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/home?search=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await signOut();
    window.location.href = '/login';
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header className="header">
      {/* Left */}
      <div className="header__left">
        <button className="header__menu-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <HiMenu size={22} />
        </button>
        <Link href="/home" className="header__logo">
          <span className="header__logo-icon">🎓</span>
          <span className="header__logo-text">EduNexes</span>
        </Link>
      </div>

      {/* Center — Search */}
      <div className="header__center">
        <form className="header__search" onSubmit={handleSearch}>
          <input
            className="header__search-input"
            placeholder="Search educational videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="header__search-btn" aria-label="Search">
            <HiSearch size={18} />
          </button>
        </form>
      </div>

      {/* Right */}
      <div className="header__right">
        {user && (
          <Link href="/upload" className="header__icon-btn hide-mobile" title="Upload">
            <HiUpload size={20} />
          </Link>
        )}

        <button className="header__icon-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? <HiSun size={20} /> : <HiMoon size={20} />}
        </button>

        {user ? (
          <div className="header__user-menu" ref={dropdownRef}>
            <button
              className="header__avatar-btn"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-label="User menu"
            >
              {profile?.avatar_url ? (
                <img className="header__avatar" src={profile.avatar_url} alt="Avatar" />
              ) : (
                <div className="header__avatar header__avatar--default">{initials}</div>
              )}
            </button>

            {dropdownOpen && (
              <div className="header__dropdown">
                <div className="header__dropdown-header">
                  <div className="header__dropdown-name">{profile?.full_name || 'User'}</div>
                  <div className="header__dropdown-email">{user.email}</div>
                </div>
                <div className="header__dropdown-divider" />
                <Link href="/profile" className="header__dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <HiUser size={18} /> Profile
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="header__dropdown-item" onClick={() => setDropdownOpen(false)}>
                    <HiShieldCheck size={18} /> Admin Panel
                  </Link>
                )}
                <div className="header__dropdown-divider" />
                <button className="header__dropdown-item header__dropdown-item--danger" onClick={handleLogout}>
                  <HiLogout size={18} /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="header__auth-btns">
            <Link href="/login" className="btn btn--ghost btn--sm">Sign In</Link>
            <Link href="/signup" className="btn btn--primary btn--sm">Sign Up</Link>
          </div>
        )}
      </div>
    </header>
  );
}
