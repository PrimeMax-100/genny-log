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

# Architecture rules
- All localStorage access goes through src/lib/genny-storage.ts — so a backend/sync can replace it without UI changes.
- Screens switch via in-app view state in GennyApp (single `/` route) — the brief asked for simple view state.
- Fuel price lookup is a mock in fetchFuelPrice (TODO) — real API to be wired later.
- Plain-language entry parsing runs in src/lib/ai-entry.functions.ts (server fn, AI Gateway Responses, streamed + consumed server-side) and only pre-fills forms — the user always confirms before saving.
- Onboarding completion uses its own localStorage key through genny-storage.ts, so clearing app entries cannot restart the tour.
