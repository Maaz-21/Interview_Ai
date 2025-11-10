"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Button} from "@/components/ui/button";
import { auth } from "@/firebase/client";
import { signOut as firebaseSignOut } from "firebase/auth";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
        try {
          await firebaseSignOut(auth);
        } catch (clientSignOutErr) {
          console.warn("firebase client signOut failed:", clientSignOutErr);
        }
      // POST to the signout route. The route in this repo is mounted at `/signout` (not `/auth/signout`).
      const res = await fetch("/signout", { method: "POST" });

      // Some handlers may return JSON; others may return a redirect HTML page. Don't assume JSON.
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        try {
          await res.json();
        } catch (e) {
          // ignore parse errors
        }
      }

      // Navigate to sign-in regardless of response body
      router.push("/sign-in");
    } catch (e) {
      console.error("Logout error:", e);
      router.push("/sign-in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      className="btn-secondary text-sm px-3 py-1 rounded"
      aria-label="Sign out"
      disabled={loading}
    >
      {loading ? "Signing out..." : "Sign out"}
    </Button>
  );
}
