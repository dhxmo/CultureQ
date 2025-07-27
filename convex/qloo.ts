import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get user's Qloo cache status and data
export const getQlooCache = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return {
      lastQlooFetch: user?.tasteProfile?.lastUpdated || null,
      hasCachedData: !!user?.tasteProfile?.attachedBrands,
      attachedBrands: user?.tasteProfile?.attachedBrands || null,
      // Include user preferences for cache invalidation
      userAge: user?.age || null,
      userLocation: user?.location || null,
      excludedMerchants: user?.excludedMerchants || []
    };
  },
});

// Store Qloo attached brands data in user's taste profile
export const updateQlooCache = mutation({
  args: { 
    userId: v.id("users"),
    attachedBrands: v.array(v.object({
      merchantName: v.string(),
      brands: v.array(v.object({
        name: v.string(),
        entity_id: v.string(),
        popularity: v.number(),
        affinity: v.number(),
        audience_growth: v.number(),
        short_description: v.optional(v.string())
      }))
    }))
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const updatedTasteProfile = {
      interests: user.tasteProfile?.interests || [],
      preferences: user.tasteProfile?.preferences || [],
      aspirations: user.tasteProfile?.aspirations || [],
      lifestyle: user.tasteProfile?.lifestyle || [],
      attachedBrands: args.attachedBrands,
      lastUpdated: Date.now(),
    };

    await ctx.db.patch(args.userId, {
      tasteProfile: updatedTasteProfile,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});