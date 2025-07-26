"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAdmin } from "../../../contexts/AdminContext";
import { useRouter } from "next/navigation";
import CouponsManagement from "../../../components/admin/CouponsManagement";
import CashbacksManagement from "../../../components/admin/CashbacksManagement";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"coupons" | "cashbacks">(
    "coupons",
  );
  const { isAuthenticated, isLoading, username, logout } = useAdmin();
  const router = useRouter();

  const coupons = useQuery(api.coupons.listCoupons);
  const cashbacks = useQuery(api.cashbacks.listCashbacks);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-600">Welcome back, {username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="cursor-pointer bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("coupons")}
              className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "coupons"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Coupons Management
            </button>
            <button
              onClick={() => setActiveTab("cashbacks")}
              className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "cashbacks"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Cashbacks Management
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg">
          {activeTab === "coupons" && <CouponsManagement />}
          {activeTab === "cashbacks" && <CashbacksManagement />}
        </div>
      </div>
    </div>
  );
}
