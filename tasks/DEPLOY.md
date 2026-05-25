# Deploy — FluentQuest sur EDJ Labs

Pipeline : **GitHub → GHCR → EDJ Labs (Traefik) → Cloudflare DNS sur nmt.ovh**.

## Prérequis (one-time)

- [ ] Repo GitHub `PhytoPlancton/fluentquest` créé (private)
- [ ] GitHub PAT `read:packages` configuré chez EDJ Labs (ou images rendues publiques)
- [ ] Secret GitHub `EDJ_API_KEY` (non utilisé au build, juste pour info)
- [ ] DB Mongo créée sur edj-labs : nom `fluentquest`, IP `0.0.0.0/0` whitelisted (limite 500 conns partagées, voir [feedback-mongo-connections])
- [ ] DNS Cloudflare sur `nmt.ovh` :
  - A `fluentquest` → `79.137.79.153` (DNS only / gris)
  - A `api-fluentquest` → `79.137.79.153` (DNS only / gris)

## Stack 1 — API (`api-fluentquest.nmt.ovh`)

EDJ Labs → New Stack :

- **Stack name** : `fluentquest-api`
- **Service name** : `web`
- **Docker Image** : `ghcr.io/phytoplancton/fluentquest-api:latest`
- **Network** : `traefik-public`
- **Env vars** :
  ```
  NODE_ENV=production
  PORT=3000
  MONGODB_URI=<edj-labs connection string>
  MONGO_MAX_POOL=10
  COOKIE_SECRET=<openssl rand -hex 32>
  FIELD_ENCRYPTION_KEY=<openssl rand -hex 32>
  EDJ_API_KEY=<edj-labs LLM proxy key>
  EDJ_API_BASE=https://api.perplexity.edj-labs.com/v1
  EDJ_DEFAULT_MODEL=pplx-claude-sonnet-4.6
  CORS_ORIGINS=https://fluentquest.nmt.ovh,app://fluentquest-desktop
  ```
- **Deploy Labels** (remplacer `FULL_STACK_NAME` par le nom complet avec UUID après création) :
  ```
  traefik.enable = true
  traefik.docker.network = traefik-public
  traefik.http.routers.FULL_STACK_NAME.rule = Host(`api-fluentquest.nmt.ovh`)
  traefik.http.routers.FULL_STACK_NAME.entrypoints = websecure
  traefik.http.routers.FULL_STACK_NAME.tls.certresolver = letsencrypt
  traefik.http.services.FULL_STACK_NAME.loadbalancer.server.port = 3000
  traefik.http.routers.FULL_STACK_NAME-http.rule = Host(`api-fluentquest.nmt.ovh`)
  traefik.http.routers.FULL_STACK_NAME-http.entrypoints = web
  traefik.http.middlewares.redirect-to-https.redirectscheme.scheme = https
  traefik.http.routers.FULL_STACK_NAME-http.middlewares = redirect-to-https
  ```
- **Global Networks** : Add `traefik-public` / overlay / external

## Stack 2 — Web (`fluentquest.nmt.ovh`)

EDJ Labs → New Stack :

- **Stack name** : `fluentquest-web`
- **Service name** : `web`
- **Docker Image** : `ghcr.io/phytoplancton/fluentquest-web:latest`
- **Network** : `traefik-public`
- **Env vars** : aucune (la build statique a déjà l'`VITE_API_URL` hardcodé via build-arg dans `.github/workflows/build-web.yml`)
- **Deploy Labels** : même pattern que ci-dessus, port `80` au lieu de `3000`, host `fluentquest.nmt.ovh`

## Premier déploiement

1. `git tag v0.1.0 && git push --tags`
2. GitHub Actions build les 2 images → push GHCR (3-5 min, watch : github.com/PhytoPlancton/fluentquest/actions)
3. Sur EDJ Labs, créer les 2 stacks (Web + API) avec les configs ci-dessus
4. Update les stacks (pull image latest)
5. Ouvrir `https://fluentquest.nmt.ovh` → doit afficher la web app
6. `https://api-fluentquest.nmt.ovh/v1/health` → doit répondre `{status:"ok",mongo:"connected"}`

## Releases suivantes

```bash
# raccourcis (voir feedback-workflow) :
Cpt          # = git add . && commit + push + new semver tag + push --tags
```

GitHub Actions rebuilds, on update les stacks EDJ Labs (1 click) → propage en 30s.

## Cloudflare proxy orange (après que tout marche en gris)

1. Cloudflare DNS → records `fluentquest` et `api-fluentquest` → cliquer le nuage gris → orange
2. SSL/TLS → mode : **Full (strict)**
3. Tester : `curl -sI https://fluentquest.nmt.ovh` doit avoir des headers `cf-ray`
4. Si ça casse, repasser en gris

## Bugs fréquents

- 404 sur les domaines → Deploy Labels mal écrits (vs Labels qui ne marchent pas sur Swarm). Vérifier caractère par caractère + STACK_NAME avec UUID complet
- Container Rejected → image absente sur GHCR (le workflow GitHub a-t-il passé vert ?) ou registry credential pas configuré
- 500 → env var manquante. Vérifier `MONGODB_URI`, `EDJ_API_KEY`, `COOKIE_SECRET`, `FIELD_ENCRYPTION_KEY` (tous obligatoires)
- Mongo timeout → IP edj-labs container pas whitelisted dans la DB (ou whitelist 0.0.0.0/0 pour MVP)
- API démarre mais 401 partout → `COOKIE_SECRET` < 32 chars (refus du module cookies.ts)
- Slow signup → argon2 prend ~200ms, c'est normal (params OWASP 2024)

## Liens

- Mémoire : `edj-labs-deploy-workflow`, `edj-labs-infra`, `feedback-mongo-connections`
- Tuto général EDJ Labs : déjà documenté dans la mémoire de Claude
