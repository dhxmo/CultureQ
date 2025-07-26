"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAdmin } from "../../contexts/AdminContext";
import { Id, Doc } from "../../../convex/_generated/dataModel";

interface CouponForm {
  code: string;
  title: string;
  description: string;
  merchantName: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  minSpendAmount: number | "";
  maxDiscountAmount: number | "";
  validFrom: string;
  validUntil: string;
  usageLimit: number | "";
}

const initialForm: CouponForm = {
  code: "",
  title: "",
  description: "",
  merchantName: "",
  discountType: "percentage",
  discountValue: 0,
  minSpendAmount: "",
  maxDiscountAmount: "",
  validFrom: "",
  validUntil: "",
  usageLimit: "",
};

export default function CouponsManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Id<"coupons"> | null>(
    null,
  );
  const [form, setForm] = useState<CouponForm>(initialForm);

  const { adminId } = useAdmin();
  const coupons = useQuery(api.coupons.listCoupons);
  const createCoupon = useMutation(api.coupons.createCoupon);
  const updateCoupon = useMutation(api.coupons.updateCoupon);
  const deleteCoupon = useMutation(api.coupons.deleteCoupon);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId) return;

    try {
      const couponData = {
        code: form.code,
        title: form.title,
        description: form.description,
        merchantName: form.merchantName.toLowerCase(),
        discountType: form.discountType,
        discountValue: form.discountValue,
        minSpendAmount: form.minSpendAmount || undefined,
        maxDiscountAmount: form.maxDiscountAmount || undefined,
        validFrom: new Date(form.validFrom).getTime(),
        validUntil: new Date(form.validUntil).getTime(),
        usageLimit: form.usageLimit || undefined,
        createdBy: adminId as Id<"admins">,
      };

      if (editingCoupon) {
        // Remove createdBy field for updates (it shouldn't change)
        const { createdBy, ...updateData } = couponData;
        void createdBy;
        await updateCoupon({
          couponId: editingCoupon,
          ...updateData,
        });
      } else {
        await createCoupon(couponData);
      }

      setForm(initialForm);
      setShowForm(false);
      setEditingCoupon(null);
    } catch (error) {
      console.error("Error saving coupon:", error);
      alert(error instanceof Error ? error.message : "Failed to save coupon");
    }
  };

  const handleEdit = (coupon: Doc<"coupons">) => {
    setForm({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description,
      merchantName: coupon.merchantName,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minSpendAmount: coupon.minSpendAmount || "",
      maxDiscountAmount: coupon.maxDiscountAmount || "",
      validFrom: new Date(coupon.validFrom).toISOString().split("T")[0],
      validUntil: new Date(coupon.validUntil).toISOString().split("T")[0],
      usageLimit: coupon.usageLimit || "",
    });
    setEditingCoupon(coupon._id);
    setShowForm(true);
  };

  const handleDelete = async (couponId: Id<"coupons">) => {
    if (confirm("Are you sure you want to delete this coupon?")) {
      try {
        await deleteCoupon({ couponId });
      } catch (error) {
        console.error("Error deleting coupon:", error);
        alert("Failed to delete coupon");
      }
    }
  };

  const handleToggleActive = async (coupon: Doc<"coupons">) => {
    try {
      await updateCoupon({
        couponId: coupon._id,
        isActive: !coupon.isActive,
      });
    } catch (error) {
      console.error("Error toggling coupon status:", error);
      alert("Failed to update coupon status");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Coupons Management</h2>
        <button
          onClick={() => {
            setForm(initialForm);
            setEditingCoupon(null);
            setShowForm(!showForm);
          }}
          className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          {showForm ? "Cancel" : "Add New Coupon"}
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
                Coupon Code
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Type
              </label>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discountType: e.target.value as
                      | "percentage"
                      | "fixed_amount",
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed Amount</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Value
              </label>
              <input
                type="number"
                value={form.discountValue}
                onChange={(e) =>
                  setForm({ ...form, discountValue: Number(e.target.value) })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
                min="0"
                step="0.01"
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
                Max Discount Amount (Optional)
              </label>
              <input
                type="number"
                value={form.maxDiscountAmount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxDiscountAmount: e.target.value
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
              {editingCoupon ? "Update Coupon" : "Create Coupon"}
            </button>
          </div>
        </form>
      )}

      {/* Coupons List */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Merchant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Discount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usage
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
            {coupons?.map((coupon) => (
              <tr key={coupon._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {coupon.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {coupon.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {coupon.merchantName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {coupon.discountType === "percentage"
                    ? `${coupon.discountValue}%`
                    : `$${coupon.discountValue}`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {coupon.usageCount}
                  {coupon.usageLimit ? `/${coupon.usageLimit}` : ""}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      coupon.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {coupon.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleEdit(coupon)}
                    className="cursor-pointer text-indigo-600 hover:text-indigo-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(coupon)}
                    className={`${
                      coupon.isActive
                        ? "text-red-600 hover:text-red-900 cursor-pointer"
                        : "text-green-600 hover:text-green-900 cursor-pointer"
                    }`}
                  >
                    {coupon.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(coupon._id)}
                    className="cursor-pointer text-red-600 hover:text-red-900"
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
