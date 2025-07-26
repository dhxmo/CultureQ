import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Admin login
export const loginAdmin = mutation({
  args: {
    username: v.string(),
    passwordHash: v.string(), // Frontend should hash the password before sending
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!admin || admin.passwordHash !== args.passwordHash) {
      throw new Error("Invalid username or password");
    }

    // Update last login
    await ctx.db.patch(admin._id, {
      lastLogin: Date.now(),
    });

    return {
      adminId: admin._id,
      username: admin.username,
      email: admin.email,
    };
  },
});

// Create admin (for initial setup)
export const createAdmin = mutation({
  args: {
    username: v.string(),
    passwordHash: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin already exists
    const existingAdmin = await ctx.db
      .query("admins")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();

    if (existingAdmin) {
      throw new Error("Admin already exists");
    }

    const adminId = await ctx.db.insert("admins", {
      username: args.username,
      passwordHash: args.passwordHash,
      email: args.email,
      isActive: true,
      createdAt: Date.now(),
    });

    return adminId;
  },
});

// Bootstrap admin from environment variables (called on server start)
export const bootstrapAdmin = mutation({
  args: {
    username: v.string(),
    passwordHash: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin already exists
    const existingAdmin = await ctx.db
      .query("admins")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();

    if (existingAdmin) {
      return existingAdmin._id;
    }

    const adminId = await ctx.db.insert("admins", {
      username: args.username,
      passwordHash: args.passwordHash,
      email: args.email,
      isActive: true,
      createdAt: Date.now(),
    });

    return adminId;
  },
});

// Get admin by ID
export const getAdminById = query({
  args: { adminId: v.id("admins") },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    return {
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      isActive: admin.isActive,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
    };
  },
});

// List all admins
export const listAdmins = query({
  handler: async (ctx) => {
    const admins = await ctx.db.query("admins").collect();
    return admins.map((admin) => ({
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      isActive: admin.isActive,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
    }));
  },
});
