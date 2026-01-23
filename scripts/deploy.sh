#!/bin/bash

# Script de déploiement pour Chronos
# Usage: ./deploy.sh

set -e

APP_DIR="/var/www/chronos"
DOMAIN="mychronos.fr"

echo "=== Déploiement de Chronos ==="

# Aller dans le répertoire
cd $APP_DIR

# Pull les dernières modifications
echo "Récupération des modifications..."
git pull origin main

# Installer les dépendances
echo "Installation des dépendances..."
npm ci --production=false

# Build de l'application
echo "Build de l'application..."
npm run build

# Redémarrer PM2
echo "Redémarrage de l'application..."
pm2 restart chronos || pm2 start ecosystem.config.js

echo "=== Déploiement terminé ==="
echo "Application disponible sur https://$DOMAIN"
