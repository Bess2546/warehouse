// src/app/shipments/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

interface Warehouse {
  id: number;
  name: string;
}

interface ShipmentItem {
  id: number;
  tagUid: string;
  tagName: string | null;
  status: string;
  exitedAt: string | null;
  arrivedAt: string | null;
}

interface Shipment {
  id: number;
  shipmentCode: string;
  originWarehouse: Warehouse;
  destinationWarehouse: Warehouse;
  status: string;
  notes: string | null;
  items: ShipmentItem[];
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  inTransit: number;
  partial: number;
  delivered: number;
  cancelled: number;
}

export default function ShipmentsPage() {
  const { user, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter
  const [statusFilter, setStatusFilter] = useState("");

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(
    null
  );

  // Form
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [formData, setFormData] = useState({
    originWarehouseId: "",
    destinationWarehouseId: "",
    tagUids: "",
    notes: "",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (accessToken) {
      fetchShipments();
      fetchStats();
      fetchWarehouses();
    }
  }, [accessToken, statusFilter]);

  const fetchShipments = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/shipments?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        setShipments(data.data || []);
      }
    } catch (err) {
      setError("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/shipments/stats", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await fetch("/api/warehouses", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        // API return { count, warehouses: [...] }
        setWarehouses(data.warehouses || []);
      }
    } catch (err) {
      console.error("Error fetching warehouses:", err);
      setWarehouses([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      // แปลง tagUids จาก string เป็น array
      const tagUids = formData.tagUids
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => t);

      if (tagUids.length === 0) {
        throw new Error("กรุณาระบุ Tag อย่างน้อย 1 รายการ");
      }

      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          originWarehouseId: parseInt(formData.originWarehouseId),
          destinationWarehouseId: parseInt(formData.destinationWarehouseId),
          tagUids,
          notes: formData.notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "สร้าง Shipment ไม่สำเร็จ");
      }

      setShowCreateModal(false);
      setFormData({
        originWarehouseId: "",
        destinationWarehouseId: "",
        tagUids: "",
        notes: "",
      });
      fetchShipments();
      fetchStats();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("ต้องการยกเลิก Shipment นี้?")) return;

    try {
      const res = await fetch(`/api/shipments/${id}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        fetchShipments();
        fetchStats();
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาด");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-gray-100 text-gray-800",
      in_transit: "bg-blue-100 text-blue-800",
      partial: "bg-yellow-100 text-yellow-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };

    const labels: Record<string, string> = {
      pending: "รอส่ง",
      in_transit: "กำลังส่ง",
      partial: "ส่งถึงบางส่วน",
      delivered: "ส่งถึงแล้ว",
      cancelled: "ยกเลิก",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded ${
          styles[status] || "bg-gray-100"
        }`}
      >
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-gray-500 hover:text-gray-700"
            >
              ← กลับ
            </Link>
            <h1 className="text-xl font-bold text-gray-800">
              📦 จัดการการขนส่ง
            </h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + สร้าง Shipment
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div
              className={`bg-white rounded-xl p-4 shadow cursor-pointer ${
                statusFilter === "" ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => setStatusFilter("")}
            >
              <div className="text-2xl font-bold text-gray-800">
                {stats.total}
              </div>
              <div className="text-sm text-gray-500">ทั้งหมด</div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 shadow cursor-pointer ${
                statusFilter === "pending" ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => setStatusFilter("pending")}
            >
              <div className="text-2xl font-bold text-gray-600">
                {stats.pending}
              </div>
              <div className="text-sm text-gray-500">รอส่ง</div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 shadow cursor-pointer ${
                statusFilter === "in_transit" ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => setStatusFilter("in_transit")}
            >
              <div className="text-2xl font-bold text-blue-600">
                {stats.inTransit}
              </div>
              <div className="text-sm text-gray-500">กำลังส่ง</div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 shadow cursor-pointer ${
                statusFilter === "partial" ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => setStatusFilter("partial")}
            >
              <div className="text-2xl font-bold text-yellow-600">
                {stats.partial}
              </div>
              <div className="text-sm text-gray-500">ส่งบางส่วน</div>
            </div>
            <div
              className={`bg-white rounded-xl p-4 shadow cursor-pointer ${
                statusFilter === "delivered" ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => setStatusFilter("delivered")}
            >
              <div className="text-2xl font-bold text-green-600">
                {stats.delivered}
              </div>
              <div className="text-sm text-gray-500">ส่งถึงแล้ว</div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Shipments Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  รหัส
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  เส้นทาง
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  จำนวน Tags
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  สถานะ
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  วันที่สร้าง
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">
                    {shipment.shipmentCode}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>{shipment.originWarehouse?.name || "-"}</div>
                    <div className="text-gray-400">↓</div>
                    <div>{shipment.destinationWarehouse?.name || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {shipment.items?.length || 0} รายการ
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(shipment.status)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(shipment.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedShipment(shipment);
                          setShowDetailModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        ดูรายละเอียด
                      </button>
                      {shipment.status !== "delivered" &&
                        shipment.status !== "cancelled" && (
                          <button
                            onClick={() => handleCancel(shipment.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            ยกเลิก
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {shipments.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              ไม่พบข้อมูล Shipment
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={() =>{
            setShowCreateModal(false);
            setFormError("")
          }}
        />
          
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">สร้าง Shipment ใหม่</h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ต้นทาง *
                </label>
                <select
                  value={formData.originWarehouseId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      originWarehouseId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">เลือกคลังสินค้าต้นทาง</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ปลายทาง *
                </label>
                <select
                  value={formData.destinationWarehouseId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destinationWarehouseId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">เลือกคลังสินค้าปลายทาง</option>
                  {warehouses.map((w) => (
                    <option
                      key={w.id}
                      value={w.id}
                      disabled={w.id.toString() === formData.originWarehouseId}
                    >
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tag UIDs *{" "}
                  <span className="text-gray-400 font-normal">
                    (คั่นด้วย , หรือขึ้นบรรทัดใหม่)
                  </span>
                </label>
                <textarea
                  value={formData.tagUids}
                  onChange={(e) =>
                    setFormData({ ...formData, tagUids: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="TAG001&#10;TAG002&#10;TAG003"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมายเหตุ
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormError("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {formLoading ? "กำลังสร้าง..." : "สร้าง Shipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedShipment.shipmentCode}
                </h2>
                <p className="text-gray-500 text-sm">
                  สร้างเมื่อ {formatDate(selectedShipment.createdAt)}
                </p>
              </div>
              {getStatusBadge(selectedShipment.status)}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-500">ต้นทาง</div>
                <div className="font-medium">
                  {selectedShipment.originWarehouse?.name || "-"}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-500">ปลายทาง</div>
                <div className="font-medium">
                  {selectedShipment.destinationWarehouse?.name || "-"}
                </div>
              </div>
            </div>

            {selectedShipment.notes && (
              <div className="mb-6">
                <div className="text-sm text-gray-500 mb-1">หมายเหตุ</div>
                <div className="text-gray-700">{selectedShipment.notes}</div>
              </div>
            )}

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                รายการ Tags ({selectedShipment.items?.length || 0})
              </div>
              <div className="border rounded-lg divide-y">
                {selectedShipment.items?.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-mono text-sm">{item.tagUid}</div>
                      {item.tagName && (
                        <div className="text-xs text-gray-500">
                          {item.tagName}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {getStatusBadge(item.status)}
                      {item.exitedAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          ออก: {formatDate(item.exitedAt)}
                        </div>
                      )}
                      {item.arrivedAt && (
                        <div className="text-xs text-gray-500">
                          ถึง: {formatDate(item.arrivedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedShipment(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
