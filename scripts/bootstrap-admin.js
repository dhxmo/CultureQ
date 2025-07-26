// Bootstrap script to create admin user from environment variables
import dotenv from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// Simple hash function for MVP (same as in AdminContext)
function simpleHash(password) {
  return Buffer.from(password).toString("base64");
}

async function bootstrapAdmin() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!convexUrl) {
    console.error("NEXT_PUBLIC_CONVEX_URL not found in environment");
    process.exit(1);
  }

  if (!adminUsername || !adminPassword || !adminEmail) {
    console.error("Missing required admin environment variables:");
    console.error("- ADMIN_USERNAME");
    console.error("- ADMIN_PASSWORD");
    console.error("- ADMIN_EMAIL");
    process.exit(1);
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const passwordHash = simpleHash(adminPassword);

    console.log("Bootstrapping admin user...");
    const adminId = await client.mutation(api.admins.bootstrapAdmin, {
      username: adminUsername,
      passwordHash: passwordHash,
      email: adminEmail,
    });

    console.log(`✅ Admin bootstrap completed successfully!`);
    console.log(`Admin ID: ${adminId}`);
    console.log(`Username: ${adminUsername}`);
    console.log(`Email: ${adminEmail}`);
  } catch (error) {
    console.error("❌ Admin bootstrap failed:", error.message);
    process.exit(1);
  }
}

bootstrapAdmin();
