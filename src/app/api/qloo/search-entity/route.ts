import { NextRequest, NextResponse } from 'next/server';

const QLOO_API_KEY = process.env.QLOO_API_KEY;
const QLOO_BASE_URL = "https://hackathon.api.qloo.com";

export async function POST(request: NextRequest) {
  try {
    if (!QLOO_API_KEY) {
      return NextResponse.json(
        { error: 'Qloo API key not configured' },
        { status: 500 }
      );
    }

    const { brandName } = await request.json();

    if (!brandName) {
      return NextResponse.json(
        { error: 'Brand name is required' },
        { status: 400 }
      );
    }

    const searchUrl = `${QLOO_BASE_URL}/search?query=${encodeURIComponent(brandName)}&types=urn:entity:brand`;
    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-Api-Key": QLOO_API_KEY,
      },
    };

    const response = await fetch(searchUrl, options);
    const json = await response.json();

    if (json.results && json.results.length > 0) {
      return NextResponse.json({ entity_id: json.results[0].entity_id });
    }

    return NextResponse.json({ entity_id: null });
  } catch (error) {
    console.error('Error searching for entity:', error);
    return NextResponse.json(
      { error: 'Failed to search entity' },
      { status: 500 }
    );
  }
}