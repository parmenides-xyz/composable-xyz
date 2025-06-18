"use client";

import { StoryProtocol } from "@/components/story-protocol";

export default function StoryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 p-6">
      <StoryProtocol />
    </div>
  );
}