import { NextRequest, NextResponse } from "next/server";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  TransactionsSyncRequest,
  Transaction,
  RemovedTransaction,
} from "plaid";
import { decrypt } from "../../../../lib/encryption";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const configuration = new Configuration({
  basePath:
    PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(configuration);
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface TransactionRequest {
  userId: string; // Convex document ID for the user
  count?: number; // Number of transactions to return (default 8, max 500)
}

interface ProcessedTransaction {
  name: string;
  displayName: string;
  category: string;
  amount: number;
  date: string;
}

interface TransactionResponse {
  merchants: ProcessedTransaction[];
  categories: string[];
  totalTransactions: number;
}

// Utility function for sorting transactions by date (most recent first)
const compareTxnsByDateDescending = (a: { date: string }, b: { date: string }) =>
  (b.date > a.date ? 1 : 0) - (b.date < a.date ? 1 : 0);

// Helper function to add delay for polling
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body: TransactionRequest = await request.json();
    if (!body.userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Set up default parameters
    const count = body.count || 8; // Default to 8 as in quickstart
    // Validate count
    if (count <= 0 || count > 500) {
      return NextResponse.json(
        { error: "Count must be between 1 and 500" },
        { status: 400 },
      );
    }

    // Get user from Convex
    let user;
    try {
      // The userId from the request body is actually the Convex document ID
      user = await convex.query(api.users.getUserById, {
        userId: body.userId as Id<"users">,
      });
      if (user) {
        console.log("👤 User details:", {
          id: user._id,
          plaidUserId: user.plaidUserId,
          hasAccessToken: !!user.plaidAccessToken,
          createdAt: user.createdAt,
        });
      }
    } catch (convexError) {
      console.error("❌ Convex query error:", convexError);
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 500 },
      );
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.plaidAccessToken) {
      return NextResponse.json(
        { error: "User access token not found" },
        { status: 401 },
      );
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = decrypt(user.plaidAccessToken);
    } catch (error) {
      console.error("❌ Failed to decrypt access token:", error);
      return NextResponse.json(
        { error: "Failed to authenticate user" },
        { status: 401 },
      );
    }

    // Fetch transactions using transactionsSync (adapted from quickstart)
    // Set cursor to empty to receive all historical updates
    let cursor: string | undefined = undefined;

    // New transaction updates since "cursor"
    let added: Transaction[] = [];
    let modified: Transaction[] = [];
    // Removed transaction ids
    let removed: RemovedTransaction[] = [];
    let hasMore = true;
    let pageCount = 0;

    // Iterate through each page of new transaction updates for item
    while (hasMore) {
      pageCount++;
      const request: TransactionsSyncRequest = {
        access_token: accessToken,
        cursor: cursor,
      };

      const response = await client.transactionsSync(request);
      const data = response.data;
      console.log(`📊 Page ${pageCount} response:`, {
        added: data.added.length,
        modified: data.modified.length,
        removed: data.removed.length,
        hasMore: data.has_more,
        nextCursor: data.next_cursor,
      });

      // If no transactions are available yet, wait and poll the endpoint.
      // Normally, we would listen for a webhook, but this follows the Quickstart pattern
      cursor = data.next_cursor;
      if (cursor === "" || cursor === null) {
        await sleep(2000);
        continue;
      }

      // Add this page of results
      added = added.concat(data.added);
      modified = modified.concat(data.modified);
      removed = removed.concat(data.removed);
      hasMore = data.has_more;
    }

    // Sort transactions by date (most recent first) and get the requested count
    const allTransactions = [...added, ...modified];
    const sortedTransactions = allTransactions.sort(compareTxnsByDateDescending);
    const recentTransactions = sortedTransactions.slice(0, count);
    // Process and normalize transaction data
    const processedTransactions: ProcessedTransaction[] =
      recentTransactions.map((transaction) => {
        const merchantName =
          transaction.merchant_name || transaction.name || "Unknown Merchant";
        const category = transaction.category?.[0] || "Other";

        return {
          name: merchantName.toLowerCase().trim(),
          displayName: merchantName.trim(),
          category: category.toLowerCase().trim(),
          amount: Math.abs(transaction.amount), // Use absolute value for spending amounts
          date: transaction.date,
        };
      });

    // Extract unique categories
    const uniqueCategories = Array.from(
      new Set(processedTransactions.map((t) => t.category)),
    ).sort();

    // Prepare response
    const response: TransactionResponse = {
      merchants: processedTransactions,
      categories: uniqueCategories,
      totalTransactions: processedTransactions.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Error in POST /api/plaid/transactions:", error);

    // Handle specific Plaid errors
    if (error && typeof error === "object" && "response" in error) {
      const plaidError = error as {
        response?: { data?: { error_code?: string; display_message?: string } };
      };
      if (plaidError.response?.data?.error_code) {
        console.error("🏦 Plaid API error:", {
          code: plaidError.response.data.error_code,
          message: plaidError.response.data.display_message,
        });
        return NextResponse.json(
          {
            error: "Plaid API error",
            details:
              plaidError.response.data.display_message ||
              "Failed to fetch transactions from bank",
          },
          { status: 400 },
        );
      }
    }

    console.error("🔥 Unhandled error - returning 500");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
