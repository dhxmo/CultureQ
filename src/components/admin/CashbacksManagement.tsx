"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAdmin } from "../../contexts/AdminContext";
import { Id, Doc } from "../../../convex/_generated/dataModel";

interface CashbackForm {
  title: string;
  description: string;
  merchantName: string;
  cashbackRate: number;
  minSpendAmount: number | "";
  maxCashbackAmount: number | "";
  validFrom: string;
  validUntil: string;
  usageLimit: number | "";
}

const initialForm: CashbackForm = {
  title: "",
  description: "",
  merchantName: "",
  cashbackRate: 0,
  minSpendAmount: "",
  maxCashbackAmount: "",
  validFrom: "",
  validUntil: "",
  usageLimit: "",
};

export default function CashbacksManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingCashback, setEditingCashback] =
    useState<Id<"cashbacks"> | null>(null);
  const [form, setForm] = useState<CashbackForm>(initialForm);

  const { adminId } = useAdmin();
  const cashbacks = useQuery(api.cashbacks.listCashbacks);
  const createCashback = useMutation(api.cashbacks.createCashback);
  const updateCashback = useMutation(api.cashbacks.updateCashback);
  const deleteCashback = useMutation(api.cashbacks.deleteCashback);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId) return;

    try {
      const cashbackData = {
        title: form.title,
        description: form.description,
        merchantName: form.merchantName.toLowerCase(),
        cashbackRate: form.cashbackRate,
        minSpendAmount: form.minSpendAmount || undefined,
        maxCashbackAmount: form.maxCashbackAmount || undefined,
        validFrom: new Date(form.validFrom).getTime(),
        validUntil: new Date(form.validUntil).getTime(),
        usageLimit: form.usageLimit || undefined,
        createdBy: adminId as Id<"admins">,
      };

      if (editingCashback) {
        // Remove createdBy field for updates (it shouldn't change)
        const { createdBy, ...updateData } = cashbackData;
        void createdBy;
        await updateCashback({
          cashbackId: editingCashback,
          ...updateData,
        });
      } else {
        await createCashback(cashbackData);
      }

      setForm(initialForm);
      setShowForm(false);
      setEditingCashback(null);
    } catch (error) {
      console.error("Error saving cashback:", error);
      alert(error instanceof Error ? error.message : "Failed to save cashback");
    }
  };

  const handleEdit = (cashback: Doc<"cashbacks">) => {
    setForm({
      title: cashback.title,
      description: cashback.description,
      merchantName: cashback.merchantName,
      cashbackRate: cashback.cashbackRate,
      minSpendAmount: cashback.minSpendAmount || "",
      maxCashbackAmount: cashback.maxCashbackAmount || "",
      validFrom: new Date(cashback.validFrom).toISOString().split("T")[0],
      validUntil: new Date(cashback.validUntil).toISOString().split("T")[0],
      usageLimit: cashback.usageLimit || "",
    });
    setEditingCashback(cashback._id);
    setShowForm(true);
  };

  const handleDelete = async (cashbackId: Id<"cashbacks">) => {
    if (confirm("Are you sure you want to delete this cashback?")) {
      try {
        await deleteCashback({ cashbackId });
      } catch (error) {
        console.error("Error deleting cashback:", error);
        alert("Failed to delete cashback");
      }
    }
  };

  const handleToggleActive = async (cashback: Doc<"cashbacks">) => {
    try {
      await updateCashback({
        cashbackId: cashback._id,
        isActive: !cashback.isActive,
      });
    } catch (error) {
      console.error("Error toggling cashback status:", error);
      alert("Failed to update cashback status");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Cashbacks Management
        </h2>
        <button
          onClick={() => {
            setForm(initialForm);
            setEditingCashback(null);
            setShowForm(!showForm);
          }}
          className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          {showForm ? "Cancel" : "Add New Cashback"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 p-6 rounded-lg mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Merchant Name
              </label>
              <input
                type="text"
                value={form.merchantName}
                onChange={(e) =>
                  setForm({ ...form, merchantName: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cashback Rate (%)
              </label>
              <input
                type="number"
                value={form.cashbackRate}
                onChange={(e) =>
                  setForm({ ...form, cashbackRate: Number(e.target.value) })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Spend Amount (Optional)
              </label>
              <input
                type="number"
                value={form.minSpendAmount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minSpendAmount: e.target.value
                      ? Number(e.target.value)
                      : "",
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Cashback Amount (Optional)
              </label>
              <input
                type="number"
                value={form.maxCashbackAmount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxCashbackAmount: e.target.value
                      ? Number(e.target.value)
                      : "",
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid From
              </label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) =>
                  setForm({ ...form, validFrom: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid Until
              </label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) =>
                  setForm({ ...form, validUntil: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usage Limit (Optional)
              </label>
              <input
                type="number"
                value={form.usageLimit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    usageLimit: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="1"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              {editingCashback ? "Update Cashback" : "Create Cashback"}
            </button>
          </div>
        </form>
      )}

      {/* Cashbacks List */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Merchant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cashback Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valid Until
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cashbacks?.map((cashback) => (
              <tr key={cashback._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {cashback.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {cashback.merchantName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {cashback.cashbackRate}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {cashback.usageCount}
                  {cashback.usageLimit ? `/${cashback.usageLimit}` : ""}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(cashback.validUntil).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      cashback.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {cashback.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleEdit(cashback)}
                    className="cursor-pointer text-indigo-600 hover:text-indigo-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(cashback)}
                    className={`${
                      cashback.isActive
                        ? "text-red-600 hover:text-red-900 cursor-pointer"
                        : "text-green-600 hover:text-green-900 cursor-pointer"
                    }`}
                  >
                    {cashback.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(cashback._id)}
                    className="text-red-600 hover:text-red-900 cursor-pointer"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
