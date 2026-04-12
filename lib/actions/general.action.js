"use server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";
import { getCurrentUser } from "@/lib/actions/auth.action";

const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";

export async function createFeedback(params){
  const { interviewId, userId, transcript, feedbackId } = params;
  try{
    if (!geminiApiKey) {
      return { success: false, message: "Missing GOOGLE_GENERATIVE_AI_API_KEY" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.id !== userId) {
      return { success: false, message: "Unauthorized feedback request" };
    }

    const interviewDoc = await db.collection("interviews").doc(interviewId).get();
    if (!interviewDoc.exists) {
      return { success: false, message: "Interview not found" };
    }

    const interviewData = interviewDoc.data();
    if (interviewData?.userId !== userId) {
      return { success: false, message: "You can only score your own interview" };
    }

    const formattedTranscript = transcript.map(
      (sentence) => `- ${sentence.role}: ${sentence.content}\n`
    ).join("");

    const prompt = `You are an AI interviewer analyzing a mock interview. 
    Your task is to evaluate the candidate based on structured categories and produce a realistic, evidence-backed assessment. Be rigorous and honest — do not be lenient. Use the transcript provided to quote the candidate's actual answers in the feedback so the user can see exactly what went right or wrong. I am providing you the transcript of the interview.\n\nTranscript:\n${formattedTranscript}\n\n. EDGE CASE: If the transcript is empty or too short to assess, return scores of 0 where you cannot judge and clearly state in comments which areas lacked evidenc.Finally, Return a JSON object with the following shape exactly (no extra text):\n{\n  \"totalScore\": number,\n  \"categoryScores\": [\n    { \"name\": \"Communication Skills\", \"score\": number, \"comment\": string },\n    { \"name\": \"Technical Knowledge\", \"score\": number, \"comment\": string },\n    { \"name\": \"Problem Solving\", \"score\": number, \"comment\": string },\n    { \"name\": \"Cultural Fit\", \"score\": number, \"comment\": string },\n    { \"name\": \"Confidence and Clarity\", \"score\": number, \"comment\": string }\n  ],\n  \"strengths\": [string],\n  \"areasForImprovement\": [string],\n  \"finalAssessment\": string\n}\n`;

    const { text } = await generateText({
      model: google(geminiModel, {
        apiKey: geminiApiKey,
      }),
      prompt,
      temperature: 0.0,
      max_output_tokens: 1024,
    });

    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    let object;
    try {
      object = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse feedback JSON from model:", cleaned, parseErr);
      return { success: false, message: "Failed to parse AI response" };
    }

    // Validate shape with zod schema if available
    try {
      feedbackSchema.parse(object);
    } catch (validationErr) {
      console.error("Feedback schema validation failed:", validationErr, object);
      return { success: false, message: "AI returned invalid feedback shape" };
    }

    const feedback = {
      interviewId,
      userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };
    let feedbackRef;
    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }
    await feedbackRef.set(feedback);

    await db.collection("interviews").doc(interviewId).set(
      {
        totalScore: feedback.totalScore,
        lastFeedbackId: feedbackRef.id,
        lastFeedbackAt: feedback.createdAt,
      },
      { merge: true }
    );

    return { success: true, feedbackId: feedbackRef.id };
  }catch(e){
    console.error("Error creating feedback:", e);
    return { success: false, message: e.message || String(e) };
  }
}

export async function getInterviewById(id){
  const interview = await db.collection("interviews").doc(id).get();
  if (!interview.exists) return null;

  const data = interview.data();
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const isOwner = data?.userId === currentUser.id;
  const isPublic = data?.isPublic === true;

  if (!isOwner && !isPublic) return null;

  return data || null;
}

export async function getFeedbackByInterviewId(params) {
  const { interviewId, userId } = params;

  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== userId) return null;

  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() };
}

export async function getInterviewsByUserId(userId) {
  if (userId === undefined || userId === null) {
    console.warn("getInterviewsByUserId called with undefined userId");
    return [];
  }

  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.id !== userId) {
    console.warn("Blocked attempt to fetch interviews for another user");
    return [];
  }

  const interviews = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function getTopScoringInterviews({ limit = 6 } = {}) {
  try {
    // Query interviews by score and only surface those explicitly shared.
    const interviewSnapshot = await db
      .collection("interviews")
      .orderBy("totalScore", "desc")
      .limit(Math.max(limit * 3, limit))
      .get();

    if (interviewSnapshot.empty) return [];

    const results = [];
    for (const doc of interviewSnapshot.docs) {
      const data = doc.data();

      if (!data?.isPublic || !data?.finalized || typeof data?.totalScore !== "number") {
        continue;
      }

      const publicRole = data?.role || "Unknown";
      const publicType = data?.type || "General";
      const publicTechStack = Array.isArray(data?.techstack) ? data.techstack : [];
      const publicCover = data?.coverImage || "/covers/adobe.png";
      const isAnonymous = data?.isAnonymous !== false;

      results.push({
        feedbackId: data.lastFeedbackId || null,
        interviewId: doc.id,
        totalScore: data.totalScore,
        createdAt: data.lastFeedbackAt || data.createdAt || null,
        interview: {
          id: doc.id,
          role: publicRole,
          type: publicType,
          techstack: publicTechStack,
          coverImage: publicCover,
          createdAt: data.createdAt || null,
          isPublic: true,
          isAnonymous,
        },
      });

      if (results.length >= limit) break;
    }

    return results;
  } catch (e) {
    console.error("Failed to fetch top scoring interviews:", e);
    return [];
  }
}