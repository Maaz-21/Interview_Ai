"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { createInterviewAssistant } from "@/constants/index";
import { createFeedback } from "@/lib/actions/general.action";

const CallStatus = {
  INACTIVE: "INACTIVE",
  CONNECTING: "CONNECTING",
  ACTIVE: "ACTIVE",
  FINISHED: "FINISHED",
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
  const [messages, setMessages] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [createdInterviewId, setCreatedInterviewId] = useState(interviewId || null);
  // Pre-call form state
  const [roleInput, setRoleInput] = useState("");
  const [typeInput, setTypeInput] = useState("Technical");
  const [levelInput, setLevelInput] = useState("Junior");
  const [techstackInput, setTechstackInput] = useState("");
  const [amountInput, setAmountInput] = useState("5");
  const [preGeneratedQuestions, setPreGeneratedQuestions] = useState(questions || null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Event handlers
    const onCallStart = () => setCallStatus(CallStatus.ACTIVE);
    const onCallEnd = () => setCallStatus(CallStatus.FINISHED);
    
    const onMessage = (message) => {
      // Handle transcript messages
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);
        
        // Check for interview completion keywords to auto-end call
        if (message.role === "assistant" && message.transcript) {
          const transcript = message.transcript.toLowerCase();
          if (transcript.includes("thank you for completing") || 
              transcript.includes("good luck with your interview") ||
              transcript.includes("best of luck")) {
            // Wait 1 second then end the call
            setTimeout(() => {
              vapi.stop();
            }, 1000);
          }
        }
      }
    };
    
    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);
    const onError = (err) => console.error("VAPI Error:", err);

    // Subscribe to events
    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    // Cleanup
    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, []);

  const handleGenerateFeedback = async (messages, interviewIdToUse) => {
    console.log("handleGenerateFeedback", interviewIdToUse);

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
        transcript: messages,
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
  };

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }

    if (callStatus === CallStatus.FINISHED) {
      console.log(interviewId, userId);
      // Wait for feedback to be created before redirecting. Prefer the created interview id
      const interviewIdToUse = createdInterviewId || interviewId;
      (async () => {
        await handleGenerateFeedback(messages, interviewIdToUse);
      })();
    }
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);
    try {
      // Validate inputs
      if (!roleInput || !typeInput || !levelInput || !techstackInput || !amountInput) {
        alert("Please fill all pre-call details before starting the call.");
        setCallStatus(CallStatus.INACTIVE);
        return;
      }
      setIsGenerating(true);
      // Call the generator route to obtain questions
      const payload = {
        role: roleInput,
        type: typeInput,
        level: levelInput,
        techstack: techstackInput,
        amount: amountInput,
        userid: userId || "voice-user",
      };
      const res = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const interviewIdFromServer = data.interviewId;
      if (!data.success || !data.questions) {
        console.error("Question generation failed:", data);
        alert(data.message || "Failed to generate questions. Check server logs.");
        setCallStatus(CallStatus.INACTIVE);
        return;
      }

      // Store questions internally (do not show in UI) and start the assistant with them
      setPreGeneratedQuestions(data.questions);
      // Capture interview id created server-side so we can link feedback later
      if (interviewIdFromServer) {
        setCreatedInterviewId(interviewIdFromServer);
      }

      const interviewAssistant = createInterviewAssistant(userId, data.questions);
      await vapi.start(interviewAssistant);
    } catch (err) {
      console.error("Failed to start VAPI call:", err);
      setCallStatus(CallStatus.INACTIVE);
      alert(`Failed to start interview: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };


  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

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
        {callStatus !== CallStatus.ACTIVE && (
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
              <p className="text-sm text-muted-foreground">When you click Call, questions will be generated and the assistant will begin the interview.</p>
            </div>

            {/* Note: generated questions are not shown in the UI by design. They are sent directly to the assistant when starting the call. */}
          </div>
        )}

        {/* Call buttons */}
        <div className="flex items-center">
          {callStatus !== CallStatus.ACTIVE ? (
            <button className="relative btn-call" onClick={handleCall}>
              <span
                className={cn(
                  "absolute animate-ping rounded-full opacity-75",
                  callStatus !== CallStatus.CONNECTING && "hidden"
                )}
              />
              <span className="relative">{callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED ? "Call" : ". . ."}</span>
            </button>
          ) : (
            <button className="btn-disconnect" onClick={handleDisconnect}>
              End
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default Agent;
