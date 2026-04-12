import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";

export async function GET() {
  return Response.json(
    { success: true, data: "Gemini Interview Question Generator API" },
    { status: 200 }
  );
}

export async function POST(req) {
  try {
    if (!geminiApiKey) {
      throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const body = await req.json();
    const { type, role, level, techstack, amount, userid } = body;

    if (!type || !role || !level || !techstack || !amount) {
      const errorMsg = `You must provide: ${!type ? "type " : ""}${
        !role ? "role " : ""
      }${!level ? "level " : ""}${!techstack ? "techstack " : ""}${
        !amount ? "amount" : ""
      }`;
      return Response.json(
        {
          success: false,
          message: `Missing required fields, ${errorMsg}`,
        },
        { status: 400 }
      );
    }

    const questionCount = Number(amount) || 5;

    const { text } = await generateText({
      model: google(geminiModel, {
        apiKey: geminiApiKey,
      }),
      prompt: `Generate interview questions for a job interview.
Role: ${role}
Experience Level: ${level}
Interview Type: ${type} (focus more on this type)
Tech Stack: ${techstack}
Number of Questions: ${questionCount}

Instructions:
- Return ONLY the questions in a valid JSON array string format.
- No markdown code block and no additional text.
- Questions must be concise, clear, and suitable for spoken interviews.
- Blend conceptual and practical depth at ${level} level.

Format strictly: ["Question 1", "Question 2", "Question 3"]`,
    });

    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    const parsed = JSON.parse(cleaned);
    const questions = Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (!questions.length) {
      return Response.json(
        {
          success: false,
          message: "Gemini did not return valid interview questions.",
        },
        { status: 500 }
      );
    }

    let interviewRef = null;
    if (userid) {
      const interview = {
        role,
        type,
        level,
        techstack: String(techstack)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        questions,
        userId: userid || "voice-generated",
        finalized: true,
        coverImage: getRandomInterviewCover(),
        createdAt: new Date().toISOString(),
        isPublic: false,
        isAnonymous: true,
        totalScore: null,
      };

      interviewRef = await db.collection("interviews").add(interview);
    }

    return Response.json({
      success: true,
      interviewId: interviewRef?.id || null,
      questions,
      result: `Generated ${questions.length} ${String(type).toLowerCase()} questions for ${role}.`,
    });
  } catch (error) {
    console.error("Interview question generation error:", error);
    return Response.json(
      {
        success: false,
        message: error?.message || "Failed to generate questions",
      },
      { status: 500 }
    );
  }
}
