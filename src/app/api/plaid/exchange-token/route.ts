import { NextRequest, NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { api } from "../../../../../convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { encrypt } from "../../../../lib/encryption";

const client = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  }),
);

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  console.log('Exchange Token API: Request received');
  try {
    const { public_token } = await request.json();
    console.log('Exchange Token API: Public token received');

    // Exchange public token for access token
    const tokenResponse = await client.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = tokenResponse.data.access_token;
    const itemId = tokenResponse.data.item_id;
    
    console.log('Exchange Token API: Token exchange successful', { itemId });

    // Get account info and identity data
    // const accountsResponse = await client.accountsGet({
    //   access_token: accessToken,
    // });

    let email: string | undefined;
    try {
      const identityResponse = await client.identityGet({
        access_token: accessToken,
      });
      email = identityResponse.data.accounts[0]?.owners[0]?.emails[0]?.data;
    } catch {
      // Identity endpoint might not be available in sandbox
      console.log("Identity data not available");
    }

    // Encrypt the access token and email
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedEmail = email ? encrypt(email) : undefined;

    // Create user in Convex with encrypted Plaid data
    console.log('Exchange Token API: Creating user in Convex', { plaidUserId: itemId });
    const userId = await convex.mutation(api.users.createUser, {
      plaidUserId: itemId,
      email: encryptedEmail,
      accessToken: encryptedAccessToken,
    });
    
    console.log('Exchange Token API: User created successfully', { userId, itemId });

    return NextResponse.json({
      success: true,
      userId,
      itemId,
    });
  } catch (error) {
    console.error("Error exchanging token:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 },
    );
  }
}
