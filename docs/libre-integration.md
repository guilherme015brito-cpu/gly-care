# Experimental LibreLinkUp integration

Read-only cloud import for glucose, trend and measurement timestamp. This is
not an Abbott-approved interface, a primary glucose monitor, an alarm system,
or a dose calculator. No insulin/device writes are made. Demo remains isolated.

## Server activation

1. Apply `supabase/migrations/202610110001_libre_readonly.sql` to the existing
   Supabase project using its SQL editor or configured migration tooling.
   Do not reapply the original baseline migration.
2. Configure private server environment variables in the actual TanStack Start
   server deployment (not the static frontend): `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LIBRE_TOKEN_KEY`.
   The last value is 32 random bytes encoded as 64 hexadecimal characters.
   Generate locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   Never prefix service secrets with `VITE_`, commit them, or send them in chat.
   `LIBRE_CLIENT_VERSION` is optional (default `4.16.0`).
3. Restart the local server or redeploy the server-enabled application over
   HTTPS. A static Vercel deployment alone cannot execute the connector.
4. Sign in to GlyCare, select/create the correct real patient, and open
   `/config/conexao`. Enter the authorized caregiver LibreLinkUp account
   directly in the form. Brazil defaults to LA; approved regional redirects
   are followed with a hard limit. Confirm consent and explicitly select the
   shared person. Different Libre people cannot be rebound to an existing
   GlyCare patient's history; create another patient instead.
5. Compare the value and measurement time with the official phone app.
   Test expired session, loss of sharing, offline state and disconnect.

## Data and credentials

Passwords are used once, never saved in database/browser storage/React Query.
Only upstream session tickets are persisted, AES-256-GCM encrypted with a
private server key and authenticated patient scope. Raw upstream payloads,
sensor serial numbers, account emails and tokens are not returned to UI/logs.
Private tables have RLS and no anon/authenticated grants; server operations
verify authenticated patient membership and management roles before access.
The original clinical table RLS still governs browsing imported readings.
Drafts expire after ten minutes. Login cleans expired drafts; schedule database
cleanup if desired. Cancelled selection never activates a connection. Account
terms/MFA actions must be completed in the official app; the connector does not
accept terms, solve challenges or bypass access controls.

Active tickets expire at the upstream expiry or seven days, whichever is first.
No stored password means renewal requires logging in again. Disconnect erases
the ticket and drafts, stops future import, and retains historical readings and
person binding. Rotating `LIBRE_TOKEN_KEY` requires reconnecting accounts.

Polling happens once per minute while the monitor or connection screen is open
and focused, not when the browser is closed. An atomic server-side cooldown
prevents multiple tabs polling the same connection simultaneously. Errors back
off five minutes (15 minutes for rate limits). No unattended scheduler is
installed. Last query time is NOT the measurement time. Missing points are not
interpolated, factory UTC timestamps are parsed independently of server zone,
latest measurement takes precedence over duplicate graph points, saturated
HI/LO readings are marked questionable, and unique SQL indexes deduplicate.
Disconnected or stale data must not be described as live/current.

## Sources and validation

Protocol references (reviewed 2026-10-11):
- https://github.com/nightscout/nightscout-connect/blob/main/lib/sources/librelinkup.js
- https://github.com/timoschlueter/nightscout-librelink-up
- https://www.freestyle.abbott/pt-br/products/apps-and-data-sharing/libre-linkup.html

Automated tests use invented responses and fake servers, not family credentials
or real clinical data. Passing tests does not prove Abbott connectivity or
clinical validation. A live connection needs server activation and a supervised
comparison with the official app; do not claim it connected until then.
