import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UserProvider } from "@/context/UserContext";

export const metadata: Metadata = {
  title: "Flowstate AI",
  description: "Your performance operating system.",
  // Installable on phones via "Add to Home Screen" (standalone, full-screen).
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Flowstate", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

// Root layout: HTML shell + context providers only.
// No sidebar, no nav, no dev controls.
// Each route group (public / app) adds its own layout on top of this.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-[#0A0A0A] flex flex-col">
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
