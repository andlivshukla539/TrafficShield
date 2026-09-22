'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import TopBar from '@/app/components/TopBar';
import GlassCard from '@/app/components/GlassCard';
import { AuthProvider } from '@/app/components/AuthProvider';
import { Gamepad2, Zap, Send } from 'lucide-react';
import { cn } from '@/app/lib/utils';

// Lazy load 3D canvas to avoid SSR issues
const Playground3D = dynamic(() => import('@/app/components/playground/Playground3D'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-text-muted">
      Loading 3D visualization...
    </div>
  )
});

function PlaygroundInner() {
  const [activeAlgo, setActiveAlgo] = useState('token_bucket');
  const [tokens, setTokens] = useState(10);
  const [capacity] = useState(10);
  const [logs, setLogs] = useState([]);
  
  // Simulate refill / drain
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeAlgo === 'token_bucket') {
        setTokens(prev => Math.min(capacity, prev + 1));
      } else if (activeAlgo === 'leaky_bucket') {
        setTokens(prev => Math.max(0, prev - 1));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeAlgo, capacity]);

  const addLog = useCallback((log) => {
    setLogs(prev => [{ ...log, id: Date.now() + Math.random() }, ...prev].slice(0, 10));
  }, []);

  const sendRequest = useCallback(() => {
    const time = new Date().toLocaleTimeString();
    setTokens(prev => {
      if (activeAlgo === 'token_bucket') {
        if (prev > 0) {
          addLog({ time, status: 'ALLOWED', msg: 'Token consumed' });
          return prev - 1;
        } else {
          addLog({ time, status: 'BLOCKED', msg: 'No tokens available' });
          return prev;
        }
      } else {
        if (prev < capacity) {
          addLog({ time, status: 'ALLOWED', msg: 'Request queued' });
          return prev + 1;
        } else {
          addLog({ time, status: 'BLOCKED', msg: 'Queue full' });
          return prev;
        }
      }
    });
  }, [activeAlgo, capacity, addLog]);

  const sendBurst = useCallback(() => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => sendRequest(), i * 120);
    }
  }, [sendRequest]);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto flex flex-col">
      <TopBar />

      <div className="flex justify-between items-center mb-6 mt-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Gamepad2 className="w-6 h-6 text-white/70" /> 
          Algorithm Playground
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Controls */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <GlassCard hover3d={false}>
            <h3 className="font-semibold mb-4 text-text-secondary">Select Algorithm</h3>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => { setActiveAlgo('token_bucket'); setTokens(10); setLogs([]); }}
                className={cn("p-3 rounded-lg text-left transition-all border", activeAlgo === 'token_bucket' ? "bg-white/8 border-white/25 shadow-[0_0_15px_rgba(255,255,255,0.08)] text-white" : "bg-black/20 border-border text-text-muted hover:text-white")}
              >
                <div className="font-bold mb-1">🪣 Token Bucket</div>
                <div className="text-xs opacity-80">Tokens are added at a constant rate. Good for handling bursts.</div>
              </button>
              <button 
                onClick={() => { setActiveAlgo('leaky_bucket'); setTokens(0); setLogs([]); }}
                className={cn("p-3 rounded-lg text-left transition-all border", activeAlgo === 'leaky_bucket' ? "bg-white/6 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.06)] text-white" : "bg-black/20 border-border text-text-muted hover:text-white")}
              >
                <div className="font-bold mb-1">💧 Leaky Bucket</div>
                <div className="text-xs opacity-80">Requests are processed at a constant rate. Smooths out traffic.</div>
              </button>
            </div>
          </GlassCard>

          <GlassCard hover3d={false} className="flex flex-col gap-4">
            <h3 className="font-semibold text-text-secondary">Actions</h3>
            
            {/* Token/Queue status bar */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-text-muted uppercase tracking-wider">
                {activeAlgo === 'token_bucket' ? 'Tokens' : 'Queue'}
              </span>
              <span className={cn("text-sm font-bold font-mono", tokens > 3 ? 'text-white' : tokens > 0 ? 'text-white/60' : 'text-white/30')}>
                {tokens} / {capacity}
              </span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-border">
              <div 
                className="h-full rounded-full transition-all duration-300 bg-white"
                style={{ width: `${(tokens / capacity) * 100}%` }}
              />
            </div>

            <button onClick={sendRequest} className="btn-gradient flex items-center justify-center gap-2 py-3 text-sm">
              <Send className="w-4 h-4" /> Send Single Request
            </button>
            <button onClick={sendBurst} className="bg-white/10 text-white/80 border border-white/20 hover:bg-white/15 rounded-md py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all">
              <Zap className="w-4 h-4" /> Send Burst (5x)
            </button>
          </GlassCard>

          <GlassCard hover3d={false} className="flex-1 min-h-[200px]">
            <h3 className="font-semibold text-text-secondary mb-3">Simulation Logs</h3>
            <div className="space-y-2 text-sm">
              {logs.length === 0 ? (
                <div className="text-text-muted text-xs p-3 border border-dashed border-border rounded-lg text-center">
                  Click &quot;Send Request&quot; to start...
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex justify-between items-center p-2 rounded bg-black/20 border border-border feed-slide-in">
                    <span className="text-text-muted font-mono text-xs">{log.time}</span>
                    <span className={log.status === 'ALLOWED' ? 'text-white font-bold text-xs' : 'text-white/40 font-bold text-xs'}>{log.status}</span>
                    <span className="text-xs text-text-secondary">{log.msg}</span>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* 3D Visualization */}
        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden border border-border shadow-glass bg-black/40 min-h-[500px]">
          <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-sm">
            Drag to rotate • Scroll to zoom
          </div>
          <Playground3D activeAlgo={activeAlgo} tokens={tokens} capacity={capacity} />
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <AuthProvider>
      <PlaygroundInner />
    </AuthProvider>
  );
}
