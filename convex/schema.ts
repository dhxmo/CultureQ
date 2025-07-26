import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - basic user data with Plaid authentication
  users: defineTable({
    plaidUserId: v.string(), // Unique identifier from Plaid
    email: v.optional(v.string()), // From Plaid identity data, encrypted
    
    // User profile data for Qloo API
    age: v.optional(v.number()),
    location: v.optional(v.string()), // City name
    excludedMerchants: v.optional(v.array(v.string())), // Merchants to exclude from recommendations
    
    // Plaid integration
    plaidAccessToken: v.optional(v.string()), // Encrypted
    lastTransactionSync: v.optional(v.number()),
    
    // Taste profile from conversations + transactions
    tasteProfile: v.optional(v.object({
      interests: v.array(v.string()),
      preferences: v.array(v.string()),
      aspirations: v.array(v.string()),
      lifestyle: v.array(v.string()),
      attachedBrands: v.optional(v.array(v.object({
        merchantName: v.string(),
        brands: v.array(v.object({
          name: v.string(),
          entity_id: v.string(),
          popularity: v.number(),
          affinity: v.number(),
          audience_growth: v.number()
        }))
      }))),
      lastUpdated: v.number(),
    })),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_plaid_user_id", ["plaidUserId"]),

  // User preferences for blocking merchants/categories
  preferences: defineTable({
    userId: v.id("users"),
    blockedMerchants: v.array(v.string()),
    blockedCategories: v.array(v.string()),
    maxOffersPerMonth: v.number(), // Fixed at 3 per month
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Anonymized transaction data
  transactions: defineTable({
    userId: v.id("users"),
    merchantName: v.string(),
    merchantCategory: v.string(),
    amount: v.number(),
    date: v.number(),
    qlooEntityId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_merchant", ["merchantName"]),

  // Merchant partnerships (admin managed)
  merchants: defineTable({
    name: v.string(),
    category: v.string(),
    qlooEntityId: v.optional(v.string()),
    cashbackRate: v.number(),
    spendingCap: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_active", ["isActive"]),

  // Personalized offers delivered to users
  offers: defineTable({
    userId: v.id("users"),
    merchantId: v.id("merchants"),
    title: v.string(),
    description: v.string(),
    cashbackRate: v.number(),
    status: v.union(v.literal("delivered"), v.literal("viewed"), v.literal("redeemed")),
    deliveredAt: v.number(),
    redeemedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Coupon requests from users (max 3 per month)
  couponRequests: defineTable({
    userId: v.id("users"),
    merchantName: v.string(),
    description: v.string(),
    requestMonth: v.string(), // YYYY-MM format
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_month", ["userId", "requestMonth"]),

  // Conversation history for taste building
  conversations: defineTable({
    userId: v.id("users"),
    tabType: v.union(
      v.literal("profile_building"),
      v.literal("activity_planning"), 
      v.literal("goal_setting")
    ),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      timestamp: v.number(),
    })),
    extractedInsights: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_tab_type", ["tabType"]),
});