import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function GET(){
   return Response.json({success: true, data: "Interview Question Generator API"}, {status: 200}); 
}

export async function POST(req){
    try {
        const body = await req.json();
        console.log("🎯 API ROUTE - Raw request body:", JSON.stringify(body, null, 2));
            // Handle direct API call format
        let extractedData = body;
        console.log("📦 Direct API call - extracted data:", extractedData);
        const {type, role, level, techstack, amount, userid } = extractedData;

        // Validate required fields
        if (!type || !role || !level || !techstack || !amount) {
            const errorMsg = `You must provide: ${!type ? 'type ' : ''}${!role ? 'role ' : ''}${!level ? 'level ' : ''}${!techstack ? 'techstack ' : ''}${!amount ? 'amount' : ''}`;
           return Response.json({
                    success: false,
                    message: `Missing required fields, ${errorMsg}`
      });
        }
        // Generate questions using Gemini AI
        const { text } = await generateText({
            model: google("gemini-2.0-flash-001", {
                apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
            }),
            prompt: `Generate interview questions for a job interview.
                Role: ${role}
                Experience Level: ${level}
                Interview Type: ${type} (focus more on this type)
                Tech Stack: ${techstack}
                Number of Questions: ${amount}
                
                Instructions:
                - Return ONLY the questions in a JSON array format
                - No additional text or formatting
                - Questions should be clear and suitable for voice conversation
                - Avoid special characters that might break voice synthesis
                - Mix of practical and conceptual questions
                - Appropriate difficulty for ${level} level
                
                Format: ["Question 1", "Question 2", "Question 3"]
            `,
        });

        // Clean the response - remove markdown code blocks if present
        let cleaned = text.trim().replace(/^```json\s*/i, "")
                                 .replace(/^```\s*/i, "")
                                 .replace(/\s*```$/i, "");

        const questions = JSON.parse(cleaned);
        console.log("✅ Generated Questions:", questions);
        // Save to database (only if not a VAPI tool call or if userid is provided)
        let interviewRef = null;
        if (userid) {
            const interview = {
                role: role,
                type: type,
                level: level,
                techstack: techstack.split(","),
                questions: questions,
                userId: userid || "voice-generated",
                finalized: true,
                coverImage: getRandomInterviewCover(),
                createdAt: new Date().toISOString(),
            };
            interviewRef = await db.collection("interviews").add(interview);
            console.log("💾 Saved interview to database with ID:", interviewRef.id);
        }
        // Return appropriate response format and InterviewId
        return Response.json({
                success: true,
                interviewId: interviewRef.id,
                questions,
                result: `Generated ${questions.length} ${type.toLowerCase()} questions for ${role}.`,
            });
    } catch(e){
        console.error("❌ Error:", e);
        return Response.json({
                success: false,
                message: e.message || "Failed to generate questions",
            }, { status: 500 });
    }
}