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
# --delete : sans lui, un fichier supprimé du dépôt SURVIT indéfiniment sur le
# serveur. Dix orphelins s'y étaient accumulés (2026-09-08), dont un
# app/dashboard/layout.tsx de mars encore actif dans le routage Next.js, et un
# ObjectiveSetup.tsx qui a fini par casser le build de production en important
# une fonction déplacée. Les chemins exclus ci-dessous ne sont pas supprimés
# (--delete ne touche pas aux exclusions, contrairement à --delete-excluded).
rsync -avz --delete --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude 'ios' --exclude 'out' --exclude 'deploy.sh' \
  -e ssh "$CHRONOS_DIR/" root@51.254.203.30:/var/www/chronos/

# Build + redémarrage sur le VPS
echo "→ Build + redémarrage..."
if ! ssh chronos-vps "cd /var/www/chronos && npm run build && pm2 restart chronos"; then
  echo ""
  echo "!!! ÉCHEC : build ou redémarrage KO — la prod tourne encore sur l'ancienne version."
  exit 1
fi

echo ""
echo "=== ✓ Déployé — SW v${NEXT} ==="
