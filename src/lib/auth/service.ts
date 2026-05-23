"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { mark as authMark, trace as authTrace } from "@/lib/authTrace";
import { createClient } from "@/lib/supabase/client";

export type AuthFailureKind = "timeout" | "invalid" | "retryable";

export type AuthFailure = {
  kind: AuthFailureKind;
  message: string;
  raw: string;
};

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthFailure };

export type RecoveryVerifyResult =
  | { kind: "ok" }
  | { kind: "timeout"; message: string }
  | { kind: "invalid"; message: string };

const DEFAULT_TIMEOUT_MS = 10_000;
const RECOVERY_SESSION_READY_KEY = "flowstate:recovery-session-ready";
const PASSWORD_SESSION_TYPES = new Set(["recovery"]);

let recoveryVerification:
  | { signature: string; promise: Promise<RecoveryVerifyResult> }
  | null = null;

function rawMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : String(message ?? "");
  }
  return String(error);
}

function urlHashParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
}

function urlParam(url: URL, name: string): string | null {
  return url.searchParams.get(name) ?? urlHashParams(url).get(name);
}

function markRecoverySessionReady() {
  try {
    window.sessionStorage.setItem(RECOVERY_SESSION_READY_KEY, "true");
  } catch {
    // Ignore storage failures. The verified Supabase session is still enough.
  }
}

function clearRecoverySessionReady() {
  try {
    window.sessionStorage.removeItem(RECOVERY_SESSION_READY_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function isRecoverySessionReady(): boolean {
  try {
    return window.sessionStorage.getItem(RECOVERY_SESSION_READY_KEY) === "true";
  } catch {
    return false;
  }
}

function cleanRecoveryUrl() {
  window.history.replaceState({}, "", "/reset-password");
}

function isPasswordSessionType(type: string | null): boolean {
  return !type || PASSWORD_SESSION_TYPES.has(type);
}

export function redirectPasswordSessionToReset(urlString = window.location.href): boolean {
  const url = new URL(urlString);
  if (url.pathname === "/reset-password") return false;

  const type = urlParam(url, "type");
  if (!type || !PASSWORD_SESSION_TYPES.has(type)) return false;

  const hasPasswordSessionPayload = Boolean(
    urlParam(url, "access_token") ||
    urlParam(url, "refresh_token") ||
    urlParam(url, "code") ||
    urlParam(url, "token_hash") ||
    urlParam(url, "error") ||
    urlParam(url, "error_description")
  );
  if (!hasPasswordSessionPayload) return false;

  window.location.replace(`/reset-password${url.search}${url.hash}`);
  return true;
}

function timeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label}_timeout`));
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function friendlyAuthMessage(raw: string, fallback = "Something went wrong. Try again."): string {
  const normalized = raw.toLowerCase();

  if (!normalized) return fallback;
  if (
    normalized.includes("lock broken") ||
    normalized.includes("lockmanager") ||
    normalized.includes("steal")
  ) {
    return "That password session was interrupted. Refresh this page and try again, or request a fresh link.";
  }
  if (normalized.includes("_timeout") || normalized.includes("timed out")) {
    return "This is taking longer than expected. Check your connection and try again.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  if (
    normalized.includes("expired") ||
    normalized.includes("token") ||
    normalized.includes("otp") ||
    normalized.includes("invalid grant") ||
    normalized.includes("invalid or has expired")
  ) {
    return "This link is invalid or has expired. Request a new link to continue.";
  }
  if (normalized.includes("weak password") || normalized.includes("password should be")) {
    return "Password must be at least 8 characters.";
  }
  if (normalized.includes("already registered") || normalized.includes("user already registered")) {
    return "An account with that email already exists. Sign in or use forgot password.";
  }

  return fallback;
}

function classifyAuthFailure(raw: string, fallback?: string): AuthFailure {
  const normalized = raw.toLowerCase();
  const message = friendlyAuthMessage(raw, fallback);
  if (normalized.includes("_timeout") || normalized.includes("timed out")) {
    return { kind: "timeout", message, raw };
  }
  if (
    normalized.includes("lock broken") ||
    normalized.includes("lockmanager") ||
    normalized.includes("steal")
  ) {
    return { kind: "retryable", message, raw };
  }
  return { kind: "invalid", message, raw };
}

function resultError(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  const error = (value as { error?: unknown }).error;
  return error ? rawMessage(error) : null;
}

export async function safeAuth<T>(
  label: string,
  call: () => PromiseLike<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fallbackMessage?: string,
): Promise<AuthResult<T>> {
  try {
    const data = await authTrace(
      label,
      () => timeout(call(), timeoutMs, label),
      { isError: resultError },
    );

    const embeddedError = resultError(data);
    if (embeddedError) {
      return { ok: false, error: classifyAuthFailure(embeddedError, fallbackMessage) };
    }

    return { ok: true, data };
  } catch (error) {
    const raw = rawMessage(error);
    authMark(label, `handled error: ${raw}`);
    return { ok: false, error: classifyAuthFailure(raw, fallbackMessage) };
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  return safeAuth(
    "auth.signInWithPassword",
    () => supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    }),
    10_000,
    "Incorrect email or password.",
  );
}

export async function signUpWithPassword(args: {
  email: string;
  password: string;
  redirectTo: string;
  metadata: Record<string, unknown>;
}) {
  const supabase = createClient();
  return safeAuth(
    "auth.signUp",
    () => supabase.auth.signUp({
      email: normalizeEmail(args.email),
      password: args.password,
      options: {
        emailRedirectTo: args.redirectTo,
        data: args.metadata,
      },
    }),
    12_000,
    "Could not create this account. Try again.",
  );
}

export async function sendPasswordReset(email: string, redirectTo: string) {
  const supabase = createClient();
  return safeAuth(
    "auth.resetPasswordForEmail",
    () => supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo }),
    10_000,
    "Could not send the reset link. Try again.",
  );
}

async function runRecoveryVerification(urlString: string): Promise<RecoveryVerifyResult> {
  const url = new URL(urlString);
  const code = urlParam(url, "code");
  const tokenHash = urlParam(url, "token_hash");
  const type = urlParam(url, "type");
  const accessToken = urlParam(url, "access_token");
  const refreshToken = urlParam(url, "refresh_token");
  const urlError = urlParam(url, "error_description") || urlParam(url, "error");
  const hasLinkCredentials = Boolean(code || tokenHash || (accessToken && refreshToken));
  const supabase = createClient();

  authMark(
    "auth.verifyRecoveryLink",
    [
      `code=${!!code}`,
      `tokenHash=${!!tokenHash}`,
      `hashSession=${!!(accessToken && refreshToken)}`,
      `type=${type ?? "-"}`,
      `err=${urlError ?? "-"}`,
    ].join(" "),
  );

  if (urlError) {
    return { kind: "invalid", message: friendlyAuthMessage(urlError) };
  }

  if (!isPasswordSessionType(type)) {
    return {
      kind: "invalid",
      message: "This link is not a password setup link. Open the newest invite or reset email.",
    };
  }

  const existingSession = await safeAuth(
    "auth.recovery.getSession",
    () => supabase.auth.getSession(),
    8_000,
  );
  if (
    existingSession.ok &&
    existingSession.data.data.session &&
    !hasLinkCredentials &&
    isRecoverySessionReady()
  ) {
    return { kind: "ok" };
  }

  if (accessToken && refreshToken) {
    const session = await safeAuth(
      "auth.setRecoverySession",
      () => supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
      30_000,
      "Could not verify this reset link yet. Try again, or request a fresh link.",
    );
    if (!session.ok) {
      const currentSession = await safeAuth(
        "auth.recovery.sessionAfterSetFailure",
        () => supabase.auth.getSession(),
        8_000,
      );
      if (currentSession.ok && currentSession.data.data.session) {
        markRecoverySessionReady();
        cleanRecoveryUrl();
        return { kind: "ok" };
      }
      return {
        kind: session.error.kind === "timeout" ? "timeout" : "invalid",
        message: session.error.message,
      };
    }
    if (session.data.data.session) {
      markRecoverySessionReady();
      cleanRecoveryUrl();
      return { kind: "ok" };
    }
  } else if (code) {
    const exchanged = await safeAuth(
      "auth.exchangeRecoveryCode",
      () => supabase.auth.exchangeCodeForSession(code),
      30_000,
      "Could not verify this reset link yet. Try again, or request a fresh link.",
    );
    if (!exchanged.ok) {
      const currentSession = await safeAuth(
        "auth.recovery.sessionAfterCodeFailure",
        () => supabase.auth.getSession(),
        8_000,
      );
      if (currentSession.ok && currentSession.data.data.session) {
        markRecoverySessionReady();
        cleanRecoveryUrl();
        return { kind: "ok" };
      }
      return {
        kind: exchanged.error.kind === "timeout" ? "timeout" : "invalid",
        message: exchanged.error.message,
      };
    }
    if (exchanged.data.data.session) {
      markRecoverySessionReady();
      cleanRecoveryUrl();
      return { kind: "ok" };
    }
  } else if (tokenHash) {
    const verified = await safeAuth(
      "auth.verifyRecoveryOtp",
      () => supabase.auth.verifyOtp({
        type: (type ?? "recovery") as EmailOtpType,
        token_hash: tokenHash,
      }),
      30_000,
      "Could not verify this reset link yet. Try again, or request a fresh link.",
    );
    if (!verified.ok) {
      const currentSession = await safeAuth(
        "auth.recovery.sessionAfterOtpFailure",
        () => supabase.auth.getSession(),
        8_000,
      );
      if (currentSession.ok && currentSession.data.data.session) {
        markRecoverySessionReady();
        cleanRecoveryUrl();
        return { kind: "ok" };
      }
      return {
        kind: verified.error.kind === "timeout" ? "timeout" : "invalid",
        message: verified.error.message,
      };
    }
    if (verified.data.data.session) {
      markRecoverySessionReady();
      cleanRecoveryUrl();
      return { kind: "ok" };
    }
  } else {
    return {
      kind: "invalid",
      message: "Open the reset link from your email to set a new password.",
    };
  }

  const settledSession = await safeAuth(
    "auth.recovery.settleSession",
    () => supabase.auth.getSession(),
    8_000,
  );
  if (settledSession.ok && settledSession.data.data.session) {
    markRecoverySessionReady();
    cleanRecoveryUrl();
    return { kind: "ok" };
  }

  return {
    kind: "invalid",
    message: "This link is invalid or has expired. Request a new link to continue.",
  };
}

export async function verifyRecoveryLink(urlString = window.location.href): Promise<RecoveryVerifyResult> {
  const url = new URL(urlString);
  const signature = [
    urlParam(url, "code") ?? "",
    urlParam(url, "token_hash") ?? "",
    urlParam(url, "access_token") ? "hash-session" : "",
    urlParam(url, "type") ?? "",
    urlParam(url, "error") ?? "",
    urlParam(url, "error_description") ?? "",
  ].join(":");

  if (recoveryVerification?.signature === signature) {
    return recoveryVerification.promise;
  }

  const promise = runRecoveryVerification(urlString).finally(() => {
    recoveryVerification = null;
  });
  recoveryVerification = { signature, promise };
  return promise;
}

export async function updatePasswordAndSignOut(password: string): Promise<AuthResult<void>> {
  const supabase = createClient();
  const updated = await safeAuth(
    "auth.updatePassword",
    () => supabase.auth.updateUser({ password }),
    15_000,
    "Could not update the password. Request a fresh link and try again.",
  );

  if (!updated.ok) return updated;

  await safeAuth("auth.signOutAfterPasswordUpdate", () => supabase.auth.signOut(), 2_500);
  clearRecoverySessionReady();
  return { ok: true, data: undefined };
}
