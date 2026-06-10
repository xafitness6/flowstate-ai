// ─── Higgsfield CLI shell-out for avatar lipsync ─────────────────────────────
// Wraps `higgsfield generate create seedance_2_0` with --start-image (the coach
// portrait) and --audio (an OpenAI TTS mp3). Seedance 2.0 supports lipsync via
// the audio flag. The CLI handles upload of local files automatically.
//
// Auth: developer runs `higgsfield auth login` once on the host the API route
// runs on. In production the host needs the CLI installed AND a persistent
// session file (CI: provision via service account token / cached session dir).
//
// Returns the public video URL the CLI prints on stdout when `--wait --json`.

import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";

const exec = promisify(execCb);

export type AvatarResult = { videoUrl: string };

type CreateOpts = {
  startImage:  string;   // absolute path to local portrait image
  audioPath:   string;   // absolute path to local mp3
  durationSec: number;   // clamped to Seedance's 4-15s range
  prompt:      string;   // required by the model schema; the spoken text works fine
};

const BIN = process.env.HIGGSFIELD_BIN ?? "higgsfield";

export async function isAvailable(): Promise<boolean> {
  try {
    const { stdout } = await exec(`${BIN} account status`, { timeout: 5000 });
    return stdout.length > 0 && !/expired|not authenticated/i.test(stdout);
  } catch {
    return false;
  }
}

export async function generateAvatarVideo(opts: CreateOpts): Promise<AvatarResult> {
  const duration = Math.max(4, Math.min(15, Math.round(opts.durationSec || 6)));
  // Seedance 2.0 requires `prompt` — feeding the spoken text gives the model a
  // matching motion guide for the lipsync rather than something contradictory.
  const args = [
    "generate", "create", "seedance_2_0",
    "--prompt",      `Person speaking the following words to camera, natural expression, subtle head movement: ${opts.prompt}`,
    "--start-image", opts.startImage,
    "--audio",       opts.audioPath,
    "--duration",    String(duration),
    "--aspect_ratio", "9:16",
    "--resolution",  "720p",
    "--wait",
    "--wait-timeout", "25m",
    "--json",
  ];

  return new Promise<AvatarResult>((resolve, reject) => {
    const child   = spawn(BIN, args, { env: process.env });
    let stdoutBuf = "";
    let stderrBuf = "";
    child.stdout.on("data", (d) => { stdoutBuf += d.toString(); });
    child.stderr.on("data", (d) => { stderrBuf += d.toString(); });
    child.on("error", (e) => reject(e));
    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(stderrBuf.trim() || `higgsfield exited ${code}`));
      }
      const url = extractVideoUrl(stdoutBuf);
      if (!url) return reject(new Error(`Couldn't find video URL in CLI output: ${stdoutBuf.slice(0, 400)}`));
      resolve({ videoUrl: url });
    });
  });
}

/** Pull the result URL out of `--json` output. The CLI prints a JSON array of
 *  final job objects; we walk it for any `.mp4` URL we can find. */
function extractVideoUrl(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  // Try parse as JSON first.
  try {
    const data = JSON.parse(trimmed) as unknown;
    const found = walkForMp4(data);
    if (found) return found;
  } catch { /* fall through to regex */ }
  // Fallback: regex sweep for the first mp4 URL.
  const m = trimmed.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/);
  return m ? m[0] : null;
}

function walkForMp4(node: unknown): string | null {
  if (typeof node === "string" && /^https?:\/\/.+\.mp4(\?|$)/.test(node)) return node;
  if (Array.isArray(node)) {
    for (const v of node) {
      const found = walkForMp4(v);
      if (found) return found;
    }
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node)) {
      const found = walkForMp4(v);
      if (found) return found;
    }
  }
  return null;
}
