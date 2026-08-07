# Lovable-only security rollout

All production operations must be performed by Lovable. Do not expose secret
values in chat, logs, screenshots, commits, or build output.

## Database

Apply, in filename order, only migrations not yet recorded by the environment:

1. `20260802234000_commercial_security_hardening.sql`
2. `20260803001000_secure_function_defaults.sql`

Then run:

- `supabase/tests/database/19_commercial_security_hardening.test.sql` (12 tests);
- `supabase/audits/20260803_full_security_posture.sql` (read-only).

The posture audit may return legacy findings. Do not blindly revoke every RPC;
export the complete result for classification and a follow-up migration.

## Required secrets

- `TEAMS_BOT_APP_ID`: Azure Bot application/client ID. If omitted, the current
  code uses `TEAMS_CLIENT_ID`, but a dedicated value is preferred.
- `ORACLE_SYNC_JOB_SECRET`: high-entropy scheduler secret, if Oracle is invoked
  without a service-role bearer token.
- `APF_EMBEDDINGS_JOB_SECRET`: high-entropy scheduler secret, if the embedding
  worker is invoked without a service-role bearer token.
- `AI_PROVIDER_ALLOWED_HOSTS`: optional comma-separated hostnames for additional
  self-hosted AI endpoints. Official OpenAI, Anthropic, OpenRouter and Lovable
  endpoints are already allowlisted.
- `REDMINE_ALLOWED_HOSTS`: comma-separated Redmine hostname(s); required for
  Redmine outbound synchronization.
- `TEAMS_COMMAND_WEBHOOK_ALLOWED_HOSTS`: comma-separated hostname(s) for enabled
  custom Teams command webhooks. Leave empty if that feature is unused.
- `GITLAB_ALLOWED_HOSTS`: only required for self-hosted GitLab; `gitlab.com` is
  allowed by default.

Preserve all existing Supabase, Microsoft, provider and webhook secrets.

## Edge Functions to publish

- `teams-bot` (`verify_jwt=false`; validates Microsoft JWT internally)
- `redmine-sync` (`verify_jwt=false`; validates integration secret internally)
- `apex-webhook` (`verify_jwt=false`; validates HMAC internally)
- `oracle-sync`
- `apf-embeddings`
- `telemetry-ingest`
- `auth-rate-limiter` (`verify_jwt=false`; required before login and fails closed)
- `gitlab-webhook-register`
- `gitlab-issues-sync`
- `git-webhook-handler`
- `process-ai-briefing`
- `platform-ai-provider-test`
- `count-function-points`
- `apf-generate`

Publish from the exact audited `develop` revision. Do not deploy unrelated
functions from an older Lovable snapshot.

## Negative security checks

Verify that:

1. `teams-bot` returns 401 for missing, malformed, expired, wrong-audience and
   invalid-signature tokens, and accepts a genuine Microsoft activity.
2. Redmine/APEX return 503 when the integration secret is absent and 401 for a
   missing/invalid signature.
3. Oracle/APF workers return 401 for an ordinary user JWT.
4. User telemetry without a JWT returns 401; integration telemetry with a user
   JWT returns 403; batches over 100 events are rejected.
5. A user from organization A cannot read or mutate organization B records,
   Storage objects, signed URLs, realtime events or integration IDs.
6. HTML/SVG and files above 20 MiB are rejected by the attachment bucket.
7. Configurable outbound URLs reject HTTP, credentials, private/local hosts and
   hosts outside the corresponding allowlist.
8. Oversized Teams/APEX/Git payloads and telemetry batches are rejected without
   being fully buffered in memory.

## Auth settings managed by Lovable

Configure Supabase Auth through Lovable with a minimum password length of 12,
leaked-password protection enabled, refresh-token reuse detection enabled, a
short OTP lifetime, and production redirect URLs restricted to the Axionn
origin. Require MFA for platform administrators when the managed Auth plan
supports it. Keep public signup disabled because accounts are provisioned by
customer organizations.
