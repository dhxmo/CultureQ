import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save QlooEntity data to the qlooEntities table
export const saveQlooEntity = mutation({
  args: {
    entityId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if entity already exists
    const existing = await ctx.db
      .query("qlooEntities")
      .withIndex("by_entity_id", (q) => q.eq("entityId", args.entityId))
      .first();

    if (existing) {
      // Update existing entity
      await ctx.db.patch(existing._id, {
        name: args.name,
      });
      return existing._id;
    } else {
      // Create new entity
      return await ctx.db.insert("qlooEntities", {
        entityId: args.entityId,
        name: args.name,
        createdAt: Date.now(),
      });
    }
  },
});

// Batch save multiple QlooEntities
export const saveQlooEntities = mutation({
  args: {
    entities: v.array(
      v.object({
        entityId: v.string(),
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const entity of args.entities) {
      const result = await ctx.db
        .query("qlooEntities")
        .withIndex("by_entity_id", (q) => q.eq("entityId", entity.entityId))
        .first();

      if (result) {
        // Update existing
        await ctx.db.patch(result._id, {
          name: entity.name,
        });
        results.push(result._id);
      } else {
        // Create new
        const id = await ctx.db.insert("qlooEntities", {
          entityId: entity.entityId,
          name: entity.name,
          createdAt: Date.now(),
        });
        results.push(id);
      }
    }
    return results;
  },
});

// Get QlooEntity by entity ID
export const getQlooEntity = query({
  args: { entityId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("qlooEntities")
      .withIndex("by_entity_id", (q) => q.eq("entityId", args.entityId))
      .first();
  },
});

// Get all QlooEntities
export const getAllQlooEntities = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("qlooEntities").collect();
  },
});

// Get count of QlooEntities (for debugging)
export const getQlooEntitiesCount = query({
  args: {},
  handler: async (ctx) => {
    const entities = await ctx.db.query("qlooEntities").collect();
    return { count: entities.length, entities: entities.slice(0, 5) }; // Return first 5 for inspection
  },
});