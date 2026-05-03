import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { startGeminiLiveInterviewSession } from "@/lib/gemini/liveSessionManager";
import { getRandomInterviewCover } from "@/lib/utils";

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const geminiLiveModel =
  process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-latest";

const InterviewMode = {
  LIVE_MODEL: "live-model",
};

const parseTechstack = (input) => {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(input || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseQuestionCount = (value, fallback = 5) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(15, Math.max(1, Math.round(parsed)));
};

const getErrorMessage = (error, fallback) => {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === "object") {
    const directMessage = String(error?.message || "").trim();
    if (directMessage) return directMessage;

    const causeMessage = String(error?.cause?.message || "").trim();
    if (causeMessage) return causeMessage;

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // no-op
    }
  }

  return fallback;
};

export async function POST(req) {
  try {
    if (!geminiApiKey) {
      return Response.json(
        {
          success: false,
          message: "Missing GEMINI_API_KEY",
        },
        { status: 500 }
      );
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return Response.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const requestedUserId = body?.userid || body?.userId;

    if (requestedUserId && requestedUserId !== currentUser.id) {
      return Response.json(
        {
          success: false,
          message: "Cannot start a live session for another user.",
        },
        { status: 403 }
      );
    }

    let interviewId = body?.interviewId || null;
    let role = String(body?.role || "").trim();
    let interviewType = String(body?.type || "").trim();
    let level = String(body?.level || "").trim();
    let techstack = parseTechstack(body?.techstack);
    let questionCount = parseQuestionCount(body?.amount, 5);

    if (interviewId) {
      const interviewDoc = await db.collection("interviews").doc(interviewId).get();
      if (!interviewDoc.exists) {
        return Response.json(
          {
            success: false,
            message: "Interview not found.",
          },
          { status: 404 }
        );
      }

      const interviewData = interviewDoc.data() || {};
      if (interviewData.userId !== currentUser.id) {
        return Response.json(
          {
            success: false,
            message: "You can only run your own interview.",
          },
          { status: 403 }
        );
      }

      role = role || String(interviewData.role || "").trim();
      interviewType = interviewType || String(interviewData.type || "").trim();
      level = level || String(interviewData.level || "").trim();
      techstack = techstack.length ? techstack : parseTechstack(interviewData.techstack);
      questionCount = parseQuestionCount(
        body?.amount,
        interviewData.questionCount || interviewData.questions?.length || 5
      );
    } else {
      if (!role || !interviewType || !level || !techstack.length) {
        return Response.json(
          {
            success: false,
            message:
              "Missing required fields: role, type, level, and techstack are required to start live mode.",
          },
          { status: 400 }
        );
      }

      const interviewRecord = {
        role,
        type: interviewType,
        level,
        techstack,
        questions: [],
        questionCount,
        userId: currentUser.id,
        finalized: true,
        coverImage: getRandomInterviewCover(),
        createdAt: new Date().toISOString(),
        isPublic: false,
        isAnonymous: true,
        totalScore: null,
        experienceMode: InterviewMode.LIVE_MODEL,
      };

      const interviewRef = await db.collection("interviews").add(interviewRecord);
      interviewId = interviewRef.id;
    }

    const {
      sessionId,
      firstAssistantMessage,
      firstAssistantAudio,
      modelUsed,
      voiceMode,
    } =
      await startGeminiLiveInterviewSession({
        apiKey: geminiApiKey,
        modelName: geminiLiveModel,
        userId: currentUser.id,
        config: {
          role,
          interviewType,
          level,
          techstack,
          questionCount,
          userName: currentUser.name,
        },
      });

    return Response.json({
      success: true,
      interviewId,
      sessionId,
      assistantMessage: firstAssistantMessage,
      assistantAudio: firstAssistantAudio,
      modelUsed,
      voiceMode,
      questionCount,
      experienceMode: InterviewMode.LIVE_MODEL,
    });
  } catch (error) {
    const message = getErrorMessage(error, "Failed to start live interview");
    console.error("Failed to start live interview session:", {
      message,
      error,
    });

    return Response.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
