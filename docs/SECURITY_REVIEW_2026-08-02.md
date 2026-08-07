# Security review — 2026-08-02

## Scope

Static review of the Vite client, Supabase migrations, Storage policies, RLS,
and Edge Functions that use `service_role`. This review does not replace an
external penetration test or validation against the deployed database.

## Remediated findings

1. **Public attachment disclosure (critical)** — the `attachments` bucket was
   public and its object policy allowed unrestricted reads. The bucket is now
   private and reads require an RLS-visible metadata row.
2. **Cross-tenant APF document access (critical)** — any authenticated user
   could read, upload, or delete any object in `apf-documents`. Browser writes
   were removed and reads now inherit authorization from `apf_generations`,
   matched by the generation UUID at the start of the object path.
3. **Cross-team notification injection (high)** — a team member could address a
   notification to a user outside that team. Inserts now require the recipient
   to be a member of the same team.
4. **Privileged GitLab IDOR (high)** — authenticated callers could provide an
   arbitrary integration ID to functions that subsequently used
   `service_role`. Both functions now prove that the integration is visible to
   the caller through RLS before privilege elevation. The scheduled worker has
   a narrowly defined service-role path.
5. **Missing webhook signature bypass (high)** — Redmine and Apex accepted a
   request without a signature even when a secret existed. A configured secret
   now makes the signature mandatory.
6. **Unsafe production configuration fallback (medium)** — the client embedded
   a production Supabase fallback. Production now fails closed if its explicit
   environment variables are absent; isolated placeholders exist only in test
   mode.
7. **Attachment ownership spoofing (medium)** — attachment metadata now binds
   `uploaded_by` and the first storage path segment to `auth.uid()`.
8. **Anonymous metadata grants (defense in depth)** — explicit anonymous grants
   were revoked from notification and attachment/evidence metadata.
9. **Unauthenticated Teams bot activities (critical)** — `teams-bot` now
   verifies the Microsoft Bot Connector RS256 signature, issuer, audience and
   token lifetime using Microsoft's OpenID metadata. `TEAMS_BOT_APP_ID` (or the
   existing `TEAMS_CLIENT_ID`) is required.
10. **Privileged worker IDOR / cost abuse (high)** — Oracle sync and APF
    embeddings now accept only the service role or their dedicated scheduler
    secret; ordinary authenticated users cannot trigger privileged jobs.
11. **Telemetry spoofing (high)** — anonymous events are rejected, user events
    are bound to the authenticated profile organization, integration telemetry
    requires service authentication, and batches are capped at 100 events.
12. **Webhook fail-open configuration (high)** — Redmine and APEX now refuse to
    operate when their integration secret is missing, as well as when the
    signature is missing or invalid.
13. **Stored XSS in prompt/PDF preview (high)** — raw HTML injection was removed
    from prompt previews and report values are HTML-escaped before print export.
14. **Unsafe external navigation (medium)** — executable/data URLs and URLs
    containing credentials are rejected before rendering external links.
15. **Provider key persisted in sessionStorage (medium)** — ad-hoc AI provider
    credentials are now memory-only and disappear on refresh/tab close.
16. **Unbounded/unrestricted attachment uploads (high)** — Storage now enforces
    a 20 MiB maximum and a MIME allowlist that excludes HTML, SVG and executable
    content.
17. **Unsafe default RPC grants (high)** — future functions default to no
    `PUBLIC`/`anon` execution, and trigger functions are explicitly non-callable
    through PostgREST.

## Validation completed

- Frontend tests: 86 files, 402 tests passed.
- Production build: passed.
- Targeted ESLint: no errors (five pre-existing `any` warnings in the evidence service).
- `npm audit --omit=dev --audit-level=moderate`: zero known vulnerabilities.
- `git diff --check`: passed.
- Added pgTAP policy assertions in
  `supabase/tests/database/19_commercial_security_hardening.test.sql`.

## Required before production release

1. Link the Supabase CLI to the intended staging project, apply the migration,
   and execute all pgTAP database tests. The local checkout was not linked, so
   deployed catalog state could not be compared with migration history.
2. Test with two organizations and at least member/admin roles: direct REST
   table reads, guessed UUIDs, signed Storage URLs, realtime subscriptions,
   RPCs, and every Edge Function.
3. Keep `service_role`, webhook secrets, provider tokens, and Vault contents out
   of client bundles and rotate them after any suspected exposure.
4. Publish `teams-bot` only after `TEAMS_BOT_APP_ID` is configured and validate
   a real signed Microsoft activity plus negative tests for missing, expired,
   wrong-audience and invalid-signature tokens.
5. Commission an independent penetration test before launch and repeat it after
   material authorization, billing, integration, or tenant-model changes.
6. Enable monitoring and alerts for repeated 401/403 responses, cross-tenant ID
   probing, webhook signature failures, unusual signed-URL creation, and admin
   actions.
7. Run `supabase/audits/20260803_full_security_posture.sql` through Lovable and
   review every returned row. In particular, legacy `SECURITY DEFINER` RPCs must
   be classified before revoking grants so production policies are not broken.

## Security guarantee

No review can prove that software has no vulnerabilities. Release decisions
should be based on layered controls, deployed-state tests, monitoring, incident
response, dependency scanning, and recurring independent assessment.
