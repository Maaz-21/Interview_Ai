import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import DisplayTechIcons from "./DisplayTechIcons";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";
// Helper function to get badge color based on type
const getBadgeColor = (type) => {
  const colors = {
    Technical: "bg-blue-500",
    Behavioral: "bg-green-500",
    Mixed: "bg-purple-500",
    General: "bg-gray-500",
  };
  return colors[type] || "bg-gray-500";
};

async function InterviewCard({ interview, score = null, disableFeedbackLookup = false }) {
  // Destructure interview properties
  const {
    id,
    userId,
    role,
    type,
    techstack = [],
    createdAt,
    coverImage,
  } = interview;

  // Get normalized values
  const normalizedType = type || "General";
  const badgeColor = getBadgeColor(normalizedType);
  const feedback =
    !disableFeedbackLookup && userId && id
      ? await getFeedbackByInterviewId({ interviewId: id, userId })
      : null;

  const scoreValue = typeof score === "number" ? score : feedback?.totalScore;
  const formattedDate = dayjs(feedback?.createdAt || createdAt || Date.now()).format('MMM D, YYYY');
  const cardHref = feedback && !disableFeedbackLookup ? `/interview/${id}/feedback` : `/interview/${id}`;
  const cardDescription = feedback?.finalAssessment
    || (disableFeedbackLookup
      ? "This interview is shared publicly by the candidate."
      : "You haven't taken this interview yet. Take it now to improve your skills.");

  return (
    <div className="card-border w-[360px] max-sm:w-full min-h-96">
      <div className="card-interview">
        <div>
          {/* Type Badge */}
          <div
            className={cn(
              "absolute top-0 right-0 w-fit px-4 py-2 rounded-bl-lg bg-light-600",
              badgeColor
            )}
          >
            <p className="badge-text ">{normalizedType}</p>
          </div>

          {/* Cover Image */}
          <Image
            src={coverImage || "/covers/adobe.png"}
            alt="cover-image"
            width={90}
            height={90}
            className="rounded-full object-cover size-[90px]"
            style={{ width: "auto", height: "auto" }}
          />

          {/* Interview Role */}
          <h3 className="mt-5 capitalize">{role} Interview</h3>

          {/* Date & Score */}
          <div className="flex flex-row gap-5 mt-3">
            <div className="flex flex-row gap-2">
              <Image
                src="/calendar.svg"
                width={22}
                height={22}
                alt="calendar"
                style={{ width: 'auto', height: 'auto' }}
              />
              <p>{formattedDate}</p>
            </div>

            <div className="flex flex-row gap-2 items-center">
              <Image src="/star.svg" width={22} height={22} alt="star" style={{ width: 'auto', height: 'auto' }} />
              <p>{scoreValue ?? "---"}/50</p>
            </div>
          </div>

          {/* Feedback or Placeholder Text */}
          <p className="line-clamp-2 mt-5">
            {cardDescription}
          </p>
        </div>

        <div className="flex flex-row justify-between">
          <DisplayTechIcons techStack={techstack} />

          <Button className="btn-primary">
            <Link href={cardHref}>
              {feedback && !disableFeedbackLookup ? "Check Feedback" : "View Interview"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InterviewCard;
