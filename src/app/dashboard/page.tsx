"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /dashboard is an alias — redirect to the root home dashboard.
export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return null;
}
