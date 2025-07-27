import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new conversation
export const createConversation = mutation({
  args: {
    userId: v.id("users"),
    chatType: v.union(
      v.literal("aspirations_bridge"), 
      v.literal("coupon_request"),
      v.literal("profile_building"),
      v.literal("activity_planning"),
      v.literal("goal_setting"),
    ),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("Creating conversation for user:", args.userId, "type:", args.chatType);
    
    const conversationId = await ctx.db.insert("conversations", {
      userId: args.userId,
      chatType: args.chatType,
      title: args.title,
      messages: [],
      isCompleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log("Created conversation:", conversationId);
    return conversationId;
  },
});

// Add a message to an existing conversation
export const addMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const newMessage = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
    };

    const updatedMessages = [...conversation.messages, newMessage];

    await ctx.db.patch(args.conversationId, {
      messages: updatedMessages,
      updatedAt: Date.now(),
    });

    console.log("Added message to conversation:", args.conversationId);
    return newMessage;
  },
});

// Update conversation insights and preferences
export const updateConversationInsights = mutation({
  args: {
    conversationId: v.id("conversations"),
    extractedInsights: v.optional(v.array(v.string())),
    merchantPreferences: v.optional(v.array(v.string())),
    categoryPreferences: v.optional(v.array(v.string())),
    discoveredBrands: v.optional(v.array(v.string())),
    aspirationGoals: v.optional(v.array(v.string())),
    couponRequests: v.optional(v.array(v.object({
      merchantName: v.string(),
      reason: v.string(),
      priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    }))),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { conversationId, ...insights } = args;
    
    await ctx.db.patch(conversationId, {
      ...insights,
      updatedAt: Date.now(),
    });

    console.log("Updated conversation insights:", conversationId);
    return { success: true };
  },
});

// Mark conversation as completed
export const completeConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      isCompleted: true,
      updatedAt: Date.now(),
    });

    console.log("Marked conversation as completed:", args.conversationId);
    return { success: true };
  },
});

// Get user's conversations by type
export const getUserConversations = query({
  args: {
    userId: v.id("users"),
    chatType: v.optional(v.union(
      v.literal("aspirations_bridge"), 
      v.literal("coupon_request"),
      v.literal("profile_building"),
      v.literal("activity_planning"),
      v.literal("goal_setting"),
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let conversations;
    
    if (args.chatType) {
      const chatType = args.chatType; // Type narrowing
      conversations = await ctx.db.query("conversations")
        .withIndex("by_user_chat_type", (q) => 
          q.eq("userId", args.userId).eq("chatType", chatType)
        )
        .order("desc")
        .take(args.limit || 50);
    } else {
      conversations = await ctx.db.query("conversations")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(args.limit || 50);
    }

    return conversations;
  },
});

// Get a specific conversation with all messages
export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

// Get all merchant brands for brand matching
export const getAllMerchantBrands = query({
  args: {},
  handler: async (ctx, args) => {
    return await ctx.db.query("merchantBrands").collect();
  },
});

// Add matched brands to conversation (append-only)
export const addMatchedBrands = mutation({
  args: {
    conversationId: v.id("conversations"),
    matchedBrands: v.array(v.object({
      name: v.string(),
      entity_id: v.string(),
      merchantName: v.string(),
      short_description: v.string(),
      matchScore: v.number(),
      matchReason: v.string(),
      matchedAt: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const existingMatches = conversation.matchedBrands || [];
    const updatedMatches = [...existingMatches, ...args.matchedBrands];

    await ctx.db.patch(args.conversationId, {
      matchedBrands: updatedMatches,
      updatedAt: Date.now(),
    });

    console.log("Added matched brands to conversation:", args.conversationId, "Count:", args.matchedBrands.length);
    return { success: true, totalMatches: updatedMatches.length };
  },
});

// Update attached brands for a specific matched brand in a conversation
export const updateMatchedBrandAttachedBrands = mutation({
  args: {
    conversationId: v.id("conversations"),
    brandName: v.string(),
    attachedBrands: v.array(v.object({
      name: v.string(),
      entity_id: v.string(),
      popularity: v.number(),
      affinity: v.number(),
      audience_growth: v.number(),
      short_description: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.matchedBrands) {
      throw new Error("Conversation or matched brands not found");
    }

    const updatedMatchedBrands = conversation.matchedBrands.map(brand => {
      if (brand.name === args.brandName) {
        return {
          ...brand,
          attachedBrands: args.attachedBrands,
          attachedBrandsFetchedAt: Date.now(),
        };
      }
      return brand;
    });

    await ctx.db.patch(args.conversationId, {
      matchedBrands: updatedMatchedBrands,
      updatedAt: Date.now(),
    });

    console.log("Updated attached brands for", args.brandName, "in conversation:", args.conversationId);
    return { success: true };
  },
});

// Get all matched brands for a user from conversations
export const getUserMatchedBrands = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all completed conversations for the user
    const conversations = await ctx.db.query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    // Extract all matched brands from conversations
    const allMatchedBrands: Array<{
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
      attachedBrandsFetchedAt?: number;
    }> = [];

    conversations.forEach(conversation => {
      if (conversation.matchedBrands) {
        conversation.matchedBrands.forEach(brand => {
          allMatchedBrands.push({
            ...brand,
            conversationId: conversation._id,
            chatType: conversation.chatType,
          });
        });
      }
    });

    // Sort by match score (highest first) and then by match date (newest first)
    allMatchedBrands.sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return b.matchedAt - a.matchedAt;
    });

    return allMatchedBrands;
  },
});

// Get merchant preferences from conversations (for Qloo API calls)
export const getUserMerchantPreferences = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db.query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    const merchantPreferences = new Set<string>();
    
    conversations.forEach(conversation => {
      if (conversation.merchantPreferences) {
        conversation.merchantPreferences.forEach(merchant => {
          merchantPreferences.add(merchant.toLowerCase());
        });
      }
    });

    return Array.from(merchantPreferences);
  },
});