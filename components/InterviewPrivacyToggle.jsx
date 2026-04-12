"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function InterviewPrivacyToggle({
  interviewId,
  initialIsPublic = false,
  initialIsAnonymous = true,
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(Boolean(initialIsPublic));
  const [isAnonymous, setIsAnonymous] = useState(Boolean(initialIsAnonymous));
  const [isSaving, setIsSaving] = useState(false);

  const saveVisibility = async () => {
    if (isSaving) return;

    setIsSaving(true);
    const loadingId = toast.loading("Saving sharing preferences...");

    try {
      const response = await fetch(`/api/interviews/${interviewId}/visibility`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isPublic,
          isAnonymous,
        }),
      });

      const data = await response.json();
      toast.dismiss(loadingId);

      if (!response.ok || !data?.success) {
        toast.error(data?.message || "Could not update sharing preferences.");
        return;
      }

      toast.success("Sharing preferences updated.");
      router.refresh();
    } catch (error) {
      toast.dismiss(loadingId);
      toast.error(error?.message || "Failed to save sharing preferences.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card-border w-full">
      <div className="card p-4 flex flex-col gap-4">
        <h3 className="text-xl">Leaderboard Privacy</h3>

        <label className="flex items-center gap-3 text-light-100">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
          />
          Share this interview score on the public leaderboard
        </label>

        <label className="flex items-center gap-3 text-light-100">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(event) => setIsAnonymous(event.target.checked)}
            disabled={!isPublic}
          />
          Show as anonymous profile
        </label>

        <Button
          type="button"
          className="btn-primary w-fit"
          onClick={saveVisibility}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save Privacy Settings"}
        </Button>
      </div>
    </div>
  );
}

export default InterviewPrivacyToggle;