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
[2026-05-25] | Mongoose set/get TS strict refuse helpers typés `(v: string|null) => ...` | set/get attendent `(v: any) => any`. Solution propre : typer les helpers en `any` avec gates runtime (`typeof === 'string'`). Évite `as never` au call site, et les helpers restent réutilisables hors Mongoose
[2026-05-25] | TS rejet de transform sur Schema.set('toJSON') avec `ret: Record<string, unknown>` | Pour masquer un champ sensible (passwordHash), préférer `select: false` au niveau du champ Mongoose plutôt qu'un transform toJSON. Plus sûr (jamais retourné), plus simple (pas de transform). Login flow doit explicitement `.select('+passwordHash')`
[2026-05-25] | `models/` dans .gitignore a shadow `packages/db/src/models/` | Patterns globaux comme `models/` matchent N'IMPORTE OÙ dans le tree (gitignore est récursif par défaut). Toujours scoper : extensions explicites (`*.gguf`, `*.bin`) ou paths anchored (`apps/desktop/whisper-models/`). Sinon les nouveaux dirs qui partagent le nom disparaissent silencieusement de git
[2026-05-25] | TS2748 "Cannot access ambient const enums" sur `Algorithm.Argon2id` (@node-rs/argon2) | Avec `verbatimModuleSyntax: true`, on ne peut PAS importer un const enum d'un autre module. Solutions : (a) utiliser la valeur littérale (`0`/`1`/`2`), (b) omettre l'argument si l'enum est juste pour le défaut (cas argon2id default), (c) désactiver verbatimModuleSyntax (mauvais, on perd l'enforcement). Choix : omis l'algo (argon2id est le défaut)
[2026-05-25] | Mongoose warning "Duplicate schema index on {expiresAt:1}" | Quand on déclare un TTL index avec `schema.index({field:1}, {expireAfterSeconds: 0})`, NE PAS aussi mettre `index: true` sur le champ. Mongoose crée deux index séparés. Garder uniquement le TTL index (qui sert aussi d'index normal pour les queries)
[2026-05-25] | TanStack Router refuse les template-string paths (`to={`/workspaces/${id}`}`) | Le `<Link to=…>` est strictement typé à partir des routes déclarées. Toujours utiliser la forme paramétrée : `<Link to="/workspaces/$workspaceId" params={{ workspaceId: id }} />` et idem pour `navigate({ to, params })`. Bonus : si une lib externe construit un `to` dynamique (cas `AppShell` nav), garder la chaîne typée comme `keyof typeof routes` ou caster localement avec `as never` + commentaire SAFETY pour ne pas perdre la typecheck ailleurs
[2026-05-25] | shadcn CLI risque de bloquer en non-interactif sur npm workspaces | Plutôt que de batailler avec `npx shadcn add --yes` (peut échouer sur le prompt de package manager / path alias), copier directement les sources canoniques des composants (Button, Input, Card, Dialog, Label, Badge, Avatar, DropdownMenu, Sonner) dans `apps/web/src/components/ui/`. Garder `components.json` à la racine de l'app pour `shadcn add` futur, mais ne pas dépendre du CLI dans le flow de build
[2026-05-25] | `docker compose restart` ne recharge PAS `env_file` | Modifier `.env` puis `docker compose restart` garde les vieilles env vars (snapshot pris au create). Pour propager : `docker compose up -d --force-recreate <service>`. Vérifier toujours avec `docker exec ... env | grep KEY` avant de débugger ailleurs
[2026-05-25] | analyzeSession encodait les recommandations dans session.title → ValidationError length>200 | Hack documenté dans le code "recos dans title temporaire" a réellement claqué quand le LLM a retourné 3 recos = 814 chars JSON. Fautes étaient déjà insérées avant le save, mais analysisStatus reste "processing" car save fail. Fix : log les recos en console pour MVP, migrer vers collection Recommendation dédiée. Lesson : tout hack TEMPORAIRE doit avoir un guard de taille OU être supprimé avant d'arriver en intégration
