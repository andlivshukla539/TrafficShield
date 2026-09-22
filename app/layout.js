import './globals.css';

export const metadata = {
  title: {
    default: 'TrafficShield | Distributed API Protection',
    template: '%s | TrafficShield',
  },
  description: 'Production-grade distributed rate limiting platform with 5 algorithms, WAF security, real-time analytics, and interactive algorithm visualizer.',
  keywords: ['rate limiter', 'API gateway', 'WAF', 'DDoS protection', 'Redis', 'token bucket', 'rate limiting', 'TrafficShield'],
  authors: [{ name: 'Andliv Shukla', url: 'https://github.com/andlivshukla539' }],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="noise-overlay antialiased">
        {children}
      </body>
    </html>
  );
}
