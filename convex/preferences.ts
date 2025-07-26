import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user preferences
export const getUserPreferences = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Update blocked merchants
export const updateBlockedMerchants = mutation({
  args: {
    userId: v.id("users"),
    blockedMerchants: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!preferences) {
      throw new Error("User preferences not found");
    }

    // Normalize to lowercase
    const normalizedMerchants = args.blockedMerchants.map(merchant => merchant.toLowerCase());

    await ctx.db.patch(preferences._id, {
      blockedMerchants: normalizedMerchants,
      updatedAt: Date.now(),
    });
  },
});

// Update blocked categories
export const updateBlockedCategories = mutation({
  args: {
    userId: v.id("users"),
    blockedCategories: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!preferences) {
      throw new Error("User preferences not found");
    }

    // Normalize to lowercase
    const normalizedCategories = args.blockedCategories.map(category => category.toLowerCase());

    await ctx.db.patch(preferences._id, {
      blockedCategories: normalizedCategories,
      updatedAt: Date.now(),
    });
  },
});

// Add merchant to blocked list
export const blockMerchant = mutation({
  args: {
    userId: v.id("users"),
    merchantName: v.string(),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!preferences) {
      throw new Error("User preferences not found");
    }

    // Normalize to lowercase
    const normalizedMerchant = args.merchantName.toLowerCase();
    const updatedBlockedMerchants = [...preferences.blockedMerchants];
    
    if (!updatedBlockedMerchants.includes(normalizedMerchant)) {
      updatedBlockedMerchants.push(normalizedMerchant);
    }

    await ctx.db.patch(preferences._id, {
      blockedMerchants: updatedBlockedMerchants,
      updatedAt: Date.now(),
    });
  },
});

// Remove merchant from blocked list
export const unblockMerchant = mutation({
  args: {
    userId: v.id("users"),
    merchantName: v.string(),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!preferences) {
      throw new Error("User preferences not found");
    }

    // Normalize to lowercase
    const normalizedMerchant = args.merchantName.toLowerCase();
    const updatedBlockedMerchants = preferences.blockedMerchants.filter(
      merchant => merchant !== normalizedMerchant
    );

    await ctx.db.patch(preferences._id, {
      blockedMerchants: updatedBlockedMerchants,
      updatedAt: Date.now(),
    });
  },
});

// Add category to blocked list
export const blockCategory = mutation({
  args: {
    userId: v.id("users"),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!preferences) {
      throw new Error("User preferences not found");
    }

    // Normalize to lowercase
    const normalizedCategory = args.category.toLowerCase();
    const updatedBlockedCategories = [...preferences.blockedCategories];
    
    if (!updatedBlockedCategories.includes(normalizedCategory)) {
      updatedBlockedCategories.push(normalizedCategory);
    }

    await ctx.db.patch(preferences._id, {
      blockedCategories: updatedBlockedCategories,
      updatedAt: Date.now(),
    });
  },
});

// Remove category from blocked list
export const unblockCategory = mutation({
  args: {
    userId: v.id("users"),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!preferences) {
      throw new Error("User preferences not found");
    }

    // Normalize to lowercase
    const normalizedCategory = args.category.toLowerCase();
    const updatedBlockedCategories = preferences.blockedCategories.filter(
      cat => cat !== normalizedCategory
    );

    await ctx.db.patch(preferences._id, {
      blockedCategories: updatedBlockedCategories,
      updatedAt: Date.now(),
    });
  },
});

// Simple migration to fix the field name
export const fixMaxOffersField = mutation({
  args: {},
  handler: async (ctx) => {
    const allPrefs = await ctx.db.query("preferences").collect();
    let fixed = 0;
    
    for (const pref of allPrefs) {
      await ctx.db.patch(pref._id, {
        maxOffersPerMonth: 3,
      });
      fixed++;
    }
    
    return { fixed };
  },
});