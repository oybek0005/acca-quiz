#!/usr/bin/env bash
# Deploy the ACCA FA QuizApp static export to the Hetzner box (37.27.216.61).
#
# Ships the pre-built `out/` folder to a self-contained nginx container that is
# SEPARATE from every Coolify-managed app and from the older `quiz-app`.
# It touches only:
#   - /root/quiz-app-v2/          (its own directory)
#   - the `quiz-app-v2` container  (its own container)
#   - a traefik router rule via container labels (auto-discovered — no file edits)
#
# Nothing else on the server is modified.
#
# Usage (from the project root, after `npm run build`):
#   bash deploy/deploy.sh
#   SSH_KEY=/path/to/key DOMAIN=my.domain bash deploy/deploy.sh
#
# `npm run deploy` runs `npm run build` then this script.

set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/fazo_hetzner}"
HOST="${HOST:-root@37.27.216.61}"
DOMAIN="${DOMAIN:-quizapp-v2.37.27.216.61.sslip.io}"
REMOTE_DIR="/root/quiz-app-v2"
CONTAINER="quiz-app-v2"

here="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$here/out" ] || { echo "No out/ folder — run 'npm run build' first."; exit 1; }

echo "==> Packaging out/ + nginx.conf"
tar -C "$here" -czf /tmp/quizapp-v2.tgz out
cp "$here/deploy/nginx.conf" /tmp/quizapp-v2-nginx.conf

echo "==> Uploading to $HOST"
scp -i "$SSH_KEY" -o BatchMode=yes /tmp/quizapp-v2.tgz /tmp/quizapp-v2-nginx.conf "$HOST:/tmp/"

# The remote run script is written verbatim (single-quoted heredoc) so the
# backticks required by traefik's Host(`...`) rule are never shell-evaluated.
echo "==> Writing remote deploy script"
ssh -i "$SSH_KEY" -o BatchMode=yes "$HOST" "mkdir -p '$REMOTE_DIR' && cat > '$REMOTE_DIR/run.sh'" <<'REMOTE'
#!/usr/bin/env bash
set -euo pipefail
DIR=/root/quiz-app-v2
CONTAINER=quiz-app-v2
DOMAIN="__DOMAIN__"

rm -rf "$DIR/public"
mkdir -p "$DIR/public"
tar -xzf /tmp/quizapp-v2.tgz -C /tmp
cp -r /tmp/out/. "$DIR/public/"
cp /tmp/quizapp-v2-nginx.conf "$DIR/nginx.conf"
rm -rf /tmp/out /tmp/quizapp-v2.tgz /tmp/quizapp-v2-nginx.conf

docker rm -f "$CONTAINER" 2>/dev/null || true
docker run -d --name "$CONTAINER" --restart unless-stopped --network coolify \
  -v "$DIR/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$DIR/public:/usr/share/nginx/html:ro" \
  --label 'traefik.enable=true' \
  --label 'traefik.http.routers.quiz-app-v2-http.entryPoints=http' \
  --label "traefik.http.routers.quiz-app-v2-http.rule=Host(\`$DOMAIN\`)" \
  --label 'traefik.http.routers.quiz-app-v2-http.middlewares=redirect-to-https' \
  --label 'traefik.http.routers.quiz-app-v2-http.service=quiz-app-v2-svc' \
  --label 'traefik.http.routers.quiz-app-v2-https.entryPoints=https' \
  --label "traefik.http.routers.quiz-app-v2-https.rule=Host(\`$DOMAIN\`)" \
  --label 'traefik.http.routers.quiz-app-v2-https.tls=true' \
  --label 'traefik.http.routers.quiz-app-v2-https.tls.certresolver=letsencrypt' \
  --label 'traefik.http.routers.quiz-app-v2-https.middlewares=gzip' \
  --label 'traefik.http.routers.quiz-app-v2-https.service=quiz-app-v2-svc' \
  --label 'traefik.http.services.quiz-app-v2-svc.loadbalancer.server.port=80' \
  nginx:alpine >/dev/null

sleep 2
docker inspect "$CONTAINER" --format '  rule: {{index .Config.Labels "traefik.http.routers.quiz-app-v2-https.rule"}}'
docker ps --filter "name=$CONTAINER" --format '  {{.Names}}  {{.Status}}'
REMOTE

echo "==> Running remote deploy"
ssh -i "$SSH_KEY" -o BatchMode=yes "$HOST" "sed -i 's|__DOMAIN__|$DOMAIN|' '$REMOTE_DIR/run.sh' && bash '$REMOTE_DIR/run.sh'"

echo "==> Verifying"
sleep 5
code=$(curl -s -k -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)
echo "    https://$DOMAIN/  ->  $code  (first run: letsencrypt may need ~30s)"
