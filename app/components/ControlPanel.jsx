'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/app/lib/utils';
import { Play, Square, Activity, Zap, ShieldAlert, Cpu } from 'lucide-react';
import GlassCard from './GlassCard';

export default function ControlPanel({ isRunning, setIsRunning, onConfigUpdate }) {
  const [config, setConfig] = useState({ algorithm: 'token_bucket', rps: 5, windowSize: 10 });
  const [trafficRate, setTrafficRate] = useState(1);
  const [activePreset, setActivePreset] = useState(null);

  // Expose engine start/stop to parent
  useEffect(() => {
    onConfigUpdate({ ...config, trafficRate, activePreset });
  }, [config, trafficRate, activePreset]);

  // Load initial config
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setConfig(prev => ({ ...prev, ...data }));
      });
  }, []);

  const updateServerConfig = async (newConfig) => {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
  };

  const handleAlgoChange = (algo) => {
    const newConfig = { ...config, algorithm: algo };
    setConfig(newConfig);
    updateServerConfig(newConfig);
  };

  const handleRpsChange = (e) => {
    const rps = parseInt(e.target.value, 10);
    const newConfig = { ...config, rps };
    setConfig(newConfig);
    updateServerConfig(newConfig);
  };

  const handlePreset = (preset) => {
    if (activePreset === preset) {
      setActivePreset(null);
      return;
    }
    setActivePreset(preset);
    
    switch (preset) {
      case 'steady': setTrafficRate(config.rps); break;
      case 'burst': setTrafficRate(Math.min(30, config.rps * 3)); break;
      case 'spike': setTrafficRate(Math.min(30, config.rps * 4)); break;
      case 'random': setTrafficRate(Math.floor(Math.random() * 25) + 1); break;
    }
  };

  const algorithms = [
    { id: 'token_bucket', icon: '🪣', name: 'Token Bucket' },
    { id: 'leaky_bucket', icon: '💧', name: 'Leaky Bucket' },
    { id: 'fixed_window', icon: '📊', name: 'Fixed Window' },
    { id: 'sliding_window', icon: '🌊', name: 'Sliding Window' },
    { id: 'sliding_window_counter', icon: '🔄', name: 'SW Counter' },
  ];

  return (
    <GlassCard className="flex flex-col gap-6" hover3d={false}>
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Cpu className="w-5 h-5 text-white" />
        Control Panel
      </h2>

      {/* Algorithms */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Algorithm</label>
        <div className="grid grid-cols-2 gap-2">
          {algorithms.map((algo) => (
            <button
              key={algo.id}
              onClick={() => handleAlgoChange(algo.id)}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg text-sm border transition-all duration-200',
                config.algorithm === algo.id
                  ? 'bg-white/10 border-white/30 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                  : 'bg-black/20 border-border text-text-muted hover:text-white hover:border-text-secondary'
              )}
            >
              <span className="text-base">{algo.icon}</span>
              <span className="truncate">{algo.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Rate Limit Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Rate Limit</label>
          <span className="text-sm font-bold text-white">{config.rps} req/s</span>
        </div>
        <input 
          type="range" 
          min="1" max="20" 
          value={config.rps} 
          onChange={handleRpsChange}
          className="w-full" 
        />
      </div>

      {/* Traffic Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Traffic Rate</label>
          <span className="text-sm font-bold text-white/70">{trafficRate} req/s</span>
        </div>
        <input 
          type="range" 
          min="1" max="30" 
          value={trafficRate} 
          onChange={(e) => {
            setTrafficRate(parseInt(e.target.value, 10));
            setActivePreset(null);
          }}
          className="w-full" 
        />
      </div>

      {/* Presets */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Traffic Patterns</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'steady', icon: Activity, label: 'Steady' },
            { id: 'burst', icon: Zap, label: 'Burst' },
            { id: 'spike', icon: ShieldAlert, label: 'Spike' },
            { id: 'random', icon: Cpu, label: 'Random' }
          ].map(preset => (
            <button
              key={preset.id}
              onClick={() => handlePreset(preset.id)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium border transition-all',
                activePreset === preset.id
                  ? 'bg-white/10 border-white/30 text-white shadow-[0_0_8px_rgba(255,255,255,0.1)]'
                  : 'bg-surface border-border text-text-muted hover:text-text-secondary hover:border-text-secondary'
              )}
            >
              <preset.icon className="w-3.5 h-3.5" />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Engine Button */}
      <button
        onClick={() => setIsRunning(!isRunning)}
        className={cn(
          'mt-2 py-3.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-300',
          isRunning 
            ? 'bg-white/10 text-white/70 border border-white/20 hover:bg-white/15 shadow-[0_0_15px_rgba(255,255,255,0.1)]'
            : 'btn-gradient'
        )}
      >
        {isRunning ? (
          <><Square className="w-4 h-4 fill-current" /> Stop Traffic Engine</>
        ) : (
          <><Play className="w-4 h-4 fill-current" /> Start Traffic Engine</>
        )}
      </button>
    </GlassCard>
  );
}
