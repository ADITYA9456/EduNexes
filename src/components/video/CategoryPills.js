'use client';

import { CATEGORIES } from '@/lib/constants';

export default function CategoryPills({ active, onChange }) {
  return (
    <div className="category-pills">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          className={`category-pill ${active === cat ? 'category-pill--active' : ''}`}
          onClick={() => onChange(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
