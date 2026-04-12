"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mic, MicOff, Send, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import { createFeedback } from "@/lib/actions/general.action";

const CallStatus = {
  INACTIVE: "INACTIVE",
  CONNECTING: "CONNECTING",
  ACTIVE: "ACTIVE",
  FINISHED: "FINISHED",
};

const InterviewStage = {
  IDLE: "IDLE",
  PREPARING: "PREPARING",
  AI_SPEAKING: "AI_SPEAKING",
  LISTENING: "LISTENING",
  PROCESSING: "PROCESSING",
  FINISHED: "FINISHED",
};

const FALLBACK_ACKS = [
  "Good answer. Let's continue.",
  "Nice thinking. Moving to the next one.",
  "Solid response. Let's keep going.",
  "Great effort. Next question coming up.",
];

const getSpeechRecognitionCtor = () => {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

function Agent({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
}) {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState(CallStatus.INACTIVE);
  const [stage, setStage] = useState(InterviewStage.IDLE);
  const [messages, setMessages] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [createdInterviewId, setCreatedInterviewId] = useState(interviewId || null);
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [supportsSpeechRecognition, setSupportsSpeechRecognition] = useState(false);
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);
  // Pre-call form state
  const [roleInput, setRoleInput] = useState("");
  const [typeInput, setTypeInput] = useState("Technical");
  const [levelInput, setLevelInput] = useState("Junior");
  const [techstackInput, setTechstackInput] = useState("");
  const [amountInput, setAmountInput] = useState("5");
  const [isPreparingInterview, setIsPreparingInterview] = useState(false);

  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const hasGeneratedFeedbackRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const isGenerateMode = type === "generate";

  useEffect(() => {
    setSupportsSpeechRecognition(Boolean(getSpeechRecognitionCtor()));

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // no-op
        }
      }

      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const appendMessage = useCallback((role, content) => {
    const normalized = String(content || "").trim();
    if (!normalized) return;

    setMessages((prev) => [...prev, { role, content: normalized }]);
  }, []);

  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      try {
        recognition.stop();
      } catch {
        // no-op
      }
    }

    recognitionRef.current = null;
    setIsRecognitionActive(false);
  }, []);

  const startRecognition = useCallback(() => {
    if (!supportsSpeechRecognition || isRecognitionActive) return false;

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) return false;

    try {
      const recognition = new RecognitionCtor();
      finalTranscriptRef.current = "";
      setVoiceTranscript("");

      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i]?.[0]?.transcript || "";
          if (event.results[i]?.isFinal) {
            finalTranscriptRef.current += `${piece} `;
          } else {
            interimTranscript += piece;
          }
        }

        const combined = `${finalTranscriptRef.current} ${interimTranscript}`
          .replace(/\s+/g, " ")
          .trim();

        setVoiceTranscript(combined);
      };

      recognition.onerror = (event) => {
        if (event?.error !== "aborted") {
          console.error("Speech recognition error:", event);
          toast.error("Microphone capture failed. You can type your answer instead.");
        }
        setIsRecognitionActive(false);
      };

      recognition.onend = () => {
        setIsRecognitionActive(false);
        recognitionRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecognitionActive(true);
      return true;
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      toast.error("Could not start microphone. Please type your answer.");
      return false;
    }
  }, [isRecognitionActive, supportsSpeechRecognition]);

  const speakText = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.96;
        utterance.pitch = 1;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("Speech synthesis error:", error);
        setIsSpeaking(false);
        resolve();
      }
    });
  }, []);

  const concludeInterview = useCallback(
    async (endedEarly = false) => {
      stopRecognition();
      stopRequestedRef.current = true;

      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      const closingMessage = endedEarly
        ? "Interview ended. I am generating your feedback now."
        : "Great work. Interview complete. I am generating your feedback now.";

      appendMessage("assistant", closingMessage);
      setStage(InterviewStage.FINISHED);
      setCallStatus(CallStatus.FINISHED);
      await speakText(closingMessage);
    },
    [appendMessage, speakText, stopRecognition]
  );

  const getAcknowledgement = useCallback(async ({ question, answer, index, total }) => {
    try {
      const response = await fetch("/api/interview/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: roleInput || "General",
          interviewType: typeInput,
          question,
          answer,
          index,
          total,
        }),
      });

      const data = await response.json();
      if (data?.success && data?.acknowledgement) {
        return String(data.acknowledgement).trim();
      }
    } catch (error) {
      console.error("Acknowledgement request failed:", error);
    }

    return FALLBACK_ACKS[Math.floor(Math.random() * FALLBACK_ACKS.length)];
  }, [roleInput, typeInput]);

  const askQuestion = useCallback(
    async (questionIndex, sourceQuestions) => {
      const questionsToAsk = sourceQuestions || sessionQuestions;
      if (!questionsToAsk.length) return;

      if (questionIndex >= questionsToAsk.length) {
        await concludeInterview(false);
        return;
      }

      const question = questionsToAsk[questionIndex];
      const spokenPrompt = `Question ${questionIndex + 1} of ${questionsToAsk.length}. ${question}`;

      setCurrentQuestionIndex(questionIndex);
      setStage(InterviewStage.AI_SPEAKING);
      appendMessage("assistant", spokenPrompt);
      await speakText(spokenPrompt);

      if (stopRequestedRef.current) return;

      setStage(InterviewStage.LISTENING);
      const started = startRecognition();
      if (!started) {
        toast.info("Voice input unavailable. Type your answer and submit.");
      }
    },
    [appendMessage, concludeInterview, sessionQuestions, speakText, startRecognition]
  );

  const handleGenerateFeedback = useCallback(async (transcriptMessages, interviewIdToUse) => {
    if (!interviewIdToUse) {
      toast.error("Missing interview id — cannot generate feedback.");
      router.push("/");
      return;
    }

    setIsGeneratingFeedback(true);
    const loadingId = toast.loading("Generating feedback — this may take a few seconds...");

    try {
      const { success, feedbackId: id, message } = await createFeedback({
        interviewId: interviewIdToUse,
        userId: userId,
        transcript: transcriptMessages,
        feedbackId,
      });

      toast.dismiss(loadingId);

      if (success && id) {
        toast.success("Feedback ready");
        router.push(`/interview/${interviewIdToUse}/feedback`);
      } else {
        console.error("Feedback creation failed:", message);
        toast.error(message || "Failed to save feedback");
        router.push("/");
      }
    } catch (err) {
      toast.dismiss(loadingId);
      console.error("Error creating feedback:", err);
      toast.error("Error generating feedback — check server logs.");
      router.push("/");
    } finally {
      setIsGeneratingFeedback(false);
    }
  }, [feedbackId, router, userId]);

  useEffect(() => {
    if (messages.length === 0) return;

    setLastMessage(messages[messages.length - 1].content);
  }, [messages]);

  useEffect(() => {
    if (callStatus !== CallStatus.FINISHED) return;
    if (hasGeneratedFeedbackRef.current) return;

    hasGeneratedFeedbackRef.current = true;
    const interviewIdToUse = createdInterviewId || interviewId;
    void handleGenerateFeedback(messages, interviewIdToUse);
  }, [callStatus, createdInterviewId, handleGenerateFeedback, interviewId, messages]);

  const handleStartInterview = async () => {
    hasGeneratedFeedbackRef.current = false;
    stopRequestedRef.current = false;

    setCallStatus(CallStatus.CONNECTING);
    setStage(InterviewStage.PREPARING);
    setIsPreparingInterview(true);
    setMessages([]);
    setLastMessage("");
    setCurrentQuestionIndex(0);
    setVoiceTranscript("");
    setManualAnswer("");
    setSessionQuestions([]);
    setCreatedInterviewId(interviewId || null);

    try {
      let questionsToAsk = questions;
      let interviewIdFromServer = interviewId || null;

      if (isGenerateMode) {
        if (!roleInput || !typeInput || !levelInput || !techstackInput || !amountInput) {
          toast.info("Please fill all pre-call details before starting the call.");
          setCallStatus(CallStatus.INACTIVE);
          setStage(InterviewStage.IDLE);
          return;
        }

        const payload = {
          role: roleInput,
          type: typeInput,
          level: levelInput,
          techstack: techstackInput,
          amount: amountInput,
          userid: userId || "voice-user",
        };

        const res = await fetch("/api/interview/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        interviewIdFromServer = data.interviewId;

        if (!data.success || !Array.isArray(data.questions) || data.questions.length === 0) {
          console.error("Question generation failed:", data);
          toast.error(data.message || "Failed to generate questions.");
          setCallStatus(CallStatus.INACTIVE);
          setStage(InterviewStage.IDLE);
          return;
        }

        questionsToAsk = data.questions;
      } else if (!Array.isArray(questions) || questions.length === 0) {
        toast.error("No interview questions were found for this session.");
        setCallStatus(CallStatus.INACTIVE);
        setStage(InterviewStage.IDLE);
        return;
      }

      const normalizedQuestions = questionsToAsk.map((item) => String(item).trim()).filter(Boolean);
      if (!normalizedQuestions.length) {
        toast.error("Generated questions were invalid.");
        setCallStatus(CallStatus.INACTIVE);
        setStage(InterviewStage.IDLE);
        return;
      }

      setSessionQuestions(normalizedQuestions);
      if (interviewIdFromServer) {
        setCreatedInterviewId(interviewIdFromServer);
      }

      setCallStatus(CallStatus.ACTIVE);
      const welcomeMessage = `Welcome ${userName || "there"}. We will practice ${normalizedQuestions.length} interview questions.`;
      appendMessage("assistant", welcomeMessage);
      setStage(InterviewStage.AI_SPEAKING);
      await speakText(welcomeMessage);

      if (stopRequestedRef.current) return;
      await askQuestion(0, normalizedQuestions);
    } catch (err) {
      console.error("Failed to start Gemini interview:", err);
      setCallStatus(CallStatus.INACTIVE);
      setStage(InterviewStage.IDLE);
      toast.error(`Failed to start interview: ${err.message}`);
    } finally {
      setIsPreparingInterview(false);
    }
  };

  const handleSubmitAnswer = useCallback(async () => {
    if (callStatus !== CallStatus.ACTIVE) return;

    stopRecognition();

    const answer = (manualAnswer.trim() || voiceTranscript.trim()).replace(/\s+/g, " ").trim();
    if (!answer) {
      toast.info("Record or type an answer before continuing.");
      return;
    }

    const question = sessionQuestions[currentQuestionIndex];
    setStage(InterviewStage.PROCESSING);
    setManualAnswer("");
    setVoiceTranscript("");
    appendMessage("user", answer);

    const acknowledgement = await getAcknowledgement({
      question,
      answer,
      index: currentQuestionIndex + 1,
      total: sessionQuestions.length,
    });

    appendMessage("assistant", acknowledgement);
    await speakText(acknowledgement);

    if (stopRequestedRef.current) return;

    const nextQuestion = currentQuestionIndex + 1;
    if (nextQuestion >= sessionQuestions.length) {
      await concludeInterview(false);
      return;
    }

    await askQuestion(nextQuestion, sessionQuestions);
  }, [
    appendMessage,
    askQuestion,
    callStatus,
    concludeInterview,
    currentQuestionIndex,
    getAcknowledgement,
    manualAnswer,
    sessionQuestions,
    speakText,
    stopRecognition,
    voiceTranscript,
  ]);

  const handleToggleRecognition = useCallback(() => {
    if (callStatus !== CallStatus.ACTIVE) return;

    if (isRecognitionActive) {
      stopRecognition();
      return;
    }

    setStage(InterviewStage.LISTENING);
    const started = startRecognition();
    if (!started) {
      toast.info("Voice input unavailable. Type your answer and submit.");
    }
  }, [callStatus, isRecognitionActive, startRecognition, stopRecognition]);

  const handleDisconnect = useCallback(async () => {
    if (callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED) {
      return;
    }

    await concludeInterview(true);
  }, [callStatus, concludeInterview]);

  const isCallButtonDisabled =
    isPreparingInterview || isGeneratingFeedback || callStatus === CallStatus.CONNECTING;

  const callButtonLabel =
    isPreparingInterview
      ? "Preparing..."
      : callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED
        ? "Start Interview"
        : ". . .";

  const answeredCount = messages.filter((message) => message.role === "user").length;
  const totalQuestions = sessionQuestions.length;
  const progressPercent = totalQuestions
    ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100))
    : 0;

  const activeQuestion = sessionQuestions[currentQuestionIndex] || "";
  const canSubmitAnswer = callStatus === CallStatus.ACTIVE && stage !== InterviewStage.PROCESSING;
  const canUseMic = canSubmitAnswer && supportsSpeechRecognition;

  return (
    <>
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="profile-image"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>
         {/* User Profile Card */}
        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex flex-col items-center gap-4">
        {/* Pre-call form and question preview (only when not active) */}
        {isGenerateMode && callStatus !== CallStatus.ACTIVE && (
          <div className="form w-full max-w-xl p-4 border rounded-md bg-white/5">
            <h4 className="mb-2 font-semibold">Enter interview details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                placeholder="Role (e.g., Frontend Developer)"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                className="input"
              />
              <select value={typeInput} onChange={(e) => setTypeInput(e.target.value)} className="input">
                <option>Technical</option>
                <option>Behavioral</option>
              </select>
              <select value={levelInput} onChange={(e) => setLevelInput(e.target.value)} className="input">
                <option>Junior</option>
                <option>Mid</option>
                <option>Senior</option>
              </select>
              <input
                placeholder="Tech stack (comma-separated)"
                value={techstackInput}
                onChange={(e) => setTechstackInput(e.target.value)}
                className="input"
              />
              <input
                placeholder="Number of questions"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="input"
              />
            </div>

            <div className="flex items-center gap-2 mt-3">
              <p className="text-sm text-muted-foreground">When you start, Gemini generates personalized questions and begins a guided voice interview.</p>
            </div>
          </div>
        )}

        {callStatus === CallStatus.ACTIVE && (
          <div className="card-border w-full max-w-3xl">
            <div className="card p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
                <p className="text-light-100 text-sm">
                  Question {Math.min(currentQuestionIndex + 1, Math.max(totalQuestions, 1))} of {Math.max(totalQuestions, 1)}
                </p>
                <p className="text-light-100 text-sm capitalize">Stage: {stage.toLowerCase().replace("_", " ")}</p>
              </div>

              <div className="w-full bg-dark-200 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-primary-200 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>

              <div className="rounded-xl border border-input bg-dark-200/40 p-4">
                <p className="text-primary-100 font-semibold">Current Question</p>
                <p className="text-light-100 mt-2">{activeQuestion || "Preparing your first question..."}</p>
              </div>

              {supportsSpeechRecognition ? (
                <div className="rounded-xl border border-input bg-dark-200/40 p-4">
                  <p className="text-primary-100 font-semibold">Voice Transcript</p>
                  <p className={cn("mt-2 text-light-100 min-h-6", !voiceTranscript && "opacity-70")}>{voiceTranscript || "Start speaking or type your answer below."}</p>
                </div>
              ) : (
                <p className="text-sm text-light-100">Voice recognition is not supported in this browser. Type your answer below.</p>
              )}

              <textarea
                value={manualAnswer}
                onChange={(event) => setManualAnswer(event.target.value)}
                placeholder="Type your answer (optional if using microphone)..."
                className="input !rounded-2xl !min-h-28 resize-y"
                disabled={!canSubmitAnswer}
              />

              <div className="flex gap-3 max-sm:flex-col">
                <button
                  type="button"
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  onClick={handleToggleRecognition}
                  disabled={!canUseMic}
                >
                  {isRecognitionActive ? <MicOff size={16} /> : <Mic size={16} />}
                  {isRecognitionActive ? "Stop Listening" : "Use Microphone"}
                </button>

                <button
                  type="button"
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  onClick={() => void handleSubmitAnswer()}
                  disabled={!canSubmitAnswer}
                >
                  {stage === InterviewStage.PROCESSING ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Submit Answer
                </button>

                <button
                  type="button"
                  className="btn-disconnect flex-1 flex items-center justify-center gap-2"
                  onClick={() => void handleDisconnect()}
                  disabled={isGeneratingFeedback}
                >
                  <Square size={14} />
                  End Interview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Call buttons */}
        <div className="flex items-center">
          {callStatus !== CallStatus.ACTIVE ? (
            <button className="relative btn-call" onClick={handleStartInterview} disabled={isCallButtonDisabled}>
              <span
                className={cn(
                  "absolute animate-ping rounded-full opacity-75",
                  callStatus !== CallStatus.CONNECTING && "hidden"
                )}
              />
              <span className="relative">{callButtonLabel}</span>
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default Agent;
