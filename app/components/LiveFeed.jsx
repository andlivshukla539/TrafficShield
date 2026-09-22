'use client';

import { useRef } from 'react';
import GlassCard from './GlassCard';

export default function LiveFeed({ feed }) {
  const containerRef = useRef(null);

  return (
    <GlassCard className="h-[400px] flex flex-col" hover3d={false}>
      <h3 className="text-sm font-semibold mb-4 text-text-secondary">📡 Live Geo-IP Request Feed</h3>
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto pr-2 space-y-2 flex flex-col"
      >
        {feed.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm border border-dashed border-border rounded-lg">
            Waiting for traffic engine...
          </div>
        ) : (
          feed.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 border border-border text-sm feed-slide-in"
            >
              <div className="flex items-center gap-3">
                <span className="text-text-muted text-xs font-mono">{item.time}</span>
                <span className="text-text-secondary">{item.route}</span>
                <span className="text-white/60 font-mono">{item.ip}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-text-muted font-mono">{item.remaining}/{item.limit}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  item.allowed ? 'bg-white/10 text-white border border-white/20' : 'bg-white/3 text-white/40 border border-white/8'
                }`}>
                  {item.allowed ? '✓ ALLOWED' : '✕ BLOCKED'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
