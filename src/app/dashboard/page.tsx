"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useQuery, useMutation } from "convex/react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import ChatInterface from "../../components/ChatInterface";

export default function DashboardPage() {
  const {
    isAuthenticated,
    isLoading,
    transactions,
    isLoadingTransactions,
    error,
    fetchTransactions,
    // fetchAttachedBrands,
    userId,
  } = useAuth();
  const router = useRouter();

  // Convex hooks for merchant exclusions
  const user = useQuery(
    api.users.getUserById,
    userId ? { userId: userId as Id<"users"> } : "skip",
  );
  const updateUserProfile = useMutation(api.users.updateUserProfile);

  // Get unique merchants from transactions
  const availableMerchants = transactions?.merchants
    ? Array.from(new Set(transactions.merchants.map((m) => m.name))).sort()
    : [];

  // Get matched brands from conversations
  const matchedBrands = useQuery(
    api.conversations.getUserMatchedBrands,
    userId ? { userId: userId as Id<"users"> } : "skip",
  );

  // State for merchant exclusions
  const [excludedMerchants, setExcludedMerchants] = useState<string[]>([]);
  const [isUpdatingExclusions, setIsUpdatingExclusions] = useState(false);

  // Chat interface state
  const [activeChatType, setActiveChatType] = useState<
    "aspirations_bridge" | "coupon_request" | null
  >(null);

  // Initialize excluded merchants from user data
  useEffect(() => {
    if (user?.excludedMerchants) {
      setExcludedMerchants(user.excludedMerchants);
    }
  }, [user]);

  const [attachedBrands, setAttachedBrands] = useState<
    {
      merchantName: string;
      brands: Array<{
        name: string;
        entity_id: string;
        popularity: number;
        affinity: number;
        audience_growth: number;
        short_description?: string;
      }>;
    }[]
  >([]);

  const [matchedBrandsWithAttached, setMatchedBrandsWithAttached] = useState<
    Array<{
      name: string;
      entity_id: string;
      merchantName: string;
      short_description: string;
      matchScore: number;
      matchReason: string;
      matchedAt: number;
      conversationId: string;
      chatType: string;
      attachedBrands?: Array<{
        name: string;
        entity_id: string;
        popularity: number;
        affinity: number;
        audience_growth: number;
        short_description: string;
      }>;
    }>
  >([]);

  // Brand pagination state for each merchant
  const [brandPages, setBrandPages] = useState<Record<string, number>>({});
  const brandsPerPage = 6; // Show 6 brands per page per merchant

  const getBrandPage = (merchantName: string) => {
    return brandPages[merchantName] || 1;
  };

  const setBrandPage = (merchantName: string, page: number) => {
    setBrandPages((prev) => ({ ...prev, [merchantName]: page }));
  };

  const getPaginatedBrands = (
    brands: Array<{
      name: string;
      entity_id: string;
      popularity: number;
      affinity: number;
      audience_growth: number;
      short_description?: string;
    }>,
    merchantName: string,
  ) => {
    const currentPage = getBrandPage(merchantName);
    const startIndex = (currentPage - 1) * brandsPerPage;
    const endIndex = startIndex + brandsPerPage;
    return brands.slice(startIndex, endIndex);
  };

  const getTotalBrandPages = (brandsCount: number) => {
    return Math.ceil(brandsCount / brandsPerPage);
  };

  // Helper function to get coupons/cashbacks for a specific brand
  const getBrandOffers = (brandName: string) => {
    const coupons =
      matchingCoupons?.filter(
        (coupon) =>
          coupon.merchantName.toLowerCase() === brandName.toLowerCase(),
      ) || [];

    const cashbacks =
      matchingCashbacks?.filter(
        (cashback) =>
          cashback.merchantName.toLowerCase() === brandName.toLowerCase(),
      ) || [];

    return { coupons, cashbacks };
  };

  const handleContinue = () => {
    router.push("/profile");
  };

  // Merchant exclusion handlers
  const handleMerchantToggle = async (merchantName: string) => {
    if (!userId) return;

    const newExcluded = excludedMerchants.includes(merchantName)
      ? excludedMerchants.filter((m) => m !== merchantName)
      : [...excludedMerchants, merchantName];

    setExcludedMerchants(newExcluded);

    // Save to Convex immediately
    setIsUpdatingExclusions(true);
    try {
      await updateUserProfile({
        userId: userId as Id<"users">,
        excludedMerchants: newExcluded.length > 0 ? newExcluded : undefined,
      });
    } catch (error) {
      console.error("Error updating excluded merchants:", error);
      // Revert on error
      setExcludedMerchants(excludedMerchants);
    } finally {
      setIsUpdatingExclusions(false);
    }
  };

  const handleSelectAll = async () => {
    if (!userId) return;

    setExcludedMerchants(availableMerchants);

    setIsUpdatingExclusions(true);
    try {
      await updateUserProfile({
        userId: userId as Id<"users">,
        excludedMerchants: availableMerchants,
      });
    } catch (error) {
      console.error("Error updating excluded merchants:", error);
      setExcludedMerchants(excludedMerchants);
    } finally {
      setIsUpdatingExclusions(false);
    }
  };

  const handleSelectNone = async () => {
    if (!userId) return;

    setExcludedMerchants([]);

    setIsUpdatingExclusions(true);
    try {
      await updateUserProfile({
        userId: userId as Id<"users">,
        excludedMerchants: undefined,
      });
    } catch (error) {
      console.error("Error updating excluded merchants:", error);
      setExcludedMerchants(excludedMerchants);
    } finally {
      setIsUpdatingExclusions(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/onboarding");
    }
  }, [isAuthenticated, isLoading, router]);

  // Automatically fetch transactions when authenticated
  useEffect(() => {
    if (isAuthenticated && !transactions && !isLoadingTransactions) {
      // Check if user has required profile information before fetching
      const userAge = user?.age;
      const userLocation = user?.location;

      if (!userAge || !userLocation) {
        const missingFields = [];
        if (!userAge) missingFields.push("age");
        if (!userLocation) missingFields.push("location");

        alert(
          `Please complete your profile first!\n\n` +
            `Missing: ${missingFields.join(", ")}\n\n` +
            `Go to Profile → Set your ${missingFields.join(" and ")} to get personalized recommendations.`,
        );
        router.push("/profile");
        return;
      }

      fetchTransactions();
    }
  }, [
    isAuthenticated,
    transactions,
    isLoadingTransactions,
    fetchTransactions,
    user,
    router,
  ]);

  // Extract all brand names from attached brands for coupon/cashback matching
  const transactionBrandNames = transactions?.attachedBrands
    ? transactions.attachedBrands
        .filter(
          (merchantData) =>
            !excludedMerchants.includes(merchantData.merchantName),
        )
        .flatMap((merchantData) =>
          merchantData.brands.map((brand) => brand.name),
        )
    : [];

  // Only use transaction-based brands for coupon/cashback matching
  // Matched brands handle their own coupon/cashback logic separately
  const allBrandNames = transactionBrandNames;

  // Debug logging
  // Query for matching coupons and cashbacks
  const matchingCoupons = useQuery(
    api.coupons.findCouponsForBrands,
    allBrandNames.length > 0 ? { brandNames: allBrandNames } : "skip",
  );

  const matchingCashbacks = useQuery(
    api.cashbacks.findCashbacksForBrands,
    allBrandNames.length > 0 ? { brandNames: allBrandNames } : "skip",
  );

  // Mutation to test saving QlooEntities directly
  const saveQlooEntities = useMutation(api.qlooEntities.saveQlooEntities);

  // Update attached brands when transactions change, filtering out excluded merchants
  useEffect(() => {
    if (isAuthenticated && transactions?.attachedBrands) {
      // Filter out excluded merchants from attached brands display
      const filteredAttachedBrands = transactions.attachedBrands.filter(
        (merchantData) =>
          !excludedMerchants.includes(merchantData.merchantName),
      );

      setAttachedBrands(filteredAttachedBrands);

      // Initialize pagination for each merchant separately
      const initialPagination: Record<string, number> = {};
      filteredAttachedBrands.forEach((merchantData) => {
        initialPagination[merchantData.merchantName] = 1;
      });
      setBrandPages(initialPagination);
    }
  }, [isAuthenticated, transactions, excludedMerchants]);

  // Auto-save QlooEntities when new attached brands data arrives
  useEffect(() => {
    if (isAuthenticated && transactions?.attachedBrands && saveQlooEntities) {
      // Extract all QlooEntities from attached brands data
      const qlooEntities = transactions.attachedBrands.flatMap(
        (attachedBrand) =>
          attachedBrand.brands.map((brand) => ({
            entityId: brand.entity_id,
            name: brand.name,
          })),
      );

      if (qlooEntities.length > 0) {
        saveQlooEntities({ entities: qlooEntities })
          .then((result) => {
            console.log(
              `🔄 Auto-save: Successfully saved ${qlooEntities.length} QlooEntities:`,
              result,
            );
          })
          .catch((error) => {
            console.error("🔄 Auto-save: Error saving QlooEntities:", error);
          });
      } else {
        console.log("🔄 Auto-save: No QlooEntities to save");
      }
    }
  }, [isAuthenticated, transactions?.attachedBrands, saveQlooEntities]);

  // Process matched brands - only fetch attached brands if not already cached
  useEffect(() => {
    const processMatchedBrands = async () => {
      if (!isAuthenticated || !matchedBrands || matchedBrands.length === 0) {
        setMatchedBrandsWithAttached([]);
        return;
      }

      console.log("🎯 Processing matched brands from conversations");

      // Use cached data directly from Convex - no API calls needed if already fetched
      // Remove duplicates based on entity_id + merchantName combination
      const seenBrands = new Set<string>();
      const processedBrands = matchedBrands
        .filter((brand) => {
          const brandKey = `${brand.entity_id}-${brand.merchantName}`;
          if (seenBrands.has(brandKey)) {
            return false;
          }
          seenBrands.add(brandKey);
          return true;
        })
        .map((brand) => ({
          ...brand,
          attachedBrands: brand.attachedBrands || [],
        }));

      setMatchedBrandsWithAttached(processedBrands);

      // Only fetch attached brands for brands that don't have them cached and have been cached for more than 24 hours
      // Skip Qloo API calls for coupon_request chat types
      const brandsNeedingAttachedBrands = matchedBrands.filter((brand) => {
        // Skip Qloo API calls for coupon_request conversations
        if (brand.chatType === "coupon_request") {
          return false;
        }

        const hasAttachedBrands =
          brand.attachedBrands && brand.attachedBrands.length > 0;
        const isStale =
          !brand.attachedBrandsFetchedAt ||
          Date.now() - brand.attachedBrandsFetchedAt > 24 * 60 * 60 * 1000; // 24 hours

        return !hasAttachedBrands || isStale;
      });

      if (brandsNeedingAttachedBrands.length === 0) {
        console.log("🎯 All matched brands have fresh attached brands data");
        return;
      }

      console.log(
        "🎯 Fetching attached brands for",
        brandsNeedingAttachedBrands.length,
        "brands",
      );

      // Fetch attached brands only for brands that need them
      for (const brand of brandsNeedingAttachedBrands) {
        try {
          if (!brand.entity_id || !user?.age || !user?.location) {
            console.log("⏭️ Skipping", brand.name, "- missing required data");
            continue;
          }

          const attachedResponse = await fetch("/api/qloo/attached-brands", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityId: brand.entity_id,
              city: user.location,
              userAge: user.age,
              merchantName: brand.name,
            }),
          });

          if (attachedResponse.ok) {
            const attachedData = await attachedResponse.json();
            const attachedBrands = attachedData.brands || [];

            // Save to Convex for future use
            const convex = new ConvexHttpClient(
              process.env.NEXT_PUBLIC_CONVEX_URL!,
            );
            await convex.mutation(
              api.conversations.updateMatchedBrandAttachedBrands,
              {
                conversationId: brand.conversationId as Id<"conversations">,
                brandName: brand.name,
                attachedBrands: attachedBrands,
              },
            );

            console.log(
              "✅ Updated attached brands for",
              brand.name,
              "- count:",
              attachedBrands.length,
            );
          }
        } catch (error) {
          console.error(
            "❌ Error fetching attached brands for",
            brand.name,
            error,
          );
        }
      }
    };

    processMatchedBrands();
  }, [isAuthenticated, matchedBrands, user?.age, user?.location]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-4">
          <button
            onClick={handleContinue}
            className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Go to Profile
          </button>
          <button
            onClick={() => router.back()}
            className="cursor-pointer bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Merchant Exclusions */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-2xl font-semibold mb-4">
              Merchant Preferences
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Toggle off merchants you don&apos;t want to receive
              recommendations for:
            </p>

            {availableMerchants.length > 0 ? (
              <>
                {/* Select All/None Buttons */}
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={isUpdatingExclusions}
                    className="cursor-pointer px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Exclude All
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectNone}
                    disabled={isUpdatingExclusions}
                    className="cursor-pointer px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Include All
                  </button>
                  <span className="text-sm text-gray-500 self-center ml-2">
                    {excludedMerchants.length} of {availableMerchants.length}{" "}
                    excluded
                    {isUpdatingExclusions && " (saving...)"}
                  </span>
                </div>

                {/* Merchant Toggle Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {availableMerchants.map((merchant) => {
                    const isExcluded = excludedMerchants.includes(merchant);
                    return (
                      <button
                        key={merchant}
                        onClick={() => handleMerchantToggle(merchant)}
                        disabled={isUpdatingExclusions}
                        className={`p-3 text-sm rounded-lg border-2 transition-colors cursor-pointer ${
                          isExcluded
                            ? "border-red-300 bg-red-50 text-red-700"
                            : "border-green-300 bg-green-50 text-green-700"
                        } hover:opacity-80 disabled:opacity-50`}
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <span className="text-lg">
                            {isExcluded ? "❌" : "✅"}
                          </span>
                          <span className="font-medium">{merchant}</span>
                        </div>
                        <div className="text-xs mt-1">
                          {isExcluded ? "Excluded" : "Included"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No merchants found in transactions</p>
                <p className="text-sm mt-2">
                  Connect your bank account and make some transactions to see
                  merchants here
                </p>
              </div>
            )}
          </div>

          {/* Available Offers Section */}
          {(matchingCoupons && matchingCoupons.length > 0) ||
          (matchingCashbacks && matchingCashbacks.length > 0) ? (
            <div className="bg-white p-6 rounded-lg border">
              <h2 className="text-2xl font-semibold mb-4">
                🎉 Available Offers for You!
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Based on your preferences and transaction history, here are the
                deals available for your favorite brands:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Coupons Section */}
                {matchingCoupons && matchingCoupons.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-green-600">
                      💰 Coupons
                    </h3>
                    <div className="space-y-3">
                      {matchingCoupons.map((coupon) => (
                        <div
                          key={coupon._id}
                          className="border border-green-200 rounded-lg p-4 bg-green-50"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-green-800">
                              {coupon.title}
                            </h4>
                            <span className="bg-green-600 text-white px-2 py-1 rounded text-sm font-bold">
                              {coupon.code}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            {coupon.description}
                          </p>
                          <div className="flex justify-between items-center text-xs text-gray-600">
                            <span className="font-medium">
                              {coupon.merchantName} •{" "}
                              {coupon.discountType === "percentage"
                                ? `${coupon.discountValue}% off`
                                : `$${coupon.discountValue} off`}
                            </span>
                            <span>
                              Valid until{" "}
                              {new Date(coupon.validUntil).toLocaleDateString()}
                            </span>
                          </div>
                          {coupon.minSpendAmount && (
                            <div className="text-xs text-gray-500 mt-1">
                              Min spend: ${coupon.minSpendAmount}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cashbacks Section */}
                {matchingCashbacks && matchingCashbacks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-blue-600">
                      💸 Cashbacks
                    </h3>
                    <div className="space-y-3">
                      {matchingCashbacks.map((cashback) => (
                        <div
                          key={cashback._id}
                          className="border border-blue-200 rounded-lg p-4 bg-blue-50"
                        >
                          <h4 className="font-semibold text-blue-800 mb-2">
                            {cashback.title}
                          </h4>
                          <p className="text-sm text-gray-700 mb-2">
                            {cashback.description}
                          </p>
                          <div className="flex justify-between items-center text-xs text-gray-600">
                            <span className="font-medium">
                              {cashback.merchantName} • {cashback.cashbackRate}%
                              cashback
                            </span>
                            <span>
                              Valid until{" "}
                              {new Date(
                                cashback.validUntil,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          {cashback.minSpendAmount && (
                            <div className="text-xs text-gray-500 mt-1">
                              Min spend: ${cashback.minSpendAmount}
                            </div>
                          )}
                          {cashback.maxCashbackAmount && (
                            <div className="text-xs text-gray-500">
                              Max cashback: ${cashback.maxCashbackAmount}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : allBrandNames.length > 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">
                No Offers Available Yet
              </h3>
              <p className="text-sm text-yellow-700">
                We found {allBrandNames.length} brands you&apos;re interested
                in, but no offers are currently available for them. Check back
                later for new deals!
              </p>
            </div>
          ) : null}

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">
                Attached Brands from Qloo
              </h2>
              {transactions?.attachedBrands && excludedMerchants.length > 0 && (
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
                  {attachedBrands.length} of{" "}
                  {transactions.attachedBrands.length} merchants shown
                </span>
              )}
            </div>

            {isLoadingTransactions ? (
              <div className="text-center py-8">
                <div className="text-lg">Loading attached brands...</div>
              </div>
            ) : (matchedBrands && matchedBrands.length > 0) ||
              matchedBrandsWithAttached.length > 0 ||
              attachedBrands.length > 0 ? (
              <div className="space-y-6">
                {/* Show matched brands from conversations first */}
                {matchedBrandsWithAttached.length > 0 && (
                  <div className="mb-8">
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-6">
                      <h3 className="text-lg font-semibold text-purple-800 mb-2">
                        🎯 Brands Matched from Your Conversations
                      </h3>
                      <p className="text-sm text-purple-700">
                        Based on your chat preferences, we found{" "}
                        {matchedBrandsWithAttached.length} brands that match
                        your interests and their similar brands.
                      </p>
                    </div>
                    {matchedBrandsWithAttached.map(
                      (matchedBrand, matchedIndex) => {
                        if (
                          !matchedBrand.attachedBrands ||
                          matchedBrand.attachedBrands.length === 0
                        ) {
                          return (
                            <div
                              key={`matched-${matchedIndex}`}
                              className="border border-purple-200 rounded-lg p-4 bg-purple-50"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-purple-800">
                                  {matchedBrand.name}
                                </h4>
                                <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs">
                                  Score: {matchedBrand.matchScore}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mb-2">
                                {matchedBrand.short_description}
                              </p>
                              <div className="text-sm text-gray-500 mb-2">
                                From: {matchedBrand.chatType.replace("_", " ")}{" "}
                                • No similar brands found
                              </div>

                              {/* Show available offers for this matched brand */}
                              {(() => {
                                const { coupons, cashbacks } = getBrandOffers(
                                  matchedBrand.name,
                                );
                                if (
                                  coupons.length > 0 ||
                                  cashbacks.length > 0
                                ) {
                                  return (
                                    <div className="border-t border-purple-200 pt-2 mt-2">
                                      <div className="text-sm font-medium text-green-600 mb-1">
                                        🎉 Offers Available!
                                      </div>
                                      {coupons.length > 0 && (
                                        <div className="text-sm text-green-700">
                                          💰 {coupons.length} Coupon
                                          {coupons.length > 1 ? "s" : ""}
                                        </div>
                                      )}
                                      {cashbacks.length > 0 && (
                                        <div className="text-sm text-blue-700">
                                          💸 {cashbacks.length} Cashback
                                          {cashbacks.length > 1 ? "s" : ""}
                                        </div>
                                      )}
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="border-t border-purple-200 pt-2 mt-2">
                                      <div className="text-sm text-gray-400">
                                        No coupons available for this brand yet
                                      </div>
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`matched-${matchedIndex}`}
                            className="border border-purple-200 rounded-lg p-4 bg-purple-50"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-semibold text-purple-800 text-lg">
                                  {matchedBrand.name}
                                </h4>
                                <p className="text-sm text-gray-700 mt-1">
                                  {matchedBrand.short_description}
                                </p>
                                <p className="text-xs text-purple-600 italic mt-1">
                                  &ldquo;{matchedBrand.matchReason}&rdquo;
                                </p>

                                {/* Show available offers for the main matched brand */}
                                {(() => {
                                  const { coupons, cashbacks } = getBrandOffers(
                                    matchedBrand.name,
                                  );
                                  if (
                                    coupons.length > 0 ||
                                    cashbacks.length > 0
                                  ) {
                                    return (
                                      <div className="border-t border-purple-200 pt-2 mt-2">
                                        <div className="text-sm font-medium text-green-600 mb-1">
                                          🎉 Offers Available for{" "}
                                          {matchedBrand.name}!
                                        </div>
                                        {coupons.length > 0 && (
                                          <div className="text-sm text-green-700">
                                            💰 {coupons.length} Coupon
                                            {coupons.length > 1 ? "s" : ""}
                                          </div>
                                        )}
                                        {cashbacks.length > 0 && (
                                          <div className="text-sm text-blue-700">
                                            💸 {cashbacks.length} Cashback
                                            {cashbacks.length > 1 ? "s" : ""}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div className="border-t border-purple-200 pt-2 mt-2">
                                        <div className="text-sm text-gray-400">
                                          No coupons available for{" "}
                                          {matchedBrand.name} yet
                                        </div>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}

                {/* Show transaction-based attached brands */}
                {attachedBrands.map((merchantData, merchantIndex) => {
                  const currentBrandPage = getBrandPage(
                    merchantData.merchantName,
                  );
                  const totalBrandPages = getTotalBrandPages(
                    merchantData.brands.length,
                  );
                  const paginatedBrandsForMerchant = getPaginatedBrands(
                    merchantData.brands,
                    merchantData.merchantName,
                  );

                  return (
                    <div key={merchantIndex} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-3 text-blue-600">
                        {merchantData.merchantName}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {paginatedBrandsForMerchant.map((brand, brandIndex) => (
                          <div
                            key={brandIndex}
                            className="bg-gray-50 p-3 rounded-md"
                          >
                            <h4 className="font-medium text-sm">
                              {brand.name}
                            </h4>
                            <div className="flex justify-between text-xs text-gray-600 mt-1">
                              <span>
                                Popularity:{" "}
                                {(brand.popularity * 100).toFixed(0)}%
                              </span>
                              <span>
                                Affinity: {(brand.affinity * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Growth: {brand.audience_growth > 0 ? "+" : ""}
                              {(brand.audience_growth * 100).toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>

                      {totalBrandPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() =>
                                setBrandPage(
                                  merchantData.merchantName,
                                  Math.max(currentBrandPage - 1, 1),
                                )
                              }
                              disabled={currentBrandPage === 1}
                              className="cursor-pointer px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              ← Prev
                            </button>
                            <button
                              onClick={() =>
                                setBrandPage(
                                  merchantData.merchantName,
                                  Math.min(
                                    currentBrandPage + 1,
                                    totalBrandPages,
                                  ),
                                )
                              }
                              disabled={currentBrandPage === totalBrandPages}
                              className="cursor-pointer px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next →
                            </button>
                          </div>

                          <div className="flex items-center space-x-1">
                            {Array.from(
                              { length: totalBrandPages },
                              (_, i) => i + 1,
                            ).map((page) => (
                              <button
                                key={page}
                                onClick={() =>
                                  setBrandPage(merchantData.merchantName, page)
                                }
                                className={`cursor-pointer px-2 py-1 text-xs rounded ${
                                  page === currentBrandPage
                                    ? "bg-blue-600 text-white"
                                    : "border hover:bg-gray-50"
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>

                          <div className="text-xs text-gray-500">
                            {merchantData.brands.length} brands total
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {(transactions?.attachedBrands &&
                  transactions.attachedBrands.length > 0) ||
                (matchedBrands && matchedBrands.length > 0) ? (
                  <>
                    <p>
                      All brands have been excluded or no similar brands found
                    </p>
                    <p className="text-sm mt-2">
                      {transactions?.attachedBrands &&
                      transactions.attachedBrands.length > 0
                        ? "Toggle merchants back on in the preferences above to see recommendations"
                        : "Try having more conversations to discover new brand matches"}
                    </p>
                  </>
                ) : (
                  <>
                    <p>No brands available yet</p>
                    <p className="text-sm mt-2">
                      Connect your bank account and have conversations to
                      discover personalized brand recommendations
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat Interface - Right Column */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            {!activeChatType ? (
              <div className="bg-white p-6 rounded-lg border shadow-lg">
                <h2 className="text-xl font-semibold mb-4">💬 Chat with AI</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Get personalized help with your shopping preferences and
                  deals.
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  On Conversation End, press the &apos;End Chat&apos; button
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => setActiveChatType("aspirations_bridge")}
                    className="cursor-pointer w-full text-left p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">✨</span>
                      <div>
                        <h3 className="font-semibold text-purple-700">
                          Aspirations Bridge
                        </h3>
                        <p className="text-xs text-gray-600">
                          Connect shopping to your goals
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveChatType("coupon_request")}
                    className="cursor-pointer w-full text-left p-4 border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🎫</span>
                      <div>
                        <h3 className="font-semibold text-green-700">
                          Coupon Request
                        </h3>
                        <p className="text-xs text-gray-600">
                          Get deals for specific stores
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <ChatInterface
                chatType={activeChatType}
                description={
                  activeChatType === "aspirations_bridge"
                    ? "Connect your aspirations with shopping recommendations"
                    : "Request coupons for your favorite stores"
                }
                onClose={() => setActiveChatType(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
