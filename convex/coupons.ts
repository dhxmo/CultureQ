import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Create coupon
export const createCoupon = mutation({
  args: {
    code: v.string(),
    title: v.string(),
    description: v.string(),
    merchantName: v.string(),
    discountType: v.union(v.literal("percentage"), v.literal("fixed_amount")),
    discountValue: v.number(),
    minSpendAmount: v.optional(v.number()),
    maxDiscountAmount: v.optional(v.number()),
    validFrom: v.number(),
    validUntil: v.number(),
    usageLimit: v.optional(v.number()),
    createdBy: v.id("admins"),
  },
  handler: async (ctx, args) => {
    // Check if coupon code already exists
    const existingCoupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existingCoupon) {
      throw new Error("Coupon code already exists");
    }

    const couponId = await ctx.db.insert("coupons", {
      ...args,
      usageCount: 0,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return couponId;
  },
});

// Update coupon
export const updateCoupon = mutation({
  args: {
    couponId: v.id("coupons"),
    code: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    merchantName: v.optional(v.string()),
    discountType: v.optional(
      v.union(v.literal("percentage"), v.literal("fixed_amount")),
    ),
    discountValue: v.optional(v.number()),
    minSpendAmount: v.optional(v.number()),
    maxDiscountAmount: v.optional(v.number()),
    validFrom: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    usageLimit: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { couponId, ...updates } = args;

    const coupon = await ctx.db.get(couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    await ctx.db.patch(couponId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return couponId;
  },
});

// Delete coupon
export const deleteCoupon = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    await ctx.db.delete(args.couponId);
    return true;
  },
});

// List all coupons
export const listCoupons = query({
  handler: async (ctx) => {
    const coupons = await ctx.db.query("coupons").collect();

    // Get admin info for each coupon
    const couponsWithAdmin = await Promise.all(
      coupons.map(async (coupon) => {
        const admin = await ctx.db.get(coupon.createdBy);
        return {
          ...coupon,
          createdByUsername: admin?.username || "Unknown",
        };
      }),
    );

    return couponsWithAdmin;
  },
});

// Get coupon by ID
export const getCouponById = query({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    const admin = await ctx.db.get(coupon.createdBy);
    return {
      ...coupon,
      createdByUsername: admin?.username || "Unknown",
    };
  },
});

// Get coupon usage analytics
export const getCouponAnalytics = query({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    const usageRecords = await ctx.db
      .query("couponUsage")
      .withIndex("by_coupon", (q) => q.eq("couponId", args.couponId))
      .collect();

    const totalUsage = usageRecords.length;
    const totalDiscountGiven = usageRecords.reduce(
      (sum, record) => sum + record.discountAmount,
      0,
    );
    const totalOrderValue = usageRecords.reduce(
      (sum, record) => sum + record.orderAmount,
      0,
    );

    return {
      coupon,
      totalUsage,
      totalDiscountGiven,
      totalOrderValue,
      usageRecords,
    };
  },
});

// Record coupon usage
export const recordCouponUsage = mutation({
  args: {
    couponId: v.id("coupons"),
    userId: v.id("users"),
    discountAmount: v.number(),
    orderAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    if (!coupon.isActive) {
      throw new Error("Coupon is not active");
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new Error("Coupon usage limit reached");
    }

    // Check validity dates
    const now = Date.now();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new Error("Coupon is not valid at this time");
    }

    // Record usage
    await ctx.db.insert("couponUsage", {
      couponId: args.couponId,
      userId: args.userId,
      usedAt: Date.now(),
      discountAmount: args.discountAmount,
      orderAmount: args.orderAmount,
    });

    // Update usage count
    await ctx.db.patch(args.couponId, {
      usageCount: coupon.usageCount + 1,
    });

    return true;
  },
});

// Find active coupons matching brand names
export const findCouponsForBrands = query({
  args: { brandNames: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Convert brand names to lowercase for matching
    const lowercaseBrandNames = args.brandNames.map((name) =>
      name.toLowerCase(),
    );

    // Get all active coupons
    const activeCoupons = await ctx.db
      .query("coupons")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter coupons where merchantName matches any of the brand names from Qloo
    const matchingCoupons = activeCoupons.filter((coupon) =>
      lowercaseBrandNames.includes(coupon.merchantName.toLowerCase()),
    );

    // Check validity dates
    const now = Date.now();
    const validCoupons = matchingCoupons.filter(
      (coupon) =>
        now >= coupon.validFrom &&
        now <= coupon.validUntil &&
        (!coupon.usageLimit || coupon.usageCount < coupon.usageLimit),
    );

    return validCoupons;
  },
});
