import { v } from "convex/values";
import { query } from "./_generated/server";

// Note: This file contains queries for transaction-related data
// Actual transaction data is pulled from Plaid on-demand via API routes
// Only transaction sync metadata is stored in Convex

// Get user's last transaction sync timestamp for weekly job tracking
export const getLastSyncTime = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.lastTransactionSync || null;
  },
});

// Note: Actual merchant and category data for blocking interface
// is retrieved via API routes that call Plaid directly
// This avoids storing sensitive transaction data locally