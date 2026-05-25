# M8 — Web app UI

Status: complete. `npx turbo run build` is green across all 7 packages (29/29 API tests still pass).

## Routes built (file → URL)

- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/index.tsx](../apps/web/src/routes/index.tsx) — `/` landing (CTAs to /signup, /login or /dashboard when signed in)
- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/login.tsx](../apps/web/src/routes/login.tsx) — `/login`
- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/signup.tsx](../apps/web/src/routes/signup.tsx) — `/signup`
- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/dashboard.tsx](../apps/web/src/routes/dashboard.tsx) — `/dashboard`
- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/workspace-overview.tsx](../apps/web/src/routes/workspace-overview.tsx) — `/workspaces/$workspaceId`
- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/workspace-sessions.tsx](../apps/web/src/routes/workspace-sessions.tsx) — `/workspaces/$workspaceId/sessions`
- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/session-detail.tsx](../apps/web/src/routes/session-detail.tsx) — `/workspaces/$workspaceId/sessions/$sessionId`
- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/exercises.tsx](../apps/web/src/routes/exercises.tsx) — `/workspaces/$workspaceId/exercises`
- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/invite.tsx](../apps/web/src/routes/invite.tsx) — `/invite/$token` (works signed-out + signed-in)
- [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/routes/__root.tsx](../apps/web/src/routes/__root.tsx) — root layout (Outlet + Toaster + lazy devtools)

Router tree assembled in [/Users/nicolasmonniot/Documents/CODE/corrector.ai/apps/web/src/router.tsx](../apps/web/src/router.tsx).

## Components built

Application-level (`apps/web/src/components/`):

- `AuthGuard.tsx` — protected-route wrapper, redirects to `/login`
- `AppShell.tsx` — sidebar + header layout, nav, user menu, workspace switcher
- `WorkspaceSwitcher.tsx` — dropdown with "new workspace" trigger
- `SessionCard.tsx` — preview tile (status badge, duration, languages, participants)
- `SegmentRow.tsx` — timestamp + speaker + language + verbatim text
- `FauteCard.tsx` — correction diff, severity, "approfondir" toggle with async loader
- `ExerciseMCQ.tsx` — 3-4 options, instant feedback, retry
- `ExerciseRewrite.tsx` — text input, word-level diff vs `correctAnswer`

Forms (`apps/web/src/components/forms/`):

- `LoginForm.tsx`
- `SignupForm.tsx`
- `InviteForm.tsx` (uses `sonner` for success toast)
- `CreateWorkspaceForm.tsx` (in-dialog)

shadcn UI primitives (`apps/web/src/components/ui/`):

- `button.tsx`, `input.tsx`, `card.tsx`, `dialog.tsx`, `form-field.tsx`, `label.tsx`, `badge.tsx`, `avatar.tsx`, `dropdown-menu.tsx`, `sonner.tsx`

Helpers: `lib/utils.ts` (`cn`), `lib/api.ts` (SDK instance), `lib/auth-context.tsx` (auth state + refresh + logout).

## SDK extensions

[/Users/nicolasmonniot/Documents/CODE/corrector.ai/packages/sdk/src/index.ts](../packages/sdk/src/index.ts) now exposes typed methods for every backend route used by the web app: `signup`, `login`, `logout`, `me`, `listWorkspaces`, `createWorkspace`, `getWorkspace`, `renameWorkspace`, `deleteWorkspace`, `listMembers`, `removeMember`, `updateMemberRole`, `listInvitations`, `createInvitation`, `revokeInvitation`, `getInvitation`, `acceptInvitation`, `listSessions`, `createRecordingSession`, `getRecordingSession`, `endRecordingSession`. Every call uses `credentials: 'include'` for cookie auth. Errors surface as a typed `SdkError` (`status`, `code`, `details`).

## Known gaps & limitations

- **Mongo not connected**: any signed-in flow will hit live API errors until M12. Login/signup forms render the network error gracefully (the request goes out — see Sonner toasts + inline `role="alert"` messages).
- **Exercises page uses placeholder data**: 2 MCQs + 2 rewrites are hard-coded in `routes/exercises.tsx`. The SRS scheduler (M9) and LLM exercise generator (M7) will replace these.
- **Fautes/corrections list uses placeholder data**: `routes/session-detail.tsx` ships 2 demo `UiFaute` objects. The LLM pipeline (M6) is what will eventually populate this; the `FauteCard` "approfondir" loader is wired but currently calls a fake `setTimeout` resolver.
- **`fetch` chunking warning**: Vite reports a ~588 KB bundle. Acceptable for M8; can split into vendor chunks later.
- **shadcn CLI bypassed**: components were copied inline because the CLI is unreliable in non-interactive shells and we need to stay deterministic. See `apps/web/components.json` (config kept for future `shadcn add`).
- **Workspace settings**: limited to "delete workspace" (owner-only). Rename UI not built yet — endpoint is in the SDK.

## How to test locally

From the repo root:

```bash
# build (verifies typecheck + bundles)
npx turbo run build --filter=@fluentquest/web

# run web dev server
npm run dev --workspace=@fluentquest/web
# → http://localhost:5173

# in parallel (optional) — API in another shell
npm run dev --workspace=@fluentquest/api
# → http://localhost:3000  (will warn "MONGODB_URI not set")
```

Set `VITE_API_URL` in `apps/web/.env.local` if your API isn't on `localhost:3000`.

Routes to click through:

- `/` landing
- `/signup`, `/login` (forms will fail at the network layer until Mongo is up — failure is surfaced inline)
- `/dashboard` (will redirect to `/login` when no session)
- `/workspaces/<id>`, `/workspaces/<id>/sessions`, `/workspaces/<id>/sessions/<sid>`, `/workspaces/<id>/exercises` (auth-guarded, will redirect)
- `/invite/<token>` (works without auth — shows the preview)

Dark mode is forced via a `dark` class added on `<html>` in `main.tsx`; toggling is not exposed (matches the spec).
