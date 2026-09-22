'use client';

import { useRef, useCallback } from 'react';
import { cn } from '@/app/lib/utils';

export default function GlassCard({ children, className, hover3d = true, ...props }) {
  const cardRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!hover3d || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    cardRef.current.style.transform = `perspective(800px) rotateX(${y * -6}deg) rotateY(${x * 6}deg)`;
  }, [hover3d]);

  const handleMouseLeave = useCallback(() => {
    if (!hover3d || !cardRef.current) return;
    cardRef.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
  }, [hover3d]);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('glass-card transition-transform duration-400', className)}
      style={{ willChange: 'transform' }}
      {...props}
    >
      {children}
    </div>
  );
}
