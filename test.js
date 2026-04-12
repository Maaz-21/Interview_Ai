const fs = require("node:fs");
const path = require("node:path");
const { WebSocket } = require("ws");

const LIVE_WS_ENDPOINTS = [
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent",
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent",
];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;

    const key = line.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(idx + 1).trim();
    value = value.replace(/^['\"]|['\"]$/g, "");
    process.env[key] = value;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  return { ok: response.ok, status: response.status, data };
}

function normalizeModelName(modelInput, fallback) {
  const raw = (modelInput || fallback || "").trim();
  if (!raw) return "";
  return raw.startsWith("models/") ? raw : `models/${raw}`;
}

function getSupportedMethods(model) {
  return model?.supportedGenerationMethods || model?.supported_generation_methods || [];
}

async function listModels(apiKey) {
  const models = [];
  let pageToken = "";
  let guard = 0;

  do {
    const query = new URLSearchParams({ key: apiKey });
    if (pageToken) query.set("pageToken", pageToken);

    const response = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models?${query.toString()}`
    );

    if (!response.ok) return response;

    models.push(...(response.data?.models || []));
    pageToken = response.data?.nextPageToken || "";
    guard += 1;
  } while (pageToken && guard < 10);

  return { ok: true, status: 200, data: { models } };
}

async function testGenerateContentText(apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Say: Gemini key works." }] }],
      generationConfig: { responseModalities: ["TEXT"] },
    }),
  });
}

async function testGenerateContentAudio(apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Say hello in a short upbeat voice." }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Kore",
            },
          },
        },
      },
    }),
  });
}

function testLiveBidi({ apiKey, model, requestAudio, endpoint }) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${endpoint}?key=${encodeURIComponent(apiKey)}`);

    let settled = false;
    let promptSent = false;
    let sawSetup = false;
    let sawResponse = false;
    let sawAudio = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        ws.close();
      } catch {
        // no-op
      }
      resolve(result);
    };

    const sendPrompt = () => {
      if (promptSent) return;
      promptSent = true;

      const payload = {
        client_content: {
          turns: [
            {
              role: "user",
              parts: [{ text: "Say a short hello for a mock interview candidate." }],
            },
          ],
          turn_complete: true,
        },
      };

      ws.send(JSON.stringify(payload));
    };

    const timeout = setTimeout(() => {
      finish({ ok: false, error: "Timed out waiting for Gemini Live response." });
    }, 25000);

    ws.on("open", () => {
      const setup = {
        setup: {
          model,
          generation_config: requestAudio
            ? {
                response_modalities: ["AUDIO"],
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: {
                      voice_name: "Kore",
                    },
                  },
                },
              }
            : {
                response_modalities: ["TEXT"],
              },
        },
      };

      ws.send(JSON.stringify(setup));

      // Some runtimes don't emit an explicit setup message.
      setTimeout(sendPrompt, 800);
    });

    ws.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (data.error) {
        finish({ ok: false, error: JSON.stringify(data.error) });
        return;
      }

      if (data.setupComplete || data.setup_complete) {
        sawSetup = true;
        sendPrompt();
      }

      const serverContent = data.serverContent || data.server_content;
      const modelTurn = serverContent?.modelTurn || serverContent?.model_turn;
      const parts = Array.isArray(modelTurn?.parts) ? modelTurn.parts : [];

      if (parts.length > 0) {
        sawResponse = true;

        for (const part of parts) {
          const inlineData = part.inlineData || part.inline_data;
          const mimeType = inlineData?.mimeType || inlineData?.mime_type || "";
          if (typeof mimeType === "string" && mimeType.startsWith("audio/")) {
            sawAudio = true;
          }
        }
      }

      const isTurnComplete = Boolean(
        serverContent?.turnComplete || serverContent?.turn_complete
      );

      if (isTurnComplete || (sawResponse && (!requestAudio || sawAudio))) {
        finish({ ok: true, endpoint, model, sawSetup, sawResponse, sawAudio });
      }
    });

    ws.on("error", (error) => {
      finish({ ok: false, endpoint, model, error: error?.message || String(error) });
    });

    ws.on("close", (code, reason) => {
      if (!settled && !sawResponse) {
        finish({
          ok: false,
          endpoint,
          model,
          error: `Socket closed before response (${code}) ${reason?.toString() || ""}`,
        });
      }
    });
  });
}

async function run() {
  loadEnvLocal();

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const configuredModel = normalizeModelName(
    process.env.GEMINI_MODEL,
    "gemini-2.0-flash-001"
  );

  if (!apiKey) {
    console.error("Missing GOOGLE_GENERATIVE_AI_API_KEY in environment.");
    process.exit(1);
  }

  console.log(`Testing Gemini key against ${configuredModel}...`);

  const modelCheckUrl = `https://generativelanguage.googleapis.com/v1beta/${configuredModel}?key=${apiKey}`;
  const modelCheck = await fetchJson(modelCheckUrl);
  if (!modelCheck.ok) {
    console.error("Model check failed:", modelCheck.status, modelCheck.data);

    if (modelCheck.status === 404) {
      const modelListUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const modelList = await fetchJson(modelListUrl);

      if (modelList.ok) {
        const names = (modelList.data?.models || []).map((item) => item.name).slice(0, 20);
        console.error("Available models (first 20):", names);
      }
    }

    process.exit(1);
  }
  console.log("Model check passed.");

  const textCheck = await testGenerateContentText(apiKey, configuredModel);

  if (!textCheck.ok) {
    console.error("Text generation failed:", textCheck.status, textCheck.data);
    process.exit(1);
  }
  console.log("Text generation passed.");

  const audioCheck = await testGenerateContentAudio(apiKey, configuredModel);

  if (!audioCheck.ok) {
    console.error("Audio generation failed:", audioCheck.status, audioCheck.data);
    console.error("Configured model does not support one-shot AUDIO output (or audio is unavailable). Continuing to Live check...");
  } else {
    const parts = audioCheck.data?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((part) => part?.inlineData?.mimeType?.startsWith("audio/"));

    if (!audioPart) {
      console.warn("One-shot audio request succeeded but no audio part was returned.");
    } else {
      console.log("One-shot AUDIO generation passed for configured model.");
    }
  }

  const modelsResponse = await listModels(apiKey);
  if (!modelsResponse.ok) {
    console.error("Failed to list models:", modelsResponse.status, modelsResponse.data);
    process.exit(1);
  }

  const models = modelsResponse.data?.models || [];
  const bidiCandidates = models
    .filter((item) => getSupportedMethods(item).includes("bidiGenerateContent"))
    .map((item) => item.name);

  const liveCandidates = bidiCandidates.filter((name) => {
    const lowered = name.toLowerCase();
    return lowered.includes("live") || lowered.includes("native-audio");
  });

  if (bidiCandidates.length === 0) {
    console.error("No models with bidiGenerateContent capability were found for this key/project.");
    process.exit(1);
  }

  console.log("Bidi-capable models found:", bidiCandidates.slice(0, 10));

  const selectedByEnv = normalizeModelName(process.env.GEMINI_LIVE_MODEL, "");
  const rankedCandidates = [
    ...new Set([
      selectedByEnv,
      ...liveCandidates.filter((name) => name.toLowerCase().includes("native-audio-latest")),
      ...liveCandidates.filter((name) => name.toLowerCase().includes("native-audio")),
      ...liveCandidates.filter((name) => name.toLowerCase().includes("live")),
      ...bidiCandidates,
    ].filter(Boolean)),
  ].slice(0, 5);

  if (rankedCandidates.length === 0) {
    console.error("Could not resolve a live model to test.");
    process.exit(1);
  }

  console.log("Testing Gemini Live WebSocket in AUDIO mode across candidates...");

  const liveFailures = [];

  for (const modelName of rankedCandidates) {
    for (const endpoint of LIVE_WS_ENDPOINTS) {
      console.log(`- Trying ${modelName} via ${endpoint.includes("v1beta") ? "v1beta" : "v1alpha"}...`);
      const liveAudio = await testLiveBidi({
        apiKey,
        model: modelName,
        requestAudio: true,
        endpoint,
      });

      if (liveAudio.ok && liveAudio.sawAudio) {
        console.log("Gemini Live AUDIO test passed. Realtime voice agent is supported with this key/model.");
        process.exit(0);
      }

      liveFailures.push(liveAudio);
    }
  }

  console.error("Gemini Live AUDIO tests did not pass with tested models/endpoints.");
  for (const failure of liveFailures.slice(0, 8)) {
    console.error(`  ${failure.model} @ ${failure.endpoint}: ${failure.error || "No audio response"}`);
  }

  console.log("Running TEXT fallback on the top live candidate to detect partial Live access...");
  const textFallbackModel = rankedCandidates[0];

  for (const endpoint of LIVE_WS_ENDPOINTS) {
    const liveText = await testLiveBidi({
      apiKey,
      model: textFallbackModel,
      requestAudio: false,
      endpoint,
    });

    if (liveText.ok) {
      console.error("Live TEXT works, but Live AUDIO does not. Voice interview agent is not ready with current key/model setup.");
      process.exit(1);
    }
  }

  console.error("Live TEXT fallback also failed. Live API is likely unavailable or blocked for this project/account.");
  process.exit(1);
}

run().catch((error) => {
  console.error("Gemini voice test crashed:", error);
  process.exit(1);
});