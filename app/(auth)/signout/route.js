import { NextResponse } from "next/server";
import { signOut } from "@/lib/actions/auth.action";

export async function POST() {
  try {
    // Call the server helper which revokes tokens and clears the cookie
    const result = await signOut();
    if (result?.success) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, message: "Failed to sign out" }, { status: 500 });
  } catch (e) {
    console.error("/auth/signout error:", e);
    return NextResponse.json({ success: false, message: String(e) }, { status: 500 });
  }
}
