"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

interface StatsSummary {
  totalTags: number;
  totalIn: number;
  totalOut: number;
  totalWarehouses: number;
  totalShipments: number;
  todayIn: number;
  todayOut: number;
}

interface DailyMovement {
  date: string;
  IN: number;
  OUT: number;
}

interface WarehouseStats {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  tagCount: number;
  todayIn: number;
  todayOut: number;
}

interface ShipmentStats {
  pending: number;
  inTransit: number;
  delivered: number;
  total: number;
}

const COLORS = ["#4ade80", "#f87171", "#60a5fa", "#fbbf24", "#a78bfa"];

export default function ReportsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [dailyData, setDailyData] = useState<DailyMovement[]>([]);
  const [warehouseData, setWarehouseData] = useState<WarehouseStats[]>([]);
  const [shipmentStats, setShipmentStats] = useState<ShipmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [dateRange, setDateRange] = useState(7);

  // Auth check
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Fetch all report data
  useEffect(() => {
    if (user) {
      fetchReportData();
    }
  }, [user, dateRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const [summaryRes, dailyRes, warehouseRes, shipmentRes] = await Promise.all([
        fetch(`${baseUrl}/reports/summary`, { headers }),
        fetch(`${baseUrl}/reports/daily-movements?days=${dateRange}`, { headers }),
        fetch(`${baseUrl}/reports/warehouse-stats`, { headers }),
        fetch(`${baseUrl}/reports/shipment-stats`, { headers }),
      ]);

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (dailyRes.ok) {
        setDailyData(await dailyRes.json());
      }
      if (warehouseRes.ok) {
        setWarehouseData(await warehouseRes.json());
      }
      if (shipmentRes.ok) {
        setShipmentStats(await shipmentRes.json());
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to fetch report data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare pie chart data
  const movementPieData = summary
    ? [
        { name: "IN", value: summary.totalIn },
        { name: "OUT", value: summary.totalOut },
      ]
    : [];

  const shipmentPieData = shipmentStats
    ? [
        { name: "Pending", value: shipmentStats.pending },
        { name: "In Transit", value: shipmentStats.inTransit },
        { name: "Delivered", value: shipmentStats.delivered },
      ]
    : [];

  // Custom label renderer for pie chart
  const renderPieLabel = ({ name, percent }: { name?: string | number; percent?: number }) => {
    const percentage = ((percent ?? 0) * 100).toFixed(0);
    return `${name ?? ''}: ${percentage}%`;
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Reports & Analytics
            </h1>
            <p className="text-gray-500 text-sm">
              Last updated: {lastUpdate.toLocaleString("th-TH")}
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <button
              onClick={fetchReportData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <SummaryCard
            title="Total Tags"
            value={summary?.totalTags ?? 0}
            icon="🏷️"
            color="blue"
          />
          <SummaryCard
            title="Total IN"
            value={summary?.totalIn ?? 0}
            icon="📥"
            color="green"
            subtitle={`Today: ${summary?.todayIn ?? 0}`}
          />
          <SummaryCard
            title="Total OUT"
            value={summary?.totalOut ?? 0}
            icon="📤"
            color="red"
            subtitle={`Today: ${summary?.todayOut ?? 0}`}
          />
          <SummaryCard
            title="Warehouses"
            value={summary?.totalWarehouses ?? 0}
            icon="🏭"
            color="purple"
          />
          <SummaryCard
            title="Shipments"
            value={summary?.totalShipments ?? 0}
            icon="🚛"
            color="yellow"
          />
          <SummaryCard
            title="In Transit"
            value={shipmentStats?.inTransit ?? 0}
            icon="✈️"
            color="cyan"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Pie Chart - IN/OUT Ratio */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Movement Distribution
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={movementPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={renderPieLabel}
                >
                  {movementPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart - Daily Trend */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Daily Movement Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(value as string).toLocaleDateString("th-TH")
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="IN"
                  stroke="#4ade80"
                  strokeWidth={2}
                  dot={{ fill: "#4ade80" }}
                />
                <Line
                  type="monotone"
                  dataKey="OUT"
                  stroke="#f87171"
                  strokeWidth={2}
                  dot={{ fill: "#f87171" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Bar Chart - Warehouse Stats */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Current Tags per Warehouse
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={warehouseData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  dataKey="warehouseName"
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="tagCount" fill="#60a5fa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart - Shipment Status */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Shipment Status
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={shipmentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  <Cell fill="#fbbf24" />
                  <Cell fill="#60a5fa" />
                  <Cell fill="#4ade80" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Warehouse Detail Table */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">
            Warehouse Details
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 font-medium text-gray-500">Warehouse</th>
                  <th className="pb-3 font-medium text-gray-500">Code</th>
                  <th className="pb-3 font-medium text-gray-500 text-center">
                    Current Tags
                  </th>
                  <th className="pb-3 font-medium text-gray-500 text-center">
                    Today IN
                  </th>
                  <th className="pb-3 font-medium text-gray-500 text-center">
                    Today OUT
                  </th>
                </tr>
              </thead>
              <tbody>
                {warehouseData.map((warehouse) => (
                  <tr
                    key={warehouse.warehouseId}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 font-medium">{warehouse.warehouseName}</td>
                    <td className="py-3 text-gray-500">{warehouse.warehouseCode}</td>
                    <td className="py-3 text-center">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">
                        {warehouse.tagCount}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-green-600 font-medium">
                        +{warehouse.todayIn}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-red-600 font-medium">
                        -{warehouse.todayOut}
                      </span>
                    </td>
                  </tr>
                ))}
                {warehouseData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No warehouse data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: number;
  icon: string;
  color: "blue" | "green" | "red" | "purple" | "yellow" | "cyan";
  subtitle?: string;
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-700",
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm opacity-80">{title}</p>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          {subtitle && <p className="text-xs opacity-70">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}