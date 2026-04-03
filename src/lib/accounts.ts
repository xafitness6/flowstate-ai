// Manages dynamically created user accounts, persisted in localStorage.
// Hardcoded demo credentials (ADMIN, alex, kai, luca) are separate and handled in login/page.tsx.

import type { MockUser, Role, Plan } from "@/types";

const ACCOUNTS_KEY = "flowstate-accounts";

export interface StoredAccount {
  id:               string;
  username:         string;
  password:         string; // plain text — demo only, no real backend
  role:             Exclude<Role, "master">;
  name:             string;
  plan:             Plan;
  defaultDashboard: string;
  createdAt:        number;
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

/** Returns the account if credentials match, or null. */
export function resolveAccount(username: string, password: string): StoredAccount | null {
  const account = getAccountByUsername(username);
  if (!account || account.password !== password) return null;
  return account;
}

/** Creates a new account. Returns the account on success, or { error } on conflict. */
export function createAccount(
  username: string,
  password: string,
  role: Exclude<Role, "master">,
  name: string,
): StoredAccount | { error: string } {
  if (getAccountByUsername(username)) {
    return { error: "Username is already taken." };
  }
  const id      = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const defaults = ROLE_DEFAULTS[role];
  const account: StoredAccount = {
    id,
    username,
    password,
    role,
    name,
    plan:             defaults.plan,
    defaultDashboard: defaults.defaultDashboard,
    createdAt:        Date.now(),
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
