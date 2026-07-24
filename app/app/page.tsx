import { AppHeader } from "@/components/app-header";
import { TimerApp } from "@/components/timer-app";

export default function TimerPage() {
  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <TimerApp />
    </main>
  );
}
