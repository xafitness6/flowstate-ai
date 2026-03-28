export type Role = "member" | "client" | "trainer" | "master";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
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
};
