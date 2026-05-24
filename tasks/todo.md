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
- [ ] **M1** — DB schemas : User, Workspace, Membership, Invitation, Session, Segment, Faute, Exercise, SRSState
- [ ] **M2** — API auth (Better-Auth email/pw), workspaces multi-tenant, invitations, sessions CRUD
- [ ] **M3** — Desktop : audio capture Mac (ScreenCaptureKit) + Win (WASAPI loopback)
- [ ] **M4** — Desktop : Whisper.cpp embedded, prompt verbatim "preserve grammatical errors"
- [ ] **M5** — Desktop : pyannote ONNX diarization (qui parle quand)
- [ ] **M6** — API : LLM pipeline edj-labs `pplx-claude-sonnet-4.6` → JSON structuré fautes/intéressants/sévérité
- [ ] **M7** — API : génération exercices (QCM puis réécriture, phrases variables par session)
- [ ] **M8** — Web : review UI + exercices + difficulté adaptative par profil
- [ ] **M9** — API : SRS SM-2 + queue + scheduling
- [ ] **M10** — API : estimation niveau + reco palier suivant (idiomes/règles à connaître)
- [ ] **M11** — CI/CD : GitHub Actions build + push GHCR (`ghcr.io/phytoplancton/fluentquest-{api,web}`)
- [ ] **M12** — Deploy EDJ Labs : 2 stacks, Cloudflare DNS, Traefik labels, TLS Let's Encrypt
- [ ] **M13** — Packaging desktop : Mac notarization + Win signing + auto-update

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
