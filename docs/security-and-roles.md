# Flowstate AI — Security & Role Access Plan

**Version:** 1.0
**Stack:** Next.js (App Router) · Supabase · Postgres RLS · Supabase Storage
**Scope:** MVP — practical, low-cost, production-safe

---

## 1. Role Hierarchy

Roles are stored in the Supabase `profiles` table and injected into the JWT as a custom claim. The hierarchy is strictly linear — each level inherits nothing from above, access is defined per resource.

```
master
  └── trainer
        └── client
              └── member
```

| Role    | Description                                                            |
|---------|------------------------------------------------------------------------|
| member  | Self-directed user. Sees only their own data. No coach relationship.   |
| client  | Coached user. Assigned to a trainer. Trainer can read their data.      |
| trainer | Coach. Manages assigned clients only. Cannot see unassigned users.     |
| master  | Platform operator. Full read/write across all data. Billing and admin. |

**Rule:** A user's role is set at account creation and can only be changed by a `master`. No self-promotion is possible.

---

## 2. Data Access Matrix

### 2.1 User profiles

| Actor   | Own profile | Assigned clients | All users |
|---------|-------------|------------------|-----------|
| member  | R/W         | —                | —         |
| client  | R/W         | —                | —         |
| trainer | R/W         | R (limited)      | —         |
| master  | R/W         | R/W              | R/W       |

Trainers can read a client's: name, avatar, plan, current stats, workout logs, nutrition summary.
Trainers cannot read a client's: payment info, raw biometric files, private notes marked `visibility: private`.

### 2.2 Training programs

| Actor   | Own programs | Assigned client programs | All programs |
|---------|--------------|--------------------------|--------------|
| member  | R/W          | —                        | —            |
| client  | R (assigned) | —                        | —            |
| trainer | R/W          | R/W (assigned only)      | —            |
| master  | R/W          | R/W                      | R/W          |

Clients cannot edit their own programs. They can log sessions against it.

### 2.3 Nutrition data

| Actor   | Own data | Assigned client data | All data |
|---------|----------|----------------------|----------|
| member  | R/W      | —                    | —        |
| client  | R/W      | —                    | —        |
| trainer | R/W      | R (summary only)     | —        |
| master  | R/W      | R/W                  | R/W      |

Trainers see a client's daily calorie total, macro split, and AI suggestions. They do not see raw meal logs unless the client explicitly shares them.

### 2.4 AI coach history

Coach chat logs are private by default. A client must explicitly opt-in to coach visibility. This is a user-level setting stored in `profiles.coach_chat_visible`.

| Actor   | Own chat | Assigned client chat          |
|---------|----------|-------------------------------|
| client  | R/W      | —                             |
| trainer | —        | R if `coach_chat_visible=true`|
| master  | —        | R (audit only, not surfaced)  |

### 2.5 Progress photos

Progress photos are the most sensitive data class. Default: private, encrypted at rest in Supabase Storage.

| Actor   | Own photos | Assigned client photos         |
|---------|------------|-------------------------------|
| client  | R/W        | —                             |
| trainer | —          | R only if client sets `photos_visible=true` |
| master  | —          | Emergency access only (logged) |

---

## 3. Supabase Row Level Security (RLS)

Enable RLS on every table — no exceptions. The default posture is deny-all. Policies explicitly grant access.

### 3.1 `profiles` table

```sql
-- Users can read and update their own profile
CREATE POLICY "own_profile"
ON profiles
FOR ALL
USING (auth.uid() = id);

-- Trainers can read their assigned clients' profiles
CREATE POLICY "trainer_reads_clients"
ON profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trainer_client_assignments a
    WHERE a.trainer_id = auth.uid()
    AND a.client_id = profiles.id
  )
);

-- Masters can read all profiles
CREATE POLICY "master_reads_all"
ON profiles
FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'master'
);
```

### 3.2 `programs` table

```sql
-- Users own their programs
CREATE POLICY "own_programs"
ON programs
FOR ALL
USING (owner_id = auth.uid());

-- Trainers can manage programs for their clients
CREATE POLICY "trainer_manages_client_programs"
ON programs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM trainer_client_assignments a
    WHERE a.trainer_id = auth.uid()
    AND a.client_id = programs.owner_id
  )
);

-- Clients can read programs assigned to them (read-only)
CREATE POLICY "client_reads_assigned_program"
ON programs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM program_assignments pa
    WHERE pa.user_id = auth.uid()
    AND pa.program_id = programs.id
  )
);
```

### 3.3 `workout_logs` table

```sql
-- Users own their logs
CREATE POLICY "own_logs"
ON workout_logs
FOR ALL
USING (user_id = auth.uid());

-- Trainers can read (not write) assigned client logs
CREATE POLICY "trainer_reads_client_logs"
ON workout_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trainer_client_assignments a
    WHERE a.trainer_id = auth.uid()
    AND a.client_id = workout_logs.user_id
  )
);
```

### 3.4 General pattern for `master` access

Rather than adding a master policy to every table, use a Postgres function and call it in each policy:

```sql
CREATE OR REPLACE FUNCTION is_master()
RETURNS boolean AS $$
  SELECT role = 'master'
  FROM profiles
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Then append to any policy:

```sql
USING ( <normal condition> OR is_master() )
```

This keeps policies readable and maintains a single source of truth for the master check.

---

## 4. JWT Custom Claims

Supabase allows enriching the JWT with app-level metadata using a `custom_access_token_hook`. Set the user's role at sign-in so it's available in RLS without an extra DB lookup on every request.

```sql
-- Hook function — runs at token generation
CREATE OR REPLACE FUNCTION set_custom_claims(event jsonb)
RETURNS jsonb AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = (event->>'user_id')::uuid;

  RETURN jsonb_set(
    event,
    '{claims,role}',
    to_jsonb(user_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

In RLS policies, access via `(auth.jwt()->>'role')` — avoids a subquery on `profiles` for every row.

```sql
-- Example: master check via JWT (no join)
USING ( (auth.jwt()->>'role') = 'master' )
```

**Important:** The JWT is cached. If a user's role changes, they need to re-authenticate for the new claim to take effect. For master-initiated role changes, trigger a server-side sign-out via the Supabase Admin API.

---

## 5. Authentication

### 5.1 Provider strategy (MVP)

| Method           | Use                     |
|------------------|-------------------------|
| Email + password | Primary, all roles      |
| Magic link       | Optional fallback       |
| OAuth (Google)   | Optional, Phase 2       |

Keep it simple at MVP. Don't add OAuth until you have a reason to — it adds token refresh complexity and vendor dependency.

### 5.2 Session handling

- Session tokens: stored in `httpOnly` cookies via Supabase SSR client. Do not use `localStorage`.
- Token refresh: handled automatically by `@supabase/ssr`. Set the refresh threshold to 60s before expiry.
- Server components: always use the server-side Supabase client for data fetching. Never trust client-side role state for access decisions.

```ts
// Server-side access check pattern (app/some-page/page.tsx)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const supabase = createServerClient(/* ... */)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'trainer') redirect('/')

  // render page
}
```

### 5.3 Password requirements (MVP minimum)

- Minimum 8 characters
- Enforced at the Supabase Auth level, not just the frontend
- No complexity requirements at MVP (friction > security gain for most users)

---

## 6. Database Access

### 6.1 Never expose the service role key

The `service_role` key bypasses all RLS. It must never:
- Be included in client-side code
- Be exposed via an API route without server-side auth checks
- Be committed to version control

Use it only in:
- Server-side Next.js route handlers performing admin operations
- Supabase Edge Functions
- CI/CD scripts in a secrets manager

### 6.2 Admin operations via Server Actions

Master-only operations (role changes, plan overrides, user deletion) must go through Next.js Server Actions or Route Handlers — never direct client DB calls.

```ts
// app/actions/admin.ts
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function setUserRole(targetUserId: string, newRole: string) {
  const supabase = createServerClient(/* anon key */)
  const { data: { user } } = await supabase.auth.getUser()

  // Verify caller is master — server-side, not client claim
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (caller?.role !== 'master') {
    throw new Error('Unauthorized')
  }

  // Use service role client for the write
  const adminClient = createServiceRoleClient()
  await adminClient.from('profiles').update({ role: newRole }).eq('id', targetUserId)
}
```

### 6.3 Input validation

All user-supplied data that touches the database must be validated server-side with Zod before any query runs. Client-side validation is UX only — never a security boundary.

```ts
import { z } from 'zod'

const UpdateProfileSchema = z.object({
  weight:    z.number().min(20).max(500).optional(),
  height:    z.number().min(50).max(300).optional(),
  body_fat:  z.number().min(1).max(70).optional(),
})
```

---

## 7. File Uploads (Progress Photos)

Progress photos require explicit access control since Supabase Storage bucket policies are separate from table RLS.

### 7.1 Bucket structure

```
progress-photos/
  {user_id}/
    {timestamp}_{angle}.jpg
```

One bucket, path-scoped to user ID. This makes bucket policies simple.

### 7.2 Storage policies

```sql
-- Users can upload and read their own photos
CREATE POLICY "own_photos"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'progress-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Trainers can read photos of assigned clients (if client opt-in is set)
CREATE POLICY "trainer_reads_client_photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'progress-photos'
  AND EXISTS (
    SELECT 1
    FROM trainer_client_assignments a
    JOIN profiles p ON p.id = (storage.foldername(name))[1]::uuid
    WHERE a.trainer_id = auth.uid()
    AND a.client_id = p.id
    AND p.photos_visible = true
  )
);
```

### 7.3 Upload constraints

Enforce these at the bucket level in Supabase Storage settings, not just the frontend:

| Constraint      | Value             |
|-----------------|-------------------|
| Max file size   | 10 MB             |
| Allowed MIME    | image/jpeg, image/png, image/webp |
| Max files/user  | 50 (soft limit — enforce via count query before upload) |

### 7.4 Signed URLs for delivery

Never expose the public URL for private photos. Generate short-lived signed URLs server-side:

```ts
const { data } = await supabase.storage
  .from('progress-photos')
  .createSignedUrl(`${userId}/${filename}`, 3600) // 1-hour expiry
```

---

## 8. Admin Actions (Master Role)

The following operations are master-only and must be enforced server-side:

| Action                    | Implementation                             |
|---------------------------|--------------------------------------------|
| Change any user's role    | Server Action + service role client        |
| Delete a user account     | Supabase Admin API (not client SDK)        |
| View all user data        | RLS master policy via `is_master()`        |
| Override AI plan          | Server Action with role check              |
| View payment/billing data | Stripe dashboard — not surfaced in app     |
| Assign trainer to client  | Server Action, writes `trainer_client_assignments` |
| Emergency photo access    | Server Action, writes to audit log first   |

### 8.1 Audit log

For destructive or sensitive master actions, write to an `audit_log` table before executing:

```sql
CREATE TABLE audit_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id    uuid REFERENCES profiles(id),
  action      text NOT NULL,
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

-- Only masters can read audit logs, nobody can delete them
CREATE POLICY "master_reads_audit"
ON audit_log FOR SELECT
USING ( (auth.jwt()->>'role') = 'master' );

-- No delete policy — immutable
```

---

## 9. Frontend Role Guards

Server-side checks are the security boundary. Client-side guards are UX only.

### 9.1 Server-side (authoritative)

Use layout-level checks in `layout.tsx` files for route-level protection:

```
app/
  master/           ← layout.tsx checks role = 'master', redirects otherwise
  program/assign/   ← layout.tsx checks role = 'trainer' | 'master'
  coach/            ← layout.tsx checks authenticated, any role
```

### 9.2 Client-side (UX only)

The `UserContext` and `isMaster()` utility in `src/lib/roles.ts` are used to:
- Show/hide navigation items
- Disable buttons for unauthorized actions
- Render correct UI variants per role

These are convenience features. They do not protect data. A user who bypasses client-side guards hits RLS and Server Action checks that will deny the request regardless.

---

## 10. Rate Limiting

At MVP, use Upstash Redis + the `@upstash/ratelimit` package. Apply rate limits at the Route Handler / Server Action layer.

| Endpoint               | Limit           |
|------------------------|-----------------|
| POST /api/auth/login   | 5 req / 15 min (per IP) |
| POST /api/auth/signup  | 3 req / hour (per IP)   |
| AI coach messages      | 30 req / hour (per user)|
| File upload            | 10 req / hour (per user)|
| Admin actions          | 20 req / hour (per user)|

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '1 h'),
})

// In a route handler:
const identifier = `ai-coach:${userId}`
const { success } = await ratelimit.limit(identifier)
if (!success) return new Response('Too many requests', { status: 429 })
```

---

## 11. Environment Variables

```bash
# Public — safe to expose to the browser
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Private — server-side only, never in client bundles
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Verify in `next.config.ts` that none of the private keys are accessible via `NEXT_PUBLIC_` prefix. Add a CI check to scan for accidental exposure.

---

## 12. What to Skip at MVP

These are real concerns but not MVP blockers. Do them in Phase 2:

| Skipped item                       | Reason                                           |
|------------------------------------|--------------------------------------------------|
| MFA / 2FA                          | Adds friction. Enable when you have paying users.|
| OAuth providers (Google, Apple)    | Not needed until mobile app or broader launch.   |
| GDPR data export endpoint          | Build when you have EU users.                    |
| Full HIPAA compliance              | Only required if storing clinical health data.   |
| Custom RBAC UI for permissions     | Role model is simple enough to manage in code.   |
| WAF / DDoS protection              | Vercel handles basic protection at the edge.     |
| Penetration testing                | Do before public launch, not before private beta.|

---

## 13. MVP Security Checklist

Before shipping to real users:

- [ ] RLS enabled on all tables — verify with `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
- [ ] No service role key in any client-side code or public env vars
- [ ] All user inputs validated with Zod before DB writes
- [ ] File uploads restricted by MIME type and size at the bucket level
- [ ] Signed URLs used for all private file delivery
- [ ] Auth session stored in httpOnly cookies, not localStorage
- [ ] Master route (`/master`) protected by server-side role check in layout
- [ ] Rate limiting on auth endpoints and AI calls
- [ ] Audit log table in place for destructive admin actions
- [ ] `is_master()` function used consistently across RLS policies
- [ ] JWT custom claims hook deployed and tested
- [ ] Role change triggers server-side session invalidation
