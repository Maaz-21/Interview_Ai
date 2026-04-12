import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";

const FALLBACK_ACKS = [
  "Good answer. Let's move to the next question.",
  "Nice thinking. Here's your next question.",
  "Solid response. Let's continue.",
  "Good effort. Ready for the next one.",
];

export async function POST(req) {
  try {
    const body = await req.json();
    const { role, interviewType, question, answer, index, total } = body || {};

    if (!answer || !question) {
      return Response.json(
        {
          success: false,
          message: "Missing required fields: question and answer",
        },
        { status: 400 }
      );
    }

    if (!geminiApiKey) {
      return Response.json({
        success: true,
        acknowledgement:
          FALLBACK_ACKS[Math.floor(Math.random() * FALLBACK_ACKS.length)],
      });
    }

    const { text } = await generateText({
      model: google(geminiModel, {
        apiKey: geminiApiKey,
      }),
      prompt: `You are an AI interviewer conducting a ${interviewType || "General"} interview for a ${role || "candidate"} role.

Current question (${index || "?"}/${total || "?"}): ${question}
Candidate answer: ${answer}

Write one short spoken acknowledgement:
- Max 20 words
- Positive but honest
- No scoring
- No bullet points
- Natural spoken tone

Return only the acknowledgement sentence.`,
      temperature: 0.4,
      max_output_tokens: 80,
    });

    const acknowledgement = text
      .replace(/^"|"$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return Response.json({
      success: true,
      acknowledgement:
        acknowledgement ||
        FALLBACK_ACKS[Math.floor(Math.random() * FALLBACK_ACKS.length)],
    });
  } catch (error) {
    console.error("Acknowledge route failed:", error);
    return Response.json({
      success: true,
      acknowledgement:
        FALLBACK_ACKS[Math.floor(Math.random() * FALLBACK_ACKS.length)],
    });
  }
}
