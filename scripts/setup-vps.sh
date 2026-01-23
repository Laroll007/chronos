#!/bin/bash

# Script d'installation initiale pour Chronos sur Ubuntu/Debian
# À exécuter en tant que root ou avec sudo

set -e

DOMAIN="mychronos.fr"
APP_DIR="/var/www/chronos"
REPO_URL="https://github.com/Laroll007/chronos.git"

echo "=== Installation de Chronos sur VPS ==="

# 1. Mise à jour du système
echo "1/7 - Mise à jour du système..."
apt update && apt upgrade -y

# 2. Installation de Node.js 20 LTS
echo "2/7 - Installation de Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Installation de PM2
echo "3/7 - Installation de PM2..."
npm install -g pm2

# 4. Installation de Nginx
echo "4/7 - Installation de Nginx..."
apt install -y nginx

# 5. Installation de Certbot pour SSL
echo "5/7 - Installation de Certbot..."
apt install -y certbot python3-certbot-nginx

# 6. Création du répertoire et clone du repo
echo "6/7 - Clonage du projet..."
mkdir -p /var/www
cd /var/www

if [ -d "$APP_DIR" ]; then
    echo "Le répertoire existe déjà, mise à jour..."
    cd chronos
    git pull origin main
else
    git clone $REPO_URL chronos
    cd chronos
fi

# 7. Installation et build
echo "7/7 - Installation des dépendances et build..."
npm ci --production=false
npm run build

# Configuration Nginx
echo "Configuration de Nginx..."
cp scripts/nginx.conf /etc/nginx/sites-available/chronos
ln -sf /etc/nginx/sites-available/chronos /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Démarrage avec PM2
echo "Démarrage de l'application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "=== Installation terminée ==="
echo ""
echo "Prochaine étape : Configurer SSL avec Certbot"
echo "Exécutez : certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "Après SSL, votre app sera accessible sur https://$DOMAIN"
