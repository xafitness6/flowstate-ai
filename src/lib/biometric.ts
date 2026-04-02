// Flowstate biometric login — uses WebAuthn (device-native Face ID / Touch ID).
// No face data is stored. The browser/OS handles all biometric verification.

const LS_CRED_ID   = "flowstate-biometric-id";
const LS_BIO_ROLE  = "flowstate-biometric-role";

// ─── Support detection ────────────────────────────────────────────────────────

export function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ─── Credential storage ───────────────────────────────────────────────────────

export function hasSavedCredential(): boolean {
  try { return !!localStorage.getItem(LS_CRED_ID); } catch { return false; }
}

export function getSavedBiometricRole(): string | null {
  try { return localStorage.getItem(LS_BIO_ROLE); } catch { return null; }
}

export function clearBiometric(): void {
  try {
    localStorage.removeItem(LS_CRED_ID);
    localStorage.removeItem(LS_BIO_ROLE);
  } catch { /* ignore */ }
}

// ─── Label detection ──────────────────────────────────────────────────────────

export function getBiometricLabel(): string {
  if (typeof navigator === "undefined") return "Quick Login";
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua))  return "Face ID";
  if (/Macintosh/.test(ua))    return "Touch ID";
  if (/Win/.test(ua))          return "Windows Hello";
  return "Quick Login";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomChallenge(): ArrayBuffer {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return buf.buffer as ArrayBuffer;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buf    = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

// ─── Registration ─────────────────────────────────────────────────────────────

export async function registerBiometric(role: string): Promise<boolean> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge:          randomChallenge(),
        rp: {
          name: "Flowstate AI",
          id:   window.location.hostname,
        },
        user: {
          id:          new TextEncoder().encode("flowstate-user"),
          name:        "flowstate@app",
          displayName: "Flowstate User",
        },
        pubKeyCredParams: [
          { alg: -7,   type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",  // device biometric only
          userVerification:        "required",  // must pass biometric
          residentKey:             "preferred",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;

    localStorage.setItem(LS_CRED_ID,  bufferToBase64(credential.rawId));
    localStorage.setItem(LS_BIO_ROLE, role);
    return true;
  } catch (err) {
    console.warn("Biometric registration failed:", err);
    return false;
  }
}

// ─── Authentication ───────────────────────────────────────────────────────────

/** Returns the saved role on success, or null on failure / cancellation. */
export async function authenticateWithBiometric(): Promise<string | null> {
  try {
    const credId = localStorage.getItem(LS_CRED_ID);
    if (!credId) return null;

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge:         randomChallenge(),
        allowCredentials: [{
          id:   base64ToBuffer(credId),
          type: "public-key",
        }],
        userVerification: "required",
        timeout:          60000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) return null;
    return localStorage.getItem(LS_BIO_ROLE);
  } catch (err) {
    console.warn("Biometric authentication failed:", err);
    return null;
  }
}
