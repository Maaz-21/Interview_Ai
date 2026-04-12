import { NextResponse } from "next/server";

import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";

export async function PATCH(req, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Interview id is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const isPublic = Boolean(body?.isPublic);
    const isAnonymous = body?.isAnonymous === undefined
      ? true
      : Boolean(body.isAnonymous);

    const interviewRef = db.collection("interviews").doc(id);
    const interviewDoc = await interviewRef.get();

    if (!interviewDoc.exists) {
      return NextResponse.json(
        { success: false, message: "Interview not found" },
        { status: 404 }
      );
    }

    const interview = interviewDoc.data();
    if (interview?.userId !== user.id) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    await interviewRef.set(
      {
        isPublic,
        isAnonymous,
        visibilityUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      interviewId: id,
      isPublic,
      isAnonymous,
    });
  } catch (error) {
    console.error("Failed to update interview visibility:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to update visibility",
      },
      { status: 500 }
    );
  }
}