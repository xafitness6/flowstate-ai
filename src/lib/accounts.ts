// Manages dynamically created user accounts, persisted in localStorage.
// Hardcoded demo credentials (alex, kai, luca) are separate and handled in login/page.tsx.

import type { MockUser, Role, Plan } from "@/types";

const ACCOUNTS_KEY = "flowstate-accounts";

export interface StoredAccount {
  id:               string;
  username:         string;
  password:         string; // plain text — demo only, no real backend
  role:             Exclude<Role, "master">;
  name:             string;
  email:            string;
  plan:             Plan;
  defaultDashboard: string;
  createdAt:        number;
  inviteToken?:     string; // token used to accept invite (if applicable)
  assignedTrainerId?: string;
}

const ROLE_DEFAULTS: Record<Exclude<Role, "master">, { plan: Plan; defaultDashboard: string }> = {
  member:  { plan: "foundation",  defaultDashboard: "accountability" },
  client:  { plan: "training",    defaultDashboard: "program"        },
  trainer: { plan: "performance", defaultDashboard: "program"        },
};

function loadAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredAccount[];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch { /* ignore */ }
}

export function getAccountById(id: string): StoredAccount | null {
  try {
    return loadAccounts().find((a) => a.id === id) ?? null;
  } catch {
    return null;
  }
}

export function getAccountByUsername(username: string): StoredAccount | null {
  try {
    return loadAccounts().find((a) => a.username.toLowerCase() === username.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

export function getAccountByEmail(email: string): StoredAccount | null {
  try {
    return loadAccounts().find((a) => a.email?.toLowerCase() === email.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

/** Returns the account if credentials match (username or email), or null. */
export function resolveAccount(usernameOrEmail: string, password: string): StoredAccount | null {
  const byUsername = getAccountByUsername(usernameOrEmail);
  if (byUsername && byUsername.password === password) return byUsername;
  const byEmail = getAccountByEmail(usernameOrEmail);
  if (byEmail && byEmail.password === password) return byEmail;
  return null;
}

/** Creates a new account. Returns the account on success, or { error } on conflict. */
export function createAccount(
  username: string,
  password: string,
  role: Exclude<Role, "master">,
  name: string,
  email = "",
  options?: { inviteToken?: string; assignedTrainerId?: string },
): StoredAccount | { error: string } {
  if (getAccountByUsername(username)) {
    return { error: "Username is already taken." };
  }
  if (email && getAccountByEmail(email)) {
    return { error: "An account with that email already exists." };
  }
  const id      = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const defaults = ROLE_DEFAULTS[role];
  const account: StoredAccount = {
    id,
    username,
    password,
    role,
    name,
    email,
    plan:             defaults.plan,
    defaultDashboard: defaults.defaultDashboard,
    createdAt:        Date.now(),
    inviteToken:      options?.inviteToken,
    assignedTrainerId: options?.assignedTrainerId,
  };
  const accounts = loadAccounts();
  accounts.push(account);
  saveAccounts(accounts);
  return account;
}

/** Converts a StoredAccount to the MockUser shape UserContext expects. */
export function accountToMockUser(account: StoredAccount): MockUser {
  return {
    id:               account.id,
    name:             account.name,
    role:             account.role,
    status:           "active",
    pushLevel:        5,
    plan:             account.plan,
    defaultDashboard: account.defaultDashboard,
  };
}
