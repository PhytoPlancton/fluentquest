# FluentQuest

SaaS de correction conversationnelle multi-langues (EN/ES/FR). Capture vocale en gaming/VoIP → transcription locale (Whisper.cpp) → analyse LLM → exercices QCM + réécriture + SRS.

## Stack

- **apps/api** — Hono + MongoDB + Mongoose + Zod backend (Docker)
- **apps/web** — Vite + React + TanStack Router + Tailwind + shadcn/ui (Docker, Nginx)
- **apps/desktop** — Electron (Mac + Win), capture audio + Whisper.cpp local + pyannote diarization
- **packages/db** — Schémas Mongoose
- **packages/types** — Types TS partagés
- **packages/sdk** — Client API typé
- **packages/ui** — Composants shadcn partagés (web + desktop)

Monorepo : npm workspaces + Turborepo. TypeScript strict partout.

## Dev local

```bash
npm install
cp .env.example .env  # remplir MONGODB_URI et EDJ_API_KEY
npm run dev           # turbo lance api + web + desktop en parallèle
```

## Architecture

API décorrélée du front. Deux services Docker indépendants :

```
fluentquest.nmt.ovh      → web   (static build Vite servi par Nginx)
api-fluentquest.nmt.ovh  → api   (Hono Node)
```

LLM via `api.perplexity.edj-labs.com/v1/chat/completions` (`pplx-claude-sonnet-4.6`).
MongoDB sur cluster edj-labs (limite 500 conns partagées — pool `maxPoolSize ≤ 20`).

## Roadmap

Voir [`tasks/todo.md`](tasks/todo.md).

## Deploy

Pipeline GitHub Actions → GHCR → EDJ Labs → Cloudflare DNS sur `nmt.ovh`. Voir [`tasks/lessons.md`](tasks/lessons.md) pour la procédure complète.

## License

Proprietary — all rights reserved.
