'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from '@/app/components/AuthProvider';
import TopBar from '@/app/components/TopBar';
import ControlPanel from '@/app/components/ControlPanel';
import MetricsCards from '@/app/components/MetricsCards';
import LiveFeed from '@/app/components/LiveFeed';
import AlgoInfo from '@/app/components/AlgoInfo';
import GlassCard from '@/app/components/GlassCard';
import { Activity, BarChart3 } from 'lucide-react';

const FloatingGrid = dynamic(() => import('@/app/components/FloatingGrid'), { ssr: false });
const TrafficChart = dynamic(() => import('@/app/components/TrafficChart'), { ssr: false });
const HistoryChart = dynamic(() => import('@/app/components/HistoryChart'), { ssr: false });

function DashboardInner() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const router = useRouter();
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentAlgoId, setCurrentAlgoId] = useState('token_bucket');
  const [feed, setFeed] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, allowed: 0, blocked: 0 });
  
  const trafficIntervalRef = useRef(null);
  const metricsIntervalRef = useRef(null);
  const engineConfigRef = useRef({ rps: 5, trafficRate: 1 });

  // ─── Centralized metrics polling (single fetch for all children) ──────
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics');
        const data = await res.json();
        setMetrics(data);
      } catch (err) {}
    };

    fetchMetrics();
    metricsIntervalRef.current = setInterval(fetchMetrics, 1000);
    return () => clearInterval(metricsIntervalRef.current);
  }, []);

  // Handle configuration changes from ControlPanel
  const handleConfigUpdate = useCallback((newConfig) => {
    engineConfigRef.current = newConfig;
    setCurrentAlgoId(newConfig.algorithm);
  }, []);

  const fireRequest = useCallback(async () => {
    try {
      const time = new Date().toLocaleTimeString();
      const isLogin = Math.random() > 0.8;
      const route = isLogin ? '/api/login' : '/api/data';
      
      const ip = `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;

      const res = await fetch(route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-simulated-ip': ip
        },
        body: JSON.stringify({ userId: 'demo_user' })
      });

      const data = await res.json();
      const allowed = res.ok;

      setFeed(prev => {
        const newItem = {
          id: Math.random().toString(36).substr(2, 9),
          time,
          route,
          ip,
          allowed,
          remaining: data.remaining || 0,
          limit: data.limit || 0
        };
        return [newItem, ...prev].slice(0, 30);
      });
    } catch (e) {
      // Ignore network errors in demo
    }
  }, []);

  // Start/Stop engine effect
  useEffect(() => {
    if (isRunning) {
      const rate = engineConfigRef.current.trafficRate || 1;
      const intervalMs = Math.max(40, Math.floor(1000 / rate));
      trafficIntervalRef.current = setInterval(fireRequest, intervalMs);
    } else {
      if (trafficIntervalRef.current) {
        clearInterval(trafficIntervalRef.current);
        trafficIntervalRef.current = null;
      }
    }

    return () => {
      if (trafficIntervalRef.current) {
        clearInterval(trafficIntervalRef.current);
        trafficIntervalRef.current = null;
      }
    };
  }, [isRunning, fireRequest]);

  // Restart engine when config changes while running
  useEffect(() => {
    if (isRunning && trafficIntervalRef.current) {
      clearInterval(trafficIntervalRef.current);
      const rate = engineConfigRef.current.trafficRate || 1;
      const intervalMs = Math.max(40, Math.floor(1000 / rate));
      trafficIntervalRef.current = setInterval(fireRequest, intervalMs);
    }
  }, [currentAlgoId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (isAuthenticated && user && user.isVerified === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <GlassCard className="max-w-md w-full p-8 text-center" hover3d={false}>
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mx-auto mb-4">
            <span className="text-2xl">✉️</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Verify Your Email</h2>
          <p className="text-sm text-text-muted mb-6">
            We sent a verification link to <strong>{user.email}</strong>. Please click the link to access your dashboard.
          </p>
          <button onClick={() => { logout(); router.push('/'); }} className="text-white/70 text-sm hover:underline">
            Back to Login
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <>
      <FloatingGrid />
      
      <div className="relative z-10 min-h-screen p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <TopBar />

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Sidebar / Control Panel */}
          <div className="xl:col-span-1 flex flex-col gap-6">
            <ControlPanel 
              isRunning={isRunning} 
              setIsRunning={setIsRunning} 
              onConfigUpdate={handleConfigUpdate} 
            />
            <AlgoInfo currentAlgoId={currentAlgoId} />
          </div>

          {/* Main Content Area */}
          <div className="xl:col-span-3 flex flex-col">
            <MetricsCards metrics={metrics} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <GlassCard className="flex flex-col" hover3d={false}>
                <h3 className="text-sm font-semibold mb-4 text-text-secondary flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Real-Time Traffic Flow
                </h3>
                <div className="flex-1 min-h-[300px]">
                  <TrafficChart metrics={metrics} />
                </div>
              </GlassCard>

              <LiveFeed feed={feed} />
            </div>

            <GlassCard hover3d={false}>
              <h3 className="text-sm font-semibold mb-4 text-text-secondary flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> 24-Hour Traffic History
              </h3>
              <div className="min-h-[200px]">
                <HistoryChart />
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  return (
    <AuthProvider>
      <DashboardInner />
    </AuthProvider>
  );
}
