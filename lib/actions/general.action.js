"use server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

export async function createFeedback(params){
  const { interviewId, userId, transcript, feedbackId } = params;
  console.log("Creating feedback with params:", params);
  try{
    const formattedTranscript = transcript.map(
      (sentence) => `- ${sentence.role}: ${sentence.content}\n`
    ).join("");

    const prompt = `You are an AI interviewer analyzing a mock interview. 
    Your task is to evaluate the candidate based on structured categories and produce a realistic, evidence-backed assessment. Be rigorous and honest — do not be lenient. Use the transcript provided to quote the candidate's actual answers in the feedback so the user can see exactly what went right or wrong. I am providing you the transcript of the interview.\n\nTranscript:\n${formattedTranscript}\n\n. EDGE CASE: If the transcript is empty or too short to assess, return scores of 0 where you cannot judge and clearly state in comments which areas lacked evidenc.Finally, Return a JSON object with the following shape exactly (no extra text):\n{\n  \"totalScore\": number,\n  \"categoryScores\": [\n    { \"name\": \"Communication Skills\", \"score\": number, \"comment\": string },\n    { \"name\": \"Technical Knowledge\", \"score\": number, \"comment\": string },\n    { \"name\": \"Problem Solving\", \"score\": number, \"comment\": string },\n    { \"name\": \"Cultural Fit\", \"score\": number, \"comment\": string },\n    { \"name\": \"Confidence and Clarity\", \"score\": number, \"comment\": string }\n  ],\n  \"strengths\": [string],\n  \"areasForImprovement\": [string],\n  \"finalAssessment\": string\n}\n`;

    const { text } = await generateText({
      model: google("gemini-2.0-flash-001", {
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
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
    return { success: true, feedbackId: feedbackRef.id };
  }catch(e){
    console.error("Error creating feedback:", e);
    return { success: false, message: e.message || String(e) };
  }
}

export async function getInterviewById(id){
  const interview = await db.collection("interviews").doc(id).get();
  return interview.data() || null;
}

export async function getFeedbackByInterviewId(params) {
  const { interviewId, userId } = params;

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

export async function getLatestInterviews(params) {
  const { userId, limit = 20 } = params;

  try {
    let query = db.collection("interviews").where("finalized", "==", true);

    // If userId provided, exclude their interviews; otherwise don't add the != clause
    if (userId !== undefined && userId !== null) {
      query = query.where("userId", "!=", userId);
    }

    const interviews = await query.orderBy("createdAt", "desc").limit(limit).get();

    return interviews.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (e) {
    console.error("Failed to fetch latest interviews:", e);
    return [];
  }
}

export async function getInterviewsByUserId(userId) {
  if (userId === undefined || userId === null) {
    console.warn("getInterviewsByUserId called with undefined userId");
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