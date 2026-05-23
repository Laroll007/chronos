#!/bin/bash
set -e

CHRONOS_DIR="/Users/amreen/Documents/1 - Projets IA/chronos"
SW_FILE="$CHRONOS_DIR/public/sw.js"

echo "=== Déploiement MyChronos ==="

# Lire la version actuelle du SW
CURRENT=$(grep -o "chronos-v[0-9]*" "$SW_FILE" | head -1 | grep -o "[0-9]*")
NEXT=$((CURRENT + 1))

# Bumper la version
sed -i '' "s/chronos-v${CURRENT}/chronos-v${NEXT}/g" "$SW_FILE"
echo "→ Service Worker : chronos-v${CURRENT} → chronos-v${NEXT}"

# Sync vers le VPS
echo "→ Envoi des fichiers..."
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude 'ios' --exclude 'out' --exclude 'deploy.sh' \
  -e ssh "$CHRONOS_DIR/" root@51.254.203.30:/var/www/chronos/

# Build + redémarrage sur le VPS
echo "→ Build + redémarrage..."
ssh chronos-vps "cd /var/www/chronos && npm run build && pm2 restart chronos"

echo ""
echo "=== ✓ Déployé — SW v${NEXT} ==="
