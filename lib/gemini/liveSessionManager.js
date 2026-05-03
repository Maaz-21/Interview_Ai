import "server-only";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const DEFAULT_LIVE_WS_ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const FALLBACK_LIVE_WS_ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

const LIVE_WS_ENDPOINT = process.env.GEMINI_LIVE_WS_ENDPOINT || DEFAULT_LIVE_WS_ENDPOINT;

const DEFAULT_LIVE_MODEL = "gemini-2.5-flash-native-audio-latest";
const DEFAULT_TEXT_LIVE_MODEL = "gemini-3.1-flash-live-preview";
const DEFAULT_AUDIO_VOICE = process.env.GEMINI_LIVE_VOICE || "Kore";
const SESSION_TTL_MS = 1000 * 60 * 45;
const SESSION_LIMIT = 50;
const TURN_TIMEOUT_MS = 30_000;

const globalState = globalThis;
if (!globalState.__geminiLiveSessions) {
  globalState.__geminiLiveSessions = new Map();
}

const sessions = globalState.__geminiLiveSessions;

const normalizeModelName = (modelName) => {
  const normalized = String(modelName || DEFAULT_LIVE_MODEL).trim();
  if (!normalized) return `models/${DEFAULT_LIVE_MODEL}`;
  return normalized.startsWith("models/") ? normalized : `models/${normalized}`;
};

const isNativeAudioModel = (modelName) => /native-audio/i.test(String(modelName || ""));

const getLiveModelCandidates = (modelName) => {
  const normalizedRequestedModel = normalizeModelName(modelName);
  const candidates = [normalizedRequestedModel];

  if (!isNativeAudioModel(normalizedRequestedModel)) {
    return candidates;
  }

  const preferredTextModel = normalizeModelName(
    process.env.GEMINI_LIVE_TEXT_MODEL || DEFAULT_TEXT_LIVE_MODEL
  );

  return [...new Set([normalizedRequestedModel, preferredTextModel])];
};

const getLiveEndpointCandidates = () => {
  const configured = String(LIVE_WS_ENDPOINT || "").trim() || DEFAULT_LIVE_WS_ENDPOINT;
  const candidates = [configured];

  if (configured.includes("v1beta")) {
    candidates.push(configured.replace("v1beta", "v1alpha"));
  } else if (configured.includes("v1alpha")) {
    candidates.push(configured.replace("v1alpha", "v1beta"));
  } else {
    candidates.push(FALLBACK_LIVE_WS_ENDPOINT);
  }

  return [...new Set(candidates.filter(Boolean))];
};

const getLiveGenerationConfigCandidates = (modelName) => {
  if (!isNativeAudioModel(modelName)) {
    return [
      {
        label: "text",
        generationConfig: {
          response_modalities: ["TEXT"],
        },
        setupExtras: {},
      },
    ];
  }

  return [
    {
      label: "audio-default-voice",
      generationConfig: {
        response_modalities: ["AUDIO"],
      },
      setupExtras: {
        output_audio_transcription: {},
      },
    },
    {
      label: "audio-explicit-voice",
      generationConfig: {
        response_modalities: ["AUDIO"],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: DEFAULT_AUDIO_VOICE,
            },
          },
        },
      },
      setupExtras: {
        output_audio_transcription: {},
      },
    },
    {
      label: "text-fallback",
      generationConfig: {
        response_modalities: ["TEXT"],
      },
      setupExtras: {},
    },
  ];
};

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const cleanupStaleSessions = () => {
  const now = Date.now();

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.updatedAt <= SESSION_TTL_MS) continue;

    try {
      session.ws?.close();
    } catch {
      // no-op
    }

    sessions.delete(sessionId);
  }
};

const ensureCapacity = () => {
  if (sessions.size < SESSION_LIMIT) return;

  const oldest = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
  if (!oldest) return;

  try {
    oldest.ws?.close();
  } catch {
    // no-op
  }

  sessions.delete(oldest.id);
};

const rejectPendingTurn = (session, errorMessage) => {
  const pending = session.pendingTurn;
  if (!pending) return;

  clearTimeout(pending.timeoutId);
  session.pendingTurn = null;
  pending.reject(new Error(errorMessage));
};

const resolvePendingTurn = (session) => {
  const pending = session.pendingTurn;
  if (!pending) return;

  clearTimeout(pending.timeoutId);
  session.pendingTurn = null;

  const assistantMessage = normalizeText(pending.textChunks.join(" "));
  let audio = null;

  if (pending.audioChunks.length) {
    const audioBuffer = Buffer.concat(
      pending.audioChunks.map((chunk) => Buffer.from(chunk, "base64"))
    );

    audio = {
      data: audioBuffer.toString("base64"),
      mimeType: pending.audioMimeType || "audio/pcm;rate=24000",
    };
  }

  pending.resolve({ assistantMessage, audio });
};

const extractResponseParts = (payload) => {
  const serverContent = payload.serverContent || payload.server_content;
  const modelTurn = serverContent?.modelTurn || serverContent?.model_turn;
  const parts = Array.isArray(modelTurn?.parts) ? modelTurn.parts : [];

  const textParts = [];
  const audioParts = [];

  for (const part of parts) {
    if (part?.thought === true) {
      continue;
    }

    if (typeof part?.text === "string" && part.text.trim()) {
      textParts.push(part.text.trim());
    }

    const inlineData = part?.inlineData || part?.inline_data;
    if (typeof inlineData?.data === "string" && inlineData.data.trim()) {
      audioParts.push({
        data: inlineData.data.trim(),
        mimeType: inlineData.mimeType || inlineData.mime_type || "audio/pcm;rate=24000",
      });
    }
  }

  const outputTranscription =
    payload.outputTranscription ||
    payload.output_transcription ||
    serverContent?.outputTranscription ||
    serverContent?.output_transcription;

  if (typeof outputTranscription?.text === "string" && outputTranscription.text.trim()) {
    textParts.push(outputTranscription.text.trim());
  }

  const turnComplete = Boolean(serverContent?.turnComplete || serverContent?.turn_complete);

  return { textParts: [...new Set(textParts)], audioParts, turnComplete };
};

const getSessionForUser = ({ sessionId, userId }) => {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error("Live session not found or has expired.");
  }

  if (session.userId !== userId) {
    throw new Error("Unauthorized live session access.");
  }

  return session;
};

const sendClientTurn = ({ session, text, saveUserTurn = true }) => {
  if (!session.ready) {
    throw new Error("Live session is still initializing.");
  }

  if (session.pendingTurn) {
    throw new Error("Previous live turn is still processing.");
  }

  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    throw new Error("Cannot send an empty turn to live session.");
  }

  if (saveUserTurn) {
    session.transcript.push({ role: "user", content: normalizedText });
  }

  session.updatedAt = Date.now();

  const responsePromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      session.pendingTurn = null;
      reject(new Error("Timed out waiting for Gemini Live response."));
    }, TURN_TIMEOUT_MS);

    session.pendingTurn = {
      resolve,
      reject,
      timeoutId,
      textChunks: [],
      audioChunks: [],
      audioMimeType: null,
    };
  });

  const payload = {
    client_content: {
      turns: [
        {
          role: "user",
          parts: [{ text: normalizedText }],
        },
      ],
      turn_complete: true,
    },
  };

  try {
    session.ws.send(JSON.stringify(payload));
  } catch (error) {
    rejectPendingTurn(session, error?.message || "Failed to send live turn.");
    throw error;
  }

  return responsePromise.then(({ assistantMessage, audio }) => {
    if (assistantMessage) {
      session.transcript.push({ role: "assistant", content: assistantMessage });
    }
    session.updatedAt = Date.now();
    return { assistantMessage, audio };
  });
};

const createOpenPrompt = ({ role, interviewType, level, techstack, questionCount, userName }) => {
  const formattedTech = Array.isArray(techstack)
    ? techstack.join(", ")
    : String(techstack || "General stack");

  return `You are a professional interviewer running a real-time mock interview.

Candidate context:
- Candidate name: ${userName || "Candidate"}
- Role: ${role}
- Interview type: ${interviewType}
- Seniority: ${level}
- Tech stack: ${formattedTech}
- Total questions required: ${questionCount}

Rules:
1) Ask exactly ${questionCount} interview questions, one at a time.
2) Keep each question concise and practical.
3) After every candidate answer, briefly acknowledge in one sentence, then ask the next question.
4) Prefix each question with Q<number>:
5) After the final candidate answer, do not ask more questions. Respond with INTERVIEW_COMPLETE on the first line, then provide a short 2-3 sentence closing summary.
6) Do not output markdown or bullet points.

Start now with a short welcome and Q1.`;
};

const initializeGeminiLiveSocket = async ({
  apiKey,
  modelName,
  userId,
  endpoint,
  generationConfig,
  setupExtras = {},
}) => {
  const sessionId = randomUUID();
  const ws = new WebSocket(`${endpoint}?key=${encodeURIComponent(apiKey)}`);

  const session = {
    id: sessionId,
    userId,
    ws,
    modelName,
    endpoint,
    voiceMode: generationConfig?.response_modalities?.includes("AUDIO")
      ? "native-audio"
      : "browser-tts-fallback",
    ready: false,
    transcript: [],
    pendingTurn: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  sessions.set(sessionId, session);

  const readyPromise = new Promise((resolve, reject) => {
    const setupTimeout = setTimeout(() => {
      reject(new Error("Timed out while initializing Gemini Live session."));
    }, 15_000);

    const cleanupReadyListeners = () => {
      clearTimeout(setupTimeout);
    };

    ws.on("open", () => {
      try {
        ws.send(
          JSON.stringify({
            setup: {
              model: modelName,
              generation_config: generationConfig,
              ...setupExtras,
            },
          })
        );
      } catch (error) {
        cleanupReadyListeners();
        reject(new Error(error?.message || "Failed to initialize live setup."));
      }
    });

    ws.on("message", (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (payload.error) {
        cleanupReadyListeners();
        reject(new Error(payload.error?.message || "Gemini Live setup failed."));
        return;
      }

      if (payload.setupComplete || payload.setup_complete) {
        session.ready = true;
        cleanupReadyListeners();
        resolve();
        return;
      }

      const { textParts, audioParts, turnComplete } = extractResponseParts(payload);
      if (session.pendingTurn && textParts.length) {
        session.pendingTurn.textChunks.push(...textParts);
      }

      if (session.pendingTurn && audioParts.length) {
        session.pendingTurn.audioChunks.push(...audioParts.map((part) => part.data));
        session.pendingTurn.audioMimeType =
          session.pendingTurn.audioMimeType || audioParts[0]?.mimeType || null;
      }

      if (turnComplete) {
        resolvePendingTurn(session);
      }
    });

    ws.on("error", (error) => {
      cleanupReadyListeners();
      reject(new Error(error?.message || "Gemini Live socket error."));
      rejectPendingTurn(session, error?.message || "Gemini Live socket error.");
    });

    ws.on("close", (code, reason) => {
      const reasonText = reason?.toString() || "Socket closed";

      if (!session.ready) {
        cleanupReadyListeners();
        reject(new Error(`Gemini Live closed before setup (${code}) ${reasonText}`));
      }

      rejectPendingTurn(session, `Gemini Live session closed (${code}) ${reasonText}`);
      sessions.delete(sessionId);
    });
  });

  try {
    await readyPromise;
    return { sessionId, session };
  } catch (error) {
    sessions.delete(sessionId);
    try {
      ws.close();
    } catch {
      // no-op
    }
    throw error;
  }
};

export async function startGeminiLiveInterviewSession({
  apiKey,
  modelName,
  userId,
  config,
}) {
  cleanupStaleSessions();
  ensureCapacity();

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY for live interview mode.");
  }

  const normalizedModel = normalizeModelName(modelName);
  const modelCandidates = getLiveModelCandidates(normalizedModel);
  const endpointCandidates = getLiveEndpointCandidates();

  let sessionId = null;
  let session = null;
  const setupErrors = [];

  outer: for (const modelCandidate of modelCandidates) {
    const generationConfigCandidates = getLiveGenerationConfigCandidates(modelCandidate);

    for (const endpoint of endpointCandidates) {
      for (const candidate of generationConfigCandidates) {
        try {
          const initialized = await initializeGeminiLiveSocket({
            apiKey,
            modelName: modelCandidate,
            userId,
            endpoint,
            generationConfig: candidate.generationConfig,
            setupExtras: candidate.setupExtras,
          });

          sessionId = initialized.sessionId;
          session = initialized.session;
          break outer;
        } catch (error) {
          setupErrors.push(
            `${modelCandidate} :: ${candidate.label} @ ${endpoint} -> ${
              error?.message || "Unknown setup error."
            }`
          );
        }
      }
    }
  }

  if (!session || !sessionId) {
    const lastError = setupErrors[setupErrors.length - 1] || "Unknown setup error.";
    throw new Error(
      `Gemini Live setup failed for ${normalizedModel}. Last attempt: ${lastError}`
    );
  }

  try {
    const {
      assistantMessage: firstAssistantMessage,
      audio: firstAssistantAudio,
    } = await sendClientTurn({
      session,
      text: createOpenPrompt(config),
      saveUserTurn: false,
    });

    return {
      sessionId,
      firstAssistantMessage,
      firstAssistantAudio,
      modelUsed: session.modelName,
      voiceMode: session.voiceMode,
    };
  } catch (error) {
    sessions.delete(sessionId);
    try {
      session.ws?.close();
    } catch {
      // no-op
    }
    throw error;
  }
}

export async function sendGeminiLiveCandidateTurn({ sessionId, userId, answer }) {
  cleanupStaleSessions();
  const session = getSessionForUser({ sessionId, userId });

  const { assistantMessage, audio } = await sendClientTurn({
    session,
    text: answer,
    saveUserTurn: true,
  });

  return {
    assistantMessage,
    audio,
    transcript: [...session.transcript],
    modelUsed: session.modelName,
    voiceMode: session.voiceMode,
  };
}

export async function endGeminiLiveInterviewSession({ sessionId, userId }) {
  const session = getSessionForUser({ sessionId, userId });

  rejectPendingTurn(session, "Live session ended by user.");

  try {
    session.ws?.close();
  } catch {
    // no-op
  }

  sessions.delete(sessionId);

  return {
    transcript: [...session.transcript],
    modelUsed: session.modelName,
    voiceMode: session.voiceMode,
  };
}
