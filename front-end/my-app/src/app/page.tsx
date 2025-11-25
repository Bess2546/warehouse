"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

type TagState = {
  tagId: string;
  present: boolean;
  zone?: string;
  rssi?: number;
  enterCount?: number;
  exitCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  lastEnter?: string;
  lastExit?: string;
};

type Summary = {
  present_count: number;
  total_tags: number;
  by_zone: Record<string, number>;
  last24h: { in: number; out: number };
};

type TimelineEvent = {
  tagId: string;
  zone: string;
  type: "enter" | "exit";
  ts: string;
  rssi?: number;
};

function rssiToLevel(rssi?: number) {
  if (rssi == null) return 0;
  if (rssi > -55) return 4;
  if (rssi > -65) return 3;
  if (rssi > -75) return 2;
  if (rssi > -85) return 1;
  return 0;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [presentTags, setPresentTags] = useState<TagState[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    try {
      setError(null);

      const [sRes, pRes, tRes] = await Promise.all([
        fetch(`${API_BASE}/tags/summary`, { cache: "no-store" }),
        fetch(`${API_BASE}/tags/present`, { cache: "no-store" }),
        fetch(`${API_BASE}/tags/timeline?limit=20`, { cache: "no-store" }),
      ]);

      if (!sRes.ok) throw new Error("summary fetch failed");
      if (!pRes.ok) throw new Error("present fetch failed");
      if (!tRes.ok) throw new Error("timeline fetch failed");

      setSummary(await sRes.json());
      setPresentTags(await pRes.json());
      setTimeline(await tRes.json());

      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e.message || "fetch failed");
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  const filteredPresent = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return presentTags;
    return presentTags.filter(
      (t) =>
        t.tagId?.toLowerCase().includes(s) || t.zone?.toLowerCase().includes(s)
    );
  }, [presentTags, q]);

  const groupedByZone = useMemo(() => {
    const map = new Map<string, TagState[]>();
    for (const t of filteredPresent) {
      const z = t.zone || "Unknown";
      if (!map.has(z)) map.set(z, []);
      map.get(z)!.push(t);
    }
    return Array.from(map.entries());
  }, [filteredPresent]);

  const strongCount = presentTags.filter((t) => (t.rssi ?? -999) > -65).length;
  const weakCount = presentTags.filter((t) => (t.rssi ?? -999) <= -65).length;

  return (
    <main className="max-w-6xl mx-auto p-6 text-white">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Warehouse Dashboard</h1>
          <p className="text-slate-400 text-sm">
            Updated:{" "}
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "-"}
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-sm"
        >
          Refresh
        </button>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card title="In warehouse now" value={summary?.present_count ?? 0} />
        <Card title="Total tags known" value={summary?.total_tags ?? 0} />
        <Card title="IN (24h)" value={summary?.last24h.in ?? 0} />
        <Card title="OUT (24h)" value={summary?.last24h.out ?? 0} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card title="Strong signals (>-65)" value={strongCount} />
        <Card title="Weak signals (<=-65)" value={weakCount} />
      </section>

      {/* Search */}
      <section className="mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search MAC/tagId or zone..."
          className="w-full md:w-80 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-600"
        />
      </section>

      {/* Present items grouped by zone */}
      <section className="space-y-5 mb-8">
        {groupedByZone.map(([zone, list]) => (
          <div
            key={zone}
            className="rounded-2xl border border-slate-800 bg-slate-900/40"
          >
            <div className="px-4 py-3 border-b border-slate-800 flex justify-between">
              <div className="font-semibold">{zone}</div>
              <div className="text-xs text-slate-400">{list.length} items</div>
            </div>

            <ul className="divide-y divide-slate-800">
              {list.map((t) => {
                const level = rssiToLevel(t.rssi);
                return (
                  <li
                    key={t.tagId}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono text-sm">{t.tagId}</div>
                      <div className="text-xs text-slate-400">
                        enter: {t.enterCount ?? 0} • exit: {t.exitCount ?? 0}
                      </div>
                      <div className="text-xs text-slate-500">
                        lastEnter: {t.lastEnter ? new Date(t.lastEnter).toLocaleString() : "-"} •
                        lastExit: {t.lastExit ? new Date(t.lastExit).toLocaleString() : "-"}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <SignalBars level={level} />
                      <div className="font-semibold text-blue-400">
                        {t.rssi ?? "-"} dBm
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {groupedByZone.length === 0 && !error && (
          <div className="text-center text-slate-400 p-10 border border-slate-800 rounded-2xl bg-slate-900/40">
            No items present
          </div>
        )}
      </section>

      {/* Timeline */}
      <section>
        <h2 className="font-semibold mb-2">Latest IN / OUT</h2>
        <div className="rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/70 text-slate-300">
              <tr>
                <th className="p-3 text-left">Time</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-left">Tag</th>
                <th className="p-3">Zone</th>
                <th className="p-3">RSSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {timeline.map((e, i) => (
                <tr key={i} className="bg-slate-950/30">
                  <td className="p-3">
                    {new Date(e.ts).toLocaleString()}
                  </td>
                  <td
                    className={`p-3 font-bold ${
                      e.type === "enter"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {e.type.toUpperCase()}
                  </td>
                  <td className="p-3 font-mono">{e.tagId}</td>
                  <td className="p-3">{e.zone}</td>
                  <td className="p-3">{e.rssi ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-4">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}

function SignalBars({ level }: { level: number }) {
  return (
    <div className="flex items-end gap-1 h-5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-1.5 rounded-sm ${
            level >= i ? "bg-emerald-400" : "bg-slate-700"
          }`}
          style={{ height: i * 4 }}
        />
      ))}
    </div>
  );
}
