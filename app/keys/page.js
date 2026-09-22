'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/app/components/AuthProvider';
import TopBar from '@/app/components/TopBar';
import GlassCard from '@/app/components/GlassCard';
import { Key, Plus, Trash2, Copy, CheckCircle2 } from 'lucide-react';

function KeysInner() {
  const { isAuthenticated, loading, token } = useAuth();
  const router = useRouter();
  const [keys, setKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (token) {
      fetchKeys();
    }
  }, [token]);

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/keys', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setKeys(data.keys || []);
      setLoadingKeys(false);

      // Animate keys in
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          import('gsap').then(({ gsap }) => {
            gsap.from('.key-card', {
              y: 20,
              opacity: 0,
              duration: 0.5,
              stagger: 0.1,
              ease: 'power2.out'
            });
          });
        }, 100);
      }
    } catch (err) {
      console.error(err);
      setLoadingKeys(false);
    }
  };

  const createKey = async () => {
    const name = prompt('Enter a name for this API Key (e.g., Production App):', 'My API Key');
    if (!name) return;

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert(`IMPORTANT: Copy your new API Key now. You won't see it again!\n\n${data.apiKey.key}`);
        fetchKeys();
      } else {
        alert(`Error: ${data.error || data.message}`);
      }
    } catch (err) {
      alert('Failed to create key.');
    }
  };

  const revokeKey = async (id) => {
    if (!confirm('Are you sure you want to revoke this API Key? Any applications using it will be blocked.')) return;

    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchKeys();
      } else {
        alert('Failed to revoke key.');
      }
    } catch (err) {
      alert('Failed to revoke key.');
    }
  };

  const copyToClipboard = (text) => {
    if (text === '[REVOKED]') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) return null;

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1000px] mx-auto">
      <TopBar />

      <div className="flex justify-between items-center mb-8 mt-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Key className="w-6 h-6 text-white" /> 
          API Keys
        </h2>
        <button 
          onClick={createKey}
          className="btn-gradient flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Create New Key
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {loadingKeys ? (
          <GlassCard hover3d={false} className="text-center py-12 text-text-muted">
            Loading keys...
          </GlassCard>
        ) : keys.length === 0 ? (
          <GlassCard hover3d={false} className="text-center py-12 border-dashed">
            <Key className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
            <p className="text-text-secondary mb-4">No API keys found.</p>
            <button onClick={createKey} className="text-white hover:underline text-sm font-medium">
              Create your first API key
            </button>
          </GlassCard>
        ) : (
          keys.map(key => (
            <GlassCard key={key.id} className="key-card flex flex-col md:flex-row justify-between items-start md:items-center p-5" hover3d={false}>
              <div className="flex flex-col gap-2 mb-4 md:mb-0">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-lg text-white">{key.name}</span>
                  {key.isActive ? (
                    <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-white/10 text-white border border-white/20">ACTIVE</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-white/3 text-white/40 border border-white/8">REVOKED</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <code className="px-3 py-1.5 rounded-md bg-black/40 border border-border font-mono text-sm text-white/60 flex-1">
                    {key.key}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(key.key)}
                    disabled={!key.isActive}
                    className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copy Key"
                  >
                    {copiedKey === key.key ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <div className="text-xs text-text-muted text-right mr-4 hidden md:block">
                  <div>Created: {new Date(key.createdAt).toLocaleDateString()}</div>
                  {key.lastUsedAt && <div>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</div>}
                </div>
                <button 
                  onClick={() => revokeKey(key.id)}
                  disabled={!key.isActive}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-text-muted hover:border-white/30 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" /> Revoke
                </button>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}

export default function KeysPage() {
  return (
    <AuthProvider>
      <KeysInner />
    </AuthProvider>
  );
}
