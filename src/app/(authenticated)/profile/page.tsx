"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import TransactionList from "../../../components/TransactionList";

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, userId, plaidItemId, logout } = useAuth();

  // US Cities for dropdown (sample list)
  const usCities = [
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia",
  ];

  // Form state
  const [age, setAge] = useState<number | "">("");
  const [location, setLocation] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Convex hooks
  const user = useQuery(
    api.users.getUserById,
    userId ? { userId: userId as Id<"users"> } : "skip",
  );
  const updateUserProfile = useMutation(api.users.updateUserProfile);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setAge(user.age || "");
      setLocation(user.location || "");
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/onboarding");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setIsUpdating(true);
    try {
      await updateUserProfile({
        userId: userId as Id<"users">,
        age: age === "" ? undefined : Number(age),
        location: location || undefined,
      });
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading profile...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Redirecting to onboarding...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Profile</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            className="cursor-pointer bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
          >
            ← Back
          </button>
          <button
            onClick={logout}
            className="cursor-pointer bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* User Preferences Form */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">User Preferences</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="age"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Age
                </label>
                <input
                  type="number"
                  id="age"
                  min="13"
                  max="120"
                  value={age}
                  onChange={(e) =>
                    setAge(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your age"
                />
              </div>

              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Location
                </label>
                <select
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a city</option>
                  {usCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="cursor-pointer w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? "Updating..." : "Update Preferences"}
              </button>
            </form>

            {user && (
              <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                <p>
                  <strong>Current:</strong> Age {user.age || "Not set"},{" "}
                  {user.location || "No location"}
                </p>
              </div>
            )}
          </div>

          {/* Authentication Status */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">
              Authentication Status
            </h2>
            <div className="space-y-2">
              <p>
                <strong>User ID:</strong>
                <span className="text-sm text-gray-600 block mt-1 font-mono break-all">
                  {userId}
                </span>
              </p>
              <p>
                <strong>Plaid Item ID:</strong>
                <span className="text-sm text-gray-600 block mt-1 font-mono break-all">
                  {plaidItemId}
                </span>
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span className="text-green-600">Authenticated</span>
              </p>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="lg:col-span-2">
          <TransactionList />
        </div>
      </div>
    </div>
  );
}
