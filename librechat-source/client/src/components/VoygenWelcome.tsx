import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import store from '~/store';

type StartPayload = { ok?: boolean; autoStart?: boolean; message?: string; recent?: any[]; suggestion?: string };

export default function VoygenWelcome() {
  const showWelcome = useRecoilValue(store.voygentShowWelcome);
  const [data, setData] = useState<StartPayload | null>(null);
  const [hidden, setHidden] = useState<boolean>(() => localStorage.getItem('voygenWelcomeHidden') === '1');

  useEffect(() => {
    if (hidden || !showWelcome) return;
    fetch('/api/voygen/start')
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => {});
  }, [hidden, showWelcome]);

  // Listen for external toggle events (from Help button)
  useEffect(() => {
    const handler = () => {
      setHidden(false);
      localStorage.removeItem('voygenWelcomeHidden');
      // Refresh content on re-open
      fetch('/api/voygen/start')
        .then((r) => r.json())
        .then((j) => setData(j))
        .catch(() => {});
    };
    window.addEventListener('voygen:welcome:toggle', handler);
    return () => window.removeEventListener('voygen:welcome:toggle', handler);
  }, []);

  const recent = useMemo(() => data?.recent?.slice?.(0, 3) || [], [data]);
  if (hidden || !showWelcome || !data?.ok) return null;

  return (
    <div className="fixed bottom-16 right-12 z-[998] w-[360px] max-w-[90vw] rounded-xl border border-border-medium bg-token-main-surface-primary shadow-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-medium">
        <div className="font-medium text-sm">System Ready</div>
        <button
          className="text-xs opacity-70 hover:opacity-100"
          onClick={() => {
            setHidden(true);
            localStorage.setItem('voygenWelcomeHidden', '1');
          }}
        >
          Close
        </button>
      </div>
      <div className="px-3 py-2 text-sm max-h-[60vh] overflow-auto">
        <div className="mb-2">{data?.message || 'Claude Travel Agent System Ready'}</div>
        {data?.greeting && (
          <details className="mb-2">
            <summary className="cursor-pointer">Help / Commands</summary>
            <div className="mt-2 whitespace-pre-wrap text-xs opacity-90">{data.greeting}</div>
          </details>
        )}
        {data?.suggestion && <div className="mb-2">💡 {data.suggestion}</div>}
        {recent.length > 0 && (
          <div className="mb-2">
            <div className="font-medium mb-1">Recent Work</div>
            <ul className="list-disc pl-5">
              {recent.map((r: any) => (
                <li key={r.activity_id}>{r.trip_name} {r.dates ? `(${r.dates})` : ''} {r.phase ? `• ${r.phase}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-xs opacity-80">Try: /continue, /status, /publish</div>
      </div>
    </div>
  );
}
