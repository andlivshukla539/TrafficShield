'use client';

import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function TrafficChart({ metrics }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const prevMetrics = useRef({ total: 0, allowed: 0, blocked: 0 });
  const dataRef = useRef({ allowed: new Array(30).fill(0), blocked: new Array(30).fill(0) });

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    const gradientAllowed = ctx.createLinearGradient(0, 0, 0, 280);
    gradientAllowed.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    gradientAllowed.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    const gradientBlocked = ctx.createLinearGradient(0, 0, 0, 280);
    gradientBlocked.addColorStop(0, 'rgba(128, 128, 128, 0.2)');
    gradientBlocked.addColorStop(1, 'rgba(128, 128, 128, 0.0)');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: new Array(30).fill(''),
        datasets: [
          {
            label: 'Allowed /sec',
            borderColor: '#ffffff',
            backgroundColor: gradientAllowed,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHitRadius: 10,
            data: dataRef.current.allowed,
          },
          {
            label: 'Blocked /sec',
            borderColor: '#666666',
            backgroundColor: gradientBlocked,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHitRadius: 10,
            data: dataRef.current.blocked,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            labels: {
              color: '#8b8b8b',
              font: { family: "'Inter', sans-serif", size: 11 },
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            titleFont: { family: "'Inter', sans-serif", size: 12 },
            bodyFont: { family: "'Inter', sans-serif", size: 11 },
            padding: 10,
            cornerRadius: 8,
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
            ticks: { color: '#4a4a4a', font: { size: 10 }, maxTicksLimit: 6 },
            border: { display: false },
          },
          x: {
            grid: { display: false },
            ticks: { display: false },
            border: { display: false },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, []);

  // React to metrics changes from parent — no internal polling
  useEffect(() => {
    if (!metrics || !chartRef.current) return;

    const deltaAllowed = Math.max(0, metrics.allowed - prevMetrics.current.allowed);
    const deltaBlocked = Math.max(0, metrics.blocked - prevMetrics.current.blocked);
    prevMetrics.current = { ...metrics };

    const d = dataRef.current;
    d.allowed = [...d.allowed.slice(1), deltaAllowed];
    d.blocked = [...d.blocked.slice(1), deltaBlocked];

    chartRef.current.data.datasets[0].data = d.allowed;
    chartRef.current.data.datasets[1].data = d.blocked;
    chartRef.current.update('none');
  }, [metrics]);

  return (
    <div className="h-[300px] w-full">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
