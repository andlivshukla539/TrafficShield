'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { cn } from '@/app/lib/utils';
import { AuthProvider, useAuth } from '@/app/components/AuthProvider';
import { Shield, Zap, BarChart3, Key, Server } from 'lucide-react';

const ParticleSphere = dynamic(() => import('@/app/components/ParticleSphere'), { ssr: false });

function AuthPageInner() {
  const [activeTab, setActiveTab] = useState('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, isAuthenticated } = useAuth();
  const router = useRouter();
  const cardRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('gsap').then(({ gsap }) => {
        if (cardRef.current) {
          gsap.from(cardRef.current, { opacity: 0, y: 60, duration: 1, ease: 'back.out(1.4)' });
        }
        if (headerRef.current) {
          gsap.from(headerRef.current.children, {
            opacity: 0, y: -20, duration: 0.6, stagger: 0.1, delay: 0.3, ease: 'power2.out',
          });
        }
      });
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    const form = new FormData(e.target);
    const result = await login(form.get('email'), form.get('password'));
    setLoading(false);
    if (result.success) {
      setSuccess('Login successful! Redirecting...');
      setTimeout(() => router.push('/dashboard'), 800);
    } else {
      setError(result.error);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    const form = new FormData(e.target);
    const result = await signup(form.get('name'), form.get('email'), form.get('password'));
    setLoading(false);
    if (result.success) {
      setSuccess('Account created! Redirecting...');
      setTimeout(() => router.push('/dashboard'), 800);
    } else {
      setError(result.error);
    }
  };

  const features = [
    { icon: Zap, label: '5 Algorithms' },
    { icon: Shield, label: 'WAF Security' },
    { icon: BarChart3, label: 'Analytics' },
    { icon: Key, label: 'API Keys' },
    { icon: Server, label: 'Gateway' },
  ];

  return (
    <>
      <ParticleSphere />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div ref={cardRef} className="glass-card w-full max-w-[440px] p-10">
          <div ref={headerRef} className="text-center mb-8">
            <span className="text-4xl block mb-3">🛡️</span>
            <h1 className="text-2xl font-bold gradient-text mb-1.5">TrafficShield</h1>
            <p className="text-text-secondary text-sm">Production-grade distributed API protection</p>

            <div className="flex flex-wrap gap-1.5 justify-center mt-4">
              {features.map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-medium text-text-muted bg-white/3 border border-border">
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex mb-7 rounded-lg overflow-hidden border border-border">
            {['login', 'signup'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
                className={cn(
                  'flex-1 py-2.5 text-center text-sm font-semibold transition-all',
                  activeTab === tab
                    ? 'bg-white/8 text-white'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
                )}
              >
                {tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <div className="px-3.5 py-2.5 mb-4 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm feed-slide-in">
              {error}
            </div>
          )}
          {success && (
            <div className="px-3.5 py-2.5 mb-4 rounded-lg bg-white/10 border border-white/20 text-white text-sm feed-slide-in">
              {success}
            </div>
          )}

          {/* Login Form */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Email</label>
                <input
                  name="email" type="email" required autoComplete="email"
                  placeholder="you@example.com"
                  className="px-3.5 py-3 bg-black/30 border border-border rounded-lg text-white text-sm outline-none focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.05)] transition-all placeholder:text-text-muted"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Password</label>
                <input
                  name="password" type="password" required autoComplete="current-password"
                  placeholder="••••••••"
                  className="px-3.5 py-3 bg-black/30 border border-border rounded-lg text-white text-sm outline-none focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.05)] transition-all placeholder:text-text-muted"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-gradient py-3.5 text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Signup Form */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Name</label>
                <input
                  name="name" type="text" autoComplete="name"
                  placeholder="Your Name"
                  className="px-3.5 py-3 bg-black/30 border border-border rounded-lg text-white text-sm outline-none focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.05)] transition-all placeholder:text-text-muted"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Email</label>
                <input
                  name="email" type="email" required autoComplete="email"
                  placeholder="you@example.com"
                  className="px-3.5 py-3 bg-black/30 border border-border rounded-lg text-white text-sm outline-none focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.05)] transition-all placeholder:text-text-muted"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Password</label>
                <input
                  name="password" type="password" required autoComplete="new-password" minLength={6}
                  placeholder="Min 6 characters"
                  className="px-3.5 py-3 bg-black/30 border border-border rounded-lg text-white text-sm outline-none focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.05)] transition-all placeholder:text-text-muted"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-gradient py-3.5 text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Skip Link */}
          <div className="text-center mt-3">
            <a href="/dashboard" className="text-text-muted text-[0.78rem] hover:text-white transition-colors">
              Skip to Dashboard (Demo Mode) →
            </a>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 pt-4 border-t border-border">
            <p className="text-text-muted text-xs">
              Built by{' '}
              <a href="https://github.com/andlivshukla539" target="_blank" rel="noopener noreferrer" className="text-white/70 font-medium">
                Andliv Shukla
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AuthPage() {
  return (
    <AuthProvider>
      <AuthPageInner />
    </AuthProvider>
  );
}
