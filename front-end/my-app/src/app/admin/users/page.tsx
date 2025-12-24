// src/app/addmin/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

interface Organization {
  id: number;
  name: string;
  code: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: number | null;
  organization: Organization | null;
  isActive: boolean;
  createdAt: string;
}

export default function AdminUserPage() {
  const { user, token, isLoading, isAdmin } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateModel, setShowCreateModel] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    fullName: "",
    password: "",
    role: "user",
    organizationId: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    } else if (!isLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [user, isLoading, isAdmin, router]);

  useEffect(() => {
    if (token && isAdmin) {
      fetchUsers();
      fetchOrganizations();
    }
  }, [token, isAdmin]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      setError("ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const res = await fetch("/api/admin/organizations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
      }
    } catch (err) {
      console.error("Failed to fetch organizations");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          organizationId:
            formData.role === "user" ? Number(formData.organizationId) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "สร้างผู้ใช้สำเร็จ");
      }

      setShowCreateModel(false);
      setFormData({
        username: "",
        email: "",
        fullName: "",
        password: "",
        role: "user",
        organizationId: "",
      });
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setFormError("");
    setFormLoading(true);

    try {
      const res = await fetch(
        `/api/admin/users/${selectedUser.id}/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newPassword }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
      }

      setShowResetPasswordModal(false);
      setNewPassword("");
      setSelectedUser(null);
      alert("รีเซ็ตรหัสผ่านสำเร็จ");
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("คุณต้องการลบผู้ใช้นี้หรือไม่?")) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.message || "ลบผู้ใช้ไม่สำเร็จ");
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาด");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return (
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
            Super Admin
          </span>
        );
      case "admin":
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
            Admin
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
            User
          </span>
        );
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive
    ? <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Active</span>
    : <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">Inactive</span>;
  };

   const canManageUser = (targetUser: User) => {
    if (user?.role === 'super_admin') return true;
    if (user?.role === 'admin' && targetUser.role === 'user') return true;
    return false;
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
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              ← กลับ
            </Link>
            <h1 className="text-xl font-bold text-gray-800">จัดการผู้ใช้</h1>
          </div>
          <button
            onClick={() => setShowCreateModel(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + เพิ่มผู้ใช้
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ใช้</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">บริษัท</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{u.username}</div>
                      <div className="text-sm text-gray-500">{u.fullName || '-'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                  <td className="px-6 py-4">{getRoleBadge(u.role)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {u.organization?.name || '-'}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(u.isActive)}</td>
                  <td className="px-6 py-4">
                    {canManageUser(u) && u.id !== user?.id && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setShowResetPasswordModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          รีเซ็ตรหัส
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          ลบ
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              ไม่พบข้อมูลผู้ใช้
            </div>
          )}
        </div>
      </main>

      {/* Create User Modal */}
      {showCreateModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">เพิ่มผู้ใช้ใหม่</h2>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              {user?.role === 'super_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              )}

              {formData.role === 'user' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">บริษัท</label>
                  <select
                    value={formData.organizationId}
                    onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">-- เลือกบริษัท --</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModel(false);
                    setFormError('');
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
                  {formLoading ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">รีเซ็ตรหัสผ่าน</h2>
            <p className="text-gray-600 mb-4">
              รีเซ็ตรหัสผ่านสำหรับ: <strong>{selectedUser.username}</strong>
            </p>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setNewPassword('');
                    setSelectedUser(null);
                    setFormError('');
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
                  {formLoading ? 'กำลังรีเซ็ต...' : 'รีเซ็ตรหัสผ่าน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
