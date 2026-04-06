"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { completeProfileSetup } from "@/lib/onboarding";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";
const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

function getActiveUserId(): string {
  try {
    const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY) || "";
    return ROLE_TO_USER_ID[key] ?? (key.startsWith("usr_") ? key : "anonymous");
  } catch { return "anonymous"; }
}

function saveProfileData(userId: string, avatar: string | null, bio: string) {
  try {
    const key = `flowstate-profile-${userId}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? "{}");
    localStorage.setItem(key, JSON.stringify({ ...existing, avatar, bio }));
  } catch { /* ignore */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileSetupPage() {
  const router       = useRouter();
  const fileRef      = useRef<HTMLInputElement>(null);

  const [avatar,     setAvatar]     = useState<string | null>(null);
  const [bio,        setBio]        = useState("");
  const [completing, setCompleting] = useState(false);
  const [userId,     setUserId]     = useState("anonymous");

  useEffect(() => {
    setUserId(getActiveUserId());
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatar(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleComplete() {
    setCompleting(true);
    saveProfileData(userId, avatar, bio.trim());
    completeProfileSetup(userId);
    router.replace("/dashboard");
  }

  function handleSkip() {
    completeProfileSetup(userId);
    router.replace("/dashboard");
  }

  const initials = userId.startsWith("usr_")
    ? "?"
    : userId.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-16 text-white">
      <div className="w-full max-w-sm space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/25">Almost there</p>
          <h1 className="text-2xl font-semibold tracking-tight">Set up your profile</h1>
          <p className="text-sm text-white/40 leading-relaxed">
            Add a photo and a short bio so others know who you are.
          </p>
        </div>

        {/* Avatar upload */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "relative w-24 h-24 rounded-full overflow-hidden border-2 transition-all",
              avatar
                ? "border-[#B48B40]/40 hover:border-[#B48B40]/70"
                : "border-white/10 hover:border-white/25 bg-white/[0.03]"
            )}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                <Camera className="w-5 h-5 text-white/25" strokeWidth={1.5} />
                <span className="text-[10px] text-white/20">Add photo</span>
              </div>
            )}

            {/* Hover overlay */}
            {avatar && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white/70" strokeWidth={1.5} />
              </div>
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {avatar && (
            <button
              type="button"
              onClick={() => setAvatar(null)}
              className="text-xs text-white/22 hover:text-white/45 transition-colors"
            >
              Remove photo
            </button>
          )}
        </div>

        {/* Bio */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
            Short bio
            <span className="ml-2 normal-case tracking-normal text-white/20">optional</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={160}
            placeholder="Tell people what drives you…"
            className="w-full bg-white/[0.04] border border-white/8 focus:border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/18 outline-none transition-all resize-none leading-relaxed"
          />
          <p className="text-[10px] text-white/20 text-right">{bio.length} / 160</p>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <button
            onClick={handleComplete}
            disabled={completing}
            className={cn(
              "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200",
              completing
                ? "bg-white/5 text-white/25 cursor-default"
                : "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
            )}
          >
            {completing ? "Entering app…" : "Complete setup"}
            {!completing && <ArrowRight className="w-4 h-4" strokeWidth={2} />}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1"
          >
            Skip for now
          </button>
        </div>

      </div>
    </div>
  );
}
