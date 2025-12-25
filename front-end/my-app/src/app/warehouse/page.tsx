// src/app/warehouse/page.tsx
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ==================== TYPES ====================
interface Tag {
  _id?: string;
  OrgId: number;
  TagUid: string;
  BatteryVoltageMv: number | null;
  EventTime: string | Date;
  LastRssi: number | null;
  Lat: number | null;
  Lng: number | null;
  Note: string;
  SourceId: string;
  SourceType: string;
}

// ==================== COMPONENTS ====================

// Back Button Component
function BackButton() {
  const router = useRouter();
  
  return (
    <button
      onClick={() => router.push('/dashboard')}
      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <svg 
        className="w-5 h-5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M15 19l-7-7 7-7" 
        />
      </svg>
      <span className="font-medium">กลับ</span>
    </button>
  );
}

// Battery Indicator Component
function BatteryIndicator({ voltage }: { voltage: number | null }) {
  const maxVoltage = 3300;
  const minVoltage = 1800;
  const safeVoltage = voltage ?? 0;
  const percentage = Math.min(100, Math.max(0, ((safeVoltage - minVoltage) / (maxVoltage - minVoltage)) * 100));

  const getColor = () => {
    if (percentage > 60) return { bar: "bg-green-500", border: "border-green-500" };
    if (percentage > 30) return { bar: "bg-yellow-500", border: "border-yellow-500" };
    return { bar: "bg-red-500", border: "border-red-500" };
  };

  const colors = getColor();

  if (voltage === null || voltage === undefined) {
    return <span className="text-gray-400 text-sm">-</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-10 h-[18px] border-2 ${colors.border} rounded p-[2px] relative bg-white`}>
        <div
          className={`h-full ${colors.bar} rounded-sm transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
        <div className={`absolute -right-[6px] top-1/2 -translate-y-1/2 w-[3px] h-2 ${colors.bar} rounded-r`} />
      </div>
      <span className="text-xs text-gray-500 font-mono">{voltage}mV</span>
    </div>
  );
}

// Signal Strength Indicator Component
function SignalIndicator({ rssi }: { rssi: number | null }) {
  const getStrength = () => {
    if (!rssi) return 0;
    if (rssi > -50) return 4;
    if (rssi > -60) return 3;
    if (rssi > -70) return 2;
    return 1;
  };

  const strength = getStrength();

  const getColor = () => {
    if (strength >= 3) return "bg-green-500";
    if (strength >= 2) return "bg-yellow-500";
    if (strength >= 1) return "bg-red-500";
    return "bg-gray-300";
  };

  if (rssi === null || rssi === undefined) {
    return <span className="text-gray-400 text-sm">-</span>;
  }

  return (
    <div className="flex items-end gap-[2px] h-5">
      {[1, 2, 3, 4].map((bar) => (
        <div
          key={bar}
          className={`w-1 rounded-sm transition-colors duration-300 ${bar <= strength ? getColor() : "bg-gray-200"}`}
          style={{ height: `${bar * 4 + 4}px` }}
        />
      ))}
      <span className="text-[11px] text-gray-500 ml-1.5 font-mono">{rssi}dBm</span>
    </div>
  );
}

// Source Badge Component
function SourceBadge({ sourceType, sourceId }: { sourceType: string; sourceId: string }) {
  const typeColors: Record<string, string> = {
    "M5": "bg-blue-100 text-blue-700 border-blue-200",
    "Mobile": "bg-purple-100 text-purple-700 border-purple-200",
    "Tracker": "bg-cyan-100 text-cyan-700 border-cyan-200",
    "Gateway": "bg-amber-100 text-amber-700 border-amber-200",
  };

  const style = typeColors[sourceType] || "bg-gray-100 text-gray-700 border-gray-200";
  const shortId = sourceId.length > 6 ? `...${sourceId.slice(-6)}` : sourceId;

  return (
    <div className="flex flex-col gap-1">
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${style} inline-block w-fit`}>
        {sourceType}
      </span>
      <span className="text-[10px] text-gray-400 font-mono" title={sourceId}>
        ID: {shortId}
      </span>
    </div>
  );
}

// Stats Card Component
function StatsCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    red: "bg-red-50 border-red-100",
    amber: "bg-amber-50 border-amber-100",
  };

  const textColors: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
  };

  return (
    <div className={`${colorClasses[color] || "bg-gray-50 border-gray-100"} border rounded-xl px-5 py-4 min-w-[130px]`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className={`text-2xl font-bold ${textColors[color] || "text-gray-700"}`}>{value}</span>
      </div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

// Loading Spinner
function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="w-10 h-10 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4" />
      <span>Loading tags...</span>
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <p className="text-lg font-medium text-gray-500">No tags found</p>
      <p className="text-sm text-gray-400 mt-1">Waiting for RFID data...</p>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function WarehousePage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch("/api/tag/present");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        const tagList = data?.Tags || data || [];
        setTags(Array.isArray(tagList) ? tagList : []);
        setLastUpdate(new Date());
        setError(null);
      } catch (err) {
        console.error("Failed to fetch tags:", err);
        setError("ไม่สามารถเชื่อมต่อ API ได้");
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
    const interval = setInterval(fetchTags, 2000);
    return () => clearInterval(interval);
  }, []);

  // Calculate stats
  const stats = {
    totalTags: tags.length,
    sourceTypes: [...new Set(tags.map(t => t.SourceType))],
    lowBattery: tags.filter(t => t.BatteryVoltageMv !== null && t.BatteryVoltageMv < 2500).length,
    weakSignal: tags.filter(t => t.LastRssi !== null && t.LastRssi < -80).length,
  };

  // Format time
  const formatTime = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
  };

  // Format coordinates
  const formatCoords = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) return null;
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Back Button */}
        <div className="mb-4">
          <BackButton />
        </div>

        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🏷️</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                  Warehouse Monitor
                </h1>
                <p className="text-gray-500 text-sm">
                  Real-time RFID tag tracking • Last sync: {formatTime(lastUpdate)}
                </p>
              </div>
              {/* Live indicator */}
              <div className="flex items-center gap-2 ml-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs text-green-600 font-medium">LIVE</span>
              </div>
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-2">
                <span>⚠️</span> {error}
              </p>
            )}
          </div>

          {/* Stats Cards */}
          <div className="flex flex-wrap gap-3">
            <StatsCard label="Total Tags" value={stats.totalTags} icon="🏷️" color="blue" />
            <StatsCard label="Sources" value={stats.sourceTypes.length} icon="📡" color="green" />
            <StatsCard label="Low Battery" value={stats.lowBattery} icon="🔋" color={stats.lowBattery > 0 ? "red" : "green"} />
            <StatsCard label="Weak Signal" value={stats.weakSignal} icon="📶" color={stats.weakSignal > 0 ? "amber" : "green"} />
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <LoadingSpinner />
          ) : tags.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {["Tag UID", "Battery", "Signal", "Source", "Event Time", "Location"].map((header) => (
                      <th
                        key={header}
                        className="px-4 md:px-5 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tags.map((tag, index) => (
                    <tr
                      key={tag._id || tag.TagUid}
                      className="hover:bg-blue-50/50 transition-colors duration-200"
                      style={{
                        animation: `fadeIn 0.4s ease ${index * 0.03}s both`,
                      }}
                    >
                      <td className="px-4 md:px-5 py-4">
                        <span className="text-gray-800 font-semibold font-mono text-sm">
                          {tag.TagUid}
                        </span>
                      </td>
                      <td className="px-4 md:px-5 py-4">
                        <BatteryIndicator voltage={tag.BatteryVoltageMv} />
                      </td>
                      <td className="px-4 md:px-5 py-4">
                        <SignalIndicator rssi={tag.LastRssi} />
                      </td>
                      <td className="px-4 md:px-5 py-4">
                        <SourceBadge sourceType={tag.SourceType} sourceId={tag.SourceId} />
                      </td>
                      <td className="px-4 md:px-5 py-4 text-gray-500 text-sm whitespace-nowrap">
                        {formatTime(tag.EventTime)}
                      </td>
                      <td className="px-4 md:px-5 py-4">
                        {formatCoords(tag.Lat, tag.Lng) ? (
                          <a
                            href={`https://maps.google.com/?q=${tag.Lat},${tag.Lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1.5 transition-colors"
                          >
                            <span>📍</span>
                            <span className="font-mono">{formatCoords(tag.Lat, tag.Lng)}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">No GPS</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-gray-400 text-xs gap-2">
          <span>
            Showing {tags.length} tags
            {stats.sourceTypes.length > 0 && <> • Sources: {stats.sourceTypes.join(', ')}</>}
            {' '}• Auto-refresh 2s
          </span>
          <span>TMS Warehouse Management System</span>
        </div>
      </div>

      {/* Animation Keyframes */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}