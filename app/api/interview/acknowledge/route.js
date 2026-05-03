import { generateText } from "ai";
import { google } from "@ai-sdk/google";

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
  if (mode !== InterviewMode.LIVE_MODEL) return geminiModel;
  if (!geminiLiveModel || isGenerateContentIncompatibleModel(geminiLiveModel)) {
    return geminiModel;
  }
  return geminiLiveModel;
};

const FALLBACK_ACKS = [
  "Good answer. Let's move to the next question.",
  "Nice thinking. Here's your next question.",
  "Solid response. Let's continue.",
  "Good effort. Ready for the next one.",
];

export async function POST(req) {
  try {
    const body = await req.json();
    const { role, interviewType, question, answer, index, total, experienceMode } = body || {};

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

    const resolvedMode =
      experienceMode === InterviewMode.LIVE_MODEL
        ? InterviewMode.LIVE_MODEL
        : InterviewMode.GUIDED;
    const prompt = `You are an AI interviewer conducting a ${interviewType || "General"} interview for a ${role || "candidate"} role.

Current question (${index || "?"}/${total || "?"}): ${question}
Candidate answer: ${answer}

Write one short spoken acknowledgement:
- Max 20 words
- Positive but honest
- No scoring
- No bullet points
- Natural spoken tone

Return only the acknowledgement sentence.`;
    const primaryModel = getPrimaryModel(resolvedMode);

    let text;
    try {
      const result = await generateText({
        model: google(primaryModel, {
          apiKey: geminiApiKey,
        }),
        prompt,
        temperature: 0.4,
        max_output_tokens: 80,
      });
      text = result.text;
    } catch (primaryError) {
      if (primaryModel !== geminiModel) {
        console.warn(
          `Primary model ${primaryModel} failed for acknowledgement, falling back to ${geminiModel}: ${
            primaryError?.message || String(primaryError)
          }`
        );
        const fallbackResult = await generateText({
          model: google(geminiModel, {
            apiKey: geminiApiKey,
          }),
          prompt,
          temperature: 0.4,
          max_output_tokens: 80,
        });
        text = fallbackResult.text;
      } else {
        throw primaryError;
      }
    }

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
