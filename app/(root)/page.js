import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import InterviewCard from '@/components/InterviewCard';
import { getCurrentUser } from '@/lib/actions/auth.action';
import {getInterviewsByUserId, getLatestInterviews } from '@/lib/actions/general.action';

async function HomePage() {
  const user = await getCurrentUser();
  const [userInterviews, latestInterviews] = await Promise.all([
    getInterviewsByUserId(user?.id),
    getLatestInterviews({ userId: user?.id })
  ]);
  const hasPastInterviews = userInterviews?.length > 0;
  const hasUpcomingInterviews = latestInterviews?.length > 0;

  return (
    <>
    <section className='card-cta'>
      <div className='flex flex-col gap-6 max-w-lg'>
        <h2>Get Interview Ready with AI-Powered Practice</h2>
        <p>Practice on real interview questions with instant feedback.</p>
        <Button asChild className='btn-primary max-sm:w-full'>
          <Link href="/interview">Start an Interview</Link>
        </Button>
      </div>
      <Image src="/robot.png" alt="robo-dude" width={400} height={400} className="max-sm:hidden" style={{ width: "auto", height: "auto" }} />
    </section>
    <section className="flex flex-col gap-6 mt-8">
      <h2>Your Interviews</h2>
      <div className="interviews-section">
        { hasPastInterviews ? (
          userInterviews.map((interview) => (
            <InterviewCard key={interview.id} interview={interview} />
          ))
        ) :  (
          <p> You haven't taken any interviews yet.</p>
        )}
      </div>
    </section>
    <section className='flex flex-col gap-6 mt-8'>
      <h2>Top Scoring Interviews</h2>
      <div className='interviews-section'> 
        { hasUpcomingInterviews ? (
          latestInterviews.map((interview) => (
            <InterviewCard key={interview.id} interview={interview} />
          ))
        ) :  (
          <p> There are no upcoming interviews available.</p>
        )}
      </div>
    </section>
    </>
  );
}
export default HomePage;
