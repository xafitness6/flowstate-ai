export const DEMO_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === "true" ||
  process.env.NODE_ENV !== "production";

export const PUBLIC_SIGNUP_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP === "true";
