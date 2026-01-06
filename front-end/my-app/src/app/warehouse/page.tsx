// src/app/warehouse/page.tsx
'use client';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '@/contexts/AuthContext';

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

interface Movement {
  _id?: string;
  OrgId: number;
  TagUid: string;
  Action: 'IN' | 'OUT';
  Timestamp: string | Date;
  WarehouseId: string;
  WarehouseName: string;
  SourceId: string;
  SourceType: string;
}

interface MovementSummary {
  totalMovements: number;
  totalIn: number;
  totalOut: number;
  todayMovements: number;
}

// ==================== SHARED COMPONENTS ====================

function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push('/dashboard')}
      className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="font-medium">กลับ</span>
    </button>
  );
}

function StatsCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    red: "bg-red-50 border-red-100",
    amber: "bg-amber-50 border-amber-100",
    purple: "bg-purple-50 border-purple-100",
  };
  const textColors: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
    purple: "text-purple-600",
  };

  return (
    <div className={`${colorClasses[color] || "bg-gray-50 border-gray-100"} border rounded-xl px-5 py-4 min-w-[130px]`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className={`text-2xl font-bold ${textColors[color] || "text-gray-700"}`}>{value}</span>
      </div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function LoadingSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="w-10 h-10 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      {icon}
      <p className="text-lg font-medium text-gray-500">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

// ==================== TAGS COMPONENTS ====================

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
        <div className={`h-full ${colors.bar} rounded-sm transition-all duration-500`} style={{ width: `${percentage}%` }} />
        <div className={`absolute -right-[6px] top-1/2 -translate-y-1/2 w-[3px] h-2 ${colors.bar} rounded-r`} />
      </div>
      <span className="text-xs text-gray-500 font-mono">{voltage}mV</span>
    </div>
  );
}

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

function SourceBadge({ sourceType, sourceId }: { sourceType: string; sourceId: string }) {
  const typeColors: Record<string, string> = {
    "M5": "bg-blue-100 text-blue-700 border-blue-200",
    "Mobile": "bg-purple-100 text-purple-700 border-purple-200",
    "Tracker": "bg-cyan-100 text-cyan-700 border-cyan-200",
    "Gateway": "bg-amber-100 text-amber-700 border-amber-200",
  };

  const style = typeColors[sourceType] || "bg-gray-100 text-gray-700 border-gray-200";
  const shortId = sourceId?.length > 6 ? `...${sourceId.slice(-6)}` : sourceId;

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

// ==================== MOVEMENTS COMPONENTS ====================

function ActionBadge({ action }: { action: 'IN' | 'OUT' }) {
  const isIn = action === 'IN';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
        isIn ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
      }`}
    >
      <span>{isIn ? '📥' : '📤'}</span>
      <span>{action}</span>
    </span>
  );
}

// ==================== WAREHOUSE DROPDOWN ====================

function WarehouseDropdown({
  warehouses,
  selectedWarehouse,
  onSelect,
}: {
  warehouses: { id: string; name: string }[];
  selectedWarehouse: string;
  onSelect: (warehouseId: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={selectedWarehouse}
        onChange={(e) => onSelect(e.target.value)}
        className="appearance-none pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer min-w-[200px]"
      >
        <option value="ALL">🏭 ทุกคลังสินค้า</option>
        {warehouses.map((wh) => (
          <option key={wh.id} value={wh.id}>
            📦 {wh.name}
          </option>
        ))}
      </select>
      <svg
        className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <svg
        className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

// ==================== TABS CONTENT ====================

function TagsTab({ tags, loading, formatTime }: { tags: Tag[]; loading: boolean; formatTime: (date: Date | string | null) => string }) {
  const [searchQuery, setSearchQuery] = useState('');

  const formatCoords = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) return null;
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };

  const filteredTags = tags.filter((tag) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return tag.TagUid.toLowerCase().includes(query);
    }
    return true;
  });

  if (loading) return <LoadingSpinner text="Loading tags..." />;

  return (
    <>
      {/* Search */}
      <div className="flex flex-wrap gap-4 p-4 border-b border-gray-100">
        <div className="relative">
          <input
            type="text"
            placeholder="ค้นหา Tag UID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
          />
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center ml-auto">
          <span className="text-sm text-gray-400">แสดง {filteredTags.length} รายการ</span>
        </div>
      </div>

      {filteredTags.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
          title="No tags found"
          subtitle="Waiting for RFID data..."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {["Tag UID", "Battery", "Signal", "Source", "Event Time", "Location"].map((header) => (
                  <th key={header} className="px-4 md:px-5 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTags.map((tag, index) => (
                <tr
                  key={tag._id || tag.TagUid}
                  className="hover:bg-blue-50/50 transition-colors duration-200"
                  style={{ animation: `fadeIn 0.4s ease ${index * 0.03}s both` }}
                >
                  <td className="px-4 md:px-5 py-4">
                    <span className="text-gray-800 font-semibold font-mono text-sm">{tag.TagUid}</span>
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
                  <td className="px-4 md:px-5 py-4 text-gray-500 text-sm whitespace-nowrap">{formatTime(tag.EventTime)}</td>
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
    </>
  );
}

function MovementsTab({
  movements,
  loading,
  filterAction,
  setFilterAction,
  formatTime,
}: {
  movements: Movement[];
  loading: boolean;
  filterAction: 'ALL' | 'IN' | 'OUT';
  setFilterAction: (action: 'ALL' | 'IN' | 'OUT') => void;
  formatTime: (date: Date | string | null) => string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');

  // ดึงรายการคลังจาก movements (unique)
  const warehouses = useMemo(() => {
    const warehouseMap = new Map<string, string>();
    movements.forEach((m) => {
      if (m.WarehouseId && m.WarehouseName) {
        warehouseMap.set(m.WarehouseId, m.WarehouseName);
      }
    });
    return Array.from(warehouseMap.entries()).map(([id, name]) => ({ id, name }));
  }, [movements]);

  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    return `${diffDays} วันที่แล้ว`;
  };

  const filteredMovements = movements.filter((m) => {
    // Filter by warehouse
    if (selectedWarehouse !== 'ALL' && m.WarehouseId !== selectedWarehouse) return false;
    // Filter by action
    if (filterAction !== 'ALL' && m.Action !== filterAction) return false;
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchTag = m.TagUid.toLowerCase().includes(query);
      const matchWarehouse = m.WarehouseName.toLowerCase().includes(query);
      if (!matchTag && !matchWarehouse) return false;
    }
    return true;
  });

  // คำนวณ stats ตาม filter ที่เลือก
  const filteredStats = useMemo(() => {
    const filtered = selectedWarehouse === 'ALL' 
      ? movements 
      : movements.filter(m => m.WarehouseId === selectedWarehouse);
    
    return {
      totalIn: filtered.filter(m => m.Action === 'IN').length,
      totalOut: filtered.filter(m => m.Action === 'OUT').length,
      total: filtered.length,
    };
  }, [movements, selectedWarehouse]);

  if (loading) return <LoadingSpinner text="Loading movements..." />;

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 border-b border-gray-100">
        {/* Warehouse Dropdown */}
        <WarehouseDropdown
          warehouses={warehouses}
          selectedWarehouse={selectedWarehouse}
          onSelect={setSelectedWarehouse}
        />

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="ค้นหา Tag UID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
          />
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filter:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {['ALL', 'IN', 'OUT'].map((action) => (
              <button
                key={action}
                onClick={() => setFilterAction(action as 'ALL' | 'IN' | 'OUT')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filterAction === action ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {action === 'ALL' ? 'ทั้งหมด' : action === 'IN' ? '📥 IN' : '📤 OUT'}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <div className="flex items-center ml-auto gap-4">
          {selectedWarehouse !== 'ALL' && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600">IN: {filteredStats.totalIn}</span>
              <span className="text-gray-300">|</span>
              <span className="text-red-600">OUT: {filteredStats.totalOut}</span>
            </div>
          )}
          <span className="text-sm text-gray-400">แสดง {filteredMovements.length} รายการ</span>
        </div>
      </div>

      {filteredMovements.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          }
          title="No movements found"
          subtitle={selectedWarehouse !== 'ALL' ? "ไม่พบข้อมูลในคลังที่เลือก" : "Waiting for IN/OUT events..."}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Action', 'Tag UID', 'Warehouse', 'Source', 'Time', 'Relative'].map((header) => (
                  <th key={header} className="px-4 md:px-5 py-4 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMovements.map((movement, index) => (
                <tr
                  key={movement._id || `${movement.TagUid}-${movement.Timestamp}`}
                  className="hover:bg-blue-50/50 transition-colors duration-200"
                  style={{ animation: `fadeIn 0.4s ease ${index * 0.02}s both` }}
                >
                  <td className="px-4 md:px-5 py-4">
                    <ActionBadge action={movement.Action} />
                  </td>
                  <td className="px-4 md:px-5 py-4">
                    <span className="text-gray-800 font-semibold font-mono text-sm">{movement.TagUid}</span>
                  </td>
                  <td className="px-4 md:px-5 py-4">
                    <span className="text-gray-800 font-medium text-sm">{movement.WarehouseName}</span>
                  </td>
                  <td className="px-4 md:px-5 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">{movement.SourceType}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{movement.SourceId?.slice(-8)}</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-5 py-4 text-gray-500 text-sm whitespace-nowrap">{formatTime(movement.Timestamp)}</td>
                  <td className="px-4 md:px-5 py-4 text-gray-400 text-sm whitespace-nowrap">{formatRelativeTime(movement.Timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ==================== MAIN PAGE ====================
export default function WarehousePage() {
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'tags' | 'movements'>('tags');
  const [tags, setTags] = useState<Tag[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<MovementSummary | null>(null);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filterAction, setFilterAction] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  // Redirect ถ้าไม่ได้ login
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch Tags พร้อม orgId filter
  useEffect(() => {
    if (authLoading || !user) return;

    const fetchTags = async () => {
      try {
        // Admin/Super Admin เห็นทั้งหมด, User เห็นเฉพาะบริษัทตัวเอง
        const orgParam = isAdmin ? '' : `?orgId=${user.organizationId}`;
        const res = await fetch(`/api/tag/present${orgParam}`);

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
        setLoadingTags(false);
      }
    };

    fetchTags();
    const interval = setInterval(fetchTags, 2000);
    return () => clearInterval(interval);
  }, [user, authLoading, isAdmin]);

  // Fetch Movements พร้อม orgId filter
  useEffect(() => {
    if (authLoading || !user) return;

    const fetchMovements = async () => {
      try {
        // Admin/Super Admin เห็นทั้งหมด, User เห็นเฉพาะบริษัทตัวเอง
        const orgParam = isAdmin ? '' : `orgId=${user.organizationId}&`;

        const [movementsRes, summaryRes] = await Promise.all([
          fetch(`/api/tag-movement/recent?${orgParam}limit=100`),
          fetch(`/api/tag-movement/summary?${orgParam.replace('&', '')}`),
        ]);

        if (movementsRes.ok) {
          const movementsData = await movementsRes.json();
          setMovements(movementsData.movements || []);
        }

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
        }
      } catch (err) {
        console.error("Failed to fetch movements:", err);
      } finally {
        setLoadingMovements(false);
      }
    };

    fetchMovements();
    const interval = setInterval(fetchMovements, 5000);
    return () => clearInterval(interval);
  }, [user, authLoading, isAdmin]);

  // Stats
  const tagStats = {
    totalTags: tags.length,
    sourceTypes: [...new Set(tags.map((t) => t.SourceType))],
    lowBattery: tags.filter((t) => t.BatteryVoltageMv !== null && t.BatteryVoltageMv < 2500).length,
    weakSignal: tags.filter((t) => t.LastRssi !== null && t.LastRssi < -80).length,
  };

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

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="mb-4">
          <BackButton />
        </div>

        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🏭</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Warehouse Monitor</h1>
                <p className="text-gray-500 text-sm">
                  Real-time RFID tracking • Last sync: {formatTime(lastUpdate)}
                  {!isAdmin && user.organization && (
                    <span className="ml-2 text-blue-600">• {user.organization.name}</span>
                  )}
                </p>
              </div>
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
            {activeTab === 'tags' ? (
              <>
                <StatsCard label="Total Tags" value={tagStats.totalTags} icon="🏷️" color="blue" />
                <StatsCard label="Sources" value={tagStats.sourceTypes.length} icon="📡" color="green" />
                <StatsCard label="Low Battery" value={tagStats.lowBattery} icon="🔋" color={tagStats.lowBattery > 0 ? "red" : "green"} />
                <StatsCard label="Weak Signal" value={tagStats.weakSignal} icon="📶" color={tagStats.weakSignal > 0 ? "amber" : "green"} />
              </>
            ) : (
              <>
                <StatsCard label="Total IN" value={summary?.totalIn || 0} icon="📥" color="green" />
                <StatsCard label="Total OUT" value={summary?.totalOut || 0} icon="📤" color="red" />
                <StatsCard label="Today" value={summary?.todayMovements || 0} icon="📊" color="blue" />
                <StatsCard label="Total" value={summary?.totalMovements || 0} icon="🔄" color="purple" />
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-6 py-3 rounded-t-xl font-medium transition-colors ${
              activeTab === 'tags'
                ? 'bg-white text-blue-600 border border-b-0 border-gray-200 shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <span className="mr-2">🏷️</span>
            Tags ({tags.length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-6 py-3 rounded-t-xl font-medium transition-colors ${
              activeTab === 'movements'
                ? 'bg-white text-blue-600 border border-b-0 border-gray-200 shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <span className="mr-2">🔄</span>
            Movements ({movements.length})
          </button>
        </div>

        {/* Table Container */}
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none overflow-hidden shadow-sm">
          {activeTab === 'tags' ? (
            <TagsTab tags={tags} loading={loadingTags} formatTime={formatTime} />
          ) : (
            <MovementsTab
              movements={movements}
              loading={loadingMovements}
              filterAction={filterAction}
              setFilterAction={setFilterAction}
              formatTime={formatTime}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-gray-400 text-xs gap-2">
          <span>
            {activeTab === 'tags' ? (
              <>Showing {tags.length} tags • Auto-refresh 2s</>
            ) : (
              <>Showing {movements.length} movements • Auto-refresh 5s</>
            )}
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