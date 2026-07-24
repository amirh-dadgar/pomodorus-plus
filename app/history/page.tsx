import { AppHeader } from "@/components/app-header";
import { History } from "@/components/history";

export default function HistoryPage() {
  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <History />
    </main>
  );
}
