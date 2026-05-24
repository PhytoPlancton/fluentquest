import { useEffect, useState } from 'react';
import { createClient } from '@fluentquest/sdk';

const api = createClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

export function App() {
  const [ping, setPing] = useState<string>('...');

  useEffect(() => {
    api
      .ping()
      .then((d) => setPing(`OK ${d.ts}`))
      .catch(() => setPing('API offline'));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-3">FluentQuest</h1>
        <p className="text-zinc-400">Capture vocale → corrections → exercices</p>
        <p className="mt-10 text-xs font-mono text-zinc-500">api: {ping}</p>
      </div>
    </main>
  );
}
