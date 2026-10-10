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
- Clinical data is never persisted on the device (no localStorage/IndexedDB caches) — LGPD and offline-safety requirement.
- Automatic meal and glucose-correction calculators are enabled in demo mode, as explicitly requested by the user. Use the configured target, sensitivity and time-based carbohydrate ratio with the original TACO totals. Remove obsolete blanket prohibitions on these demo features. Keep demo data isolated from Cloud patient records, validate numeric inputs and never fabricate missing TACO nutrients. IOB is not part of these arithmetic simulations.
- Insulin administrations are never deleted; corrections insert a new row with `supersedes_id` — preserves audit trail.
- Patient-scoped tables use RLS via `is_patient_member` / `can_write_patient` / `is_patient_caregiver` security-definer helpers — avoids recursive policies.
- Authenticated app screens live under the pathless `_shell` layout with `ssr: false` — session lives in browser storage.
