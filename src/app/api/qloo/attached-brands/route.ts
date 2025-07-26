import { NextRequest, NextResponse } from 'next/server';

const QLOO_API_KEY = process.env.QLOO_API_KEY;
const QLOO_BASE_URL = "https://hackathon.api.qloo.com";

interface QlooEntity {
  name: string;
  entity_id: string;
  popularity: number;
  affinity: number;
  audience_growth: number;
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
        { error: 'Qloo API key not configured' },
        { status: 500 }
      );
    }

    const { entityId, city = "New York", userAge = 28 } = await request.json();

    if (!entityId) {
      return NextResponse.json(
        { error: 'Entity ID is required' },
        { status: 400 }
      );
    }

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
        }) => ({
          name: entity.name,
          entity_id: entity.entity_id,
          popularity: entity.popularity,
          affinity: entity.query.affinity,
          audience_growth: entity.query.measurements.audience_growth,
        }),
      );

      return NextResponse.json({ brands });
    }

    return NextResponse.json({ brands: [] });
  } catch (error) {
    console.error('Error getting attached brands:', error);
    return NextResponse.json(
      { error: 'Failed to get attached brands' },
      { status: 500 }
    );
  }
}