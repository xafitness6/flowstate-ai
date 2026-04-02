"use client";

import { useState, useCallback } from "react";
import {
  runPipeline, runReflection, getLastResult, detectIntent, runEducation,
  type PipelineStatus,
} from "@/lib/ai/pipeline";
import type {
  RawUserData, PipelineResult,
  DecisionOutput, SessionResult, ReflectionOutput, EducationOutput,
} from "@/lib/ai/types";

export type ActiveMode = "performance" | "education" | null;

type PipelineState = {
  status:          "idle" | "detecting" | "summarizing" | "deciding" | "formatting" | "educating" | "complete" | "error";
  activeMode:      ActiveMode;
  result:          PipelineResult | null;
  educationResult: EducationOutput | null;
  error:           string | null;
  lastResult:      PipelineResult | null;
};

export function useAIPipeline() {
  const [state, setState] = useState<PipelineState>({
    status:          "idle",
    activeMode:      null,
    result:          null,
    educationResult: null,
    error:           null,
    lastResult:      getLastResult(),
  });

  // ── Performance pipeline (triggered by RawUserData) ───────────────────────

  const run = useCallback(async (data: RawUserData) => {
    setState((s) => ({
      ...s, status: "summarizing", activeMode: "performance",
      error: null, result: null, educationResult: null,
    }));

    try {
      const result = await runPipeline(data, (s: PipelineStatus) => {
        if (s.stage !== "complete" && s.stage !== "error") {
          setState((prev) => ({ ...prev, status: s.stage }));
        }
      });
      setState((s) => ({ ...s, status: "complete", result, lastResult: result }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pipeline failed";
      setState((s) => ({ ...s, status: "error", error: msg }));
    }
  }, []);

  // ── Ask: detects intent → routes to performance or education ─────────────

  const ask = useCallback(async (input: string, performanceData?: RawUserData) => {
    setState((s) => ({
      ...s, status: "detecting", activeMode: null,
      error: null, result: null, educationResult: null,
    }));

    try {
      const mode = await detectIntent(input);

      if (mode === "education") {
        setState((s) => ({ ...s, status: "educating", activeMode: "education" }));
        const education = await runEducation(input);
        setState((s) => ({ ...s, status: "complete", educationResult: education }));
      } else {
        // Performance mode — requires biometric data
        if (!performanceData) {
          setState((s) => ({
            ...s, status: "error",
            error: "Performance analysis requires biometric data.",
          }));
          return;
        }
        await run(performanceData);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setState((s) => ({ ...s, status: "error", error: msg }));
    }
  }, [run]);

  // ── Reflection (post-session) ─────────────────────────────────────────────

  const [reflectionResult, setReflectionResult] = useState<ReflectionOutput | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);

  const reflect = useCallback(async (
    planned: DecisionOutput,
    actual:  SessionResult
  ) => {
    setReflectionLoading(true);
    try {
      const r = await runReflection(planned, actual);
      setReflectionResult(r);
      return r;
    } finally {
      setReflectionLoading(false);
    }
  }, []);

  return {
    ...state,
    run,
    ask,
    reflect,
    reflectionResult,
    reflectionLoading,
  };
}
