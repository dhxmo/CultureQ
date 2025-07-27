import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ChatRequest {
  userId: string;
  conversationId?: string;
  message: string;
  chatType: "aspirations_bridge" | "coupon_request";
}

// System prompts for each chat type
const SYSTEM_PROMPTS = {
  aspirations_bridge: `You are an Aspirations Bridge chatbot that quickly connects user's current habits with their goals. Be efficient - complete the conversation in 2-3 exchanges.

Your goal: Rapidly identify how their shopping aligns with their aspirations and suggest 2-3 relevant merchants.

Be direct and focused:
- Ask about their main life goal or aspiration (career, lifestyle, etc.)
- Identify 2-3 merchants/brands that support that goal
- Connect their current spending to their aspirations
- Keep responses to 1-2 sentences
- Provide actionable merchant recommendations quickly

Focus on practical connections between spending and goals.`,

  coupon_request: `You are a Coupon Request chatbot that efficiently captures merchant requests. Complete the task in 1-2 exchanges maximum.

Your goal: Quickly identify which merchants they want coupons for and why.

Be direct and transactional:
- Ask for their top 3 merchants they want coupons for
- Ask about any upcoming purchases or events
- Prioritize their requests (high/medium/low)
- Keep responses to 1 sentence maximum
- Get merchant names and priority levels quickly

Focus on collecting specific merchant requests efficiently.`
};

export async function POST(request: NextRequest) {
  try {
    const { userId, conversationId, message, chatType }: ChatRequest = await request.json();

    if (!userId || !message || !chatType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("Processing chat request:", { userId, chatType, conversationId });

    // Get or create conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = await convex.mutation(api.conversations.createConversation, {
        userId: userId as Id<"users">,
        chatType,
        title: `${chatType.replace('_', ' ')} conversation`,
      });
      console.log("Created new conversation:", currentConversationId);
    }

    // Add user message to conversation
    await convex.mutation(api.conversations.addMessage, {
      conversationId: currentConversationId as Id<"conversations">,
      role: "user",
      content: message,
    });

    // Get conversation history for context
    const conversation = await convex.query(api.conversations.getConversation, {
      conversationId: currentConversationId as Id<"conversations">,
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Prepare OpenAI messages
    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPTS[chatType],
      },
      ...conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    console.log("Calling OpenAI with", messages.length, "messages");

    // Call OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.choices[0]?.message?.content;

    if (!assistantMessage) {
      throw new Error("No response from OpenAI");
    }

    // Add assistant response to conversation
    await convex.mutation(api.conversations.addMessage, {
      conversationId: currentConversationId as Id<"conversations">,
      role: "assistant",
      content: assistantMessage,
    });

    console.log("Successfully processed chat request");

    return NextResponse.json({
      conversationId: currentConversationId,
      message: assistantMessage,
      chatType,
    });

  } catch (error) {
    console.error("Error processing chat request:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}