import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create or get user by Plaid user ID
export const createUser = mutation({
  args: {
    plaidUserId: v.string(),
    email: v.optional(v.string()), // Encrypted
    accessToken: v.string(), // Encrypted
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_plaid_user_id", (q) => q.eq("plaidUserId", args.plaidUserId))
      .first();

    if (existingUser) {
      // Update existing user with new token
      await ctx.db.patch(existingUser._id, {
        plaidAccessToken: args.accessToken,
        email: args.email,
        updatedAt: Date.now(),
      });
      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      plaidUserId: args.plaidUserId,
      email: args.email,
      plaidAccessToken: args.accessToken,
      lastTransactionSync: undefined,
      tasteProfile: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create default preferences
    await ctx.db.insert("preferences", {
      userId,
      blockedMerchants: [],
      blockedCategories: [],
      maxOffersPerMonth: 3, // Fixed limit - cannot be changed by users
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return userId;
  },
});

// Get user by Plaid user ID
export const getUserByPlaidId = query({
  args: { plaidUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_plaid_user_id", (q) => q.eq("plaidUserId", args.plaidUserId))
      .first();
  },
});

// Get user by Convex document ID
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Update user taste profile
export const updateTasteProfile = mutation({
  args: {
    userId: v.id("users"),
    interests: v.array(v.string()),
    preferences: v.array(v.string()),
    aspirations: v.array(v.string()),
    lifestyle: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      tasteProfile: {
        interests: args.interests,
        preferences: args.preferences,
        aspirations: args.aspirations,
        lifestyle: args.lifestyle,
        lastUpdated: Date.now(),
      },
      updatedAt: Date.now(),
    });
  },
});

// Update last transaction sync timestamp
export const updateLastSync = mutation({
  args: {
    userId: v.id("users"),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastTransactionSync: args.timestamp,
      updatedAt: Date.now(),
    });
  },
});

// Update user profile (age and location)
export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    age: v.optional(v.number()),
    location: v.optional(v.string()),
    excludedMerchants: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      age: args.age,
      location: args.location,
      excludedMerchants: args.excludedMerchants,
      updatedAt: Date.now(),
    });
  },
});

