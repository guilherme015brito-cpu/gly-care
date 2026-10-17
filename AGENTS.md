<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All data access goes through the `DataStore` interface (src/lib/data/store.ts) with a demo (in-memory) and a Cloud implementation — keeps demo mode isolated and lets backends be swapped.
- Glucose sources implement `GlucoseProvider` (src/lib/glucose/providers.ts); ingestion is idempotent via provider+external_id / provider+timestamp — prevents duplicates from any source.
- Confirmed clinical records are never cached on the device. Exception requested for meal recovery: unfinished meal form input is saved locally, scoped by mode, authenticated user and patient, until successful confirmation. It is not an offline submission queue; Cloud writes still require connectivity.
- LibreLinkUp is an explicitly authorized experimental read-only Cloud integration. Real readings never enter Demo or dosing calculators. Passwords are transient; encrypted tickets stay in server-only RLS tables, with private server keys, explicit person binding and sanitized errors. Never bypass upstream terms, MFA, challenges or access controls. See docs/libre-integration.md for activation and limitations.
- Automatic meal and glucose-correction calculators are enabled in demo mode, as explicitly requested by the user. Use the configured target, sensitivity and time-based carbohydrate ratio with the original TACO totals. Keep demo data isolated from Cloud patient records, validate numeric inputs and never fabricate missing TACO nutrients. Meal registration can atomically save a confirmed or pending demo administration, after an explicit yes/no choice. Graphs show sourced, normalized illustrative action profiles, not IOB or remaining insulin units, and never feed curves into dose calculations. Only confirmed, performed, non-superseded administrations enter those graphs; use the actual administration timestamp when confirming a pending record. Fiasp is rapid; Lantus is basal without a pronounced peak. The split Lantus seed is a fictional scenario, not a regimen recommendation.
- Insulin corrections insert a new row with `supersedes_id`. User-requested deletion sets `deleted_at`; hide removed records from active history and action graphs while preserving audit and foreign-key references.
- Cloud exposes the calculator as a manual-input simulation only. Never import real Cloud readings into it or transfer its results to application records. Cloud meal confirmation requires an independently entered dose and explicit performed/planned choice; save both records atomically and deduplicate retries by request ID. Cloud action charts use confirmed records but retain the illustrative, non-IOB profile labeling.
- Patient-scoped tables use RLS via `is_patient_member` / `can_write_patient` / `is_patient_caregiver` security-definer helpers — avoids recursive policies.
- Authenticated app screens live under the pathless `_shell` layout with `ssr: false` — session lives in browser storage.
- The user-requested Plano alimentar estimates carbohydrate coverage from selected food quantities and the configured meal/time carbohydrate ratio in both modes. It never imports glucose, calculates corrections/IOB, or creates clinical records. Save plans through DataStore with patient-scoped RLS and optimistic versions.
- Injection site is mandatory on new administrations and when confirming pending/basal records. Warn on consecutive reuse; block the fourth consecutive use of the same region until another region is recorded. This is the user's product rule, not a clinical recommendation. Preserve historical records without a site and validate rotation again on the server.
