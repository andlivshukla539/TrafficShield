'use client';

import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import GlassCard from './GlassCard';

export default function AlgoInfo({ currentAlgoId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/algorithms')
      .then(res => res.json())
      .then(algos => {
        const found = algos.find(a => a.key === currentAlgoId);
        setData(found || null);
      });
  }, [currentAlgoId]);

  if (!data) return (
    <GlassCard className="mt-6" hover3d={false}>
      <div className="animate-pulse flex space-x-4">
        <div className="flex-1 space-y-4 py-1">
          <div className="h-4 bg-surface rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-surface rounded"></div>
            <div className="h-4 bg-surface rounded w-5/6"></div>
          </div>
        </div>
      </div>
    </GlassCard>
  );

  return (
    <GlassCard className="mt-6" hover3d={false}>
      <h3 className="text-sm font-semibold mb-4 text-text-secondary flex items-center gap-2">
        <BookOpen className="w-4 h-4" /> Algorithm Details
      </h3>
      
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <span>{data.icon}</span> {data.name}
          </h4>
          <p className="text-text-muted text-sm">{data.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="bg-white/3 border border-white/8 rounded-lg p-3">
            <h5 className="text-xs font-bold text-white/80 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>✅</span> Strengths
            </h5>
            <ul className="space-y-1.5 text-sm text-text-secondary">
              {data.pros.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-white/30 mt-0.5">•</span> {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white/2 border border-white/6 rounded-lg p-3">
            <h5 className="text-xs font-bold text-white/60 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>⚠️</span> Trade-offs
            </h5>
            <ul className="space-y-1.5 text-sm text-text-secondary">
              {data.cons.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-white/20 mt-0.5">•</span> {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
