import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const QLOO_API_KEY = process.env.QLOO_API_KEY;
const QLOO_BASE_URL = "https://hackathon.api.qloo.com";

// Initialize Convex client for logging brands
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface QlooEntity {
  name: string;
  entity_id: string;
  popularity: number;
  affinity: number;
  audience_growth: number;
  short_description: string;
}

const getAgeGroup = (age: number): string => {
  if (age <= 35) return "35_and_younger";
  if (age <= 55) return "36_to_55";
  return "55_and_older";
};

export async function POST(request: NextRequest) {
  try {
    if (!QLOO_API_KEY) {
      return NextResponse.json(
        { error: "Qloo API key not configured" },
        { status: 500 },
      );
    }

    const { entityId, city = "New York", userAge = 28, merchantName } = await request.json();

    if (!entityId) {
      return NextResponse.json(
        { error: "Entity ID is required" },
        { status: 400 },
      );
    }

    console.log("Checking cache for merchant entity ID:", entityId);

    // Check if merchant brands are already cached
    const cachedBrands = await convex.query(api.brands.getMerchantBrands, {
      merchantEntityId: entityId,
    });

    if (cachedBrands) {
      console.log("Found cached brands for merchant:", merchantName || entityId);
      console.log("Returning cached brands:", cachedBrands.brands.length, "brands");
      return NextResponse.json({ brands: cachedBrands.brands });
    }

    console.log("No cache found, fetching from Qloo API for entityId:", entityId);

    const demographic = getAgeGroup(userAge);
    const insightsUrl = `${QLOO_BASE_URL}/v2/insights?filter.type=urn:entity:brand&signal.interests.entities=${entityId}&bias.trends=high&feature.explainability=true&signal.demographics.age=${demographic}&signal.location.query=${encodeURIComponent(city)}`;

    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-Api-Key": QLOO_API_KEY,
      },
    };

    const response = await fetch(insightsUrl, options);
    const json = await response.json();

    console.log("Qloo API response status:", response.status);
    console.log("Qloo API response data:", JSON.stringify(json, null, 2));

    if (json.results?.entities) {
      const brands: QlooEntity[] = json.results.entities.map(
        (entity: {
          name: string;
          entity_id: string;
          popularity: number;
          query: {
            affinity: number;
            measurements: {
              audience_growth: number;
            };
          };
          properties: {
            short_description: string;
          };
        }) => ({
          name: entity.name,
          entity_id: entity.entity_id,
          popularity: entity.popularity,
          affinity: entity.query.affinity,
          audience_growth: entity.query.measurements.audience_growth,
          short_description: entity.properties.short_description,
        }),
      );

      console.log("Processed brands data:", brands);

      // Cache the merchant-brand mapping for future requests
      try {
        await convex.mutation(api.brands.cacheMerchantBrands, {
          merchantEntityId: entityId,
          merchantName: merchantName || `Entity-${entityId}`,
          brands: brands,
        });
        console.log("Successfully cached merchant brands for:", merchantName || entityId);
      } catch (error) {
        console.error("Error caching merchant brands:", error);
      }

      return NextResponse.json({ brands });
    }

    return NextResponse.json({ brands: [] });
  } catch (error) {
    console.error("Error getting attached brands:", error);
    return NextResponse.json(
      { error: "Failed to get attached brands" },
      { status: 500 },
    );
  }
}
