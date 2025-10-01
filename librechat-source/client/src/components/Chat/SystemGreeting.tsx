import { useEffect, useState } from 'react';

type StartPayload = { ok?: boolean; greeting?: string; recent?: any[] };

export default function SystemGreeting() {
  const [data, setData] = useState<StartPayload | null>(null);
  const [hidden, setHidden] = useState<boolean>(() => localStorage.getItem('voygenGreetingHidden') === '1');

  useEffect(() => {
    if (hidden) return;
    fetch('/api/voygen/start')
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => {});
  }, [hidden]);

  if (hidden || !data?.greeting) return null;

  return (
    <div className="group mx-auto mb-2 mt-3 w-full md:max-w-[47rem] xl:max-w-[55rem]">
      <div className="rounded-2xl border border-border-medium bg-surface-primary-alt p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="font-medium">System Ready</div>
          <button
            className="text-xs opacity-70 hover:opacity-100"
            onClick={() => {
              setHidden(true);
              localStorage.setItem('voygenGreetingHidden', '1');
            }}
          >
            Dismiss
          </button>
        </div>
        <details className="mt-2" open>
          <summary className="cursor-pointer text-sm">Help / Commands</summary>
          <div className="mt-2 whitespace-pre-wrap text-sm opacity-90">{data.greeting}</div>
        </details>
      </div>
    </div>
  );
}
