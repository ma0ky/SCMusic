#!/usr/bin/env bash
# Publie l'APK signé sur le dépôt public des versions : les téléphones le proposent ensuite en mise à jour.
# Usage : npm run apk:publish -- "Nouveautés de cette version"
set -euo pipefail

REPO="${SCMUSIC_RELEASES_REPO:-ma0ky/SCMusic-releases}"
VERSION=$(node -p "require('./app.json').expo.version")
APK="dist/SCMusic-$VERSION.apk"
NOTES="${1:-SCMusic $VERSION}"

[ -f "$APK" ] && [ -f "$APK.sha256" ] || { echo "APK signé introuvable : lance d'abord npm run apk && npm run apk:sign"; exit 1; }
gh release view "v$VERSION" --repo "$REPO" >/dev/null 2>&1 && { echo "La version v$VERSION est déjà publiée sur $REPO"; exit 1; }

gh release create "v$VERSION" "$APK" "$APK.sha256" --repo "$REPO" --title "SCMusic $VERSION" --notes "$NOTES"
echo "Publié : https://github.com/$REPO/releases/tag/v$VERSION"
