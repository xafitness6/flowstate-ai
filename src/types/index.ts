export type Role = "member" | "client" | "trainer" | "master";

export type Plan = "foundation" | "training" | "performance" | "coaching";

// Subscription status — maps to Stripe lifecycle states.
// "inactive" = never subscribed or cancelled; "past_due" = payment failed.
// Demo users are always treated as "active" in the auth/routing layer.
export type SubscriptionStatus = "inactive" | "active" | "past_due";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];  // minimum role to see this item (hidden if below)
  plan?:  Plan;   // minimum plan to use this item (locked if below)
};

export type UserStatus = "active" | "rest" | "off";

export type MockUser = {
  id: string;
  name: string;
  role: Role;
  avatarUrl?: string;
  status: UserStatus;
  pushLevel: number;
  coachOverridePushLevel?: number;
  defaultDashboard?: string; // tab to land on after login: "overview" | route key
  plan: Plan;                // subscription tier
  // Subscription fields — present for Supabase users, undefined for demo users
  subscriptionStatus?:    SubscriptionStatus;
  stripeCustomerId?:      string | null;
  stripeSubscriptionId?:  string | null;
  subscriptionPeriodEnd?: string | null;  // ISO timestamp
  // Admin override: grants elevated feature access without changing the billing plan.
  // Not yet settable via UI — reserved for comp access, trials, manual grants.
  entitlementOverride?:   Plan;
  // Set from profile.is_admin — lets AppShell/guards check admin without a second DB call.
  isAdmin?:               boolean;
};
