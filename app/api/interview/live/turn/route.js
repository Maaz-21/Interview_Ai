import { getCurrentUser } from "@/lib/actions/auth.action";
import { sendGeminiLiveCandidateTurn } from "@/lib/gemini/liveSessionManager";

const COMPLETION_MARKER = "INTERVIEW_COMPLETE";

const stripCompletionMarker = (text) =>
  String(text || "")
    .replace(/^\s*INTERVIEW_COMPLETE\s*:?/i, "")
    .replace(/\s+/g, " ")
    .trim();

export async function POST(req) {
  try {
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
    const sessionId = String(body?.sessionId || "").trim();
    const answer = String(body?.answer || "").trim();

    if (!sessionId || !answer) {
      return Response.json(
        {
          success: false,
          message: "Missing required fields: sessionId and answer.",
        },
        { status: 400 }
      );
    }

    const { assistantMessage, audio, modelUsed, voiceMode } = await sendGeminiLiveCandidateTurn({
      sessionId,
      userId: currentUser.id,
      answer,
    });

    const normalizedAssistantMessage = String(assistantMessage || "");
    const completed = normalizedAssistantMessage.includes(COMPLETION_MARKER);
    const cleanedAssistantMessage = completed
      ? stripCompletionMarker(normalizedAssistantMessage)
      : normalizedAssistantMessage;

    return Response.json({
      success: true,
      assistantMessage: cleanedAssistantMessage || assistantMessage,
      assistantAudio: audio,
      completed,
      modelUsed,
      voiceMode,
    });
  } catch (error) {
    console.error("Live turn route failed:", error);
    return Response.json(
      {
        success: false,
        message: error?.message || "Failed to process live interview turn",
      },
      { status: 500 }
    );
  }
}
