import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ProcessRequest {
  userId: string;
  conversationId: string;
  chatType: "aspirations_bridge" | "coupon_request";
}

const EXTRACTION_PROMPTS = {
  aspirations_bridge: `Analyze this conversation and extract aspirational goals and related merchants. Return ONLY a JSON object with:
{
  "aspirationGoals": ["goal1", "goal2", ...],
  "merchantPreferences": ["merchant1", "merchant2", ...],
  "extractedInsights": ["insight1", "insight2", ...],
  "summary": "Brief summary of aspirations and relevant merchants"
}

Focus on life goals, aspirations, and merchants that support those goals.`,

  coupon_request: `Analyze this conversation and extract coupon requests. Return ONLY a JSON object with:
{
  "merchantPreferences": ["merchant1", "merchant2", "merchant3", ...],
  "extractedInsights": ["insight1", "insight2", ...],
  "summary": "Brief summary of coupon requests"
}

Focus on extracting the specific merchant names the user wants coupons for and add them to merchantPreferences array. Keep it standardized with other chat types.`
};

const BRAND_MATCHING_PROMPT = `You are a brand matching expert. Analyze the user insights and conversation summary, then match them against the provided brand descriptions.

Your task:
1. Compare the extracted insights and summary against each brand's name and description
2. Find brands that align with the user's preferences, interests, or mentioned needs
3. Score each match from 0-100 based on relevance
4. Only include matches with score >= 60
5. Provide a brief reason for each match
6. IMPORTANT: Only include ONE entry per unique brand name (avoid duplicates)
7. CRITICAL: You MUST use the EXACT entity_id, name, merchantName, and short_description from the provided brands list - DO NOT create or modify these values

Return ONLY a JSON array of matched brands using the EXACT data from the provided list:
[
  {
    "name": "exact_brand_name_from_list",
    "entity_id": "exact_entity_id_from_list", 
    "merchantName": "exact_merchant_name_from_list",
    "short_description": "exact_description_from_list",
    "matchScore": 85,
    "matchReason": "Brief explanation of why this brand matches the user's interests"
  }
]

If no good matches found (score < 60), return empty array: []`;

export async function POST(request: NextRequest) {
  try {
    const { userId, conversationId, chatType }: ProcessRequest = await request.json();

    if (!userId || !conversationId || !chatType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("Processing conversation:", { userId, conversationId, chatType });

    // Get conversation data
    const conversation = await convex.query(api.conversations.getConversation, {
      conversationId: conversationId as Id<"conversations">,
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Prepare conversation text for processing
    const conversationText = conversation.messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    console.log("Processing conversation text:", conversationText);

    // Call OpenAI to extract structured data
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: EXTRACTION_PROMPTS[chatType],
          },
          {
            role: "user",
            content: `Conversation to analyze:\n\n${conversationText}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const extractedData = aiResponse.choices[0]?.message?.content;

    if (!extractedData) {
      throw new Error("No response from OpenAI");
    }

    console.log("Extracted data:", extractedData);

    // Parse the JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(extractedData);
    } catch (error) {
      console.error("Error parsing extracted data:", error);
      parsedData = {
        extractedInsights: ["Could not parse conversation data"],
        summary: "Conversation processed but data extraction failed"
      };
    }

    // Update conversation with extracted insights
    await convex.mutation(api.conversations.updateConversationInsights, {
      conversationId: conversationId as Id<"conversations">,
      ...parsedData,
    });

    // Perform brand matching - skip for coupon_request
    console.log("Starting brand matching process...");
    let matchedBrandsCount = 0;
    
    // Skip brand matching and Qloo API calls for coupon_request
    if (chatType === "coupon_request") {
      console.log("Skipping brand matching for coupon_request - only logging to backend");
      await convex.mutation(api.conversations.completeConversation, {
        conversationId: conversationId as Id<"conversations">,
      });

      console.log("Successfully processed coupon_request conversation (backend only)");

      return NextResponse.json({
        success: true,
        data: parsedData,
        matchedBrandsCount: 0,
        summary: parsedData.summary || "Coupon request processed successfully"
      });
    }
    
    try {
      // Get all merchant brands for matching
      const merchantBrands = await convex.query(api.conversations.getAllMerchantBrands, {});
      console.log("Retrieved merchant brands for matching:", merchantBrands.length);

      if (merchantBrands.length > 0) {
        // Prepare brand data for LLM matching
        const brandsForMatching = merchantBrands.flatMap(merchant => 
          merchant.brands.map(brand => ({
            name: brand.name,
            entity_id: brand.entity_id,
            merchantName: merchant.merchantName,
            short_description: brand.short_description,
          }))
        );

        console.log("Total brands available for matching:", brandsForMatching.length);

        // Prepare user context for brand matching
        const userContext = {
          extractedInsights: parsedData.extractedInsights || [],
          summary: parsedData.summary || "",
          chatType: chatType,
        };

        // Call OpenAI for brand matching
        const brandMatchResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: BRAND_MATCHING_PROMPT,
              },
              {
                role: "user",
                content: `User Context:
Extracted Insights: ${userContext.extractedInsights.join(", ")}
Summary: ${userContext.summary}
Chat Type: ${userContext.chatType}

Available Brands (use EXACT data from this list):
${brandsForMatching.map(b => `
Brand: ${b.name}
Entity ID: ${b.entity_id}
Merchant: ${b.merchantName}
Description: ${b.short_description}
---`).join("\n")}`,
              },
            ],
            max_tokens: 2000,
            temperature: 0.1,
          }),
        });

        if (brandMatchResponse.ok) {
          const brandMatchResult = await brandMatchResponse.json();
          const matchedBrandsData = brandMatchResult.choices[0]?.message?.content;

          if (matchedBrandsData) {
            console.log("Brand matching response:", matchedBrandsData);

            try {
              // Clean the response - remove markdown code blocks if present
              let cleanedData = matchedBrandsData.trim();
              if (cleanedData.startsWith('```json')) {
                cleanedData = cleanedData.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              } else if (cleanedData.startsWith('```')) {
                cleanedData = cleanedData.replace(/^```\s*/, '').replace(/\s*```$/, '');
              }
              
              // Check if the JSON appears to be truncated (common indicators)
              if (!cleanedData.trim().endsWith(']') && !cleanedData.trim().endsWith('}')) {
                console.warn("JSON response appears to be truncated, attempting to fix...");
                // Try to close the JSON properly
                if (cleanedData.includes('[') && !cleanedData.trim().endsWith(']')) {
                  // Find the last complete object and close the array
                  const lastBraceIndex = cleanedData.lastIndexOf('}');
                  if (lastBraceIndex > -1) {
                    cleanedData = cleanedData.substring(0, lastBraceIndex + 1) + ']';
                  }
                }
              }
              
              const matchedBrands = JSON.parse(cleanedData);
              
              if (Array.isArray(matchedBrands) && matchedBrands.length > 0) {
                // Add timestamp to matched brands
                const timestampedMatches = matchedBrands.map(brand => ({
                  ...brand,
                  matchedAt: Date.now(),
                }));

                // Save matched brands to conversation
                await convex.mutation(api.conversations.addMatchedBrands, {
                  conversationId: conversationId as Id<"conversations">,
                  matchedBrands: timestampedMatches,
                });

                matchedBrandsCount = timestampedMatches.length;
                console.log("Successfully matched and saved brands:", matchedBrandsCount);
              }
            } catch (parseError) {
              console.error("Error parsing brand matching results:", parseError);
            }
          }
        } else {
          console.error("Brand matching API call failed:", brandMatchResponse.status);
        }
      }
    } catch (brandMatchError) {
      console.error("Error in brand matching process:", brandMatchError);
    }

    // Mark conversation as completed
    await convex.mutation(api.conversations.completeConversation, {
      conversationId: conversationId as Id<"conversations">,
    });

    console.log("Successfully processed conversation with", matchedBrandsCount, "matched brands");

    return NextResponse.json({
      success: true,
      data: parsedData,
      matchedBrandsCount,
      summary: parsedData.summary || "Conversation processed successfully"
    });

  } catch (error) {
    console.error("Error processing conversation:", error);
    return NextResponse.json(
      { error: "Failed to process conversation" },
      { status: 500 }
    );
  }
}