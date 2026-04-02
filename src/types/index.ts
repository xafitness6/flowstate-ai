export type Role = "member" | "client" | "trainer" | "master";

export type Plan = "starter" | "pro" | "elite";

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
  plan: Plan;               // subscription tier
};
