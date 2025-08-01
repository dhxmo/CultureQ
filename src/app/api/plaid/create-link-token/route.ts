import { NextRequest, NextResponse } from "next/server";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";

const client = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    const configs = {
      user: {
        client_user_id: userId || "temp-user-id",
      },
      client_name: "cultureQ",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    };

    const createTokenResponse = await client.linkTokenCreate(configs);

    return NextResponse.json(createTokenResponse.data);
  } catch (error) {
    console.error("Error creating link token:", error);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 }
    );
  }
}
