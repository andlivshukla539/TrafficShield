'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/app/lib/utils';
import { Shield, CheckCircle2, Ban, Activity } from 'lucide-react';

function StatCard({ title, value, icon: Icon, colorClass, textClass, delay }) {
  const cardRef = useRef(null);
  const valRef = useRef(null);
  const prevValue = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('gsap').then(({ gsap }) => {
        gsap.from(cardRef.current, {
          opacity: 0,
          y: 20,
          duration: 0.6,
          delay,
          ease: 'back.out(1.5)'
        });
      });
    }
  }, [delay]);

  useEffect(() => {
    if (!valRef.current) return;
    
    const numericValue = parseFloat(value) || 0;
    const isPercentage = String(value).includes('%');

    if (typeof window !== 'undefined') {
      import('gsap').then(({ gsap }) => {
        gsap.fromTo(valRef.current, 
          { textContent: prevValue.current },
          {
            textContent: numericValue,
            duration: 0.4,
            snap: { textContent: 1 },
            ease: 'power1.out',
            onUpdate: function() {
              if (isPercentage && valRef.current) {
                valRef.current.textContent = valRef.current.textContent + '%';
              }
            }
          }
        );
      });
    }
    prevValue.current = numericValue;
  }, [value]);

  return (
    <div ref={cardRef} className="glass-card flex items-center p-5">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mr-4", colorClass)}>
        <Icon className={cn("w-6 h-6", textClass)} />
      </div>
      <div>
        <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">{title}</div>
        <div ref={valRef} className={cn("text-2xl font-bold mt-1", textClass)}>{value}</div>
      </div>
    </div>
  );
}

export default function MetricsCards({ metrics }) {
  const { total = 0, allowed = 0, blocked = 0 } = metrics || {};
  const rate = total > 0 ? Math.round((allowed / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard 
        title="Total Requests" 
        value={total} 
        icon={Activity} 
        colorClass="bg-white/5" 
        textClass="text-white" 
        delay={0.1} 
      />
      <StatCard 
        title="Allowed" 
        value={allowed} 
        icon={CheckCircle2} 
        colorClass="bg-white/8" 
        textClass="text-white/90" 
        delay={0.2} 
      />
      <StatCard 
        title="Blocked" 
        value={blocked} 
        icon={Ban} 
        colorClass="bg-white/3" 
        textClass="text-white/50" 
        delay={0.3} 
      />
      <StatCard 
        title="Allow Rate" 
        value={`${rate}%`} 
        icon={Shield} 
        colorClass="bg-white/5" 
        textClass="text-white/80" 
        delay={0.4} 
      />
    </div>
  );
}
