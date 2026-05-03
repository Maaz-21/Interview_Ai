import { getCurrentUser } from "@/lib/actions/auth.action";
import { endGeminiLiveInterviewSession } from "@/lib/gemini/liveSessionManager";

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

    if (!sessionId) {
      return Response.json(
        {
          success: false,
          message: "Missing required field: sessionId.",
        },
        { status: 400 }
      );
    }

    const { transcript, modelUsed } = await endGeminiLiveInterviewSession({
      sessionId,
      userId: currentUser.id,
    });

    return Response.json({
      success: true,
      transcriptLength: transcript.length,
      modelUsed,
    });
  } catch (error) {
    console.error("Failed to end live interview session:", error);
    return Response.json(
      {
        success: false,
        message: error?.message || "Failed to end live interview session",
      },
      { status: 500 }
    );
  }
}