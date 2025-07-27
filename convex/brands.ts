import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const logBrand = mutation({
  args: {
    name: v.string(),
    entity_id: v.string(),
    short_description: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("Logging brand to Convex:", args);

    // Check if brand already exists
    const existingBrand = await ctx.db
      .query("brands")
      .withIndex("by_entity_id", (q) => q.eq("entity_id", args.entity_id))
      .first();

    if (existingBrand) {
      console.log("Brand already exists, updating:", existingBrand._id);
      // Update existing brand with new short_description if provided
      await ctx.db.patch(existingBrand._id, {
        short_description: args.short_description,
      });
      return existingBrand._id;
    }

    // Create new brand
    const brandId = await ctx.db.insert("brands", {
      name: args.name,
      entity_id: args.entity_id,
      short_description: args.short_description,
      createdAt: Date.now(),
    });

    console.log("Created new brand with ID:", brandId);
    return brandId;
  },
});

export const getBrandsByEntityIds = query({
  args: {
    entityIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const brands = [];
    for (const entityId of args.entityIds) {
      const brand = await ctx.db
        .query("brands")
        .withIndex("by_entity_id", (q) => q.eq("entity_id", entityId))
        .first();
      if (brand) {
        brands.push(brand);
      }
    }
    return brands;
  },
});

// Check if merchant brands are cached
export const getMerchantBrands = query({
  args: {
    merchantEntityId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("merchantBrands")
      .withIndex("by_merchant_entity_id", (q) => q.eq("merchantEntityId", args.merchantEntityId))
      .first();
  },
});

// Cache merchant brands after Qloo API call
export const cacheMerchantBrands = mutation({
  args: {
    merchantEntityId: v.string(),
    merchantName: v.string(),
    brands: v.array(v.object({
      name: v.string(),
      entity_id: v.string(),
      popularity: v.number(),
      affinity: v.number(),
      audience_growth: v.number(),
      short_description: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    console.log("Caching merchant brands for:", args.merchantName);
    
    // Check if already cached
    const existing = await ctx.db
      .query("merchantBrands")
      .withIndex("by_merchant_entity_id", (q) => q.eq("merchantEntityId", args.merchantEntityId))
      .first();

    if (existing) {
      console.log("Updating existing cache for merchant:", args.merchantName);
      await ctx.db.patch(existing._id, {
        brands: args.brands,
      });
      return existing._id;
    }

    // Create new cache entry
    const cacheId = await ctx.db.insert("merchantBrands", {
      merchantEntityId: args.merchantEntityId,
      merchantName: args.merchantName,
      brands: args.brands,
      createdAt: Date.now(),
    });

    console.log("Created new cache entry for merchant:", args.merchantName, "with ID:", cacheId);
    return cacheId;
  },
});
