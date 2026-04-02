import { AppShell } from "@/components/layout/AppShell";

// Authenticated app layout.
// Every route inside (app)/ gets the full sidebar + topbar + bottom nav.
// No dev controls. No public access. Guards are in each page.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
