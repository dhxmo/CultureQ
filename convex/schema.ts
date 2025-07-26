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
          audience_growth: v.number(),
          short_description: v.optional(v.string())
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

  // Admin users table
  admins: defineTable({
    username: v.string(),
    passwordHash: v.string(), // bcrypt hashed password
    email: v.string(),
    isActive: v.boolean(),
    lastLogin: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_username", ["username"])
    .index("by_active", ["isActive"]),

  // Admin coupons table
  coupons: defineTable({
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
    usageCount: v.number(),
    isActive: v.boolean(),
    createdBy: v.id("admins"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_merchant", ["merchantName"])
    .index("by_active", ["isActive"])
    .index("by_created_by", ["createdBy"]),

  // Admin cashbacks table
  cashbacks: defineTable({
    title: v.string(),
    description: v.string(),
    merchantName: v.string(),
    cashbackRate: v.number(), // percentage
    minSpendAmount: v.optional(v.number()),
    maxCashbackAmount: v.optional(v.number()),
    validFrom: v.number(),
    validUntil: v.number(),
    usageLimit: v.optional(v.number()),
    usageCount: v.number(),
    isActive: v.boolean(),
    createdBy: v.id("admins"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_merchant", ["merchantName"])
    .index("by_active", ["isActive"])
    .index("by_created_by", ["createdBy"]),

  // Coupon usage tracking
  couponUsage: defineTable({
    couponId: v.id("coupons"),
    userId: v.id("users"),
    usedAt: v.number(),
    discountAmount: v.number(),
    orderAmount: v.number(),
  })
    .index("by_coupon", ["couponId"])
    .index("by_user", ["userId"]),

  // Cashback usage tracking
  cashbackUsage: defineTable({
    cashbackId: v.id("cashbacks"),
    userId: v.id("users"),
    usedAt: v.number(),
    cashbackAmount: v.number(),
    orderAmount: v.number(),
  })
    .index("by_cashback", ["cashbackId"])
    .index("by_user", ["userId"]),

  // Qloo entities for brand recommendations
  qlooEntities: defineTable({
    entityId: v.string(),
    name: v.string(),
    createdAt: v.number(),
  })
    .index("by_entity_id", ["entityId"]),
});