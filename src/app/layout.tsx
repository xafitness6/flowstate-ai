import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/context/UserContext";
import { AppShell } from "@/components/layout/AppShell";
import { DevPanel } from "@/components/dev/DevPanel";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Flowstate AI",
  description: "Your performance operating system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <UserProvider>
          <AppShell>{children}</AppShell>
          <DevPanel />
        </UserProvider>
      </body>
    </html>
  );
}
