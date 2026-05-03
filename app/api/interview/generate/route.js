import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiLiveModel =
  process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-latest";

const InterviewMode = {
  GUIDED: "guided-voice",
  LIVE_MODEL: "live-model",
};

const isGenerateContentIncompatibleModel = (modelName) =>
  /native-audio|live-preview/i.test(String(modelName || ""));

const getPrimaryModel = (mode) => {
  if (mode !== InterviewMode.LIVE_MODEL) {
    return {
      modelName: geminiModel,
      skippedLiveModel: false,
      skipReason: null,
    };
  }

  if (!geminiLiveModel || isGenerateContentIncompatibleModel(geminiLiveModel)) {
    return {
      modelName: geminiModel,
      skippedLiveModel: true,
      skipReason:
        "Live Model Assisted mode fell back to Guided Voice mode because GEMINI_LIVE_MODEL is not compatible with generateContent.",
    };
  }

  return {
    modelName: geminiLiveModel,
    skippedLiveModel: false,
    skipReason: null,
  };
};

async function generateQuestionsWithModel({ modelName, prompt }) {
  const { text } = await generateText({
    model: google(modelName, {
      apiKey: geminiApiKey,
    }),
    prompt,
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
    throw new Error("Gemini did not return valid interview questions.");
  }

  return questions;
}

export async function GET() {
  return Response.json(
    { success: true, data: "Gemini Interview Question Generator API" },
    { status: 200 }
  );
}

export async function POST(req) {
  try {
    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const body = await req.json();
    const { type, role, level, techstack, amount, userid, experienceMode } = body;

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
    const resolvedMode =
      experienceMode === InterviewMode.LIVE_MODEL
        ? InterviewMode.LIVE_MODEL
        : InterviewMode.GUIDED;

    const prompt = `Generate interview questions for a job interview.
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

Format strictly: ["Question 1", "Question 2", "Question 3"]`;

    const {
      modelName: primaryModel,
      skippedLiveModel,
      skipReason,
    } = getPrimaryModel(resolvedMode);
    let modelUsed = primaryModel;
    let questions = [];
    let fallbackToGuided = skippedLiveModel;
    let fallbackReason = skipReason;

    try {
      questions = await generateQuestionsWithModel({
        modelName: primaryModel,
        prompt,
      });
    } catch (primaryError) {
      if (primaryModel !== geminiModel) {
        console.warn(
          `Primary model ${primaryModel} failed for generation, falling back to ${geminiModel}: ${
            primaryError?.message || String(primaryError)
          }`
        );
        questions = await generateQuestionsWithModel({
          modelName: geminiModel,
          prompt,
        });
        modelUsed = geminiModel;
        fallbackToGuided = true;
        fallbackReason =
          "Live Model Assisted mode fell back to Guided Voice mode because the live model failed for question generation.";
      } else {
        throw primaryError;
      }
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
        experienceMode: resolvedMode,
      };

      interviewRef = await db.collection("interviews").add(interview);
    }

    return Response.json({
      success: true,
      interviewId: interviewRef?.id || null,
      questions,
      experienceMode: resolvedMode,
      modelUsed,
      skippedLiveModel,
      fallbackToGuided,
      fallbackReason,
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
