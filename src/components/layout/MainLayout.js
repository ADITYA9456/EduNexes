'use client';

import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { useState } from 'react';

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout">
      <Header onToggleSidebar={() => setSidebarOpen((p) => !p)} />
      <div className="layout__body">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="layout__content">
          {children}
        </main>
      </div>
    </div>
  );
}
