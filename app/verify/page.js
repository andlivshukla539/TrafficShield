'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GlassCard from '@/app/components/GlassCard';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth, AuthProvider } from '@/app/components/AuthProvider';

function VerifyInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const { logout } = useAuth();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        
        if (res.ok) {
          setStatus('success');
          setTimeout(() => {
            router.push('/');
          }, 3000);
        } else {
          setStatus('error');
        }
      } catch (err) {
        setStatus('error');
      }
    };

    verifyToken();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 blur-[100px] rounded-full pointer-events-none"></div>

      <GlassCard className="max-w-md w-full p-10 text-center relative z-10" hover3d={false}>
        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
            <h2 className="text-xl font-bold text-white">Verifying your email...</h2>
            <p className="text-sm text-text-muted">Please wait while we confirm your account.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4 feed-slide-in">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center border border-white/20 mb-2">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Email Verified!</h2>
            <p className="text-sm text-text-muted">Your account is now fully active. Redirecting to login...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 feed-slide-in">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mb-2">
              <ShieldAlert className="w-8 h-8 text-white/50" />
            </div>
            <h2 className="text-xl font-bold text-white">Verification Failed</h2>
            <p className="text-sm text-text-muted">The link may be invalid or has already been used.</p>
            <button 
              onClick={() => { logout(); router.push('/'); }}
              className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 border border-border rounded-lg text-sm font-medium transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <VerifyInner />
      </Suspense>
    </AuthProvider>
  );
}
