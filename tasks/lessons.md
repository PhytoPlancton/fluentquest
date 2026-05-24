# Lessons — FluentQuest

Format : `[date] | ce qui a mal tourné | règle pour éviter`

## Règles de session (lues au démarrage)

- **Plan d'abord** : `tasks/todo.md` mis à jour avant tout code, mode plan pour 3+ steps
- **Verify done** : ne jamais marquer terminé sans preuve (tests passés, logs OK, comportement vérifié)
- **Root cause only** : pas de fix temporaire, pas de bricolage, on creuse jusqu'à la cause
- **Élégance** : si un fix semble bricolé, refaire propre
- **Simplicité** : minimum de code touché, pas d'over-engineering
- **Pas supposer** : vérifier chemins, APIs, variables avant utilisation
- **Subagents** : pour les gros sujets, garder le contexte principal clean
- **Demander en amont seulement** : une question groupée si nécessaire, jamais interrompre en cours de tâche

## Règles stack (FluentQuest)

- **Mongo** : 500 connexions max partagées sur le cluster edj-labs → pool unique par process, close explicite à shutdown, `maxPoolSize` ≤20
- **Sécurité** : passwords NEVER en clair (bcrypt/argon2), toutes données sensibles encryptées au repos (audio, transcripts contenant info perso)
- **Naming** : ne jamais écrire le nom/prénom de l'utilisateur dans aucun fichier (code, docs, README, LICENSE, commits)
- **API décorrélée** : front et back en services Docker séparés, sous-domaines distincts, CORS configuré côté API
- **Audio** : local par défaut, upload S3-compat edj-labs uniquement sur action explicite de l'user
- **Verbatim Whisper** : ne JAMAIS corriger automatiquement la transcription, on doit garder les fautes telles que prononcées (`he act` reste `he act`)

## Commit shortcuts

- `cp` → `git add . && git commit -m "<msg>" && git push` (no deploy)
- `Cpt` → `git add . && git commit + push + new tag + push --tags` (trigger deploy via GitHub Actions → GHCR → EDJ Labs)

## Déploiement

- Stacks EDJ Labs : `fluentquest-web` + `fluentquest-api`
- Sous-domaines : `fluentquest.nmt.ovh` (web) + `api-fluentquest.nmt.ovh` (api)
- Cloudflare DNS : record A → `79.137.79.153` (DNS only, gris, au début)
- Image registry : `ghcr.io/phytoplancton/fluentquest-{web,api}:latest`
- Traefik Deploy Labels (pas Labels !) — voir mémoire `edj-labs-deploy-workflow`

## Apprentissages au fil de l'eau

[2026-05-24] | pnpm symlink refusé par macOS (EACCES sur corepack enable sans sudo) | Utiliser npm workspaces (natif Node, zéro install) plutôt que pnpm pour éviter la friction sudo
[2026-05-24] | TS5097 sur `import './App.tsx'` dans Vite+React strict | Avec `verbatimModuleSyntax: true`, garder les extensions `.tsx`/`.ts` dans les imports nécessite `allowImportingTsExtensions: true` dans tsconfig de l'app (compatible avec `noEmit: true` Vite-side). Sinon supprimer l'extension. Choix : on garde l'extension (plus explicite, plus future-proof Node ESM)
