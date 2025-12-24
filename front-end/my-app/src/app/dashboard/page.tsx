// src/app/dashboard/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, logout, isLoading, isSuperAdmin, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">Super Admin</span>;
      case 'admin':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">Admin</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">User</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚛</span>
            <h1 className="text-xl font-bold text-gray-800">WareHouse Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">{user.fullName || user.username}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* User Info Card */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">ข้อมูลผู้ใช้</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">ชื่อผู้ใช้</p>
              <p className="font-medium">{user.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">ชื่อ-นามสกุล</p>
              <p className="font-medium">{user.fullName || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <div className="mt-1">{getRoleBadge(user.role)}</div>
            </div>
            <div>
              <p className="text-sm text-gray-500">บริษัท</p>
              <p className="font-medium">
                {isSuperAdmin ? (
                  <span className="text-purple-600">เข้าถึงได้ทุกบริษัท</span>
                ) : (
                  user.organization?.name || '-'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">เมนูหลัก</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Shipments */}
          <Link href="/shipments" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition cursor-pointer">
            <div className="text-3xl mb-3">📦</div>
            <h3 className="font-semibold text-gray-800">Shipments</h3>
            <p className="text-sm text-gray-500">จัดการการขนส่ง</p>
          </Link>

          {/* Tracking */}
          <Link href="/tracking" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition cursor-pointer">
            <div className="text-3xl mb-3">📍</div>
            <h3 className="font-semibold text-gray-800">Tracking</h3>
            <p className="text-sm text-gray-500">ติดตามสินค้า</p>
          </Link>

          {/* Warehouse */}
          <Link href="/warehouse" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition cursor-pointer">
            <div className="text-3xl mb-3">🏭</div>
            <h3 className="font-semibold text-gray-800">Warehouse</h3>
            <p className="text-sm text-gray-500">ข้อมูล Tags</p>
          </Link>

          {/* Reports */}
          <Link href="/reports" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition cursor-pointer">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-semibold text-gray-800">Reports</h3>
            <p className="text-sm text-gray-500">รายงาน</p>
          </Link>

          {/* Admin - Organizations (Super Admin Only) */}
          {isSuperAdmin &&  (
            <Link href="/admin/organizations" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition cursor-pointer border-2 border-purple-200">
              <div className="text-3xl mb-3">🏢</div>
              <h3 className="font-semibold text-purple-800">จัดการบริษัท</h3>
              <p className="text-sm text-purple-500">เพิ่ม/แก้ไข Organizations</p>
            </Link>
          )}

          {/* Admin - Users (Admin & Super Admin) */}
          {isAdmin && (
            <Link href="/admin/users" className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition cursor-pointer border-2 border-blue-200">
              <div className="text-3xl mb-3">👥</div>
              <h3 className="font-semibold text-blue-800">จัดการผู้ใช้</h3>
              <p className="text-sm text-blue-500">เพิ่ม/แก้ไข Users</p>
            </Link>
          )}

        </div>
      </main>
    </div>
  );
}