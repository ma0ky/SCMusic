#!/usr/bin/env bash
# Signe l'APK de release avec la clé SCMusic (stockée HORS du dépôt, dans ~/.scmusic-keys).
# Produit dist/SCMusic-<version>.apk, prêt à être publié.
set -euo pipefail

KEYS="${SCMUSIC_KEYS:-$HOME/.scmusic-keys}/signing.properties"
[ -f "$KEYS" ] || { echo "Clé introuvable : $KEYS"; exit 1; }
prop() { grep "^$1=" "$KEYS" | cut -d= -f2-; }

BUILD_TOOLS="$ANDROID_HOME/build-tools/37.0.0"
VERSION=$(node -p "require('./app.json').expo.version")
IN=android/app/build/outputs/apk/release/app-release.apk
OUT="dist/SCMusic-$VERSION.apk"

mkdir -p dist
"$BUILD_TOOLS/zipalign" -f -p 4 "$IN" "$OUT"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$(prop storeFile)" --ks-key-alias "$(prop keyAlias)" \
  --ks-pass "pass:$(prop storePassword)" \
  "$OUT"
"$BUILD_TOOLS/apksigner" verify --print-certs "$OUT" | grep -E "SHA-256|Signer"
sha256sum "$OUT" | tee "$OUT.sha256"
echo "APK signé : $OUT"
