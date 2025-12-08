"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

// ==================== TYPES ====================
type Organize = {
  id: number;
  code: string;
  name: string;
  type: "HUB" | "BORDER" | "WAREHOUSE" | "CUSTOMER";
  address?: string;
  country?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  isActive: boolean;
};

type Tracker = {
  id: number;
  imei: string;
  serialNumber: string;
  organizeId?: number;
  organizeName?: string;
  vehicleId?: number;
  vehiclePlate?: string;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  lastSeen?: string;
  lastBattery?: number;
  isActive: boolean;
};

type Shipment = {
  id: number;
  tripId: string;
  description: string;
  status: "PLANNED" | "IN_TRANSIT" | "ARRIVED" | "COMPLETED" | "CANCELLED";
  origin: { organizeId: number; organizeName: string };
  destination: { organizeId: number; organizeName: string };
  route: RouteStop[];
  vehiclePlate?: string;
  driverName?: string;
  currentStopSeq?: number;
  totalDelayMin?: number;
  onTimeStatus?: "ON_TIME" | "DELAYED" | "EARLY";
  createdAt: string;
};

type RouteStop = {
  seq: number;
  organizeId: number;
  organizeName: string;
  type: "PICKUP" | "DROPOFF" | "BORDER" | "CHECKPOINT";
  plannedArrival?: string;
  plannedDeparture?: string;
  actualArrival?: string;
  actualDeparture?: string;
  arrivalDelayMin?: number;
  departureDelayMin?: number;
};

type TagLastSeen = {
  _id: string;
  OrgId: number;
  TagUid: string;
  BatteryVoltageMv?: number;
  EventTime: string;
  LastRssi?: number;
  SourceType: string;
  SourceId: string;
};

type Summary = {
  present_count: number;
  total_tags: number;
  by_zone: Record<string, number>;
  last24h: { scans: number };
};

// ==================== MAIN COMPONENT ====================
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "shipments" | "trackers" | "tags">("overview");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [organizes, setOrganizes] = useState<Organize[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [tags, setTags] = useState<TagLastSeen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // ==================== FETCH DATA ====================
  async function loadData() {
    try {
      setError(null);
      setLoading(true);

      // Fetch from backend APIs
      const [summaryRes, tagsRes] = await Promise.all([
        fetch(`${API_BASE}/tags/summary`, { cache: "no-store" }).catch(() => null),
        fetch(`${API_BASE}/tags/active`, { cache: "no-store" }).catch(() => null),
      ]);

      if (summaryRes?.ok) {
        setSummary(await summaryRes.json());
      }
      if (tagsRes?.ok) {
        setTags(await tagsRes.json());
      }

      // Load from MongoDB collections (via API or direct)
      // For now, use mock data until APIs are ready
      await loadMockData();

      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e.message || "fetch failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadMockData() {
    // Mock data - replace with actual API calls when ready
    setOrganizes([
      { id: 10, code: "BKK-HUB", name: "BKK Hub", type: "HUB", country: "TH", address: "Bangkok", isActive: true },
      { id: 20, code: "SAD-BRD", name: "SAD Border", type: "BORDER", country: "TH", address: "Songkhla", isActive: true },
      { id: 30, code: "JB-BRD", name: "JB Border", type: "BORDER", country: "MY", address: "Johor", isActive: true },
      { id: 40, code: "SIN-HUB", name: "SIN Hub", type: "HUB", country: "SG", address: "Singapore", isActive: true },
    ]);

    setTrackers([
      { id: 1, imei: "19001900199", serialNumber: "M5-BKK-001", organizeId: 10, organizeName: "BKK Hub", status: "ACTIVE", lastBattery: 85, isActive: true },
      { id: 2, imei: "19001900200", serialNumber: "M5-SAD-001", organizeId: 20, organizeName: "SAD Border", status: "ACTIVE", lastBattery: 92, isActive: true },
      { id: 3, imei: "19001900201", serialNumber: "M5-JB-001", organizeId: 30, organizeName: "JB Border", status: "ACTIVE", lastBattery: 78, isActive: true },
      { id: 4, imei: "19001900202", serialNumber: "M5-SIN-001", organizeId: 40, organizeName: "SIN Hub", status: "ACTIVE", lastBattery: 95, isActive: true },
    ]);

    setShipments([
      {
        id: 1,
        tripId: "TRIP-2025-0001",
        description: "Electronics BKK to SIN",
        status: "IN_TRANSIT",
        origin: { organizeId: 10, organizeName: "BKK Hub" },
        destination: { organizeId: 40, organizeName: "SIN Hub" },
        route: [
          { seq: 1, organizeId: 10, organizeName: "BKK Hub", type: "PICKUP", actualArrival: new Date().toISOString(), actualDeparture: new Date().toISOString(), arrivalDelayMin: 0, departureDelayMin: 5 },
          { seq: 2, organizeId: 20, organizeName: "SAD Border", type: "BORDER", actualArrival: new Date().toISOString(), actualDeparture: new Date().toISOString(), arrivalDelayMin: 15, departureDelayMin: 30 },
          { seq: 3, organizeId: 30, organizeName: "JB Border", type: "BORDER", actualArrival: new Date().toISOString(), arrivalDelayMin: 30 },
          { seq: 4, organizeId: 40, organizeName: "SIN Hub", type: "DROPOFF" },
        ],
        vehiclePlate: "1กก 1234",
        driverName: "สมชาย รักดี",
        currentStopSeq: 3,
        totalDelayMin: 50,
        onTimeStatus: "DELAYED",
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        tripId: "TRIP-2025-0002",
        description: "Return SIN to BKK",
        status: "PLANNED",
        origin: { organizeId: 40, organizeName: "SIN Hub" },
        destination: { organizeId: 10, organizeName: "BKK Hub" },
        route: [
          { seq: 1, organizeId: 40, organizeName: "SIN Hub", type: "PICKUP" },
          { seq: 2, organizeId: 30, organizeName: "JB Border", type: "BORDER" },
          { seq: 3, organizeId: 20, organizeName: "SAD Border", type: "BORDER" },
          { seq: 4, organizeId: 10, organizeName: "BKK Hub", type: "DROPOFF" },
        ],
        vehiclePlate: "2ขข 5678",
        driverName: "สมหญิง ใจงาม",
        currentStopSeq: 0,
        onTimeStatus: "ON_TIME",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 10000); // Refresh every 10 seconds
    return () => clearInterval(id);
  }, []);

  // ==================== RENDER ====================
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              🚚 TMS Dashboard
            </h1>
            <p className="text-slate-400 text-sm">
              Transport Management System
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">
              Updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "-"}
            </span>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium transition"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          {[
            { id: "overview", label: "📊 Overview", icon: "" },
            { id: "shipments", label: "📦 Shipments", icon: "" },
            { id: "trackers", label: "📡 Trackers", icon: "" },
            { id: "tags", label: "🏷️ Tags", icon: "" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300">
            ⚠️ {error}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "overview" && (
          <OverviewTab
            summary={summary}
            organizes={organizes}
            trackers={trackers}
            shipments={shipments}
            tags={tags}
          />
        )}
        {activeTab === "shipments" && <ShipmentsTab shipments={shipments} />}
        {activeTab === "trackers" && <TrackersTab trackers={trackers} />}
        {activeTab === "tags" && <TagsTab tags={tags} />}
      </div>
    </main>
  );
}

// ==================== OVERVIEW TAB ====================
function OverviewTab({
  summary,
  organizes,
  trackers,
  shipments,
  tags,
}: {
  summary: Summary | null;
  organizes: Organize[];
  trackers: Tracker[];
  shipments: Shipment[];
  tags: TagLastSeen[];
}) {
  const inTransitCount = shipments.filter((s) => s.status === "IN_TRANSIT").length;
  const delayedCount = shipments.filter((s) => s.onTimeStatus === "DELAYED").length;
  const activeTrackers = trackers.filter((t) => t.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Active Shipments" value={inTransitCount} icon="🚚" color="blue" />
        <StatCard title="Delayed" value={delayedCount} icon="⚠️" color="red" />
        <StatCard title="Active Trackers" value={activeTrackers} icon="📡" color="green" />
        <StatCard title="Tags Detected" value={summary?.total_tags ?? tags.length} icon="🏷️" color="purple" />
      </div>

      {/* Locations Map (placeholder) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organizes */}
        <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            📍 Locations ({organizes.length})
          </h3>
          <div className="space-y-2">
            {organizes.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {org.type === "HUB" ? "🏭" : org.type === "BORDER" ? "🚧" : "📦"}
                  </span>
                  <div>
                    <div className="font-medium">{org.name}</div>
                    <div className="text-xs text-slate-400">{org.address} • {org.country}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  org.type === "HUB" ? "bg-blue-500/20 text-blue-400" : "bg-amber-500/20 text-amber-400"
                }`}>
                  {org.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Shipments */}
        <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            📦 Active Shipments
          </h3>
          <div className="space-y-3">
            {shipments.filter((s) => s.status === "IN_TRANSIT").map((shipment) => (
              <ShipmentCard key={shipment.id} shipment={shipment} />
            ))}
            {shipments.filter((s) => s.status === "IN_TRANSIT").length === 0 && (
              <div className="text-center text-slate-500 py-8">No active shipments</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Tags */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5">
        <h3 className="font-semibold mb-4">🏷️ Recent Tag Detections</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-700">
              <tr>
                <th className="text-left p-3">Tag UID</th>
                <th className="text-left p-3">Source</th>
                <th className="text-center p-3">RSSI</th>
                <th className="text-center p-3">Battery</th>
                <th className="text-right p-3">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tags.slice(0, 10).map((tag, i) => (
                <tr key={i} className="hover:bg-slate-800/50">
                  <td className="p-3 font-mono text-xs">{tag.TagUid}</td>
                  <td className="p-3">{tag.SourceType}/{tag.SourceId}</td>
                  <td className="p-3 text-center">
                    <RssiBadge rssi={tag.LastRssi} />
                  </td>
                  <td className="p-3 text-center">
                    {tag.BatteryVoltageMv ? `${tag.BatteryVoltageMv}mV` : "-"}
                  </td>
                  <td className="p-3 text-right text-slate-400 text-xs">
                    {new Date(tag.EventTime).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== SHIPMENTS TAB ====================
function ShipmentsTab({ shipments }: { shipments: Shipment[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">📦 Shipments & Routes</h2>
      
      <div className="space-y-4">
        {shipments.map((shipment) => (
          <div key={shipment.id} className="rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg">{shipment.tripId}</span>
                  <StatusBadge status={shipment.status} />
                  {shipment.onTimeStatus && <OnTimeBadge status={shipment.onTimeStatus} />}
                </div>
                <div className="text-sm text-slate-400 mt-1">{shipment.description}</div>
              </div>
              <div className="text-right text-sm">
                <div>🚗 {shipment.vehiclePlate}</div>
                <div className="text-slate-400">👤 {shipment.driverName}</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-4 text-sm text-slate-400">
                <span>{shipment.origin.organizeName}</span>
                <span>→</span>
                <span>{shipment.destination.organizeName}</span>
              </div>

              {/* Route Timeline */}
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700"></div>
                
                {shipment.route.map((stop, i) => {
                  const isCompleted = stop.actualArrival != null;
                  const isCurrent = shipment.currentStopSeq === stop.seq;
                  const isPending = !isCompleted && !isCurrent;

                  return (
                    <div key={i} className="relative pl-10 pb-4 last:pb-0">
                      {/* Dot */}
                      <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                        isCompleted ? "bg-emerald-500 border-emerald-500" :
                        isCurrent ? "bg-blue-500 border-blue-500 animate-pulse" :
                        "bg-slate-800 border-slate-600"
                      }`}></div>

                      {/* Content */}
                      <div className={`p-3 rounded-xl ${
                        isCurrent ? "bg-blue-500/10 border border-blue-500/30" :
                        isCompleted ? "bg-slate-800/50" : "bg-slate-900/30"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{stop.organizeName}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                              {stop.type}
                            </span>
                          </div>
                          {stop.arrivalDelayMin != null && stop.arrivalDelayMin > 0 && (
                            <span className="text-xs text-red-400">
                              +{stop.arrivalDelayMin} min delay
                            </span>
                          )}
                        </div>

                        {/* Times */}
                        <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-500">ETA: </span>
                            <span>{stop.plannedArrival ? new Date(stop.plannedArrival).toLocaleTimeString() : "-"}</span>
                            {stop.actualArrival && (
                              <span className="ml-2 text-emerald-400">
                                ✓ {new Date(stop.actualArrival).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-500">ETD: </span>
                            <span>{stop.plannedDeparture ? new Date(stop.plannedDeparture).toLocaleTimeString() : "-"}</span>
                            {stop.actualDeparture && (
                              <span className="ml-2 text-emerald-400">
                                ✓ {new Date(stop.actualDeparture).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              {shipment.totalDelayMin != null && shipment.totalDelayMin > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm">
                  ⚠️ Total delay: <strong>{shipment.totalDelayMin} minutes</strong>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== TRACKERS TAB ====================
function TrackersTab({ trackers }: { trackers: Tracker[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">📡 M5 Trackers</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trackers.map((tracker) => (
          <div key={tracker.id} className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">📡</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                tracker.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-400" :
                tracker.status === "MAINTENANCE" ? "bg-amber-500/20 text-amber-400" :
                "bg-slate-500/20 text-slate-400"
              }`}>
                {tracker.status}
              </span>
            </div>

            <div className="font-bold text-lg">{tracker.serialNumber}</div>
            <div className="text-sm text-slate-400 font-mono">{tracker.imei}</div>

            <div className="mt-4 pt-4 border-t border-slate-700 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Location</span>
                <span>{tracker.organizeName || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vehicle</span>
                <span>{tracker.vehiclePlate || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Battery</span>
                <BatteryIndicator level={tracker.lastBattery} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== TAGS TAB ====================
function TagsTab({ tags }: { tags: TagLastSeen[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return tags;
    return tags.filter(
      (t) =>
        t.TagUid?.toLowerCase().includes(q) ||
        t.SourceId?.toLowerCase().includes(q)
    );
  }, [tags, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">🏷️ BLE Tags</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Tag UID..."
          className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 text-slate-300">
            <tr>
              <th className="text-left p-4">Tag UID</th>
              <th className="text-left p-4">Source</th>
              <th className="text-center p-4">RSSI</th>
              <th className="text-center p-4">Battery</th>
              <th className="text-right p-4">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map((tag, i) => (
              <tr key={i} className="hover:bg-slate-800/30">
                <td className="p-4 font-mono text-xs">{tag.TagUid}</td>
                <td className="p-4">
                  <span className="px-2 py-1 rounded-full bg-slate-700 text-xs">
                    {tag.SourceType}
                  </span>
                  <span className="ml-2 text-slate-400">{tag.SourceId}</span>
                </td>
                <td className="p-4 text-center">
                  <RssiBadge rssi={tag.LastRssi} />
                </td>
                <td className="p-4 text-center">
                  {tag.BatteryVoltageMv ? `${tag.BatteryVoltageMv}mV` : "-"}
                </td>
                <td className="p-4 text-right text-slate-400">
                  {new Date(tag.EventTime).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            No tags found
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== COMPONENTS ====================
function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: "blue" | "red" | "green" | "purple";
}) {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    red: "from-red-500/20 to-red-600/10 border-red-500/30",
    green: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
  };

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colorClasses[color]} border p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold">{value}</span>
      </div>
      <div className="text-sm text-slate-400 mt-2">{title}</div>
    </div>
  );
}

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const progress = shipment.currentStopSeq
    ? Math.round((shipment.currentStopSeq / shipment.route.length) * 100)
    : 0;

  return (
    <div className="p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">{shipment.tripId}</span>
        <OnTimeBadge status={shipment.onTimeStatus || "ON_TIME"} />
      </div>
      <div className="text-sm text-slate-400 mb-3">
        {shipment.origin.organizeName} → {shipment.destination.organizeName}
      </div>
      {/* Progress bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            shipment.onTimeStatus === "DELAYED" ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>Stop {shipment.currentStopSeq || 0}/{shipment.route.length}</span>
        <span>{progress}%</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PLANNED: "bg-slate-500/20 text-slate-400",
    IN_TRANSIT: "bg-blue-500/20 text-blue-400",
    ARRIVED: "bg-emerald-500/20 text-emerald-400",
    COMPLETED: "bg-emerald-500/20 text-emerald-400",
    CANCELLED: "bg-red-500/20 text-red-400",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.PLANNED}`}>
      {status}
    </span>
  );
}

function OnTimeBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ON_TIME: "bg-emerald-500/20 text-emerald-400",
    DELAYED: "bg-red-500/20 text-red-400",
    EARLY: "bg-blue-500/20 text-blue-400",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.ON_TIME}`}>
      {status === "ON_TIME" ? "✓ On Time" : status === "DELAYED" ? "⚠ Delayed" : "⏰ Early"}
    </span>
  );
}

function RssiBadge({ rssi }: { rssi?: number }) {
  if (rssi == null) return <span className="text-slate-500">-</span>;

  const level = rssi > -55 ? "strong" : rssi > -70 ? "medium" : "weak";
  const styles = {
    strong: "bg-emerald-500/20 text-emerald-400",
    medium: "bg-amber-500/20 text-amber-400",
    weak: "bg-red-500/20 text-red-400",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[level]}`}>
      {rssi} dBm
    </span>
  );
}

function BatteryIndicator({ level }: { level?: number }) {
  if (level == null) return <span className="text-slate-500">-</span>;

  const color = level > 50 ? "text-emerald-400" : level > 20 ? "text-amber-400" : "text-red-400";

  return (
    <span className={`font-medium ${color}`}>
      {level > 75 ? "🔋" : level > 25 ? "🪫" : "⚠️"} {level}%
    </span>
  );
}