# TODO — FluentQuest

## Vision

SaaS multi-tenant de correction de langues (EN/ES/FR) basé sur les conversations vocales sur n'importe quel VoIP/jeu (TeamSpeak, Discord, Zoom, etc.).

Workflow user :
1. Lancer le client desktop, cliquer **Start** (style Granola — indépendant du jeu/VoIP)
2. Jouer / parler normalement
3. Cliquer **Stop** → l'app transcrit en local (Whisper.cpp verbatim), diarise (pyannote), envoie au backend
4. Backend appelle le LLM edj-labs (`pplx-claude-sonnet-4.6`), retourne JSON `{fautes[], intéressants[], sévérité}`
5. Web app : review post-session → exercices (QCM puis réécriture, phrases variables) → règles concises + bouton "approfondir"
6. SRS Anki SM-2 fait revenir les fautes récurrentes
7. À la fin du transcript, estimation du niveau + reco palier suivant (idiomes / règles)

Workspaces style Notion : perso + équipe avec invitations email. Profils perso (niveau, fautes, SRS) + sessions communes.

## Architecture

**API décorrélée du front.** Deux services Docker indépendants, deux sous-domaines :

```
fluentquest.nmt.ovh          → apps/web   (Vite static, Nginx)
api-fluentquest.nmt.ovh      → apps/api   (Hono Node)
```

```
apps/
  api/      Hono + Mongo + Mongoose + Zod + Better-Auth, Docker
  web/      Vite + React + TanStack Router + Tailwind + shadcn/ui, Docker (Nginx serve build)
  desktop/  Electron + React, distribué en DMG/EXE depuis web app
packages/
  db/       Mongoose schemas + validation Zod
  types/    Shared TS types (API contracts)
  sdk/      Typed API client (axios + types)
  ui/       shadcn components shared web + desktop
```

Monorepo : npm workspaces + Turborepo. TypeScript strict partout.

Stack précise :
- Node ≥22, TypeScript ^5.7, Hono ^4, Mongoose ^8, Zod ^3.23
- React 19, Vite ^6, TanStack Router, TailwindCSS ^4, shadcn/ui
- Electron ^33, electron-builder
- Whisper.cpp (binaire bundlé sidecar) + pyannote ONNX (via onnxruntime-node)
- Tests : Vitest unit, Playwright e2e web

## Roadmap

- [x] **M0** — Scaffold monorepo (npm workspaces + Turbo, apps/packages skeletons, Dockerfiles, GitHub workflows, README) — vérifié : API smoke test OK (`/v1/ping`, `/v1/health`), 7 packages buildent via Turbo
- [x] **M1** — DB schemas (9 modèles Mongoose + Zod-ready) — vérifié : 7/7 build Turbo, crypto round-trip OK, idempotent
  - Crypto AES-256-GCM field-level pour : `Segment.text`, `Session.audioUrl`, `Faute.originalText/correctedText`, `Exercise.prompt/correctAnswer/userAnswer`
  - `passwordHash` en `select: false` (jamais retourné par défaut)
  - Index : email unique, workspace slug unique, membership composé userId+workspaceId, srs userId+fauteId, etc.
- [x] **M2** — API auth + workspaces + invitations + recording sessions CRUD — vérifié : 7/7 build, 21/21 tests, smoke 401 sur endpoints protégés
  - Auth custom (argon2id + sessions DB-backed + cookies signés Hono) — pas Better-Auth pour éviter conflit schémas Mongoose
  - Mongo non connecté jusqu'au M12 → verify = typecheck strict + unit tests sur la logique pure (passwords, slug, crypto, session tokens)
  - Routes implémentées :
    - `/v1/auth` : signup, login, logout, me
    - `/v1/workspaces` : CRUD + members + invitations + role mgmt (RBAC owner/admin/member)
    - `/v1/invitations` : token-based preview + accept
    - `/v1/sessions` : create, list, get (+ segments), patch, bulk segments, end
- [⚠️] **M3** — Desktop audio capture Mac/Win : interface + dispatch + stubs (capture-mac.ts, capture-win.ts) — compile OK, mais **NE CAPTURE RIEN** sans bindings natifs (ScreenCaptureKit Swift addon Mac, WASAPI loopback C++ addon Win). Voir TODO dans chaque fichier + tasks/DESKTOP-PACKAGING.md "Phase A"
- [⚠️] **M4** — Desktop Whisper.cpp wrapper subprocess (whisper.ts) — compile OK, mais **nécessite binaire whisper-cli bundlé + modèle GGUF téléchargé** (~3Go large-v3). Verbatim mode prompt OK (`temperature=0 + "preserve all grammatical errors"`). Voir DESKTOP-PACKAGING.md "Phase B"
- [⚠️] **M5** — Desktop pyannote ONNX diarization (pyannote.ts) — compile OK, fallback single-speaker. **Nécessite modèles ONNX téléchargés** + intégration onnxruntime-node. Helper `mergeTranscriptDiarization` fonctionnel. Voir DESKTOP-PACKAGING.md "Phase C"
- [x] **M6** — API LLM pipeline edj-labs `pplx-claude-sonnet-4.6` — vérifié : typecheck OK, prompts strictement structurés (Zod validation), endpoint POST /v1/sessions/:id/analyze fire-and-forget. **Runtime non testé** (pas de Mongo). Fichiers : `apps/api/src/llm/{client,prompts,schemas,analyze-session}.ts`
- [x] **M7** — API génération exercices — vérifié : typecheck OK. Endpoint POST /v1/fautes/:id/exercises génère 2-3 QCM + 1 rewrite via LLM. Phrases variables (prompt explicite : "DIFFERENT content, same rule"). Fichier : `apps/api/src/llm/generate-exercises.ts`
- [x] **M8** — Web review UI + exercices — vérifié : 7/7 build, 9 routes, AuthGuard + AppShell + SDK étendu, dark mode shadcn. Placeholder data jusqu'à connexion Mongo. Voir `tasks/web-m8-status.md`
- [x] **M9** — API SRS Anki SM-2 — vérifié : 8/8 unit tests passent. Endpoint GET /v1/srs/queue + POST /v1/srs/review. EaseFactor jamais < 1.3, intervalle = (1, 6, then × ease), lapses tracked. Fichier : `apps/api/src/srs/sm2.ts`
- [x] **M10** — API estimation niveau + recommandations — vérifié : typecheck OK. À la fin de `analyzeSession`, on attribue le niveau CEFR estimé au speaker majoritaire (word-count) sur la langue détectée. Recommandations encodées dans `session.title` (à migrer vers collection dédiée plus tard)
- [x] **M11** — CI/CD : `.github/workflows/{build-api,build-web,release}.yml` posés. Auto-build sur tag `v*` → push GHCR. **Repo GitHub PhytoPlancton/fluentquest pas encore créé** (action user requise)
- [x] **M12** — Deploy doc complet : `tasks/DEPLOY.md` (stacks EDJ Labs, env vars, Deploy Labels Traefik, DNS Cloudflare, troubleshooting). **Exécution = action user** (créer DB Mongo, créer stacks, point DNS)
- [x] **M13** — Desktop packaging doc : `tasks/DESKTOP-PACKAGING.md` (signature Mac notarization, Win code signing, auto-update, roadmap d'intégration des phases A-E). **Nécessite Apple Developer + Win signing cert (~300€/an total) + binaires natifs audio**

## Tâche en cours : M0 — scaffold monorepo

Étapes (TaskCreate dédiées) :
1. Init Git + .gitignore + .env.example + README
2. Root config (package.json workspaces + turbo.json + tsconfig.base.json)
3. apps/api skeleton (Hono "hello" + healthcheck + Dockerfile)
4. apps/web skeleton (Vite React + TanStack Router + Tailwind + Dockerfile Nginx)
5. apps/desktop skeleton (Electron + electron-builder config)
6. packages/types + db + sdk + ui skeletons
7. GitHub Actions workflows `build-api.yml` et `build-web.yml`
8. `npm install` racine, vérifier que `npm run build` passe sur toutes les apps
9. Premier commit + tag v0.0.0

## Notes d'archi

- **Mongo** : pool unique par process, `maxPoolSize: 10`, close à SIGTERM, jamais >20 par app (limite 500 partagée)
- **Sécurité** : passwords hashés (argon2id), audio chiffré au repos si uploadé, transcripts encryptés (champ chiffré ou collection séparée)
- **CORS** : API autorise uniquement les origins `fluentquest.nmt.ovh` + `app://fluentquest-desktop` (en dev : `localhost:5173`)
- **Audio retention** : default 24h, configurable par user (settings)
- **Verbatim Whisper** : prompt initial "transcribe verbatim, preserve all grammatical errors", `temperature: 0`
- **i18n** : langue détectée auto par le LLM sur le transcript
- **Naming** : jamais de nom de personne dans les fichiers

## Décisions tranchées

- npm workspaces (pas pnpm — corepack EACCES sur cette machine)
- Better-Auth pour l'auth (Mongo support, email+pw)
- Modèle LLM : `pplx-claude-sonnet-4.6` via `api.perplexity.edj-labs.com/v1/chat/completions`
- GitHub user : `PhytoPlancton`
- Domain : sous-domaines `nmt.ovh` (pas de domaine fluentquest.* acheté pour l'instant)

## À demander à l'utilisateur (en amont, groupé)

- **URI Mongo edj-labs** : sera nécessaire pour M1 (créer la DB FluentQuest sur le cluster + obtenir la connection string + créer les indexes)
- **GitHub PAT** ou autorisation pour créer le repo `PhytoPlancton/fluentquest` (ou il le crée et me file l'URL)
- **Rotation de la clé LLM** déjà collée en clair (geste sécurité — 1 click sur dashboard edj-labs)
