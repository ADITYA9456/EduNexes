// Shared utility functions
import { clsx } from 'clsx';

/** Merge class names (falsy values are ignored) */
export function cn(...classes) {
  return clsx(...classes);
}

/** Format a number with K/M suffixes */
export function formatCount(num) {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

/** Format ISO date to relative time */
export function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];
  for (const i of intervals) {
    const count = Math.floor(seconds / i.seconds);
    if (count >= 1) return `${count} ${i.label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/** Slugify a string */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/** ISO 8601 duration → readable */
export function parseDuration(iso) {
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}:` : '';
  const m = match[2] ? match[2].padStart(2, '0') : '00';
  const s = match[3] ? match[3].padStart(2, '0') : '00';
  return `${h}${m}:${s}`;
}

/** Truncate text */
export function truncate(str, len = 100) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}
