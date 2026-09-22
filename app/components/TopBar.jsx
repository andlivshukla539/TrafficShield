'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/app/lib/utils';
import { Shield, LayoutDashboard, Key, Gamepad2, LogOut } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function TopBar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [status, setStatus] = useState({ online: false, text: 'Connecting...' });
  const [algo, setAlgo] = useState('Token Bucket');

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setStatus({
          online: data.redis || data.memoryStore,
          text: data.redis ? 'Redis Online' : 'Memory Store',
        });
        if (data.algorithm) {
          setAlgo(data.algorithm.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
        }
      } catch {
        setStatus({ online: false, text: 'Server Offline' });
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/keys', label: 'API Keys', icon: Key },
    { href: '/playground', label: 'Playground', icon: Gamepad2 },
  ];

  return (
    <header className="glass-card flex items-center justify-between px-6 py-3.5 mb-6">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-white" />
        <h1 className="text-lg font-bold gradient-text tracking-tight">TrafficShield</h1>
        <span className="px-2 py-0.5 rounded text-[0.6rem] font-bold tracking-widest bg-gradient-to-r from-white to-gray-400 text-black">
          PRO
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex gap-1 bg-black/20 p-1 rounded-lg border border-border">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200',
              pathname === href
                ? 'text-white bg-white/8'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Status + User */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <div className={cn(
            'w-2 h-2 rounded-full status-pulse',
            status.online
              ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]'
              : 'bg-gray-600 shadow-[0_0_8px_rgba(100,100,100,0.3)]'
          )} />
          <span>{status.text}</span>
          <span className="text-text-muted mx-0.5">│</span>
          <span>{algo}</span>
        </div>

        {user && (
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-white hover:bg-white/10 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
