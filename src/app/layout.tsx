import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/context/UserContext";

// Real premium typography. Inter for body — gold-standard UI sans, optimised
// at every weight. Instrument Serif for display moments (greetings, page
// titles, hero numerals) — the editorial soul Hampton / Aesop / member-club
// apps use to lift dark surfaces into "considered". Both via next/font so
// they're self-hosted, preloaded, and FOIT-free.
const inter = Inter({
  subsets:  ["latin"],
  display:  "swap",
  variable: "--font-sans",
});
const instrumentSerif = Instrument_Serif({
  weight:   "400",
  style:    ["normal", "italic"],
  subsets:  ["latin"],
  display:  "swap",
  variable: "--font-display",
});

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
    <html lang="en" className={`dark h-full antialiased ${inter.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-full bg-[#0A0A0A] flex flex-col font-sans">
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
