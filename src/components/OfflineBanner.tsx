import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-[hsl(var(--critical))] text-[hsl(var(--critical-foreground))] text-center text-xs py-1.5 font-medium" style={{ paddingTop: 'max(6px, env(safe-area-inset-top))' }}>
      📡 Internet nahi hai — Offline mode
    </div>
  );
}
