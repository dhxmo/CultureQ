import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Create cashback
export const createCashback = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    merchantName: v.string(),
    cashbackRate: v.number(),
    minSpendAmount: v.optional(v.number()),
    maxCashbackAmount: v.optional(v.number()),
    validFrom: v.number(),
    validUntil: v.number(),
    usageLimit: v.optional(v.number()),
    createdBy: v.id("admins"),
  },
  handler: async (ctx, args) => {
    const cashbackId = await ctx.db.insert("cashbacks", {
      ...args,
      usageCount: 0,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return cashbackId;
  },
});

// Update cashback
export const updateCashback = mutation({
  args: {
    cashbackId: v.id("cashbacks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    merchantName: v.optional(v.string()),
    cashbackRate: v.optional(v.number()),
    minSpendAmount: v.optional(v.number()),
    maxCashbackAmount: v.optional(v.number()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    usageLimit: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { cashbackId, ...updates } = args;

    const cashback = await ctx.db.get(cashbackId);
    if (!cashback) {
      throw new Error("Cashback not found");
    }

    await ctx.db.patch(cashbackId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return cashbackId;
  },
});

// Delete cashback
export const deleteCashback = mutation({
  args: { cashbackId: v.id("cashbacks") },
  handler: async (ctx, args) => {
    const cashback = await ctx.db.get(args.cashbackId);
    if (!cashback) {
      throw new Error("Cashback not found");
    }

    await ctx.db.delete(args.cashbackId);
    return true;
  },
});

// List all cashbacks
export const listCashbacks = query({
  handler: async (ctx) => {
    const cashbacks = await ctx.db.query("cashbacks").collect();

    // Get admin info for each cashback
    const cashbacksWithAdmin = await Promise.all(
      cashbacks.map(async (cashback) => {
        const admin = await ctx.db.get(cashback.createdBy);
        return {
          ...cashback,
          createdByUsername: admin?.username || "Unknown",
        };
      }),
    );

    return cashbacksWithAdmin;
  },
});

// Get cashback by ID
export const getCashbackById = query({
  args: { cashbackId: v.id("cashbacks") },
  handler: async (ctx, args) => {
    const cashback = await ctx.db.get(args.cashbackId);
    if (!cashback) {
      throw new Error("Cashback not found");
    }

    const admin = await ctx.db.get(cashback.createdBy);
    return {
      ...cashback,
      createdByUsername: admin?.username || "Unknown",
    };
  },
});

// Get cashback usage analytics
export const getCashbackAnalytics = query({
  args: { cashbackId: v.id("cashbacks") },
  handler: async (ctx, args) => {
    const cashback = await ctx.db.get(args.cashbackId);
    if (!cashback) {
      throw new Error("Cashback not found");
    }

    const usageRecords = await ctx.db
      .query("cashbackUsage")
      .withIndex("by_cashback", (q) => q.eq("cashbackId", args.cashbackId))
      .collect();

    const totalUsage = usageRecords.length;
    const totalCashbackGiven = usageRecords.reduce(
      (sum, record) => sum + record.cashbackAmount,
      0,
    );
    const totalOrderValue = usageRecords.reduce(
      (sum, record) => sum + record.orderAmount,
      0,
    );

    return {
      cashback,
      totalUsage,
      totalCashbackGiven,
      totalOrderValue,
      usageRecords,
    };
  },
});

// Record cashback usage
export const recordCashbackUsage = mutation({
  args: {
    cashbackId: v.id("cashbacks"),
    userId: v.id("users"),
    cashbackAmount: v.number(),
    orderAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const cashback = await ctx.db.get(args.cashbackId);
    if (!cashback) {
      throw new Error("Cashback not found");
    }

    if (!cashback.isActive) {
      throw new Error("Cashback is not active");
    }

    // Check usage limit
    if (cashback.usageLimit && cashback.usageCount >= cashback.usageLimit) {
      throw new Error("Cashback usage limit reached");
    }

    // Check validity dates
    const now = Date.now();
    if (now < cashback.validFrom || now > cashback.validUntil) {
      throw new Error("Cashback is not valid at this time");
    }

    // Record usage
    await ctx.db.insert("cashbackUsage", {
      cashbackId: args.cashbackId,
      userId: args.userId,
      usedAt: Date.now(),
      cashbackAmount: args.cashbackAmount,
      orderAmount: args.orderAmount,
    });

    // Update usage count
    await ctx.db.patch(args.cashbackId, {
      usageCount: cashback.usageCount + 1,
    });

    return true;
  },
});

// Find active cashbacks matching brand names
export const findCashbacksForBrands = query({
  args: { brandNames: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Convert brand names to lowercase for matching
    const lowercaseBrandNames = args.brandNames.map((name) =>
      name.toLowerCase(),
    );

    // Get all active cashbacks
    const activeCashbacks = await ctx.db
      .query("cashbacks")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter cashbacks where merchantName matches any of the brand names from Qloo
    const matchingCashbacks = activeCashbacks.filter((cashback) =>
      lowercaseBrandNames.includes(cashback.merchantName.toLowerCase()),
    );

    // Check validity dates
    const now = Date.now();
    const validCashbacks = matchingCashbacks.filter(
      (cashback) =>
        now >= cashback.validFrom &&
        now <= cashback.validUntil &&
        (!cashback.usageLimit || cashback.usageCount < cashback.usageLimit),
    );

    return validCashbacks;
  },
});
