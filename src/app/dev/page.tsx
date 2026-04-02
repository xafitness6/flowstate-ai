"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DevPanel } from "@/components/dev/DevPanel";

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";

function DevPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    try {
      const role     = localStorage.getItem(LS_KEY) || sessionStorage.getItem(SS_KEY);
      const devParam = searchParams.get("dev") === "true";
      if (role === "master" || devParam) {
        setAllowed(true);
      } else {
        router.replace("/");
      }
    } catch {
      router.replace("/");
    }
  }, [router, searchParams]);

  if (!allowed) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12 text-white">
      <div className="max-w-sm w-full space-y-6">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-white/22 mb-1">Internal</p>
          <h1 className="text-xl font-semibold tracking-tight">Dev Tools</h1>
          <p className="text-xs text-white/30 mt-1">Testing controls. Not visible to users.</p>
        </div>
        <DevPanel forceOpen />
      </div>
    </div>
  );
}

export default function DevPage() {
  return (
    <Suspense>
      <DevPageInner />
    </Suspense>
  );
}
