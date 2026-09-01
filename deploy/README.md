# Deploy

The app is a **client-only static site** (`next.config.ts` → `output: "export"`).
All state lives in the browser (localStorage) or the user's own Firebase project
(optional cloud sync — see `FIREBASE_SETUP.md`) — there is no server of our own,
no API routes, no database.

`npm run build` → `out/` (~1.7 MB, fully self-contained).

## Live

**https://quizapp-v2.37.27.216.61.sslip.io** — on the Hetzner box, in its own
`quiz-app-v2` nginx container.

## Deploy / redeploy

```bash
npm run deploy          # = npm run build && bash deploy/deploy.sh
# or, with a different target:
SSH_KEY=~/.ssh/fazo_hetzner DOMAIN=quiz.example.com bash deploy/deploy.sh
```

### What it touches on the server

| Created / updated | Left completely alone |
|---|---|
| `/root/quiz-app-v2/` (public + nginx.conf + run.sh) | `/root/quiz-app/` (the older HTML quiz app) |
| the `quiz-app-v2` container | every Coolify-managed app (fazo, mudarris, …) |
| a traefik router rule via **container labels** (auto-discovered) | `coolify-proxy`, any traefik/coolify config file |

The container joins the existing `coolify` docker network so `coolify-proxy`
(traefik) can route to it; the router rule comes from labels only, so no config
file anywhere is edited. `--restart unless-stopped` keeps it up across reboots.

### Rollback

```bash
ssh -i ~/.ssh/fazo_hetzner root@37.27.216.61 'docker rm -f quiz-app-v2'
```

Removes only this container. Nothing else is affected. To also drop the files:
`rm -rf /root/quiz-app-v2`.

## Other static hosts

`out/` works as-is on Netlify, Vercel, GitHub Pages, Cloudflare Pages, etc.
Apply the security headers from `deploy/nginx.conf` at the host where possible
(Netlify: `_headers`; Vercel: `vercel.json`).
