import Agent from "@/components/Agent";
import { getCurrentUser } from "@/lib/actions/auth.action";

const Page = async () => {
  const user = await getCurrentUser();

  return (
    <>
      <h3>Choose Your Interview Mode</h3>
      <p className="text-light-100">Select Mode 1 (Guided Voice) or Mode 2 (Gemini Live Realtime) before starting.</p>
      <Agent
        userName={user?.name}
        userId={user?.id}
        profileImage={user?.profileURL}
        type="generate"
      />
    </>
  );
};

export default Page;
