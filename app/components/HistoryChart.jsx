'use client';

import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

export default function HistoryChart() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Allowed', backgroundColor: 'rgba(255, 255, 255, 0.7)', data: [] },
          { label: 'Blocked', backgroundColor: 'rgba(100, 100, 100, 0.5)', data: [] }
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#8b8b8b', font: { size: 10 } } },
          y: { stacked: true, grid: { color: 'rgba(255, 255, 255, 0.04)' }, ticks: { color: '#4a4a4a' } }
        }
      }
    });

    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/metrics/history');
        const history = await res.json();
        
        const labels = history.map(h => {
          const d = new Date(h.timestamp);
          return `${String(d.getHours()).padStart(2, '0')}:00`;
        });
        
        if (chartRef.current) {
          chartRef.current.data.labels = labels;
          chartRef.current.data.datasets[0].data = history.map(h => h.allowed);
          chartRef.current.data.datasets[1].data = history.map(h => h.blocked);
          chartRef.current.update();
        }
      } catch (err) {}
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 60000); // Update every minute

    return () => {
      clearInterval(interval);
      if (chartRef.current) chartRef.current.destroy();
    };
  }, []);

  return (
    <div className="h-[200px] w-full mt-4">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
