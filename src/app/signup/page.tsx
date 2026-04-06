"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Signup has been consolidated into /login (Create Account tab).
// Role selection is at /welcome. This redirect preserves any old links.
export default function SignupRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/welcome"); }, [router]);
  return <div className="min-h-screen bg-[#0A0A0A]" />;
}
