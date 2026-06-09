import { AppShell } from "@/components/layout/AppShell";
import { ActivityPing } from "@/components/layout/ActivityPing";
import { TasksBadgeProvider } from "@/context/TasksBadgeContext";

// Authenticated app layout.
// Every route inside (app)/ gets the full sidebar + topbar + bottom nav.
// No dev controls. No public access. Guards are in each page.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TasksBadgeProvider>
      <AppShell>
        <ActivityPing />
        {/* DailyCheckInPopup intentionally not mounted — it duplicated the
            on-page CoachTaskList checklist. Revisit the check-in flow later. */}
        {children}
      </AppShell>
    </TasksBadgeProvider>
  );
}
