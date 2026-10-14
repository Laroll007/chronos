#!/bin/bash
# Build de l'app Android native (Capacitor) pour le Play Store : AAB signé avec
# la clé d'envoi (chronos-android/keystore.properties, gitignoré).
#
# Garde-fou : refuse de produire le fichier si l'app ne pointe pas sur
# https://mychronos.fr (variable CHRONOS_ANDROID_URL de test restée active).
set -euo pipefail
cd "$(dirname "$0")/.."

unset CHRONOS_ANDROID_URL
export JAVA_HOME="${JAVA_HOME_21:-$HOME/.local/jdks/jdk-21.0.11+10/Contents/Home}"

npx cap sync android

CONFIG=android/app/src/main/assets/capacitor.config.json
if ! grep -q '"url": "https://mychronos.fr/dashboard"' "$CONFIG" || grep -q '"cleartext"' "$CONFIG"; then
  echo "❌ $CONFIG ne pointe pas sur https://mychronos.fr/dashboard : build annulé." >&2
  exit 1
fi

(cd android && ./gradlew clean bundleRelease)

AAB=android/app/build/outputs/bundle/release/app-release.aab
"$JAVA_HOME/bin/keytool" -printcert -jarfile "$AAB" | grep -q "60:8D:4D:FC:D8:1D:42:70:B5:3B:9F:0A:13:01:DB:22:B8:D7:89:57:60:8B:2F:CB:A1:83:EA:E5:98:F1:F5:E3" \
  || { echo "❌ AAB non signé avec la clé d'envoi Play Store." >&2; exit 1; }
unzip -p "$AAB" base/assets/capacitor.config.json | grep -q '"url": "https://mychronos.fr/dashboard"' \
  || { echo "❌ Configuration embarquée inattendue dans l'AAB." >&2; exit 1; }

echo "✅ $AAB prêt (signé clé d'envoi, pointe sur https://mychronos.fr)."
